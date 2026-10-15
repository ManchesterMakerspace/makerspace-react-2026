# Browser checks

## Checkout Required sheets

Run `yarn build`. In the Rails checkout, with its disposable test environment
configured, run `bundle exec rails runner scripts/ci/checkout-sheet-fixtures.rb`.
Then run `node tests/browser/checkout-sheets.cjs` here. Set
`CHECKOUT_SHEET_FIXTURE_DIR` to an absolute fixture directory if Rails is not in
the usual sibling checkout. Fixtures come from the real Rails SVG renderer;
the browser flow itself uses mocked APIs and does not reset a database.
The check covers both entry paths, capability-based visibility, retry, SVG
downloads matching previews, one/two signs, keyboard activation and dialog
overflow at 320/600/900/1280 px. It renders normal, long-name, unbroken-name,
long-channel and blank-channel sheets in both copy modes, measures printable
bounds and overlaps, derives QR crops from SVG geometry, decodes every rendered
QR, and exports Letter landscape
print PDFs and screenshots under `tmp/checkout-sheet-browser/`. Inspect these
artifacts for layout; `long-channel` and `long-channel-single` specifically cover
long Slack footers with an ordinary resource name. There are ten fixture SVGs
in total. Failures exit nonzero. This does not establish physical
printer or native-device acceptance.

## Mobile login persistence

After `yarn build`, run `node tests/browser/mobile-login.cjs`. It uses the real
login UI with mocked APIs, shared phone/tablet/desktop user-agent fixtures, and a
disposable browser. It verifies preference reload/expiry, keyboard access, overflow
at 320/600/900/1280 px, login payloads, and TOTP cancellation. Screenshots go to
`tmp/mobile-login-browser`. Failures return nonzero. This does not establish real
Rails cookie restoration or native-device restart behavior; run Rails auth specs
and physical Android/iPhone acceptance separately.

## Checkout shop filter

Build the fixture with `yarn webpack --config tests/browser/shop-filter/webpack.cjs`,
then run `node tests/browser/shop-filter/check.cjs`. It renders the real request
manager with mocked catalogs, checks shop scoping and restoration of All shops,
focus access and page overflow at 320/600/900/1280 pixels. Screenshots are saved
under `tmp/shop-filter-browser`. This does not replace the Rails API contract tests.

## Member Home

Build web assets, then run `node tests/browser/home.cjs`. This check uses mocked
APIs and headless Edge on Windows (Chromium elsewhere). It verifies member/staff
and TOTP login destinations, protected Home links, checkout request/return refresh,
the E2E authentication/profile/settings page helpers (including restored sessions),
rental-agreement signing followed by the profile Dues tab and rental payment,
due-invoice filtering/pagination/actions, volunteer task/event claims and retries,
account settings and menu ordering,
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
