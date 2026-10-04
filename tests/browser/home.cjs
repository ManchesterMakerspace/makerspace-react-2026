// Build web assets first. Uses mocked APIs and a disposable browser only.
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'commonjs', rootDir: path.resolve(__dirname, '../..'), ignoreDeprecations: '6.0' } });
const { AuthPage } = require('../e2e/pages/AuthPage.ts');
const { MemberPage } = require('../e2e/pages/MemberPage.ts');
const { SettingsPage } = require('../e2e/pages/SettingsPage.ts');
const { MemberRentalsPage } = require('../e2e/pages/MemberRentalsPage.ts');
const root = path.resolve(__dirname, '../..');
const screenshotDir = path.join(root, 'tmp/home-browser');
const toolId = '0123456789abcdef01234567';
const volunteerCreditTiming = 'Volunteer credits are applied in the month following the activity date. For example, a task completed in April is reflected in your May credit totals.';
const volunteerReviewGuidance = 'Please wait for a volunteer approver to review your activity. Our approvers are unpaid volunteers and will review it when they can. Thank you for your patience.';
const member = { id: 'member1', email: 'test@example.com', firstname: 'Test', lastname: 'Member', role: 'member', status: 'activeMember', memberContractOnFile: true, subscription: true, expirationTime: 4102444800000, address: { street: '12 Main St', city: 'Manchester', state: 'NH', postalCode: '03101' } };
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
  const claimedOpportunities = new Set();
  let failClaim = !!options.failClaimOnce;
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
    } else if (url.pathname === '/api/members/sign_out') {
      authenticated = false; body = {};
    } else if (url.pathname === '/api/members/totp_sessions') {
      authenticated = true; body = sessionMember;
    } else if (url.pathname.endsWith('/permissions')) body = { billing: true };
    else if (url.pathname === '/api/home') {
      homeLoads++;
      body = {
        member: sessionMember,
        slack: { accepted: !!options.acceptedSlack, newMembersChannelUrl: options.acceptedSlack ? 'https://slack.com/app_redirect?team=T1&channel=new_members' : null },
        availableCheckouts: requested ? [] : [{ id: toolId, name: 'Orientation', shopName: 'Facilities', requestorAnnotation: 'Bring your photo ID. Meet the team near the front door.\nAllow enough time for your in-person orientation and access card.' }],
        availableVolunteerOpportunities: (options.opportunities || []).filter(item => !claimedOpportunities.has(`${item.kind}-${item.id}`)),
      };
    } else if (/^\/api\/volunteer\/tasks\/[^/]+\/claim$/.test(url.pathname)) {
      assert.equal(req.method(), 'POST');
      if (failClaim) { failClaim = false; status = 422; body = { error: 'This task is temporarily unavailable. Please retry.' }; }
      else { claimedOpportunities.add(`task-${url.pathname.split('/')[4]}`); body = { id: 'claim1' }; }
    } else if (/^\/api\/volunteer\/events\/[^/]+\/checkin$/.test(url.pathname)) {
      assert.equal(req.method(), 'POST');
      claimedOpportunities.add(`event-${url.pathname.split('/')[4]}`); body = { id: 'event1' };
    } else if (url.pathname === '/api/invoices' && url.searchParams.has('pastDue')) {
      assert.equal(url.searchParams.get('settled'), 'false');
      assert.equal(url.searchParams.get('pastDue'), 'true');
      assert.equal(url.searchParams.get('orderBy'), 'due_date');
      assert.equal(url.searchParams.get('order'), 'asc');
      headers['total-items'] = '2';
      body = [{ id: url.searchParams.get('pageNum') === '1' ? 'invoice2' : 'invoice1', name: url.searchParams.get('pageNum') === '1' ? 'Automatic monthly membership' : 'Orientation membership dues', memberId: member.id, memberName: 'Test Member', resourceClass: 'member', dueDate: Date.now() - 86400000, pastDue: true, amount: '65.00', settled: false, subscriptionId: url.searchParams.get('pageNum') === '1' ? 'subscription1' : null }];
    } else if (url.pathname.endsWith('/coreq.html')) body = { tool: { id: toolId, name: 'Orientation' }, eligible: !requested };
    else if (url.pathname === '/api/tool_checkout_requests' && req.method() === 'POST') { requested = true; body = { id: 'request1' }; }
    else if (url.pathname === `/api/members/${member.id}` || url.pathname === `/api/admin/members/${member.id}`) body = sessionMember;
    else if (/invoices|rentals|tool_checkouts|reports|shops/.test(url.pathname)) body = [];
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
      const rentalPage = await browser.newPage({ viewport: { width, height: 1000 } });
      const state = await mockApi(rentalPage);
      let signed = false;
      await rentalPage.route('**/api/documents/rental_agreement?*', route => route.fulfill({
        contentType: 'text/html', body: '<h1>Rental agreement</h1><p>Test rental terms.</p>',
      }));
      await rentalPage.route('**/api/rentals/rental1', route => {
        if (route.request().method() === 'PUT') {
          assert.match(route.request().postDataJSON().signature, /^data:image\/png;base64,/);
          signed = true;
        }
        return route.fulfill({ json: { id: 'rental1', memberId: member.id, status: signed ? 'active' : 'pending_agreement', contractOnFile: signed } });
      });
      await rentalPage.route('**/api/invoices?*', route => route.fulfill({
        headers: { 'total-items': signed ? '1' : '0' },
        json: signed ? [{ id: 'rental-invoice', memberId: member.id, name: 'GT1 rental', resourceClass: 'rental', dueDate: Date.now() - 1000, pastDue: true, amount: '10.00', settled: false }] : [],
      }));
      await rentalPage.goto(`${base}/agreements/rental/rental1`);
      const rentals = new MemberRentalsPage(rentalPage);
      await rentals.acceptAndSignAgreement();
      await rentals.clickProceed();
      await rentalPage.getByRole('cell', { name: '$10.00', exact: true }).waitFor();
      const pay = rentalPage.getByRole('button', { name: 'Pay Selected Dues', exact: true });
      await pay.waitFor();
      await pay.focus();
      assert(await pay.evaluate(element => element === document.activeElement));
      await pay.click();
      await rentalPage.waitForURL(`${base}/checkout`);
      assert.equal(signed, true);
      assert.equal(state.homeLoads(), 0, 'Signing a rental agreement must not load Home');
      await rentalPage.close();
      console.log(`PASS rental agreement returns to Dues and rental payment at ${width}px`);
    }

    for (const width of [320, 600, 900, 1280]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await mockApi(page, { member: { status: 'pending', expirationTime: null } });
      await page.goto(`${base}/home?newMember=true`);
      await page.getByRole('heading', { name: 'Welcome!', exact: true }).waitFor();
      await page.getByRole('link', { name: 'Request Safety Checkout for Orientation' }).waitFor();
      await page.getByRole('button', { name: 'Pay invoice Orientation membership dues' }).waitFor();
      assert.equal(await page.getByRole('link', { name: 'Account Settings', exact: true }).getAttribute('href'), '/members/member1/settings');
      assert((await page.locator('main').innerText()).includes('Annotation for requestors'));
      assert(!(await page.locator('main').innerText()).includes('Upcoming'));
      assert.equal(await page.getByRole('heading', { name: 'Available Volunteer Opportunities', exact: true }).count(), 0);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Overflow at ${width}px`);
      const checkout = page.getByRole('link', { name: 'Request Safety Checkout for Orientation' });
      await checkout.focus();
      assert(await checkout.evaluate(element => element === document.activeElement));
      await page.keyboard.press('Tab');
      assert(await page.evaluate(() => document.activeElement.tagName === 'BUTTON'));
      await page.screenshot({ path: path.join(screenshotDir, `welcome-${width}.png`), fullPage: true });
      await page.getByRole('button', { name: 'Menu', exact: true }).click();
      const menu = page.locator('#menu-appbar');
      assert.equal(await menu.getByText('Account Settings', { exact: true }).count(), 0);
      assert.equal(await menu.getByText('Personal Information', { exact: true }).count(), 0);
      const links = await menu.locator('a').allTextContents();
      assert.equal(links[links.indexOf('Subscriptions') + 1], 'Payment Methods');
      await page.keyboard.press('Escape');
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
      if (scenario.role === 'admin') {
        await page.goto(`${base}/home`);
        await page.getByRole('link', { name: 'Account Settings', exact: true }).waitFor();
        await page.getByRole('button', { name: 'Menu', exact: true }).click();
        const menu = page.locator('#menu-appbar');
        const links = await menu.locator('a').allTextContents();
        assert.equal(links[links.indexOf('Subscriptions') + 1], 'Payment Methods');
        assert.equal(await menu.getByText('Account Settings', { exact: true }).count(), 0);
      }
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

    // Exercise the same page objects as the Rails-backed E2E suites. Login must
    // leave regular members on Home; profile-based tests navigate explicitly.
    for (const scenario of [
      { role: 'member', status: 'activeMember', authenticated: false },
      { role: 'member', status: 'pending', authenticated: false },
      { role: 'member', status: 'activeMember', authenticated: true },
      { role: 'admin', status: 'activeMember', authenticated: false },
      { role: 'board_member', status: 'activeMember', authenticated: false },
      { role: 'resource_manager', status: 'activeMember', authenticated: false },
    ]) {
      const helperPage = await browser.newPage({ baseURL: base });
      await mockApi(helperPage, { authenticated: scenario.authenticated, member: { role: scenario.role, status: scenario.status } });
      const auth = new AuthPage(helperPage);
      const profile = new MemberPage(helperPage);
      const settings = new SettingsPage(helperPage);
      await auth.signIn(member.email, 'Password123');
      const expected = scenario.role !== 'member' ? `/members/${member.id}` : scenario.status === 'pending' ? '/home?newMember=true' : '/home';
      assert.equal(new URL(helperPage.url()).pathname + new URL(helperPage.url()).search, expected);
      await settings.goto();
      assert.equal(new URL(helperPage.url()).pathname, `/members/${member.id}/settings`);
      await settings.goto(); // Returning to settings must not need a removed menu link.
      await helperPage.goto('/home');
      await profile.gotoOwnProfile();
      assert.equal(new URL(await profile.getProfileUrl()).pathname, `/members/${member.id}`);
      await helperPage.close();
      console.log(`PASS E2E page helpers: ${scenario.role}/${scenario.status}${scenario.authenticated ? ' restored session' : ''}`);
    }

    for (const width of [320, 600, 900, 1280]) {
      const volunteer = await browser.newPage({ viewport: { width, height: 1000 } });
      const errors = [];
      volunteer.on('pageerror', error => errors.push(error.message));
      const state = await mockApi(volunteer, { failClaimOnce: true, opportunities: [
        { id: 'task1', kind: 'task', title: 'Organize shared supplies', description: 'Sort the storage bins and label supplies for your fellow members.\nReturn spare tools to the shop.', creditValue: 1, shopName: 'Woodshop', eventDate: null },
        { id: 'event1', kind: 'event', title: 'Help at the community open house', description: 'Welcome visitors and help demonstrate projects.', creditValue: 2, shopName: null, eventDate: '2030-10-05' },
      ] });
      await volunteer.goto(`${base}/home`);
      await volunteer.getByRole('button', { name: 'Claim Task: Organize shared supplies', exact: true }).waitFor();
      assert.deepEqual(await volunteer.locator('main h2').allTextContents(), ['Available Volunteer Opportunities', 'Available safety checkouts', 'Open unpaid invoices']);
      assert((await volunteer.locator('main').innerText()).includes('05 Oct 2030'));
      assert(await volunteer.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Volunteer overflow at ${width}px`);
      await volunteer.screenshot({ path: path.join(screenshotDir, `volunteer-${width}.png`), fullPage: true });
      const claim = volunteer.getByRole('button', { name: 'Claim Task: Organize shared supplies', exact: true });
      await claim.focus();
      await volunteer.keyboard.press('Enter');
      await volunteer.getByText('This task is temporarily unavailable. Please retry.', { exact: true }).waitFor();
      await claim.click();
      const taskConfirmation = "Task claimed: Organize shared supplies. When you finish the work, mark it complete in your profile's Volunteer tab.";
      const taskNotice = volunteer.getByRole('status').filter({ hasText: taskConfirmation });
      await taskNotice.getByText(taskConfirmation, { exact: true }).waitFor();
      await taskNotice.getByText(volunteerCreditTiming, { exact: true }).waitFor();
      await taskNotice.getByText(volunteerReviewGuidance, { exact: true }).waitFor();
      await claim.waitFor({ state: 'detached' });
      assert(await volunteer.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Task confirmation overflow at ${width}px`);
      await volunteer.getByRole('button', { name: 'Join Event: Help at the community open house', exact: true }).click();
      const eventConfirmation = 'Joined event: Help at the community open house. Event credits are issued after staff closes the event.';
      const eventNotice = volunteer.getByRole('status').filter({ hasText: eventConfirmation });
      await eventNotice.getByText(eventConfirmation, { exact: true }).waitFor();
      await eventNotice.getByText(volunteerCreditTiming, { exact: true }).waitFor();
      await eventNotice.getByText(volunteerReviewGuidance, { exact: true }).waitFor();
      await volunteer.getByRole('heading', { name: 'Available Volunteer Opportunities', exact: true }).waitFor({ state: 'detached' });
      assert((await eventNotice.innerText()).includes(volunteerCreditTiming), 'Claim guidance must remain visible after the opportunities disappear');
      assert(await volunteer.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Event confirmation overflow at ${width}px`);
      assert(state.homeLoads() >= 3);
      assert.deepEqual(errors, []);
      await volunteer.close();
      console.log(`PASS volunteer claims, retries, refresh and layout at ${width}px`);
    }

    for (const width of [320, 600, 900, 1280]) {
      const signup = await browser.newPage({ viewport: { width, height: 1000 } });
      await mockApi(signup, { authenticated: false });
      await signup.goto(`${base}/signup`);
      const postal = signup.getByRole('textbox', { name: 'Postal Code', exact: false });
      await postal.fill('031010123');
      assert.equal(await postal.inputValue(), '03101-0123');
      await postal.fill('ab03101');
      assert.equal(await postal.inputValue(), '03101');
      await postal.fill('03101--12');
      assert.equal(await postal.inputValue(), '03101-12');
      await postal.focus();
      await signup.keyboard.press('End');
      await signup.keyboard.type('34');
      assert.equal(await postal.inputValue(), '03101-1234');
      await signup.keyboard.type('5x-');
      assert.equal(await postal.inputValue(), '03101-1234');
      await signup.keyboard.press('Tab');
      const phone = signup.getByRole('textbox', { name: 'Phone Number', exact: true });
      assert.equal(await phone.inputValue(), '');
      assert.equal(await phone.getAttribute('required'), null);
      await phone.fill('call +1 (603) 555-0123!');
      assert.equal(await phone.inputValue(), ' +1 (603) 555-0123');
      await phone.press('End');
      await signup.keyboard.type('x/.#');
      assert.equal(await phone.inputValue(), ' +1 (603) 555-0123');
      await phone.fill('');
      assert.equal(await phone.inputValue(), '');
      await signup.getByRole('textbox', { name: 'Email', exact: true }).fill('foobar@example.com');
      const password = signup.getByLabel('Password', { exact: false });
      for (const value of ['foobar@example.com1', '123FOOBAR@EXAMPLE.COM567']) {
        await password.fill(value);
        await signup.getByText('Guessable', { exact: true }).waitFor();
        assert.equal(await signup.getByRole('progressbar').getAttribute('aria-valuenow'), '25');
      }
      await signup.getByRole('textbox', { name: 'Email', exact: true }).fill('other@example.com');
      await signup.getByText('Strong', { exact: true }).waitFor();
      await signup.getByRole('textbox', { name: 'Email', exact: true }).fill('foobar@example.com');
      await signup.getByText('Guessable', { exact: true }).waitFor();
      assert(await signup.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Signup overflow at ${width}px`);
      await signup.screenshot({ path: path.join(screenshotDir, `signup-${width}.png`), fullPage: true });
      await signup.close();
      console.log(`PASS signup ZIP, optional phone, email-based password strength and layout at ${width}px`);
    }
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
