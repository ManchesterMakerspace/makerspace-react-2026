# MMS Portal validation

## Automated verification (2026-09-23)

- Root React TypeScript check and production Rails asset build pass. The existing
  root build reports Webpack's `import.meta.env.BASE_URL` warning; the mobile
  extension avoids that conflicting definition.
- Root Jest: 47 suites, 205 tests passing, including Google TOTP/enrollment,
  API-origin session expiry, pending destinations and offline logout.
- Mobile TypeScript and bundle validation pass. Mobile Jest: 5 suites, 46 tests
  passing: native fetch/Axios/generated client contracts, pagination, CSRF token
  rotation/bootstrap, no mutation replay, QR validation/resolution and Google
  token/cancellation/configuration behavior.
- Rails shortcode request/API tests: 34 examples, no failures, including disabled
  resources, malformed targets, authenticated destinations and resolver outages.
- Swagger regenerated with `RAILS_ENV=test bundle exec rake rswag:specs:swaggerize`.
  Existing JSON key order was retained to avoid unrelated generator ordering churn.
- Android `assembleDebug` succeeds on JDK 21/SDK 36. APK installs and cold-boots on
  an API 34 emulator. Native Java CSRF helper compiles. Packaged HTML, scripts,
  CSS and branding load from `https://localhost` without a development server.
- The installed default-origin APK successfully bootstrapped the real public
  configuration, restored the absent session gracefully and loaded public
  membership options. No real account or payment mutation was performed.
- Synthetic emulator checks pass at 320, 600, 900 and 1280 CSS pixels. Overflow
  checks cover landing, login, catalog and browser handoff screens. Screenshots
  were reviewed; the missing SVG namespace found in the header logo was fixed.
  Tests cover hidden Android providers, scanner cancellation/denial/host rejection,
  uppercase short-code resolution, catalog details, checkout login destination,
  password TOTP, CSRF headers, signup handoff and Android Back closing a modal
  before navigating history. Scanner and browser outcomes in this test use native
  bridge fixtures; they do not establish physical-camera or Google certification.
- The production-origin debug manifest disables cleartext; WebView debugging is
  enabled for debug inspection. Release configuration rejects HTTP and enables
  neither WebView nor Android debugging. A signed release has not been produced.
- Production mobile assets also build successfully. Their synced configuration
  has no remote server URL, cleartext traffic or WebView debugging. Running the
  release guard against those assets correctly stops at the missing real Firebase
  configuration before signing or distribution.

## Repeat the emulator smoke test

Install a freshly built debug APK, launch it and forward the WebView debug socket:

```sh
adb shell am start -W -n org.manchestermakerspace.portal/.MainActivity
adb shell pidof org.manchestermakerspace.portal
adb forward tcp:9222 localabstract:webview_devtools_remote_<PID>
node scripts/emulator-smoke.cjs
```

Set `MMS_PORTAL_ADB` to the absolute ADB executable to include actual Android Back
key tests; optionally set `MMS_PORTAL_DEVICE` (defaults to `emulator-5554`). The
script uses synthetic native responses for mutations and writes screenshots to
ignored `.cache/smoke`. Restart the app afterwards to remove in-memory fixtures.
These two variables are test-runner settings and are never bundled into the app.

## Release acceptance still required

Use an authorized test account, a staging Rails API and payment sandbox for the
following checks. Record device/Android version, result and any failure before
distributing a signed release. No physical device or authenticated test account
was available during implementation.

| Check | Acceptance |
| --- | --- |
| Firebase setup | Real Android client in existing Firebase project; debug/release SHA-1 and SHA-256 registered; project IDs match. |
| Password and Google | Login, cancellation, invalid credentials, TOTP challenge, bad/expired TOTP and required enrollment; restore pending rental/checkout destination. |
| Sessions | Restart with valid, expired and absent cookie sessions; logout online/offline clears local state; no automatic mutation replay. |
| Member portal | Rental details/claim, checkout request, reservations, agreement display/signature with test data. |
| Administrative portal | Representative read/write forms, role boundaries, pagination, CSV share and failure recovery. |
| Browser payment | Invoice selection, payment and payment-method setup in sandbox; separate browser sign-in; cancel/fail/succeed, then refresh authoritative server state. |
| Camera | Physical QR scan of full/uppercase shortened URLs, tool/shop variants and rentals; deny/revoke permission, cancel scanner, missing camera. |
| Documents/sharing | Authenticated agreement frame cannot execute scripts; saved-document download/receipt print in browser; QR and CSV share recipients can open content. |
| Android behavior | Keyboard/text scaling, navigation Back at root, background/resume, browser return, offline/reconnect and rotation on phone/tablet. |
| Android versions | Smoke on API 26 minimum and current API 36, plus a physical device; implementation emulator was API 34. |
| Signed APK | Stable externally stored keystore, bumped versionCode, correct certificate, release manifest/packaged config verified, update over prior signed build. |
| Deployment | Public Rails shortcode resolver deployed and smoke-tested before APK distribution. |

Missing external prerequisites: `google-services.json`, Firebase certificate
registration, stable release signing key, authorized test accounts/payment sandbox,
physical device and resolver deployment access. These are not represented as
completed checks or replaced with production-account mutations.
