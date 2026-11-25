import { test, expect } from '@playwright/test';

test('Public landing page loads the seeded signup catalog', { tag: '@backup-signup-catalog' }, async ({ page }) => {
  await test.step('Fetch the signup catalog', async () => {
    const [catalog] = await Promise.all([
      page.waitForResponse(response =>
        response.request().method() === 'GET' && new URL(response.url()).pathname === '/api/invoice_options/signup'
      ),
      page.goto('/'),
    ]);
    expect(catalog.ok()).toBe(true);
  });

  await test.step('Render the seeded membership options', async () => {
    await expect(page.getByRole('heading', { name: 'Our Membership Options' })).toBeVisible();
    for (const plan of ['One Month', 'Three Months', 'One Year']) {
      await expect(page.getByRole('cell', { name: plan, exact: true })).toBeVisible();
    }
    await expect(page.getByText(/something went wrong|cannot read propert/i)).not.toBeVisible();
  });
});
