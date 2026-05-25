import { Page, expect } from '@playwright/test';

export class MemberRentalsPage {
  constructor(private page: Page) {}

  async waitForRentalsTab(): Promise<void> {
    await this.page.getByRole('button', { name: 'Select an Available Rental' })
      .waitFor({ timeout: 15_000 });
  }

  async selectSpot(spotNumber: string): Promise<void> {
    await this.page.getByRole('button', { name: 'Select an Available Rental' }).click();
    await this.page.waitForSelector('[role="listbox"]', { timeout: 10_000 });
    await this.page.getByRole('option', { name: new RegExp(spotNumber) }).click();
    await this.page.waitForTimeout(500);
  }

  async confirmRental(): Promise<void> {
    await this.page.getByRole('button', { name: 'Confirm Rental' }).click();
    await this.page.waitForTimeout(1000);
  }

  async openSignAgreement(): Promise<void> {
    await this.page.getByRole('button', { name: 'Confirm & Sign Agreement' }).click();
    await this.page.waitForTimeout(1000);
  }

  async acceptAndSignAgreement(): Promise<void> {
    await this.page.getByRole('checkbox', { name: /I have read and agree to the/i }).check();
    // Use mouse drag to draw signature — single click is not enough
    const canvas = this.page.locator('canvas').first();
    await canvas.waitFor({ state: 'visible', timeout: 10_000 });
    const box = await canvas.boundingBox();
    if (box) {
      await this.page.mouse.move(box.x + 100, box.y + 80);
      await this.page.mouse.down();
      await this.page.mouse.move(box.x + 200, box.y + 80);
      await this.page.mouse.move(box.x + 200, box.y + 120);
      await this.page.mouse.move(box.x + 150, box.y + 120);
      await this.page.mouse.up();
    }
  }

  async clickProceed(): Promise<void> {
    await this.page.getByRole('button', { name: 'Proceed' }).click();
    await this.page.waitForTimeout(1000);
  }

  async handleRentalAgreementLoopIfPresent(): Promise<void> {
    // Google Drive upload fails with dummy credentials — dismiss loop modal
    const reviewBtn = this.page.getByRole('button', { name: 'Review Documents' });
    if (await reviewBtn.isVisible({ timeout: 3_000 })) {
      await this.page.getByRole('button', { name: 'Return to Rentals' }).click();
    }
  }

  async selectDuesInvoice(): Promise<void> {
    // Select the first outstanding invoice checkbox
    const checkboxes = this.page.getByRole('checkbox');
    await checkboxes.first().check();
  }

  async verifyRentalInTable(spotNumber: string): Promise<void> {
    await expect(this.page.getByRole('cell', { name: spotNumber }))
      .toBeVisible({ timeout: 15_000 });
  }

  async verifyNoPastDueInvoices(): Promise<void> {
    await this.page.getByRole('tab', { name: /dues/i }).click();
    await this.page.waitForTimeout(1000);
    // Pay Selected Dues should be disabled or absent
    const payBtn = this.page.getByRole('button', { name: 'Pay Selected Dues' });
    const isDisabled = await payBtn.getAttribute('disabled') !== null;
    const isHidden   = !await payBtn.isVisible();
    expect(isDisabled || isHidden).toBeTruthy();
  }
}
