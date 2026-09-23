import { parseQr, resolveQr, resourcePath } from '../src/qr';
const origin = 'https://members.example.org';
const id = '0123456789abcdef01234567';
describe('resource QR navigation', () => {
  test.each(['tool', 'tools', 'api/tool'])('maps %s catalog variants', kind => {
    expect(parseQr(origin + '/' + kind + '/' + id + '/public.html', origin))
      .toEqual({ kind: 'route', path: '/mobile/catalog/tools/' + id });
  });
  test('supports uppercase printed origin and short code', () => {
    expect(parseQr('HTTPS://MEMBERS.EXAMPLE.ORG/L23456789AB', origin)).toEqual({ kind: 'short', code: '23456789AB' });
  });
  test.each(['/rentals/spots/', '/tools/'])('keeps resource identifiers', prefix => {
    const path = prefix + id + (prefix === '/tools/' ? '/request-checkout' : '');
    expect(resourcePath(path)).toBe(path);
  });
  test.each([
    'https://evil.example.org/L23456789AB', origin + '.evil.org/L23456789AB',
    'javascript:alert(1)', origin + '/admin', origin + '/L23456789AB?x=y',
    'http://members.example.org/L23456789AB', 'https://user@members.example.org/L23456789AB',
    origin + '/L23456789AB#extra', origin + '/l23456789ab',
  ])('rejects untrusted or unsupported scans: %s', url => {
    expect(() => parseQr(url, origin)).toThrow();
  });
  test('resolves short paths using the read-only API', async () => {
    const request = jest.fn().mockResolvedValue(new Response(JSON.stringify({ target_path: '/api/shop/' + id + '/public.html' })));
    expect(await resolveQr(origin + '/L23456789AB', origin, request)).toBe('/mobile/catalog/shops/' + id);
    expect(request).toHaveBeenCalledWith('/api/shortcodes/23456789AB', { cache: 'no-store' });
  });
  test.each([404, 503])('reports resolution errors (%s)', async status => {
    await expect(resolveQr(origin + '/L23456789AB', origin,
      jest.fn().mockResolvedValue(new Response('', { status })))).rejects.toThrow();
  });
  test('validates the destination returned by the backend', async () => {
    await expect(resolveQr(origin + '/L23456789AB', origin,
      jest.fn().mockResolvedValue(new Response(JSON.stringify({ target_path: 'https://evil.org/' }))))).rejects.toThrow();
  });
});
