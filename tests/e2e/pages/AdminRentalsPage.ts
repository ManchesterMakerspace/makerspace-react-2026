import { Page, expect } from '@playwright/test';

export class AdminRentalsPage {
  constructor(private page: Page) {}

  async goto(): Promise<void> {
    await this.page.getByRole('button', { name: 'Menu' }).click();
    await this.page.getByRole('link', { name: 'Rentals' }).click();
    await this.page.waitForURL(/\/admin\/rentals/, { timeout: 15_000 });
    await this.page.getByRole('button', { name: 'Add Type' }).waitFor({ state: 'visible', timeout: 15_000 });
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
    // MUI v5: accessible name comes from label ('Display Name'), not placeholder
    await this.page.getByRole('textbox', { name: 'Display Name' }).fill(displayName);
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
    // MUI v5: use label-based locators within dialog to avoid ambiguity
    const dialog = this.page.locator('[role="dialog"]');
    await dialog.getByRole('textbox').nth(0).fill(spot.number);
    await dialog.getByRole('textbox').nth(1).fill(spot.location);

    // MUI Select for rental type
    await dialog.getByRole('button').first().click();
    await this.page.getByRole('option', { name: spot.rentalTypeName, exact: true }).click();

    await dialog.getByRole('textbox').nth(2).fill(spot.description);
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
