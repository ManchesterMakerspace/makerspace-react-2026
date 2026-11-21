// Real shop editor and settings bundle; all APIs are mocked and no external writes occur.
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const root = path.resolve(__dirname, '../..');
const output = path.join(root, 'tmp/reservation-announcements-browser');
const shopId = '0123456789abcdef01234567';
const server = http.createServer((req, res) => {
  const file = path.join(root, 'dist', path.basename(new URL(req.url, 'http://localhost').pathname));
  if (fs.existsSync(file) && fs.statSync(file).isFile()) {
    res.setHeader('Content-Type', file.endsWith('.js') ? 'application/javascript' : file.endsWith('.css') ? 'text/css' : 'image/svg+xml');
    res.end(fs.readFileSync(file));
  } else {
    res.setHeader('Content-Type', 'text/html');
    res.end('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/makerspace-react.css"><script defer src="/makerspace-react.js"></script></head><body></body></html>');
  }
});
(async () => {
  fs.mkdirSync(output, { recursive: true });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ channel: process.platform === 'win32' ? 'msedge' : undefined, headless: true });
  try {
    for (const width of [320, 600, 900, 1280]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      let preference = false, saved, rejectSave = true;
      const member = { id: 'test', firstname: 'Test', lastname: 'Manager', email: 'test@example.com', role: 'resource_manager', status: 'activeMember', memberContractOnFile: true, expirationTime: 4102444800000, resourceManagerShopIds: [shopId] };
      const shop = () => ({ id: shopId, name: 'Woodshop', slackChannel: 'shop-woodworking', disabled: false,
        reservable: false, maxConcurrentReservations: 1, reservationHorizonDays: 7, maxReservationDurationHours: 8,
        reservationPrerequisiteToolIds: [], resourceManagers: [], slackAnnounceEmptyReservations: preference });
      await page.route('**/api/**', async route => {
        const url = new URL(route.request().url());
        let body = [];
        if (url.pathname === '/api/config') body = {};
        else if (url.pathname === '/api/members/sign_in') body = member;
        else if (url.pathname.endsWith('/permissions')) body = {};
        else if (url.pathname === `/api/admin/shops/${shopId}`) {
          saved = route.request().postDataJSON();
          if (rejectSave) { rejectSave = false; return route.fulfill({ status: 422, json: { error: 'Please retry saving the shop.' } }); }
          preference = saved.slack_announce_empty_reservations;
          body = shop();
        } else if (['/api/shops', '/api/admin/shops'].includes(url.pathname)) body = [shop()];
        else if (url.pathname === '/api/admin/google_calendar/colors') body = { colors: [] };
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
      });
      await page.goto(`http://127.0.0.1:${server.address().port}/tool-checkouts`);
      await page.getByRole('tab', { name: 'Shops', exact: true }).click();
      await page.getByRole('row').filter({ hasText: 'Woodshop' }).getByRole('checkbox').check();
      const edit = page.getByRole('button', { name: 'Edit', exact: true });
      await edit.focus(); await page.keyboard.press('Enter');
      const dialog = page.getByRole('dialog', { name: 'Edit Woodshop', exact: true });
      const checkbox = dialog.getByRole('checkbox', { name: 'Announce empty reservation agendas in Slack', exact: true });
      await checkbox.waitFor();
      assert.equal(await checkbox.isChecked(), false);
      await checkbox.focus();
      assert.equal(await checkbox.evaluate(element => element === document.activeElement), true);
      await page.keyboard.press('Space');
      assert.equal(await checkbox.isChecked(), true);
      assert.equal(await dialog.getByRole('checkbox', { name: 'Reservable', exact: true }).isChecked(), false);
      await page.screenshot({ path: path.join(output, `edit-${width}.png`), fullPage: true, animations: 'disabled' });
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `page overflow at ${width}`);
      assert(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth + 1), `dialog overflow at ${width}`);
      await dialog.getByRole('button', { name: 'Save Shop', exact: true }).click();
      await dialog.getByText('Please retry saving the shop.', { exact: true }).waitFor();
      assert.equal(await checkbox.isChecked(), true);
      await dialog.getByRole('button', { name: 'Save Shop', exact: true }).click();
      await dialog.waitFor({ state: 'hidden' });
      assert.equal(saved.slack_announce_empty_reservations, true);
      await page.getByRole('row').filter({ hasText: 'Woodshop' }).getByRole('checkbox').check();
      await edit.click();
      await checkbox.waitFor();
      assert.equal(await checkbox.isChecked(), true);
      await checkbox.uncheck();
      await dialog.getByRole('button', { name: 'Save Shop', exact: true }).click();
      await dialog.waitFor({ state: 'hidden' });
      assert.equal(saved.slack_announce_empty_reservations, false);
      assert.deepEqual(errors, []);
      await page.close();
    }
    console.log('Reservation announcements: RM shop editing, default off, keyboard toggling, save/reload, failed-save recovery and 320/600/900/1280px overflow checks passed');
  } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
