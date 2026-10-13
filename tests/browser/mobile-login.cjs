// Build web assets first. Exercises the real login UI with mocked APIs.
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const root = path.resolve(__dirname, '../..');
const clients = require('../fixtures/mobile_session_clients.json');
const screenshots = path.join(root, 'tmp/mobile-login-browser');
const label = 'Stay logged in (uncheck this on a shared computer)';
const html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/assets/makerspace-react.css"><script defer src="/assets/makerspace-react.js"></script></head><body></body></html>';
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/assets/FilledLaserableLogo.svg') {
    res.setHeader('Content-Type', 'image/svg+xml');
    const railsLogo = path.join(root, '../makerspace-rails-2026/app/assets/images/FilledLaserableLogo.svg');
    // The React source is an inline SVG fragment; Rails serves the complete SVG.
    const logo = fs.existsSync(railsLogo) ? fs.readFileSync(railsLogo, 'utf8')
      : fs.readFileSync(path.join(root, 'src/assets/FilledLaserableLogo.svg'), 'utf8').replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
    res.end(logo);
    return;
  }
  const relative = url.pathname.replace(/^\/assets\//, '');
  const asset = path.resolve(root, 'dist', relative);
  if (url.pathname.startsWith('/assets/') && asset.startsWith(path.join(root, 'dist') + path.sep) && fs.existsSync(asset)) {
    res.setHeader('Content-Type', asset.endsWith('.css') ? 'text/css' : asset.endsWith('.js') ? 'text/javascript' : 'image/svg+xml');
    res.end(fs.readFileSync(asset));
  } else { res.setHeader('Content-Type', 'text/html'); res.end(html); }
});

(async () => {
  fs.mkdirSync(screenshots, { recursive: true });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch(process.platform === 'win32' ? { channel: 'msedge', headless: true } : { headless: true });
  try {
    for (const client of clients) {
      const context = await browser.newContext({ userAgent: client.agent, viewport: { width: 320, height: 800 } });
      const page = await context.newPage();
      let choice;
      let cancelled = false;
      await page.route('**/api/**', async route => {
        const endpoint = new URL(route.request().url()).pathname;
        let status = 200, body = {};
        if (endpoint === '/api/members/sign_in') {
          const member = route.request().postDataJSON()?.member;
          if (member) { choice = member.rememberMe; status = 202; body = { totp_required: true }; }
          else { status = 401; body = { error: 'Sign in required' }; }
        } else if (endpoint === '/api/members/sign_out') {
          cancelled = true; status = 204;
        }
        await route.fulfill({ status, contentType: 'application/json', body: status === 204 ? '' : JSON.stringify(body) });
      });
      await page.goto(origin + '/login');
      const checkbox = page.getByRole('checkbox', { name: label });
      await page.getByRole('textbox', { name: 'Email', exact: true }).waitFor();
      if (!client.phone) {
        assert.equal(await checkbox.count(), 0, client.name);
        await context.close();
        continue;
      }
      await checkbox.waitFor();
      assert.equal(await checkbox.isChecked(), true, client.name);
      await checkbox.uncheck();
      await page.reload();
      await checkbox.waitFor();
      assert.equal(await checkbox.isChecked(), false, `${client.name} opt-out survives reload`);
      const preference = (await context.cookies()).find(cookie => cookie.name === 'makerspace_stay_logged_in');
      assert.equal(preference.value, 'false');
      assert.equal(preference.path, '/');
      assert.equal(preference.sameSite, 'Lax');
      assert.ok(preference.expires > Date.now() / 1000 + 364 * 86400);

      for (const width of [320, 600, 900, 1280]) {
        await page.setViewportSize({ width, height: 800 });
        await checkbox.focus();
        assert.equal(await checkbox.evaluate(element => document.activeElement === element), true);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
        await page.screenshot({ path: path.join(screenshots, `${client.name.replace(/\W+/g, '-')}-${width}.png`), fullPage: true });
      }
      await checkbox.focus();
      await page.keyboard.press('Space');
      assert.equal(await checkbox.isChecked(), true);
      await checkbox.uncheck();
      await page.getByRole('textbox', { name: 'Email', exact: true }).fill('member@example.com');
      await page.getByRole('textbox', { name: 'Password', exact: true }).fill('password123');
      await page.getByRole('button', { name: 'Sign In', exact: true }).click();
      await page.getByRole('button', { name: 'Back', exact: true }).waitFor();
      assert.equal(choice, false);
      await page.getByRole('button', { name: 'Back', exact: true }).click();
      await checkbox.waitFor();
      assert.equal(cancelled, true);
      assert.equal(await checkbox.isChecked(), false);
      await context.close();
    }
    console.log('Mobile login detection, preference, keyboard, layouts, and TOTP cancellation passed.');
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
