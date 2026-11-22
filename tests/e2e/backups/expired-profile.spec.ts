import { test, expect } from '@playwright/test';
import { expiredMember } from '../fixtures/testData';
import { AuthPage } from '../pages/AuthPage';
import { MemberPage } from '../pages/MemberPage';

test.beforeEach(async ({ page }) => {
  const auth = new AuthPage(page);
  const member = new MemberPage(page);
  await auth.signIn(expiredMember.email, expiredMember.password);
  await member.gotoOwnProfile();
  await member.dismissNotificationModal();
});

test('Expired member can sign in and profile loads without crash', async ({ page }) => {
  await expect(page.locator('#member-detail-status')).toBeVisible();
  await expect(page.getByText(/something went wrong/i)).not.toBeVisible();
});

test('Expired member profile has no subscription management link', async ({ page }) => {
  await expect(page.locator('#member-detail-status')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Manage Subscription' })).not.toBeVisible();
  await expect(page.getByText(/something went wrong/i)).not.toBeVisible();
});
