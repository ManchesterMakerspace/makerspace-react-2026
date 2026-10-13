import { Capacitor } from '@capacitor/core';
import { portalOrigin } from 'native/transport';
import { readPortalCookies, saveNativeRememberPreference } from 'native/portalCookies';

export const rememberPreferenceCookie = 'makerspace_stay_logged_in';
const providerChoiceKey = 'firebase_pending_remember_me';

export const isPhoneClient = (agent = navigator.userAgent): boolean =>
  !/iPad|Tablet/i.test(agent) && (/iPhone/i.test(agent) || (/Android/i.test(agent) && /Mobile/i.test(agent)));

export async function readRememberPreference(): Promise<boolean> {
  if (!isPhoneClient()) return false;
  try {
    const value = Capacitor.isNativePlatform()
      ? (await readPortalCookies(portalOrigin()))[rememberPreferenceCookie]
      : document.cookie.split('; ').find(cookie => cookie.startsWith(`${rememberPreferenceCookie}=`))?.split('=')[1];
    return value !== 'false';
  } catch {
    return true;
  }
}

// This cookie is a UI preference, never an authentication credential.
export async function saveRememberPreference(enabled: boolean): Promise<void> {
  const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString();
  try {
    if (Capacitor.isNativePlatform()) {
      await saveNativeRememberPreference(portalOrigin(), enabled, expires);
    } else {
      document.cookie = `${rememberPreferenceCookie}=${enabled}; Path=/; Expires=${expires}; SameSite=Lax${window.location.protocol === 'https:' ? '; Secure' : ''}`;
    }
  } catch {
    // Keep the component's current selection even when storage is unavailable.
  }
}

export function captureProviderRememberChoice(enabled: boolean): void {
  try { sessionStorage.setItem(providerChoiceKey, String(isPhoneClient() && enabled)); } catch { /* best effort */ }
}

export function providerRememberChoice(): boolean {
  try { return isPhoneClient() && sessionStorage.getItem(providerChoiceKey) === 'true'; } catch { return false; }
}

export function clearProviderRememberChoice(): void {
  try { sessionStorage.removeItem(providerChoiceKey); } catch { /* best effort */ }
}
