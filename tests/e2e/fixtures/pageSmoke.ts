import { expect, Page } from '@playwright/test';
import { basicMember } from './testData';
import { AuthPage } from '../pages/AuthPage';
import { MemberPage } from '../pages/MemberPage';

interface SmokeTab {
  label: string;
  ready: string;
}

interface AdminScreen {
  group: string;
  title: string;
  path: string;
  tabs: SmokeTab[];
}

export const memberProfileTabs: SmokeTab[] = [
  { label: 'Dues', ready: '#invoices-table-amount-header' },
  { label: 'Rentals', ready: '#member-rentals-table-title' },
  { label: 'Checkouts', ready: 'text="Request Checkout"' },
  { label: 'Volunteer', ready: 'text="Open Events"' },
];

export const memberSettingsPages = [
  { label: 'Profile', path: 'profile', text: /personal information/i },
  { label: 'Subscriptions', path: 'subscriptions', text: /subscription/i },
  { label: 'Payment Methods', path: 'payment-methods', text: /payment method/i },
  { label: 'Security', path: 'security', text: /two-factor|password/i },
];

export const adminScreens: AdminScreen[] = [
  {
    group: 'admin-rentals',
    title: 'Rental Management',
    path: '/admin/rentals',
    tabs: [
      { label: 'Rental Requests', ready: '#admin-rental-requests-table-title' },
      { label: 'Rental Types', ready: '#admin-rental-types-table-title' },
      { label: 'Rental Spots', ready: '#admin-rental-spots-table-title' },
    ],
  },
  {
    group: 'admin-checkouts',
    title: 'Tool Checkouts',
    path: '/tool-checkouts',
    tabs: [
      { label: 'Shops', ready: '#shops-table-title' },
      { label: 'Tools', ready: '#tools-table-title' },
      { label: 'Approvers', ready: '#approvers-table-title' },
    ],
  },
  {
    group: 'admin-volunteer',
    title: 'Volunteer',
    path: '/volunteer',
    tabs: [
      { label: 'Events', ready: '#volunteer-events-table-title' },
      { label: 'Bounty Tasks', ready: '#volunteer-tasks-table-title' },
    ],
  },
  {
    group: 'admin-analytics',
    title: 'Analytics',
    path: '/admin/analytics',
    tabs: [
      { label: 'Volunteer', ready: 'text="Credits Issued per Month"' },
      { label: 'Space Usage', ready: 'text="Membership and volunteer activity over a rolling 30 day window."' },
    ],
  },
  {
    group: 'admin-billing',
    title: 'Billing Central',
    path: '/billing',
    tabs: [
      { label: 'Billing Options', ready: '#billing-options-table-title' },
      { label: 'Subscriptions', ready: '#subscriptions-table-title' },
      { label: 'Transactions', ready: '#transactions-table-title' },
      { label: 'Outstanding Invoices / Dues', ready: '#invoices-table-amount-header' },
    ],
  },
  {
    group: 'admin-settings',
    title: 'Member Portal Settings',
    path: '/admin/system-settings',
    tabs: [
      { label: 'Slack', ready: 'text="Slack Channels"' },
      { label: 'Volunteer', ready: 'text="Credit Thresholds"' },
      { label: 'Jobs', ready: 'text="Monthly Job Schedule"' },
      { label: 'Security', ready: 'text="Lock Out New Signups"' },
    ],
  },
];

export const resourceManagerPages = [
  { label: 'Shop fees', path: '/shop-fees', text: /shop fee|charge/i },
  { label: 'Tool checkouts', path: '/tool-checkouts', text: /checkout|tool/i },
  { label: 'Volunteer', path: '/volunteer', text: /volunteer/i },
  { label: 'Admin rentals', path: '/admin/rentals', text: /rental/i },
];

export async function expectNoCrash(page: Page): Promise<void> {
  await expect(page.getByText(/something went wrong|cannot read propert/i)).not.toBeVisible();
  expect((await page.locator('body').innerText()).trim().length).toBeGreaterThan(10);
}

export async function gotoSmokePage(page: Page, path: string, text: string | RegExp): Promise<void> {
  await page.goto(path);
  await expect(page).toHaveURL(url => url.pathname === path || url.pathname.startsWith(`${path}/`));
  await expect(page.getByText(text, { exact: true }).first()).toBeVisible();
  await expectNoCrash(page);
}

export async function checkSmokeTab(page: Page, tab: SmokeTab): Promise<void> {
  const control = page.getByRole('tab', { name: tab.label, exact: true });
  await control.click();
  await expect(control).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator(tab.ready)).toBeVisible();
  await expectNoCrash(page);
}

export async function loginToMemberProfile(page: Page): Promise<string> {
  const member = new MemberPage(page);
  await new AuthPage(page).signIn(basicMember.email, basicMember.password);
  await member.gotoOwnProfile();
  await member.dismissNotificationModal();
  const path = new URL(await member.getProfileUrl()).pathname;
  const [, , memberId] = path.split('/');
  expect(memberId).toBeTruthy();
  return memberId;
}
