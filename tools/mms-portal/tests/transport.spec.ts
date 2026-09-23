import axios from 'axios';
import { makeRequest, isApiErrorResponse } from 'makerspace-ts-api-client';
import { apiDestination, configureNativeAxios, createNativeFetch, TransportOptions } from '../src/transport';
const origin = 'https://members.example.org';
const localOrigin = 'https://localhost';
describe('native first-party transport', () => {
  let options: TransportOptions;
  beforeEach(() => {
    options = { origin, localOrigin, csrfToken: jest.fn().mockResolvedValue('fresh-token'),
      fallback: jest.fn().mockResolvedValue(new Response('external')),
      http: jest.fn().mockResolvedValue({ status: 200, data: { ok: true },
        headers: { 'Content-Type': 'application/json', 'total-items': '41', 'Set-Cookie': 'private=session' } }) };
  });
  test.each(['/api/config', localOrigin + '/api/config', origin + '/api/config'])('maps %s to Rails', input => {
    expect(apiDestination(input, origin, localOrigin)).toBe(origin + '/api/config');
  });
  test('preserves path parameters, native session ownership, and pagination headers', async () => {
    const response = await createNativeFetch(options)('/api/members?page=2', { method: 'POST',
      headers: { 'X-XSRF-TOKEN': 'stale', Cookie: 'bad', 'Content-Type': 'application/json' }, body: '{"member":{}}' });
    expect(options.http).toHaveBeenCalledWith(expect.objectContaining({
      url: origin + '/api/members?page=2', method: 'POST', data: '{"member":{}}',
      headers: expect.objectContaining({ 'x-xsrf-token': 'fresh-token' }), disableRedirects: true,
    }));
    expect((options.http as jest.Mock).mock.calls[0][0].headers.cookie).toBeUndefined();
    expect(response.headers.get('total-items')).toBe('41');
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(await response.clone().json()).toEqual({ ok: true });
  });
  test.each(['https://firebase.googleapis.com/api/auth', 'https://evil.org/api/members', '/assets/logo.svg'])('leaves %s outside the adapter', async input => {
    await createNativeFetch(options)(input);
    expect(options.fallback).toHaveBeenCalledWith(input, {});
    expect(options.http).not.toHaveBeenCalled();
  });
  test('bootstraps with a GET without reading a CSRF token', async () => {
    await createNativeFetch(options)('/api/config');
    expect(options.csrfToken).not.toHaveBeenCalled();
  });
  test('supports Request objects and preserves empty logout responses', async () => {
    options.http = jest.fn().mockResolvedValue({ status: 204, data: '', headers: {} });
    const response = await createNativeFetch(options)(new Request(origin + '/api/members/sign_out', { method: 'DELETE' }));
    expect(response.status).toBe(204);
    expect(await response.text()).toBe('');
  });
  test('never retries a failed mutation', async () => {
    options.http = jest.fn().mockRejectedValue(new Error('offline'));
    await expect(createNativeFetch(options)('/api/members', { method: 'POST', body: '{}' })).rejects.toThrow('offline');
    expect(options.http).toHaveBeenCalledTimes(1);
  });
  test('does not submit an already aborted request', async () => {
    const controller = new AbortController(); controller.abort();
    await expect(createNativeFetch(options)('/api/config', { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
    expect(options.http).not.toHaveBeenCalled();
  });
  test('preserves Axios query serialization and rejects HTTP errors for auth interceptors', async () => {
    const client = axios.create();
    configureNativeAxios(client, createNativeFetch(options), origin, localOrigin);
    const result = await client.get('/api/members', { params: { page: 2 } });
    expect(result.data).toEqual({ ok: true });
    expect(result.headers['total-items']).toBe('41');
    options.http = jest.fn().mockResolvedValue({ status: 401, data: { error: 'Expired' }, headers: {} });
    await expect(client.get('/api/members')).rejects.toMatchObject({ response: { status: 401, data: { error: 'Expired' } } });
  });
  test('preserves the generated client data/error and pagination contracts', async () => {
    Object.defineProperty(globalThis, 'window', { configurable: true, value: { fetch: createNativeFetch(options) } });
    Object.defineProperty(globalThis, 'document', { configurable: true, value: { cookie: '' } });
    try {
      const result = await makeRequest('GET', '/shops', { page: 2 });
      expect(result.data).toEqual({ ok: true });
      expect(result.response.headers.get('total-items')).toBe('41');
      expect(options.http).toHaveBeenCalledWith(expect.objectContaining({ url: origin + '/api/shops?page=2' }));
      options.http = jest.fn().mockResolvedValue({ status: 401, data: { message: 'Expired' }, headers: {} });
      const failure = await makeRequest('POST', '/members/sign_in', {});
      expect(isApiErrorResponse(failure)).toBe(true);
      expect(failure.response.status).toBe(401);
      expect(options.http).toHaveBeenCalledTimes(1);
    } finally {
      delete (globalThis as any).window;
      delete (globalThis as any).document;
    }
  });
});
