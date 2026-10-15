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
const sampleNames = ['double', 'single', 'long', 'unbroken', 'blank', 'long-single', 'unbroken-single', 'blank-single'];
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
  if (sampleNames.some(name => pathname === `/fixtures/${name}.svg`)) file = path.join(fixtures, path.basename(pathname));
  if (file && fs.existsSync(file)) {
    res.setHeader('Content-Type', file.endsWith('.svg') ? 'image/svg+xml' : file.endsWith('.css') ? 'text/css' : 'text/javascript');
    res.end(fs.readFileSync(file));
  } else if (pathname === '/preview') {
    res.setHeader('Content-Type', 'text/html');
    res.end('<!doctype html><style>@page {size:11in 8.5in; margin:0} body{margin:0}img{display:block;width:11in;height:8.5in}</style><img src="/fixtures/double.svg">');
  } else { res.setHeader('Content-Type', 'text/html'); res.end(html); }
});

(async () => {
  sampleNames.forEach(svg);
  fs.mkdirSync(output, { recursive: true });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ channel: process.platform === 'win32' ? 'msedge' : undefined, headless: true });
  try {
    // Decode the actual server-generated vector QR images after browser rendering.
    const render = await browser.newPage({ viewport: { width: 1100, height: 850 } });
    for (const name of sampleNames) {
      await render.goto(`${origin}/preview`);
      await render.locator('img').evaluate((img, name) => { img.src = `/fixtures/${name}.svg`; }, name);
      await render.locator('img').evaluate(img => img.decode());
      const geometry = await render.evaluate(source => {
        const host = document.createElement('div');
        host.style.cssText = 'position:absolute;left:0;top:0;visibility:hidden';
        host.innerHTML = source;
        document.body.appendChild(host);
        const sheet = host.querySelector('svg');
        sheet.style.cssText = 'width:1100px;height:850px';
        const origin = sheet.getBoundingClientRect();
        const bounds = element => {
          const box = element.getBoundingClientRect();
          return { x: box.x - origin.x, y: box.y - origin.y, width: box.width, height: box.height };
        };
        const signs = Array.from(sheet.querySelectorAll('.checkout-sign')).map(sign => {
          const parts = Array.from(sign.children).map(element => ({
            label: element.getAttribute('class') || element.textContent,
            ...bounds(element)
          }));
          return { parts, qr: bounds(sign.querySelector('.shortcode-qr')) };
        });
        host.remove();
        return signs;
      }, svg(name));
      for (const sign of geometry) {
        for (const box of sign.parts) {
          assert(box.x >= 25 - 0.1 && box.y >= 25 - 0.1 && box.x + box.width <= 1075 + 0.1 && box.y + box.height <= 825 + 0.1,
            `${name}: ${box.label} must stay inside the printable area: ${JSON.stringify(box)}`);
        }
        for (let i = 0; i < sign.parts.length; i++) {
          for (const other of sign.parts.slice(i + 1)) {
            const box = sign.parts[i];
            const overlap = box.x < other.x + other.width && box.x + box.width > other.x && box.y < other.y + other.height && box.y + box.height > other.y;
            assert(!overlap, `${name}: ${box.label} overlaps ${other.label}`);
          }
        }
      }
      const decoded = await render.evaluate(async qrs => {
        const { default: QrScanner } = await import('/qr/qr-scanner.min.js');
        const image = document.querySelector('img');
        const page = document.createElement('canvas'); page.width = 2200; page.height = 1700;
        page.getContext('2d').drawImage(image, 0, 0, 2200, 1700);
        const answers = [];
        for (const qr of qrs) {
          const crop = document.createElement('canvas'); crop.width = qr.width * 2; crop.height = qr.height * 2;
          crop.getContext('2d').drawImage(page, qr.x * 2, qr.y * 2, crop.width, crop.height, 0, 0, crop.width, crop.height);
          answers.push((await QrScanner.scanImage(crop, { returnDetailedScanResult: true })).data);
        }
        return answers;
      }, geometry.map(sign => sign.qr));
      assert.deepEqual(decoded, Array(name.includes('single') ? 1 : 2).fill('HTTPS://MEMBERS.EXAMPLE.ORG/L23456789AB'));
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
        else if (pathname === '/api/shops') body = [{ ...shop, canGenerateCheckoutRequiredSheet: permitted }];
        else if (pathname === '/api/admin/shops') {
          const { canGenerateCheckoutRequiredSheet, ...managedShop } = shop;
          body = [managedShop];
        }
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
