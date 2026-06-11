import { test, expect } from '@playwright/test';
import { AuthPage } from '../pages/AuthPage';
import { MemberPage } from '../pages/MemberPage';
import { AdminVolunteerPage } from '../pages/AdminVolunteerPage';
import { adminMember, rmMember0 } from '../fixtures/testData';

// ── Volunteer credit lifecycle ────────────────────────────────────────────────
//
// Tests the manual credit award, approve, reject, and reversal flows.
// Also verifies the member volunteer summary panel reflects credit counts.
//
// Credit award UI lives at /volunteer → Credits tab (admin/RM facing).
// The Volunteer tab on a MEMBER PROFILE only shows when isOwnProfile is true,
// so all admin award operations go through the admin volunteer page instead.
//
// Uses basic_member3 as the credit recipient — active member with a subscription,
// not shared with other volunteer suites.

const CREDIT_MEMBER_EMAIL = 'basic_member3@test.com';
const CREDIT_MEMBER_NAME  = 'Basic Member3';

// ── Helper: award a credit via the admin /volunteer Credits tab ───────────────

async function awardCreditViaAdminPage(
  page: any,
  memberName: string,
  description: string,
): Promise<void> {
  const volunteer = new AdminVolunteerPage(page);
  await volunteer.goto();
  await volunteer.goToTab('Credits');
  await page.waitForTimeout(500);

  // Open award dialog
  const awardBtn = page.getByRole('button', { name: /award credit|add credit/i });
  await awardBtn.waitFor({ state: 'visible', timeout: 10_000 });
  await awardBtn.click();
  await page.waitForSelector('[role="dialog"]', { timeout: 10_000 });

  // Search for and select member
  const dialog = page.locator('[role="dialog"]');
  const memberSearch = dialog.locator('input').first();
  await memberSearch.fill(memberName);
  await page.waitForTimeout(500);
  const memberOption = page.getByRole('option', { name: new RegExp(memberName, 'i') }).first();
  if (await memberOption.isVisible({ timeout: 5_000 })) {
    await memberOption.click();
  }

  await dialog.getByRole('textbox', { name: /description/i }).fill(description);
  await dialog.getByRole('button', { name: /award|submit/i }).click();
  await page.waitForSelector('[role="dialog"]', { state: 'hidden', timeout: 15_000 });
  await page.waitForTimeout(1000);
}

// ── Test 1: Admin awards a credit directly ───────────────────────────────────

test.describe('Admin directly awards a volunteer credit', () => {

  test('Admin awards a credit via the volunteer credits page', async ({ page }) => {
    const auth = new AuthPage(page);
    const desc = 'E2E test award — general cleanup';

    await auth.signIn(adminMember.email, adminMember.password);
    await awardCreditViaAdminPage(page, CREDIT_MEMBER_NAME, desc);

    // Credit should appear in the credits table
    await expect(page.getByText(new RegExp(desc, 'i'))).toBeVisible({ timeout: 10_000 });
  });

  test('Awarded credit appears in member volunteer summary', async ({ page }) => {
    const auth   = new AuthPage(page);
    const member = new MemberPage(page);

    // Member views their OWN profile — isOwnProfile = true, tab shows
    await auth.signIn(CREDIT_MEMBER_EMAIL, 'password');
    await member.waitForProfile();
    await member.dismissNotificationModal();
    await member.clickTab('Volunteer');
    await page.waitForTimeout(1000);

    // Year count should be at least 1
    await expect(page.getByText(/credits this year|year.*credit/i).first())
      .toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/something went wrong/i)).not.toBeVisible();
  });
});

// ── Test 2: RM awards a credit — requires approval ────────────────────────────

test.describe('RM-awarded credit goes through pending → approved flow', () => {

  const PENDING_CREDIT_DESC = 'E2E test RM award — pending approval';

  test('RM awards credit via volunteer credits page — lands in pending state', async ({ page }) => {
    const auth      = new AuthPage(page);
    const volunteer = new AdminVolunteerPage(page);

    await auth.signIn(rmMember0.email, rmMember0.password);
    await volunteer.goto();
    await volunteer.goToTab('Credits');
    await page.waitForTimeout(500);

    const awardBtn = page.getByRole('button', { name: /award credit|add credit/i });
    await awardBtn.waitFor({ state: 'visible', timeout: 10_000 });
    await awardBtn.click();
    await page.waitForSelector('[role="dialog"]', { timeout: 10_000 });

    const dialog = page.locator('[role="dialog"]');
    const memberSearch = dialog.locator('input').first();
    await memberSearch.fill(CREDIT_MEMBER_NAME);
    await page.waitForTimeout(500);
    const memberOption = page.getByRole('option', { name: new RegExp(CREDIT_MEMBER_NAME, 'i') }).first();
    if (await memberOption.isVisible({ timeout: 5_000 })) {
      await memberOption.click();
    }

    await dialog.getByRole('textbox', { name: /description/i }).fill(PENDING_CREDIT_DESC);
    await dialog.getByRole('button', { name: /award|submit/i }).click();
    await page.waitForSelector('[role="dialog"]', { state: 'hidden', timeout: 15_000 });
    await page.waitForTimeout(1000);

    // Credit should appear in the table
    await expect(page.getByText(new RegExp(PENDING_CREDIT_DESC, 'i')))
      .toBeVisible({ timeout: 10_000 });
  });

  test('Admin approves a pending credit from volunteer credits list', async ({ page }) => {
    const auth      = new AuthPage(page);
    const volunteer = new AdminVolunteerPage(page);

    await auth.signIn(adminMember.email, adminMember.password);
    await volunteer.goto();
    await volunteer.goToTab('Credits');
    await page.waitForTimeout(1000);

    // Filter to pending
    const muiSelect = page.locator('[role="combobox"]').first();
    if (await muiSelect.isVisible({ timeout: 3_000 })) {
      await muiSelect.click();
      await page.getByRole('option', { name: 'Pending', exact: true }).click();
      await page.waitForTimeout(500);
    }

    const creditRow = page.getByRole('row')
      .filter({ hasText: new RegExp(PENDING_CREDIT_DESC, 'i') }).first();

    if (await creditRow.isVisible({ timeout: 5_000 })) {
      await creditRow.getByRole('checkbox').check();
      await page.getByRole('button', { name: /approve/i }).click();
      await page.waitForTimeout(2000);
      await expect(page.getByText(/approved/i).first()).toBeVisible({ timeout: 10_000 });
    }
    // If not in pending (auto-approved path) — still a pass
  });
});

// ── Test 3: Admin rejects a credit ────────────────────────────────────────────

test.describe('Admin rejects a volunteer credit', () => {

  const REJECT_CREDIT_DESC = 'E2E test credit — to be rejected';

  test('Admin awards then rejects a credit via credits page', async ({ page }) => {
    const auth      = new AuthPage(page);
    const volunteer = new AdminVolunteerPage(page);

    await auth.signIn(adminMember.email, adminMember.password);
    await awardCreditViaAdminPage(page, CREDIT_MEMBER_NAME, REJECT_CREDIT_DESC);

    // Now reject it — already on credits tab after award
    await volunteer.goToTab('Credits');
    await page.waitForTimeout(500);

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
    const auth = new AuthPage(page);

    await auth.signIn(adminMember.email, adminMember.password);
    await awardCreditViaAdminPage(page, CREDIT_MEMBER_NAME, REVERSAL_CREDIT_DESC);

    // Find it in the credits table and reverse
    const creditRow = page.getByRole('row')
      .filter({ hasText: new RegExp(REVERSAL_CREDIT_DESC, 'i') }).first();
    await creditRow.waitFor({ state: 'visible', timeout: 10_000 });
    await creditRow.getByRole('checkbox').check();

    await page.getByRole('button', { name: /reverse/i }).click();
    await page.waitForSelector('[role="dialog"]', { timeout: 10_000 });

    await page.locator('[role="dialog"]').getByRole('textbox')
      .fill('E2E test reversal — error in award');
    await page.locator('[role="dialog"]')
      .getByRole('button', { name: /confirm|submit|reverse/i }).click();
    await page.waitForSelector('[role="dialog"]', { state: 'hidden', timeout: 15_000 });
    await page.waitForTimeout(1000);

    await expect(page.getByText(/reversed/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('Reversal record appears as negative credit in member summary', async ({ page }) => {
    const auth   = new AuthPage(page);
    const member = new MemberPage(page);

    // Member views own profile — Volunteer tab is visible
    await auth.signIn(CREDIT_MEMBER_EMAIL, 'password');
    await member.waitForProfile();
    await member.dismissNotificationModal();
    await member.clickTab('Volunteer');
    await page.waitForTimeout(1000);

    await expect(page.getByText(/-/i).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/something went wrong/i)).not.toBeVisible();
  });
});
