import { Page } from '@playwright/test';

const FAKE_DOCUMENT_HTML = `
<html><body style="font-family:sans-serif;padding:20px">
  <h2>Test Document</h2>
  <p>This document is mocked for E2E testing. The real document requires Google Drive.</p>
</body></html>`.trim();

/**
 * Intercept all /api/documents/* requests and return a fake HTML document.
 * Prevents the Google Drive loop in test environments with dummy credentials.
 * Call before page.goto() in any test involving document signing.
 */
export async function mockDocumentRoutes(page: Page): Promise<void> {
  await page.route('**/api/documents/**', async route => {
    await route.fulfill({
      status:      200,
      contentType: 'text/html',
      body:        FAKE_DOCUMENT_HTML,
    });
  });
}
