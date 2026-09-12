// Isolated browser UI verification. Backend contracts are covered by Rails specs.
const fs = require('fs');
const path = require('path');
const http = require('http');
const assert = require('node:assert/strict');
const webpack = require('webpack');
const { chromium } = require('@playwright/test');
const root = path.resolve(__dirname, '..');
const output = path.join(root, '.cache/fix-ui');
const config = require('../prod.config.js')({});
config.mode = 'development'; config.entry = path.join(root, 'tests/fixtures/fix-tickets-entry.tsx');
config.output = { ...config.output, path: output, clean: true };
config.optimization = { minimize: false }; config.devtool = false;
const compile = () => new Promise((resolve, reject) => webpack(config, (err, stats) => {
  if (err || stats.hasErrors()) reject(err || Error(stats.toString({ all: false, errors: true })));
  else resolve();
}));
async function main() {
  await compile();
  const id = '123456789012345678901234';
  const ticket = { id, title: 'Drill press stops unexpectedly', description: 'The switch intermittently stops the motor. Do not use until inspected.', category: 'broken', status: 'open', confirmation: 'unverified', priority: 1,
    shopId: '123456789012345678901235', shopName: 'Woodworking', toolId: '123456789012345678901236', toolName: 'Drill press', outOfService: true,
    publicReadOnly: false, iBrokeIt: false, iCanFixIt: true, assignees: [], announceToSlack: false, announcementNote: '', revision: 1,
    createdAt: '2026-09-10T12:00:00Z', updatedAt: '2026-09-12T12:00:00Z', capabilities: { canRead: true, canAddNote: true, canChangeStatus: true, canManage: true, canManageVisibility: true, canWithdraw: true, canCreateBounty: true, canReveal: true },
    events: [{ id: 'event-1', actor: 'Reporter', kind: 'created', createdAt: '2026-09-10T12:00:00Z', changes: {} }] };
  const catalog = { shops: [{ id: ticket.shopId, name: ticket.shopName }], tools: [{ id: ticket.toolId, name: ticket.toolName, shopId: ticket.shopId, outOfService: true }], canCreate: true, openCount: 1, openLimit: 10, centralSlackEnabled: true };
  const requests = [];
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname.startsWith('/api/')) {
      let body = ''; req.on('data', data => body += data); req.on('end', () => {
        requests.push({ url: url.toString(), method: req.method, body: body && JSON.parse(body) });
        res.setHeader('Content-Type', 'application/json');
        const data = url.pathname.endsWith('/catalog') ? catalog : url.pathname === '/api/fix_tickets' && req.method === 'GET' ? { tickets: [ticket], total: 26, page: Number(url.searchParams.get('page') || 0), pageSize: 25 } : ticket;
        res.end(JSON.stringify(data));
      }); return;
    }
    if (url.pathname.startsWith('/assets/')) {
      const file = path.resolve(output, url.pathname.slice('/assets/'.length));
      if (!file.startsWith(output + path.sep) || !fs.existsSync(file)) { res.writeHead(404).end(); return; }
      res.setHeader('Content-Type', file.endsWith('.js') ? 'application/javascript; charset=utf-8' : file.endsWith('.css') ? 'text/css' : 'application/octet-stream');
      fs.createReadStream(file).pipe(res); return;
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><script src="/assets/makerspace-react.js"></script></body></html>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try { browser = await chromium.launch({ channel: 'msedge', headless: true }); }
  catch (error) { server.close(); throw error; }
  try {
    const page = await browser.newPage(); const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    const origin = `http://127.0.0.1:${server.address().port}`;
    for (const width of [320, 600, 900, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(`${origin}/fix-tickets`);
      await page.getByRole('link', { name: ticket.title }).waitFor();
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `List overflow at ${width}`);
      await page.screenshot({ path: path.join(output, `list-${width}.png`), fullPage: true, animations: 'disabled' });
      await page.getByRole('button', { name: 'Report a problem' }).click();
      await page.getByRole('dialog').waitFor();
      await page.getByRole('dialog').evaluate(async node => { await Promise.all(node.getAnimations({ subtree: true }).map(a => a.finished)); });
      await page.getByRole('textbox', { name: 'Title', exact: true }).fill('Broken saw');
      await page.getByRole('textbox', { name: 'Description', exact: true }).fill('The guard is loose.');
      await page.screenshot({ path: path.join(output, `form-${width}.png`), fullPage: true, animations: 'disabled' });
      await page.getByRole('button', { name: 'Submit report' }).click();
      await page.getByRole('dialog').waitFor({ state: 'hidden' });
      await page.goto(`${origin}/fix-tickets/${id}`);
      await page.getByRole('heading', { name: ticket.title }).waitFor();
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Detail overflow at ${width}`);
      await page.screenshot({ path: path.join(output, `detail-${width}.png`), fullPage: true, animations: 'disabled' });
      await page.getByRole('button', { name: 'Add note', exact: true }).click();
      await page.getByRole('textbox', { name: 'Note', exact: true }).fill('Replacement switch ordered.');
      await page.keyboard.press('Tab');
      assert(await page.evaluate(() => document.activeElement !== document.body), 'Keyboard focus remains usable');
      await page.getByRole('button', { name: 'Confirm', exact: true }).click();
      await page.getByRole('dialog').waitFor({ state: 'hidden' });
    }
    await page.goto(`${origin}/fix-tickets`);
    await page.getByRole('link', { name: ticket.title }).waitFor();
    await page.getByRole('button', { name: 'Go to next page' }).click();
    await page.waitForURL(/page=1/);
    assert(requests.some(r => r.method === 'POST' && r.body?.title === 'Broken saw'));
    assert(requests.some(r => r.method === 'POST' && r.body?.note === 'Replacement switch ordered.'));
    assert.equal(errors.length, 0, errors.join('\n'));
    console.log('Fix ticket browser checks passed at 320, 600, 900 and 1440 px; creation, notes, keyboard focus and pagination verified.');
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
