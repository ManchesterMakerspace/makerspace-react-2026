export type QrDestination = { kind: 'short'; code: string } | { kind: 'route'; path: string };
const id = '[a-fA-F0-9]{24}';
export const resourcePath = (path: string): string => {
  const catalog = path.match(new RegExp('^/(?:api/)?(shops?|tools?)/(' + id + ')/public(?:\\.html|\\.json)?$'));
  if (catalog) return '/mobile/catalog/' + (catalog[1].startsWith('shop') ? 'shops/' : 'tools/') + catalog[2].toLowerCase();
  if (new RegExp('^/tools/' + id + '/request-checkout$').test(path) ||
      new RegExp('^/rentals/spots/' + id + '$').test(path)) return path.toLowerCase();
  throw new Error('This QR code is not a supported Makerspace resource.');
};
export const parseQr = (value: string, origin: string): QrDestination => {
  let url: URL;
  try { url = new URL(value.trim()); } catch { throw new Error('Scan a Makerspace resource QR code.'); }
  if (url.origin !== new URL(origin).origin || !['https:', 'http:'].includes(url.protocol) ||
      url.username || url.password || url.search || url.hash) throw new Error('This QR code is not from this Makerspace portal.');
  const code = url.pathname.match(/^\/L([2-9A-Z]{10})$/);
  return code ? { kind: 'short', code: code[1] } : { kind: 'route', path: resourcePath(url.pathname) };
};
export const resolveQr = async (value: string, origin: string, request: typeof fetch): Promise<string> => {
  const destination = parseQr(value, origin);
  if (destination.kind === 'route') return destination.path;
  const response = await request('/api/shortcodes/' + destination.code, { cache: 'no-store' });
  if (!response.ok) throw new Error(response.status === 404 ? 'This resource is no longer available.' : 'Unable to resolve this QR code. Check your connection and try again.');
  const result = await response.json();
  if (typeof result.target_path !== 'string') throw new Error('The portal returned an invalid QR destination.');
  return resourcePath(result.target_path);
};
