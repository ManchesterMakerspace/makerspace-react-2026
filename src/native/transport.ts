import { Capacitor, CapacitorCookies, CapacitorHttp } from '@capacitor/core';
import axios, { AxiosError, AxiosHeaders } from 'axios';

export const portalOrigin = () => process.env.NATIVE_API_ORIGIN || window.location.origin;

/** Installed before importing app modules, including the generated API client. */
export async function installNativeTransport() {
  if (!Capacitor.isNativePlatform()) return;
  const origin = new URL(portalOrigin());
  if (origin.protocol !== 'https:' || origin.origin === window.location.origin) throw new Error('A remote HTTPS NATIVE_API_ORIGIN is required.');
  const originalFetch = window.fetch.bind(window);
  const isPortalRequest = (url: URL) =>
    (url.origin === window.location.origin || url.origin === origin.origin) &&
    (url.pathname.startsWith('/api/') || /^\/(shops|tools)\/[^/]+\/public/.test(url.pathname));

  window.fetch = async (input, init = {}) => {
    const local = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, window.location.origin);
    if (!isPortalRequest(local)) return originalFetch(input, init);
    const url = new URL(local.pathname + local.search, origin).href;
    const method = (init.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
    const headers = new Headers(input instanceof Request ? input.headers : undefined);
    new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    const signal = init.signal || (input instanceof Request ? input.signal : undefined);
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      const cookies = await CapacitorCookies.getCookies({ url: origin.href });
      headers.set('X-XSRF-TOKEN', decodeURIComponent(cookies['XSRF-TOKEN'] || ''));
    }
    // Native cookie jar supplies the session. Never forward local Origin/Cookie headers.
    headers.delete('Origin'); headers.delete('Cookie');
    let body = init.body ?? (input instanceof Request && !['GET', 'HEAD'].includes(method) ? await input.clone().text() : undefined);
    let data: any = body;
    if (typeof body === 'string' && headers.get('Content-Type')?.includes('application/json')) data = JSON.parse(body);
    const binary = /application\/pdf|application\/octet-stream|image\//i.test(headers.get('Accept') || '') || /\/documents\/|\/receipts\//.test(local.pathname);
    const response = await CapacitorHttp.request({ url, method, headers: Object.fromEntries(headers.entries()), data,
      responseType: binary ? 'arraybuffer' : 'text', connectTimeout: 15000, readTimeout: 30000, disableRedirects: true });
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const responseHeaders = new Headers(response.headers);
    const binaryBody = binary && !responseHeaders.get('Content-Type')?.includes('application/json') &&
      (response.status < 400 || Capacitor.getPlatform() === 'ios');
    const payload = binaryBody ? Uint8Array.from(atob(response.data), char => char.charCodeAt(0))
      : typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
    return new Response([204, 205, 304].includes(response.status) ? null : payload, {
      status: response.status, headers: response.headers,
    });
  };
  const fallback = axios.getAdapter(axios.defaults.adapter);
  axios.defaults.adapter = async config => {
    const url = new URL(axios.getUri(config), window.location.origin);
    if (!isPortalRequest(url)) return fallback(config);
    const headers = AxiosHeaders.from(config.headers).toJSON() as Record<string, string>;
    const response = await window.fetch(url, { method: config.method?.toUpperCase(), headers, body: config.data, signal: config.signal as AbortSignal });
    const data = config.responseType === 'blob' ? await response.blob() : config.responseType === 'arraybuffer' ? await response.arrayBuffer() : await response.text();
    const result = { data, status: response.status, statusText: response.statusText, headers: Object.fromEntries(response.headers.entries()), config, request: null };
    if (config.validateStatus && !config.validateStatus(response.status)) throw new AxiosError(`Request failed (${response.status})`, AxiosError.ERR_BAD_RESPONSE, config, null, result);
    return result;
  };
  // Public config establishes the remote session's CSRF cookie before any POST.
  const bootstrap = await window.fetch('/api/config');
  if (!bootstrap.ok) throw new Error('Cannot connect to the Makerspace server. Reopen the app to retry.');
}
