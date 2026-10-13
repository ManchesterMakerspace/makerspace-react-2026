const mockPlatform = jest.fn(() => 'android');
const mockRead = jest.fn();
const mockSave = jest.fn();
const mockGetCookies = jest.fn();
const mockSetCookie = jest.fn();
jest.mock('@capacitor/core', () => ({
  Capacitor: { getPlatform: () => mockPlatform() },
  registerPlugin: (name: string) => {
    if (name !== 'MakerspaceCookies') throw new Error('Unexpected plugin');
    return { read: (...args: any[]) => mockRead(...args), setRememberPreference: (...args: any[]) => mockSave(...args) };
  },
  CapacitorCookies: { getCookies: (...args: any[]) => mockGetCookies(...args), setCookie: (...args: any[]) => mockSetCookie(...args) },
}));
import { readPortalCookies, saveNativeRememberPreference } from 'native/portalCookies';

describe('native portal cookies', () => {
  const url = 'https://members.example.org';
  beforeEach(() => { jest.clearAllMocks(); mockPlatform.mockReturnValue('android'); });
  it('reads Android portal cookies through the origin-aware bridge, not document.cookie', async () => {
    mockRead.mockResolvedValue({ 'XSRF-TOKEN': 'token', makerspace_stay_logged_in: 'false' });
    expect(await readPortalCookies(url)).toEqual({ 'XSRF-TOKEN': 'token', makerspace_stay_logged_in: 'false' });
    expect(mockRead).toHaveBeenCalledWith({ url });
    expect(mockGetCookies).not.toHaveBeenCalled();
  });
  it('persists the Android preference with the native one-year cookie implementation', async () => {
    await saveNativeRememberPreference(url, false, 'expiry');
    expect(mockSave).toHaveBeenCalledWith({ url, enabled: false });
    expect(mockSetCookie).not.toHaveBeenCalled();
  });
  it('uses the URL-aware Capacitor API on iOS', async () => {
    mockPlatform.mockReturnValue('ios');
    await readPortalCookies(url);
    await saveNativeRememberPreference(url, true, 'expiry');
    expect(mockGetCookies).toHaveBeenCalledWith({ url });
    expect(mockSetCookie).toHaveBeenCalledWith({ url, key: 'makerspace_stay_logged_in', value: 'true', path: '/', expires: 'expiry' });
  });
});
