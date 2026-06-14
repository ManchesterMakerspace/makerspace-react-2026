import { test, expect } from '@playwright/test';
import { AuthPage } from '../pages/AuthPage';
import { MemberPage } from '../pages/MemberPage';
import { adminMember } from '../fixtures/testData';

// ── Household lifecycle ───────────────────────────────────────────────────────
//
// Uses basic_member9 as primary and basic_member10 as secondary.
// These are high-numbered members not used by any other suite.
//
// Prerequisites: primary must be on a household membership plan.
// We use admin to set up the plan before creating the household.

const PRIMARY_EMAIL   = 'basic_member9@test.com';
const PRIMARY_NAME    = 'Basic Member9';
const SECONDARY_EMAIL = 'basic_member10@test.com';
const SECONDARY_NAME  = 'Basic Member10';

let primaryProfileUrl   = '';
let secondaryProfileUrl = '';

test.describe('Household lifecycle', () => {

  test('Admin navigates to both member profiles and captures URLs', async ({ page }) => {
    const auth   = new AuthPage(page);
    const member = new MemberPage(page);

    await auth.signIn(adminMember.email, adminMember.password);

    // Capture primary URL
    await member.goToMembersList();
    await member.searchMembers('basic_member9');
    await member.clickMemberLink(PRIMARY_NAME);
    await member.waitForProfile();
    primaryProfileUrl = page.url();
    expect(primaryProfileUrl).toMatch(/\/members\//);

    // Capture secondary URL
    await member.goToMembersList();
    await member.searchMembers('basic_member10');
    await member.clickMemberLink(SECONDARY_NAME);
    await member.waitForProfile();
    secondaryProfileUrl = page.url();
    expect(secondaryProfileUrl).toMatch(/\/members\//);
  });

  test('Admin sets primary member on household plan via invoice option', async ({ page }) => {
    test.skip(!primaryProfileUrl, 'Requires profile URL from previous test');
    const auth   = new AuthPage(page);
    const member = new MemberPage(page);

    await auth.signIn(adminMember.email, adminMember.password);
    await page.goto(primaryProfileUrl);
    await member.waitForProfile();

    // Create a household invoice for primary member via admin invoices
    await member.clickTab('Dues');
    await page.waitForTimeout(500);

    // Button id="invoices-list-create", label="Create New Invoice"
    await page.locator('#invoices-list-create').click();
    await page.waitForSelector('[role="dialog"]', { timeout: 10_000 });

    // Select a household plan invoice option
    const dialog = page.locator('[role="dialog"]');
    const planSelect = dialog.getByRole('combobox').first();
    await planSelect.waitFor({ state: 'visible', timeout: 10_000 });

    // Find and select a household option
    const householdOption = dialog.locator('option').filter({ hasText: /household/i }).first();
    const optionValue = await householdOption.getAttribute('value').catch(() => null);

    if (!optionValue) {
      // If no household invoice option exists, skip — depends on seeded data
      test.skip(true, 'No household invoice option found in seeded data');
      return;
    }

    await planSelect.selectOption(optionValue);
    await dialog.getByRole('button', { name: /save|create/i }).click();
    await page.waitForSelector('[role="dialog"]', { state: 'hidden', timeout: 15_000 });
    await page.waitForTimeout(1000);
  });

  test('Admin creates household with primary member', async ({ page }) => {
    test.skip(!primaryProfileUrl, 'Requires profile URL from previous test');
    const auth   = new AuthPage(page);
    const member = new MemberPage(page);

    await auth.signIn(adminMember.email, adminMember.password);
    await page.goto(primaryProfileUrl);
    await member.waitForProfile();

    // Open household modal
    const householdBtn = page.getByRole('button', { name: /household|create household/i });
    await householdBtn.waitFor({ state: 'visible', timeout: 10_000 });
    await householdBtn.click();
    await page.waitForSelector('[role="dialog"]', { timeout: 10_000 });

    await page.getByRole('button', { name: /create|confirm/i }).click();
    await page.waitForSelector('[role="dialog"]', { state: 'hidden', timeout: 15_000 });
    await member.reloadProfile();

    // Primary member should show household role
    await expect(page.locator('#member-detail-household-role'))
      .toContainText(/primary/i, { timeout: 10_000 });
  });

  test('Admin adds secondary member to household', async ({ page }) => {
    test.skip(!primaryProfileUrl || !secondaryProfileUrl, 'Requires profile URLs from previous tests');
    const auth   = new AuthPage(page);
    const member = new MemberPage(page);

    await auth.signIn(adminMember.email, adminMember.password);
    await page.goto(primaryProfileUrl);
    await member.waitForProfile();

    // Open household modal and add secondary
    const householdBtn = page.getByRole('button', { name: /manage household|add member/i });
    await householdBtn.waitFor({ state: 'visible', timeout: 10_000 });
    await householdBtn.click();
    await page.waitForSelector('[role="dialog"]', { timeout: 10_000 });

    // Search for secondary member
    const searchInput = page.locator('input[id^="react-select"], input[placeholder*="search" i]').last();
    await searchInput.click();
    await searchInput.type(SECONDARY_NAME, { delay: 50 });
    await page.waitForSelector('[role="option"]', { timeout: 10_000 });
    await page.getByRole('option', { name: new RegExp(SECONDARY_NAME, 'i') }).first().click();

    await page.getByRole('button', { name: /add|confirm/i }).click();
    await page.waitForSelector('[role="dialog"]', { state: 'hidden', timeout: 15_000 });
    await member.reloadProfile();

    // Secondary member should appear in household list or profile shows secondary role
    await page.goto(secondaryProfileUrl);
    await member.waitForProfile();
    await expect(page.locator('#member-detail-household-role'))
      .toContainText(/secondary/i, { timeout: 10_000 });
  });

  test('Secondary member expiration matches primary expiration', async ({ page }) => {
    test.skip(!primaryProfileUrl || !secondaryProfileUrl, 'Requires profile URLs from previous tests');
    const auth   = new AuthPage(page);
    const member = new MemberPage(page);

    await auth.signIn(adminMember.email, adminMember.password);

    // Get primary expiration
    await page.goto(primaryProfileUrl);
    await member.waitForProfile();
    const primaryExpiration = await member.getExpiration();

    // Get secondary expiration
    await page.goto(secondaryProfileUrl);
    await member.waitForProfile();
    const secondaryExpiration = await member.getExpiration();

    expect(secondaryExpiration).toEqual(primaryExpiration);
  });

  test('Admin dissolves household and members are unlinked', async ({ page }) => {
    test.skip(!primaryProfileUrl, 'Requires profile URL from previous test');
    const auth   = new AuthPage(page);
    const member = new MemberPage(page);

    await auth.signIn(adminMember.email, adminMember.password);
    await page.goto(primaryProfileUrl);
    await member.waitForProfile();

    // Open household modal and dissolve
    const householdBtn = page.getByRole('button', { name: /manage household|household/i });
    await householdBtn.waitFor({ state: 'visible', timeout: 10_000 });
    await householdBtn.click();
    await page.waitForSelector('[role="dialog"]', { timeout: 10_000 });

    await page.getByRole('button', { name: /dissolve|delete household/i }).click();

    // Confirm if a second dialog appears
    const confirmBtn = page.getByRole('button', { name: /confirm|yes/i });
    if (await confirmBtn.isVisible({ timeout: 3_000 })) {
      await confirmBtn.click();
    }

    await page.waitForTimeout(2000);
    await member.reloadProfile();

    // Primary should no longer show household role
    await expect(page.locator('#member-detail-household-role'))
      .toContainText(/none/i, { timeout: 10_000 });
  });
});
