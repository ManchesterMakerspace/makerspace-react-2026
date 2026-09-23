import * as React from 'react';
import { Capacitor, CapacitorHttp, registerPlugin } from '@capacitor/core';
import { App } from '@capacitor/app';
import { AppLauncher } from '@capacitor/app-launcher';
import { Browser } from '@capacitor/browser';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { registerPlatform, portalUrl } from 'app/platform';
import { createNativeFetch, configureNativeAxios } from './transport';
import { NativeShell } from './NativeShell';
import { NativeRoutes } from './CatalogPage';
import { googleSignIn } from './auth';
import { sessionCsrf } from './session';

const PortalSession = registerPlugin<{
  csrfToken(): Promise<{ token: string }>;
  clear(): Promise<void>;
  firebaseConfiguration(): Promise<{ configured: boolean; projectId: string }>;
}>('PortalSession');
const origin = process.env.MMS_PORTAL_API_URL!;
let openedBrowser = false;
let projectId = '';
export const setFirebaseProjectId = (value: string) => { projectId = value; };

export const initializeNative = () => {
  if (!Capacitor.isNativePlatform()) throw new Error('Launch MMS Portal from the Android application.');
  const nativeFetch = createNativeFetch({
    origin, localOrigin: window.location.origin, fallback: window.fetch.bind(window),
    http: request => CapacitorHttp.request(request),
    csrfToken: sessionCsrf(() => PortalSession.csrfToken(), async () => {
      // Bootstrap after logout; never retry the mutation itself.
        const response = await CapacitorHttp.get({ url: origin + '/api/config', headers: { 'Cache-Control': 'no-store' }, disableRedirects: true });
        if (response.status !== 200) throw new Error('Unable to establish a portal session. Please reconnect and try again.');
    }),
  });
  window.fetch = nativeFetch;
  const openExternal = async (input: string) => {
    const url = new URL(input, origin);
    if (url.username || url.password || !['https:', 'mailto:', 'tel:'].includes(url.protocol) &&
        !(process.env.MMS_PORTAL_DEBUG && url.protocol === 'http:' && url.origin === origin)) {
      throw new Error('Unsupported external link.');
    }
    if (['mailto:', 'tel:'].includes(url.protocol)) { await AppLauncher.openUrl({ url: url.href }); return; }
    await Browser.open({ url: url.href });
    openedBrowser = true;
  };
  registerPlatform({
    native: true, apiOrigin: origin,
    configureAxios: client => configureNativeAxios(client, nativeFetch, origin, window.location.origin),
    openExternal,
    signInGoogle: googleSignIn({
      configuration: () => PortalSession.firebaseConfiguration(), projectId: () => projectId,
      signIn: () => FirebaseAuthentication.signInWithGoogle(),
      idToken: () => FirebaseAuthentication.getIdToken({ forceRefresh: true }),
    }),
    signOut: async () => {
      try { await FirebaseAuthentication.signOut(); } finally { await PortalSession.clear(); }
    },
    shareImage: async (data, filename) => {
      if (!/^data:image\/png;base64,/.test(data)) throw new Error('Unsupported image.');
      const safeName = filename.replace(/[^a-zA-Z0-9_.-]/g, '_');
      const file = await Filesystem.writeFile({ directory: Directory.Cache, path: safeName, data: data.split(',')[1] });
      try { await Share.share({ title: 'Makerspace QR code', files: [file.uri] }); }
      finally { await Filesystem.deleteFile({ directory: Directory.Cache, path: safeName }).catch(() => undefined); }
    },
    shareText: async (text, filename) => {
      const safeName = filename.replace(/[^a-zA-Z0-9_.-]/g, '_');
      const file = await Filesystem.writeFile({ directory: Directory.Cache, path: safeName, data: text, encoding: Encoding.UTF8 });
      try { await Share.share({ title: filename, files: [file.uri] }); }
      finally { await Filesystem.deleteFile({ directory: Directory.Cache, path: safeName }).catch(() => undefined); }
    },
    renderShell: () => <NativeShell />, renderRoutes: NativeRoutes,
  });
  void App.addListener('appStateChange', ({ isActive }) => {
    if (isActive && openedBrowser) {
      openedBrowser = false;
      window.dispatchEvent(new Event('mms:refresh'));
    }
  });
  // Delegated handling also covers links in legacy shared components.
  document.addEventListener('click', event => {
    const anchor = (event.target as Element)?.closest?.('a[href]') as HTMLAnchorElement | null;
    if (!anchor || event.defaultPrevented || anchor.hasAttribute('download')) return;
    const url = new URL(anchor.href);
    const external = url.origin !== window.location.origin || url.pathname.startsWith('/api/');
    if (!external) return;
    event.preventDefault();
    void openExternal(url.origin === window.location.origin ? portalUrl(url.pathname + url.search) : url.href)
      .catch(() => window.dispatchEvent(new CustomEvent('mms:link-error')));
  });
  const originalOpen = window.open.bind(window);
  window.open = ((url?: string | URL, ...args: any[]) => {
    if (!url) return originalOpen(url, ...args);
    void openExternal(String(url)).catch(() => window.dispatchEvent(new CustomEvent('mms:link-error')));
    return null;
  }) as typeof window.open;
};
