import { Capacitor } from '@capacitor/core';
import { portalOrigin } from './transport';

export function nativeDocumentUrl(src: string): string | undefined {
  if (!Capacitor.isNativePlatform()) return undefined;
  const url = new URL(src, window.location.origin);
  const origin = new URL(portalOrigin()).origin;
  if (![window.location.origin, origin].includes(url.origin) ||
      !/^\/api\/(?:documents\/|(?:admin\/)?billing\/receipts\/)/.test(url.pathname)) return undefined;
  return new URL(url.pathname + url.search, origin).href;
}

export interface FrameContent {
  src?: string;
  srcDoc?: string;
  dispose: () => void;
}

/** Use the native session transport: iframe navigations cannot use its cookie jar. */
export async function loadNativeDocument(url: string, signal: AbortSignal): Promise<FrameContent> {
  const response = await window.fetch(url, { credentials: 'include', headers: { Accept: 'text/html' }, signal });
  if (!response.ok) throw new Error(`Unable to load document (${response.status}). Please retry or sign in again.`);
  const type = (response.headers.get('Content-Type') || '').toLowerCase();
  if (type.includes('text/html')) {
    const html = await response.text();
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    const document = new DOMParser().parseFromString(html, 'text/html');
    document.querySelectorAll('base').forEach(base => base.remove());
    const base = document.createElement('base');
    base.href = url;
    base.target = '_blank';
    document.head.prepend(base);
    return { srcDoc: '<!doctype html>\n' + document.documentElement.outerHTML, dispose: () => {} };
  }
  if (!type.includes('application/pdf') && !type.startsWith('image/')) throw new Error('The server returned an unsupported document format.');
  const blob = await response.blob();
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
  const src = URL.createObjectURL(blob);
  return { src, dispose: () => URL.revokeObjectURL(src) };
}
