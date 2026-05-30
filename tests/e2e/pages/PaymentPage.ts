import { Page } from '@playwright/test';
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

  async returnToProfile(): Promise<void> {
    const returnBtn = this.page.getByRole('button', { name: 'Return to profile' });
    await returnBtn.waitFor({ state: 'visible', timeout: 15_000 });
    await returnBtn.click();
    await this.page.waitForLoadState('networkidle', { timeout: 15_000 });
  }
}
