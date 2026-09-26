import { TextDecoder, TextEncoder } from 'util';
import { decodeNdef } from '../../../src/nfc/ndef';
(globalThis as any).TextDecoder = TextDecoder;
const data = (text: string) => new DataView(new TextEncoder().encode(text).buffer);
describe('NDEF records', () => {
  it('prefers Smart Poster URI records and retains text', () => {
    expect(decodeNdef([
      { recordType: 'url', data: data('https://ignored.test') },
      { recordType: 'smart-poster', toRecords: () => [{ recordType: 'url', data: data('https://example.org') }] },
      { recordType: 'text', data: data('A tool') },
    ])).toEqual({ urls: ['https://example.org'], texts: ['A tool'], unsupported: [] });
  });
  it('bounds nesting and records', () => {
    const record = { recordType: 'smart-poster', toRecords: () => [record] };
    expect(() => decodeNdef([record])).toThrow();
    expect(() => decodeNdef(Array(65).fill({ recordType: 'empty' }))).toThrow();
  });
});
