import { Page, expect } from '@playwright/test';

export class AdminVolunteerPage {
  constructor(private page: Page) {}

  async goto(): Promise<void> {
    await this.page.getByRole('button', { name: 'Menu' }).click();
    await this.page.getByRole('link', { name: 'Volunteer' }).click();
    await this.page.waitForURL(/\/volunteer/, { timeout: 15_000 });
    await this.page.getByRole('tablist').waitFor({ state: 'visible', timeout: 15_000 });
  }

  async goToTab(name: string): Promise<void> {
    await this.page.getByRole('tab', { name: new RegExp(name, 'i') }).click();
    await this.page.waitForTimeout(500);
  }

  // ── Events ─────────────────────────────────────────────────────────────────

  // Params: title, description, date (YYYY-MM-DD), hours (credit value)
  async createEvent(title: string, description: string, date: string, hours: number): Promise<void> {
    await this.page.getByRole('button', { name: 'Create Event' }).click();
    await this.page.waitForSelector('[role="dialog"]', { timeout: 10_000 });
    const dialog = this.page.locator('[role="dialog"]');
    await dialog.getByRole('textbox', { name: 'Title' }).fill(title);
    await dialog.getByRole('textbox', { name: 'Description' }).fill(description);
    await dialog.locator('input[type="date"]').fill(date);
    await dialog.getByRole('spinbutton', { name: 'Credit Value' }).fill(String(hours));
    await this.page.getByRole('button', { name: 'Submit' }).click();
    await this.page.waitForTimeout(500);
  }

  async verifyEventInTable(title: string): Promise<void> {
    await expect(this.page.getByText(new RegExp(title, 'i')).first())
      .toBeVisible({ timeout: 15_000 });
  }

  // ── Tasks ──────────────────────────────────────────────────────────────────

  async createTask(title: string, description: string, credits: number): Promise<void> {
    await this.page.getByRole('button', { name: 'Create Task' }).click();
    await this.page.waitForSelector('[role="dialog"]', { timeout: 10_000 });
    const dialog = this.page.locator('[role="dialog"]');
    await dialog.getByRole('textbox', { name: 'Title' }).fill(title);
    await dialog.getByRole('textbox', { name: 'Description' }).fill(description);
    await dialog.getByRole('spinbutton', { name: 'Credit Value' }).fill(String(credits));
    await this.page.getByRole('button', { name: 'Submit' }).click();
    await this.page.waitForTimeout(500);
  }

  async verifyTaskInTable(title: string): Promise<void> {
    // Filter to 'available' so the 70+ completed historical tasks don't push new
    // tasks off page 1. The Select is a MUI component — click it then pick the option.
    const statusSelect = this.page.locator('[id="volunteer-tasks-status-filter"], select').first();
    if (await statusSelect.isVisible({ timeout: 2_000 }).catch(() => false)) {
      // Native select path
      await statusSelect.selectOption('available');
    } else {
      // MUI Select path — find by current displayed value near the Tasks heading
      const tasksSection = this.page.locator('text=Bounty Tasks').locator('../..');
      const muiSelect = tasksSection.locator('[role="combobox"]').first();
      if (await muiSelect.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await muiSelect.click();
        await this.page.getByRole('option', { name: 'Available', exact: true }).click();
        await this.page.waitForTimeout(500);
      }
    }
    await expect(this.page.getByText(new RegExp(title, 'i')).first())
      .toBeVisible({ timeout: 15_000 });
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

  // Admin sees "Verify" button when a task is in pending status
  async clickVerify(): Promise<void> {
    await this.page.getByRole('button', { name: 'Verify' }).click();
    await this.page.waitForTimeout(1000);
  }

  async verifyTaskStatus(status: string): Promise<void> {
    await expect(this.page.getByText(status).first()).toBeVisible({ timeout: 10_000 });
  }
}

export class MemberVolunteerPage {
  constructor(private page: Page) {}

  // Navigate to the Volunteer tab on the member's own profile
  async goToVolunteerTab(): Promise<void> {
    await this.page.getByRole('tab', { name: /volunteer/i }).click();
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
    await this.page.reload();
    await this.page.getByRole('button', { name: 'Menu' }).waitFor({ state: 'visible', timeout: 15_000 });
    await this.page.getByRole('tab', { name: /volunteer/i }).click();
    await this.page.waitForTimeout(1000);
  }

  // Select a task this member has already claimed (status = Claimed)
  async selectClaimedTask(): Promise<void> {
    // Locate My Active Claims table via its heading
    const claimsTable = this.page.getByRole('heading', { name: 'My Active Claims' })
      .locator('../..')
      .locator('table')
      .first();
    await claimsTable.waitFor({ state: 'visible', timeout: 10_000 });
    const claimedRow = claimsTable.getByRole('row')
      .filter({ has: this.page.getByRole('cell', { name: 'Claimed', exact: true }) })
      .first();
    await claimedRow.waitFor({ state: 'visible', timeout: 10_000 });
    await claimedRow.locator('input[type="checkbox"]').check();
    await this.page.waitForTimeout(300);
    await this.page.getByRole('button', { name: 'Mark Complete' })
      .waitFor({ state: 'visible', timeout: 10_000 });
  }

  // Member marks their claimed task as complete
  async markComplete(): Promise<void> {
    await this.page.getByRole('button', { name: 'Mark Complete' }).click();
    await this.page.waitForTimeout(1000);
  }

  async completeTask(): Promise<void> {
    return this.markComplete();
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
