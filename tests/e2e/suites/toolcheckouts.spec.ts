import { test, expect } from '@playwright/test';
import { AuthPage } from '../pages/AuthPage';
import { MemberPage } from '../pages/MemberPage';
import { AdminToolCheckoutsPage } from '../pages/AdminToolCheckoutsPage';
import { adminMember, rmMember0, rmMember1, basicMember, basicMember1 } from '../fixtures/testData';

const WOODSHOP        = 'woodshop';
const WOODSHOP_SLACK  = 'shop-woodworking';
const METALSHOP       = 'metalshop';
const METALSHOP_SLACK = 'shop-metalwork';
const BANDSAW         = 'bandsaw';
const TABLESAW        = 'tablesaw';
const MILL            = 'mill';
const CNC_MILL        = 'cnc mill';

// ── Test 1: Admin sets up shops, tools, and approvers ─────────────────────────

test.describe('Admin sets up tool checkout infrastructure', () => {

  test('Admin creates shops, tools, and assigns approvers', async ({ page }) => {
    const auth    = new AuthPage(page);
    const checkouts = new AdminToolCheckoutsPage(page);

    await auth.signIn(adminMember.email, adminMember.password);
    await checkouts.goto();

    // ── Create shops ──
    await checkouts.goToTab('Shops');
    await checkouts.addShop(WOODSHOP, WOODSHOP_SLACK);
    await checkouts.verifyShopInTable(WOODSHOP);
    await checkouts.addShop(METALSHOP, METALSHOP_SLACK);
    await checkouts.verifyShopInTable(METALSHOP);

    // ── Create woodshop tools (no prerequisites) ──
    await checkouts.goToTab('Tools');
    await checkouts.addTool(BANDSAW,  'small bandsaw',   WOODSHOP);
    await checkouts.verifyToolInTable(BANDSAW);
    await checkouts.addTool(TABLESAW, 'sawstop tablesaw', WOODSHOP);
    await checkouts.verifyToolInTable(TABLESAW);

    // ── Create metalshop tools (cnc mill requires mill) ──
    await checkouts.addTool(MILL,     'manual mill',  METALSHOP);
    await checkouts.verifyToolInTable(MILL);
    await checkouts.addTool(CNC_MILL, 'cnc mill',     METALSHOP, MILL);
    await checkouts.verifyToolInTable(CNC_MILL);

    // ── Assign approvers ──
    await checkouts.goToTab('Approvers');
    await checkouts.addApprover(rmMember0.email, WOODSHOP);
    await checkouts.addApprover(rmMember1.email, METALSHOP);
  });
});

// ── Test 2: RM0 checks out basic_member0 on woodshop bandsaw ─────────────────

test.describe('RM checks out member on woodshop tool', () => {

  test('RM0 checks out Basic Member0 for bandsaw', async ({ page }) => {
    const auth     = new AuthPage(page);
    const checkouts = new AdminToolCheckoutsPage(page);

    await auth.signIn(rmMember0.email, rmMember0.password);
    await checkouts.goto();

    await checkouts.checkOutMember('Basic Member0', WOODSHOP, BANDSAW);
    await checkouts.verifyCheckoutInTable('Basic Member0', BANDSAW);
  });
});

// ── Test 3: RM1 checks out basic_member1 on CNC mill — prereq warning shown ──

test.describe('RM checks out member on metalshop CNC mill with prereq warning', () => {

  test('RM1 checks out Basic Member1 for CNC mill and sees prerequisite warning', async ({ page }) => {
    const auth      = new AuthPage(page);
    const checkouts = new AdminToolCheckoutsPage(page);

    await auth.signIn(rmMember1.email, rmMember1.password);
    await checkouts.goto();

    // Open checkout modal and select CNC mill
    await page.getByRole('button', { name: 'Check Out Member' }).click();
    await page.waitForSelector('[role="dialog"]', { timeout: 10_000 });

    // Search for Basic Member1 — type slowly to trigger debounce
    await page.locator('div').filter({ hasText: /^Search by name or email$/ }).nth(1).click();
    await page.locator('input[id^="react-select"]').last().type('Basic Member1', { delay: 50 });
    await page.waitForTimeout(1500);
    await page.getByRole('option', { name: /Basic Member1/i }).first().click();

    // Scope to dialog — page also has comboboxes behind the modal.
    // Use locator('select') not getByRole('combobox'): CheckoutModal uses
    // <Select native> which renders a real <select> element.
    const dialog = page.locator('[role="dialog"]');

    const shopSelect = dialog.locator('select').first();
    await expect(shopSelect.locator('option').filter({ hasText: METALSHOP }))
      .toHaveCount(1, { timeout: 10_000 });
    const shopValue = await shopSelect.locator('option')
      .filter({ hasText: METALSHOP })
      .getAttribute('value');
    if (!shopValue) throw new Error(`Shop option not found: ${METALSHOP}`);
    await shopSelect.selectOption(shopValue);
    await page.waitForTimeout(500);

    const toolSelect = dialog.locator('select').nth(1);
    await expect(toolSelect.locator('option').filter({ hasText: CNC_MILL }))
      .toHaveCount(1, { timeout: 10_000 });
    const toolValue = await toolSelect.locator('option')
      .filter({ hasText: CNC_MILL })
      .getAttribute('value');
    if (!toolValue) throw new Error(`Tool option not found: ${CNC_MILL}`);
    await toolSelect.selectOption(toolValue);
    await page.waitForTimeout(300);

    // Prerequisite warning shows in modal before submitting
    await expect(page.getByText(/Prerequisites for cnc mill/i)).toBeVisible({ timeout: 5_000 });

    // Submit and wait
    await page.getByRole('button', { name: 'Check Out' }).click();
    await page.waitForTimeout(1000);

    // Verify the checkout succeeded
    await checkouts.verifyCheckoutInTable('Basic Member1', CNC_MILL);

    // Prereq warning shows in the table row as unmet prerequisites text
    const cncRow = page.getByRole('row', { name: /cnc mill/i });
    await expect(cncRow).toBeVisible({ timeout: 10_000 });
  });
});

// ── Test 4: Members verify their checkouts ────────────────────────────────────

test.describe('Members view their tool checkout status', () => {

  test('Basic Member0 sees bandsaw checkout on their profile', async ({ page }) => {
    const auth   = new AuthPage(page);
    const member = new MemberPage(page);

    await auth.signIn(basicMember.email, basicMember.password);
    await member.waitForProfile();
    await member.dismissNotificationModal();
    await member.clickTab('Checkouts');

    await expect(page.getByRole('cell', { name: new RegExp(BANDSAW, 'i') }))
      .toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('cell', { name: new RegExp(WOODSHOP, 'i') }))
      .toBeVisible({ timeout: 10_000 });
  });

  test('Basic Member1 sees CNC mill checkout on their profile', async ({ page }) => {
    const auth   = new AuthPage(page);
    const member = new MemberPage(page);

    await auth.signIn(basicMember1.email, basicMember1.password);
    await member.waitForProfile();
    await member.dismissNotificationModal();
    await member.clickTab('Checkouts');

    await expect(page.getByRole('cell', { name: new RegExp(CNC_MILL, 'i') }))
      .toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('cell', { name: new RegExp(METALSHOP, 'i') }))
      .toBeVisible({ timeout: 10_000 });
  });
});
