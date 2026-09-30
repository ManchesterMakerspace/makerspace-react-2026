// Real QR decoding from a synthetic camera stream; all portal APIs use fixtures.
const { chromium } = require('playwright');
const QRCode = require('qrcode');
const http = require('http');
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const root = path.resolve(__dirname, '../..');
const settled = async page => {
  await page.getByRole('listbox').waitFor({ state: 'hidden' });
  await page.waitForFunction(() => {
    let el = document.querySelector('[role="dialog"]');
    if (!el) return false;
    while (el) { if (Number(getComputedStyle(el).opacity) < 0.99) return false; el = el.parentElement; }
    return true;
  });
};
const html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/assets/makerspace-react.css"><script defer src="/assets/makerspace-react.js"></script></head><body></body></html>';
const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  let file = /^\/assets\/[\w.-]+$/.test(pathname) ? path.join(root, 'dist', pathname.slice(8)) : null;
  if (pathname === '/assets/FilledLaserableLogo.svg') file = path.join(root, 'src/assets/FilledLaserableLogo.svg');
  if (file && fs.existsSync(file)) {
    res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'image/svg+xml');
    res.end(fs.readFileSync(file));
  } else { res.setHeader('Content-Type', 'text/html'); res.end(html); }
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ channel: process.platform === 'win32' ? 'msedge' : undefined, headless: true });
  const output = path.join(root, 'tmp/qr-browser'); fs.mkdirSync(output, { recursive: true });
  try {
    for (const width of [320, 600, 900, 1280]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      const page = await context.newPage(); const errors = []; let resolutions = 0;
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(() => {
        // Force the bundled worker decoder, including on Chromium with BarcodeDetector.
        delete window.BarcodeDetector;
        const canvas = document.createElement('canvas'); canvas.width = canvas.height = 640;
        const ctx = canvas.getContext('2d'); const blank = () => { ctx.fillStyle = 'white'; ctx.fillRect(0, 0, 640, 640); };
        blank(); window.qrStreams = []; window.qrDenied = false;
        window.presentQr = async data => {
          blank(); if (!data) return;
          const img = new Image(); img.src = data; await img.decode(); ctx.drawImage(img, 120, 120, 400, 400);
        };
        Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { value: async constraints => {
          if (constraints.audio !== false) throw new Error('Unexpected audio request');
          if (window.qrDenied) throw new DOMException('Denied', 'NotAllowedError');
          const stream = canvas.captureStream(15); window.qrStreams.push(stream);
          const timer = setInterval(() => {
            if (stream.getTracks().every(track => track.readyState === 'ended')) { clearInterval(timer); return; }
            ctx.drawImage(canvas, 0, 0);
          }, 70);
          return stream;
        } });
        Object.defineProperty(navigator.mediaDevices, 'enumerateDevices', { value: async () => [
          { kind: 'videoinput', deviceId: 'rear', label: 'Rear camera' },
          { kind: 'videoinput', deviceId: 'front', label: 'Front camera' },
        ] });
      });
      await page.route('**/api/**', async route => {
        const pathname = new URL(route.request().url()).pathname;
        let body = {};
        if (pathname === '/api/members/sign_in') body = { id: 'operator', firstname: 'QR', lastname: 'Tester', role: 'member', status: 'expiredMember', expirationTime: 1 };
        else if (pathname.endsWith('/permissions')) body = [];
        else if (pathname === '/api/workshops') body = { workshops: [], canAddShop: false };
        else if (pathname === '/api/shortcodes/23456789AB') { resolutions++; body = { target_path: '/tool/0123456789abcdef01234567/public.html' }; }
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
      });
      const open = async () => {
        await page.getByRole('button', { name: 'Menu', exact: true }).click();
        await page.getByRole('menuitem', { name: 'Scan QR', exact: true }).click();
      };
      const scan = async value => {
        await page.evaluate(data => window.presentQr(data), await QRCode.toDataURL(value, { width: 400, margin: 4 }));
      };
      const stopped = async () => page.waitForFunction(() => window.qrStreams.every(stream => stream.getTracks().every(track => track.readyState === 'ended')));
      await page.goto(`${origin}/workshops`); await open();
      await page.getByText('Looking for a QR code…').waitFor().catch(async error => {
        await page.screenshot({ path: path.join(output, `failure-${width}.png`) });
        console.error(await page.locator('body').innerText(), errors); throw error;
      });
      await page.getByRole('combobox', { name: 'Camera' }).click();
      await page.getByRole('option', { name: 'Front camera', exact: true }).click();
      await page.waitForFunction(() => window.qrStreams.length === 2 && window.qrStreams[0].getTracks().every(track => track.readyState === 'ended'));
      await page.getByText('Looking for a QR code…').waitFor();
      await settled(page); await page.screenshot({ path: path.join(output, `scanning-${width}.png`) });
      assert(await page.getByRole('dialog').evaluate(el => el.scrollWidth <= el.clientWidth + 1));
      await scan(`${origin.toUpperCase()}/L23456789AB`);
      await page.waitForURL('**/workshops?tool=0123456789abcdef01234567'); await stopped();
      assert.equal(resolutions, 1);
      await page.evaluate(() => window.presentQr(null)); await open();
      await scan('https://example.org/a/long/path?value=abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz');
      await page.getByRole('button', { name: 'Open in browser' }).waitFor(); await stopped();
      assert.equal(context.pages().length, 1);
      await settled(page); await page.screenshot({ path: path.join(output, `external-${width}.png`) });
      await page.getByRole('button', { name: 'Cancel', exact: true }).click();
      await page.getByRole('dialog').waitFor({ state: 'hidden' });
      await page.waitForFunction(() => document.activeElement?.id === 'menu-button');
      await page.evaluate(() => { window.presentQr(null); window.qrDenied = true; }); await open();
      await page.getByRole('alert').filter({ hasText: 'Camera permission was denied' }).waitFor();
      await settled(page); await page.screenshot({ path: path.join(output, `permission-${width}.png`) });
      await page.evaluate(() => { window.qrDenied = false; });
      await page.getByRole('button', { name: 'Scan Again' }).click();
      await page.getByText('Looking for a QR code…').waitFor();
      await scan('javascript:alert(1)');
      await page.getByRole('alert').filter({ hasText: 'does not contain a supported link' }).waitFor(); await stopped();
      await page.getByRole('button', { name: 'Cancel', exact: true }).click();
      assert.deepEqual(errors, []);
      await context.close();
    }
    console.log('QR browser checks passed at 320/600/900/1280px using the worker decoder.');
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; server.close(); });
