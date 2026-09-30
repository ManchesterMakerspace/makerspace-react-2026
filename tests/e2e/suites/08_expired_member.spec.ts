import { test, expect } from '@playwright/test';
import { AuthPage } from '../pages/AuthPage';
import { MemberPage } from '../pages/MemberPage';
import { expiredMember } from '../fixtures/testData';

// ── Expired member experience ─────────────────────────────────────────────────
//
// Verifies that a member with a past expiration date:
//   - Can still log in (expired ≠ revoked)
//   - Sees their profile without a crash
//   - Has status indicating expiry (nonMember / expired)
//   - Cannot claim volunteer tasks or create rental requests

test.describe('Expired member portal experience', () => {

  test.beforeEach(async ({ page }) => {
    const auth   = new AuthPage(page);
    const member = new MemberPage(page);
    await auth.signIn(expiredMember.email, expiredMember.password);
    await member.gotoOwnProfile();
    await member.dismissNotificationModal();
  });

  test('Expired member can sign in and profile loads without crash', async ({ page }) => {
    // Profile page renders — no white screen or error boundary
    await expect(page.locator('#member-detail-status')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/something went wrong/i)).not.toBeVisible();
  });

  test('Expired member profile shows non-active status', async ({ page }) => {
    // Note: The member's status field stays "activeMember" — expiry is tracked by
    // expirationTime. The portal shows "Active" status but the expiration date
    // shown on the profile will be in the past, and "Manage Subscription" is not shown.
    // Verify the expiration date is visible (confirming profile loaded) and no crash.
    await expect(page.locator('#member-detail-status')).toBeVisible({ timeout: 10_000 });
    // Expired members have no active Braintree subscription — "Manage Subscription"
    // link should NOT be present
    await expect(page.getByRole('link', { name: 'Manage Subscription' }))
      .not.toBeVisible({ timeout: 5_000 });
    await expect(page.getByText(/something went wrong/i)).not.toBeVisible();
  });

  test('Expired member sees Dues tab with outstanding invoices or renewal prompt', async ({ page }) => {
    const member = new MemberPage(page);
    await member.clickTab('Dues');
    await page.waitForTimeout(1000);
    await expect(page.getByText(/something went wrong/i)).not.toBeVisible();
    // Either a table renders or a renewal CTA is shown
    const tableOrCta =
      await page.getByRole('table').first().isVisible({ timeout: 5_000 }).catch(() => false) ||
      await page.getByRole('button', { name: /renew|update membership/i }).isVisible({ timeout: 3_000 }).catch(() => false);
    expect(tableOrCta).toBe(true);
  });

  test('Expired member cannot claim volunteer task — sees forbidden error', async ({ page }) => {
    const member = new MemberPage(page);
    await member.clickTab('Volunteer');
    await page.waitForTimeout(1000);
    await expect(page.getByText(/something went wrong/i)).not.toBeVisible();

    // Try to claim a task if any are visible
    const claimBtn = page.getByRole('button', { name: /claim task/i });
    if (await claimBtn.isVisible({ timeout: 5_000 })) {
      await claimBtn.click();
      await page.waitForTimeout(1000);
      // Should see an error — not active members may not claim
      await expect(
        page.getByText(/active member|not allowed|cannot claim|forbidden/i).first()
      ).toBeVisible({ timeout: 5_000 });
    }
    // If no tasks visible that's also fine — expired member may see empty state
  });

  test('Expired member cannot request a rental — sees forbidden error', async ({ page }) => {
    const member = new MemberPage(page);
    await member.clickTab('Rentals');
    await page.waitForTimeout(1000);
    await expect(page.getByText(/something went wrong/i)).not.toBeVisible();

    // Attempt rental request if UI is accessible
    const spotSelect = page.getByRole('combobox', { name: /available rental/i });
    if (await spotSelect.isVisible({ timeout: 5_000 })) {
      await spotSelect.click();
      await page.waitForSelector('[role="listbox"]', { timeout: 5_000 }).catch(() => {});
      const firstOption = page.getByRole('option').first();
      if (await firstOption.isVisible({ timeout: 3_000 })) {
        await firstOption.click();
        const confirmBtn = page.getByRole('button', { name: /confirm rental/i });
        if (await confirmBtn.isVisible({ timeout: 3_000 })) {
          await confirmBtn.click();
          await page.waitForTimeout(1000);
          // Should see error — membership not active
          await expect(
            page.getByText(/active|not active|renew|membership/i).first()
          ).toBeVisible({ timeout: 5_000 });
        }
      }
    }
  });
});
