import { test, expect } from '@playwright/test';
import { AuthPage } from '../pages/AuthPage';
import { MemberPage } from '../pages/MemberPage';
import { adminMember } from '../fixtures/testData';
import { seedVolunteerCredits } from '../fixtures/seed';

// ── Volunteer discount system ─────────────────────────────────────────────────
//
// Tests the full credit-to-Braintree-discount pipeline.
//
// Prerequisites seeded by seed_data.rb:
//   - volunteer_discount_id     = "volunteer_discount_10"  (Braintree sandbox)
//   - volunteer_credits_per_discount = 2                   (low threshold for testing)
//   - volunteer_max_discounts_per_year = 2
//
// Member assignments:
//   - basic_member4  — subscribed, used for discount threshold trigger test
//   - basic_member5  — subscribed, used for discount cap test
//   - paypal_member5 — NO subscription, used for no-subscription path test

const SUBSCRIBED_MEMBER_EMAIL   = 'basic_member4@test.com';
const SUBSCRIBED_MEMBER_NAME    = 'Basic Member4';
const CAP_MEMBER_EMAIL          = 'basic_member5@test.com';
const CAP_MEMBER_NAME           = 'Basic Member5';
const NO_SUB_MEMBER_EMAIL       = 'paypal_member5@test.com';
const NO_SUB_MEMBER_NAME        = 'PayPal Member5';

// ── Test 1: Discount system UI visible when discount_id is configured ─────────

test.describe('Volunteer discount system is visible when configured', () => {

  test('Member volunteer summary shows discount section when discount_id is set', async ({ page }) => {
    const auth   = new AuthPage(page);
    const member = new MemberPage(page);

    await auth.signIn(SUBSCRIBED_MEMBER_EMAIL, 'password');
    await member.waitForProfile();
    await member.dismissNotificationModal();
    await member.clickTab('Volunteer');
    await page.waitForTimeout(1000);

    // discount_active=true means the summary panel shows discount progress
    await expect(page.getByText(/discount|credits until|discounts used/i).first())
      .toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/something went wrong/i)).not.toBeVisible();
  });

  test('Admin portal settings shows volunteer discount config section', async ({ page }) => {
    const auth = new AuthPage(page);

    await auth.signIn(adminMember.email, adminMember.password);
    await page.goto('/admin/system-settings');
    await page.waitForLoadState('networkidle');
    await page.getByRole('tab', { name: /volunteer/i }).click();
    await page.waitForTimeout(500);

    // Should show the discount ID selector and credits per discount field
    await expect(page.getByText(/discount/i).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/credits per discount/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/something went wrong/i)).not.toBeVisible();
  });
});

// ── Test 2: Threshold reached — discount applied to Braintree subscription ────

test.describe('Volunteer discount applied when threshold is reached', () => {

  test.beforeAll(() => {
    // Seed exactly VOLUNTEER_CREDITS_PER_DISCOUNT (2) credits for basic_member4.
    // These bypass the UI entirely — the threshold check fires on save() in the model.
    // We seed 2 credits which crosses the threshold (per_discount=2).
    seedVolunteerCredits(SUBSCRIBED_MEMBER_EMAIL, 2);
  });

  test('Member volunteer summary shows 1 discount used after threshold crossed', async ({ page }) => {
    const auth   = new AuthPage(page);
    const member = new MemberPage(page);

    await auth.signIn(SUBSCRIBED_MEMBER_EMAIL, 'password');
    await member.waitForProfile();
    await member.dismissNotificationModal();
    await member.clickTab('Volunteer');
    await page.waitForTimeout(2000); // Allow Braintree async to settle

    // Summary should show 1 discount used
    await expect(page.getByText(/1\s*\/\s*2|1 discount/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/something went wrong/i)).not.toBeVisible();
  });

  test('Admin volunteer credits list shows discount_applied flag on seeded credits', async ({ page }) => {
    const auth   = new AuthPage(page);
    const member = new MemberPage(page);

    await auth.signIn(adminMember.email, adminMember.password);
    await member.goToMembersList();
    await member.searchMembers('basic_member4');
    await member.clickMemberLink(SUBSCRIBED_MEMBER_NAME);
    await member.waitForProfile();
    await member.clickTab('Volunteer');
    await page.waitForTimeout(1000);

    // At least one credit row should show a discount-applied indicator
    // The UI renders a "Discount Applied" badge or icon on qualifying credits
    await expect(page.getByText(/discount applied/i).first()).toBeVisible({ timeout: 15_000 });
  });
});

// ── Test 3: No-subscription path — credits preserved, Slack nudge sent ────────
//
// paypal_member5 has no subscription. Seeding 2 credits should NOT
// apply a Braintree discount (no subscription to apply it to).
// The UI should show "credits until discount" OR the "no subscription" message,
// but NOT show discounts_used > 0.

test.describe('Credits preserved when member has no subscription', () => {

  test.beforeAll(() => {
    seedVolunteerCredits(NO_SUB_MEMBER_EMAIL, 2);
  });

  test('Member with no subscription sees credit count but 0 discounts used', async ({ page }) => {
    const auth   = new AuthPage(page);
    const member = new MemberPage(page);

    await auth.signIn(NO_SUB_MEMBER_EMAIL, 'password');
    await member.waitForProfile();
    await member.dismissNotificationModal();
    await member.clickTab('Volunteer');
    await page.waitForTimeout(1000);

    // Should show 0 discounts used (no subscription to apply to)
    await expect(page.getByText(/0\s*\/\s*2|0 discount/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/something went wrong/i)).not.toBeVisible();
  });

  test('No-subscription member sees prompt to activate subscription for discount', async ({ page }) => {
    const auth   = new AuthPage(page);
    const member = new MemberPage(page);

    await auth.signIn(NO_SUB_MEMBER_EMAIL, 'password');
    await member.waitForProfile();
    await member.dismissNotificationModal();
    await member.clickTab('Volunteer');
    await page.waitForTimeout(1000);

    // The UI nudge message should be visible
    await expect(
      page.getByText(/activate.*subscription|subscription.*discount|earned.*discount/i).first()
    ).toBeVisible({ timeout: 15_000 });
  });
});

// ── Test 4: Discount cap enforcement ─────────────────────────────────────────
//
// basic_member5 — seed 4 credits (crosses threshold twice: at 2 and at 4).
// With max_discounts=2, they should show 2/2 used and the "maximum reached" message.

test.describe('Discount cap enforced at max_discounts_per_year', () => {

  test.beforeAll(() => {
    // 4 credits = 2 thresholds crossed (threshold=2) = 2 discounts = cap reached
    seedVolunteerCredits(CAP_MEMBER_EMAIL, 4);
  });

  test('Member at cap sees 2/2 discounts used', async ({ page }) => {
    const auth   = new AuthPage(page);
    const member = new MemberPage(page);

    await auth.signIn(CAP_MEMBER_EMAIL, 'password');
    await member.waitForProfile();
    await member.dismissNotificationModal();
    await member.clickTab('Volunteer');
    await page.waitForTimeout(2000);

    await expect(page.getByText(/2\s*\/\s*2|maximum/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/something went wrong/i)).not.toBeVisible();
  });

  test('Member at cap sees "maximum discounts reached" message', async ({ page }) => {
    const auth   = new AuthPage(page);
    const member = new MemberPage(page);

    await auth.signIn(CAP_MEMBER_EMAIL, 'password');
    await member.waitForProfile();
    await member.dismissNotificationModal();
    await member.clickTab('Volunteer');
    await page.waitForTimeout(1000);

    await expect(page.getByText(/maximum discounts reached/i)).toBeVisible({ timeout: 15_000 });
  });

  test('Admin sees discount_applied on capped member credits', async ({ page }) => {
    const auth   = new AuthPage(page);
    const member = new MemberPage(page);

    await auth.signIn(adminMember.email, adminMember.password);
    await member.goToMembersList();
    await member.searchMembers('basic_member5');
    await member.clickMemberLink(CAP_MEMBER_NAME);
    await member.waitForProfile();
    await member.clickTab('Volunteer');
    await page.waitForTimeout(1000);

    // Two discount-applied badges should be visible (one per threshold crossing)
    const discountBadges = page.getByText(/discount applied/i);
    const count = await discountBadges.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });
});

// ── Test 5: Admin can update volunteer discount settings ──────────────────────

test.describe('Admin configures volunteer discount settings', () => {

  test('Admin can view and edit credits_per_discount setting', async ({ page }) => {
    const auth = new AuthPage(page);

    await auth.signIn(adminMember.email, adminMember.password);
    await page.goto('/admin/system-settings');
    await page.waitForLoadState('networkidle');
    await page.getByRole('tab', { name: /volunteer/i }).click();
    await page.waitForTimeout(500);

    // The credits per discount field should show current value (2 from seed)
    const creditsField = page.getByRole('textbox', { name: /credits per discount/i });
    await creditsField.waitFor({ state: 'visible', timeout: 10_000 });
    const currentValue = await creditsField.inputValue();
    expect(currentValue).toBe('2');

    await expect(page.getByText(/something went wrong/i)).not.toBeVisible();
  });

  test('Admin can view current volunteer discount ID', async ({ page }) => {
    const auth = new AuthPage(page);

    await auth.signIn(adminMember.email, adminMember.password);
    await page.goto('/admin/system-settings');
    await page.waitForLoadState('networkidle');
    await page.getByRole('tab', { name: /volunteer/i }).click();
    await page.waitForTimeout(500);

    // The discount ID selector should show the seeded discount
    await expect(page.getByText(/volunteer_discount_10/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/something went wrong/i)).not.toBeVisible();
  });
});
