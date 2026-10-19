const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path'), assert = require('assert/strict');
const root = path.resolve(__dirname, '../../../tmp/checkout-expiration-browser');
(async () => {
  const server = http.createServer((req, res) => {
    const file = req.url === '/fixture.js' ? 'fixture.js' : 'index.html';
    res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : 'text/html');
    res.end(fs.readFileSync(path.join(root, file)));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
    for (const width of [320, 600, 900, 1280]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } });
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await page.goto('http://127.0.0.1:' + server.address().port);
      const link = page.getByRole('link', { name: 'Checkout training plan' });
      assert.equal(await link.getAttribute('target'), '_blank');
      assert.equal(await link.getAttribute('rel'), 'noopener noreferrer');
      await page.getByRole('button', { name: 'Edit expiration', exact: true }).focus();
      await page.keyboard.press('Enter');
      const dialog = page.getByRole('dialog'); await dialog.waitFor();
      await page.getByLabel('Never expires', { exact: true }).check();
      await page.screenshot({ path: path.join(root, 'edit-' + width + '.png'), fullPage: true, animations: 'disabled' });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await dialog.getByRole('button', { name: 'Save expiration' }).click();
      await dialog.waitFor({ state: 'hidden' });
      assert.deepEqual(await page.evaluate(() => window.lastWrite), { id: 'old', expirationRevision: 7, expiresOn: null });
      await page.getByRole('button', { name: 'Request renewal', exact: true }).click();
      await dialog.getByLabel('Note', { exact: true }).fill('Please arrange retraining');
      await dialog.getByRole('button', { name: 'Request renewal', exact: true }).click();
      await dialog.waitFor({ state: 'hidden' });
      assert.equal((await page.evaluate(() => window.lastRequest)).body.toolId, 'saw');
      await page.getByRole('button', { name: 'Set checkout expirations', exact: true }).click();
      await dialog.getByText('2 current non-revoked checkouts', { exact: false }).waitFor();
      await page.getByLabel('Expiration date (Eastern time)', { exact: true }).fill('2099-10-19');
      await page.screenshot({ path: path.join(root, 'bulk-' + width + '.png'), fullPage: true, animations: 'disabled' });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await dialog.getByRole('button', { name: 'Confirm expiration update' }).click();
      await page.getByRole('status').waitFor();
      assert.deepEqual(await page.evaluate(() => window.lastBulk), { id: 'saw', date: '2099-10-19' });
      assert.deepEqual(errors, []); await page.close(); console.log('Checkout expiration passed at ' + width + 'px');
    }
  } finally { if (browser) await browser.close(); server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
