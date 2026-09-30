import { Page, expect } from '@playwright/test';

export class SettingsPage {
  constructor(private page: Page) {}

  async goto(): Promise<void> {
    if (/\/members\/[^/]+\/settings(?:\/|$)/.test(new URL(this.page.url()).pathname)) {
      await this.reload();
      return;
    }
    // Account Settings is on the member profile and Home, not the dropdown.
    const acctBtn = this.page.getByRole('button', { name: 'Account Settings' });
    if (await acctBtn.isVisible({ timeout: 2_000 })) {
      await acctBtn.click();
    } else {
      if (new URL(this.page.url()).pathname !== '/home') await this.page.goto('/home');
      await this.page.getByRole('link', { name: 'Account Settings', exact: true }).click();
    }
    await this.page.waitForURL(/\/settings/, { timeout: 15_000 });
    await expect(this.page.locator('#settings-profile')).toBeVisible();
  }

  async reload(): Promise<void> {
    await this.page.reload();
    await this.page.waitForURL(/\/settings/, { timeout: 15_000 });
    await expect(this.page.locator('#settings-profile')).toBeVisible();
  }

  async goToSubscriptionsTab(): Promise<void> {
    await this.page.getByRole('button', { name: 'Subscriptions' }).click();
    await this.page.waitForTimeout(1000);
  }

  async verifyNoSubscription(): Promise<void> {
    await expect(this.page.getByRole('button', { name: 'Update Membership' }))
      .toBeVisible({ timeout: 15_000 });
  }

  async verifyActiveSubscription(): Promise<void> {
    await expect(this.page.getByRole('button', { name: 'Cancel Subscription' }))
      .toBeVisible({ timeout: 30_000 });
  }

  async clickCreateSubscription(): Promise<void> {
    await this.page.getByRole('button', { name: 'Update Membership' }).click();
    // Wait for invoice option rows — not just table shell
    await this.page.getByRole('cell', { name: 'One Month' })
      .waitFor({ timeout: 15_000 });
  }

  async selectMonthlyPlan(): Promise<void> {
    const row = this.page.getByRole('row', { name: /one month/i });
    await row.waitFor({ timeout: 15_000 });
    const alreadySelected = await row.getByRole('button', { name: /selected/i }).isVisible();
    if (!alreadySelected) {
      await row.getByRole('button', { name: /sign up/i }).click();
    }
  }

  async clickNextOnMembershipStep(): Promise<void> {
    await this.page.getByRole('button', { name: 'Next' }).click();
    await this.page.waitForTimeout(500);
  }

  async acceptAuthAgreement(): Promise<void> {
    await this.page.getByRole('checkbox', { name: 'I agree' }).check();
  }

  async clickSubmitPayment(): Promise<void> {
    await this.page.getByRole('button', { name: 'Submit Payment' }).click();
    await this.page.waitForURL(/\/members\//, { timeout: 60_000 });
    await this.page.waitForLoadState('networkidle');
    // Hard reload so settings reflects new subscription
    await this.goto();
    await this.reload();
    await this.goToSubscriptionsTab();
  }

  async clickCancelSubscription(): Promise<void> {
    await this.page.getByRole('button', { name: 'Cancel Subscription' }).click();
    await this.page.waitForSelector('#cancel-subscription-submit', { timeout: 10_000 });
  }

  async confirmCancelSubscription(): Promise<void> {
    await this.page.getByRole('button', { name: 'Submit' }).click();
    await this.page.waitForSelector('#cancel-subscription-submit', { state: 'hidden', timeout: 30_000 });
    await this.reload();
    await this.goToSubscriptionsTab();
  }

  async clickChangePaymentMethod(): Promise<void> {
    await this.page.getByRole('button', { name: 'Change Payment Method' }).click();
    await this.page.waitForSelector('#change-payment-method', { timeout: 10_000 });
  }

  async submitChangePaymentMethod(): Promise<void> {
    await this.page.getByRole('button', { name: 'Submit' }).click();
    await this.page.waitForSelector('#change-payment-method', { state: 'hidden', timeout: 30_000 });
    await this.reload();
    await this.goToSubscriptionsTab();
  }
}
