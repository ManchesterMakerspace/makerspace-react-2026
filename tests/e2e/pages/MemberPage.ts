import { Page, expect } from '@playwright/test';
import { TestMember } from '../fixtures/testData';

export class MemberPage {
  constructor(private page: Page) {}

  async waitForProfile(): Promise<void> {
    await this.page.waitForURL(/\/members\//, { timeout: 30_000 });
    await this.page.waitForLoadState('networkidle');
  }

  async reloadProfile(): Promise<void> {
    await this.page.reload();
    await this.waitForProfile();
  }

  async getProfileUrl(): Promise<string> {
    return this.page.url();
  }

  async dismissNotificationModal(): Promise<void> {
    const submit = this.page.locator('#notification-modal-submit');
    if (await submit.isVisible({ timeout: 3_000 })) {
      await submit.click();
      await submit.waitFor({ state: 'hidden', timeout: 10_000 });
    }
  }

  async dismissRentalAgreementModal(): Promise<void> {
    const btn = this.page.getByRole('button', { name: 'Return to Rentals' });
    if (await btn.isVisible({ timeout: 3_000 })) await btn.click();
  }

  async verifyMembershipStatus(expected: string): Promise<void> {
    await expect(this.page.locator('#member-detail-status'))
      .toContainText(expected, { timeout: 15_000 });
  }

  async verifyMembershipType(expected: string): Promise<void> {
    await expect(this.page.locator('#member-detail-type'))
      .toContainText(expected, { timeout: 15_000 });
  }

  async getExpiration(): Promise<string> {
    return (await this.page.locator('#member-detail-expiration').textContent()) || '';
  }

  async clickTab(name: string): Promise<void> {
    await this.page.getByRole('tab', { name: new RegExp(name, 'i') }).click();
    await this.page.waitForTimeout(1000);
  }

  // ── FOB Registration ──────────────────────────────────────────────────────

  async openFobModal(): Promise<void> {
    await this.page.getByRole('button', { name: 'Register Fob' }).click();
    await this.page.waitForSelector('#card-form-submit', { timeout: 15_000 });
  }

  async importFob(): Promise<void> {
    await this.page.getByRole('button', { name: 'Import New Key' }).click();
  }

  async waitForFobUid(uid: string): Promise<void> {
    await this.page.waitForFunction(
      (u) => document.querySelector('#card-form-key-confirmation')?.textContent?.trim() === u,
      uid,
      { timeout: 30_000 }
    );
  }

  async verifyAddressInFobModal(address: {
    street: string; city: string; state: string; postalCode: string;
  }): Promise<void> {
    const table = this.page.locator('#card-form table');
    await expect(table).toContainText(address.street,     { timeout: 10_000 });
    await expect(table).toContainText(address.city);
    await expect(table).toContainText(address.state);
    await expect(table).toContainText(address.postalCode);
  }

  async checkIdVerified(): Promise<void> {
    await this.page.getByRole('checkbox', { name: /verified member/i }).check();
  }

  async submitFobModal(): Promise<void> {
    await this.page.getByRole('button', { name: 'Submit' }).click();
    await this.page.waitForTimeout(1000);
    await this.reloadProfile();
  }

  // ── Admin member management ───────────────────────────────────────────────

  async goToMembersList(): Promise<void> {
    await this.page.getByRole('button', { name: 'Menu' }).click();
    await this.page.getByRole('link', { name: 'Members', exact: true }).click();
    await this.page.waitForURL(/\/members$/, { timeout: 15_000 });
  }

  async searchMembers(query: string): Promise<void> {
    const searchBox = this.page.getByRole('textbox', { name: 'Search...' });
    // Wait for search input to be enabled — it's disabled while members table loads
    await searchBox.waitFor({ state: 'visible', timeout: 15_000 });
    await expect(searchBox).toBeEnabled({ timeout: 10_000 });
    // Uncheck "View only current members" so expired/non-active members appear in results
    const currentMembersCheckbox = this.page.getByRole('checkbox', { name: 'View only current members' });
    if (await currentMembersCheckbox.isChecked({ timeout: 3_000 }).catch(() => false)) {
      await currentMembersCheckbox.uncheck();
      await this.page.waitForTimeout(500);
    }
    await searchBox.fill(query);
    await searchBox.press('Enter');
    await this.page.waitForTimeout(500);
  }

  async clickMemberLink(name: string): Promise<void> {
    await this.page.getByRole('link', { name }).click();
    await this.waitForProfile();
  }

  async clickCreateNewMember(): Promise<void> {
    await this.page.getByRole('button', { name: 'Create New Member' }).click();
    await this.page.waitForSelector('form', { timeout: 10_000 });
  }

  async fillAdminMemberForm(member: TestMember): Promise<void> {
    await this.page.getByRole('textbox', { name: 'First Name' }).fill(member.firstname);
    await this.page.getByRole('textbox', { name: 'Last Name' }).fill(member.lastname);
    await this.page.getByRole('textbox', { name: 'Email / Username' }).fill(member.email);
    await this.page.getByRole('textbox', { name: 'Phone Number' }).fill(member.phone);
    await this.page.getByRole('textbox', { name: 'Street Address' }).fill(member.address.street);
    await this.page.getByRole('textbox', { name: 'City' }).fill(member.address.city);
    await this.page.locator('#member-form-state').selectOption(member.address.state);
    await this.page.getByRole('textbox', { name: 'Postal Code' }).fill(member.address.postalCode);
    await this.page.getByRole('checkbox', { name: 'Member Contract Signed?' }).check();
  }

  async saveAdminMemberForm(): Promise<void> {
    await this.page.getByRole('button', { name: 'Save' }).click();
    await this.page.waitForTimeout(2000);
    // If SMTP error dialog is still open, dismiss it — member IS created despite the error
    const cancelBtn = this.page.getByRole('button', { name: 'Cancel' });
    if (await cancelBtn.isVisible({ timeout: 2_000 })) await cancelBtn.click();
    await this.page.waitForTimeout(500);
  }

  async setExpirationDate(dateStr: string): Promise<void> {
    // dateStr format: YYYY-MM-DD
    await this.page.getByRole('button', { name: 'Edit' }).click();
    await this.page.waitForSelector('[role="dialog"]', { timeout: 10_000 });
    await this.page.getByRole('textbox', { name: 'Expiration Date' }).fill(dateStr);
    await this.page.getByRole('button', { name: 'Save' }).click();
    await this.page.waitForSelector('[role="dialog"]', { state: 'hidden', timeout: 15_000 });
    await this.reloadProfile();
  }

  // ── Billing ───────────────────────────────────────────────────────────────

  async clickManageSubscription(): Promise<void> {
    await this.page.getByRole('link', { name: 'Manage Subscription' }).click();
    await this.page.waitForURL(/\/billing/, { timeout: 15_000 });
    await this.page.waitForLoadState('networkidle');
  }
}
