# Browser checks

## Member Home

Build web assets, then run `node tests/browser/home.cjs`. This check uses mocked
APIs and headless Edge on Windows (Chromium elsewhere). It verifies member/staff
and TOTP login destinations, protected Home links, checkout request/return refresh,
due-invoice filtering/pagination/actions, account settings and menu ordering,
signup ZIP/ZIP+4 and optional phone input, email-based password strength, and
keyboard/layout behavior at 320/600/900/1280 px.
Failures return nonzero. Screenshots are saved under `tmp/home-browser`.

## QR scanning

Build web assets, then run `node tests/browser/qr.cjs`. This check uses generated
QR fixtures in a synthetic camera stream, forces the bundled fallback decoder,
and mocks portal APIs. It checks routing, permissions/retry, camera selection,
cleanup, and layouts at 320/600/900/1280 px. Failures return nonzero. Screenshots
are saved in `tmp/qr-browser`. It launches headless Edge on Windows and Chromium
elsewhere; physical camera acceptance is still required.

## Optional checkout-link check

Build with `npm run build`. `node tests/browser/checkout-links.cjs` skips by
default. To enable it in PowerShell:

```powershell
$env:RUN_CHECKOUT_LINKS_TEST = "1"
node tests/browser/checkout-links.cjs
```

On Unix, use `RUN_CHECKOUT_LINKS_TEST=1 node tests/browser/checkout-links.cjs`.
Setup, browser, and assertion failures log warnings and return exit status zero;
this diagnostic must not gate a build or deployment. It uses mocked APIs and the
tracked `fixtures/shortcode-bootstrap.js`, so a standalone React clone works.
The fixture represents the Rails shell's path replacement before React starts;
keep it aligned when that shell contract changes. Sibling Rails assets are optional.
