import { test, expect } from '@playwright/test';
import { AuthPage } from '../pages/AuthPage';
import { MemberPage } from '../pages/MemberPage';
import { PaymentPage } from '../pages/PaymentPage';
import { AdminRentalsPage } from '../pages/AdminRentalsPage';
import { MemberRentalsPage } from '../pages/MemberRentalsPage';
import { adminMember, basicMember } from '../fixtures/testData';

const GREEN_TOTE      = 'Green Tote';
const TOTE_PLAN       = 'Monthly Tote Rental';
const GT1             = 'GT1';
const GT1_LOCATION    = 'Classroom';
const GT1_DESCRIPTION = 'Large Green Tote';

// ── Test 6: Admin creates rental type and spot ────────────────────────────────

test.describe('Admin creates rental type and spot', () => {

  test('Admin creates Green Tote rental type', async ({ page }) => {
    const auth    = new AuthPage(page);
    const rentals = new AdminRentalsPage(page);

    await auth.signIn(adminMember.email, adminMember.password);
    await rentals.goto();
    await rentals.goToTab('Rental Types');
    await rentals.waitForTypesTable();
    await rentals.clickAddType();
    await rentals.fillRentalTypeForm(GREEN_TOTE, TOTE_PLAN);
    await rentals.submitRentalTypeForm();
    await rentals.verifyTypeInTable(GREEN_TOTE);
  });

  test('Admin creates GT1 spot using Green Tote type', async ({ page }) => {
    const auth    = new AuthPage(page);
    const rentals = new AdminRentalsPage(page);

    await auth.signIn(adminMember.email, adminMember.password);
    await rentals.goto();
    await rentals.goToTab('Rental Spots');
    await rentals.waitForSpotsTable();
    await rentals.clickAddSpot();
    await rentals.fillRentalSpotForm({
      number:         GT1,
      location:       GT1_LOCATION,
      rentalTypeName: GREEN_TOTE,
      description:    GT1_DESCRIPTION,
    });
    await rentals.submitRentalSpotForm();
    await rentals.verifySpotInTable(GT1);
  });

  test('GT1 appears in spot catalog search', async ({ page }) => {
    const auth    = new AuthPage(page);
    const rentals = new AdminRentalsPage(page);

    await auth.signIn(adminMember.email, adminMember.password);
    await rentals.goto();
    await rentals.goToTab('Rental Spots');
    await rentals.waitForSpotsTable();
    await rentals.searchForSpot(GT1);
    await rentals.verifySpotInTable(GT1);
  });
});

// ── Test 7: Member self-assigns rental spot (depends on Test 6) ───────────────

test.describe('Member self-assigns rental spot', () => {

  test('Member sees Rentals tab on profile', async ({ page }) => {
    const auth   = new AuthPage(page);
    const member = new MemberPage(page);

    await auth.signIn(basicMember.email, basicMember.password);
    await member.waitForProfile();
    await member.dismissNotificationModal();
    await member.dismissRentalAgreementModal();

    await expect(page.getByRole('tab', { name: /rentals/i })).toBeVisible();
  });

  test('Member sees spot dropdown on Rentals tab', async ({ page }) => {
    const auth    = new AuthPage(page);
    const member  = new MemberPage(page);
    const rentals = new MemberRentalsPage(page);

    await auth.signIn(basicMember.email, basicMember.password);
    await member.waitForProfile();
    await member.dismissNotificationModal();
    await member.dismissRentalAgreementModal();
    await member.clickTab('Rentals');
    await rentals.waitForRentalsTab();

    await expect(page.getByRole('button', { name: 'Select an Available Rental' })).toBeVisible();
  });

  test('Member selects GT1 from dropdown', async ({ page }) => {
    const auth    = new AuthPage(page);
    const member  = new MemberPage(page);
    const rentals = new MemberRentalsPage(page);

    await auth.signIn(basicMember.email, basicMember.password);
    await member.waitForProfile();
    await member.dismissNotificationModal();
    await member.dismissRentalAgreementModal();
    await member.clickTab('Rentals');
    await rentals.waitForRentalsTab();
    await rentals.selectSpot(GT1);

    await expect(page.getByRole('button', { name: 'Confirm Rental' })).toBeVisible();
  });

  test('Rental agreement appears after confirming', async ({ page }) => {
    const auth    = new AuthPage(page);
    const member  = new MemberPage(page);
    const rentals = new MemberRentalsPage(page);

    await auth.signIn(basicMember.email, basicMember.password);
    await member.waitForProfile();
    await member.dismissNotificationModal();
    await member.dismissRentalAgreementModal();
    await member.clickTab('Rentals');
    await rentals.waitForRentalsTab();
    await rentals.selectSpot(GT1);
    await rentals.confirmRental();

    await expect(page.getByRole('button', { name: 'Confirm & Sign Agreement' }))
      .toBeVisible({ timeout: 15_000 });
  });

  test('Member signs agreement and proceeds', async ({ page }) => {
    const auth    = new AuthPage(page);
    const member  = new MemberPage(page);
    const rentals = new MemberRentalsPage(page);

    await auth.signIn(basicMember.email, basicMember.password);
    await member.waitForProfile();
    await member.dismissNotificationModal();
    await member.dismissRentalAgreementModal();
    await member.clickTab('Rentals');
    await rentals.waitForRentalsTab();
    await rentals.selectSpot(GT1);
    await rentals.confirmRental();
    await rentals.openSignAgreement();
    await rentals.acceptAndSignAgreement();
    await rentals.clickProceed();

    // Should land back on profile
    await member.waitForProfile();
  });

  test('GT1 rental appears in member rentals table', async ({ page }) => {
    const auth    = new AuthPage(page);
    const member  = new MemberPage(page);
    const rentals = new MemberRentalsPage(page);

    await auth.signIn(basicMember.email, basicMember.password);
    await member.waitForProfile();
    await member.dismissRentalAgreementModal();
    // Reload to ensure rental persisted
    await member.reloadProfile();
    await member.dismissRentalAgreementModal();
    await member.clickTab('Rentals');
    await rentals.verifyRentalInTable(GT1);
  });

  test('Member pays rental invoice from Dues tab', async ({ page }) => {
    const auth    = new AuthPage(page);
    const member  = new MemberPage(page);
    const payment = new PaymentPage(page);
    const rentals = new MemberRentalsPage(page);

    await auth.signIn(basicMember.email, basicMember.password);
    await member.waitForProfile();
    await member.dismissRentalAgreementModal();
    await member.clickTab('Dues');
    await page.waitForTimeout(1000);

    await rentals.selectDuesInvoice();
    await payment.paySelectedDues();

    // Step 1: Select payment method — Visa radio must be clicked first
    await payment.selectSavedVisa();
    await page.getByRole('button', { name: 'Next' }).click();

    // Step 2: Review and confirm purchase
    await page.waitForSelector('#checkout-invoices-table', { timeout: 15_000 });
    await page.getByRole('button', { name: 'Submit Payment' }).click();
    await page.getByRole('checkbox', { name: 'I agree' }).check();
    await page.getByRole('button', { name: 'Confirm' }).click();
    await payment.returnToProfile();
    await member.dismissRentalAgreementModal();
  });

  test('No past due invoices after payment', async ({ page }) => {
    const auth    = new AuthPage(page);
    const member  = new MemberPage(page);
    const rentals = new MemberRentalsPage(page);

    await auth.signIn(basicMember.email, basicMember.password);
    await member.reloadProfile();
    await member.dismissRentalAgreementModal();
    await rentals.verifyNoPastDueInvoices();
  });
});
