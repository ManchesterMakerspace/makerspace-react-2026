// Production bundle, mocked API, disposable browser; no external writes.
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const root = path.resolve(__dirname, '../..');
const output = path.join(root, 'tmp/eventbrite-browser');
const html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/assets/makerspace-react.css"><script defer src="/assets/makerspace-react.js"></script></head><body></body></html>';
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const file = path.join(root, 'dist', path.basename(url.pathname));
  if (url.pathname.startsWith('/assets/') && fs.existsSync(file)) {
    res.setHeader('Content-Type', file.endsWith('.js') ? 'application/javascript' : file.endsWith('.css') ? 'text/css' : 'image/svg+xml');
    res.end(fs.readFileSync(file));
  } else { res.setHeader('Content-Type', 'text/html'); res.end(html); }
});
(async () => {
  fs.mkdirSync(output, { recursive: true });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ channel: process.platform === 'win32' ? 'msedge' : undefined, headless: true });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    let fail = true, historyCalls = 0, role = 'resource_manager', pending = false, savedSource;
    const member = () => ({ id: 'member1', firstname: 'Test', lastname: 'Member', email: 'test@example.com', role, status: 'activeMember', memberContractOnFile: true, expirationTime: 4102444800000, signupSourcePromptPending: pending });
    const record = { id: 'record1', organizationId: 'org1', eventbriteId: 'event1', name: 'Introduction to Welding', startsAt: '2026-11-13T15:00:00Z', timezone: 'America/New_York', status: 'ended' };
    await page.route('**/api/**', async route => {
      const url = new URL(route.request().url());
      let body = [], status = 200;
      if (url.pathname === '/api/config') body = {};
      else if (url.pathname === '/api/members/sign_in') body = member();
      else if (url.pathname.endsWith('/permissions')) body = {};
      else if (url.pathname === '/api/signup_events') body = [{ ...record, id: 'local-event' }];
      else if (url.pathname === '/api/signup_source') {
        assert.equal(route.request().method(), 'PUT');
        savedSource = route.request().postDataJSON(); pending = false; body = member();
      }
      else if (url.pathname.startsWith('/api/admin/eventbrite/')) {
        historyCalls++;
        if (fail) { status = 503; body = { error: 'Retry' }; fail = false; }
        else body = url.pathname.endsWith('/record1') ? { ...record, ticketClasses: [{ ...record, id: 'ticket1', name: 'General Admission' }] } : [record];
      } else if (url.pathname === '/api/home') body = { member: member(), slack: {}, availableCheckouts: [], availableVolunteerOpportunities: [] };
      await route.fulfill({ status, contentType: 'application/json', headers: { 'total-items': '1' }, body: JSON.stringify(body) });
    });
    const base = `http://127.0.0.1:${server.address().port}`;
    await page.goto(`${base}/admin/eventbrite`);
    try { await page.getByRole('button', { name: 'Retry', exact: true }).click(); }
    catch (error) { console.error('Page:', page.url(), await page.locator('body').innerText(), errors); throw error; }
    await page.getByRole('heading', { name: record.name }).waitFor();
    for (const width of [320, 600, 900, 1280]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.getByRole('button', { name: 'View details' }).click();
      await page.getByRole('heading', { name: 'General Admission' }).waitFor();
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `overflow at ${width}`);
      await page.screenshot({ path: path.join(output, `details-${width}.png`), fullPage: true, animations: 'disabled' });
      await page.getByRole('button', { name: 'Close', exact: true }).focus();
      await page.keyboard.press('Enter');
    }
    role = 'member'; const before = historyCalls;
    await page.goto(`${base}/admin/eventbrite`);
    await page.waitForTimeout(1500);
    assert.equal(historyCalls, before, 'ordinary member must not fetch history');
    pending = true;
    await page.goto(`${base}/home`);
    await page.getByRole('heading', { name: 'Welcome to the makerspace', exact: true }).waitFor();
    await page.getByRole('combobox', { name: 'How did you hear about us? (optional)' }).click();
    await page.getByRole('option', { name: /Introduction to Welding/ }).click();
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.waitForFunction(() => !document.body.innerText.includes('Welcome to the makerspace'));
    assert.deepEqual(savedSource, { signupSource: 'eventbrite', signupEventbriteEventId: 'local-event' });
    pending = true;
    await page.goto(`${base}/home`);
    await page.getByRole('button', { name: 'Skip this question', exact: true }).click();
    await page.waitForFunction(() => !document.body.innerText.includes('Welcome to the makerspace'));
    assert.equal(savedSource.signupSource, '');
    assert.deepEqual(errors, []);
    console.log('Eventbrite retry, details, keyboard, role gating, provider answer/skip and 320/600/900/1280 layouts passed');
  } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
