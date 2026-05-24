import { test, expect } from '@playwright/test';
import { AuthPage } from '../pages/AuthPage';
import { MemberPage } from '../pages/MemberPage';
import { PaymentPage } from '../pages/PaymentPage';
import { mockDocumentRoutes } from '../fixtures/routes';
import { buildTestMember, newVisa, adminMember } from '../fixtures/testData';
import { createRejectCard } from '../fixtures/seed';

// ── Test 1: Customer self-registers from home page ────────────────────────────

test.describe('Self-registration from home page', () => {
  // Use 'fullreg' — distinct from any partial test email to avoid conflicts
  const newMember    = buildTestMember('fullreg');
  const rejectionUid = `e2e-fullreg-${Date.now()}`;
  let   memberProfileUrl = '';

  test.beforeAll(async () => {
    createRejectCard(rejectionUid);
  });

  test('Membership options table loads on home page', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('cell', { name: 'One Month' }))
      .toBeVisible({ timeout: 30_000 });
  });

  test('Member completes full self-registration and lands on profile', async ({ page }) => {
    // Mock document routes BEFORE navigation to prevent Google Drive loop
    await mockDocumentRoutes(page);
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
    if (box) await page.mouse.click(box.x + 253, box.y + 155);
    await page.getByRole('button', { name: 'Next' }).click();

    // ── Step 3: Membership — One Month already selected, just click Next ──
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'Next' }).click();

    // ── Step 4: Payment ──
    await page.waitForSelector('#payment-method-form-loading', { state: 'hidden', timeout: 30_000 });
    await payment.openCreditCardAccordion();
    await payment.waitForCreditCardForm();
    await payment.fillCreditCard(newVisa);
    await page.getByRole('button', { name: 'Next' }).click();

    // ── Step 5: Review / Auth ──
    await page.getByRole('checkbox', { name: 'I agree' }).check();
    await page.getByRole('button', { name: 'Submit Payment' }).click();

    await member.waitForProfile();
    memberProfileUrl = await member.getProfileUrl();
    await member.dismissNotificationModal();
    await expect(page.locator('#member-detail-type')).toBeVisible({ timeout: 15_000 });
  });

  test('FOB modal displays correct member address', async ({ page }) => {
    if (!memberProfileUrl) { test.skip(true, 'Requires full registration test to have completed'); return; }
    const auth   = new AuthPage(page);
    const member = new MemberPage(page);

    await auth.signIn(adminMember.email, adminMember.password);
    await page.goto(memberProfileUrl);
    await member.waitForProfile();
    await member.openFobModal();
    await member.verifyAddressInFobModal({
      street:     newMember.address.street,
      city:       newMember.address.city,
      state:      newMember.address.state,
      postalCode: newMember.address.postalCode,
    });
  });

  test('Admin registers FOB and membership becomes active', async ({ page }) => {
    if (!memberProfileUrl) { test.skip(true, 'Requires full registration test to have completed'); return; }
    const auth   = new AuthPage(page);
    const member = new MemberPage(page);

    await auth.signIn(adminMember.email, adminMember.password);
    await page.goto(memberProfileUrl);
    await member.waitForProfile();
    await member.openFobModal();
    await member.importFob();
    await member.waitForFobUid(rejectionUid);
    await member.checkIdVerified();
    await member.submitFobModal();

    await member.verifyMembershipStatus('Active');
    const expiration = await member.getExpiration();
    expect(expiration).toMatch(/\d{1,2}\s+\w+\s+\d{4}/);
  });
});

// ── Test 2: Registration with discount code ───────────────────────────────────

test.describe('Registration via URL with discount code', () => {
  test.skip(true, 'Discount code registration — not yet implemented');
  test('Discount URL pre-selects plan and shows discount', async ({ page }) => {});
  test('Review step shows correct discounted total', async ({ page }) => {});
  test('Member completes discounted registration', async ({ page }) => {});
});

// ── Test 3: Admin creates member with complimentary membership ────────────────

test.describe('Admin creates member with complimentary membership', () => {
  const newMember    = buildTestMember('admincreated');
  const rejectionUid = `e2e-admincreated-${Date.now()}`;
  let   memberProfileUrl = '';

  test.beforeAll(async () => {
    createRejectCard(rejectionUid);
  });

  test('Admin creates new member from members list', async ({ page }) => {
    const auth   = new AuthPage(page);
    const member = new MemberPage(page);

    await auth.signIn(adminMember.email, adminMember.password);
    await member.goToMembersList();
    await member.clickCreateNewMember();
    await member.fillAdminMemberForm(newMember);
    await member.saveAdminMemberForm();

    // SMTP may cause a 500 but member IS created — search for them
    await member.goToMembersList();
    await member.searchMembers(newMember.lastname);
    await member.clickMemberLink(`${newMember.firstname} ${newMember.lastname}`);

    memberProfileUrl = await member.getProfileUrl();
    await expect(page.locator('#member-detail-status')).toBeVisible({ timeout: 15_000 });
  });

  test('Admin sets complimentary 1 month expiration via Edit form', async ({ page }) => {
    test.skip(!memberProfileUrl, 'Requires previous test to have completed');
    const auth   = new AuthPage(page);
    const member = new MemberPage(page);

    await auth.signIn(adminMember.email, adminMember.password);
    await page.goto(memberProfileUrl);
    await member.waitForProfile();

    // Set expiration 1 month from today (YYYY-MM-DD)
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    const dateStr = d.toISOString().split('T')[0];
    await member.setExpirationDate(dateStr);

    const expiration = await member.getExpiration();
    expect(expiration).toMatch(/\d{1,2}\s+\w+\s+\d{4}/);
  });

  test('FOB modal shows correct member address', async ({ page }) => {
    if (!memberProfileUrl) { test.skip(true, 'Requires previous test to have completed'); return; }
    const auth   = new AuthPage(page);
    const member = new MemberPage(page);

    await auth.signIn(adminMember.email, adminMember.password);
    await page.goto(memberProfileUrl);
    await member.waitForProfile();
    await member.openFobModal();
    await member.verifyAddressInFobModal({
      street:     newMember.address.street,
      city:       newMember.address.city,
      state:      newMember.address.state,
      postalCode: newMember.address.postalCode,
    });
  });

  test('Admin registers FOB and membership becomes active', async ({ page }) => {
    if (!memberProfileUrl) { test.skip(true, 'Requires previous test to have completed'); return; }
    const auth   = new AuthPage(page);
    const member = new MemberPage(page);

    await auth.signIn(adminMember.email, adminMember.password);
    await page.goto(memberProfileUrl);
    await member.waitForProfile();
    await member.openFobModal();
    await member.importFob();
    await member.waitForFobUid(rejectionUid);
    await member.checkIdVerified();
    await member.submitFobModal();

    await member.verifyMembershipStatus('Active');
  });
});
