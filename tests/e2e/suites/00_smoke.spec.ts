import { test, expect } from '@playwright/test';

/**
 * Smoke test — verifies the app is reachable and the database was seeded.
 * If this passes, the CI environment is wired up correctly.
 */
test('app loads and membership options are present after seed', async ({ page }) => {
  // TEMP diagnostics — surface real browser-side errors directly in the CI
  // log instead of only seeing "element not found" timeouts. Remove once
  // the render failure is diagnosed.
  page.on('console', msg => console.log(`[browser console:${msg.type()}] ${msg.text()}`));
  page.on('pageerror', err => console.log(`[browser pageerror] ${err.message}\n${err.stack}`));
  page.on('requestfailed', req => console.log(`[browser requestfailed] ${req.url()} — ${req.failure()?.errorText}`));
  page.on('response', res => {
    if (res.status() >= 400) console.log(`[browser response ${res.status()}] ${res.url()}`);
  });

  await page.goto('/');

  // Verify the page heading is present
  await expect(page.getByRole('heading', { name: 'Our Membership Options' }))
    .toBeVisible({ timeout: 30_000 });

  // Verify seeded invoice options are present in the table
  await expect(page.getByRole('cell', { name: 'One Month' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Three Months' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'One Year' })).toBeVisible();
});