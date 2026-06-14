import { test, expect } from '@playwright/test';
import { AuthPage } from '../pages/AuthPage';
import { MemberPage } from '../pages/MemberPage';
import { PaymentPage } from '../pages/PaymentPage';
import { SettingsPage } from '../pages/SettingsPage';
import { adminMember, basicMember, expiredMember, newVisa, newMastercard } from '../fixtures/testData';

// ── Test 1: Admin manually renews a member ────────────────────────────────────
//
// Uses expired_member0 — a seeded member with a past expiration date.
// Admin opens edit form, selects 1 month renewal, saves.
// Verifies expiration date advances and member status becomes Active.

test.describe('Admin manually renews expired member', () => {
  const TARGET_EMAIL = expiredMember.email;
  const TARGET_NAME  = 'Expired Member0';

  test('Admin finds expired member and renews for 1 month', async ({ page }) => {
    const auth   = new AuthPage(page);
    const member = new MemberPage(page);

    await auth.signIn(adminMember.email, adminMember.password);
    await member.goToMembersList();
    await member.searchMembers('expired_member0');
    await member.clickMemberLink(TARGET_NAME);
    await member.waitForProfile();

    // Capture current expiration before renewal
    const beforeExpiration = await member.getExpiration();

    // Click the dedicated Renew button (id="members-list-renew") — separate from Edit
    await page.locator('#members-list-renew').click();
    await page.waitForSelector('[role="dialog"]', { timeout: 10_000 });

    // Native select id="renewal-term", option value is the number of months
    await page.locator('#renewal-term').selectOption('1');

    // Submit button id is "renewal-form-submit"
    await page.locator('#renewal-form-submit').click();
    await page.waitForSelector('[role="dialog"]', { state: 'hidden', timeout: 15_000 });
    await member.reloadProfile();

    // Expiration should have advanced
    const afterExpiration = await member.getExpiration();
    expect(afterExpiration).not.toEqual(beforeExpiration);
    expect(afterExpiration).toMatch(/\d{1,2}\s+\w+\s+\d{4}/);
  });

  test('Member status shows Active after admin renewal', async ({ page }) => {
    const auth   = new AuthPage(page);
    const member = new MemberPage(page);

    await auth.signIn(adminMember.email, adminMember.password);
    await member.goToMembersList();
    await member.searchMembers('expired_member0');
    await member.clickMemberLink(TARGET_NAME);
    await member.waitForProfile();

    await member.verifyMembershipStatus('Active');
  });
});

// ── Test 2: Admin revokes a member ────────────────────────────────────────────
//
// Uses basic_member4 — a seeded active member not used by other test suites.
// Admin sets status to revoked. Verifies profile shows Revoked.
// Verifies that member can no longer sign in.

test.describe('Admin revokes a member', () => {
  const TARGET_EMAIL = 'basic_member4@test.com';
  const TARGET_NAME  = 'Basic Member4';

  test('Admin sets member status to revoked', async ({ page }) => {
    const auth   = new AuthPage(page);
    const member = new MemberPage(page);

    await auth.signIn(adminMember.email, adminMember.password);
    await member.goToMembersList();
    await member.searchMembers('basic_member4');
    await member.clickMemberLink(TARGET_NAME);
    await member.waitForProfile();

    await page.locator('#member-detail-open-edit-modal').click();
    await page.waitForSelector('[role="dialog"]', { timeout: 10_000 });

    // Status is a native <Select> with name="member-form-status" — not a labelled combobox
    const statusSelect = page.locator('select[name="member-form-status"]');
    await statusSelect.waitFor({ state: 'visible', timeout: 10_000 });
    await statusSelect.selectOption('revoked');

    await page.getByRole('button', { name: 'Save' }).click();
    await page.waitForSelector('[role="dialog"]', { state: 'hidden', timeout: 15_000 });
    await member.reloadProfile();

    await member.verifyMembershipStatus('Revoked');
  });

  test('Revoked member cannot sign in', async ({ page }) => {
    await page.goto('/login');
    const emailField = page.getByRole('textbox', { name: 'Email' });
    await emailField.waitFor({ state: 'visible', timeout: 15_000 });
    await emailField.fill(TARGET_EMAIL);
    await page.getByRole('textbox', { name: 'Password' }).fill('password');
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Should stay on login page — not redirect to /members/
    await page.waitForTimeout(3000);
    expect(page.url()).not.toMatch(/\/members\//);

    // Devise error message for revoked: "Login failed, email board@manchestermakerspace.org with error code R2026"
    await expect(page.getByText(/login failed|error code R2026/i).first())
      .toBeVisible({ timeout: 10_000 });
  });
});

// ── Test 3: Member updates their own profile ──────────────────────────────────
//
// Uses basic_member2 — a clean seeded member not used by other suites.
// Member edits their own phone number and address, saves, reloads, and verifies.

test.describe('Member self-service profile update', () => {
  const MEMBER_EMAIL = 'basic_member2@test.com';
  const NEW_PHONE    = '6175551234';
  const NEW_STREET   = '99 Elm Street';
  const NEW_CITY     = 'Manchester';
  const NEW_POSTAL   = '03101';

  test('Member edits phone and address on their profile', async ({ page }) => {
    const auth     = new AuthPage(page);
    const member   = new MemberPage(page);
    const settings = new SettingsPage(page);

    await auth.signIn(MEMBER_EMAIL, 'password');
    await member.waitForProfile();
    await member.dismissNotificationModal();

    // Member self-service edit is via Account Settings → Personal Information
    // (the admin Edit modal is not shown on own profile for non-admin members)
    await settings.goto();
    // Personal Information tab is selected by default (index 0)
    await page.locator('#settings-profile').click();
    await page.waitForTimeout(500);

    // Form renders inline (formOnly=true) — no dialog, fields directly on page
    const phoneField = page.getByRole('textbox', { name: /phone/i });
    await phoneField.waitFor({ state: 'visible', timeout: 10_000 });
    await phoneField.clear();
    await phoneField.fill(NEW_PHONE);

    const streetField = page.getByRole('textbox', { name: /street/i });
    await streetField.clear();
    await streetField.fill(NEW_STREET);

    const cityField = page.getByRole('textbox', { name: /city/i });
    await cityField.clear();
    await cityField.fill(NEW_CITY);

    const postalField = page.getByRole('textbox', { name: /postal/i });
    await postalField.clear();
    await postalField.fill(NEW_POSTAL);

    // Submit button id="member-form-submit" (no dialog to wait for)
    await page.locator('#member-form-submit').click();
    await page.waitForTimeout(2000);

    // Verify by reloading settings and checking the form fields still have the values
    // (phone/address are not displayed on the member profile page, only in Account Settings)
    await settings.goto();
    await page.locator('#settings-profile').click();
    await page.waitForTimeout(500);

    await expect(page.getByRole('textbox', { name: /phone/i })).toHaveValue(NEW_PHONE, { timeout: 10_000 });
    await expect(page.getByRole('textbox', { name: /street/i })).toHaveValue(NEW_STREET, { timeout: 10_000 });
  });
});

// ── Test 4: Member changes their own password ─────────────────────────────────
//
// Uses paypal_member3 — a clean seeded member not used by other suites.
// Member changes password via Account Settings, logs out, logs back in with new password.
// Restores original password at the end so the member is reusable.

test.describe('Member self-service password change', () => {
  const MEMBER_EMAIL    = 'paypal_member3@test.com';
  const ORIGINAL_PASS   = 'password';
  const NEW_PASS        = 'newPassword123';

  test('Member changes password and can sign in with new password', async ({ page }) => {
    const auth     = new AuthPage(page);
    const settings = new SettingsPage(page);

    // Sign in and navigate to Account Settings
    await auth.signIn(MEMBER_EMAIL, ORIGINAL_PASS);
    await page.waitForURL(/\/members\//, { timeout: 15_000 });
    // Dismiss any notification modal before navigating to settings
    const notifModal = page.locator('#notification-modal-submit');
    if (await notifModal.isVisible({ timeout: 3_000 })) {
      await notifModal.click();
      await notifModal.waitFor({ state: 'hidden', timeout: 5_000 });
    }
    await settings.goto();

    // Navigate to Security tab (id="settings-security") — contains password change form
    await page.locator('#settings-security').click();
    await page.waitForTimeout(500);

    // Fill new password form — use exact labels to avoid strict mode violation
    // (both fields match /new password/i since "Confirm New Password" contains "New Password")
    const newPassField = page.getByRole('textbox', { name: 'New Password', exact: true });
    await newPassField.waitFor({ state: 'visible', timeout: 10_000 });
    await newPassField.fill(NEW_PASS);

    const confirmField = page.getByRole('textbox', { name: 'Confirm New Password', exact: true });
    await confirmField.waitFor({ state: 'visible', timeout: 10_000 });
    await confirmField.fill(NEW_PASS);

    await page.locator('#change-password-submit').click();
    await page.waitForTimeout(2000);

    // Sign out
    await auth.logout();

    // Sign in with new password
    await auth.signIn(MEMBER_EMAIL, NEW_PASS);
    await expect(page.getByRole('button', { name: 'Menu' })).toBeVisible({ timeout: 15_000 });

    // Restore original password so subsequent runs don't fail
    await settings.goto();
    await page.locator('#settings-security').click();
    await page.waitForTimeout(500);
    const restoreField = page.getByRole('textbox', { name: 'New Password', exact: true });
    await restoreField.waitFor({ state: 'visible', timeout: 10_000 });
    await restoreField.fill(ORIGINAL_PASS);
    const restoreConfirm = page.getByRole('textbox', { name: 'Confirm New Password', exact: true });
    await restoreConfirm.fill(ORIGINAL_PASS);
    await page.locator('#change-password-submit').click();
    await page.waitForTimeout(1000);
  });
});

// ── Test 5: Member adds and removes a payment method ─────────────────────────
//
// Uses paypal_member4 — a seeded Braintree customer with no saved cards.
// Member adds a Visa, verifies it appears, then removes it, verifies it's gone.

test.describe('Member payment method management', () => {
  const MEMBER_EMAIL = 'paypal_member4@test.com';

  test('Member adds a credit card', async ({ page }) => {
    const auth     = new AuthPage(page);
    const settings = new SettingsPage(page);
    const payment  = new PaymentPage(page);

    await auth.signIn(MEMBER_EMAIL, 'password');
    await settings.goto();

    // Navigate to Payment Methods tab using its known id
    await page.locator('#settings-payment-methods').click();
    await page.waitForTimeout(500);

    // Add new card
    await page.locator('#add-payment-button').click();
    await payment.waitForCreditCardForm();
    await payment.fillCreditCard(newVisa);
    await page.getByRole('button', { name: /save|add/i }).click();
    await page.waitForTimeout(2000);

    // Visa should now appear in the list
    await expect(page.getByText(/visa/i)).toBeVisible({ timeout: 15_000 });
  });

  test('Member removes their credit card', async ({ page }) => {
    const auth     = new AuthPage(page);
    const settings = new SettingsPage(page);

    await auth.signIn(MEMBER_EMAIL, 'password');
    await settings.goto();

    // Navigate to Payment Methods tab using its known id
    await page.locator('#settings-payment-methods').click();
    await page.waitForTimeout(500);

    // Must select a payment method (radio) before Delete is enabled
    const radioGroup = page.locator('[name="paymentMethodSelection"]');
    await radioGroup.waitFor({ state: 'visible', timeout: 10_000 });
    await page.locator('[name="paymentMethodSelection"]').first().check();
    await page.waitForTimeout(300);

    // Delete button id="delete-payment-button"
    await page.locator('#delete-payment-button').click();

    // Confirm deletion — modal submit button text is "Delete", id pattern = "delete-payment-method-confirm-submit"
    await page.waitForSelector('[role="dialog"]', { timeout: 10_000 });
    await page.locator('#delete-payment-method-confirm-submit').click();
    await page.waitForSelector('[role="dialog"]', { state: 'hidden', timeout: 15_000 });
    await page.waitForTimeout(2000);

    // Empty state renders Typography id="none-found"
    await expect(page.locator('#none-found')).toBeVisible({ timeout: 10_000 });

    // Add button should be visible in empty state
    await expect(page.locator('#add-payment-button')).toBeVisible({ timeout: 5_000 });
  });
});
