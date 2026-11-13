import { expect } from '@playwright/test';
import { test, TOTE_PLAN, uniqueRentalNames } from '../fixtures/rental';
import { AuthPage } from '../pages/AuthPage';
import { MemberPage } from '../pages/MemberPage';
import { PaymentPage } from '../pages/PaymentPage';
import { AdminRentalsPage } from '../pages/AdminRentalsPage';
import { MemberRentalsPage } from '../pages/MemberRentalsPage';
import { adminMember } from '../fixtures/testData';

const TOTE_LOCATION    = 'Classroom';
const TOTE_DESCRIPTION = 'Large Green Tote';

// ── Test 6: Admin creates rental type and spot ────────────────────────────────

test.describe('Admin creates rental type and spot', () => {

  test('Admin creates Green Tote type and rental spot', async ({ page }) => {
    const { typeName, spotNumber } = uniqueRentalNames();
    const auth    = new AuthPage(page);
    const rentals = new AdminRentalsPage(page);

    await auth.signIn(adminMember.email, adminMember.password);

    // Create rental type
    await rentals.goto();
    await rentals.goToTab('Rental Types');
    await rentals.waitForTypesTable();
    await rentals.clickAddType();
    await rentals.fillRentalTypeForm(typeName, TOTE_PLAN);
    await rentals.submitRentalTypeForm();
    await rentals.verifyTypeInTable(typeName);

    // Create rental spot
    await rentals.goToTab('Rental Spots');
    await rentals.waitForSpotsTable();
    await rentals.clickAddSpot();
    await rentals.fillRentalSpotForm({
      number:         spotNumber,
      location:       TOTE_LOCATION,
      rentalTypeName: typeName,
      description:    TOTE_DESCRIPTION,
    });
    await rentals.submitRentalSpotForm();

    // Search and verify
    await rentals.searchForSpot(spotNumber);
    await rentals.verifySpotInTable(spotNumber);
  });
});

// ── Test 7: Member self-assigns an independently provisioned rental spot ──────

test.describe('Member self-assigns rental spot', () => {

  test('Member self-assigns rental spot, signs agreement, pays invoice', async ({ page, rentalFixture }) => {
    const auth    = new AuthPage(page);
    const member  = new MemberPage(page);
    const rentals = new MemberRentalsPage(page);
    const payment = new PaymentPage(page);

    await auth.signIn(rentalFixture.email, rentalFixture.password);
    await member.gotoOwnProfile();
    await member.dismissNotificationModal();
    await member.dismissRentalAgreementModal();

    // Verify Rentals tab visible
    await expect(page.getByRole('tab', { name: /rentals/i })).toBeVisible();

    // Each attempt owns its spot and member, including any outstanding invoices.
    await member.clickTab('Rentals');
    await rentals.waitForRentalsTab();
    await expect(page.getByRole('combobox', { name: 'Select an Available Rental' })).toBeVisible();
    await rentals.selectSpot(rentalFixture.spotNumber);
    await expect(page.getByRole('button', { name: 'Confirm Rental' })).toBeVisible();

    // Confirm and sign agreement
    await rentals.confirmRental();
    await expect(page.getByRole('button', { name: 'Confirm & Sign Agreement' }))
      .toBeVisible({ timeout: 15_000 });
    await rentals.openSignAgreement();
    await rentals.acceptAndSignAgreement();
    await rentals.clickProceed();
    await member.waitForProfile();

    // Verify this attempt's spot in the rentals table
    await member.dismissRentalAgreementModal();
    await member.reloadProfile();
    await member.dismissRentalAgreementModal();
    await member.clickTab('Rentals');
    await rentals.verifyRentalInTable(rentalFixture.spotNumber);

    // Pay rental invoice from Dues tab
    await member.clickTab('Dues');
    await expect(page.getByRole('checkbox')).toHaveCount(1);
    await rentals.selectDuesInvoice();
    await payment.paySelectedDues();

    // Step 1: Select payment method
    await payment.selectSavedVisa();
    await page.getByRole('button', { name: 'Next' }).click();

    // Step 2: Review and confirm
    await page.getByRole('button', { name: 'Submit Payment' }).click();
    await page.getByRole('checkbox', { name: 'I agree' }).check();
    await payment.confirmPaymentAndWaitForReceipt();
    await payment.returnToProfile();
    await member.dismissRentalAgreementModal();

    // Verify no past due invoices
    await member.reloadProfile();
    await rentals.verifyNoPastDueInvoices();
  });
});
