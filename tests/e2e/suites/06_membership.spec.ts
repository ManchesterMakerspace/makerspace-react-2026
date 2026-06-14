import { test, expect } from '@playwright/test';
import { AuthPage } from '../pages/AuthPage';
import { PaymentPage } from '../pages/PaymentPage';
import { SettingsPage } from '../pages/SettingsPage';
import { BillingPage } from '../pages/BillingPage';
import { MemberPage } from '../pages/MemberPage';
import { newVisa, newMastercard, paypalMember, adminMember } from '../fixtures/testData';

// ── Shared helpers ────────────────────────────────────────────────────────────

async function createSubscription(page: any, card = newVisa) {
  const settings = new SettingsPage(page);
  const payment  = new PaymentPage(page);

  await settings.goto();
  await settings.goToSubscriptionsTab();
  await settings.verifyNoSubscription();
  await settings.clickCreateSubscription();
  await settings.selectMonthlyPlan();
  await settings.clickNextOnMembershipStep();     // Membership → Payment

  // If saved payment method exists use it, otherwise open CC form and fill card
  const savedVisa = page.getByRole('radio', { name: /visa/i });
  const hasSaved  = await savedVisa.isVisible({ timeout: 3_000 }).catch(() => false);

  if (hasSaved) {
    await savedVisa.click();
  } else {
    await payment.openCreditCardAccordion();
    await payment.waitForCreditCardForm();
    await payment.fillCreditCard(card);
  }

  await page.getByRole('button', { name: 'Next' }).click(); // Payment → Auth
  await settings.acceptAuthAgreement();
  await settings.clickSubmitPayment();            // submits + reloads settings
}

async function cancelSubscription(page: any) {
  const settings = new SettingsPage(page);
  await settings.goto();
  await settings.goToSubscriptionsTab();
  await settings.verifyActiveSubscription();
  await settings.clickCancelSubscription();
  await settings.confirmCancelSubscription();
}

// ── Member subscription lifecycle ─────────────────────────────────────────────

test.describe('Member subscription lifecycle', () => {

  test('Member has no subscription initially', async ({ page }) => {
    const auth     = new AuthPage(page);
    const settings = new SettingsPage(page);

    await auth.signIn(paypalMember.email, paypalMember.password);
    await settings.goto();
    await settings.goToSubscriptionsTab();
    await settings.verifyNoSubscription();
  });

  test('Member can create a monthly subscription with Visa', async ({ page }) => {
    const auth     = new AuthPage(page);
    const settings = new SettingsPage(page);

    await auth.signIn(paypalMember.email, paypalMember.password);
    await createSubscription(page, newVisa);
    await settings.verifyActiveSubscription();

    // Cleanup
    await cancelSubscription(page);
  });

  test('Member can change payment method on active subscription', async ({ page }) => {
    const auth     = new AuthPage(page);
    const settings = new SettingsPage(page);
    const payment  = new PaymentPage(page);

    // Use paypal_member1 — clean member with no saved card
    await auth.signIn('paypal_member1@test.com', 'password');

    // Step 1: Create subscription with Visa (no saved card, CC form opens directly)
    await settings.goto();
    await settings.goToSubscriptionsTab();
    await settings.verifyNoSubscription();
    await settings.clickCreateSubscription();
    await settings.selectMonthlyPlan();
    await settings.clickNextOnMembershipStep();
    await payment.openCreditCardAccordion();
    await payment.waitForCreditCardForm();
    await payment.fillCreditCard(newVisa);
    await page.getByRole('button', { name: 'Next' }).click();
    await settings.acceptAuthAgreement();
    await settings.clickSubmitPayment();
    await settings.verifyActiveSubscription();

    // Step 2: Log out then log back in for clean state
    await auth.logout();
    await auth.signIn('paypal_member1@test.com', 'password');

    // Step 3: Change payment method to Mastercard
    await settings.goto();
    await settings.goToSubscriptionsTab();
    await settings.verifyActiveSubscription();
    await settings.clickChangePaymentMethod();
    await payment.openAddNewPaymentMethod();
    await payment.waitForCreditCardForm();
    await payment.fillCreditCard(newMastercard);
    await payment.saveCard();
    await settings.submitChangePaymentMethod();
    await settings.verifyActiveSubscription();

    // Cleanup
    await cancelSubscription(page);
  });

  test('Member can cancel their subscription', async ({ page }) => {
    const auth     = new AuthPage(page);
    const settings = new SettingsPage(page);

    // Use paypal_member2 — clean member with no saved card
    await auth.signIn('paypal_member2@test.com', 'password');
    await createSubscription(page, newVisa);
    await settings.verifyActiveSubscription();

    await settings.clickCancelSubscription();
    await settings.confirmCancelSubscription();
    await settings.verifyNoSubscription();
  });
});

// ── Admin cancels a member subscription ───────────────────────────────────────

test.describe('Admin cancels a member subscription', () => {

  // basic_member5 is a high-numbered seeded member with a subscription
  // Using them avoids interfering with lower-numbered members used in other tests
  const TARGET_MEMBER = 'Basic Member5';

  test('Admin navigates to member profile and sees Manage Subscription link', async ({ page }) => {
    const auth   = new AuthPage(page);
    const member = new MemberPage(page);

    await auth.signIn(adminMember.email, adminMember.password);
    await member.goToMembersList();
    await member.searchMembers('basic_member5');
    await member.clickMemberLink(TARGET_MEMBER);
    await expect(page.getByRole('link', { name: 'Manage Subscription' }))
      .toBeVisible({ timeout: 15_000 });
  });

  test('Admin cancels the subscription via Manage Subscription', async ({ page }) => {
    const auth   = new AuthPage(page);
    const member = new MemberPage(page);

    await auth.signIn(adminMember.email, adminMember.password);
    await member.goToMembersList();
    await member.searchMembers('basic_member5');
    await member.clickMemberLink(TARGET_MEMBER);

    // Click Manage Subscription link on the member profile
    await page.getByRole('link', { name: 'Manage Subscription' }).click();
    await page.waitForURL(/\/billing/, { timeout: 15_000 });
    await page.waitForLoadState('networkidle');

    // Wait for the subscription row to load before selecting it
    // Table id="subscriptions-table", filtered by the subscription id in the URL
    await page.locator('#subscriptions-table').waitFor({ state: 'visible', timeout: 15_000 });
    await page.getByRole('row').filter({ hasText: TARGET_MEMBER }).first()
      .waitFor({ state: 'visible', timeout: 15_000 });

    // Select the subscription row checkbox
    await page.getByRole('row').filter({ hasText: TARGET_MEMBER }).first()
      .getByRole('checkbox').check();

    // Cancel button id="subscription-option-cancel", confirm modal submit id="cancel-subscription-submit"
    await page.locator('#subscription-option-cancel').click();
    await page.waitForSelector('#cancel-subscription-submit', { timeout: 10_000 });
    await page.locator('#cancel-subscription-submit').click();
    await page.waitForSelector('#cancel-subscription-submit', { state: 'hidden', timeout: 30_000 });
    await page.waitForTimeout(2000);
  });

  test('Member profile shows no active subscription after cancellation', async ({ page }) => {
    const auth   = new AuthPage(page);
    const member = new MemberPage(page);

    await auth.signIn(adminMember.email, adminMember.password);
    await member.goToMembersList();
    await member.searchMembers('basic_member5');
    await member.clickMemberLink(TARGET_MEMBER);
    await member.waitForProfile();

    // After cancellation membership type shows Month-to-month (no active subscription).
    // Braintree sandbox webhook may take a few seconds to process — reload once to pick up
    // updated state before asserting.
    await page.reload();
    await member.waitForProfile();
    await expect(page.getByText('Month-to-month')).toBeVisible({ timeout: 30_000 });
  });
});
