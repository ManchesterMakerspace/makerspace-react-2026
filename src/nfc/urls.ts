export type NfcDestination = { url: string; path?: string; code?: string; openable: boolean };
export function classifyNfcUrl(value: string, portalOrigin: string): NfcDestination {
  let url: URL;
  try { url = new URL(value); } catch { return { url: value, openable: false }; }
  const result: NfcDestination = { url: value, openable: /^https?:$/.test(url.protocol) && !url.username && !url.password };
  if (!result.openable || url.origin !== new URL(portalOrigin).origin) return result;
  const id = '([a-f0-9]{24})';
  const resource = url.pathname.match(new RegExp(`^/(?:api/)?(shop|tool|shops|tools)/${id}/public(?:\\.html)?$`));
  if (resource) result.path = `/workshops?${resource[1].startsWith('shop') ? 'shop' : 'tool'}=${resource[2]}`;
  else if (new RegExp(`^/(?:volunteer/tasks/${id}|tools/${id}/request-checkout)$`).test(url.pathname)) result.path = url.pathname;
  else {
    const short = url.pathname.match(/^\/L([2-9A-Z]{10})$/);
    if (short) result.code = short[1];
  }
  return result;
}
