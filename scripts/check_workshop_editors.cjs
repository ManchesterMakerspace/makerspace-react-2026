const fs = require('fs');
const path = require('path');
const http = require('http');
const assert = require('node:assert/strict');
const webpack = require('webpack');
const { chromium } = require('@playwright/test');
const root = path.resolve(__dirname, '..');
const output = path.join(root, '.cache/workshop-editors-ui');
const config = require('../prod.config.js')({});
config.mode = 'development';
config.entry = path.join(root, 'tests/fixtures/workshop-editors-entry.tsx');
config.plugins.push(new webpack.NormalModuleReplacementPlugin(/[\\/]useReadTransaction(?:\.ts)?$/, path.join(root, 'tests/fixtures/empty-read-transaction.ts')));
config.output = { ...config.output, path: output, clean: true };
config.optimization = { minimize: false }; config.devtool = false;
async function main() {
  await new Promise((resolve, reject) => webpack(config, (error, stats) => {
    if (error || stats.hasErrors()) reject(error || Error(stats.toString({ all: false, errors: true })));
    else resolve();
  }));
  const requests = [];
  let failLoad = false, failSave = false, failNotes = false;
  let privileged = true;
  const settings = { reservable: true, maxConcurrentReservations: 3, reservationHorizonDays: 11,
    minimumAdvanceNoticeHours: 4, maxReservationDurationHours: 6, reservationRequiresApproval: true,
    reservationPrerequisiteToolIds: [], durationFees: [] };
  const shop = { id: 'shop', name: 'Woodworking', wikiUrl: 'https://example.test/wood', wikiUrlOverride: 'https://example.test/custom',
    slackChannel: '#wood', colorId: '1', resourceManagers: [], disabled: false, ...settings };
  const tool = { id: 'tool', name: 'Lathe', shopId: 'shop', shopName: 'Woodworking', wikiUrl: 'https://example.test/lathe',
    wikiUrlOverride: 'https://example.test/custom-lathe', gdriveId: 'drive-folder', notes: 'Lock 1234', announce: true,
    announceChannel: '#announcements', usersChannel: '#lathe-users', outOfService: true,
    prerequisiteIds: [], prerequisiteNames: [], disabled: false, ...settings };
  const server = http.createServer((req, res) => {
    if (req.url.startsWith('/api/')) {
      let body = ''; req.on('data', chunk => body += chunk); req.on('end', () => {
        requests.push({ url: req.url, method: req.method, body: body ? JSON.parse(body) : null });
        res.setHeader('Content-Type', 'application/json');
        if (req.url === '/api/tools/tool/coreq.html') { res.end(JSON.stringify({ tool, eligible: true })); return; }
        if (req.method !== 'GET') {
          if (failSave) { failSave = false; res.writeHead(503).end('{"error":"Save failed"}'); return; }
          if (req.url.endsWith('/notes') && failNotes) { failNotes = false; res.writeHead(503).end('{"error":"Notes failed"}'); return; }
          res.end('{}'); return;
        }
        if (req.url === '/api/admin/shops' && failLoad) { failLoad = false; res.writeHead(503).end('{"error":"Settings unavailable"}'); return; }
        if (req.url === '/api/workshops') { res.end(JSON.stringify({ canAddShop: privileged, workshops: [{
          ...shop, outOfService: true, outOfServiceNote: 'Water leak', isShopManager: privileged, canAddTool: privileged,
          reservationsAvailable: false, resourceManagersWikiUrl: 'https://example.test/rm',
          upcomingVolunteerEvents: [], volunteerTasks: [], tools: [{ ...tool, checkoutRequestable: false, reservationAvailable: false }]
        }] })); return; }
        if (req.url === '/api/admin/shops') { res.end(JSON.stringify(privileged ? [shop] : [])); return; }
        if (req.url === '/api/admin/tools') { res.end(JSON.stringify([tool])); return; }
        if (req.url.startsWith('/api/admin/google_calendar/colors')) { res.end(JSON.stringify({ colors: [{ id: '1', name: 'Blue', backgroundColor: '#1976d2', foregroundColor: '#ffffff' }] })); return; }
        res.end('[]');
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
    const origin = `http://127.0.0.1:${server.address().port}`;
    for (const width of [320, 600, 900, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(`${origin}/workshops`);
      await page.getByText(/Shop out of service/).waitFor();
      failLoad = width === 320;
      await page.getByRole('button', { name: 'Edit', exact: true }).click();
      if (width === 320) {
        await page.getByText('Settings unavailable', { exact: true }).waitFor();
        assert.equal(await page.getByRole('button', { name: 'Save Shop' }).count(), 0);
        await page.getByRole('button', { name: 'Retry', exact: true }).click();
      }
      await page.getByRole('textbox', { name: 'Shop Name' }).waitFor();
      await page.getByRole('combobox', { name: 'Resource Managers' }).waitFor();
      assert.equal(await page.getByRole('spinbutton', { name: 'Max concurrent reservations' }).inputValue(), '3');
      assert.equal(await page.getByRole('textbox', { name: 'Wiki URL' }).inputValue(), shop.wikiUrlOverride);
      await page.getByRole('textbox', { name: 'Shop Name' }).fill('Woodworking renamed');
      await page.screenshot({ path: path.join(output, `shop-${width}.png`), fullPage: true });
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Shop overflow ${width}`);
      failSave = width === 320;
      await page.getByRole('button', { name: 'Save Shop' }).click();
      if (width === 320) {
        await page.getByText('Save failed', { exact: true }).waitFor();
        assert.equal(await page.getByRole('textbox', { name: 'Shop Name' }).inputValue(), 'Woodworking renamed');
        await page.getByRole('button', { name: 'Save Shop' }).click();
      }
      await page.getByRole('dialog').waitFor({ state: 'hidden' });
      const shopSave = requests.filter(r => r.method === 'PUT' && r.url === '/api/admin/shops/shop').at(-1).body;
      assert.equal(shopSave.reservation_horizon_days, 11); assert.equal(shopSave.name, 'Woodworking renamed');
      await page.getByRole('tab', { name: 'Tools', exact: true }).click();
      await page.getByText('Out of service', { exact: true }).waitFor();
      await page.getByRole('button', { name: 'Edit tool', exact: true }).click();
      const name = page.getByRole('textbox', { name: 'Tool name', exact: true });
      await name.waitFor();
      assert.equal(await page.getByRole('textbox', { name: 'Notes', exact: true }).inputValue(), 'Lock 1234');
      assert.equal(await page.getByRole('textbox', { name: 'Announce channel' }).inputValue(), '#announcements');
      assert.equal(await page.getByRole('spinbutton', { name: 'Days reservable in advance' }).inputValue(), '11');
      await name.fill('Lathe renamed');
      await page.getByRole('textbox', { name: 'Notes', exact: true }).fill('Lock 5678');
      await page.screenshot({ path: path.join(output, `tool-${width}.png`), fullPage: true });
      assert(await page.getByRole('dialog').evaluate(e => e.scrollWidth <= e.clientWidth + 1), `Tool overflow ${width}`);
      failNotes = width === 320;
      await page.getByRole('button', { name: 'Save', exact: true }).click();
      if (width === 320) {
        await page.getByText(/Tool settings saved, but notes could not be saved/).waitFor();
        await page.getByRole('button', { name: 'Save', exact: true }).click();
      }
      await page.getByRole('dialog').waitFor({ state: 'hidden' });
      const toolSave = requests.filter(r => r.method === 'PUT' && r.url === '/api/admin/tools/tool').at(-1).body;
      assert.equal(toolSave.name, 'Lathe renamed'); assert.equal(toolSave.gdrive_id, 'drive-folder');
      assert.equal(toolSave.reservation_horizon_days, 11);
      assert.equal(requests.filter(r => r.url.endsWith('/notes')).at(-1).body.notes, 'Lock 5678');
    }
    await page.goto(`${origin}/workshops?role=resource_manager`);
    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    await page.getByRole('button', { name: 'Save Shop' }).waitFor();
    assert.equal(await page.getByRole('combobox', { name: 'Resource Managers' }).count(), 0);
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    privileged = false;
    const before = requests.filter(r => r.url === '/api/admin/shops').length;
    await page.goto(`${origin}/workshops?role=member`);
    await page.getByRole('tab', { name: 'Tools', exact: true }).click();
    assert.equal(await page.getByRole('button', { name: 'Edit tool', exact: true }).count(), 0);
    assert.equal(await page.getByRole('button', { name: 'Restore service', exact: true }).count(), 0);
    assert.equal(requests.filter(r => r.url === '/api/admin/shops').length, before);
    for (const width of [320, 600, 900, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(`${origin}/tools/tool/request-checkout`);
      const dialog = page.getByRole('dialog', { name: 'Request Checkout: Lathe' });
      await dialog.getByText('Out of service', { exact: true }).waitFor();
      assert(await dialog.getByRole('button', { name: 'Submit Request' }).isEnabled());
      assert(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth + 1));
      await page.screenshot({ path: path.join(output, `checkout-outage-${width}.png`) });
    }
    assert.deepEqual(errors, []);
    console.log('Workshop shared editors passed at 320/600/900/1440px: full settings, status, save/retry, partial notes failure, RM and member permissions.');
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
