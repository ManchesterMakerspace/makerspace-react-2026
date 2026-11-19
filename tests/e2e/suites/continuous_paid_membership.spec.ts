import { test, expect } from '@playwright/test';
import { execFileSync } from 'child_process';
import { AuthPage } from '../pages/AuthPage';

let members: Record<string, { id: string; email: string }>;
const password = 'fixture-password123';
test.beforeAll(() => {
  const args = ['exec', 'rails', 'runner', 'scripts/ci/paid-membership-fixtures.rb'];
  const output = process.env.RAILS_CONTAINER
    ? execFileSync('docker', ['exec', process.env.RAILS_CONTAINER, 'bundle', ...args], { encoding: 'utf8' })
    : execFileSync('ruby', ['-S', 'bundle', ...args], { cwd: process.env.RAILS_DIR,
      env: { ...process.env, RAILS_ENV: 'test' }, encoding: 'utf8' });
  const line = output.split(/\r?\n/).find(value => value.startsWith('PAID_MEMBERSHIP_FIXTURE='));
  if (!line) throw new Error('Paid membership fixture creation failed');
  members = JSON.parse(line.slice('PAID_MEMBERSHIP_FIXTURE='.length));
});

test('Admin reviews a conflict and saves an audited integer increase through real Rails transport', async ({ page }) => {
  await page.goto('/login');
  await new AuthPage(page).signIn(members.admin.email, password);
  await page.goto(`/members/${members.member.id}`);
  await expect(page.getByText('Continuous paid membership: 11 months', { exact: true })).toBeVisible();
  await expect(page.getByText('Estimated history', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Adjust months', exact: true }).click();
  await page.getByLabel('Proposed months').fill('12');
  await page.getByLabel('Correction reason').fill('Verified browser fixture receipt');
  const cookie = (await page.context().cookies()).find(value => value.name === 'XSRF-TOKEN');
  // Rails test configuration can disable CSRF. Dedicated request specs exercise
  // enforcement; use the actual cookie whenever the server enables protection.
  const path = `/api/admin/members/${members.member.id}/continuous_paid_membership`;
  const concurrent = await page.request.put(path, { headers: { 'X-XSRF-TOKEN': cookie ? decodeURIComponent(cookie.value) : '' },
    data: { continuousPaidMembershipMonths: 14, expectedRevision: 7, reason: 'Concurrent fixture correction' } });
  expect(concurrent.status()).toBe(200);
  await page.getByRole('button', { name: 'Save increase' }).click();
  await expect(page.getByText('Current value: 14 months', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save increase' })).toBeDisabled();
  await page.getByLabel('Proposed months').fill('15');
  await page.getByRole('button', { name: 'Save increase' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.getByText('Continuous paid membership: 15 months', { exact: true })).toBeVisible();
  const result = await page.request.get(`/api/members/${members.member.id}/continuous_paid_membership`);
  expect(await result.json()).toEqual({ continuousPaidMembershipMonths: 15, revision: 9, estimated: true });
});

for (const role of ['board_member', 'resource_manager', 'member']) {
  test(`${role} has the intended read scope and cannot increase months`, async ({ page }) => {
    await page.goto('/login');
    await new AuthPage(page).signIn(members[role].email, password);
    await page.goto(`/members/${members.member.id}`);
    const read = await page.request.get(`/api/members/${members.member.id}/continuous_paid_membership`);
    expect(read.status()).toBe(role === 'resource_manager' ? 403 : 200);
    if (role !== 'resource_manager') await expect(page.getByText(/Continuous paid membership: \d+ months/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Adjust months', exact: true })).toHaveCount(0);
    const cookie = (await page.context().cookies()).find(value => value.name === 'XSRF-TOKEN');
    const write = await page.request.put(`/api/admin/members/${members.member.id}/continuous_paid_membership`, {
      headers: { 'X-XSRF-TOKEN': cookie ? decodeURIComponent(cookie.value) : '' },
      data: { continuousPaidMembershipMonths: 99, expectedRevision: 9, reason: 'Must be rejected' },
    });
    expect(write.status()).toBe(403);
  });
}
