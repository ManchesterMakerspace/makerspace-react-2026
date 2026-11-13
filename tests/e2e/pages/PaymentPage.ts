import { Page, expect } from '@playwright/test';
import { CreditCard } from '../fixtures/testData';

const FRAMES = {
  number:         'braintree-hosted-field-number',
  expirationDate: 'braintree-hosted-field-expirationDate',
  cvv:            'braintree-hosted-field-cvv',
  postalCode:     'braintree-hosted-field-postalCode',
  cardholderName: 'braintree-hosted-field-cardholderName',
};

export class PaymentPage {
  constructor(private page: Page) {}

  // ── Subscription creation flow ────────────────────────────────────────────

  async openCreditCardAccordion(): Promise<void> {
    // Wait for the payment methods list to finish loading before interacting.
    await this.page.waitForSelector('#payment-method-form', { state: 'hidden', timeout: 30_000 })
      .catch(() => {});
    await this.page.waitForSelector('#get-payment-methods', { state: 'hidden', timeout: 30_000 })
      .catch(() => {});
    // Click the radio directly — clicking the accordion button triggers MUI's
    // accordion toggle but doesn't reliably fire the RadioGroup onChange.
    // Clicking the radio fires RadioGroup onChange → paymentType = CreditCard
    // → accordion expands → Braintree hosted fields initialize.
    await this.page.getByRole('radio', { name: 'Debit or Credit Card' }).click();
    await this.page.waitForTimeout(3000);
  }

  async openAddNewPaymentMethod(): Promise<void> {
    await this.page.waitForSelector('#get-payment-methods', { state: 'hidden', timeout: 30_000 })
      .catch(() => {});
    await this.page.getByRole('button', { name: 'Add New Payment Method' }).click();
    await this.page.waitForTimeout(3000);
  }

  async waitForCreditCardForm(): Promise<void> {
    // Wait for the 'get-payment-methods' overlay to clear (checkout flow only).
    await this.page.waitForSelector('#get-payment-methods', { state: 'hidden', timeout: 30_000 })
      .catch(() => {}); // not present in all flows (e.g. signup)
    // Braintree hosted field iframes initialize asynchronously — 90s for sandbox.
    await this.page.waitForSelector(
      `iframe[name="${FRAMES.number}"]`,
      { state: 'visible', timeout: 90_000 }
    );
  }

  async saveCard(): Promise<void> {
    await this.page.getByRole('button', { name: 'Save Card' }).click();
    await this.page.waitForTimeout(1000);
  }

  // ── Shared CC form fill ───────────────────────────────────────────────────

  private async fillFrame(frameName: string, label: string, value: string): Promise<void> {
    const frame = this.page.frameLocator(`iframe[name="${frameName}"]`);
    const input = frame.getByRole('textbox', { name: label });
    await input.waitFor({ state: 'visible', timeout: 15_000 });
    await input.click();
    await input.fill(value);
  }

  async fillCreditCard(card: CreditCard): Promise<void> {
    await this.fillFrame(FRAMES.number,         'Credit Card Number', card.number);
    await this.fillFrame(FRAMES.expirationDate, 'Expiration Date',    card.expiration);
    await this.fillFrame(FRAMES.cvv,            'CVV',                card.csv);
    await this.fillFrame(FRAMES.cardholderName, 'Cardholder Name',    card.name);
    await this.fillFrame(FRAMES.postalCode,     'Postal Code',        card.postalCode);
  }

  // ── Dues payment flow ─────────────────────────────────────────────────────

  async selectSavedVisa(): Promise<void> {
    await this.page.getByRole('radio', { name: /visa/i }).first().check();
  }

  async paySelectedDues(): Promise<void> {
    await this.page.getByRole('button', { name: 'Pay Selected Dues' }).click();
  }

  async submitPayment(): Promise<void> {
    await this.page.getByRole('button', { name: 'Submit Payment' }).click();
  }

  async confirmPayment(): Promise<void> {
    await this.page.getByRole('button', { name: 'Confirm' }).click();
  }

  async confirmPaymentAndWaitForReceipt(): Promise<void> {
    // Register before clicking so fast responses cannot be missed. Match error
    // responses too, so a rejection fails here rather than as a receipt timeout.
    const [response] = await Promise.all([
      this.page.waitForResponse(response =>
        new URL(response.url()).pathname === '/api/billing/transactions' &&
        response.request().method() === 'POST', { timeout: 60_000 }),
      this.confirmPayment(),
    ]);
    expect(response.status(), 'Rental payment must succeed').toBe(200);
    const transaction = await response.json();
    expect(transaction.invoice?.id, 'Payment response must identify the paid invoice').toBeTruthy();
    await expect(this.page).toHaveURL(url =>
      url.pathname === `/checkout/receipt/${transaction.invoice.id}`, { timeout: 30_000 });
    await expect(this.page.getByRole('heading', { name: 'Thank you for your purchase!' }))
      .toBeVisible();
    await expect(this.page.getByRole('button', { name: 'Return to profile' })).toBeVisible();
  }

  async returnToProfile(): Promise<void> {
    const returnBtn = this.page.getByRole('button', { name: 'Return to profile' });
    await returnBtn.waitFor({ state: 'visible', timeout: 15_000 });
    await returnBtn.click();
    await this.page.waitForLoadState('networkidle', { timeout: 15_000 });
  }
}
