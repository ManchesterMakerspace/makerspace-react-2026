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
    await this.page.getByRole('textbox', { name: 'e.g. Woodshop' }).fill(name);
    await this.page.getByRole('textbox', { name: 'e.g. shop-woodworking' }).fill(slackChannel);
    await this.page.getByRole('button', { name: 'Add Shop' }).click();
    await this.page.waitForTimeout(500);
  }

  async verifyShopInTable(name: string): Promise<void> {
    await expect(this.page.getByRole('cell', { name })).toBeVisible({ timeout: 10_000 });
  }

  // ── Tools ──────────────────────────────────────────────────────────────────

  async addTool(toolName: string, description: string, shopName: string, prerequisiteName?: string): Promise<void> {
    await this.page.getByRole('button', { name: 'Add Tool' }).click();
    await this.page.waitForSelector('[role="dialog"]', { timeout: 10_000 });

    // Shop select — native select inside dialog
    const dialog = this.page.locator('[role="dialog"]');
    await dialog.locator('select').first().selectOption({ label: shopName });

    await this.page.getByRole('textbox', { name: 'e.g. Bandsaw' }).fill(toolName);
    await this.page.getByRole('textbox', { name: 'Optional details' }).fill(description);

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

    // Search by email — unique and unambiguous
    await this.page.locator('input[id^="react-select"]').last().fill(memberEmail);
    await this.page.waitForTimeout(1000);
    await this.page.getByRole('option').first().click();

    // Select shop chip
    await this.page.getByRole('button', { name: shopName }).click();

    await this.page.getByRole('button', { name: 'Add Approver' }).click();
    await this.page.waitForTimeout(500);
  }

  // ── Checkout Roster ────────────────────────────────────────────────────────

  async checkOutMember(memberName: string, shopName: string, toolName: string): Promise<void> {
    await this.page.getByRole('button', { name: 'Check Out Member' }).click();
    await this.page.waitForSelector('[role="dialog"]', { timeout: 10_000 });

    // Member search — type slowly to trigger debounce correctly
    await this.page.locator('div').filter({ hasText: /^Search by name or email$/ }).nth(1).click();
    await this.page.locator('input[id^="react-select"]').last().type(memberName, { delay: 50 });
    await this.page.waitForTimeout(1500);
    await this.page.getByRole('option', { name: new RegExp(memberName, 'i') }).first().click();

    // Scope to dialog — page also has comboboxes behind the modal
    const dialog = this.page.locator('[role="dialog"]');

    // Select shop by value — options are in DOM, shop value by text match
    const shopCombobox = dialog.getByRole('combobox').first();
    await expect(shopCombobox.locator('option').filter({ hasText: shopName }))
      .toHaveCount(1, { timeout: 10_000 });
    const shopValue = await shopCombobox.locator('option')
      .filter({ hasText: shopName })
      .getAttribute('value');
    if (!shopValue) throw new Error(`Shop option not found: ${shopName}`);
    await shopCombobox.selectOption(shopValue);
    await this.page.waitForTimeout(500);

    // Wait for tool options to populate after shop selection
    const toolCombobox = dialog.getByRole('combobox').nth(1);
    await expect(toolCombobox.locator('option').filter({ hasText: toolName }))
      .toHaveCount(1, { timeout: 10_000 });
    const toolValue = await toolCombobox.locator('option')
      .filter({ hasText: toolName })
      .getAttribute('value');
    if (!toolValue) throw new Error(`Tool option not found: ${toolName}`);
    await toolCombobox.selectOption(toolValue);
    await this.page.waitForTimeout(300);

    await this.page.getByRole('button', { name: 'Check Out' }).click();
    await this.page.waitForTimeout(1000);
  }

  async verifyPrerequisiteWarning(prereqName: string): Promise<void> {
    await expect(this.page.locator('[role="dialog"]').getByText(/prerequisite/i))
      .toBeVisible({ timeout: 10_000 });
    await expect(this.page.locator('[role="dialog"]').getByText(new RegExp(prereqName, 'i')))
      .toBeVisible({ timeout: 5_000 });
  }

  async verifyCheckoutInTable(memberName: string, toolName: string): Promise<void> {
    await expect(this.page.getByRole('cell', { name: new RegExp(memberName, 'i') }).first())
      .toBeVisible({ timeout: 10_000 });
    await expect(this.page.getByRole('cell', { name: new RegExp(toolName, 'i') }).first())
      .toBeVisible({ timeout: 10_000 });
  }
}
