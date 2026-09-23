import type { AxiosInstance } from 'axios';
import type { ReactNode } from 'react';

/** Browser defaults; the mobile entry registers capabilities before importing main. */
export interface PortalPlatform {
  native: boolean;
  apiOrigin: string;
  signInGoogle?: () => Promise<string>;
  signOut?: () => Promise<void>;
  configureAxios?: (client: AxiosInstance) => void;
  openExternal?: (url: string) => Promise<void>;
  shareImage?: (dataUrl: string, filename: string) => Promise<void>;
  shareText?: (text: string, filename: string) => Promise<void>;
  renderShell?: () => ReactNode;
  renderRoutes?: (authenticated: boolean) => ReactNode;
}
export const platform: PortalPlatform = { native: false, apiOrigin: process.env.BASE_URL || '' };
export const registerPlatform = (implementation: PortalPlatform) => Object.assign(platform, implementation);
export const isPortalApiUrl = (input: string): boolean => {
  const url = new URL(input, window.location.origin);
  return url.pathname.startsWith('/api/') &&
    (url.origin === window.location.origin || (!!platform.apiOrigin && url.origin === new URL(platform.apiOrigin).origin));
};
export const portalUrl = (path: string): string => {
  const origin = platform.apiOrigin || window.location.origin;
  const url = new URL(path, origin);
  if (url.origin !== new URL(origin).origin) throw new Error('Unsupported portal destination.');
  return url.href;
};
export const openPortal = (path: string) => platform.openExternal
  ? platform.openExternal(portalUrl(path)) : Promise.resolve(window.location.assign(portalUrl(path)));
export const navigatePortal = (path: string) => {
  if (!path.startsWith('/') || path.startsWith('//')) return;
  if (platform.native) window.dispatchEvent(new CustomEvent('mms:navigate', { detail: path }));
  else window.location.assign(path);
};
export const NATIVE_PENDING_PATH = 'mms-pending-path';
export const safePendingPath = (value: string | null) =>
  value && value.startsWith('/') && !value.startsWith('//') && !value.includes('\\') ? value : null;
