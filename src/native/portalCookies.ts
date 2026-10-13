import { Capacitor, CapacitorCookies, registerPlugin } from '@capacitor/core';

interface AndroidPortalCookies {
  read(options: { url: string }): Promise<Record<string, string>>;
  setRememberPreference(options: { url: string; enabled: boolean }): Promise<void>;
}

let androidBridge: AndroidPortalCookies | undefined;
const androidCookies = () => androidBridge ||= registerPlugin<AndroidPortalCookies>('MakerspaceCookies');

// Capacitor 8 Android getCookies ignores its URL and evaluates document.cookie
// at the local WebView origin. Only our two non-authentication cookies are
// exposed by this bridge; session/remember credentials stay in the native jar.
export const readPortalCookies = (url: string): Promise<Record<string, string>> =>
  Capacitor.getPlatform() === 'android' ? androidCookies().read({ url }) : CapacitorCookies.getCookies({ url });

export async function saveNativeRememberPreference(url: string, enabled: boolean, expires: string): Promise<void> {
  if (Capacitor.getPlatform() === 'android') {
    await androidCookies().setRememberPreference({ url, enabled });
  } else {
    await CapacitorCookies.setCookie({ url, key: 'makerspace_stay_logged_in', value: String(enabled), path: '/', expires });
  }
}
