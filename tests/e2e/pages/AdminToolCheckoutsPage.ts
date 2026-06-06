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
    // Use first() because seeded data may already contain a shop with the same
    // name (e.g. 'woodshop' from seed + the one just created by the test).
    await expect(this.page.getByRole('cell', { name, exact: true }).first()).toBeVisible({ timeout: 10_000 });
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

    // Select shop chip
    await this.page.getByRole('button', { name: shopName }).click();

    await this.page.getByRole('button', { name: 'Add Approver' }).click();
    await this.page.waitForTimeout(500);
  }

  // ── Checkout Roster ────────────────────────────────────────────────────────

  async checkOutMember(memberName: string, shopName: string, toolName: string): Promise<void> {
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

    // Scope to dialog — page also has comboboxes behind the modal.
    // Use locator('select') not getByRole('combobox'): CheckoutModal uses
    // <Select native> which renders a real <select> element, whereas
    // getByRole('combobox') also matches the react-select member search.
    const dialog = this.page.locator('[role="dialog"]');

    const shopSelect = dialog.locator('select').first();
    await expect(shopSelect.locator('option').filter({ hasText: shopName }))
      .toHaveCount(1, { timeout: 10_000 });
    const shopValue = await shopSelect.locator('option')
      .filter({ hasText: shopName })
      .getAttribute('value');
    if (!shopValue) throw new Error(`Shop option not found: ${shopName}`);
    await shopSelect.selectOption(shopValue);
    await this.page.waitForTimeout(500);

    // Wait for tool options to populate after shop selection
    const toolSelect = dialog.locator('select').nth(1);
    await expect(toolSelect.locator('option').filter({ hasText: toolName }))
      .toHaveCount(1, { timeout: 10_000 });
    const toolValue = await toolSelect.locator('option')
      .filter({ hasText: toolName })
      .getAttribute('value');
    if (!toolValue) throw new Error(`Tool option not found: ${toolName}`);
    await toolSelect.selectOption(toolValue);
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
