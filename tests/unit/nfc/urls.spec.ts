import { classifyNfcUrl } from '../../../src/nfc/urls';
const origin = 'https://members.example.org';
const id = '0123456789abcdef01234567';
describe('NDEF destinations', () => {
  it.each(['shop', 'shops', 'api/shop'])('maps %s to internal shop', kind => {
    expect(classifyNfcUrl(`${origin}/${kind}/${id}/public.html`, origin).path).toBe(`/workshops?shop=${id}`);
  });
  it('maps tools and bounty details', () => {
    expect(classifyNfcUrl(`${origin}/api/tool/${id}/public.html`, origin).path).toBe(`/workshops?tool=${id}`);
    expect(classifyNfcUrl(`${origin}/volunteer/tasks/${id}`, origin).path).toBe(`/volunteer/tasks/${id}`);
  });
  it('requires exact trusted origin and route', () => {
    expect(classifyNfcUrl(`https://members.example.org.evil.test/shop/${id}/public.html`, origin).path).toBeUndefined();
    expect(classifyNfcUrl(`${origin}/members/${id}`, origin).path).toBeUndefined();
    expect(classifyNfcUrl(`${origin}:444/shop/${id}/public.html`, origin).path).toBeUndefined();
  });
  it.each(['javascript:alert(1)', 'data:text/html,test', 'https://user:pass@members.example.org/', 'bad-url'])('does not open %s', url => {
    expect(classifyNfcUrl(url, origin).openable).toBe(false);
  });
  it('recognizes shortcodes', () => expect(classifyNfcUrl(`${origin}/L23456789AB`, origin).code).toBe('23456789AB'));
});
