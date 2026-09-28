const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const root = path.resolve(__dirname, '../../../tmp/tool-groups-browser');
(async () => {
  const server = http.createServer((req, res) => {
    const file = req.url === '/fixture.js' ? 'fixture.js' : 'index.html';
    res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : 'text/html');
    res.end(fs.readFileSync(path.join(root, file)));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    for (const width of [320, 600, 900, 1280]) {
      const page = await browser.newPage({ viewport: { width, height: 1100 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`http://127.0.0.1:${server.address().port}`);
      await page.getByLabel('Group name').fill('Woodshop introduction');
      await page.getByRole('combobox', { name: 'Included tools' }).fill('Bandsaw');
      await page.getByRole('option', { name: 'Bandsaw' }).click();
      await page.getByRole('combobox', { name: 'Prerequisite tools' }).click();
      assert.equal(await page.getByRole('option', { name: 'Bandsaw' }).count(), 0);
      await page.keyboard.press('Escape');
      await page.getByLabel('Requestable', { exact: true }).check();
      assert.equal(await page.getByLabel('Reservable', { exact: true }).isChecked(), false);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, `Overflow at ${width}`);
      assert.deepEqual(errors, []);
      await page.screenshot({ path: path.join(root, `group-form-${width}.png`), fullPage: true });
      await page.close();
      console.log(`Group form passed at ${width}px`);
    }
  } finally { if (browser) await browser.close(); server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
