import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e/suites',
  globalSetup: './tests/e2e/global.setup.ts',

  // Per-test timeout — Braintree can be slow
  timeout: 3 * 60 * 1000,
  expect: { timeout: 30 * 1000 },

  // Sequential — tests share a Braintree sandbox
  fullyParallel: false,
  workers: 1,

  retries: process.env.CI ? 1 : 0,

  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never', outputFolder: 'tmp/playwright-report' }]]
    : [['list'], ['html', { open: 'on-failure', outputFolder: 'tmp/playwright-report' }]],

  use: {
    baseURL: process.env.APP_URL || 'http://localhost:3000',
    viewport: { width: 1280, height: 900 },
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  outputDir: 'tmp/playwright-results',

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
