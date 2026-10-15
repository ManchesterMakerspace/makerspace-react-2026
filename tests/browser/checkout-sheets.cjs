// Requires yarn build and Rails-generated SVG fixtures; see the browser README.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('@playwright/test');
const root = path.resolve(__dirname, '../..');
const fixtures = process.env.CHECKOUT_SHEET_FIXTURE_DIR || path.join(root, '../makerspace-rails-2026/tmp/checkout-sheets');
const output = path.join(root, 'tmp/checkout-sheet-browser');
const svg = name => fs.readFileSync(path.join(fixtures, `${name}.svg`), 'utf8');
const shopId = '0123456789abcdef01234567', toolId = '0123456789abcdef01234568';
const member = { id: 'member1', firstname: 'Test', lastname: 'Admin', email: 'test@example.com', role: 'admin', status: 'activeMember', expirationTime: 4102444800000, memberContractOnFile: true, subscription: true };
const shop = { id: shopId, name: 'Woodworking', slackChannel: 'shop-woodworking', wikiUrl: '', disabled: false, reservable: false, resourceManagers: [], reservationPrerequisiteIds: [], reservationPrerequisiteToolIds: [], canGenerateCheckoutRequiredSheet: true };
const tool = { id: toolId, name: 'Bandsaw', shopId, shopName: shop.name, wikiUrl: '', disabled: false, open: false, reservable: false, prerequisiteIds: [], prerequisiteNames: [], unmetPrerequisiteIds: [], unmetPrerequisiteNames: [], canGenerateCheckoutRequiredSheet: true };
const html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/assets/makerspace-react.css"><script defer src="/assets/makerspace-react.js"></script></head><body></body></html>';
const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  let file;
  if (/^\/assets\/[\w.-]+$/.test(pathname)) file = path.join(root, 'dist', pathname.slice(8));
  if (/^\/qr\/[\w.-]+$/.test(pathname)) file = path.join(root, 'node_modules/qr-scanner', pathname.slice(4));
  if (/^\/fixtures\/(double|single|long|blank)\.svg$/.test(pathname)) file = path.join(fixtures, path.basename(pathname));
  if (file && fs.existsSync(file)) {
    res.setHeader('Content-Type', file.endsWith('.svg') ? 'image/svg+xml' : file.endsWith('.css') ? 'text/css' : 'text/javascript');
    res.end(fs.readFileSync(file));
  } else if (pathname === '/preview') {
    res.setHeader('Content-Type', 'text/html');
    res.end('<!doctype html><style>@page {size:11in 8.5in; margin:0} body{margin:0}img{display:block;width:11in;height:8.5in}</style><img src="/fixtures/double.svg">');
  } else { res.setHeader('Content-Type', 'text/html'); res.end(html); }
});

(async () => {
  ['double', 'single', 'long', 'blank'].forEach(svg);
  fs.mkdirSync(output, { recursive: true });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ channel: process.platform === 'win32' ? 'msedge' : undefined, headless: true });
  try {
    // Decode the actual server-generated vector QR images after browser rendering.
    const render = await browser.newPage({ viewport: { width: 1100, height: 850 } });
    for (const name of ['double', 'single', 'long', 'blank']) {
      await render.goto(`${origin}/preview`);
      await render.locator('img').evaluate((img, name) => { img.src = `/fixtures/${name}.svg`; }, name);
      await render.locator('img').evaluate(img => img.decode());
      const decoded = await render.evaluate(async name => {
        const { default: QrScanner } = await import('/qr/qr-scanner.min.js');
        const image = document.querySelector('img');
        const page = document.createElement('canvas'); page.width = 2200; page.height = 1700;
        page.getContext('2d').drawImage(image, 0, 0, 2200, 1700);
        const answers = [];
        for (const signY of name === 'single' ? [243.75] : [50, 437.5]) {
          const crop = document.createElement('canvas'); crop.width = crop.height = 400;
          crop.getContext('2d').drawImage(page, 1680, (signY + 90) * 2, 400, 400, 0, 0, 400, 400);
          answers.push((await QrScanner.scanImage(crop, { returnDetailedScanResult: true })).data);
        }
        return answers;
      }, name);
      assert.deepEqual(decoded, Array(name === 'single' ? 1 : 2).fill('HTTPS://MEMBERS.EXAMPLE.ORG/L23456789AB'));
      await render.locator('img').screenshot({ path: path.join(output, `${name}.png`) });
      const pdf = await render.pdf({ path: path.join(output, `${name}.pdf`), preferCSSPageSize: true, printBackground: true });
      const pdfSource = pdf.toString('latin1');
      assert.equal((pdfSource.match(/\/Type \/Page\b/g) || []).length, 1, 'Exactly one printed page');
      assert.match(pdfSource, /\/MediaBox\s*\[0 0 792 612\]/, 'Landscape Letter dimensions');
    }
    await render.close();

    for (const width of [320, 600, 900, 1280]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 } });
      const page = await context.newPage(); const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      let failNext = false, missingChannel = false, permitted = true;
      await page.route('**/api/**', async route => {
        const pathname = new URL(route.request().url()).pathname;
        let body = [];
        if (pathname.endsWith('/checkout_required_sheet')) {
          assert.equal(route.request().method(), 'POST');
          if (failNext) { failNext = false; return route.fulfill({ status: 503, json: { error: 'Short link unavailable. Please retry.' } }); }
          return route.fulfill({ contentType: 'image/svg+xml', headers: missingChannel ? { 'X-Checkout-Sheet-Warning': 'missing_shop_channel' } : {},
            body: svg(route.request().postDataJSON().copies === 1 ? 'single' : missingChannel ? 'blank' : 'double') });
        }
        if (pathname === '/api/members/sign_in') body = member;
        else if (pathname === '/api/config') body = { wiki_url: '', app_domain: 'members.example.org' };
        else if (pathname === '/api/signup_status') body = { locked: false };
        else if (pathname.endsWith('/permissions')) body = {};
        else if (pathname === '/api/workshops') body = { canAddShop: true, workshops: [{ ...shop,
          canGenerateCheckoutRequiredSheet: permitted, canAddTool: false, isShopManager: false, resourceManagersWikiUrl: '',
          upcomingVolunteerEvents: [], volunteerTasks: [], tools: [{ ...tool, canGenerateCheckoutRequiredSheet: permitted }] }] };
        else if (['/api/shops', '/api/admin/shops'].includes(pathname)) body = [{ ...shop, canGenerateCheckoutRequiredSheet: permitted }];
        else if (['/api/tools', '/api/admin/tools'].includes(pathname)) body = [{ ...tool, canGenerateCheckoutRequiredSheet: permitted }];
        await route.fulfill({ json: body });
      });
      const checkSheet = async (label, single = false) => {
        const action = page.getByRole('button', { name: 'Checkout Required Sheet', exact: true });
        await action.focus(); await page.keyboard.press('Enter');
        const dialog = page.getByRole('dialog');
        await dialog.getByRole('link', { name: 'Download SVG' }).waitFor();
        if (single) {
          await dialog.getByRole('radio', { name: 'One sign', exact: true }).check();
          await dialog.getByRole('img', { name: /^One Checkout/ }).waitFor();
        }
        const link = dialog.getByRole('link', { name: 'Download SVG' });
        assert.equal(await link.getAttribute('href'), await dialog.getByRole('img').getAttribute('src'));
        const pending = page.waitForEvent('download'); await link.click(); const download = await pending;
        const target = path.join(output, `${label}-${width}.svg`); await download.saveAs(target);
        assert.equal(fs.readFileSync(target, 'utf8'), svg(single ? 'single' : missingChannel ? 'blank' : 'double'));
        assert(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth + 1));
        await dialog.screenshot({ path: path.join(output, `${label}-${width}.png`) });
        await dialog.getByRole('button', { name: 'Close', exact: true }).click();
        await dialog.waitFor({ state: 'hidden' });
      };
      await page.goto(`${origin}/workshops?shop=${shopId}`);
      await checkSheet('workshop-shop');
      await page.getByRole('tab', { name: 'Tools', exact: true }).click();
      await checkSheet('workshop-tool', true);
      failNext = true;
      await page.getByRole('button', { name: 'Checkout Required Sheet', exact: true }).click();
      await page.getByRole('alert').filter({ hasText: 'Short link unavailable' }).waitFor();
      assert.equal(await page.getByRole('link', { name: 'Download SVG' }).count(), 0);
      await page.getByRole('button', { name: 'Retry', exact: true }).click();
      await page.getByRole('link', { name: 'Download SVG' }).waitFor();
      await page.getByRole('button', { name: 'Close', exact: true }).click();
      await page.goto(`${origin}/tool-checkouts`);
      await page.getByRole('tab', { name: 'Shops', exact: true }).click();
      await page.getByRole('row').filter({ hasText: 'Woodworking' }).getByRole('checkbox').check();
      missingChannel = true;
      await checkSheet('manager-shop');
      missingChannel = false;
      await page.getByRole('tab', { name: 'Tools', exact: true }).click();
      await page.getByRole('row').filter({ hasText: 'Bandsaw' }).getByRole('checkbox').check();
      await checkSheet('manager-tool');
      permitted = false;
      await page.goto(`${origin}/workshops?shop=${shopId}`);
      await page.getByRole('heading', { name: 'Woodworking', exact: true }).waitFor();
      assert.equal(await page.getByRole('button', { name: 'Checkout Required Sheet', exact: true }).count(), 0);
      await page.getByRole('tab', { name: 'Tools', exact: true }).click();
      await page.getByText('Bandsaw', { exact: true }).first().waitFor();
      assert.equal(await page.getByRole('button', { name: 'Checkout Required Sheet', exact: true }).count(), 0);
      await page.goto(`${origin}/tool-checkouts`);
      for (const [tab, name] of [['Shops', 'Woodworking'], ['Tools', 'Bandsaw']]) {
        await page.getByRole('tab', { name: tab, exact: true }).click();
        await page.getByRole('row').filter({ hasText: name }).getByRole('checkbox').check();
        assert.equal(await page.getByRole('button', { name: 'Checkout Required Sheet', exact: true }).count(), 0);
      }
      assert.deepEqual(errors, []);
      await context.close();
    }
    console.log('Checkout sheet browser checks passed: both paths, one/two signs, SVG downloads, QR decoding, print PDFs, and 320/600/900/1280px.');
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; server.close(); });
