import { Page, expect } from '@playwright/test';

export class AdminRentalsPage {
  constructor(private page: Page) {}

  async goto(): Promise<void> {
    await this.page.getByRole('button', { name: 'Menu' }).click();
    await this.page.getByRole('link', { name: 'Rentals' }).click();
    await this.page.waitForURL(/\/admin\/rentals/, { timeout: 15_000 });
    await this.page.waitForLoadState('networkidle');
  }

  async goToTab(name: string): Promise<void> {
    await this.page.getByRole('tab', { name: new RegExp(name, 'i') }).click();
    await this.page.waitForTimeout(1000);
  }

  // ── Rental Types ──────────────────────────────────────────────────────────

  async waitForTypesTable(): Promise<void> {
    await this.page.getByRole('button', { name: 'Add Type' })
      .waitFor({ state: 'visible', timeout: 15_000 });
  }

  async clickAddType(): Promise<void> {
    await this.page.getByRole('button', { name: 'Add Type' }).click();
    await this.page.waitForSelector('#rental-type-form-submit', { timeout: 10_000 });
  }

  async fillRentalTypeForm(displayName: string, billingPlanLabel: string): Promise<void> {
    await this.page.getByRole('textbox', { name: /storage tote|full shelf/i }).fill(displayName);
    // Label includes price suffix e.g. "Monthly Tote Rental — $15.00/mo"
    // Find the option value whose text contains our label, then select by value
    const combobox = this.page.getByRole('combobox');
    const optionValue = await combobox.locator('option')
      .filter({ hasText: billingPlanLabel })
      .getAttribute('value');
    if (!optionValue) throw new Error(`Billing plan option not found: ${billingPlanLabel}`);
    await combobox.selectOption(optionValue);
  }

  async submitRentalTypeForm(): Promise<void> {
    await this.page.getByRole('button', { name: 'Create Type' }).click();
    await this.page.waitForSelector('#rental-type-form-submit', { state: 'hidden', timeout: 30_000 });
    await this.page.waitForTimeout(500);
  }

  async verifyTypeInTable(displayName: string): Promise<void> {
    await expect(this.page.getByRole('cell', { name: displayName }))
      .toBeVisible({ timeout: 15_000 });
  }

  // ── Rental Spots ──────────────────────────────────────────────────────────

  async waitForSpotsTable(): Promise<void> {
    await this.page.getByRole('button', { name: 'Add Spot' })
      .waitFor({ state: 'visible', timeout: 15_000 });
  }

  async clickAddSpot(): Promise<void> {
    await this.page.getByRole('button', { name: 'Add Spot' }).click();
    await this.page.waitForSelector('#rental-spot-form-submit', { timeout: 10_000 });
  }

  async fillRentalSpotForm(spot: {
    number: string; location: string; rentalTypeName: string; description: string;
  }): Promise<void> {
    await this.page.getByRole('textbox', { name: /shelf-1a|LR-Tote/i }).fill(spot.number);
    await this.page.getByRole('textbox', { name: /back shop|locker room/i }).fill(spot.location);

    // MUI Select for rental type — no accessible label, target button within dialog
    // It's the only button in the form before Create Spot / Cancel
    await this.page.locator('[role="dialog"]').getByRole('button').first().click();
    await this.page.getByRole('option', { name: spot.rentalTypeName, exact: true }).click();

    await this.page.getByRole('textbox', { name: /full shelf|bottom row/i }).fill(spot.description);
  }

  async submitRentalSpotForm(): Promise<void> {
    await this.page.getByRole('button', { name: 'Create Spot' }).click();
    await this.page.waitForSelector('#rental-spot-form-submit', { state: 'hidden', timeout: 30_000 });
    await this.page.waitForTimeout(500);
  }

  async searchForSpot(spotNumber: string): Promise<void> {
    await this.page.getByRole('textbox', { name: 'Search...' }).fill(spotNumber);
    await this.page.waitForTimeout(500);
  }

  async verifySpotInTable(spotNumber: string): Promise<void> {
    await expect(this.page.getByRole('cell', { name: spotNumber }))
      .toBeVisible({ timeout: 15_000 });
  }
}
