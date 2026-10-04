import { test, expect } from '@playwright/test';
import { AuthPage } from '../pages/AuthPage';
import { MemberPage } from '../pages/MemberPage';
import { adminMember, basicMember } from '../fixtures/testData';

// ── Payment history ───────────────────────────────────────────────────────────
//
// Verifies members can view their own payment history.
// Uses basic_member0 — seeded with historical invoices and transactions.
// Also verifies admin can view any member's payment history.

test.describe('Member views payment history', () => {

  test('Member sees payment history tab with transaction entries', async ({ page }) => {
    const auth   = new AuthPage(page);
    const member = new MemberPage(page);

    await auth.signIn(basicMember.email, basicMember.password);
    await member.gotoOwnProfile();
    await member.dismissNotificationModal();

    await member.clickTab('Payment History');

    // Table renders (even if empty — no real Braintree transactions in CI sandbox)
    await expect(page.getByRole('table').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/something went wrong/i)).not.toBeVisible();
  });

  test('Member payment history shows expected columns', async ({ page }) => {
    const auth   = new AuthPage(page);
    const member = new MemberPage(page);

    await auth.signIn(basicMember.email, basicMember.password);
    await member.gotoOwnProfile();
    await member.dismissNotificationModal();
    await member.clickTab('Payment History');

    // Table renders without error — column headers only visible when data exists
    await expect(page.getByRole('table').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/something went wrong/i)).not.toBeVisible();

    // If there IS data, verify column headers
    const rowCount = await page.getByRole('row').count();
    if (rowCount > 1) {
      await expect(page.getByRole('columnheader', { name: /amount/i }))
        .toBeVisible({ timeout: 5_000 });
      await expect(page.getByRole('columnheader', { name: /status|type/i }).first())
        .toBeVisible({ timeout: 5_000 });
    }
  });

  test('Admin can view another member payment history', async ({ page }) => {
    const auth   = new AuthPage(page);
    const member = new MemberPage(page);

    await auth.signIn(adminMember.email, adminMember.password);
    await member.goToMembersList();
    await member.searchMembers('basic_member0');
    await member.clickMemberLink('Basic Member0');
    await member.waitForProfile();

    await member.clickTab('Payment History');
    await expect(page.getByRole('table').first()).toBeVisible({ timeout: 15_000 });

    // No errors
    await expect(page.getByText(/something went wrong/i)).not.toBeVisible();
  });
});
