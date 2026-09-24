import { test, expect } from '@playwright/test';
import { AuthPage } from '../pages/AuthPage';
import { FixTicketsPage } from '../pages/FixTicketsPage';
import { AdminToolCheckoutsPage } from '../pages/AdminToolCheckoutsPage';
import { adminMember, basicMember, basicMember1 } from '../fixtures/testData';

const RUN_ID = Date.now();
const SHOP = `fixticketshop${RUN_ID}`;
const TOOL = `fixtickettool${RUN_ID}`;

// ── Test 1: Member reports a problem ──────────────────────────────────────────
//
// Also a direct regression test for a real bug found via live testing: the
// catalog endpoint 500ed whenever every ticket in scope had an empty
// assignee_ids array (distinct(:assignee_ids) returning [BSON::Undefined]
// instead of [] against a fresh/lightly-used environment). Loading the
// ticket list right after creating the very first ticket exercises exactly
// that path.

test.describe('Member reports a problem', () => {
  test('Basic Member0 reports an uncatalogued broken item', async ({ page }) => {
    const auth = new AuthPage(page);
    const tickets = new FixTicketsPage(page);
    await auth.signIn(basicMember.email, basicMember.password);
    await tickets.goto();

    const title = `E2E broken widget ${RUN_ID}`;
    await tickets.reportProblem({
      title,
      description: 'Stopped working during E2E testing.',
      category: 'Broken',
      uncataloguedTool: 'Widget',
    });

    await tickets.goto();
    await expect(page.getByRole('link', { name: title, exact: true })).toBeVisible({ timeout: 10_000 });
  });
});

// ── Test 2: Staff manages the ticket lifecycle ────────────────────────────────

test.describe('Staff manages a ticket', () => {
  test('Admin adds a note and resolves it', async ({ page }) => {
    const auth = new AuthPage(page);
    const tickets = new FixTicketsPage(page);
    await auth.signIn(adminMember.email, adminMember.password);
    await tickets.goto();

    const title = `E2E note-and-resolve ${RUN_ID}`;
    await tickets.reportProblem({ title, description: 'Needs a note then resolution.', category: 'Other' });
    await tickets.goto();
    await tickets.openTicketByTitle(title);

    await tickets.addNote('Looked into this, ordering a replacement part.');
    await expect(page.getByText('Looked into this, ordering a replacement part.')).toBeVisible({ timeout: 10_000 });

    await tickets.changeStatus({ status: 'Resolved', note: 'Replacement part installed and tested.' });
    await expect(page.getByText('Resolved', { exact: true }).first()).toBeVisible({ timeout: 10_000 });
  });
});

// ── Test 3: Reporter anonymity ────────────────────────────────────────────────

test.describe('Reporter anonymity', () => {
  test('Identity is hidden from other members but revealable by admin', async ({ page }) => {
    const auth = new AuthPage(page);
    const tickets = new FixTicketsPage(page);

    await auth.signIn(basicMember.email, basicMember.password);
    await tickets.goto();
    const title = `E2E anonymity check ${RUN_ID}`;
    await tickets.reportProblem({
      title,
      description: 'Checking anonymity defaults.',
      category: 'Other',
      publicReadOnly: true,
    });

    await auth.signIn(basicMember1.email, basicMember1.password);
    await tickets.goto();
    await tickets.openTicketByTitle(title);
    await expect(page.getByText('Submitter:')).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Reveal reporter' })).not.toBeVisible();

    await auth.signIn(adminMember.email, adminMember.password);
    await tickets.goto();
    await tickets.openTicketByTitle(title);
    const revealed = await tickets.revealReporter();
    expect(revealed).toContain('Reporter:');
  });
});

// ── Test 4: Out-of-service ties into the checkout/reservation system ─────────
//
// Uses a dedicated shop/tool (not shared seed data) so marking it out of
// service here can't leak state into other suites.

test.describe('Marking a ticket tool out of service', () => {
  test('Admin sets up a shop/tool, then marks it out of service from a ticket', async ({ page }) => {
    const auth = new AuthPage(page);
    const checkouts = new AdminToolCheckoutsPage(page);
    const tickets = new FixTicketsPage(page);

    await auth.signIn(adminMember.email, adminMember.password);
    await checkouts.goto();
    await checkouts.goToTab('Shops');
    await checkouts.addShop(SHOP, `shop-${SHOP}`);
    await checkouts.verifyShopInTable(SHOP);
    await checkouts.goToTab('Tools');
    await checkouts.addTool(TOOL, 'tool for fix-ticket E2E', SHOP);
    await checkouts.verifyToolInTable(TOOL);

    await tickets.goto();
    const title = `E2E out-of-service ${RUN_ID}`;
    await tickets.reportProblem({
      title, description: 'This tool needs to be pulled from service.', category: 'Broken',
      shop: SHOP, tool: TOOL,
    });
    await tickets.goto();
    await tickets.openTicketByTitle(title);

    await tickets.markOutOfService();
    await expect(page.getByText('Out of service')).toBeVisible({ timeout: 10_000 });
  });
});

// ── Test 5: Bounty creation and claim ─────────────────────────────────────────

test.describe('Repair bounty lifecycle', () => {
  test('Admin creates a bounty and another member claims it', async ({ page }) => {
    const auth = new AuthPage(page);
    const tickets = new FixTicketsPage(page);

    await auth.signIn(basicMember.email, basicMember.password);
    await tickets.goto();
    const title = `E2E bounty ticket ${RUN_ID}`;
    await tickets.reportProblem({ title, description: 'Needs a volunteer to fix it.', category: 'Broken' });

    await auth.signIn(adminMember.email, adminMember.password);
    await tickets.goto();
    await tickets.openTicketByTitle(title);
    await tickets.makeBounty({
      title: `Fix: ${title}`,
      description: 'Bring your own tools; replacement part is on the shelf.',
      creditValue: 1,
    });

    const bountyLink = await tickets.bountyLink();
    await expect(bountyLink).toBeVisible({ timeout: 10_000 });
    const bountyHref = await bountyLink.getAttribute('href');
    expect(bountyHref).toBeTruthy();

    await auth.signIn(basicMember1.email, basicMember1.password);
    await page.goto(bountyHref!);
    await page.getByRole('button', { name: 'Claim bounty' }).click();
    await expect(page.getByRole('button', { name: 'Submit completion for verification' })).toBeVisible({ timeout: 10_000 });
  });
});
