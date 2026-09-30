import { normalizeUid } from '../../../src/nfc/uid';
describe('NFC UID normalization', () => {
  it.each(['1b:1a:4d:2f', '1b-1a-4d-2f', ' 1b1a4d2f ', '1B1A4D2F'])('normalizes %s', value => {
    expect(normalizeUid(value)).toBe('1B1A4D2F');
  });
  it('preserves byte order, leading zeroes, signed bytes and long UIDs', () => {
    expect(normalizeUid([0, 10, -1])).toBe('000AFF');
    expect(normalizeUid(new Uint8Array([4, 0, 1, 2, 3, 4, 5]))).toBe('04000102030405');
  });
  it.each(['', '1', '0x12', '1G', '12::34', '12:34-56', '12 34', '12:3', '１２'])('rejects malformed %s', value => {
    expect(() => normalizeUid(value)).toThrow();
  });
  it('rejects non-byte arrays', () => { expect(() => normalizeUid([256])).toThrow(); expect(() => normalizeUid([])).toThrow(); });
});
