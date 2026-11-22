import { test } from '@playwright/test';
import { registerMemberFromHome } from '../fixtures/fobRegistration';
import { adminMember, buildTestMember } from '../fixtures/testData';
import { AuthPage } from '../pages/AuthPage';
import { MemberPage } from '../pages/MemberPage';

test('Fob modal displays the address of a self-registered member', async ({ page, browser, baseURL }) => {
  const newMember = buildTestMember('backup-fullreg');
  const profileUrl = await registerMemberFromHome(page, newMember);

  const adminPage = await browser.newPage({ baseURL });
  try {
    await new AuthPage(adminPage).signIn(adminMember.email, adminMember.password);
    const member = new MemberPage(adminPage);
    await adminPage.goto(profileUrl);
    await member.waitForProfile();
    await member.openFobModal();
    await member.verifyAddressInFobModal(newMember.address);
  } finally {
    await adminPage.close();
  }
});
