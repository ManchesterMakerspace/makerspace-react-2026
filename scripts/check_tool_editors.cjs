const fs = require('fs');
const path = require('path');
const http = require('http');
const assert = require('node:assert/strict');
const webpack = require('webpack');
const { chromium } = require('@playwright/test');
const root = path.resolve(__dirname, '..');
const output = path.join(root, '.cache/tool-editors-ui');
const config = require('../prod.config.js')({});
config.mode = 'development';
config.entry = path.join(root, 'tests/fixtures/workshop-editors-entry.tsx');
config.plugins.push(new webpack.NormalModuleReplacementPlugin(/[\\/]useReadTransaction(?:\.ts)?$/, path.join(root, 'tests/fixtures/tool-editor-read-transaction.ts')));
config.output = { ...config.output, path: output, clean: true };
config.optimization = { minimize: false }; config.devtool = false;
async function main() {
  if (!process.argv.includes('--skip-build')) await new Promise((resolve, reject) => webpack(config, (error, stats) => {
    if (error || stats.hasErrors()) reject(error || Error(stats.toString({ all: false, errors: true })));
    else resolve();
  }));
  const settings = { reservable: true, maxConcurrentReservations: 3, reservationHorizonDays: 11,
    minimumAdvanceNoticeHours: 4, prohibitSameDayReservations: true, reservationFullDay: false,
    maxReservationDurationHours: 6, reservationRequiresApproval: true, reservationPrerequisiteToolIds: ['prerequisite'],
    durationFees: [{ invoiceOptionId: 'fee', minimumHours: 2, maximumHours: 4, fullDay: false }] };
  const shop = { id: 'shop', name: 'Woodworking', wikiUrl: 'https://example.test/wood', colorId: '3', resourceManagers: [], disabled: false, ...settings };
  const otherShop = { ...shop, id: 'other-shop', name: 'Metalworking', colorId: '2' };
  const original = { id: 'tool', name: 'Lathe', shopId: 'shop', shopName: 'Woodworking', wikiUrl: 'https://example.test/lathe',
    wikiUrlOverride: '', gdriveId: 'drive-folder', notes: 'Lock 1234', requestorAnnotation: 'Bring wood', announce: true,
    announceChannel: 'announcements', usersChannel: 'lathe-users', disabled: false, open: false, allowPending: true,
    locationId: 'location', locationName: 'Bench', prerequisiteIds: ['prerequisite'], prerequisiteNames: ['Safety prerequisite'], ...settings };
  const requests = [];
  let tool = structuredClone(original), failSave = false, failCatalog = false;
  let failShopCatalog = false, emptyShopCatalog = false, holdShops = false, releaseShops;
  const server = http.createServer((req, res) => {
    if (req.url.startsWith('/api/')) {
      let body = ''; req.on('data', chunk => body += chunk); req.on('end', () => {
        const data = body ? JSON.parse(body) : null;
        requests.push({ url: req.url, method: req.method, body: data });
        res.setHeader('Content-Type', 'application/json');
        if (req.method !== 'GET') {
          if (failSave) { failSave = false; res.writeHead(422).end('{"error":"Save failed"}'); return; }
          if (req.url === '/api/admin/tools/tool') {
            for (const [key, value] of Object.entries(data)) {
              const camel = key.replace(/_([a-z])/g, (_, char) => char.toUpperCase());
              tool[camel === 'wikiUrl' ? 'wikiUrlOverride' : camel] = value;
            }
          }
          res.end(JSON.stringify(tool)); return;
        }
        if (req.url === '/api/workshops') {
          const member = req.headers.referer?.includes('role=member');
          res.end(JSON.stringify({ canAddShop: !member, workshops: [{ ...shop, isShopManager: !member, canAddTool: !member,
            reservationsAvailable: false, resourceManagersWikiUrl: 'https://example.test/rm', upcomingVolunteerEvents: [], volunteerTasks: [],
            // A public summary deliberately omits management settings.
            tools: [{ id: tool.id, name: tool.name, wikiUrl: tool.wikiUrl, prerequisiteNames: [], checkoutRequestable: false, reservationAvailable: false }]
          }] })); return;
        }
        if (req.url === '/api/admin/shops') {
          const respond = () => {
            if (failShopCatalog) { res.writeHead(503).end('{"error":"Shops unavailable"}'); return; }
            res.end(JSON.stringify(emptyShopCatalog ? [] : [shop, otherShop]));
          };
          if (holdShops) releaseShops = respond;
          else respond();
          return;
        }
        if (req.url === '/api/admin/tools') {
          if (failCatalog) { res.writeHead(503).end('{"error":"Settings unavailable"}'); return; }
          res.end(JSON.stringify([tool, { ...original, id: 'prerequisite', name: 'Safety prerequisite', disabled: true, prerequisiteIds: [] }])); return;
        }
        if (req.url.startsWith('/api/admin/locations')) { res.end(JSON.stringify([{ id: 'location', shopId: 'shop', name: 'Bench', toolIds: [], toolNames: [] }])); return; }
        if (req.url.includes('shop_fee')) { res.end(JSON.stringify([{ id: 'fee', name: 'Hourly fee', amount: 10, disabled: false }])); return; }
        if (req.url.startsWith('/api/admin/google_calendar/colors')) {
          res.end(JSON.stringify({ colors: [
            { id: '1', name: 'Available color', backgroundColor: '#1976d2', foregroundColor: '#ffffff' },
            { id: '2', name: 'Metalworking color', backgroundColor: '#791100', foregroundColor: '#ffffff' },
            { id: '3', name: 'Woodworking color', backgroundColor: '#0288d1', foregroundColor: '#ffffff' },
          ] })); return;
        }
        res.end('[]');
      }); return;
    }
    if (req.url.startsWith('/assets/')) {
      const file = path.resolve(output, req.url.slice('/assets/'.length));
      if (!file.startsWith(output + path.sep) || !fs.existsSync(file)) { res.writeHead(404).end(); return; }
      res.setHeader('Content-Type', file.endsWith('.js') ? 'application/javascript' : 'text/css');
      fs.createReadStream(file).pipe(res); return;
    }
    res.setHeader('Content-Type', 'text/html'); res.end(fs.readFileSync(path.join(output, 'index.html')));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) })
    .catch(error => { server.close(); throw error; });
  try {
    const page = await browser.newPage();
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const pendingLabel = 'Allow pending members to request checkout and reservations';
    const openPage = async route => {
      await page.goto(origin + route);
      if (route.startsWith('/workshops')) await page.getByRole('tab', { name: 'Tools', exact: true }).click();
      else await page.getByRole('row').filter({ has: page.getByText(tool.name, { exact: true }) }).getByRole('checkbox').click();
    };
    const verifyCatalogFailures = async () => {
      for (const width of [320, 600, 900, 1440]) {
        await page.setViewportSize({ width, height: 1000 });
        failCatalog = true;
        await openPage('/workshops');
        await page.getByRole('alert').filter({ hasText: 'Tool catalog could not be loaded' }).waitFor();
        assert.equal(await page.getByRole('button', { name: 'Add Tool', exact: true }).count(), 0);
        assert.equal(await page.getByRole('button', { name: 'Edit', exact: true }).count(), 0);
        assert(await page.getByRole('button', { name: 'Add Shop', exact: true }).isEnabled());
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Catalog error overflow ${width}`);
        await page.screenshot({ path: path.join(output, `tool-catalog-failure-${width}.png`), fullPage: true });
        await page.getByRole('button', { name: 'Add Shop', exact: true }).click();
        const dialog = page.getByRole('dialog', { name: 'Add Shop', exact: true });
        assert.equal(await dialog.getByText(/Settings unavailable/).count(), 0, 'Tool error must not become a shop save error');
        // This shop is absent from the public workshop list: validation must use
        // the successfully loaded management catalog, including its colors.
        await dialog.getByRole('textbox', { name: 'Shop Name', exact: true }).fill(' metalWORKING ');
        const beforeCreate = requests.filter(request => request.method === 'POST' && request.url === '/api/admin/shops').length;
        await dialog.getByRole('button', { name: 'Add Shop', exact: true }).click();
        await dialog.getByText('A shop with this name already exists.', { exact: true }).waitFor();
        assert.equal(requests.filter(request => request.method === 'POST' && request.url === '/api/admin/shops').length, beforeCreate);
        await dialog.getByRole('combobox', { name: 'Shop color' }).click();
        await page.getByRole('option', { name: /Available color/ }).waitFor();
        assert.equal(await page.getByRole('option', { name: /Metalworking color|Woodworking color/ }).count(), 0);
        await page.keyboard.press('Escape');
        await dialog.getByRole('heading').scrollIntoViewIfNeeded();
        assert(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth + 1), `Shop dialog overflow ${width}`);
        await page.screenshot({ path: path.join(output, `shop-catalog-preserved-${width}.png`), fullPage: true });
        await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
        await dialog.waitFor({ state: 'hidden' });
        failCatalog = false;
        await page.getByRole('button', { name: 'Retry', exact: true }).focus();
        await page.keyboard.press('Enter');
        await page.getByRole('button', { name: 'Add Tool', exact: true }).waitFor();

        // A missing shop catalog disables shop creation until retry succeeds.
        failShopCatalog = true;
        await openPage('/workshops');
        await page.getByRole('alert').filter({ hasText: 'Shop catalog could not be loaded' }).waitFor();
        assert(await page.getByRole('button', { name: 'Add Shop', exact: true }).isDisabled());
        assert.equal(await page.getByRole('button', { name: 'Add Tool', exact: true }).count(), 0);
        failShopCatalog = false;
        const shopsLoaded = page.waitForResponse(response => response.url().endsWith('/api/admin/shops'));
        await page.getByRole('button', { name: 'Retry', exact: true }).click();
        await shopsLoaded;
        await page.getByRole('button', { name: 'Add Tool', exact: true }).waitFor();
        assert(await page.getByRole('button', { name: 'Add Shop', exact: true }).isEnabled());
      }
      holdShops = true;
      await openPage('/workshops');
      assert(await page.getByRole('button', { name: 'Add Shop', exact: true }).isDisabled());
      assert.equal(await page.getByRole('dialog').count(), 0);
      // Synchronize on the held API request before releasing it.
      await page.waitForFunction(() => document.querySelector('[role="progressbar"]'));
      assert.equal(typeof releaseShops, 'function');
      holdShops = false;
      releaseShops();
      await page.getByRole('button', { name: 'Add Tool', exact: true }).waitFor();
      assert(await page.getByRole('button', { name: 'Add Shop', exact: true }).isEnabled());
      emptyShopCatalog = true;
      await openPage('/workshops');
      await page.waitForFunction(() => {
        const add = [...document.querySelectorAll('button')].find(button => button.textContent === 'Add Shop');
        return add && !add.disabled;
      });
      assert(await page.getByRole('button', { name: 'Add Shop', exact: true }).isEnabled(), 'An empty catalog still allows the first shop');
      emptyShopCatalog = false;
    };
    if (process.argv.includes('--catalogs-only')) {
      await verifyCatalogFailures();
      assert.deepEqual(errors, []);
      console.log('Workshop catalog failures passed at 320/600/900/1440px: shop validation and colors preserved, dependent editors gated, keyboard retry, loading, and empty catalog.');
      return;
    }
    const fields = ['Tool Name', 'Wiki URL', 'GDrive ID', 'Description', 'Annotation for requestors', 'Notes', 'Announce Channel', 'Users Channel'];
    for (const width of [320, 600, 900, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const route of ['/workshops', '/tool-checkouts']) {
        tool = structuredClone(original);
        await openPage(route);
        await page.getByRole('button', { name: 'Edit', exact: true }).click();
        let dialog = page.getByRole('dialog');
        for (const name of fields) await dialog.getByRole('textbox', { name, exact: true }).waitFor();
        assert.equal(await dialog.getByRole('checkbox', { name: pendingLabel }).isChecked(), true);
        assert.equal(await dialog.getByRole('textbox', { name: 'Notes', exact: true }).inputValue(), 'Lock 1234');
        assert.equal(await dialog.getByRole('textbox', { name: 'Annotation for requestors' }).inputValue(), 'Bring wood');
        assert.equal(await dialog.getByRole('spinbutton', { name: 'Days reservable in advance' }).inputValue(), '11');
        await dialog.getByRole('checkbox', { name: pendingLabel }).focus();
        await page.keyboard.press('Space');
        await dialog.getByRole('textbox', { name: 'Notes', exact: true }).fill('');
        await dialog.getByRole('textbox', { name: 'Annotation for requestors' }).fill('');
        await dialog.getByRole('textbox', { name: 'Tool Name', exact: true }).fill('Lathe renamed');
        await dialog.getByRole('heading').scrollIntoViewIfNeeded();
        await page.screenshot({ path: path.join(output, `edit-${route.slice(1)}-${width}.png`), fullPage: true });
        await dialog.getByRole('checkbox', { name: pendingLabel }).scrollIntoViewIfNeeded();
        await page.screenshot({ path: path.join(output, `settings-${route.slice(1)}-${width}.png`), fullPage: true });
        assert(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth + 1), `Dialog overflow ${route} ${width}`);
        const clipped = await dialog.locator('input:not([type=hidden]), textarea, select').evaluateAll(elements => elements.filter(element => {
          const rect = element.getBoundingClientRect();
          return rect.width && (rect.left < 0 || rect.right > innerWidth + 1);
        }).length);
        assert.equal(clipped, 0, `Clipped controls ${route} ${width}`);
        failSave = width === 320;
        await dialog.getByRole('button', { name: 'Save Tool', exact: true }).click();
        if (width === 320) {
          await dialog.getByText('Save failed', { exact: true }).waitFor();
          assert.equal(tool.allowPending, true);
          assert.equal(await dialog.getByRole('checkbox', { name: pendingLabel }).isChecked(), false);
          await dialog.getByRole('button', { name: 'Save Tool', exact: true }).click();
        }
        await dialog.waitFor({ state: 'hidden' });
        const saved = requests.filter(request => request.method === 'PUT' && request.url === '/api/admin/tools/tool').at(-1).body;
        assert.equal(saved.allow_pending, false); assert.equal(saved.notes, ''); assert.equal(saved.requestor_annotation, null);
        assert.equal(saved.reservation_horizon_days, 11); assert.equal(saved.gdrive_id, 'drive-folder');
        assert.deepEqual(saved.prerequisite_ids, ['prerequisite']);
        assert.deepEqual(saved.reservation_prerequisite_tool_ids, ['prerequisite']);
        assert.deepEqual(saved.duration_fees, [{ invoice_option_id: 'fee', minimum_hours: 2, maximum_hours: 4, full_day: false }]);
        await openPage(route);
        await page.getByRole('button', { name: 'Edit', exact: true }).click();
        dialog = page.getByRole('dialog');
        assert.equal(await dialog.getByRole('checkbox', { name: pendingLabel }).isChecked(), false);
        await dialog.getByRole('checkbox', { name: pendingLabel }).check();
        await dialog.getByRole('button', { name: 'Save Tool' }).click();
        await dialog.waitFor({ state: 'hidden' });
        assert.equal(tool.allowPending, true);

        await page.getByRole('button', { name: 'Add Tool', exact: true }).click();
        dialog = page.getByRole('dialog');
        for (const name of fields) await dialog.getByRole('textbox', { name, exact: true }).waitFor();
        assert.equal(await dialog.getByRole('checkbox', { name: pendingLabel }).isChecked(), false);
        await dialog.getByRole('textbox', { name: 'Tool Name', exact: true }).fill('Orientation');
        await dialog.getByRole('checkbox', { name: pendingLabel }).check();
        await dialog.getByRole('textbox', { name: 'Notes', exact: true }).fill('Ask instructor');
        await dialog.getByRole('textbox', { name: 'Annotation for requestors' }).fill('Bring ID');
        await dialog.getByRole('checkbox', { name: 'Reservable', exact: true }).check();
        await dialog.getByRole('spinbutton', { name: 'Days reservable in advance' }).fill('14');
        await page.screenshot({ path: path.join(output, `create-${route.slice(1)}-${width}.png`), fullPage: true });
        assert(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth + 1));
        await dialog.getByRole('button', { name: 'Add Tool', exact: true }).click();
        await dialog.waitFor({ state: 'hidden' });
        const created = requests.filter(request => request.method === 'POST' && request.url === '/api/admin/tools').at(-1).body;
        assert.equal(created.allow_pending, true); assert.equal(created.notes, 'Ask instructor');
        assert.equal(created.requestor_annotation, 'Bring ID'); assert.equal(created.reservation_horizon_days, 14);
        assert.deepEqual(Object.keys(created).sort(), Object.keys(saved).sort());
      }
    }
    // Both editors offer all managed shops and reset shop-scoped selections.
    tool = structuredClone(original);
    await openPage('/workshops');
    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('combobox', { name: 'Shop', exact: true }).selectOption('other-shop');
    await dialog.getByRole('button', { name: 'Save Tool' }).click();
    await dialog.waitFor({ state: 'hidden' });
    const moved = requests.filter(request => request.method === 'PUT').at(-1).body;
    assert.equal(moved.location_id, ''); assert.deepEqual(moved.prerequisite_ids, []); assert.deepEqual(moved.reservation_prerequisite_tool_ids, []);
    await openPage('/workshops?role=member');
    assert.equal(await page.getByRole('button', { name: 'Edit', exact: true }).count(), 0);
    assert.equal(await page.getByRole('button', { name: 'Add Tool', exact: true }).count(), 0);
    failCatalog = true;
    await openPage('/workshops');
    await page.getByText(/Settings unavailable/).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Add Tool', exact: true }).count(), 0);
    failCatalog = false;
    await page.getByRole('button', { name: 'Retry', exact: true }).click();
    await page.getByRole('button', { name: 'Add Tool', exact: true }).waitFor();
    await verifyCatalogFailures();
    assert.equal(requests.filter(request => request.url.endsWith('/notes') && request.method !== 'GET').length, 0);
    assert.deepEqual(errors, []);
    console.log('Both tool create/edit paths passed at 320/600/900/1440px: identical fields, pending access set/clear and reload, notes, annotations, settings preservation, failure retry, shop move, and permissions.');
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
