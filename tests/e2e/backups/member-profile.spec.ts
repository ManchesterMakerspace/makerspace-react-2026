import { test, expect } from '@playwright/test';
import { checkSmokeTab, expectNoCrash, loginToMemberProfile, memberProfileTabs } from '../fixtures/pageSmoke';

test.beforeEach(async ({ page }) => {
  await loginToMemberProfile(page);
});

test('Member profile page', async ({ page }) => {
  await expect(page.locator('#member-detail-type, #member-detail-status').first()).toBeVisible();
  await expectNoCrash(page);
});

for (const tab of memberProfileTabs) {
  test(`Member profile — ${tab.label} tab`, async ({ page }) => {
    await checkSmokeTab(page, tab);
  });
}
