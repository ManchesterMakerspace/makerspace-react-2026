# MMS Portal for Android

MMS Portal packages the existing React application, Redux store, MUI theme and
role-based routes in Capacitor. There is no second React application to maintain.
Application ID: `org.manchestermakerspace.portal`. Minimum Android: 8.0/API 26.
The default API is `https://members.manchestermakerspace.org`.

## Build and install

Use Node 22+, Yarn Classic, JDK 21, Android SDK 36 and build-tools 36.0.0.
Android Studio Otter or newer is recommended. Install root dependencies first,
then install this package independently; both lockfiles are required.

```sh
yarn install --frozen-lockfile
cd tools/mms-portal
yarn install --frozen-lockfile
yarn typecheck
yarn test
yarn android:debug
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

Set `JAVA_HOME` to JDK 21 and `ANDROID_HOME` to your SDK. On Windows,
`scripts/setup-local-toolchain.ps1` can download checksum-verified tools into
the ignored `.cache/toolchain` directory and prints both paths. It reuses
existing accepted SDK licenses; it does not accept new license terms for you.
Set the printed variables in your shell before running the build.

`android:debug` builds the web assets, validates them, syncs Capacitor and runs
Gradle. `yarn build` and `yarn sync` are also available separately; sync rejects
assets built with different API/debug settings. `yarn open` opens Android Studio.
The root `yarn build` still produces the existing Rails assets in `dist`.

## Firebase Google sign-in

1. In the **existing** Firebase project used by Rails `/api/config`, register the
   Android app `org.manchestermakerspace.portal`; enable its Google provider.
2. Obtain SHA-1 and SHA-256 certificate fingerprints using `android/gradlew
   signingReport` or `keytool -list -v -keystore <path> -alias <alias>`. Register
   the debug fingerprint for local testing and the stable release fingerprints
   for distribution. CI debug keys can differ between runs.
3. Download the updated configuration to `android/app/google-services.json`
   (ignored by Git), then rebuild. The package must contain the matching Android
   client and OAuth configuration. Do not substitute a Firebase service account.
4. Confirm the project ID matches the Firebase project returned by Rails. The
   app exchanges **FirebaseAuthentication.getIdToken()**, never the raw Google
   credential token, with `/api/auth/firebase_login`.

Without the configuration, debug builds support password/TOTP and display a
recoverable Google setup error. Sync omits registration of the native Firebase
plugin in this case. Release builds require the real configuration.

## Session and platform behavior

The mobile entry registers adapters before importing the shared application.
`GET /api/config` establishes Rails cookies before session restoration. Only
first-party `/api/` traffic is mapped through CapacitorHttp, including fetch,
Axios and the generated API client's fetch calls. Native CookieManager owns
the app-private cookie jar. `PortalSession` exposes only `XSRF-TOKEN` for CSRF
headers; session cookies are never returned to JavaScript. Logout clears native
Firebase state and the app cookie jar. The next mutation bootstraps a fresh CSRF
session when needed. Mutations are never queued or automatically replayed.

The existing Rails session lifetime applies. Missing/expired sessions return to
login and preserve a pending in-app route through password/Google TOTP and
required enrollment. No persistent-login extension is implemented.

Signup, checkout and payment-method setup use clearly labeled browser actions.
Chrome's session is separate: users may need to sign in and select an invoice
again; neither cookies nor the in-memory cart are transferred. Returning refreshes
server state and never implies payment success. Agreements are fetched with the
native transport and displayed in a script-disabled frame. Receipts and saved
document downloads use browser actions. QR images and generated CSV reports use
Android's share sheet.

Back closes the active MUI modal, navigates history, then backgrounds the app at
its root. The keyboard resizes the activity; CSS accommodates safe-area insets.
The offline banner explains recovery; individual requests retain existing error
handling and the bootstrap/catalog views have Retry actions.

## QR routes and server dependency

Deploy Rails `GET /api/shortcodes/:code` **before distributing** an APK.
It resolves public `/L{code}` links to `target_path`, with `no-store`, 404 for
invalid/hidden resources and 503 for resolver failures. It does not grant access
to the destination. Existing authenticated shortcode creation is unchanged.

The scanner requests camera access only when used, scans QR codes only, accepts
the configured public portal origin, normalizes singular/plural tool/shop links,
and rejects unrelated hosts, schemes and paths. Tool/shop JSON views are rendered
inside the app; checkout requests and rental routes retain existing permissions.
Shareable QR codes always use the configured public portal domain.

## Environment settings

| Setting | Purpose |
| --- | --- |
| `MMS_PORTAL_API_URL` | Build-time API origin only; defaults to production HTTPS. No path, query or credentials. |
| `MMS_PORTAL_DEBUG` | Exact `true` enables WebView debugging and permits an HTTP API origin. The Android scripts set this automatically for debug/release. |
| `JAVA_HOME`, `ANDROID_HOME` | JDK 21 and SDK location for Gradle. |
| `GRADLE_USER_HOME` | Optional local Gradle cache location. |
| `MMS_PORTAL_KEYSTORE` | Absolute path to the stable release keystore, outside Git. |
| `MMS_PORTAL_KEYSTORE_PASSWORD` | Release keystore password. |
| `MMS_PORTAL_KEY_ALIAS` | Release signing alias. |
| `MMS_PORTAL_KEY_PASSWORD` | Release signing key password. |

Shared public build settings (`SMTP_FROM`, `BILLING_ENABLED`, `FIREBASE_*`) retain
their existing defaults/runtime configuration behavior. Mobile `BASE_URL` is
always derived from `MMS_PORTAL_API_URL`.

For a local Rails server use an explicitly configured debug origin such as
`http://10.0.2.2:3002` on an emulator, plus the appropriate Rails host settings.
Build and sync using identical environment settings. Never set `server.url`:
HTML, JS, CSS, icons and lazy chunks are bundled locally.

## Signed internal release

Keep a stable keystore and its backups outside this repository. Use an existing
organization key or create one with `keytool -genkeypair -v -keystore <outside
path> -alias mms-portal -keyalg RSA -keysize 3072 -validity 10000`; let keytool
prompt for passwords. Keep credentials in your secret manager or shell session.
Set the four signing variables above, supply the Firebase configuration, then:

```sh
yarn android:release
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

Increment `versionCode` for every distributed build in `android/app/build.gradle`,
and update `versionName` plus `package.json` for the release version. Updates must
use the same application ID and signing key. Installing a release over a debug
build may require uninstalling the debug app, which removes its local session.
Verify the certificate with `apksigner verify --print-certs <apk>`.

The release guard rejects debug assets, HTTP origins, remote `server.url`, WebView
debugging, missing Google configuration and missing signing settings. Release
manifest cleartext traffic and Android debugging are disabled. Signing material,
Google configuration, generated assets, local SDK settings and build outputs are
ignored. Commit the Android source and Gradle wrapper.

CI runs mobile checks and assembles an installable password/TOTP debug APK. An
optional repository secret `MMS_PORTAL_GOOGLE_SERVICES_JSON` supplies the Firebase
file. CI artifacts are test builds, not signed internal releases.

## Verification and troubleshooting

See [VALIDATION.md](VALIDATION.md) for automated checks and the device acceptance
matrix. Use test accounts and payment sandbox environments for mutations. Never
infer payment completion from a browser return.

- Blank screen: run build then sync with the same settings; inspect WebView only
  in a debug build. No development server should be required.
- HTTP blocked: use HTTPS or explicitly configure a debug HTTP origin and rebuild.
- Login/CSRF failure: check `/api/config`, origin, Rails cookie settings and device
  clock; log out and retry. Do not add a CSRF bypass or automatic mutation retry.
- Google configuration/cancellation: check project ID, package ID and both signing
  fingerprints, then redownload Google configuration. Cancellation can be retried.
- Short link 404/503: deploy the resolver, check resource visibility and resolver
  infrastructure; unsupported links are deliberately rejected.
- Camera denied: grant camera permission in Android Settings and retry.
- Java/Gradle errors: confirm JDK 21 and SDK 36; Windows paths need quoting.

Reference: [Capacitor 8 toolchain](https://capacitorjs.com/docs/updating/8-0),
[barcode scanner](https://capacitorjs.com/docs/apis/barcode-scanner),
[native Firebase authentication](https://capawesome.io/docs/sdks/capacitor/firebase/authentication/).

Out of scope: Google Play, iOS, push, verified Android App Links, offline data
synchronization and longer-lived sessions.
