import { test, expect } from '@playwright/test';
import { AuthPage } from '../pages/AuthPage';
import { MemberPage } from '../pages/MemberPage';
import { PaymentPage } from '../pages/PaymentPage';
import { adminMember } from '../fixtures/testData';

const FEE_MEMBER_EMAIL = 'basic_member3@test.com';
const FEE_MEMBER_NAME  = 'Basic Member3';
const FEE_ITEM_NAME    = 'tool';
const FEE_DESCRIPTION  = 'tool damage charge';
const FEE_AMOUNT       = '75';

// ── Shop fee lifecycle ────────────────────────────────────────────────────────

test.describe('Shop fee lifecycle', () => {

  test('Admin creates shop fee, member pays, payment history shows Pending', async ({ page }) => {
    const auth    = new AuthPage(page);
    const member  = new MemberPage(page);
    const payment = new PaymentPage(page);

    // ── Admin creates shop fee ──
    await auth.signIn(adminMember.email, adminMember.password);
    await member.goToMembersList();
    await member.searchMembers('basic member3');
    await member.clickMemberLink(FEE_MEMBER_NAME);

    await page.getByRole('button', { name: 'Shop Fee' }).click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    await page.getByRole('textbox', { name: 'Item Name' }).fill(FEE_ITEM_NAME);
    await page.getByRole('textbox', { name: 'Description (optional)' }).fill(FEE_DESCRIPTION);
    await page.getByRole('spinbutton').first().fill(FEE_AMOUNT);

    await page.getByRole('button', { name: 'Generate Invoice' }).click();
    await page.waitForSelector('[role="dialog"]', { timeout: 10_000 });
    await page.getByRole('button', { name: 'Send Invoice' }).click();
    await page.waitForTimeout(1000);

    // ── Admin logs out ──
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('menuitem', { name: 'Logout' }).click();

    // ── Member logs in and pays the invoice ──
    await auth.signIn(FEE_MEMBER_EMAIL, 'password');
    await member.waitForProfile();
    await member.dismissNotificationModal();

    // Select the shop fee invoice
    await member.clickTab('Dues');
    await page.waitForTimeout(1000);

    // Select first available invoice checkbox
    const invoiceCheckbox = page.locator('table input[type="checkbox"]').first();
    await invoiceCheckbox.check();

    await payment.paySelectedDues();
    await payment.selectSavedVisa();
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('button', { name: 'Submit Payment' }).click();
    await payment.returnToProfile();

    // ── Verify Payment History shows $75.00 as Pending ──
    await member.clickTab('Payment History');
    await expect(page.getByRole('cell', { name: '$75.00' }).first())
      .toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('cell', { name: 'Pending' }).first())
      .toBeVisible({ timeout: 15_000 });
  });
});
