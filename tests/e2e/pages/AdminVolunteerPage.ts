import { Page, expect } from '@playwright/test';

export class AdminVolunteerPage {
  constructor(private page: Page) {}

  async goto(): Promise<void> {
    await this.page.getByRole('button', { name: 'Menu' }).click();
    await this.page.getByRole('link', { name: 'Volunteer' }).click();
    await this.page.waitForLoadState('networkidle');
  }

  async goToTab(name: string): Promise<void> {
    await this.page.getByRole('tab', { name }).click();
    await this.page.waitForTimeout(500);
  }

  // ── Events ─────────────────────────────────────────────────────────────────

  async createEvent(title: string, description: string, date: string, hours: number): Promise<void> {
    await this.page.getByRole('button', { name: 'Create Event' }).click();
    await this.page.waitForSelector('[role="dialog"]', { timeout: 10_000 });

    await this.page.locator('#create-volunteer-event input[type="text"]').fill(title);
    await this.page.locator('textarea').fill(description);
    await this.page.getByRole('spinbutton').fill(String(hours));
    await this.page.locator('input[type="date"]').fill(date);
    await this.page.getByRole('button', { name: 'Submit' }).click();
    await this.page.waitForTimeout(500);
  }

  async verifyEventInTable(title: string): Promise<void> {
    await expect(this.page.getByText(new RegExp(title, 'i')).first())
      .toBeVisible({ timeout: 10_000 });
  }

  // ── Bounty Tasks ───────────────────────────────────────────────────────────

  async createTask(title: string, description: string, credits: number): Promise<void> {
    await this.page.getByRole('button', { name: 'Create Task' }).click();
    await this.page.waitForSelector('[role="dialog"]', { timeout: 10_000 });

    await this.page.locator('#create-volunteer-task input[type="text"]').fill(title);
    await this.page.locator('textarea').fill(description);
    await this.page.getByRole('spinbutton').fill(String(credits));
    await this.page.getByRole('button', { name: 'Submit' }).click();
    await this.page.waitForTimeout(500);
  }

  async verifyTaskInTable(title: string): Promise<void> {
    await expect(this.page.getByText(new RegExp(title, 'i')).first())
      .toBeVisible({ timeout: 10_000 });
  }

  async verifyTaskStatus(title: string, status: string): Promise<void> {
    const row = this.page.getByRole('row', { name: new RegExp(title, 'i') });
    await expect(row.getByText(status)).toBeVisible({ timeout: 10_000 });
  }

  async verifyTask(title: string): Promise<void> {
    await expect(this.page.getByText(new RegExp(title, 'i')).first())
      .toBeVisible({ timeout: 10_000 });
  }

  // Select a task row by task title (avoids hardcoded IDs)
  async selectTaskByTitle(title: string): Promise<void> {
    const row = this.page.getByRole('row', { name: new RegExp(title, 'i') });
    await row.locator('input[type="checkbox"]').check();
  }

  async clickVerify(): Promise<void> {
    await this.page.getByRole('button', { name: 'Verify' }).click();
    await this.page.waitForTimeout(500);
  }
}

// ── Member volunteer page (member's own view) ──────────────────────────────

export class MemberVolunteerPage {
  constructor(private page: Page) {}

  async goToVolunteerTab(): Promise<void> {
    await this.page.getByRole('tab', { name: /volunteer/i }).click();
    await this.page.waitForTimeout(500);
  }

  async selectFirstAvailableTask(): Promise<void> {
    // Select the first unclaimed task checkbox
    await this.page.locator('table input[type="checkbox"]').first().check();
  }

  async claimTask(): Promise<void> {
    await this.page.getByRole('button', { name: 'Claim Task' }).click();
    await this.page.waitForTimeout(500);
  }

  async selectClaimedTask(): Promise<void> {
    await this.page.locator('table input[type="checkbox"]').first().check();
  }

  async markComplete(): Promise<void> {
    await this.page.getByRole('button', { name: 'Mark Complete' }).click();
    await this.page.waitForTimeout(500);
  }

  async verifyTaskStatus(status: string): Promise<void> {
    await expect(this.page.getByText(status).first()).toBeVisible({ timeout: 10_000 });
  }
}
