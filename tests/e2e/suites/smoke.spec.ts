import { test, expect } from '@playwright/test';

/**
 * Smoke test — verifies the app is reachable and the database was seeded.
 * If this passes, the CI environment is wired up correctly.
 */
test('app loads and membership options are present after seed', async ({ page }) => {
  await page.goto('/');

  // Verify the page heading is present
  await expect(page.getByRole('heading', { name: 'Our Membership Options' }))
    .toBeVisible({ timeout: 30_000 });

  // Verify seeded invoice options are present in the table
  await expect(page.getByRole('cell', { name: 'One Month' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Three Months' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'One Year' })).toBeVisible();
});
