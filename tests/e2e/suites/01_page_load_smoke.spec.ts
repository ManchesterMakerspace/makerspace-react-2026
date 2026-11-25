import { test, expect } from '@playwright/test';
import { AuthPage } from '../pages/AuthPage';
import { adminMember, basicMember, rmMember0 } from '../fixtures/testData';
import {
  adminScreens, checkSmokeTab, expectNoCrash, gotoSmokePage, loginToMemberProfile,
  memberProfileTabs, memberSettingsPages, resourceManagerPages,
} from '../fixtures/pageSmoke';

test('Login page', async ({ page }) => {
  await gotoSmokePage(page, '/login', /sign in/i);
});

test.describe('Member pages load', () => {
  test('Member profile and its tabs render', { tag: '@backup-member-profile' }, async ({ page }) => {
    await loginToMemberProfile(page);
    await test.step('Render the member profile', async () => {
      await expect(page.locator('#member-detail-status')).toBeVisible();
      await expectNoCrash(page);
    });
    for (const tab of memberProfileTabs) {
      await test.step(tab.label, () => checkSmokeTab(page, tab));
    }
  });

  test('Member Home page', async ({ page }) => {
    const memberId = await loginToMemberProfile(page);
    await page.goto('/home');
    await expect(page.getByRole('heading', { name: 'Your membership', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Available safety checkouts', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Account Settings', exact: true }))
      .toHaveAttribute('href', `/members/${memberId}/settings`);
    await expectNoCrash(page);
  });

  test('Member Account Settings direct links render', { tag: '@backup-member-settings' }, async ({ page }) => {
    const memberId = await loginToMemberProfile(page);
    for (const settings of memberSettingsPages) {
      await test.step(settings.label, () =>
        gotoSmokePage(page, `/members/${memberId}/settings/${settings.path}`, settings.text)
      );
    }
  });

  test('Rentals self-service page', async ({ page }) => {
    await new AuthPage(page).signIn(basicMember.email, basicMember.password);
    await gotoSmokePage(page, '/rentals', /rental/i);
  });
});

test.describe('Admin pages load', () => {
  test.beforeEach(async ({ page }) => {
    await new AuthPage(page).signIn(adminMember.email, adminMember.password);
  });

  for (const screen of adminScreens) {
    test(`${screen.title} and its admin tabs render`, { tag: `@backup-${screen.group}` }, async ({ page }) => {
      await test.step(`Open ${screen.title}`, () => gotoSmokePage(page, screen.path, screen.title));
      for (const tab of screen.tabs) {
        await test.step(tab.label, () => checkSmokeTab(page, tab));
      }
    });
  }

  test('Members list page', async ({ page }) => {
    await gotoSmokePage(page, '/members', /members|search/i);
  });

  test('Shop fees page', async ({ page }) => {
    await gotoSmokePage(page, '/shop-fees', /shop fee|charge/i);
  });

  test('Slack identity conflicts page', async ({ page }) => {
    await gotoSmokePage(page, '/admin/slack-identity-conflicts', /slack identity conflicts/i);
  });
});

test('Resource Manager can open their admin pages', { tag: '@backup-resource-manager-pages' }, async ({ page }) => {
  await new AuthPage(page).signIn(rmMember0.email, rmMember0.password);
  for (const screen of resourceManagerPages) {
    await test.step(screen.label, () => gotoSmokePage(page, screen.path, screen.text));
  }
});
