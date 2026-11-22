import { test, expect, Page } from '@playwright/test';
import { openHouseholdProfile } from '../fixtures/household';
import { adminMember } from '../fixtures/testData';
import { AuthPage } from '../pages/AuthPage';
import { MemberPage } from '../pages/MemberPage';

test.beforeEach(async ({ page }) => {
  await new AuthPage(page).signIn(adminMember.email, adminMember.password);
});

async function openSeededProfile(page: Page, role: 'primary' | 'secondary'): Promise<void> {
  const email = `household_${role}@test.com`;
  const response = await page.request.get('/api/members', { params: { search: email } });
  await expect(response).toBeOK();
  const members: { id: string; email: string }[] = await response.json();
  const fixture = members.find(member => member.email === email);
  expect(fixture, `Expected a seeded household ${role}`).toBeDefined();
  await page.goto(`/members/${fixture.id}`);
  await new MemberPage(page).waitForProfile();
}

test('Admin navigates to both household member profiles', async ({ page }) => {
  const primary = await openHouseholdProfile(page, 'primary');
  const secondary = await openHouseholdProfile(page, 'secondary');
  expect(primary).toMatch(/\/members\//);
  expect(secondary).toMatch(/\/members\//);
  expect(secondary).not.toEqual(primary);
});

for (const role of ['primary', 'secondary'] as const) {
  test(`Household ${role} shows the ${role} role`, async ({ page }) => {
    await openSeededProfile(page, role);
    await expect(page.locator('#member-detail-household-role')).toContainText(new RegExp(role, 'i'));
  });
}

test('Secondary member expiration matches primary expiration', async ({ page }) => {
  const member = new MemberPage(page);
  await openSeededProfile(page, 'primary');
  const expiration = await member.getExpiration();
  expect(expiration.trim()).not.toBe('');
  await openSeededProfile(page, 'secondary');
  expect(await member.getExpiration()).toEqual(expiration);
});

test('Admin can view household management modal on primary profile', async ({ page }) => {
  await openSeededProfile(page, 'primary');
  await page.getByRole('button', { name: /household/i }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(page.getByText(/something went wrong/i)).not.toBeVisible();
  await dialog.getByRole('button', { name: /cancel|close/i }).first().click();
  await expect(dialog).toBeHidden();
});
