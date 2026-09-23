import axios, { AxiosError, AxiosInstance, AxiosResponse } from 'axios';

export interface NativeRequest {
  url: string; method: string; headers: Record<string, string>; data?: string;
  responseType: 'text'; disableRedirects: boolean; connectTimeout: number; readTimeout: number;
}
export interface TransportOptions {
  origin: string;
  localOrigin: string;
  http: (request: NativeRequest) => Promise<{ status: number; headers: Record<string, string>; data: unknown }>;
  csrfToken: () => Promise<string>;
  fallback: typeof fetch;
}
export const apiDestination = (input: string, origin: string, localOrigin: string): string | null => {
  const url = new URL(input, localOrigin);
  if (url.username || url.password || !url.pathname.startsWith('/api/') ||
      ![origin, localOrigin].includes(url.origin)) return null;
  return origin + url.pathname + url.search;
};

/** A scoped fetch bridge, not a global native patch of third-party networking. */
export const createNativeFetch = (options: TransportOptions): typeof fetch => async (input: RequestInfo | URL, init: RequestInit = {}) => {
  const request = typeof Request !== 'undefined' && input instanceof Request ? input : undefined;
  const rawUrl = request ? request.url : String(input);
  const url = apiDestination(rawUrl, options.origin, options.localOrigin);
  if (!url) return options.fallback(input, init);
  const method = (init.method || request?.method || 'GET').toUpperCase();
  const headers = new Headers(request?.headers);
  new Headers(init.headers).forEach((value, name) => headers.set(name, value));
  if (!headers.has('Accept')) headers.set('Accept', 'application/json');
  if (init.cache === 'no-store') headers.set('Cache-Control', 'no-store');
  const signal = init.signal || request?.signal;
  if (signal?.aborted) throw new DOMException('Request aborted', 'AbortError');
  const mutation = !['GET', 'HEAD', 'OPTIONS'].includes(method);
  if (mutation) headers.set('X-XSRF-TOKEN', await options.csrfToken());
  // Native CookieManager owns credentials; never forward JS-supplied cookies.
  headers.delete('cookie');
  let body = init.body;
  if (body === undefined && request && mutation) body = await request.clone().text();
  if (body != null && typeof body !== 'string' && !(body instanceof URLSearchParams)) {
    throw new TypeError('The portal API accepts JSON or URL-encoded bodies.');
  }
  const headerObject: Record<string, string> = {};
  headers.forEach((value, key) => { headerObject[key] = value; });
  const operation = options.http({
    url, method, headers: headerObject, data: body == null ? undefined : String(body),
    responseType: 'text', disableRedirects: true, connectTimeout: 15000, readTimeout: 60000,
  });
  let onAbort: () => void;
  const aborted = new Promise<never>((_, reject) => {
    onAbort = () => reject(new DOMException('Request aborted', 'AbortError'));
    signal?.addEventListener('abort', onAbort, { once: true });
  });
  try {
    const result = await (signal ? Promise.race([operation, aborted]) : operation);
    const responseHeaders = new Headers();
    Object.entries(result.headers || {}).forEach(([name, value]) => {
      if (!/^set-cookie2?$/i.test(name)) responseHeaders.set(name, value);
    });
    const text = typeof result.data === 'string' ? result.data : JSON.stringify(result.data ?? '');
    return new Response([204, 205, 304].includes(result.status) || method === 'HEAD' ? null : text,
      { status: result.status, headers: responseHeaders });
  } finally {
    signal?.removeEventListener('abort', onAbort!);
  }
};

export const configureNativeAxios = (client: AxiosInstance, nativeFetch: typeof fetch, origin: string, localOrigin: string) => {
  const original = client.defaults.adapter;
  client.defaults.adapter = async config => {
    const uri = axios.getUri(config);
    if (!apiDestination(uri, origin, localOrigin)) return axios.getAdapter(original)(config);
    const response = await nativeFetch(uri, {
      method: config.method, headers: config.headers.toJSON() as Record<string, string>,
      body: config.data, signal: config.signal as AbortSignal,
    });
    const text = await response.text();
    let data: unknown = text;
    if (config.responseType !== 'text' && text) {
      try { data = JSON.parse(text); } catch { /* Axios permits non-JSON text responses. */ }
    }
    const result: AxiosResponse = { data, status: response.status, statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()), config };
    if (config.validateStatus && !config.validateStatus(response.status)) {
      throw new AxiosError('Request failed with status code ' + response.status,
        response.status >= 500 ? AxiosError.ERR_BAD_RESPONSE : AxiosError.ERR_BAD_REQUEST, config, undefined, result);
    }
    return result;
  };
};
