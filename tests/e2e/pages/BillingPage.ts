import { Page, expect } from '@playwright/test';

export class BillingPage {
  constructor(private page: Page) {}

  async goto(): Promise<void> {
    await this.page.getByRole('button', { name: 'Menu' }).click();
    await this.page.getByRole('link', { name: 'Billing' }).click();
    await this.page.waitForURL(/\/billing/, { timeout: 15_000 });
    await this.page.waitForLoadState('networkidle');
  }

  async goToSubscriptionsTab(): Promise<void> {
    await this.page.getByRole('tab', { name: /subscriptions/i }).click();
    await this.page.waitForTimeout(1000);
  }

  async waitForSubscriptionRows(): Promise<void> {
    await this.page.waitForFunction(
      () => document.querySelectorAll('[id$="-row"]').length > 0,
      { timeout: 30_000 }
    );
  }

  async selectRowByMemberName(name: string): Promise<void> {
    const row = this.page.getByRole('row').filter({ hasText: name });
    await row.waitFor({ timeout: 15_000 });
    // Check the row checkbox
    await row.getByRole('checkbox').check();
    await this.page.waitForTimeout(500);
  }

  async cancelSelectedSubscription(): Promise<void> {
    await this.page.getByRole('button', { name: 'Cancel Subscription' }).click();
    await this.page.waitForSelector('#cancel-subscription-submit', { timeout: 10_000 });
    await this.page.getByRole('button', { name: 'Submit' }).click();
    await this.page.waitForSelector('#cancel-subscription-submit', { state: 'hidden', timeout: 30_000 });
    await this.page.reload();
    await this.page.waitForLoadState('networkidle');
    await this.goToSubscriptionsTab();
  }

  async verifyMemberNotInTable(name: string): Promise<void> {
    await this.page.waitForFunction(
      (n) => !Array.from(document.querySelectorAll('[id$="-row"]'))
        .some(el => el.textContent?.includes(n)),
      name,
      { timeout: 15_000 }
    );
  }
}
