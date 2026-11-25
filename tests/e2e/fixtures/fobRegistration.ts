import { expect, Page } from '@playwright/test';
import { adminMember, newVisa, TestMember } from './testData';
import { AuthPage } from '../pages/AuthPage';
import { MemberPage } from '../pages/MemberPage';
import { PaymentPage } from '../pages/PaymentPage';

export async function registerMemberFromHome(page: Page, newMember: TestMember): Promise<string> {
  const payment = new PaymentPage(page);
  const member  = new MemberPage(page);

  await page.goto('/');
  const row = page.getByRole('row', { name: /one month/i });
  await row.waitFor({ timeout: 15_000 });
  await row.getByRole('button', { name: 'Sign Up' }).click();

  // ── Step 1: Basic Info ──
  await page.getByRole('textbox', { name: 'First Name' }).fill(newMember.firstname);
  await page.getByRole('textbox', { name: 'Last Name' }).fill(newMember.lastname);
  await page.getByRole('textbox', { name: 'Phone Number' }).fill(newMember.phone);
  await page.getByRole('textbox', { name: 'Street Address' }).fill(newMember.address.street);
  await page.getByRole('textbox', { name: 'City' }).fill(newMember.address.city);
  await page.locator('#sign-up-form-state').selectOption(newMember.address.state);
  await page.getByRole('textbox', { name: 'Postal Code' }).fill(newMember.address.postalCode);
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill(newMember.email);
  await page.getByRole('textbox', { name: 'Confirm Email' }).fill(newMember.email);
  await page.getByRole('textbox', { name: 'Password' }).fill(newMember.password);
  await page.getByRole('button', { name: 'Next' }).click();

  // ── Step 2: Agreements ──
  await page.getByRole('checkbox', { name: /Code of Conduct/i }).check();
  await page.getByRole('checkbox', { name: /Member Contract/i }).check();
  const canvas = page.locator('canvas').first();
  await canvas.waitFor({ state: 'visible' });
  const box = await canvas.boundingBox();
  if (box) {
    // Draw signature using dispatchEvent to ensure canvas registers the stroke
    await canvas.dispatchEvent('mousedown', { clientX: box.x + 50, clientY: box.y + 50 });
    await canvas.dispatchEvent('mousemove', { clientX: box.x + 150, clientY: box.y + 50 });
    await canvas.dispatchEvent('mousemove', { clientX: box.x + 200, clientY: box.y + 80 });
    await canvas.dispatchEvent('mousemove', { clientX: box.x + 150, clientY: box.y + 100 });
    await canvas.dispatchEvent('mouseup',   { clientX: box.x + 150, clientY: box.y + 100 });
    await page.waitForTimeout(500);
  }
  await page.getByRole('button', { name: 'Next' }).click();

  // ── Step 3: Membership — One Month already selected, just click Next ──
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: 'Next' }).click();

  // ── Step 4: Payment ──
  await payment.openCreditCardAccordion();
  await payment.waitForCreditCardForm();
  await payment.fillCreditCard(newVisa);
  await page.getByRole('button', { name: 'Next' }).click();

  // ── Step 5: Review / Auth ──
  await page.getByRole('checkbox', { name: 'I agree' }).check();
  await page.getByRole('button', { name: 'Submit Payment' }).click();

  await expect(page).toHaveURL(url => url.pathname === '/home' && url.search === '?newMember=true');
  await expect(page.getByRole('heading', { name: 'Welcome!', exact: true })).toBeVisible();
  await member.gotoOwnProfile();
  await member.dismissNotificationModal();
  await expect(page.locator('#member-detail-type')).toBeVisible({ timeout: 15_000 });
  return member.getProfileUrl();
}

export async function createMemberAsAdmin(page: Page, newMember: TestMember): Promise<string> {
  const auth   = new AuthPage(page);
  const member = new MemberPage(page);

  await auth.signIn(adminMember.email, adminMember.password);
  await member.goToMembersList();
  await member.clickCreateNewMember();
  await member.fillAdminMemberForm(newMember);
  await member.saveAdminMemberForm();

  // SMTP may cause a 500 but member IS created — search for them
  await member.goToMembersList();
  await member.searchMembers(newMember.email);
  await member.clickMemberLink(`${newMember.firstname} ${newMember.lastname}`);

  await expect(page.locator('#member-detail-status')).toBeVisible({ timeout: 15_000 });
  return member.getProfileUrl();
}

export async function setComplimentaryExpiration(member: MemberPage): Promise<void> {
  const expiration = new Date();
  expiration.setMonth(expiration.getMonth() + 1);
  await member.setExpirationDate(expiration.toISOString().split('T')[0]);
}
