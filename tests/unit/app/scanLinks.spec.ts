import { classifyScanLink, resolveScanLink } from 'app/scanLinks';
const origin = 'https://members.example.org';
const id = '0123456789abcdef01234567';
describe('scanned destinations', () => {
  it.each(['shop', 'shops', 'tool', 'tools'])('maps public %s aliases', kind => {
    for (const prefix of ['', 'api/']) for (const suffix of ['', '.html']) {
      expect(classifyScanLink(`${origin}/${prefix}${kind}/${id}/public${suffix}`, origin).path)
        .toBe(`/workshops?${kind.startsWith('shop') ? 'shop' : 'tool'}=${id}`);
    }
  });
  it.each(['/workshops?tool=abc#details', '/reservations?shop=abc', '/tool-checkouts?mode=self-service',
    '/rentals', `/rentals/spots/${id}`, '/rentals/spots/A-01', `/tools/${id}/request-checkout`,
    `/volunteer/tasks/${id}`, '/fix-tickets', `/fix-tickets/${id}`, '/checkout', `/checkout/receipt/${id}`,
    '/billing/invoices', '/members/me/settings', '/agreements/member/abc', '/earned-memberships'])('preserves %s', path => {
    expect(classifyScanLink(path, origin)).toMatchObject({ kind: 'internal', path });
  });
  it.each(['23456789AB', 'L23456789AB', '/L23456789AB', 'HTTPS://MEMBERS.EXAMPLE.ORG/L23456789AB'])('recognizes %s', input => {
    expect(classifyScanLink(input, origin)).toMatchObject({ kind: 'shortcode', code: '23456789AB' });
  });
  it.each(['https://other.example/workshops', 'https://members.example.org.evil.test/workshops',
    'http://members.example.org/workshops', '/logout', '/unknown'])('never automatically opens %s', input => {
    expect(classifyScanLink(input, origin).kind).toBe('external');
  });
  it.each(['javascript:alert(1)', 'data:text/html,test', 'https://name:secret@members.example.org/workshops',
    '//members.example.org/workshops', '/\\evil.test', '/api/members', 'plain text', '', 'L1234567890'])('rejects %s', input => {
    expect(classifyScanLink(input, origin).kind).toBe('unsupported');
  });
  describe('shortcode resolution', () => {
    beforeEach(() => { global.fetch = jest.fn(); });
    const respond = (body: any, status = 200) => (fetch as jest.Mock).mockResolvedValue({ ok: status === 200, status, json: async () => body });
    it.each([`/shop/${id}/public.html`, `/tools/${id}/request-checkout`, `/rentals/spots/${id}`, `/volunteer/tasks/${id}`])('resolves %s', target_path => {
      respond({ target_path });
      return expect(resolveScanLink('23456789AB', origin)).resolves.toMatchObject({ kind: 'internal' });
    });
    it.each(['/L23456789AC', '//evil.test/workshops', 'https://members.example.org/workshops', '/api/members', null])('rejects invalid response %s', target_path => {
      respond({ target_path });
      return expect(resolveScanLink('23456789AB', origin)).rejects.toThrow('unsupported destination');
    });
    it.each([404, 503])('reports HTTP %s', status => {
      respond({}, status);
      return expect(resolveScanLink('23456789AB', origin)).rejects.toThrow(status === 404 ? 'no longer exists' : 'Check your connection');
    });
    it('does not resolve foreign shortcodes', async () => {
      expect((await resolveScanLink('https://foreign.test/L23456789AB', origin)).kind).toBe('external');
      expect(fetch).not.toHaveBeenCalled();
    });
    it('rejects cancellation before and during resolution', async () => {
      const controller = new AbortController(); controller.abort();
      await expect(resolveScanLink('23456789AB', origin, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
      expect(fetch).not.toHaveBeenCalled();
      const late = new AbortController();
      (fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => { late.abort(); return { target_path: '/rentals' }; } });
      await expect(resolveScanLink('23456789AB', origin, late.signal)).rejects.toMatchObject({ name: 'AbortError' });
    });
    it('propagates network failure without navigating', async () => {
      (fetch as jest.Mock).mockRejectedValue(new TypeError('Failed to fetch'));
      await expect(resolveScanLink('23456789AB', origin)).rejects.toThrow('Failed to fetch');
    });
    it('reports malformed JSON as an unusable destination', async () => {
      (fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => { throw new SyntaxError('bad JSON'); } });
      await expect(resolveScanLink('23456789AB', origin)).rejects.toThrow('unsupported destination');
    });
  });
});
