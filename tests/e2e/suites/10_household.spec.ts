import { test, expect } from '@playwright/test';
import { AuthPage } from '../pages/AuthPage';
import { MemberPage } from '../pages/MemberPage';
import { adminMember } from '../fixtures/testData';

// ── Household lifecycle ───────────────────────────────────────────────────────
//
// Uses the pre-seeded household members:
//   household_primary@test.com  — primary member with a household group already set up
//   household_secondary@test.com — secondary member linked to the same group
//
// These are created by create_group in seed_data.rb with a Group already linked,
// so we don't need to set up the household via UI — we just verify the existing
// household and test management operations.

const PRIMARY_EMAIL   = 'household_primary@test.com';
const PRIMARY_NAME    = 'Household Primary';
const SECONDARY_EMAIL = 'household_secondary@test.com';
const SECONDARY_NAME  = 'Household Secondary';

let primaryProfileUrl   = '';
let secondaryProfileUrl = '';

test.describe('Household lifecycle', () => {

  test('Admin navigates to both member profiles and captures URLs', async ({ page }) => {
    const auth   = new AuthPage(page);
    const member = new MemberPage(page);

    await auth.signIn(adminMember.email, adminMember.password);

    // Capture primary URL
    await member.goToMembersList();
    await member.searchMembers('household_primary');
    await member.clickMemberLink(PRIMARY_NAME);
    await member.waitForProfile();
    primaryProfileUrl = page.url();
    expect(primaryProfileUrl).toMatch(/\/members\//);

    // Capture secondary URL
    await member.goToMembersList();
    await member.searchMembers('household_secondary');
    await member.clickMemberLink(SECONDARY_NAME);
    await member.waitForProfile();
    secondaryProfileUrl = page.url();
    expect(secondaryProfileUrl).toMatch(/\/members\//);
  });

  test('Primary member shows household primary role', async ({ page }) => {
    test.skip(!primaryProfileUrl, 'Requires profile URL from previous test');
    const auth   = new AuthPage(page);
    const member = new MemberPage(page);

    await auth.signIn(adminMember.email, adminMember.password);
    await page.goto(primaryProfileUrl);
    await member.waitForProfile();

    await expect(page.locator('#member-detail-household-role'))
      .toContainText(/primary/i, { timeout: 10_000 });
  });

  test('Secondary member shows household secondary role', async ({ page }) => {
    test.skip(!secondaryProfileUrl, 'Requires profile URL from previous test');
    const auth   = new AuthPage(page);
    const member = new MemberPage(page);

    await auth.signIn(adminMember.email, adminMember.password);
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

  test('Admin can view household management modal on primary profile', async ({ page }) => {
    test.skip(!primaryProfileUrl, 'Requires profile URL from previous test');
    const auth   = new AuthPage(page);
    const member = new MemberPage(page);

    await auth.signIn(adminMember.email, adminMember.password);
    await page.goto(primaryProfileUrl);
    await member.waitForProfile();

    // Household modal button should be visible on a primary member's profile
    const householdBtn = page.getByRole('button', { name: /household/i });
    await householdBtn.waitFor({ state: 'visible', timeout: 10_000 });
    await householdBtn.click();
    await page.waitForSelector('[role="dialog"]', { timeout: 10_000 });

    // Dialog should open without error
    await expect(page.getByText(/something went wrong/i)).not.toBeVisible();
    await page.getByRole('button', { name: /cancel|close/i }).first().click();
    await page.waitForSelector('[role="dialog"]', { state: 'hidden', timeout: 10_000 });
  });
});
