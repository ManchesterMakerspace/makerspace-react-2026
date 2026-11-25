import { test } from '@playwright/test';
import { gotoSmokePage, resourceManagerPages } from '../fixtures/pageSmoke';
import { rmMember0 } from '../fixtures/testData';
import { AuthPage } from '../pages/AuthPage';

for (const screen of resourceManagerPages) {
  test(`${screen.label} page loads for Resource Manager`, async ({ page }) => {
    await new AuthPage(page).signIn(rmMember0.email, rmMember0.password);
    await gotoSmokePage(page, screen.path, screen.text);
  });
}
