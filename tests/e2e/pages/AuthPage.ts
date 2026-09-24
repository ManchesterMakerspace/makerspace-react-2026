import { Page } from '@playwright/test';

export class AuthPage {
  constructor(private page: Page) {}

  async signIn(email: string, password: string): Promise<void> {
    const navStart = Date.now();
    await this.page.goto('/login');

    // page.url() right after goto() reflects the URL Playwright requested,
    // not what the SPA does next. If a previous member's session is still
    // active, the app boots up, validates the stored token, and redirects
    // away from /login back to that member's own profile -- but only after
    // goto() has already resolved, so checking page.url() here always reads
    // '/login' and wrongly concludes "not authenticated". That skipped the
    // logout step entirely and left the test waiting forever for a login
    // form that the app had already redirected away from. Race the two
    // real outcomes instead of trusting the URL.
    const emailField = this.page.getByRole('textbox', { name: 'Email' });
    const menuButton = this.page.getByRole('button', { name: 'Menu' });
    const outcome = await Promise.race([
      emailField.waitFor({ state: 'visible', timeout: 20_000 }).then(() => 'login' as const),
      menuButton.waitFor({ state: 'visible', timeout: 20_000 }).then(() => 'authenticated' as const),
    ]).catch(() => 'neither' as const);

    if (outcome === 'authenticated') {
      await this.logout();
      await this.page.goto('/login');
    }

    // Wait for login form to be ready before filling.
    // Timing is logged regardless of outcome so CI output shows actual
    // elapsed time from navigation start — needed to tell apart "needs
    // more margin" from "genuinely hanging" the next time this is slow
    // or fails.
    try {
      await emailField.waitFor({ state: 'visible', timeout: 60_000 });
    } finally {
      const elapsed = Date.now() - navStart;
      if (elapsed > 5_000) {
        console.log(`[AuthPage.signIn] goto('/login') -> email field visible took ${elapsed}ms`);
      }
    }
    await emailField.fill(email);

    const passwordField = this.page.getByRole('textbox', { name: 'Password' });
    await passwordField.waitFor({ state: 'visible', timeout: 5_000 });
    await passwordField.fill(password);

    // Wait briefly for any form validation to settle before submitting
    await this.page.waitForTimeout(300);
    await this.page.getByRole('button', { name: 'Sign In' }).click();

    // If Devise redirected to login page with error, retry once
    await this.page.waitForTimeout(500);
    const errorMsg = this.page.getByText('You need to sign in or sign up before continuing');
    if (await errorMsg.isVisible({ timeout: 2_000 })) {
      await emailField.fill(email);
      await passwordField.fill(password);
      await this.page.getByRole('button', { name: 'Sign In' }).click();
    }

    await this.page.waitForURL(/\/members\//, { timeout: 30_000 });
    // Wait for member profile to actually render instead of networkidle
    // networkidle never resolves due to continuous background polling
    await this.page.waitForSelector('#member-detail-type, #member-detail-name, [data-testid="member-profile"]', {
      timeout: 30_000,
      state: 'attached'
    }).catch(() => {
      // Profile elements may have different IDs — fall back to waiting for menu button
      // which only renders when authenticated and profile is loaded
    });
    await this.page.getByRole('button', { name: 'Menu' }).waitFor({ state: 'visible', timeout: 15_000 });
  }

  async logout(): Promise<void> {
    const logoutLink = this.page.locator('#logout');
    if (!await logoutLink.isVisible()) {
      await this.page.click('#menu-button');
      await logoutLink.waitFor({ state: 'visible' });
    }
    await logoutLink.click();
    await this.page.waitForURL(/\/$|\/login/, { timeout: 15_000 });
    // A request still in flight from the page just logged out of can resolve
    // with a 401 after this URL match, and globalAuthInterceptor answers that
    // with its own hard `window.location.href` redirect to /login. Wait for
    // whatever navigation just landed to fully settle so that redirect can't
    // still be in progress when the caller's next page.goto('/login') runs —
    // two navigations to the same URL otherwise race and Playwright reports
    // the second as "interrupted by another navigation".
    await this.page.waitForLoadState('domcontentloaded');
  }

  async navigateViaMenu(linkName: string): Promise<void> {
    await this.page.getByRole('button', { name: 'Menu' }).click();
    await this.page.getByRole('link', { name: linkName, exact: true }).click();
  }
}
