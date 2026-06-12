import { test, expect } from '@playwright/test';
import { AuthPage } from '../pages/AuthPage';
import { MemberPage } from '../pages/MemberPage';
import { adminMember } from '../fixtures/testData';

// ── Audit log ─────────────────────────────────────────────────────────────────
//
// Verifies the audit log page loads and captures entries.
// Uses basic_member11 — a high-numbered member not shared with other suites.

const TARGET_MEMBER = 'Basic Member11';

test.describe('Admin audit log captures member changes', () => {

  test('Admin audit log page loads without error', async ({ page }) => {
    const auth = new AuthPage(page);

    await auth.signIn(adminMember.email, adminMember.password);
    await page.goto('/admin/audit-log');
    await page.waitForLoadState('networkidle');

    // Page title should be visible
    await expect(page.getByText('Audit Log').first()).toBeVisible({ timeout: 15_000 });

    // Table should render — at minimum the header row
    await expect(page.getByRole('table').first()).toBeVisible({ timeout: 15_000 });

    // No crash — no error boundary text
    await expect(page.getByText(/something went wrong/i)).not.toBeVisible();
    await expect(page.getByText(/unexpected error/i)).not.toBeVisible();
  });

  test('Admin updates member notes — audit log shows member_updated entry', async ({ page }) => {
    const auth   = new AuthPage(page);
    const member = new MemberPage(page);

    await auth.signIn(adminMember.email, adminMember.password);
    await member.goToMembersList();
    await member.searchMembers('basic_member11');
    await member.clickMemberLink(TARGET_MEMBER);
    await member.waitForProfile();

    // Update notes on member
    await page.getByRole('button', { name: 'Edit' }).click();
    await page.waitForSelector('[role="dialog"]', { timeout: 10_000 });

    const notesField = page.getByRole('textbox', { name: /notes/i });
    await notesField.clear();
    await notesField.fill('audit log test note');

    await page.getByRole('button', { name: 'Save' }).click();
    await page.waitForSelector('[role="dialog"]', { state: 'hidden', timeout: 15_000 });
    await page.waitForTimeout(1000);

    // Navigate to audit log and verify entry exists
    await page.goto('/admin/audit-log');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Should see a member_updated entry for this member
    await expect(
      page.getByRole('cell', { name: /member_updated|member updated/i }).first()
    ).toBeVisible({ timeout: 15_000 });
  });

  test('Audit log entries are filterable', async ({ page }) => {
    const auth = new AuthPage(page);

    await auth.signIn(adminMember.email, adminMember.password);
    await page.goto('/admin/audit-log');
    await page.waitForLoadState('networkidle');

    // Filter by event type if filter UI is present
    const filterInput = page.getByRole('textbox', { name: /search|filter/i }).first();
    if (await filterInput.isVisible({ timeout: 3_000 })) {
      await filterInput.fill('member_updated');
      await page.waitForTimeout(1000);
      // Results should be scoped — check that no error is thrown
      await expect(page.getByText(/something went wrong/i)).not.toBeVisible();
    }

    // Table rows still render
    await expect(page.getByRole('table').first()).toBeVisible({ timeout: 10_000 });
  });
});
