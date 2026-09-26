jest.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => false }, registerPlugin: () => ({}) }));
import { scanNfc } from '../../../src/nfc/scanner';
describe('Web NFC sessions', () => {
  let reader: any;
  beforeEach(() => {
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
    (window as any).NDEFReader = class { scan = jest.fn().mockResolvedValue(undefined); constructor() { reader = this; } };
  });
  it('does not expose incidental serials in NDEF-only mode', () => {
    const result = jest.fn(); scanNfc('ndef', result, jest.fn());
    reader.onreading({ serialNumber: '1b:1a:4d:2f', message: { records: [] } });
    expect(result).toHaveBeenCalledWith({ urls: [], texts: [], unsupported: [] });
  });
  it('normalizes UID and consumes a single reading', () => {
    const result = jest.fn(); scanNfc('enroll', result, jest.fn());
    const event = { serialNumber: '00:ff', message: { records: [] } };
    reader.onreading(event); reader.onreading(event);
    expect(result).toHaveBeenCalledTimes(1); expect(result.mock.calls[0][0].uid).toBe('00FF');
  });
  it('suppresses callbacks after cancellation', () => {
    const result = jest.fn(); const stop = scanNfc('inspect', result, jest.fn()); stop();
    expect(reader.scan.mock.calls[0][0].signal.aborted).toBe(true);
    reader.onreading({ serialNumber: '00:ff', message: { records: [] } }); expect(result).not.toHaveBeenCalled();
  });
});
