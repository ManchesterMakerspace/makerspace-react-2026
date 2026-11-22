import { test, expect } from '@playwright/test';

test('App loads and membership options are present after seed', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Our Membership Options' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'One Month' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Three Months' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'One Year' })).toBeVisible();
});

test('Home smoke renders the membership options table', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText(/membership options|one month/i).first()).toBeVisible();
  await expect(page.getByText(/something went wrong|cannot read propert/i)).not.toBeVisible();
  expect((await page.locator('body').innerText()).trim().length).toBeGreaterThan(10);
});

test('Landing page uses the signup-eligible invoice options endpoint', async ({ page }) => {
  const catalogRequest = page.waitForRequest(request =>
    new URL(request.url()).pathname === '/api/invoice_options/signup'
  );
  await page.goto('/');
  await catalogRequest;
  await expect(page.getByRole('cell', { name: 'One Month', exact: true })).toBeVisible();
});

test('Membership options table loads on home page before registration', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('cell', { name: 'One Month' })).toBeVisible();
});
