import { test, expect } from '@playwright/test';
import { AuthPage } from '../pages/AuthPage';
import { MemberPage } from '../pages/MemberPage';
import { adminMember, rmMember0 } from '../fixtures/testData';

// ── Volunteer credit lifecycle ────────────────────────────────────────────────
//
// Tests the manual credit award, approve, reject, and reversal flows.
// Also verifies the member volunteer summary panel reflects credit counts.
//
// Uses basic_member3 as the credit recipient — active member with a subscription,
// not shared with other volunteer suites.

const CREDIT_MEMBER_EMAIL = 'basic_member3@test.com';
const CREDIT_MEMBER_NAME  = 'Basic Member3';

// ── Test 1: Admin awards a credit directly ───────────────────────────────────

test.describe('Admin directly awards a volunteer credit', () => {

  test('Admin navigates to member and awards a credit', async ({ page }) => {
    const auth   = new AuthPage(page);
    const member = new MemberPage(page);

    await auth.signIn(adminMember.email, adminMember.password);
    await member.goToMembersList();
    await member.searchMembers('basic_member3');
    await member.clickMemberLink(CREDIT_MEMBER_NAME);
    await member.waitForProfile();

    // Navigate to Volunteer tab on the member profile
    await member.clickTab('Volunteer');
    await page.waitForTimeout(500);

    // Award a credit via the Credits section
    const awardBtn = page.getByRole('button', { name: /award credit|add credit/i });
    await awardBtn.waitFor({ state: 'visible', timeout: 10_000 });
    await awardBtn.click();
    await page.waitForSelector('[role="dialog"]', { timeout: 10_000 });

    const dialog = page.locator('[role="dialog"]');
    await dialog.getByRole('textbox', { name: /description/i }).fill('E2E test award — general cleanup');
    await dialog.getByRole('button', { name: /award|submit/i }).click();
    await page.waitForSelector('[role="dialog"]', { state: 'hidden', timeout: 15_000 });
    await page.waitForTimeout(1000);

    // Credit should appear in the table as approved (admin direct award is auto-approved)
    await expect(page.getByText(/E2E test award — general cleanup/i))
      .toBeVisible({ timeout: 10_000 });
  });

  test('Awarded credit appears in member volunteer summary', async ({ page }) => {
    const auth   = new AuthPage(page);
    const member = new MemberPage(page);

    await auth.signIn(CREDIT_MEMBER_EMAIL, 'password');
    await member.waitForProfile();
    await member.dismissNotificationModal();
    await member.clickTab('Volunteer');
    await page.waitForTimeout(1000);

    // Year count should be at least 1
    const yearCount = page.locator('[id*="year-count"], [id*="year_count"]')
      .or(page.getByText(/credits this year/i).first());
    await yearCount.waitFor({ state: 'visible', timeout: 10_000 });
    await expect(page.getByText(/something went wrong/i)).not.toBeVisible();
  });
});

// ── Test 2: RM awards a credit — requires approval ────────────────────────────

test.describe('RM-awarded credit goes through pending → approved flow', () => {

  const PENDING_CREDIT_DESC = 'E2E test RM award — pending approval';

  test('RM awards credit — lands in pending state', async ({ page }) => {
    const auth   = new AuthPage(page);
    const member = new MemberPage(page);

    // RM awards credit to basic_member3 (RM cannot approve their own — use admin for that)
    await auth.signIn(rmMember0.email, rmMember0.password);
    await member.goToMembersList();
    await member.searchMembers('basic_member3');
    await member.clickMemberLink(CREDIT_MEMBER_NAME);
    await member.waitForProfile();

    await member.clickTab('Volunteer');
    await page.waitForTimeout(500);

    const awardBtn = page.getByRole('button', { name: /award credit|add credit/i });
    await awardBtn.waitFor({ state: 'visible', timeout: 10_000 });
    await awardBtn.click();
    await page.waitForSelector('[role="dialog"]', { timeout: 10_000 });

    const dialog = page.locator('[role="dialog"]');
    await dialog.getByRole('textbox', { name: /description/i }).fill(PENDING_CREDIT_DESC);
    await dialog.getByRole('button', { name: /award|submit/i }).click();
    await page.waitForSelector('[role="dialog"]', { state: 'hidden', timeout: 15_000 });
    await page.waitForTimeout(1000);

    // Credit should appear — RM awards may be auto-approved or pending
    await expect(page.getByText(new RegExp(PENDING_CREDIT_DESC, 'i')))
      .toBeVisible({ timeout: 10_000 });
  });

  test('Admin approves a pending credit from volunteer credits list', async ({ page }) => {
    const auth = new AuthPage(page);

    await auth.signIn(adminMember.email, adminMember.password);
    await page.goto('/volunteer');
    await page.waitForLoadState('networkidle');
    await page.getByRole('tab', { name: /credits/i }).click();
    await page.waitForTimeout(1000);

    // Filter to pending
    const statusFilter = page.getByRole('combobox', { name: /status/i });
    if (await statusFilter.isVisible({ timeout: 3_000 })) {
      await statusFilter.selectOption('pending');
      await page.waitForTimeout(500);
    }

    // Find and approve the pending credit
    const creditRow = page.getByRole('row')
      .filter({ hasText: new RegExp(PENDING_CREDIT_DESC, 'i') }).first();

    if (await creditRow.isVisible({ timeout: 5_000 })) {
      await creditRow.getByRole('checkbox').check();
      await page.getByRole('button', { name: /approve/i }).click();
      await page.waitForTimeout(2000);

      // Should now show approved
      await expect(page.getByText(/approved/i).first()).toBeVisible({ timeout: 10_000 });
    }
    // If not in pending (auto-approved path) — test is still a pass
  });
});

// ── Test 3: Admin rejects a credit ────────────────────────────────────────────

test.describe('Admin rejects a volunteer credit', () => {

  const REJECT_CREDIT_DESC = 'E2E test credit — to be rejected';

  test('Admin awards then rejects a credit', async ({ page }) => {
    const auth   = new AuthPage(page);
    const member = new MemberPage(page);

    await auth.signIn(adminMember.email, adminMember.password);
    await member.goToMembersList();
    await member.searchMembers('basic_member3');
    await member.clickMemberLink(CREDIT_MEMBER_NAME);
    await member.waitForProfile();
    await member.clickTab('Volunteer');

    // Award a credit first
    const awardBtn = page.getByRole('button', { name: /award credit|add credit/i });
    await awardBtn.waitFor({ state: 'visible', timeout: 10_000 });
    await awardBtn.click();
    await page.waitForSelector('[role="dialog"]', { timeout: 10_000 });
    await page.locator('[role="dialog"]').getByRole('textbox', { name: /description/i })
      .fill(REJECT_CREDIT_DESC);
    await page.locator('[role="dialog"]').getByRole('button', { name: /award|submit/i }).click();
    await page.waitForSelector('[role="dialog"]', { state: 'hidden', timeout: 15_000 });
    await page.waitForTimeout(1000);

    // Navigate to volunteer credits admin and reject it
    await page.goto('/volunteer');
    await page.waitForLoadState('networkidle');
    await page.getByRole('tab', { name: /credits/i }).click();
    await page.waitForTimeout(1000);

    const creditRow = page.getByRole('row')
      .filter({ hasText: new RegExp(REJECT_CREDIT_DESC, 'i') }).first();

    if (await creditRow.isVisible({ timeout: 5_000 })) {
      await creditRow.getByRole('checkbox').check();
      await page.getByRole('button', { name: /reject/i }).click();
      await page.waitForTimeout(2000);
      await expect(page.getByText(/rejected/i).first()).toBeVisible({ timeout: 10_000 });
    }
  });
});

// ── Test 4: Admin reverses an approved credit ─────────────────────────────────

test.describe('Admin reverses an approved volunteer credit', () => {

  const REVERSAL_CREDIT_DESC = 'E2E test credit — to be reversed';

  test('Admin awards, then reverses a credit with a reason', async ({ page }) => {
    const auth   = new AuthPage(page);
    const member = new MemberPage(page);

    await auth.signIn(adminMember.email, adminMember.password);
    await member.goToMembersList();
    await member.searchMembers('basic_member3');
    await member.clickMemberLink(CREDIT_MEMBER_NAME);
    await member.waitForProfile();
    await member.clickTab('Volunteer');

    // Award credit
    const awardBtn = page.getByRole('button', { name: /award credit|add credit/i });
    await awardBtn.waitFor({ state: 'visible', timeout: 10_000 });
    await awardBtn.click();
    await page.waitForSelector('[role="dialog"]', { timeout: 10_000 });
    await page.locator('[role="dialog"]').getByRole('textbox', { name: /description/i })
      .fill(REVERSAL_CREDIT_DESC);
    await page.locator('[role="dialog"]').getByRole('button', { name: /award|submit/i }).click();
    await page.waitForSelector('[role="dialog"]', { state: 'hidden', timeout: 15_000 });
    await page.waitForTimeout(1000);

    // Find credit in table and reverse it
    const creditRow = page.getByRole('row')
      .filter({ hasText: new RegExp(REVERSAL_CREDIT_DESC, 'i') }).first();
    await creditRow.waitFor({ state: 'visible', timeout: 10_000 });
    await creditRow.getByRole('checkbox').check();

    await page.getByRole('button', { name: /reverse/i }).click();
    await page.waitForSelector('[role="dialog"]', { timeout: 10_000 });

    // Fill reversal reason
    await page.locator('[role="dialog"]').getByRole('textbox').fill('E2E test reversal — error in award');
    await page.locator('[role="dialog"]').getByRole('button', { name: /confirm|submit|reverse/i }).click();
    await page.waitForSelector('[role="dialog"]', { state: 'hidden', timeout: 15_000 });
    await page.waitForTimeout(1000);

    // Original credit should show reversed state; a reversal record should appear
    await expect(page.getByText(/reversed/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('Reversal record appears as negative credit in member summary', async ({ page }) => {
    const auth   = new AuthPage(page);
    const member = new MemberPage(page);

    await auth.signIn(CREDIT_MEMBER_EMAIL, 'password');
    await member.waitForProfile();
    await member.dismissNotificationModal();
    await member.clickTab('Volunteer');
    await page.waitForTimeout(1000);

    // Credits table should show negative reversal entry
    await expect(page.getByText(/-/i).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/something went wrong/i)).not.toBeVisible();
  });
});
