import { defineConfig } from '@playwright/test';
import primaryConfig from './playwright.config';

export default defineConfig({
  ...primaryConfig,
  testDir: './tests/e2e/backups',
  retries: 0,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'tmp/playwright-backup-report' }],
  ],
  use: {
    ...primaryConfig.use,
    trace: 'retain-on-failure',
  },
  outputDir: 'tmp/playwright-backup-results',
});
