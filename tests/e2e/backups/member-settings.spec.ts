import { test } from '@playwright/test';
import { gotoSmokePage, loginToMemberProfile, memberSettingsPages } from '../fixtures/pageSmoke';

for (const settings of memberSettingsPages) {
  test(`Account Settings — ${settings.label} tab`, async ({ page }) => {
    const memberId = await loginToMemberProfile(page);
    await gotoSmokePage(page, `/members/${memberId}/settings/${settings.path}`, settings.text);
  });
}
