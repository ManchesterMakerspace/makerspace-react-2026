# Browser checks

## Checkout shop filter

Build the fixture with `yarn webpack --config tests/browser/shop-filter/webpack.cjs`,
then run `node tests/browser/shop-filter/check.cjs`. It renders the real request
manager with mocked catalogs, checks shop scoping and restoration of All shops,
focus access and page overflow at 320/600/900/1280 pixels. Screenshots are saved
under `tmp/shop-filter-browser`. This does not replace the Rails API contract tests.

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
