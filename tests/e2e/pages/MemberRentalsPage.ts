import { Page, expect } from '@playwright/test';

export class MemberRentalsPage {
  constructor(private page: Page) {}

  async waitForRentalsTab(): Promise<void> {
    // MUI v5: the rental selector renders as a combobox (MUI Select), not a button
    await this.page.getByRole('combobox', { name: 'Select an Available Rental' })
      .waitFor({ timeout: 15_000 });
  }

  async selectSpot(spotNumber: string): Promise<void> {
    await this.page.getByRole('combobox', { name: 'Select an Available Rental' }).click();
    await this.page.waitForSelector('[role="listbox"]', { timeout: 10_000 });
    await this.page.getByRole('option', { name: new RegExp(spotNumber) }).click();
    await this.page.waitForTimeout(500);
  }

  async confirmRental(): Promise<void> {
    await this.page.getByRole('button', { name: 'Confirm Rental' }).click();
    await this.page.waitForTimeout(1000);
  }

  async requestRental(): Promise<void> {
    // For spots that require admin approval — first button says "Submit Request"
    await this.page.getByRole('button', { name: 'Submit Request' }).click();
    await this.page.waitForSelector('[role="dialog"]', { timeout: 10_000 });
    await this.page.getByRole('dialog').getByRole('button', { name: 'Submit Request' }).click();
    await this.page.waitForSelector('[role="dialog"]', { state: 'hidden', timeout: 15_000 });
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
    // Poll with reloads — Braintree sandbox can be slow to update invoice status
    for (let i = 0; i < 5; i++) {
      await this.page.getByRole('tab', { name: /dues/i }).click();
      await this.page.waitForTimeout(2000);
      const pastDue = this.page.getByText('Past Due');
      if (!await pastDue.isVisible({ timeout: 2_000 })) return;
      // Still past due — reload and retry
      await this.page.reload();
      await this.page.waitForLoadState('networkidle');
    }
    // Final assertion
    await expect(this.page.getByText('Past Due')).not.toBeVisible({ timeout: 5_000 });
  }
}
