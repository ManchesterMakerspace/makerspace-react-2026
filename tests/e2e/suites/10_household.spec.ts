import { test, expect } from '@playwright/test';
import { openHouseholdProfile } from '../fixtures/household';
import { adminMember } from '../fixtures/testData';
import { AuthPage } from '../pages/AuthPage';
import { MemberPage } from '../pages/MemberPage';

test('Admin can inspect and manage a seeded household', { tag: '@backup-household' }, async ({ page }) => {
  const member = new MemberPage(page);
  await new AuthPage(page).signIn(adminMember.email, adminMember.password);

  const primary = await test.step('Find the primary and read their role and expiration', async () => {
    const url = await openHouseholdProfile(page, 'primary');
    expect(url).toMatch(/\/members\/[^/?]+/);
    await expect(page.locator('#member-detail-household-role')).toContainText(/primary/i);
    const expiration = await member.getExpiration();
    expect(expiration.trim()).not.toBe('');
    return { url, expiration };
  });

  await test.step('Find the secondary and verify their role and matching expiration', async () => {
    const url = await openHouseholdProfile(page, 'secondary');
    expect(url).toMatch(/\/members\/[^/?]+/);
    expect(url).not.toEqual(primary.url);
    await expect(page.locator('#member-detail-household-role')).toContainText(/secondary/i);
    await expect(page.locator('#member-detail-expiration')).toHaveText(primary.expiration.trim());
  });

  await test.step('Open and close the household management dialog', async () => {
    await page.goto(primary.url);
    await member.waitForProfile();
    await page.getByRole('button', { name: /household/i }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(page.getByText(/something went wrong/i)).not.toBeVisible();
    await dialog.getByRole('button', { name: /cancel|close/i }).first().click();
    await expect(dialog).toBeHidden();
  });
});
