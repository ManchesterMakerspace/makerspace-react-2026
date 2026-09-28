const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const root = path.resolve(__dirname, '../../../tmp/shop-filter-browser');
(async () => {
  const server = http.createServer((req, res) => { const file = req.url === '/fixture.js' ? 'fixture.js' : 'index.html'; res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : 'text/html'); res.end(fs.readFileSync(path.join(root, file))); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    for (const width of [320, 600, 900, 1280]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`http://127.0.0.1:${server.address().port}`);
      await page.getByText('Metalshop saw', { exact: true }).waitFor();
      const shop = page.getByRole('combobox', { name: 'Shop' });
      await shop.focus();
      assert.equal(await shop.evaluate(element => element === document.activeElement), true);
      await shop.selectOption('wood');
      await page.getByText('Metalshop saw', { exact: true }).waitFor({ state: 'hidden' });
      await page.getByText('Woodshop introduction', { exact: true }).waitFor();
      assert.equal(await page.getByText('Metalshop introduction', { exact: true }).count(), 0);
      assert.equal(await page.evaluate(() => window.shopCalls.at(-1)), 'wood');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
      await page.screenshot({ path: path.join(root, `shop-filter-${width}.png`), fullPage: true });
      await shop.selectOption('');
      await page.getByText('Metalshop saw', { exact: true }).waitFor();
      assert.deepEqual(errors, []);
      await page.close();
      console.log(`Shop filter passed at ${width}px`);
    }
  } finally { if (browser) await browser.close(); server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
