// Mocked APIs only: exercise the shipped settings bundle without external writes.
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const root = path.resolve(__dirname, '../..');
const server = http.createServer((req, res) => {
  const file = path.join(root, 'dist', path.basename(new URL(req.url, 'http://localhost').pathname));
  if (fs.existsSync(file) && fs.statSync(file).isFile()) {
    res.setHeader('Content-Type', file.endsWith('.js') ? 'application/javascript' : file.endsWith('.css') ? 'text/css' : 'image/svg+xml');
    res.end(fs.readFileSync(file));
  } else {
    res.setHeader('Content-Type', 'text/html');
    res.end('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/makerspace-react.css"><script defer src="/makerspace-react.js"></script></head><body></body></html>');
  }
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ channel: process.platform === 'win32' ? 'msedge' : undefined, headless: true });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    let saved;
    const member = { id: 'test', firstname: 'Test', lastname: 'Admin', email: 'test@example.com', role: 'admin', status: 'activeMember', memberContractOnFile: true, expirationTime: 4102444800000 };
    await page.route('**/api/**', async route => {
      const url = new URL(route.request().url());
      let body = [];
      if (url.pathname === '/api/config') body = {};
      if (url.pathname === '/api/members/sign_in') body = member;
      if (url.pathname.endsWith('/permissions')) body = {};
      if (url.pathname === '/api/admin/system_configs') body = { flags: {}, jobs: [], slack: { slack_channel_upcoming_events: 'upcoming-events', channel_cache: {} }, volunteer: {}, reservation: {}, totp: {}, job_schedule: {} };
      if (url.pathname.endsWith('/update_setting')) { saved = route.request().postDataJSON(); body = saved; }
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/admin/system-settings`);
    const edit = page.getByRole('button', { name: 'Edit Upcoming Events Channel', exact: true });
    try { await edit.waitFor(); }
    catch (error) { console.error(page.url(), await page.locator('body').innerText(), errors); throw error; }
    for (const width of [320, 600, 900, 1280]) {
      await page.setViewportSize({ width, height: 1000 });
      await edit.focus(); await page.keyboard.press('Enter');
      const input = page.getByRole('textbox');
      await input.fill('#workshops');
      await page.getByRole('button', { name: 'Save Upcoming Events Channel', exact: true }).click();
      assert.deepEqual(saved, { key: 'slack_channel_upcoming_events', value: 'workshops' });
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `overflow at ${width}`);
    }
    await edit.click(); await page.getByRole('textbox').fill('');
    await page.getByRole('button', { name: 'Save Upcoming Events Channel', exact: true }).click();
    await page.getByText('upcoming-events', { exact: true }).waitFor();
    assert.deepEqual(errors, []);
    console.log('Upcoming Events Channel: keyboard editing, normalized save, blank default and four responsive widths passed');
  } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
