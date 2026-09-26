/** @jest-environment node */
const mockRequest = jest.fn();
const mockCookies = jest.fn();
jest.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => true, getPlatform: () => 'android' },
  CapacitorCookies: { getCookies: (...args: any[]) => mockCookies(...args) },
  CapacitorHttp: { request: (...args: any[]) => mockRequest(...args) },
}));
import axios from 'axios';
import { installNativeTransport } from '../../../src/native/transport';
describe('native portal session transport', () => {
  const originalAdapter = axios.defaults.adapter;
  let fallback: jest.Mock;
  beforeEach(() => {
    jest.clearAllMocks(); axios.defaults.adapter = originalAdapter;
    process.env.NATIVE_API_ORIGIN = 'https://members.example.org';
    fallback = jest.fn().mockResolvedValue(new Response('{}'));
    (globalThis as any).window = { location: { origin: 'https://localhost' }, fetch: fallback };
    mockCookies.mockResolvedValue({ 'XSRF-TOKEN': 'remote%2Btoken' });
    mockRequest.mockResolvedValue({ status: 200, data: {}, headers: { 'Content-Type': 'application/json' } });
  });
  afterEach(() => { axios.defaults.adapter = originalAdapter; delete process.env.NATIVE_API_ORIGIN; delete (globalThis as any).window; });
  it('bootstraps CSRF and maps requests while overriding local/stale credentials', async () => {
    await installNativeTransport();
    expect(mockRequest.mock.calls[0][0].url).toBe('https://members.example.org/api/config');
    await window.fetch('/api/admin/cards/card1', { method: 'DELETE', headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': 'stale', Origin: 'https://localhost', Cookie: 'local=secret' }, body: '{"version":"one"}' });
    const request = mockRequest.mock.calls[1][0];
    expect(request.headers['x-xsrf-token']).toBe('remote+token');
    expect(request.headers.origin).toBeUndefined(); expect(request.headers.cookie).toBeUndefined();
    expect(request.data).toEqual({ version: 'one' }); expect(request.disableRedirects).toBe(true);
  });
  it('does not send remote credentials to another origin', async () => {
    await installNativeTransport(); await window.fetch('https://elsewhere.test/api/cards');
    expect(mockRequest).toHaveBeenCalledTimes(1); expect(fallback).toHaveBeenCalledTimes(1);
  });
  it('maps Axios instances through the same transport and propagates failures', async () => {
    await installNativeTransport();
    const api = axios.create();
    mockRequest.mockResolvedValue({ status: 403, data: { error: 'Forbidden' }, headers: { 'Content-Type': 'application/json' } });
    await expect(api.get('/api/admin/cards/lookup?uid=000AFF')).rejects.toMatchObject({ response: { status: 403, data: { error: 'Forbidden' } } });
  });
  it('returns binary API downloads without corrupting the bytes', async () => {
    await installNativeTransport();
    mockRequest.mockResolvedValue({ status: 200, data: 'AAH/', headers: { 'Content-Type': 'application/pdf' } });
    const response = await window.fetch('/api/documents/agreement');
    expect(Array.from(new Uint8Array(await response.arrayBuffer()))).toEqual([0, 1, 255]);
  });
  it('rejects insecure native origins', async () => {
    process.env.NATIVE_API_ORIGIN = 'http://example.org';
    await expect(installNativeTransport()).rejects.toThrow('HTTPS'); expect(mockRequest).not.toHaveBeenCalled();
  });
});
