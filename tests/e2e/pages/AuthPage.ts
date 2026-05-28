import { Page } from '@playwright/test';

export class AuthPage {
  constructor(private page: Page) {}

  async signIn(email: string, password: string): Promise<void> {
    await this.page.goto('/login');

    // If redirected away from /login (already authenticated), logout via menu first
    if (!this.page.url().includes('/login')) {
      await this.page.getByRole('button', { name: 'Menu' }).click();
      await this.page.getByRole('menuitem', { name: 'Logout' }).click();
      await this.page.waitForURL(/\/$|\/login/, { timeout: 10_000 });
      await this.page.goto('/login');
    }

    // Wait for login form to be ready before filling
    const emailField = this.page.getByRole('textbox', { name: 'Email' });
    await emailField.waitFor({ state: 'visible', timeout: 10_000 });
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
  }

  async navigateViaMenu(linkName: string): Promise<void> {
    await this.page.getByRole('button', { name: 'Menu' }).click();
    await this.page.getByRole('link', { name: linkName, exact: true }).click();
  }
}
