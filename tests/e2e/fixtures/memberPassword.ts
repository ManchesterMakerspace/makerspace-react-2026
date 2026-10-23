import { APIRequestContext, expect } from '@playwright/test';

// Use Playwright's isolated `request` fixture, never page.request: changing a
// password invalidates the browser's existing session, and failed navigations
// must not prevent this fixture cleanup. Playwright disposes the request fixture.
export async function restoreMemberPassword(
  request: APIRequestContext,
  email: string,
  originalPassword: string,
  changedPassword: string,
): Promise<void> {
  const config = await request.get('/api/config');
  expect(config.status(), 'Password cleanup must bootstrap a fresh session').toBe(200);

  const csrfHeaders = async () => {
    const { cookies } = await request.storageState();
    const cookie = cookies.find(item => item.name === 'XSRF-TOKEN');
    return {
      Accept: 'application/json',
      'X-XSRF-TOKEN': cookie ? decodeURIComponent(cookie.value) : '',
    };
  };
  const signIn = async (password: string) => request.post('/api/members/sign_in', {
    headers: await csrfHeaders(),
    data: { member: { email, password } },
  });

  const changedLogin = await signIn(changedPassword);
  if (changedLogin.status() === 401) {
    // The test may have failed before saving its new password. Only an actual
    // credential rejection permits this fallback; server/CSRF errors still fail.
    const originalLogin = await signIn(originalPassword);
    expect(originalLogin.status(), 'Password cleanup must confirm the original credentials').toBe(200);
    return;
  }
  expect(changedLogin.status(), 'Password cleanup must authenticate with the changed credentials').toBe(200);

  // Read the current token after login because Devise rotates the session.
  // The seed password intentionally predates the UI's stronger-password policy.
  const restored = await request.put('/api/members/change_password', {
    headers: await csrfHeaders(),
    data: { password: originalPassword },
  });
  expect(restored.status(), 'Password cleanup must restore the seeded credentials').toBe(204);
}
