import { Page, expect } from '@playwright/test';

export class FixTicketsPage {
  constructor(private page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/fix-tickets');
    await this.page.getByRole('heading', { name: 'Fix tickets' }).waitFor({ state: 'visible', timeout: 15_000 });
  }

  // ── Report a problem ──────────────────────────────────────────────────────

  async reportProblem(opts: {
    title: string;
    description: string;
    category?: string; // Damaged | Broken | Missing | Donation offer | Other
    shop?: string;
    tool?: string;
    uncataloguedTool?: string;
    showIdentity?: boolean;
    iBrokeIt?: boolean;
    iCanFixIt?: boolean;
    publicReadOnly?: boolean;
  }): Promise<void> {
    await this.page.getByRole('button', { name: 'Report a problem' }).click();
    const dialog = this.page.getByRole('dialog');
    await dialog.waitFor({ state: 'visible', timeout: 10_000 });
    await this.page.getByRole('textbox', { name: 'Title' }).fill(opts.title);
    await this.page.getByRole('textbox', { name: 'Description' }).fill(opts.description);
    if (opts.category) {
      await this.page.getByRole('radio', { name: opts.category }).check();
    }
    if (opts.showIdentity) {
      await this.page.getByRole('checkbox', { name: 'Show my identity' }).check();
    }
    if (opts.shop) {
      await this.selectMuiOption('Shop (optional)', opts.shop);
    }
    if (opts.tool) {
      await this.selectMuiOption('Tool (optional)', opts.tool);
    } else if (opts.uncataloguedTool) {
      await this.page.getByRole('textbox', { name: 'Uncatalogued tool name (optional)' }).fill(opts.uncataloguedTool);
    }
    if (opts.iBrokeIt) {
      await this.page.getByRole('checkbox', { name: 'I broke it' }).check();
    }
    if (opts.iCanFixIt) {
      await this.page.getByRole('checkbox', { name: 'I can fix it!' }).check();
    }
    if (opts.publicReadOnly) {
      await this.page.getByRole('checkbox', { name: /Public \(read-only\)/ }).check();
    }
    await this.page.getByRole('button', { name: 'Submit report' }).click();
    await expect(this.page.getByText('Report submitted.')).toBeVisible({ timeout: 10_000 });
  }

  // ── Navigation ────────────────────────────────────────────────────────────

  async openTicketByTitle(title: string): Promise<void> {
    // The dev-environment watermark banner is fixed at the top of the
    // viewport and can overlap table rows while Playwright scrolls to bring
    // the link into view, which otherwise causes an endless scroll/retry
    // loop rather than a clean timeout. force: true skips that check --
    // the target element itself is still correctly resolved.
    await this.page.getByRole('link', { name: title, exact: true }).click({ force: true });
    await this.page.getByRole('heading', { name: 'Fix ticket' }).waitFor({ state: 'visible', timeout: 10_000 });
  }

  // ── Ticket detail actions ─────────────────────────────────────────────────

  async addNote(note: string): Promise<void> {
    await this.page.getByRole('button', { name: 'Add note' }).click();
    const dialog = this.page.getByRole('dialog');
    await dialog.waitFor({ state: 'visible', timeout: 10_000 });
    await this.page.getByRole('textbox', { name: 'Note' }).fill(note);
    await this.confirmDialog();
  }

  async changeStatus(opts: { status?: string; confirmation?: string; note?: string } = {}): Promise<void> {
    await this.page.getByRole('button', { name: 'Change status' }).click();
    const dialog = this.page.getByRole('dialog');
    await dialog.waitFor({ state: 'visible', timeout: 10_000 });
    if (opts.status) await this.selectMuiOption('Status', opts.status);
    if (opts.confirmation) await this.selectMuiOption('Confirmation', opts.confirmation);
    if (opts.note) {
      await this.page.getByRole('textbox', { name: /^Note/ }).fill(opts.note);
    }
    await this.confirmDialog();
  }

  async markOutOfService(): Promise<void> {
    await this.page.getByRole('button', { name: 'Mark out of service' }).click();
    const dialog = this.page.getByRole('dialog');
    await dialog.waitFor({ state: 'visible', timeout: 10_000 });
    await this.confirmDialog();
  }

  async makeBounty(opts: { title: string; description: string; creditValue?: number }): Promise<void> {
    await this.page.getByRole('button', { name: 'Make this a bounty' }).click();
    const dialog = this.page.getByRole('dialog');
    await dialog.waitFor({ state: 'visible', timeout: 10_000 });
    await this.page.getByRole('textbox', { name: 'Bounty title' }).fill(opts.title);
    await this.page.getByRole('textbox', { name: 'Public bounty description' }).fill(opts.description);
    if (opts.creditValue !== undefined) {
      await this.page.getByRole('spinbutton', { name: 'Volunteer points' }).fill(String(opts.creditValue));
    }
    await this.confirmDialog();
  }

  async revealReporter(): Promise<string> {
    await this.page.getByRole('button', { name: 'Reveal reporter' }).click();
    const dialog = this.page.getByRole('dialog');
    await dialog.waitFor({ state: 'visible', timeout: 10_000 });
    await this.confirmDialog();
    const alert = this.page.getByText(/^Reporter: /);
    await expect(alert).toBeVisible({ timeout: 10_000 });
    return (await alert.textContent()) ?? '';
  }

  async bountyLink() {
    return this.page.getByRole('link', { name: 'View volunteer bounty' });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private async confirmDialog(): Promise<void> {
    await this.page.getByRole('dialog').getByRole('button', { name: 'Confirm' }).click();
    await expect(this.page.getByRole('dialog')).not.toBeVisible({ timeout: 10_000 });
  }

  // FixTicketsPage's SelectField renders a plain (non-native) MUI TextField
  // select -- click to open, then click the option, unlike the native
  // <select> elements used elsewhere (e.g. AdminToolCheckoutsPage).
  //
  // getByLabel(label) alone can match the dialog itself when the dialog's
  // aria-labelledby happens to also contain the label text (e.g. a "Status"
  // field inside a dialog titled "Change status"), so scope to the actual
  // combobox role.
  private async selectMuiOption(label: string, optionText: string): Promise<void> {
    await this.page.getByRole('combobox', { name: label, exact: true }).click();
    await this.page.getByRole('option', { name: optionText, exact: true }).click();
  }
}
