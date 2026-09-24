const fs = require('fs');
const path = require('path');
const http = require('http');
const assert = require('node:assert/strict');
const webpack = require('webpack');
const { chromium } = require('@playwright/test');
const root = path.resolve(__dirname, '..');
const output = path.join(root, '.cache/shop-outage-ui');
const config = require('../prod.config.js')({});
config.mode = 'development';
config.entry = path.join(root, 'tests/fixtures/shop-outage-entry.tsx');
config.output = { ...config.output, path: output, clean: true };
config.optimization = { minimize: false }; config.devtool = false;
async function main() {
  await new Promise((resolve, reject) => webpack(config, (error, stats) => {
    if (error || stats.hasErrors()) reject(error || Error(stats.toString({ all: false, errors: true })));
    else resolve();
  }));
  const requests = [];
  let failNext = true;
  const server = http.createServer((req, res) => {
    if (req.url === '/api/shops/shop/outage') {
      let body = ''; req.on('data', chunk => body += chunk);
      req.on('end', () => {
        requests.push(JSON.parse(body)); res.setHeader('Content-Type', 'application/json');
        if (failNext) { failNext = false; res.writeHead(503).end(JSON.stringify({ error: 'Please retry' })); }
        else res.end('{}');
      }); return;
    }
    if (req.url.startsWith('/assets/')) {
      const file = path.resolve(output, req.url.slice('/assets/'.length));
      if (!file.startsWith(output + path.sep) || !fs.existsSync(file)) { res.writeHead(404).end(); return; }
      res.setHeader('Content-Type', file.endsWith('.js') ? 'application/javascript' : 'text/css');
      fs.createReadStream(file).pipe(res); return;
    }
    res.setHeader('Content-Type', 'text/html');
    res.end(fs.readFileSync(path.join(output, 'index.html')));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) })
    .catch(error => { server.close(); throw error; });
  try {
    const page = await browser.newPage();
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    for (const width of [320, 600, 900, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`http://127.0.0.1:${server.address().port}/`);
      await page.getByRole('button', { name: 'Mark shop out of service' }).click();
      const dialog = page.getByRole('dialog', { name: /Shop availability/ });
      const save = dialog.getByRole('button', { name: 'Mark out of service', exact: true });
      const note = page.getByRole('textbox', { name: 'Reason for outage' });
      assert(await save.isDisabled());
      await note.fill('   '); assert(await save.isDisabled());
      await note.fill('Water leak near the electrical panel.');
      await note.press('Tab'); assert(await save.evaluate(element => element === document.activeElement));
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      assert(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth));
      await page.waitForTimeout(250); // Allow the MUI dialog transition to finish before visual review.
      await page.screenshot({ path: path.join(output, `outage-${width}.png`) });
      await save.click();
      if (width === 320) {
        await page.getByText('Please retry', { exact: true }).waitFor();
        assert.equal(await note.inputValue(), 'Water leak near the electrical panel.');
        await save.click();
      }
      await dialog.waitFor({ state: 'hidden' });
      await page.getByRole('button', { name: 'Restore shop service' }).click();
      await page.getByRole('button', { name: 'Restore service', exact: true }).click();
      await page.getByRole('button', { name: 'Mark shop out of service' }).waitFor();
    }
    assert.equal(requests.length, 9);
    assert(requests.some(request => request.out_of_service === false));
    assert(requests.filter(request => request.out_of_service).every(request => request.note.length > 0));
    assert.deepEqual(errors, []);
    console.log('Shop outage checks passed: required reason, retry, restore, keyboard focus, and layout at 320/600/900/1440 px.');
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
