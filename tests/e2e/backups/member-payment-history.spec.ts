import { test, expect } from '@playwright/test';
import { basicMember } from '../fixtures/testData';
import { AuthPage } from '../pages/AuthPage';
import { MemberPage } from '../pages/MemberPage';

test.beforeEach(async ({ page }) => {
  const auth = new AuthPage(page);
  const member = new MemberPage(page);
  await auth.signIn(basicMember.email, basicMember.password);
  await member.gotoOwnProfile();
  await member.dismissNotificationModal();
  await member.clickTab('Payment History');
});

test('Member profile smoke can open the Payment History tab', async ({ page }) => {
  await expect(page.getByRole('table').first()).toBeVisible();
  await expect(page.getByText(/something went wrong|cannot read propert/i)).not.toBeVisible();
});

test('Member sees the payment history table', async ({ page }) => {
  await expect(page.getByRole('table').first()).toBeVisible();
  await expect(page.getByText(/something went wrong/i)).not.toBeVisible();
});

test('Member payment history shows expected columns', async ({ page }) => {
  await expect(page.getByRole('table').first()).toBeVisible();
  await expect(page.getByText(/something went wrong/i)).not.toBeVisible();
  if (await page.getByRole('row').count() > 1) {
    await expect(page.getByRole('columnheader', { name: /amount/i })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /status|type/i }).first()).toBeVisible();
  }
});
