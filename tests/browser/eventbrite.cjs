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
    await page.clock.setFixedTime(new Date('2026-08-31T23:30:00-04:00'));
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    let fail = true, historyCalls = 0, role = 'resource_manager', pending = false, savedSource;
    const member = () => ({ id: 'member1', firstname: 'Test', lastname: 'Member', email: 'test@example.com', role, status: 'activeMember', memberContractOnFile: true, expirationTime: 4102444800000, signupSourcePromptPending: pending });
    const record = { id: 'record1', organizationId: 'org1', eventbriteId: 'event1', name: 'Introduction to Welding Saturday January 9 2027', startsAt: '2027-01-09T23:00:00Z', endsAt: '2027-01-10T02:00:00Z', timezone: 'America/New_York', status: 'live' };
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
    await page.getByRole('heading', { name: record.name, exact: true }).waitFor();
    assert.equal(await page.getByText(/Jan 9, 2027/).count(), 0, 'same-day date is already in the title');
    assert.equal(await page.getByText(record.name, { exact: true }).count(), 1);
    const from = page.getByLabel('From', { exact: true });
    const to = page.getByLabel('To', { exact: true });
    assert.equal(await from.inputValue(), '2026-08-31');
    assert.equal(await to.inputValue(), '2027-02-28');
    async function checkFilters(tab, action, expected) {
      const received = page.waitForRequest(req => new URL(req.url()).pathname === '/api/admin/eventbrite/' + tab);
      await action();
      const query = new URL((await received).url()).searchParams;
      assert.deepEqual(['from_date', 'to_date', 'exclude_open_house', 'pageNum'].map(key => query.get(key)), [...expected, '0']);
    }
    await checkFilters('orders', () => page.getByRole('tab', { name: 'Orders' }).click(), ['2026-08-31', '2027-02-28', 'true']);
    await checkFilters('orders', () => page.getByRole('button', { name: 'Show all dates' }).click(), [null, null, 'true']);
    assert.equal(await from.inputValue(), '');
    assert.equal(await to.inputValue(), '');
    await checkFilters('attendees', () => page.getByRole('tab', { name: 'Attendees' }).click(), [null, null, 'true']);
    await checkFilters('attendees', () => page.getByRole('button', { name: 'Show Open House' }).press('Enter'), [null, null, null]);
    await checkFilters('attendees', () => from.fill('2026-12-01'), ['2026-12-01', null, null]);
    await to.fill('2026-11-30');
    await page.getByText('From must be on or before To.').waitFor();
    await checkFilters('attendees', () => to.fill('2026-12-31'), ['2026-12-01', '2026-12-31', null]);
    await checkFilters('events', () => page.getByRole('tab', { name: 'Events' }).click(), ['2026-12-01', '2026-12-31', null]);
    await checkFilters('events', () => page.getByRole('button', { name: 'Hide Open House' }).click(), ['2026-12-01', '2026-12-31', 'true']);
    for (const width of [320, 600, 900, 1280]) {
      await page.setViewportSize({ width, height: 1000 });
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `filter overflow at ${width}`);
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
