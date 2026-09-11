# Browser checks

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
