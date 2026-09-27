export type ScanDestination = {
  kind: 'internal' | 'external' | 'unsupported' | 'shortcode';
  url: string;
  path?: string;
  code?: string;
  openable: boolean;
};

const id = '[a-f0-9]{24}';
const publicResource = new RegExp(`^/(?:api/)?(shop|tool|shops|tools)/(${id})/public(?:\\.html)?$`);
// Only SPA pages belong here: never API, authentication, or server mutation URLs.
const memberPage = new RegExp(`^/(?:workshops|reservations|tool-checkouts|rentals|rentals/spots/[^/]+|tools/${id}/request-checkout|fix-tickets(?:/${id})?|volunteer/tasks/${id}|checkout(?:/receipt/[^/]+)?|billing(?:/[^/]+)?|members(?:/[^/]+(?:/(?:settings/[^/]+|[^/]+))?)?|agreements/[^/]+(?:/[^/]+)?|earned-memberships)$`);

export function classifyScanLink(input: string, portalOrigin: string): ScanDestination {
  const value = input.trim();
  const unsupported: ScanDestination = { kind: 'unsupported', url: value, openable: false };
  if (!value || /[\\\u0000-\u001f\u007f]/.test(value)) return unsupported;
  const bare = value.match(/^L?([2-9A-Z]{10})$/);
  if (bare) return { ...unsupported, kind: 'shortcode', code: bare[1] };
  let url: URL;
  try {
    if (value.startsWith('//')) return unsupported;
    url = value.startsWith('/') ? new URL(value, portalOrigin) : new URL(value);
  } catch { return unsupported; }
  if (!/^https?:$/.test(url.protocol) || url.username || url.password) return unsupported;
  const external: ScanDestination = { kind: 'external', url: url.href, openable: true };
  if (url.origin !== new URL(portalOrigin).origin) return external;
  const short = url.pathname.match(/^\/L([2-9A-Z]{10})$/);
  if (short) return { ...external, kind: 'shortcode', code: short[1] };
  const resource = url.pathname.match(publicResource);
  if (resource) return { ...external, kind: 'internal', path: `/workshops?${resource[1].startsWith('shop') ? 'shop' : 'tool'}=${resource[2]}` };
  if (/^\/api(?:\/|$)/.test(url.pathname)) return unsupported;
  if (memberPage.test(url.pathname)) return { ...external, kind: 'internal', path: url.pathname + url.search + url.hash };
  return external;
}

export async function resolveScanLink(value: string, origin: string, signal?: AbortSignal): Promise<ScanDestination> {
  const destination = classifyScanLink(value, origin);
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  if (destination.kind !== 'shortcode') return destination;
  const response = await fetch(`/api/shortcodes/${destination.code}`, { signal, cache: 'no-store' });
  if (response.status === 404) throw new Error('This short link is unavailable or no longer exists. Try another QR code.');
  if (!response.ok) throw new Error('Could not resolve this short link. Check your connection and scan again.');
  let body: { target_path?: unknown };
  try { body = await response.json(); }
  catch { throw new Error('This short link returned an unsupported destination. Please scan again.'); }
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  if (typeof body?.target_path !== 'string' || !body.target_path.startsWith('/') || body.target_path.startsWith('//')) {
    throw new Error('This short link returned an unsupported destination.');
  }
  const target = classifyScanLink(body.target_path, origin);
  if (target.kind !== 'internal') throw new Error('This short link returned an unsupported destination.');
  return target;
}
