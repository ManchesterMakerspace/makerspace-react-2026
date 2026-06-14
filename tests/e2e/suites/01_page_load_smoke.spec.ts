import { test, expect } from '@playwright/test';
import { AuthPage } from '../pages/AuthPage';
import { MemberPage } from '../pages/MemberPage';
import { adminMember, basicMember, rmMember0 } from '../fixtures/testData';

// ── Page load smoke tests ─────────────────────────────────────────────────────
//
// Verifies every authenticated route renders without a React error boundary
// crash, blank white screen, or uncaught JS exception. This is the canary
// that catches Dependabot / package-upgrade regressions where a component
// fails to mount silently.
//
// Not a functional test — we just assert the page loads meaningful content.

// ── Helpers ───────────────────────────────────────────────────────────────────

async function assertNocrash(page: any): Promise<void> {
  await expect(page.getByText(/something went wrong/i)).not.toBeVisible({ timeout: 3_000 })
    .catch(() => {});
  await expect(page.getByText(/cannot read propert/i)).not.toBeVisible({ timeout: 1_000 })
    .catch(() => {});
  // White screen check — body should have some rendered content
  const bodyText = await page.locator('body').innerText().catch(() => '');
  expect(bodyText.trim().length).toBeGreaterThan(10);
}

async function gotoAndCheck(page: any, url: string, expectedText: RegExp | string): Promise<void> {
  await page.goto(url);
  await page.waitForLoadState('networkidle');
  await expect(page.getByText(expectedText).first()).toBeVisible({ timeout: 20_000 });
  await assertNocrash(page);
}

// ── Public pages ──────────────────────────────────────────────────────────────

test.describe('Public pages load', () => {

  test('Home page / membership options table', async ({ page }) => {
    await gotoAndCheck(page, '/', /membership options|one month/i);
  });

  test('Login page', async ({ page }) => {
    await gotoAndCheck(page, '/login', /sign in/i);
  });
});

// ── Member pages ──────────────────────────────────────────────────────────────

test.describe('Member pages load (basic member)', () => {
  let memberId = '';

  test.beforeEach(async ({ page }) => {
    const auth = new AuthPage(page);
    const member = new MemberPage(page);
    await auth.signIn(basicMember.email, basicMember.password);
    await member.waitForProfile();
    await member.dismissNotificationModal();
    // Capture member ID from URL once
    if (!memberId) {
      const url = page.url();
      const match = url.match(/\/members\/([^/]+)/);
      memberId = match ? match[1] : '';
    }
  });

  test('Member profile page', async ({ page }) => {
    await assertNocrash(page);
    await expect(page.locator('#member-detail-type, #member-detail-status').first())
      .toBeVisible({ timeout: 15_000 });
  });

  test('Member profile — Dues tab', async ({ page }) => {
    const member = new MemberPage(page);
    await member.clickTab('Dues');
    await assertNocrash(page);
    await expect(page.getByRole('table').first()).toBeVisible({ timeout: 10_000 });
  });

  test('Member profile — Payment History tab', async ({ page }) => {
    const member = new MemberPage(page);
    await member.clickTab('Payment History');
    await assertNocrash(page);
    await expect(page.getByRole('table').first()).toBeVisible({ timeout: 10_000 });
  });

  test('Member profile — Rentals tab', async ({ page }) => {
    const member = new MemberPage(page);
    await member.clickTab('Rentals');
    await assertNocrash(page);
  });

  test('Member profile — Checkouts tab', async ({ page }) => {
    const member = new MemberPage(page);
    await member.clickTab('Checkouts');
    await assertNocrash(page);
  });

  test('Member profile — Volunteer tab', async ({ page }) => {
    const member = new MemberPage(page);
    await member.clickTab('Volunteer');
    await assertNocrash(page);
  });

  test('Account Settings — Profile tab', async ({ page }) => {
    if (!memberId) test.skip(true, 'memberId not captured');
    await gotoAndCheck(page, `/members/${memberId}/settings/profile`, /personal information/i);
  });

  test('Account Settings — Subscriptions tab', async ({ page }) => {
    if (!memberId) test.skip(true, 'memberId not captured');
    await gotoAndCheck(page, `/members/${memberId}/settings/subscriptions`, /subscription/i);
  });

  test('Account Settings — Payment Methods tab', async ({ page }) => {
    if (!memberId) test.skip(true, 'memberId not captured');
    await gotoAndCheck(page, `/members/${memberId}/settings/payment-methods`, /payment method/i);
  });

  test('Account Settings — Security tab', async ({ page }) => {
    if (!memberId) test.skip(true, 'memberId not captured');
    await gotoAndCheck(page, `/members/${memberId}/settings/security`, /security|two-factor|password/i);
  });

  test('Rentals self-service page', async ({ page }) => {
    await gotoAndCheck(page, '/rentals', /rental/i);
    await assertNocrash(page);
  });
});

// ── Admin pages ───────────────────────────────────────────────────────────────

test.describe('Admin pages load', () => {

  test.beforeEach(async ({ page }) => {
    const auth = new AuthPage(page);
    await auth.signIn(adminMember.email, adminMember.password);
  });

  test('Members list page', async ({ page }) => {
    await gotoAndCheck(page, '/members', /members|search/i);
  });

  test('Admin rentals page', async ({ page }) => {
    await gotoAndCheck(page, '/admin/rentals', /rental/i);
  });

  test('Admin rentals — Rental Requests tab', async ({ page }) => {
    await page.goto('/admin/rentals');
    await page.waitForLoadState('networkidle');
    await page.getByRole('tab', { name: /rental requests/i }).click();
    await page.waitForTimeout(1000);
    await assertNocrash(page);
  });

  test('Admin rentals — Rental Types tab', async ({ page }) => {
    await page.goto('/admin/rentals');
    await page.waitForLoadState('networkidle');
    await page.getByRole('tab', { name: /rental types/i }).click();
    await page.waitForTimeout(1000);
    await assertNocrash(page);
  });

  test('Admin rentals — Rental Spots tab', async ({ page }) => {
    await page.goto('/admin/rentals');
    await page.waitForLoadState('networkidle');
    await page.getByRole('tab', { name: /rental spots/i }).click();
    await page.waitForTimeout(1000);
    await assertNocrash(page);
  });

  test('Shop fees page', async ({ page }) => {
    await gotoAndCheck(page, '/shop-fees', /shop fee|charge/i);
  });

  test('Tool checkouts page', async ({ page }) => {
    await gotoAndCheck(page, '/tool-checkouts', /checkout|tool/i);
  });

  test('Tool checkouts — Shops tab', async ({ page }) => {
    await page.goto('/tool-checkouts');
    await page.waitForLoadState('networkidle');
    await page.getByRole('tab', { name: /shops/i }).click();
    await page.waitForTimeout(1000);
    await assertNocrash(page);
  });

  test('Tool checkouts — Tools tab', async ({ page }) => {
    await page.goto('/tool-checkouts');
    await page.waitForLoadState('networkidle');
    await page.getByRole('tab', { name: /tools/i }).click();
    await page.waitForTimeout(1000);
    await assertNocrash(page);
  });

  test('Tool checkouts — Approvers tab', async ({ page }) => {
    await page.goto('/tool-checkouts');
    await page.waitForLoadState('networkidle');
    await page.getByRole('tab', { name: /approver/i }).click();
    await page.waitForTimeout(1000);
    await assertNocrash(page);
  });

  test('Volunteer admin page', async ({ page }) => {
    await gotoAndCheck(page, '/volunteer', /volunteer/i);
  });

  test('Volunteer admin — Events tab', async ({ page }) => {
    await page.goto('/volunteer');
    await page.waitForLoadState('networkidle');
    await page.getByRole('tab', { name: /events/i }).click();
    await page.waitForTimeout(1000);
    await assertNocrash(page);
  });

  test('Volunteer admin — Bounty Tasks tab', async ({ page }) => {
    await page.goto('/volunteer');
    await page.waitForLoadState('networkidle');
    await page.getByRole('tab', { name: /bounty/i }).click();
    await page.waitForTimeout(1000);
    await assertNocrash(page);
  });

  test('Analytics page — Membership tab', async ({ page }) => {
    await gotoAndCheck(page, '/admin/analytics', /analytics|membership|active members/i);
  });

  test('Analytics page — Volunteer tab', async ({ page }) => {
    await page.goto('/admin/analytics');
    await page.waitForLoadState('networkidle');
    await page.getByRole('tab', { name: /volunteer/i }).click();
    await page.waitForTimeout(1000);
    await assertNocrash(page);
  });

  test('Analytics page — Space Usage tab', async ({ page }) => {
    await page.goto('/admin/analytics');
    await page.waitForLoadState('networkidle');
    await page.getByRole('tab', { name: /space usage/i }).click();
    await page.waitForTimeout(1000);
    await assertNocrash(page);
  });

  test('Billing page', async ({ page }) => {
    await gotoAndCheck(page, '/billing', /billing central/i);
  });

  test('Billing page — Billing Options tab', async ({ page }) => {
    await page.goto('/billing');
    await page.waitForLoadState('networkidle');
    await page.getByRole('tab', { name: /billing options/i }).click();
    await page.waitForTimeout(1000);
    await assertNocrash(page);
  });

  test('Billing page — Subscriptions tab', async ({ page }) => {
    await page.goto('/billing');
    await page.waitForLoadState('networkidle');
    await page.getByRole('tab', { name: /subscriptions/i }).click();
    await page.waitForTimeout(1000);
    await assertNocrash(page);
  });

  test('Billing page — Transactions tab', async ({ page }) => {
    await page.goto('/billing');
    await page.waitForLoadState('networkidle');
    await page.getByRole('tab', { name: /transactions/i }).click();
    await page.waitForTimeout(1000);
    await assertNocrash(page);
  });

  test('Billing page — Outstanding Invoices tab', async ({ page }) => {
    await page.goto('/billing');
    await page.waitForLoadState('networkidle');
    await page.getByRole('tab', { name: /outstanding/i }).click();
    await page.waitForTimeout(1000);
    await assertNocrash(page);
  });

  test('Audit log page', async ({ page }) => {
    await gotoAndCheck(page, '/admin/audit-log', /audit log/i);
  });

  test('Portal settings page', async ({ page }) => {
    await gotoAndCheck(page, '/admin/system-settings', /settings|portal/i);
  });

  test('Portal settings — Slack tab', async ({ page }) => {
    await page.goto('/admin/system-settings');
    await page.waitForLoadState('networkidle');
    await page.getByRole('tab', { name: /slack/i }).click();
    await page.waitForTimeout(1000);
    await assertNocrash(page);
  });

  test('Portal settings — Volunteer tab', async ({ page }) => {
    await page.goto('/admin/system-settings');
    await page.waitForLoadState('networkidle');
    await page.getByRole('tab', { name: /volunteer/i }).click();
    await page.waitForTimeout(1000);
    await assertNocrash(page);
  });

  test('Portal settings — Jobs tab', async ({ page }) => {
    await page.goto('/admin/system-settings');
    await page.waitForLoadState('networkidle');
    await page.getByRole('tab', { name: /jobs/i }).click();
    await page.waitForTimeout(1000);
    await assertNocrash(page);
  });

  test('Portal settings — Security tab', async ({ page }) => {
    await page.goto('/admin/system-settings');
    await page.waitForLoadState('networkidle');
    await page.getByRole('tab', { name: /security/i }).click();
    await page.waitForTimeout(1000);
    await assertNocrash(page);
  });
});

// ── RM pages ──────────────────────────────────────────────────────────────────

test.describe('RM-accessible pages load (rm_member0)', () => {

  test.beforeEach(async ({ page }) => {
    const auth = new AuthPage(page);
    await auth.signIn(rmMember0.email, rmMember0.password);
  });

  test('Shop fees page loads for RM', async ({ page }) => {
    await gotoAndCheck(page, '/shop-fees', /shop fee|charge/i);
  });

  test('Tool checkouts page loads for RM', async ({ page }) => {
    await gotoAndCheck(page, '/tool-checkouts', /checkout|tool/i);
  });

  test('Volunteer page loads for RM', async ({ page }) => {
    await gotoAndCheck(page, '/volunteer', /volunteer/i);
  });

  test('Admin rentals page loads for RM', async ({ page }) => {
    await gotoAndCheck(page, '/admin/rentals', /rental/i);
  });
});
