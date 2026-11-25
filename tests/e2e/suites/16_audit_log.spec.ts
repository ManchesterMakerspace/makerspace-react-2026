import { test, expect } from '@playwright/test';
import { AuthPage } from '../pages/AuthPage';
import { MemberPage } from '../pages/MemberPage';
import { adminMember } from '../fixtures/testData';

const TARGET_MEMBER = 'Basic Member11';

test.describe('Admin audit log captures member changes', () => {
  test.beforeEach(async ({ page }) => {
    await new AuthPage(page).signIn(adminMember.email, adminMember.password);
  });

  test('Admin updates member notes and sees the audit log entry', { tag: '@backup-audit-log' }, async ({ page }) => {
    const member = new MemberPage(page);

    await test.step('Save a change to member notes', async () => {
      await member.goToMembersList();
      await member.searchMembers('basic_member11');
      await member.clickMemberLink(TARGET_MEMBER);
      await member.waitForProfile();
      await page.getByRole('button', { name: 'Edit', exact: true }).click();
      const dialog = page.getByRole('dialog');
      await dialog.locator('textarea[name="member-form-notes"]').first().fill(`audit log test note ${Date.now()}`);
      await dialog.getByRole('button', { name: 'Save', exact: true }).click();
      await expect(dialog).toBeHidden();
    });

    await test.step('Open the audit log and verify the member update', async () => {
      await page.goto('/admin/audit-log');
      await expect(page.getByText('Audit Log', { exact: true }).first()).toBeVisible();
      const table = page.getByRole('table');
      await expect(table).toBeVisible();
      const memberRows = table.getByRole('row').filter({ hasText: TARGET_MEMBER });
      await expect(memberRows.getByRole('cell', { name: /member_updated|member updated/i }).first()).toBeVisible();
      await expect(page.getByText(/something went wrong|cannot read propert|unexpected error/i)).not.toBeVisible();
    });
  });

  test('Admin can filter the audit log by category', async ({ page }) => {
    await page.goto('/admin/audit-log');
    await page.getByRole('button', { name: 'Filters', exact: true }).click();
    await expect(page.getByRole('combobox', { name: 'Event', exact: true })).toBeVisible();
    await page.getByRole('combobox', { name: 'Category', exact: true }).click();

    const [filtered] = await Promise.all([
      page.waitForResponse(response => {
        const url = new URL(response.url());
        return url.pathname === '/api/admin/audit_logs' && url.searchParams.get('category') === 'all';
      }),
      page.getByRole('option', { name: 'All', exact: true }).click(),
    ]);
    expect(filtered.ok()).toBe(true);
    await expect(page.getByRole('table')).toBeVisible();
    await expect(page.getByText(/something went wrong/i)).not.toBeVisible();
  });
});
