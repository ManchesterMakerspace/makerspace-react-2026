// Run against an installed debug APK after forwarding its WebView DevTools
// socket to localhost:9222. Uses only synthetic accounts and native bridge
// fixtures for mutations; never submits a real login or payment.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const output = path.resolve(__dirname, '../.cache/smoke');
fs.mkdirSync(output, { recursive: true });
async function main() {
  const targets = await (await fetch('http://127.0.0.1:9222/json/list')).json();
  const target = targets.find(item => item.url.startsWith('https://localhost'));
  assert(target, 'Launch the installed MMS Portal debug app first.');
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let id = 0;
  const pending = new Map();
  socket.onmessage = ({ data }) => {
    const result = JSON.parse(data);
    if (!result.id) return;
    const handlers = pending.get(result.id); pending.delete(result.id);
    result.error ? handlers.reject(new Error(JSON.stringify(result.error))) : handlers.resolve(result.result);
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const requestId = ++id; pending.set(requestId, { resolve, reject });
    socket.send(JSON.stringify({ id: requestId, method, params }));
  });
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  const waitFor = async expression => {
    for (let count = 0; count < 100; count++) {
      if (await evaluate('Boolean(' + expression + ')')) return;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error('Timed out: ' + expression + '\n' + await evaluate('document.body.innerText'));
  };
  try {
    console.log('Initial packaged app:', await evaluate('document.body.innerText'));
    if (process.argv.includes('--inspect')) {
      console.log(await evaluate("JSON.stringify({ images: [...document.images].map(i => ({src:i.src,width:i.naturalWidth})), inputs: [...document.querySelectorAll('input')].map(i=>({name:i.name,value:i.value})), requests:window.__mmsSmoke?.requests })"));
      console.log(await evaluate("fetch('/assets/FilledLaserableLogo.svg').then(async r => ({status:r.status,type:r.headers.get('content-type'),xml:(new DOMParser()).parseFromString(await r.text(),'image/svg+xml').querySelector('parsererror')?.textContent}))"));
      return;
    }
    await waitFor("document.body.textContent.includes('Scan QR code')");
    if (await evaluate("location.pathname === '/'") ) {
      await waitFor("document.body.textContent.includes('Our Membership Options')");
      for (const width of [320, 600, 900, 1280]) {
        await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: true });
        assert(await evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), `Landing page overflows at ${width}px`);
      }
    }
    // Keep real packaged assets and React components, replace native I/O only.
    await evaluate(`(() => {
      const original = Capacitor.nativePromise.bind(Capacitor);
      window.__mmsSmoke = { requests: [], browser: [], scan: 'cancel' };
      Capacitor.nativePromise = async (plugin, method, options) => {
        const state = window.__mmsSmoke;
        if (plugin === 'CapacitorBarcodeScanner') {
          if (state.scan === 'cancel') throw new Error('Scan canceled');
          if (state.scan === 'denied') throw new Error('Camera permission denied');
          return { ScanResult: state.scan };
        }
        if (plugin === 'Browser' && method === 'open') { state.browser.push(options.url); return {}; }
        if (plugin === 'PortalSession' && method === 'csrfToken') return { token: 'fixture-csrf' };
        if (plugin === 'CapacitorHttp') {
          state.requests.push(options);
          const url = new URL(options.url), data = { status: 200, headers: {}, data: '{}' };
          if (url.pathname.includes('/public.json')) data.data = JSON.stringify({ id: '0123456789abcdef01234567', name: 'Fixture lathe', description: 'A synthetic tool used for device validation.', open: false });
          else if (url.pathname.startsWith('/api/shortcodes/')) data.data = JSON.stringify({ target_path: '/tools/0123456789abcdef01234567/public' });
          else if (url.pathname === '/api/members/sign_in') { data.status = 202; data.data = JSON.stringify({ totp_required: true }); }
          else if (url.pathname === '/api/members/totp_sessions') { data.status = 401; data.data = JSON.stringify({ error: 'Invalid verification code' }); }
          else { data.status = 404; data.data = JSON.stringify({ error: 'Fixture not found' }); }
          return data;
        }
        return original(plugin, method, options);
      };
    })()`);
    const navigate = route => evaluate(`window.dispatchEvent(new CustomEvent('mms:navigate', { detail: ${JSON.stringify(route)} }))`);
    const click = text => evaluate(`(() => { const button = [...document.querySelectorAll('button')].find(el => el.textContent.trim() === ${JSON.stringify(text)}); if (!button) throw new Error('Button missing'); button.click(); })()`);
    for (const width of [320, 600, 900, 1280]) {
      await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: true });
      await navigate('/login');
      await waitFor("document.querySelector('input[type=email]')");
      assert(await evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), `Login overflows at ${width}px`);
      assert(!(await evaluate("/Apple|GitHub|Microsoft/.test(document.body.innerText)")), 'Unsupported native providers are hidden');
      const shot = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(output, `login-${width}.png`), Buffer.from(shot.data, 'base64'));
    }
    assert(await evaluate('[...document.images].every(img => img.complete && img.naturalWidth > 0)'), 'Packaged branding must render');
    if (process.env.MMS_PORTAL_ADB) {
      await evaluate("document.querySelector('button[aria-label=Help]').click()");
      await waitFor("document.querySelector('[role=dialog]')");
      execFileSync(process.env.MMS_PORTAL_ADB, ['-s', process.env.MMS_PORTAL_DEVICE || 'emulator-5554', 'shell', 'input', 'keyevent', '4']);
      await waitFor("!document.querySelector('[role=dialog]')");
      assert.equal(await evaluate('location.pathname'), '/login', 'Back closes the overlay before navigating');
    }
    await click('Scan QR code');
    await waitFor("[...document.querySelectorAll('button')].some(el => el.textContent === 'Scan QR code' && !el.disabled)");
    await evaluate("window.__mmsSmoke.scan = 'denied'");
    await click('Scan QR code');
    await waitFor("document.body.innerText.includes('Allow camera access')");
    await evaluate("window.__mmsSmoke.scan = 'https://evil.example.org/tools/0123456789abcdef01234567/public'");
    await click('Scan QR code');
    await waitFor("document.body.innerText.includes('not from this Makerspace portal')");
    await evaluate("window.__mmsSmoke.scan = 'https://members.manchestermakerspace.org/L23456789AB'");
    await click('Scan QR code');
    await waitFor("document.body.innerText.includes('Fixture lathe')");
    for (const width of [320, 600, 900, 1280]) {
      await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: true });
      assert(await evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), `Catalog overflows at ${width}px`);
      const shot = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(output, `catalog-${width}.png`), Buffer.from(shot.data, 'base64'));
    }
    await click('Request checkout');
    await waitFor("document.querySelector('input[type=email]')");
    assert.equal(await evaluate("sessionStorage.getItem('mms-pending-path')"), '/tools/0123456789abcdef01234567/request-checkout');
    await evaluate(`(() => {
      for (const [selector, value] of [['input[type=email]', 'fixture@example.org'], ['input[type=password]', 'Fixture-only-password']]) {
        const input = document.querySelector(selector);
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    })()`);
    await click('Sign In');
    await waitFor("document.body.innerText.includes('Two-Factor Authentication')");
    assert(await evaluate("window.__mmsSmoke.requests.some(r => r.method === 'POST' && r.headers['x-xsrf-token'] === 'fixture-csrf')"));
    await navigate('/signup');
    await waitFor("document.body.textContent.includes('Sign up in browser')");
    for (const width of [320, 600, 900, 1280]) {
      await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: true });
      assert(await evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), `Browser handoff overflows at ${width}px`);
    }
    await click('Sign up in browser');
    await waitFor('window.__mmsSmoke.browser.length === 1');
    assert.equal(await evaluate('window.__mmsSmoke.browser[0]'), 'https://members.manchestermakerspace.org/signup');
    if (process.env.MMS_PORTAL_ADB) {
      execFileSync(process.env.MMS_PORTAL_ADB, ['-s', process.env.MMS_PORTAL_DEVICE || 'emulator-5554', 'shell', 'input', 'keyevent', '4']);
      await waitFor("location.pathname === '/login'");
    }
    console.log('PASS: local assets, login widths 320/600/900/1280, Android providers, scan cancellation/denial/untrusted URL/short URL, catalog, pending checkout route, password TOTP, native CSRF, browser signup.');
    fs.writeFileSync(path.join(output, 'result.txt'), 'Synthetic emulator smoke checks passed. Real Google, authenticated member/admin and payment sandbox acceptance remain separate.\n');
  } finally { socket.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
