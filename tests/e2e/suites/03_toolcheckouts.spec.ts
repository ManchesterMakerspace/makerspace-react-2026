import { test, expect } from '@playwright/test';
import { AuthPage } from '../pages/AuthPage';
import { MemberPage } from '../pages/MemberPage';
import { AdminToolCheckoutsPage } from '../pages/AdminToolCheckoutsPage';
import { adminMember, rmMember0, rmMember1, basicMember, basicMember1 } from '../fixtures/testData';

const WOODSHOP        = 'testshop';
const WOODSHOP_SLACK  = 'shop-testshop';
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

// ── Test 3: CNC checkout requires an active manual mill checkout ─────────────
test.describe('RM enforces CNC mill prerequisites', () => {
  test('RM1 checks out the mill before approving Basic Member1 for CNC mill', async ({ page }) => {
    const auth = new AuthPage(page);
    const checkouts = new AdminToolCheckoutsPage(page);

    await auth.signIn(rmMember1.email, rmMember1.password);
    await checkouts.goto();

    await checkouts.openCheckout('Basic Member1', METALSHOP, CNC_MILL);
    await expect(page.getByRole('dialog').getByText(/Prerequisites for cnc mill/i)).toBeVisible();

    // The shared server policy rejects missing prerequisites; a warning does
    // not authorize a checkout. Assert the response rather than a table timeout.
    await checkouts.submitCheckout(422);
    await expect(page.getByRole('dialog').getByText(/Complete all prerequisite checkouts/i)).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.getByRole('cell', { name: CNC_MILL, exact: true })).not.toBeVisible();

    await checkouts.checkOutMember('Basic Member1', METALSHOP, MILL);
    await checkouts.verifyCheckoutInTable('Basic Member1', MILL);
    await checkouts.checkOutMember('Basic Member1', METALSHOP, CNC_MILL);
    await checkouts.verifyCheckoutInTable('Basic Member1', CNC_MILL);
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

    const cncRow = page.getByRole('row').filter({
      has: page.getByRole('cell', { name: CNC_MILL, exact: true }),
    });
    await expect(cncRow).toBeVisible({ timeout: 10_000 });
    await expect(cncRow.getByRole('cell', { name: METALSHOP, exact: true })).toBeVisible();
    await expect(page.getByRole('cell', { name: MILL, exact: true })).toBeVisible();
  });
});
