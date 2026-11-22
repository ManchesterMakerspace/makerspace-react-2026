import { test } from '@playwright/test';
import { adminScreens, checkSmokeTab, gotoSmokePage } from './pageSmoke';
import { adminMember } from './testData';
import { AuthPage } from '../pages/AuthPage';

export function registerAdminSmokeBackups(group: string): void {
  const screen = adminScreens.find(entry => entry.group === group);
  if (!screen) throw new Error(`Unknown admin smoke group: ${group}`);

  test.beforeEach(async ({ page }) => {
    await new AuthPage(page).signIn(adminMember.email, adminMember.password);
  });

  test(`${screen.title} page loads`, async ({ page }) => {
    await gotoSmokePage(page, screen.path, screen.title);
  });

  for (const tab of screen.tabs) {
    test(`${screen.title} — ${tab.label} tab`, async ({ page }) => {
      await gotoSmokePage(page, screen.path, screen.title);
      await checkSmokeTab(page, tab);
    });
  }
}
