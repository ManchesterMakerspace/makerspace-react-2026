const mockNative = jest.fn(() => false);
const mockGetCookies = jest.fn();
const mockSetCookie = jest.fn();
jest.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => mockNative(), getPlatform: () => 'ios' },
  CapacitorCookies: { getCookies: (...args: any[]) => mockGetCookies(...args), setCookie: (...args: any[]) => mockSetCookie(...args) },
}));
jest.mock('native/transport', () => ({ portalOrigin: () => 'https://members.example.org' }));
import { isPhoneClient, readRememberPreference, saveRememberPreference, rememberPreferenceCookie,
  captureProviderRememberChoice, providerRememberChoice, clearProviderRememberChoice } from 'ui/auth/rememberPreference';

const clients = require('../../../fixtures/mobile_session_clients.json') as { name: string; agent: string; phone: boolean }[];

describe('mobile login preference', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNative.mockReturnValue(false);
    jest.spyOn(navigator, 'userAgent', 'get').mockReturnValue(clients[0].agent);
    document.cookie = `${rememberPreferenceCookie}=; Max-Age=0; Path=/`;
    sessionStorage.clear();
  });
  afterEach(() => jest.restoreAllMocks());

  it.each(clients)('classifies $name consistently with Rails', client => {
    expect(isPhoneClient(client.agent)).toBe(client.phone);
  });
  it('defaults phones on, persists opt-out and lets the user opt back in', async () => {
    expect(await readRememberPreference()).toBe(true);
    await saveRememberPreference(false);
    expect(await readRememberPreference()).toBe(false);
    await saveRememberPreference(true);
    expect(await readRememberPreference()).toBe(true);
  });
  it('never enables the desktop default even with a saved enabled preference', async () => {
    await saveRememberPreference(true);
    jest.spyOn(navigator, 'userAgent', 'get').mockReturnValue(clients[6].agent);
    expect(await readRememberPreference()).toBe(false);
  });
  it('uses the remote native cookie jar and one-year expiry', async () => {
    mockNative.mockReturnValue(true);
    mockGetCookies.mockResolvedValue({ [rememberPreferenceCookie]: 'false' });
    expect(await readRememberPreference()).toBe(false);
    await saveRememberPreference(true);
    expect(mockGetCookies).toHaveBeenCalledWith({ url: 'https://members.example.org' });
    const cookie = mockSetCookie.mock.calls[0][0];
    expect(cookie).toMatchObject({ key: rememberPreferenceCookie, value: 'true', path: '/', url: 'https://members.example.org' });
    expect(Date.parse(cookie.expires) - Date.now()).toBeGreaterThan(364 * 86400000);
  });
  it('tolerates unavailable preference storage', async () => {
    mockNative.mockReturnValue(true);
    mockGetCookies.mockRejectedValue(new Error('unavailable'));
    mockSetCookie.mockRejectedValue(new Error('unavailable'));
    expect(await readRememberPreference()).toBe(true);
    await expect(saveRememberPreference(false)).resolves.toBeUndefined();
  });
  it('captures the provider attempt independently of subsequent preference changes', async () => {
    captureProviderRememberChoice(false);
    await saveRememberPreference(true);
    expect(providerRememberChoice()).toBe(false);
    captureProviderRememberChoice(true);
    await saveRememberPreference(false);
    expect(providerRememberChoice()).toBe(true);
    clearProviderRememberChoice();
    expect(providerRememberChoice()).toBe(false);
    expect(await readRememberPreference()).toBe(false);
  });
  it('does not enable redirect persistence when session storage is blocked', () => {
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    captureProviderRememberChoice(true);
    expect(providerRememberChoice()).toBe(false);
  });
});
