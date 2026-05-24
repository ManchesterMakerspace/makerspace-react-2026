import { Page } from '@playwright/test';

export class AuthPage {
  constructor(private page: Page) {}

  async signIn(email: string, password: string): Promise<void> {
    await this.page.goto('/');
    await this.page.getByRole('button', { name: 'Sign In' }).click();
    await this.page.getByRole('textbox', { name: 'Email' }).fill(email);
    await this.page.getByRole('textbox', { name: 'Password' }).fill(password);
    await this.page.getByRole('button', { name: 'Sign In' }).click();
    await this.page.waitForURL(/\/members\//, { timeout: 30_000 });
    await this.page.waitForLoadState('networkidle');
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
