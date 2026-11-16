// Production bundle, mocked APIs, and a disposable browser; no external writes.
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const root = path.resolve(__dirname, '../..');
require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'commonjs', rootDir: root, ignoreDeprecations: '6.0' } });
const { AuthPage } = require('../e2e/pages/AuthPage.ts');
const { MemberPage } = require('../e2e/pages/MemberPage.ts');
const { BillingPage } = require('../e2e/pages/BillingPage.ts');
const { AdminRentalsPage } = require('../e2e/pages/AdminRentalsPage.ts');
const { AdminToolCheckoutsPage } = require('../e2e/pages/AdminToolCheckoutsPage.ts');
const { AdminVolunteerPage } = require('../e2e/pages/AdminVolunteerPage.ts');
const screenshots = path.join(root, 'tmp/header-menu-browser');
const server = http.createServer((req, res) => {
  const filename = path.basename(new URL(req.url, 'http://localhost').pathname);
  const file = path.join(root, filename === 'FilledLaserableLogo.svg' ? 'src/assets' : 'dist', filename);
  if (fs.existsSync(file) && fs.statSync(file).isFile()) {
    res.setHeader('Content-Type', file.endsWith('.js') ? 'application/javascript' : file.endsWith('.css') ? 'text/css' : 'image/svg+xml');
    res.end(fs.readFileSync(file));
  } else {
    res.setHeader('Content-Type', 'text/html');
    res.end('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/makerspace-react.css"><script defer src="/makerspace-react.js"></script></head><body></body></html>');
  }
});
const cases = [
  { role: 'admin', billing: true, footer: ['Analytics', 'Audit Log', 'Billing', 'Eventbrite', 'Portal Settings'] },
  { role: 'board_member', billing: true, footer: ['Analytics', 'Audit Log', 'Billing', 'Eventbrite'] },
  { role: 'resource_manager', billing: true, footer: ['Eventbrite'] },
  { role: 'member', billing: true, footer: [] },
  { role: 'admin', billing: false, footer: ['Analytics', 'Audit Log', 'Eventbrite', 'Portal Settings'] },
];

(async () => {
  fs.mkdirSync(screenshots, { recursive: true });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ channel: process.platform === 'win32' ? 'msedge' : undefined, headless: true });
  try {
    for (const scenario of cases) {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      const member = { id: 'test', firstname: 'Test', lastname: 'Member', email: 'test@example.com', role: scenario.role, status: 'activeMember', expirationTime: 4102444800000, memberContractOnFile: true, address: { street: '12 Main St', city: 'Manchester', state: 'NH', postalCode: '03101' } };
      await page.route('**/api/**', async route => {
        const url = new URL(route.request().url());
        let body = [];
        if (url.pathname === '/api/config') body = { wiki_url: '' };
        if (url.pathname === '/api/members/sign_in') body = member;
        if (url.pathname === `/api/members/${member.id}` || url.pathname === `/api/admin/members/${member.id}`) body = member;
        if (url.pathname.endsWith('/permissions')) body = { billing: scenario.billing, earned_membership: true };
        if (url.pathname === '/api/home') body = { member, slack: { accepted: true }, availableCheckouts: [], availableVolunteerOpportunities: [] };
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
      });
      await page.goto(`http://127.0.0.1:${server.address().port}/home`);
      const button = page.getByRole('button', { name: 'Menu', exact: true });
      await button.waitFor();
      for (const width of [320, 600, 900, 1280]) {
        await page.setViewportSize({ width, height: 1000 });
        await button.focus();
        await page.keyboard.press('Enter');
        const menu = page.getByRole('menu');
        await menu.waitFor();
        const labels = await menu.getByRole('menuitem').allTextContents();
        const logout = labels.indexOf('Logout');
        assert(logout > 0, 'Logout remains available');
        assert.deepEqual(labels.slice(logout + 1), scenario.footer, `${scenario.role}: bottom group order`);
        for (const label of cases[0].footer) {
          assert.equal(labels.filter(item => item === label).length, scenario.footer.includes(label) ? 1 : 0, `${scenario.role}: access to ${label}`);
        }
        const divider = menu.locator('#administrative-menu-divider');
        assert.equal(await divider.count(), scenario.footer.length ? 1 : 0, 'No empty administrative divider');
        if (scenario.footer.length) {
          assert.equal(await divider.evaluate(el => el.previousElementSibling.id), 'logout');
          assert.equal(await divider.evaluate(el => el.nextElementSibling.textContent), scenario.footer[0]);
        }
        assert(labels.includes('Tool Checkouts'), 'Members retain self-service checkouts');
        assert.equal(labels.includes('Members'), scenario.role !== 'member');
        assert.equal(labels.includes('Subscriptions'), scenario.billing);
        assert.equal(labels.includes('Payment Methods'), scenario.billing);
        const bounds = await menu.boundingBox();
        assert(bounds.x >= 0 && bounds.x + bounds.width <= width + 1, `Menu overflow at ${width}`);
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Page overflow at ${width}`);
        await page.keyboard.press('Home');
        for (const label of labels) {
          assert.equal(await page.evaluate(() => document.activeElement?.textContent), label, 'Arrow navigation follows visible order');
          assert(await menu.getByRole('menuitem', { name: label, exact: true }).evaluate(el => el.classList.contains('Mui-focusVisible')), 'Keyboard focus is visible');
          await page.keyboard.press('ArrowDown');
        }
        await page.keyboard.press('Home');
        await page.screenshot({ path: path.join(screenshots, `${scenario.role}-${scenario.billing}-${width}.png`) });
        await page.keyboard.press('End');
        const lastItem = await menu.getByRole('menuitem').last().boundingBox();
        assert(lastItem.y >= 0 && lastItem.y + lastItem.height <= 1000, 'Last entry scrolls into view');
        await page.screenshot({ path: path.join(screenshots, `${scenario.role}-${scenario.billing}-${width}-bottom.png`) });
        await page.keyboard.press('Escape');
        await menu.waitFor({ state: 'hidden' });
        assert(await button.evaluate(el => el === document.activeElement), 'Escape restores focus');
      }
      // Activating a real navigation entry also dismisses the menu.
      await button.click();
      await page.keyboard.press('Home');
      await page.keyboard.press('Enter');
      await page.getByRole('menu').waitFor({ state: 'hidden' });
      assert.equal(new URL(page.url()).pathname, '/home');

      // Exercise the same helpers as Rails-backed E2E against the real header,
      // so changes to menu semantics cannot leave their selectors behind.
      const profile = new MemberPage(page);
      const routes = [
        ['My Profile', () => profile.gotoOwnProfile(), `/members/${member.id}`],
        ['Home', () => new AuthPage(page).navigateViaMenu('Home'), '/home'],
        ['Tool Checkouts', () => new AdminToolCheckoutsPage(page).goto(), '/tool-checkouts'],
      ];
      if (scenario.role !== 'member') {
        routes.push(['Members', () => profile.goToMembersList(), '/members']);
        routes.push(['Volunteer', () => new AdminVolunteerPage(page).goto(), '/volunteer']);
      }
      if (['admin', 'board_member'].includes(scenario.role)) {
        routes.push(['Rentals', () => new AdminRentalsPage(page).goto(), '/admin/rentals']);
        if (scenario.billing) routes.push(['Billing', () => new BillingPage(page).goto(), '/billing']);
      }
      for (const [label, navigate, destination] of routes) {
        await navigate();
        await page.waitForURL(url => url.pathname === destination);
        await page.getByRole('menu').waitFor({ state: 'hidden' });
        assert.equal(new URL(page.url()).pathname, destination, `${scenario.role}: ${label} helper destination`);
      }
      console.log(`PASS E2E menu helpers: ${scenario.role}, billing=${scenario.billing}`);
      assert.deepEqual(errors, []);
      await page.close();
    }
    console.log('Header menu: E2E helpers, role/feature visibility, bottom grouping, keyboard focus and four widths passed');
  } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
