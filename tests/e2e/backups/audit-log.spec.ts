import { test, expect } from '@playwright/test';
import { adminMember } from '../fixtures/testData';
import { AuthPage } from '../pages/AuthPage';

test.beforeEach(async ({ page }) => {
  await new AuthPage(page).signIn(adminMember.email, adminMember.password);
  await page.goto('/admin/audit-log');
});

test('Audit log page smoke renders for an admin', async ({ page }) => {
  await expect(page.getByText(/audit log/i).first()).toBeVisible();
  await expect(page.getByText(/something went wrong|cannot read propert/i)).not.toBeVisible();
});

test('Admin audit log page loads without error', async ({ page }) => {
  await expect(page.getByText('Audit Log', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('table')).toBeVisible();
  await expect(page.getByText(/something went wrong|unexpected error/i)).not.toBeVisible();
});
