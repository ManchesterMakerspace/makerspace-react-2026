# NFC, PWA and native builds

The account menu offers **SCAN NFC** to signed-in `activeMember` users whose expirationTime is in the future. Ordinary members receive NDEF content only. Admin/board members also get UID lookup, optional member details, and eligible card release. Register/Replace Fob offers NFC next to front-door import on supported devices; scanning fills the identifier and does not submit the form.

UIDs are uppercase hexadecimal ASCII byte pairs, without separators or prefix. Byte order and leading zeroes are preserved: `1b:1a:4d:2f` becomes `1B1A4D2F`. Both browser and native readings use the same codec. Existing front-door identifiers remain unchanged; compare representative cards before enabling NFC enrollment if historical database identifiers use another format.

Browser NFC requires Android Chrome with NFC hardware enabled, HTTPS, permission, and a visible foreground page. Browser serial numbers may be absent; non-NDEF MIFARE fobs require the native Android reader. Installation as a PWA does not change those limits. Reading never writes or formats a card. UID possession is not identity verification.

Shop/tool public links route to the selected resource in Workshops; bounty links route to the existing task view. Portal shortcodes reuse `GET /api/shortcodes/:code`. Other HTTP(S) URLs require an explicit open action. Unsafe schemes are displayed but not executed. Card APIs are never called for ordinary-member NDEF scans.

## Deploying the web/PWA feature

Deploy the companion Rails change first. It supplies lookup, conditional release and transactional assignment, plus `/manifest.webmanifest`, `/service-worker.js`, `/offline.html` and `/pwa-icon.png`. Serve those public files at the origin root (Rails static serving or the existing reverse proxy). The app registers the worker on secure web origins. No worker runs inside Capacitor.

The service worker caches only the generic offline page and icon. It never stores authenticated pages, card/member responses, or offline mutations. Worker updates wait until existing clients close; users are not reloaded during fob operations. Use the browser's Install/Add to home screen action.

The Rails database must be a MongoDB replica set supporting transactions. Ensure the existing unique `cards.uid` index is deployed. No unsafe standalone-database fallback exists. Release is conditional on the lookup version and fresh membership status, and writes an audit in the same transaction. Missing or failed lookups cannot authorize enrollment. Do not migrate or reinterpret legacy UIDs without a separate collision/data audit.

## Android

Prerequisites: Node 22+, Yarn classic, **JDK 21**, Android SDK platform 36/build tools 35, and Android Studio. Android Studio's bundled JDK can be newer than Gradle supports; explicitly select JDK 21 if needed. The generated Android project targets API 36 and supports API 24+. The app ID is `org.manchestermakerspace.portal`.

PowerShell:

```powershell
yarn install --frozen-lockfile
$env:JAVA_HOME = 'C:\path\to\jdk-21'
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:NATIVE_API_ORIGIN = 'https://members.manchestermakerspace.org'
yarn android:sync
yarn android:debug
# Optional:
yarn android:open
```

The origin must be HTTPS without a path or trailing slash. `dist-native` contains a local HTML shell/assets, not a remotely loaded website. The app's native HTTP/cookie transport rewrites portal API requests, bootstraps CSRF through `/api/config`, and obtains the remote XSRF cookie for each mutation. The Rails session remains cookie based; CSRF is not disabled and no credentialed wildcard CORS is introduced. Never store session cookies in localStorage.

The debug APK is `android/app/build/outputs/apk/debug/app-debug.apk`. Build an AAB with `yarn android:release` after syncing. For a signed release supply `ANDROID_KEYSTORE_PATH`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, and `ANDROID_KEY_PASSWORD` through the environment; otherwise the release bundle is unsigned. Never commit signing files/passwords. Distribution and device installation are separate steps.

Native APIs are provided by the app-owned `MakerspaceNfcPlugin` using foreground reader mode, `Tag.getId`, and optional NDEF. NFC is optional hardware: unsupported devices can still run the portal. The app must remain in the foreground. Technology support varies by phone; test actual access fobs.

## Optional iOS on macOS

Use macOS and Xcode 26+, Node 22+, and an Apple signing team with NFC Tag Reading capability. Set `NATIVE_API_ORIGIN` as above using the shell's environment syntax, then:

```sh
yarn build:native
yarn ios:add
yarn ios:sync
yarn ios:open
```

`configure-ios.js` installs the tracked Core NFC plugin/view controller, description and entitlement into the generated project. Select the signing team and confirm the NFC capability in Xcode, then build/archive normally. iOS sources are maintained under `native/ios`; the generated `ios` directory is ignored. Supported MIFARE/ISO14443 and ISO15693 tags can be scanned; MIFARE Classic parity is not promised. No arbitrary ISO7816 AID probing is configured. Native iOS compilation and physical tag testing require a Mac/iPhone and cannot be validated on Windows.

## Checks and rollout

```sh
yarn typecheck
yarn test --runInBand tests/unit/nfc tests/unit/app/permissions.spec.ts
yarn build
node tests/browser/nfc.cjs
```

The browser check uses mocked APIs and NFC, asserts role separation, normalized lookup, release, safe external-link handling and layouts at 320/600/900/1280 px. It saves screenshots under `tmp/nfc-browser`. Hardware validation must cover NDEF text/URI/Smart Posters, actual non-NDEF MIFARE cards, empty UID, NFC disabled, cancellations, background/resume, and repeated reads. Verify normalization against the front-door reader and card reuse after release.

Before distributing a native build, exercise real password login, TOTP, logout/session expiry, cookie persistence, and any enabled Firebase provider callbacks against the intended deployment. Automated native-transport tests cover request mapping and CSRF behavior; provider-specific OAuth behavior and real-device cookie integration still require deployment/device acceptance.

See [the original plan](nfc-capacitor-plan.md) for design rationale. The implementation reuses the already-existing shortcode resolver rather than adding a second endpoint.

### Local validation (2026-09-26)

- TypeScript checking passed; 52 selected React tests passed across 9 suites.
- 78 selected Rails examples passed against an isolated MongoDB replica set, with external Slack delivery stubbed. Swagger contracts were regenerated.
- Mocked browser NFC/member/admin flows passed at 320, 600, 900 and 1280 px, including visual inspection of settled dialogs.
- Web and native production assets, Android debug APK and unsigned release AAB built successfully. The native assets use `https://members.manchestermakerspace.org`.
- iOS project configuration was checked for repeatable generation on Windows; compilation was not performed. No physical NFC or production authentication acceptance testing was performed, and nothing was deployed.
