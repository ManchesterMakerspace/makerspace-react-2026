// Build web assets first. Uses mocked APIs and a disposable browser only.
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const root = path.resolve(__dirname, '../..');
const screenshotDir = path.join(root, 'tmp/home-browser');
const toolId = '0123456789abcdef01234567';
const member = { id: 'member1', email: 'test@example.com', firstname: 'Test', lastname: 'Member', role: 'member', status: 'activeMember', memberContractOnFile: true, subscription: true, expirationTime: 4102444800000 };
const html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/assets/makerspace-react.css"><script defer src="/assets/makerspace-react.js"></script></head><body></body></html>';
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost').pathname;
  const file = url === '/assets/FilledLaserableLogo.svg'
    ? path.join(root, '../makerspace-rails-2026/app/assets/images/FilledLaserableLogo.svg')
    : url.startsWith('/assets/') ? path.join(root, 'dist', path.basename(url)) : null;
  if (file && fs.existsSync(file)) {
    res.setHeader('Content-Type', file.endsWith('.css') ? 'text/css' : file.endsWith('.js') ? 'text/javascript' : 'image/svg+xml');
    res.end(fs.readFileSync(file));
  } else { res.setHeader('Content-Type', 'text/html'); res.end(html); }
});

async function mockApi(page, options = {}) {
  let authenticated = options.authenticated !== false;
  let requested = false;
  let homeLoads = 0;
  let sessionMember = { ...member, ...options.member };
  await page.route('**/api/**', async route => {
    const req = route.request();
    const url = new URL(req.url());
    let body = {}, status = 200, headers = {};
    if (url.pathname === '/api/config') body = { wiki_url: '' };
    else if (/invoice_options|billing\/discounts/.test(url.pathname)) body = [];
    else if (url.pathname === '/api/signup_status') body = { locked: false };
    else if (url.pathname === '/api/members/sign_in') {
      if (authenticated) body = sessionMember;
      else if (req.postDataJSON()?.member) {
        if (options.totp) { status = 202; body = { totp_required: true }; }
        else { authenticated = true; body = sessionMember; }
      } else { status = 401; body = { error: 'Sign in required' }; }
    } else if (url.pathname === '/api/members/totp_sessions') {
      authenticated = true; body = sessionMember;
    } else if (url.pathname.endsWith('/permissions')) body = { billing: true };
    else if (url.pathname === '/api/home') {
      homeLoads++;
      body = {
        member: sessionMember,
        slack: { accepted: !!options.acceptedSlack, newMembersChannelUrl: options.acceptedSlack ? 'https://slack.com/app_redirect?team=T1&channel=new_members' : null },
        availableCheckouts: requested ? [] : [{ id: toolId, name: 'Orientation', shopName: 'Facilities', requestorAnnotation: 'Bring your photo ID. Meet the team near the front door.\nAllow enough time for your in-person orientation and access card.' }],
      };
    } else if (url.pathname === '/api/invoices') {
      assert.equal(url.searchParams.get('settled'), 'false');
      assert.equal(url.searchParams.get('orderBy'), 'due_date');
      assert.equal(url.searchParams.get('order'), 'asc');
      headers['total-items'] = '2';
      body = [{ id: url.searchParams.get('pageNum') === '1' ? 'invoice2' : 'invoice1', name: url.searchParams.get('pageNum') === '1' ? 'Automatic monthly membership' : 'Orientation membership dues', memberId: member.id, memberName: 'Test Member', resourceClass: 'member', dueDate: 4102444800000, amount: '65.00', settled: false, subscriptionId: url.searchParams.get('pageNum') === '1' ? 'subscription1' : null }];
    } else if (url.pathname.endsWith('/coreq.html')) body = { tool: { id: toolId, name: 'Orientation' }, eligible: !requested };
    else if (url.pathname === '/api/tool_checkout_requests' && req.method() === 'POST') { requested = true; body = { id: 'request1' }; }
    else if (url.pathname === `/api/members/${member.id}`) body = sessionMember;
    else if (/invoices|rentals|tool_checkouts|reports/.test(url.pathname)) body = [];
    await route.fulfill({ status, contentType: 'application/json', headers, body: JSON.stringify(body) });
  });
  return { homeLoads: () => homeLoads };
}

(async () => {
  fs.mkdirSync(screenshotDir, { recursive: true });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const base = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined), headless: true });
    for (const width of [320, 600, 900, 1280]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await mockApi(page, { member: { status: 'pending', expirationTime: null } });
      await page.goto(`${base}/home?newMember=true`);
      await page.getByRole('heading', { name: 'Welcome!', exact: true }).waitFor();
      await page.getByRole('link', { name: 'Request Safety Checkout for Orientation' }).waitFor();
      await page.getByRole('button', { name: 'Pay invoice Orientation membership dues' }).waitFor();
      assert((await page.locator('main').innerText()).includes('Annotation for requestors'));
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Overflow at ${width}px`);
      const checkout = page.getByRole('link', { name: 'Request Safety Checkout for Orientation' });
      await checkout.focus();
      assert(await checkout.evaluate(element => element === document.activeElement));
      await page.keyboard.press('Tab');
      assert(await page.evaluate(() => document.activeElement.tagName === 'BUTTON'));
      await page.screenshot({ path: path.join(screenshotDir, `welcome-${width}.png`), fullPage: true });
      await page.getByRole('button', { name: 'Next', exact: true }).click();
      await page.getByRole('link', { name: 'Manage Subscription' }).waitFor();
      assert.equal(await page.getByRole('button', { name: /^Pay invoice/ }).count(), 0);
      assert.deepEqual(errors, []);
      await page.close();
      console.log(`PASS Home layout, keyboard and invoices at ${width}px`);
    }

    for (const scenario of [
      { status: 'pending', totp: false, path: '/home?newMember=true' },
      { status: 'activeMember', totp: false, path: '/home' },
      { status: 'pending', totp: true, path: '/home?newMember=true' },
      { status: 'activeMember', role: 'admin', path: `/members/${member.id}` },
    ]) {
      const page = await browser.newPage();
      await mockApi(page, { authenticated: false, totp: scenario.totp, member: { status: scenario.status, role: scenario.role || 'member' } });
      await page.goto(`${base}/`);
      await page.getByRole('link', { name: 'Already a member? Login' }).click();
      await page.getByRole('textbox', { name: 'Email', exact: true }).fill(member.email);
      await page.getByLabel('Password', { exact: false }).fill('Password123');
      await page.getByRole('button', { name: 'Sign In', exact: true }).click();
      if (scenario.totp) {
        await page.getByLabel('Authentication Code').fill('123456');
        await page.getByRole('button', { name: 'Verify', exact: true }).click();
      }
      await page.waitForURL(`${base}${scenario.path}`);
      console.log(`PASS root login ${scenario.role || scenario.status}${scenario.totp ? ' + TOTP' : ''}`);
      await page.close();
    }

    const page = await browser.newPage();
    const state = await mockApi(page, { authenticated: false, acceptedSlack: true });
    await page.goto(`${base}/home?newMember=true`);
    await page.getByRole('textbox', { name: 'Email', exact: true }).fill(member.email);
    await page.getByLabel('Password', { exact: false }).fill('Password123');
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();
    await page.waitForURL(`${base}/home?newMember=true`);
    await page.getByRole('link', { name: 'Get started with Slack' }).waitFor();
    await page.getByRole('link', { name: 'Request Safety Checkout for Orientation' }).click();
    await page.getByRole('dialog').waitFor();
    await page.getByRole('button', { name: 'Submit Request', exact: true }).click();
    await page.getByText('Checkout request submitted.').waitFor();
    await page.getByRole('button', { name: 'Menu', exact: true }).click();
    await page.locator('#home').click();
    await page.getByText('No safety checkouts are currently available', { exact: true }).waitFor();
    assert(state.homeLoads() >= 2);
    await page.screenshot({ path: path.join(screenshotDir, 'membership.png'), fullPage: true });
    console.log('PASS protected Home login, accepted Slack and request/return refresh');
    await page.close();
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
