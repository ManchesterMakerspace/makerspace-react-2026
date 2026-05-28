import { Page, expect } from '@playwright/test';

export class AdminVolunteerPage {
  constructor(private page: Page) {}

  async goto(): Promise<void> {
    await this.page.getByRole('button', { name: 'Menu' }).click();
    await this.page.getByRole('link', { name: 'Volunteer' }).click();
    await this.page.waitForURL(/\/volunteer/, { timeout: 15_000 });
  }

  async createEvent(title: string, description: string, hours: number, date: string): Promise<void> {
    await this.page.locator('#create-volunteer-event input[type="text"]').fill(title);
    // MUI v5 multiline TextField renders a hidden second textarea for sizing.
    // Use getByRole with label name to target only the visible one.
    await this.page.getByRole('textbox', { name: 'Description' }).fill(description);
    await this.page.getByRole('spinbutton').fill(String(hours));
    await this.page.locator('input[type="date"]').fill(date);
    await this.page.getByRole('button', { name: 'Submit' }).click();
  }

  async createTask(title: string, description: string, credits: number): Promise<void> {
    await this.page.locator('#create-volunteer-task input[type="text"]').fill(title);
    // MUI v5 multiline TextField — use label-based selector
    await this.page.getByRole('textbox', { name: 'Description' }).fill(description);
    await this.page.getByRole('spinbutton').fill(String(credits));
    await this.page.getByRole('button', { name: 'Submit' }).click();
    await this.page.waitForTimeout(500);
  }

  async getBountyTasksTable() {
    return this.page.getByRole('heading', { name: 'Bounty Tasks' })
      .locator('../..')
      .locator('table')
      .first();
  }

  async selectFirstAvailableTask(): Promise<void> {
    const table = await this.getBountyTasksTable();
    const firstRow = table.getByRole('row').filter({ hasText: /Available/i }).first();
    await firstRow.waitFor({ state: 'visible', timeout: 10_000 });
    await firstRow.locator('input[type="checkbox"]').check();
    await this.page.getByRole('button', { name: 'Claim Task' }).waitFor({ state: 'visible', timeout: 5_000 });
  }

  async claimTask(): Promise<void> {
    await this.page.getByRole('button', { name: 'Claim Task' }).click();
    await this.page.waitForTimeout(1000);
  }

  async completeTask(): Promise<void> {
    await this.page.getByRole('button', { name: 'Complete Task' }).click();
    await this.page.waitForTimeout(1000);
  }

  async selectTaskByTitle(title: string): Promise<void> {
    const table = await this.getBountyTasksTable();
    const row = table.getByRole('row').filter({ hasText: title }).first();
    await row.waitFor({ state: 'visible', timeout: 10_000 });
    await row.locator('input[type="checkbox"]').check();
  }

  async verifyTask(): Promise<void> {
    await this.page.getByRole('button', { name: 'Verify Task' }).click();
    await this.page.waitForTimeout(1000);
  }

  async verifyTaskStatus(status: string): Promise<void> {
    await expect(this.page.getByText(status).first()).toBeVisible({ timeout: 10_000 });
  }
}

export class MemberVolunteerPage {
  constructor(private page: Page) {}

  async goto(): Promise<void> {
    await this.page.getByRole('button', { name: 'Menu' }).click();
    await this.page.getByRole('link', { name: 'Volunteer' }).click();
    await this.page.waitForURL(/\/volunteer/, { timeout: 15_000 });
  }

  async getBountyTasksTable() {
    return this.page.getByRole('heading', { name: 'Bounty Tasks' })
      .locator('../..')
      .locator('table')
      .first();
  }

  async selectFirstAvailableTask(): Promise<void> {
    const table = await this.getBountyTasksTable();
    const firstRow = table.getByRole('row').filter({ hasText: /Available/i }).first();
    await firstRow.waitFor({ state: 'visible', timeout: 10_000 });
    await firstRow.locator('input[type="checkbox"]').check();
    await this.page.getByRole('button', { name: 'Claim Task' }).waitFor({ state: 'visible', timeout: 5_000 });
  }

  async claimTask(): Promise<void> {
    await this.page.getByRole('button', { name: 'Claim Task' }).click();
    await this.page.waitForTimeout(1000);
  }

  async completeTask(): Promise<void> {
    await this.page.getByRole('button', { name: 'Complete Task' }).click();
    await this.page.waitForTimeout(1000);
  }

  async selectTaskByTitle(title: string): Promise<void> {
    const table = await this.getBountyTasksTable();
    const row = table.getByRole('row').filter({ hasText: title }).first();
    await row.waitFor({ state: 'visible', timeout: 10_000 });
    await row.locator('input[type="checkbox"]').check();
  }

  async verifyTaskStatus(status: string): Promise<void> {
    await expect(this.page.getByText(status).first()).toBeVisible({ timeout: 10_000 });
  }
}
