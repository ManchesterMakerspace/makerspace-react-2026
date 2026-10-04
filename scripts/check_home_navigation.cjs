// Exercise the real app, router, auth reducer, and Home views against a local API.
const fs = require('fs');
const path = require('path');
const http = require('http');
const assert = require('node:assert/strict');
const webpack = require('webpack');
const { chromium } = require('@playwright/test');
const root = path.resolve(__dirname, '..');
const output = path.join(root, '.cache/home-navigation-ui');
const config = require('../prod.config.js')({});
config.mode = 'development';
config.output = { ...config.output, path: output, clean: true };
config.optimization = { minimize: false };
config.devtool = false;

async function main() {
  if (!process.argv.includes('--skip-build')) await new Promise((resolve, reject) => webpack(config, (error, stats) => {
    if (error || stats.hasErrors()) reject(error || Error(stats.toString({ all: false, errors: true })));
    else resolve();
  }));
  let member, authenticated;
  const unexpected = [];
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname.startsWith('/api/')) {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        res.setHeader('Content-Type', 'application/json');
        if (url.pathname === '/api/config') {
          res.end(JSON.stringify({ wiki_url: '', firebase_api_key: 'test-key', firebase_project_id: 'test-project',
            firebase_auth_domain: 'test-project.firebaseapp.com' })); return;
        }
        if (url.pathname === '/api/members/sign_in') {
          if (JSON.parse(body || '{}').member?.email === 'member@example.test') authenticated = true;
          if (authenticated) res.end(JSON.stringify(member));
          else res.writeHead(401).end('{"error":"Authentication required"}');
          return;
        }
        if (url.pathname === '/api/members/me/permissions') { res.end('{"billing":true}'); return; }
        if (url.pathname === '/api/home' && authenticated) {
          res.end(JSON.stringify({ member, slack: { accepted: false, newMembersChannelUrl: null },
            availableCheckouts: [], availableVolunteerOpportunities: [] })); return;
        }
        if (url.pathname === '/api/invoices' && authenticated) {
          res.setHeader('X-Total-Items', '0'); res.end('[]'); return;
        }
        unexpected.push(`${req.method} ${req.url}`);
        res.writeHead(500).end('{"error":"Unexpected test request"}');
      }); return;
    }
    if (url.pathname.startsWith('/assets/')) {
      const relative = url.pathname.slice('/assets/'.length);
      const file = relative === 'FilledLaserableLogo.svg' ? path.join(root, 'src/assets', relative) : path.resolve(output, relative);
      if ((!file.startsWith(output + path.sep) && relative !== 'FilledLaserableLogo.svg') || !fs.existsSync(file)) {
        res.writeHead(404).end(); return;
      }
      res.setHeader('Content-Type', file.endsWith('.js') ? 'application/javascript' : file.endsWith('.svg') ? 'image/svg+xml' : 'text/css');
      fs.createReadStream(file).pipe(res); return;
    }
    if (url.pathname === '/manifest.webmanifest' || url.pathname === '/favicon.png') { res.writeHead(404).end(); return; }
    res.setHeader('Content-Type', 'text/html');
    res.end(fs.readFileSync(path.join(output, 'index.html')));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true,
    ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) })
    .catch(error => { server.close(); throw error; });
  try {
    const origin = `http://127.0.0.1:${server.address().port}`;
    for (const width of [320, 600, 900, 1440]) {
      for (const role of ['member', 'admin', 'board_member', 'resource_manager']) {
        for (const target of ['/home', '/home?newMember=true']) {
          for (const signedIn of [true, false]) {
            member = { id: 'me', firstname: 'Pat', lastname: 'Test', role, status: 'activeMember',
              email: 'member@example.test', expirationTime: null, resourceManagerShopIds: [] };
            authenticated = signedIn;
            const context = await browser.newContext({ viewport: { width, height: 1000 }, serviceWorkers: 'block' });
            await context.route('**/*', route => route.request().url().startsWith(origin) ? route.continue() : route.abort());
            const page = await context.newPage();
            const errors = [];
            page.on('pageerror', error => errors.push(error.message));
            await page.goto(origin + target);
            if (!signedIn) {
              await page.getByRole('button', { name: 'Sign In', exact: true }).waitFor();
              assert.equal(new URL(page.url()).pathname, '/login');
              assert.equal(new URL(page.url()).searchParams.get('redirect'), target);
              await page.getByRole('textbox', { name: 'Email', exact: true }).fill('member@example.test');
              await page.getByLabel(/^Password/).fill('password123');
              await page.getByRole('button', { name: 'Sign In', exact: true }).focus();
              await page.keyboard.press('Enter');
            }
            await page.getByRole('heading', { level: 1, name: target.includes('?') ? 'Welcome!' : 'Your membership', exact: true }).waitFor();
            await page.getByText('No unpaid invoices are currently due', { exact: true }).waitFor();
            assert.equal(page.url(), origin + target);
            assert(await page.locator('main').evaluate(element => element.scrollWidth <= element.clientWidth + 1), `Home overflow at ${width}`);
            await page.getByRole('link', { name: 'Account Settings', exact: true }).focus();
            assert(await page.getByRole('link', { name: 'Account Settings', exact: true }).evaluate(element => element === document.activeElement));
            assert.deepEqual(errors, []);
            if (role === 'admin' && signedIn) await page.screenshot({ path: path.join(output, `${target.includes('?') ? 'welcome' : 'home'}-${width}.png`), fullPage: true });
            await context.close();
          }
        }
      }
      console.log(`Home and welcome passed for every role, with and without a session, at ${width}px`);
    }
    assert.deepEqual(unexpected, []);
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
