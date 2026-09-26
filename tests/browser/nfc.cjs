// Build first. All APIs and NFC hardware are mocked; no real member data is used.
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const root = path.resolve(__dirname, '../..');
async function settledDialog(page) {
  await page.waitForFunction(() => {
    let element = document.querySelector('[role="dialog"]');
    if (!element) return false;
    while (element) {
      if (Number(getComputedStyle(element).opacity) < 0.99) return false;
      element = element.parentElement;
    }
    return true;
  });
}
const publicRoot = path.resolve(root, '../makerspace-rails-2026/public');
const html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/assets/makerspace-react.css"><script defer src="/assets/makerspace-react.js"></script></head><body></body></html>';
const server = http.createServer((request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  let file;
  if (/^\/assets\/[\w.-]+$/.test(pathname)) file = path.join(root, 'dist', pathname.slice(8));
  if (pathname === '/assets/FilledLaserableLogo.svg') file = path.join(root, 'src/assets/FilledLaserableLogo.svg');
  if (['/service-worker.js', '/manifest.webmanifest', '/offline.html', '/pwa-icon.png'].includes(pathname)) file = path.join(publicRoot, pathname.slice(1));
  if (file && fs.existsSync(file)) {
    response.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.webmanifest') ? 'application/manifest+json' : file.endsWith('.png') ? 'image/png' : file.endsWith('.svg') ? 'image/svg+xml' : 'text/html');
    response.end(fs.readFileSync(file));
  } else { response.setHeader('Content-Type', 'text/html'); response.end(html); }
});

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ channel: process.platform === 'win32' ? 'msedge' : undefined, headless: true });
  fs.mkdirSync(path.join(root, 'tmp/nfc-browser'), { recursive: true });
  try {
    for (const width of [320, 600, 900, 1280]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      const page = await context.newPage();
      let role = 'member', lookups = 0, releases = 0, memberReads = 0;
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      const fontRequests = [];
      page.on('request', request => { if (/fonts\.(googleapis|gstatic)\.com/.test(request.url())) fontRequests.push(request.url()); });
      await page.addInitScript(() => {
        window.NDEFReader = class { constructor() { window.testNfcReader = this; } async scan() {} };
        window.presentTag = (uid, urls = []) => window.testNfcReader.onreading({ serialNumber: uid, message: {
          records: urls.map(url => ({ recordType: 'url', data: new DataView(new TextEncoder().encode(url).buffer) })),
        } });
      });
      await page.route('**/api/**', async route => {
        const url = new URL(route.request().url());
        let body = {}, status = 200;
        if (url.pathname === '/api/members/sign_in') body = { id: 'operator', firstname: 'NFC', lastname: 'Tester', role, status: 'activeMember', expirationTime: Date.now() + 86400000 };
        else if (url.pathname.endsWith('/permissions')) body = [];
        else if (url.pathname === '/api/workshops') body = { workshops: [], canAddShop: false };
        else if (url.pathname === '/api/admin/cards/lookup') {
          lookups++; assert.equal(url.searchParams.get('uid'), '1B1A4D2F');
          body = { id: 'card1', uid: '1B1A4D2F', holder: 'Test Member', member_id: 'member1', validity: 'lost', releasable: true, release_reason: 'Lost card', version: 'v1' };
        } else if (url.pathname === '/api/admin/cards/card1') { releases++; status = 204; }
        else if (url.pathname === '/api/members/member1') { memberReads++; body = { id: 'member1' }; }
        await route.fulfill({ status, contentType: 'application/json', body: status === 204 ? '' : JSON.stringify(body) });
      });
      await page.goto(`${origin}/workshops`);
      await page.locator('footer a svg').first().waitFor();
      assert.equal(await page.locator('footer a svg').count(), await page.locator('footer a').count());
      assert(await page.locator('footer').evaluate(el => el.scrollWidth <= el.clientWidth + 1));
      await page.getByRole('button', { name: 'Menu', exact: true }).click();
      await page.getByRole('menuitem', { name: 'SCAN NFC' }).click();
      await page.evaluate(() => window.presentTag('1b:1a:4d:2f', ['https://example.org/a/very/long/path?value=abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz']));
      await page.getByRole('button', { name: 'Open in new window' }).waitFor();
      assert.equal(lookups, 0); assert.equal(await page.getByText('UID:', { exact: false }).count(), 0);
      assert.equal(context.pages().length, 1);
      await settledDialog(page);
      await page.screenshot({ path: path.join(root, `tmp/nfc-browser/member-${width}.png`) });
      assert(await page.locator('[role="dialog"]').evaluate(el => el.scrollWidth <= el.clientWidth + 1));
      await page.getByRole('button', { name: 'Cancel', exact: true }).click();
      role = width === 600 ? 'board_member' : 'admin';
      await page.reload();
      await page.getByRole('button', { name: 'Menu', exact: true }).click();
      await page.getByRole('menuitem', { name: 'SCAN NFC' }).click();
      await page.evaluate(() => window.presentTag('1b:1a:4d:2f'));
      await page.getByRole('button', { name: 'RELEASE CARD', exact: true }).waitFor();
      assert.equal(memberReads, 0);
      await settledDialog(page);
      await page.screenshot({ path: path.join(root, `tmp/nfc-browser/admin-${width}.png`) });
      await page.getByRole('button', { name: 'RELEASE CARD', exact: true }).click();
      await page.getByText('Released, reusable', { exact: true }).waitFor();
      assert.equal(releases, 1); assert.equal(lookups, 1); assert.deepEqual(errors, []);
      assert.deepEqual(fontRequests, []);
      await page.keyboard.press('Escape');
      await page.getByRole('dialog').waitFor({ state: 'hidden' });
      const cacheKeys = await page.evaluate(async () => {
        await navigator.serviceWorker.ready;
        return Promise.all((await caches.keys()).map(async name => (await (await caches.open(name)).keys()).map(request => new URL(request.url).pathname)));
      });
      assert(cacheKeys.flat().every(path => ['/offline.html', '/pwa-icon.png'].includes(path)));
      await context.close(); console.log(`PASS NFC member/admin flows and layout at ${width}px`);
    }
    // Simulate the native platform for real iframe rendering. Bridge HTTP is
    // independently exercised by nativeTransport.spec.ts; no device is implied.
    for (const width of [320, 600, 900, 1280]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      const page = await context.newPage();
      const frameRequests = [];
      await page.addInitScript(() => { window.androidBridge = {}; });
      await page.route('**/api/**', async route => {
        const pathname = new URL(route.request().url()).pathname;
        let body = {};
        if (pathname === '/api/members/sign_in') body = { id: 'operator', firstname: 'Native', lastname: 'Tester', role: 'member', status: 'activeMember', expirationTime: Date.now() + 86400000 };
        else if (pathname.endsWith('/permissions')) body = { billing: true };
        else if (pathname === '/api/billing/receipts/invoice1') {
          frameRequests.push(route.request().resourceType());
          return route.fulfill({ contentType: 'text/html', body: '<html><body style="font-family:Arial;min-height:420px"><h2>Receipt loaded through session transport</h2><p>Membership payment: $75.00</p><a href="details">Details</a><script>parent.untrustedFrameScriptRan=true</script></body></html>' });
        }
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
      });
      await page.goto(`${origin}/checkout/receipt/invoice1`);
      await page.frameLocator('#receipt-container').getByText('Membership payment: $75.00').waitFor();
      assert.deepEqual(frameRequests, ['fetch']);
      const frame = page.locator('#receipt-container');
      assert.equal(await frame.getAttribute('src'), null);
      assert(await frame.evaluate(el => el.getBoundingClientRect().height >= 420));
      assert.equal(await page.evaluate(() => window.untrustedFrameScriptRan), undefined);
      assert(await page.frameLocator('#receipt-container').getByRole('link', { name: 'Details' }).evaluate(el => el.href.endsWith('/api/billing/receipts/details')));
      await page.evaluate(() => { window.frames['receipt-container'].print = () => { window.receiptPrinted = true; }; });
      await page.getByRole('button', { name: 'Print Receipt' }).click();
      assert.equal(await page.evaluate(() => window.receiptPrinted), true);
      assert(await page.locator('footer').evaluate(el => el.scrollWidth <= el.clientWidth + 1));
      await page.screenshot({ path: path.join(root, `tmp/nfc-browser/native-receipt-${width}.png`), fullPage: true });
      await context.close(); console.log(`PASS native HTML frame, sizing and print access at ${width}px`);
    }
  } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
