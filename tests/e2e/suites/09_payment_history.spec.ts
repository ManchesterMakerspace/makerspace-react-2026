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

  test('Member can open their payment history', { tag: '@backup-member-payment-history' }, async ({ page }) => {
    const auth   = new AuthPage(page);
    const member = new MemberPage(page);

    await auth.signIn(basicMember.email, basicMember.password);
    await member.gotoOwnProfile();
    await member.dismissNotificationModal();
    await test.step('Open Payment History', async () => {
      const tab = page.getByRole('tab', { name: 'Payment History', exact: true });
      await tab.click();
      await expect(tab).toHaveAttribute('aria-selected', 'true');
    });
    await test.step('Render the transaction table and columns', async () => {
      const table = page.getByRole('table').filter({ has: page.locator('#transactions-table-amount-header') });
      await expect(table).toBeVisible();
      await expect(page.locator('#transactions-table-loading')).toBeHidden();
      await expect(table.getByRole('columnheader', { name: /amount/i })).toBeVisible();
      await expect(table.getByRole('columnheader', { name: /status|type/i })).toBeVisible();
      await expect(page.getByText(/something went wrong|cannot read propert/i)).not.toBeVisible();
    });
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
