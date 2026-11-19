const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path'), assert = require('assert/strict');
const root = path.resolve(__dirname, '../../../tmp/paid-membership-browser');
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
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await page.goto('http://127.0.0.1:' + server.address().port);
      const open = page.getByRole('button', { name: 'Adjust months', exact: true });
      await open.waitFor();
      await page.screenshot({ path: path.join(root, `profile-${width}.png`), fullPage: true, animations: 'disabled' });
      await open.focus(); await page.keyboard.press('Enter');
      const dialog = page.getByRole('dialog', { name: 'Increase paid membership months' });
      await dialog.waitFor();
      assert.equal(await page.getByLabel('Proposed months', { exact: false }).evaluate(el => document.activeElement === el), true);
      await page.getByLabel('Proposed months').fill('11.5');
      assert.equal(await page.getByRole('button', { name: 'Save increase' }).isDisabled(), true);
      await page.getByLabel('Proposed months').fill('12');
      assert.equal(await page.getByRole('button', { name: 'Save increase' }).isDisabled(), true);
      await page.getByLabel('Correction reason').fill('Verified historical receipt');
      await page.screenshot({ path: path.join(root, `dialog-${width}.png`), fullPage: true, animations: 'disabled' });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      const rect = await dialog.boundingBox(); assert.ok(rect.x >= 0 && rect.x + rect.width <= width);
      await page.getByRole('button', { name: 'Save increase' }).click();
      await dialog.waitFor({ state: 'hidden' });
      await page.getByText('Continuous paid membership: 12 months', { exact: true }).waitFor();
      assert.deepEqual(await page.evaluate(() => window.fixtureState.lastWrite), {
        continuousPaidMembershipMonths: 12, expectedRevision: 7, reason: 'Verified historical receipt',
      });
      await page.evaluate(() => window.renderFixture('admin', 'conflict'));
      await open.click();
      await page.getByLabel('Proposed months').fill('12');
      await page.getByLabel('Correction reason').fill('Verified historical receipt');
      await page.getByRole('button', { name: 'Save increase' }).click();
      await page.getByText('Current value: 15 months', { exact: true }).waitFor();
      assert.equal(await page.getByRole('button', { name: 'Save increase' }).isDisabled(), true);
      await page.getByLabel('Proposed months').fill('16');
      await page.getByRole('button', { name: 'Save increase' }).click();
      await dialog.waitFor({ state: 'hidden' });
      assert.equal(await page.evaluate(() => window.fixtureState.lastWrite.expectedRevision), 9);
      for (const role of ['self', 'board', 'rmSelf']) {
        await page.evaluate(role => window.renderFixture(role), role);
        await page.getByText('Continuous paid membership: 11 months', { exact: true }).waitFor();
        assert.equal(await open.count(), 0);
      }
      for (const role of ['rm', 'other']) {
        await page.evaluate(role => window.renderFixture(role), role);
        await page.waitForTimeout(50);
        assert.equal(await page.evaluate(() => window.fixtureState.reads), 0);
        assert.equal(await page.getByText('Continuous paid membership:', { exact: false }).count(), 0);
      }
      await page.evaluate(() => window.renderFixture('admin', 'error'));
      await page.getByRole('button', { name: 'Retry' }).click();
      await open.waitFor();
      await page.evaluate(() => window.renderFixture('admin', 'loading'));
      await page.getByRole('status', { name: 'Loading paid membership months' }).waitFor();
      await page.evaluate(() => window.fixtureState.resolve());
      await open.waitFor();
      await page.evaluate(() => window.renderFixture('admin', 'revoked'));
      await page.getByText('Restore membership eligibility and expiration before increasing paid membership months.').waitFor();
      assert.equal(await open.isDisabled(), true);
      assert.equal(await open.isDisabled(), true);
      assert.deepEqual(errors, []);
      await page.close(); console.log(`Paid membership browser passed at ${width}px`);
    }
  } finally { if (browser) await browser.close(); server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
