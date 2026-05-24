import { Page } from '@playwright/test';
import { TestMember } from '../fixtures/testData';

export class SignupPage {
  constructor(private page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/');
    // Wait for invoice option rows — not just the table shell
    await this.page.getByRole('cell', { name: 'One Month' })
      .waitFor({ timeout: 30_000 });
  }

  async selectMembershipOption(optionName: string = 'One Month'): Promise<void> {
    const row = this.page.getByRole('row', { name: new RegExp(optionName, 'i') });
    await row.waitFor({ timeout: 15_000 });
    await row.getByRole('button', { name: /sign up/i }).click();
  }

  async goNext(): Promise<void> {
    await this.page.click('#sign-up-next');
    await this.page.waitForTimeout(500);
  }

  async goBack(): Promise<void> {
    await this.page.click('#sign-up-back');
    await this.page.waitForTimeout(500);
  }

  async fillMemberInfo(member: TestMember): Promise<void> {
    await this.page.fill('#sign-up-form-firstname', member.firstname);
    await this.page.fill('#sign-up-form-lastname', member.lastname);
    await this.page.fill('#sign-up-form-email', member.email);
    await this.page.fill('#sign-up-form-confirmEmail', member.email);
    await this.page.fill('#sign-up-form-password', member.password);
    await this.page.fill('#sign-up-form-street', member.address.street);
    if (member.address.unit) {
      await this.page.fill('#sign-up-form-unit', member.address.unit);
    }
    await this.page.fill('#sign-up-form-city', member.address.city);
    await this.page.fill('#sign-up-form-postalCode', member.address.postalCode);
    // MUI Select for state
    await this.page.locator('#sign-up-form-state').click();
    await this.page.waitForSelector('[role="listbox"]');
    await this.page.locator(`[data-value="${member.address.state}"]`).click();
  }

  async acceptDocuments(): Promise<void> {
    // Wait for agreement form — documents are mocked so iframes load instantly
    await this.page.waitForSelector('#agreements-form', { timeout: 30_000 });
    await this.page.getByLabel(/Code of Conduct/i).check();
    await this.page.getByLabel(/Member Contract/i).check();
    await this.signCanvas();
  }

  async signCanvas(): Promise<void> {
    const canvas = this.page.locator('canvas').first();
    await canvas.waitFor({ state: 'visible', timeout: 10_000 });
    const box = await canvas.boundingBox();
    if (box) {
      await this.page.mouse.move(box.x + 20, box.y + 80);
      await this.page.mouse.down();
      await this.page.mouse.move(box.x + 200, box.y + 40);
      await this.page.mouse.move(box.x + 200, box.y + 120);
      await this.page.mouse.up();
    }
  }

  async acceptAuthAgreement(): Promise<void> {
    await this.page.waitForSelector('#authorization-agreement-checkbox', { timeout: 30_000 });
    await this.page.click('#authorization-agreement-checkbox');
  }
}
