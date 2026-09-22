import { Page, expect } from '@playwright/test';

export class AdminToolCheckoutsPage {
  constructor(private page: Page) {}

  async goto(): Promise<void> {
    await this.page.getByRole('button', { name: 'Menu' }).click();
    await this.page.getByRole('link', { name: 'Tool Checkouts' }).click();
    await this.page.waitForLoadState('networkidle');
  }

  async goToTab(name: string): Promise<void> {
    await this.page.getByRole('tab', { name }).click();
    await this.page.waitForTimeout(500);
  }

  // ── Shops ──────────────────────────────────────────────────────────────────

  async addShop(name: string, slackChannel: string): Promise<void> {
    await this.page.getByRole('button', { name: 'Add Shop' }).click();
    await this.page.waitForSelector('[role="dialog"]', { timeout: 10_000 });
    // MUI v5: accessible name is the label, not the placeholder
    await this.page.getByRole('textbox', { name: 'Shop Name' }).fill(name);
    await this.page.getByRole('textbox', { name: 'Slack Channel' }).fill(slackChannel);
    await this.page.getByRole('button', { name: 'Add Shop' }).click();
    await this.page.waitForTimeout(500);
  }

  async verifyShopInTable(name: string): Promise<void> {
    await expect(this.page.getByRole('cell', { name, exact: true })).toBeVisible({ timeout: 10_000 });
  }

  // ── Tools ──────────────────────────────────────────────────────────────────

  async addTool(toolName: string, description: string, shopName: string, prerequisiteName?: string): Promise<void> {
    await this.page.getByRole('button', { name: 'Add Tool' }).click();
    await this.page.waitForSelector('[role="dialog"]', { timeout: 10_000 });

    // Shop select — native select inside dialog
    const dialog = this.page.locator('[role="dialog"]');
    await dialog.locator('select').first().selectOption({ label: shopName });

    // MUI v5: accessible name is the label, not the placeholder
    await this.page.getByRole('textbox', { name: 'Tool Name' }).fill(toolName);
    await this.page.getByRole('textbox', { name: 'Description' }).fill(description);

    // Select prerequisite chip if provided
    if (prerequisiteName) {
      await this.page.getByRole('button', { name: prerequisiteName }).click();
    }

    await this.page.getByRole('button', { name: 'Add Tool' }).click();
    await this.page.waitForTimeout(500);
  }

  async verifyToolInTable(name: string): Promise<void> {
    await expect(this.page.getByText(name).first()).toBeVisible({ timeout: 10_000 });
  }

  // ── Approvers ──────────────────────────────────────────────────────────────

  async addApprover(memberEmail: string, shopName: string): Promise<void> {
    await this.page.getByRole('button', { name: 'Add Approver' }).click();
    await this.page.waitForSelector('[role="dialog"]', { timeout: 10_000 });

    // Click the react-select input directly to focus it, then type to trigger search
    const searchInput = this.page.locator('input[id^="react-select"]').last();
    await searchInput.click();
    await searchInput.type(memberEmail, { delay: 50 });
    await this.page.waitForSelector('[role="option"]', { timeout: 10_000 });
    await this.page.getByRole('option').first().click();

    // Select shop chip — exact: true prevents matching seeded shops with similar names
    await this.page.getByRole('button', { name: shopName, exact: true }).click();

    await this.page.getByRole('button', { name: 'Add Approver' }).click();
    await this.page.waitForTimeout(500);
  }

  // ── Checkout Roster ────────────────────────────────────────────────────────

  async checkOutMember(memberName: string, shopName: string, toolName: string): Promise<void> {
    await this.openCheckout(memberName, shopName, toolName);
    await this.submitCheckout();
  }

  async openCheckout(memberName: string, shopName: string, toolName: string): Promise<void> {
    await this.page.getByRole('button', { name: 'Check Out Member' }).click();
    await this.page.waitForSelector('[role="dialog"]', { timeout: 10_000 });

    // Click the react-select input directly to establish focus, then type slowly
    // to trigger the debounced member search API call
    const memberInput = this.page.locator('input[id^="react-select"]').last();
    await memberInput.click();
    await memberInput.type(memberName, { delay: 50 });
    // Wait for dropdown options to appear after API responds
    await this.page.waitForSelector('[role="option"]', { timeout: 10_000 });
    await this.page.getByRole('option', { name: new RegExp(memberName, 'i') }).first().click();

    const dialog = this.page.getByRole('dialog');
    await dialog.locator('select').nth(0).selectOption({ label: shopName });
    // DO NOT REMOVE: selecting the shop triggers an async re-fetch of that
    // shop's tools into the tool <select> below. Without this wait, this
    // suite is flaky in CI -- the tool select's options query intermittently
    // hasn't repopulated yet, causing selectOption to time out waiting for
    // an option that never appears (see the 2026-09-18 and 2026-09-22 CI
    // failures on this exact step). This was removed once already during a
    // refactor and caused exactly that flakiness -- keep it.
    await this.page.waitForTimeout(500);
    await dialog.locator('select').nth(1).selectOption({ label: toolName });
  }

  async submitCheckout(expectedStatus = 200): Promise<void> {
    const responsePromise = this.page.waitForResponse(response =>
      new URL(response.url()).pathname.endsWith('/admin/tool_checkouts') &&
      response.request().method() === 'POST');
    await this.page.getByRole('dialog').getByRole('button', { name: 'Check Out', exact: true }).click();
    const response = await responsePromise;
    expect(response.status(), await response.text()).toBe(expectedStatus);
    if (expectedStatus === 200) {
      await expect(this.page.getByRole('dialog')).not.toBeVisible();
    }
  }

  async verifyPrerequisiteWarning(prereqName: string): Promise<void> {
    await expect(this.page.locator('[role="dialog"]').getByText(/prerequisite/i))
      .toBeVisible({ timeout: 10_000 });
    await expect(this.page.locator('[role="dialog"]').getByText(new RegExp(prereqName, 'i')))
      .toBeVisible({ timeout: 5_000 });
  }

  async verifyCheckoutInTable(memberName: string, toolName: string): Promise<void> {
    const row = this.page.getByRole('row')
      .filter({ has: this.page.getByRole('cell', { name: toolName }) })
      .filter({ has: this.page.getByRole('cell', { name: new RegExp(memberName, 'i') }) });
    await expect(row).toBeVisible({ timeout: 10_000 });
  }
}
