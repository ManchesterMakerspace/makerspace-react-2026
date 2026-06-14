import { test, expect } from '@playwright/test';
import { AuthPage } from '../pages/AuthPage';
import { MemberPage } from '../pages/MemberPage';
import { AdminRentalsPage } from '../pages/AdminRentalsPage';
import { MemberRentalsPage } from '../pages/MemberRentalsPage';
import { adminMember } from '../fixtures/testData';

// ── Shared constants ──────────────────────────────────────────────────────────

// Uses basic_member6 / GT2 spot — dedicated to this suite, not shared with rentals.spec.ts
const APPROVAL_SPOT    = 'GT2';
const APPROVAL_TYPE    = 'Approval Tote';
const APPROVAL_PLAN    = 'Monthly Tote Rental';
const APPROVE_MEMBER   = 'basic_member6@test.com';
const DENY_MEMBER      = 'basic_member7@test.com';
const CANCEL_MEMBER    = 'basic_member8@test.com';

// ── Setup: admin creates a rental type + spot that requires approval ──────────

test.describe('Admin creates approval-required rental infrastructure', () => {

  test('Admin creates Approval Tote type and GT2 spot requiring approval', async ({ page }) => {
    const auth    = new AuthPage(page);
    const rentals = new AdminRentalsPage(page);

    await auth.signIn(adminMember.email, adminMember.password);
    await rentals.goto();

    await rentals.goToTab('Rental Types');
    await rentals.waitForTypesTable();
    await rentals.clickAddType();
    await rentals.fillRentalTypeForm(APPROVAL_TYPE, APPROVAL_PLAN);
    await rentals.submitRentalTypeForm();
    await rentals.verifyTypeInTable(APPROVAL_TYPE);

    await rentals.goToTab('Rental Spots');
    await rentals.waitForSpotsTable();
    await rentals.clickAddSpot();

    const dialog = page.locator('[role="dialog"]');
    await dialog.getByRole('textbox').nth(0).fill(APPROVAL_SPOT);
    await dialog.getByRole('textbox').nth(1).fill('Storage Room');
    await dialog.getByLabel('Rental Type').click();
    await page.waitForSelector('[role="listbox"]', { timeout: 10_000 });
    await page.getByRole('option', { name: APPROVAL_TYPE, exact: true }).click();
    await page.waitForSelector('[role="listbox"]', { state: 'hidden', timeout: 5_000 });
    await dialog.getByLabel('Description').fill('Approval tote for testing');
    // Check "Requires Approval"
    await dialog.getByRole('switch', { name: /requires admin approval/i }).click();
    await rentals.submitRentalSpotForm();

    await rentals.searchForSpot(APPROVAL_SPOT);
    await rentals.verifySpotInTable(APPROVAL_SPOT);
  });
});

// ── Test: Member requests approval rental, admin approves ─────────────────────

test.describe('Admin approves a rental request', () => {

  test('Member requests GT2 spot and admin approves it', async ({ page }) => {
    const auth    = new AuthPage(page);
    const member  = new MemberPage(page);
    const rentals = new MemberRentalsPage(page);

    // Member requests spot
    await auth.signIn(APPROVE_MEMBER, 'password');
    await member.waitForProfile();
    await member.dismissNotificationModal();
    await member.dismissRentalAgreementModal();
    await member.clickTab('Rentals');
    await rentals.waitForRentalsTab();
    await rentals.selectSpot(APPROVAL_SPOT);
    await rentals.requestRental();
    await page.waitForTimeout(1000);

    // Log out
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('menuitem', { name: 'Logout' }).click();
    await page.waitForURL(/\/$|\/login/, { timeout: 15_000 });

    // Admin approves
    const adminAuth    = new AuthPage(page);
    const adminRentals = new AdminRentalsPage(page);
    await adminAuth.signIn(adminMember.email, adminMember.password);
    await adminRentals.goto();
    await adminRentals.goToTab('Rental Requests');
    await page.waitForTimeout(1000);

    // Find the row for this member and approve
    const requestRow = page.getByRole('row').filter({ hasText: /Basic Member6/i }).first();
    await requestRow.waitFor({ state: 'visible', timeout: 15_000 });
    await requestRow.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Approve' }).click();
    await page.waitForTimeout(2000);

    // Row should be gone from requests tab
    await expect(page.getByRole('row').filter({ hasText: /Basic Member6/i }))
      .not.toBeVisible({ timeout: 10_000 });
  });

  test('Rental appears in Current Rentals after approval', async ({ page }) => {
    const auth    = new AuthPage(page);
    const rentals = new AdminRentalsPage(page);

    await auth.signIn(adminMember.email, adminMember.password);
    await rentals.goto();
    await rentals.goToTab('Current Rentals');
    await page.waitForTimeout(1000);

    await expect(page.getByRole('row').filter({ hasText: /Basic Member6/i }).first())
      .toBeVisible({ timeout: 15_000 });
  });
});

// ── Test: Member requests approval rental, admin denies ──────────────────────

test.describe('Admin denies a rental request', () => {

  test('Member requests GT2 spot and admin denies it', async ({ page }) => {
    const auth    = new AuthPage(page);
    const member  = new MemberPage(page);
    const rentals = new MemberRentalsPage(page);

    // Member requests spot
    await auth.signIn(DENY_MEMBER, 'password');
    await member.waitForProfile();
    await member.dismissNotificationModal();
    await member.dismissRentalAgreementModal();
    await member.clickTab('Rentals');
    await rentals.waitForRentalsTab();
    await rentals.selectSpot(APPROVAL_SPOT);
    await rentals.requestRental();
    await page.waitForTimeout(1000);

    // Log out
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('menuitem', { name: 'Logout' }).click();
    await page.waitForURL(/\/$|\/login/, { timeout: 15_000 });

    // Admin denies
    const adminAuth    = new AuthPage(page);
    const adminRentals = new AdminRentalsPage(page);
    await adminAuth.signIn(adminMember.email, adminMember.password);
    await adminRentals.goto();
    await adminRentals.goToTab('Rental Requests');
    await page.waitForTimeout(1000);

    const requestRow = page.getByRole('row').filter({ hasText: /Basic Member7/i }).first();
    await requestRow.waitFor({ state: 'visible', timeout: 15_000 });
    await requestRow.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Deny' }).click();
    await page.waitForTimeout(2000);

    await expect(page.getByRole('row').filter({ hasText: /Basic Member7/i }))
      .not.toBeVisible({ timeout: 10_000 });
  });
});

// ── Test: Member cancels their own rental ─────────────────────────────────────

test.describe('Member cancels their rental', () => {

  test('Member self-assigns GT1 spot then cancels it', async ({ page }) => {
    const auth    = new AuthPage(page);
    const member  = new MemberPage(page);
    const rentals = new MemberRentalsPage(page);

    await auth.signIn(CANCEL_MEMBER, 'password');
    await member.waitForProfile();
    await member.dismissNotificationModal();
    await member.dismissRentalAgreementModal();
    await member.clickTab('Rentals');
    await rentals.waitForRentalsTab();

    // Claim the non-approval spot
    await rentals.selectSpot('GT1');
    await rentals.confirmRental();
    await page.waitForTimeout(1000);

    // Sign agreement if shown
    const signBtn = page.getByRole('button', { name: 'Confirm & Sign Agreement' });
    if (await signBtn.isVisible({ timeout: 5_000 })) {
      await rentals.openSignAgreement();
      await rentals.acceptAndSignAgreement();
      await rentals.clickProceed();
      await member.waitForProfile();
      await member.dismissRentalAgreementModal();
    }

    await member.reloadProfile();
    await member.dismissRentalAgreementModal();
    await member.clickTab('Rentals');
    await rentals.verifyRentalInTable('GT1');

    // Cancel rental
    const rentalRow = page.getByRole('row').filter({ hasText: /GT1/ }).first();
    await rentalRow.waitFor({ state: 'visible', timeout: 10_000 });
    await rentalRow.getByRole('button', { name: /cancel/i }).click();
    await page.waitForTimeout(500);

    // Confirm if dialog appears
    const confirmBtn = page.getByRole('button', { name: /confirm|yes|cancel rental/i });
    if (await confirmBtn.isVisible({ timeout: 3_000 })) {
      await confirmBtn.click();
    }

    await page.waitForTimeout(2000);
    await member.reloadProfile();
    await member.clickTab('Rentals');

    // GT1 should no longer be listed as an active rental
    await expect(page.getByRole('row').filter({ hasText: /GT1/ })
      .filter({ hasText: /active/i }))
      .not.toBeVisible({ timeout: 10_000 });
  });
});
