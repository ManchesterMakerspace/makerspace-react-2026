# Makerspace React agent handbook

## 1. Repository purpose and boundaries

This repository implements the member portal, administrative UI, and Capacitor
mobile app. Rails owns persistence, authorization, payments, jobs, and the API.
Use Node 22 and Yarn Classic with the committed `yarn.lock`. Start with
`yarn install --frozen-lockfile`, then `yarn start`; select checks in section 5.
Read [the UX standard](docs/user-experience.MD) before any user-visible change.
Rails-backed E2E resets data: use only disposable test data and sandbox services.

Treat this and `makerspace-rails-2026` as independent Git checkouts. Inspect
`git status --short` before editing, preserve existing changes, and use an explicit
working directory for each command. A sibling checkout is unnecessary for UI-only
work, Jest, typechecking, builds, and mocked browser checks.
This is the canonical handbook; keep overlapping companion instructions aligned.

| Tool | Entry point |
| --- | --- |
| Codex | Root `AGENTS.md` via [native discovery](https://learn.chatgpt.com/docs/agent-configuration/agents-md). Sessions launched from the enclosing workspace must explicitly read the applicable repository handbook before working there. |
| Claude Code | [CLAUDE.md](CLAUDE.md) imports this file with unquoted `@AGENTS.md`, including for sessions without native AGENTS loading; no symlink is needed. See [memory imports](https://code.claude.com/docs/en/memory). |
| Cursor | Read root `AGENTS.md` directly, as supported by [Cursor rules](https://cursor.com/docs/rules); no separate Cursor rules file. |
| GitHub Copilot | [.github/copilot-instructions.md](.github/copilot-instructions.md) is a self-contained summary directing readers here. A link is not an automatic import; [support varies by surface](https://docs.github.com/en/copilot/reference/custom-instructions-support). |

## 2. Setup and common commands

Current stack: React/TypeScript, Redux with thunk, React Router, MUI, webpack,
and Capacitor. Verify commands/versions in [package.json](package.json),
[yarn.lock](yarn.lock), [.nvmrc](.nvmrc), and [CI](.github/workflows/ci.yml).
Use Yarn Classic (1.x); do not introduce another lockfile or package manager.
From this repository root, in either PowerShell or Bash:

```sh
yarn install --frozen-lockfile
yarn start
```

| Command | Purpose / prerequisite |
| --- | --- |
| `yarn typecheck` | TypeScript including tests through `tsconfig.test.json`; webpack alone does not typecheck. |
| `yarn test --runInBand <test-path>` | Focused Jest; replace `<test-path>` with a file or directory under `tests/unit/`. |
| `yarn test --runInBand` | Full Jest suite, configured in `package.json`, using jsdom and ts-jest. |
| `yarn build` | Production webpack output in `dist/`, then `scripts/build_rails_manifest.js`. |
| `npx playwright test` | Rails-backed E2E; complete section 5 prerequisites first. |
| `yarn build:native` | Native webpack output in `dist-native/`; requires `NATIVE_API_ORIGIN`. |
| `yarn android:sync` / `yarn ios:sync` | Build native assets and synchronize the selected Capacitor platform; see section 7. |

The development server listens on **3035**. [dev.config.js](dev.config.js)
has a fixed `/api` proxy to `http://localhost:3002`; `API_DOMAIN` is not read.
For live API development, run Rails on 3002 using its handbook. E2E instead has
**Rails serve both compiled UI and API on 3035**; do not run both servers there.

Web API paths normally remain relative to the current origin. `BASE_URL` is a
build-time webpack setting, but consumers differ: it is not a universal override
for local wrappers using literal `/api` URLs. Inspect the affected client.
Runtime public configuration comes from `/api/config`, through
[clientConfig.ts](src/api/clientConfig.ts); do not replace it with baked-in secrets.
Older E2E documentation and Rails CI use `--ignore-engines` during installation;
React CI uses `--frozen-lockfile` alone. Investigate engine failures against Node 22
and the lockfile rather than silently changing dependencies.

## 3. Architecture and implementation conventions

### Current layout

| Area | Start here |
| --- | --- |
| Bootstrap | [src/app/main.tsx](src/app/main.tsx): Redux/thunk, router, MUI theme, toast provider, and PWA registration. |
| Session and routing | [App.tsx](src/app/App.tsx), [PublicRouting.tsx](src/app/PublicRouting.tsx), [PrivateRouting.tsx](src/app/PrivateRouting.tsx): session restoration, TOTP gating, redirects, public/member routes. |
| State | [src/ui/reducer.ts](src/ui/reducer.ts), [reducer hooks](src/ui/reducer/hooks.ts), feature actions/reducers under `src/ui/`. |
| Reusable UI | [src/components](src/components), [src/ui/common](src/ui/common), and [src/ui/hooks](src/ui/hooks). |
| Feature UI and types | [src/ui](src/ui) groups screens by feature; [src/app/entities](src/app/entities) holds local domain types. |
| API access | Published `makerspace-ts-api-client` plus local wrappers in [src/api](src/api); existing wrappers use both Axios and fetch. |
| Native bootstrap | [src/native/main.ts](src/native/main.ts) installs [transport.ts](src/native/transport.ts) before importing the web app. |
| Scanners | [src/nfc](src/nfc), [NFC UI](src/ui/nfc), and [QR UI](src/ui/qr); platform sources are described in section 7. |

### Practices for changes

- Follow nearby coding style, aliases, types, and state patterns. Preserve existing
  TypeScript settings: `strict` and `noImplicitAny` are false in
  [tsconfig.base.json](tsconfig.base.json). A strictness migration is separate work.
- Reuse [computeCapabilities/useCapabilities](src/app/permissions.ts) and
  server-provided resource capabilities. Avoid scattering role comparisons through
  components. UI visibility is not authorization; Rails must enforce access.
- Preserve public/member visibility and shop/tool-scoped permissions. Check
  ordinary members, privileged users, and out-of-scope resource managers.
- Preserve cookie authentication, TOTP/session restoration, global auth interception,
  and CSRF. Mutations need the current `XSRF-TOKEN` cookie and `X-XSRF-TOKEN` header
  where used by the existing wrapper.
- Native transport bridges portal fetch/Axios through the native cookie jar and
  bootstraps CSRF via `/api/config`. Do not store session cookies in localStorage,
  disable CSRF, or assume browser and native transport are identical.
- Preserve endpoint-specific casing, envelopes, pagination headers, status codes,
  and errors. Reservation wrappers return `{ data, response }` or
  `{ error, response }`; NFC requests can throw and return null for specific results.
  Do not normalize every endpoint to one invented shape.
- Use the published client where the feature already uses it; extend local wrappers
  consistently where appropriate. No request-library migration is required.
  A new published client version has its own release workflow.

### UX obligations

Read and follow [docs/user-experience.MD](docs/user-experience.MD) before creating
or changing user-visible UI, styling, layout, typography, colors, icons, imagery,
interaction feedback, or responsive behavior. It is the authoritative UX and
visual-design standard. Reuse the established MUI theme and patterns.
Check the widths and accessibility checklist in section 5 and in that standard.
If intentionally changing a shared convention, update the UX standard in the same
change. Never silently depart from it: scope a required product exception narrowly
and document its reason in code or the UX standard, as appropriate.

## 4. Task-specific documentation

Read documents relevant to the task; do not load every feature document. Always
read and follow every instruction document in `docs/` that covers the area you are
changing, whatever its file type, rather than working from memory of what it says.

| Task | Documentation |
| --- | --- |
| Any user-visible change | [UX and visual design](docs/user-experience.MD). |
| Rails-backed browser flow | [Local E2E setup](docs/local-e2e.md); also account for the container caveat in section 5. |
| Mocked browser checks | [Browser check guide](tests/browser/README.md). |
| NFC, fobs, PWA, native transport | [NFC/native implementation](docs/nfc-mobile.md), [mobile environment](docs/mobile-environment.md); [original plan](docs/nfc-capacitor-plan.md) is design history. |
| QR camera, scan links, permissions | [QR scanning](docs/qr-scanning.md). |
| Backend contracts or feature semantics | Read the companion Rails handbook and its task-specific documentation table; use the [Rails repository](https://github.com/ManchesterMakerspace/makerspace-rails-2026) when no local checkout is needed. |

Update feature docs when behavior changes, and this handbook plus the Copilot
summary when shared guidance changes. Distinguish current behavior from recommended
practice; scripts/manifests/workflows resolve older documentation drift.

## 5. Testing and completion criteria

Run focused checks first. Expand for shared behavior, API contracts, authentication,
dependencies, or builds. A webpack build does not prove type safety or working UI.

| Change | Validation to select |
| --- | --- |
| UI-only feature | Focused Jest, `yarn typecheck`, and UX checklist below; appropriate mocked browser check when available. No Rails checkout required. |
| Shared component/state/auth/API wrapper | Focused tests, then full Jest and typecheck; `yarn build` for bundling/routing impact, and relevant Rails-backed flows for real contracts. |
| Dependencies, webpack, routing chunks | Full Jest, typecheck, production build, and smoke affected routes/assets; native build if shared with Capacitor. |
| NFC or QR scanner | Focused scanner/permission/transport tests, web build and mocked browser checks, native sync/build when affected, then physical-device acceptance. |
| Documentation only | Verify commands against source, links/casing, preserved obligations, companion consistency, and `git diff --check`; application suites are unnecessary. |

For every UI change, check **320, 600, 900, and 1280 px**, keyboard access,
visible focus/logical tab order, accessible control names and dialog titles,
and loading, empty, success, validation, and error states with useful recovery.
Inspect actual layout, including overflow, touch targets, and relevant dialogs.
Record unavailable browser/device checks instead of implying they passed.

### Mocked browser checks

After `yarn build`, `node tests/browser/nfc.cjs` and `node tests/browser/qr.cjs`
exercise simulated hardware/API behavior. QR uses a synthetic camera stream;
these do not establish real NFC or camera acceptance.
`node scripts/check_fix_tickets.cjs --tickets-only` builds its own UI fixture
and uses mocked APIs and installed Microsoft Edge. Read each harness's requirements.
`node tests/browser/checkout-links.cjs` is an optional **non-gating diagnostic**:
it skips unless `RUN_CHECKOUT_LINKS_TEST=1`, and even failures can return zero.
Follow the browser guide; never cite its exit status as a passing required check.

### Rails-backed Playwright prerequisites

Root [playwright.config.ts](playwright.config.ts) runs `tests/e2e/suites` sequentially
with one worker. There is no `yarn e2e` script. Its default URL uses port 3000;
set `APP_URL=http://localhost:3035` to match the documented local/CI Rails server.
Playwright does not start that server.

1. Prepare Rails with Ruby/Bundler, MongoDB replica set, Redis, and Rails CI's `e2e`
   environment fixtures. Set `RAILS_ENV=test`, disposable `MLAB_URI` with a database
   name containing `test`, `REQUIRE_MONGO_TRANSACTIONS=true`, required app secrets,
   `RAILS_SERVE_STATIC_FILES=true`, and `APP_DOMAIN` on 3035.
2. Supply real Braintree **sandbox** credentials (`BT_ENV=sandbox`, `BT_MERCHANT_ID`,
   `BT_PUBLIC_KEY`, `BT_PRIVATE_KEY`). Seeding needs them even for non-payment flows;
   mocked RSpec's dummy credentials do not suffice.
3. Verify transactions using the Rails handbook. Build/transfer the complete `dist/`
   tree as in section 6, then start Rails on 3035 in a separate terminal.
4. Install Chromium with `npx playwright install chromium` on Windows or
   `npx playwright install --with-deps chromium` on Linux. Set absolute `RAILS_DIR`
   and `APP_URL` in the React terminal, then run an affected suite or the full suite.

PowerShell, from this checkout (adjust the companion location when necessary):

```powershell
$env:RAILS_DIR = (Resolve-Path ../makerspace-rails-2026).Path
$env:APP_URL = 'http://localhost:3035'
npx playwright test tests/e2e/suites/14_fix_tickets.spec.ts --project=chromium
```

Bash equivalent:

```sh
export RAILS_DIR="$(cd ../makerspace-rails-2026 && pwd)"
export APP_URL=http://localhost:3035
npx playwright test tests/e2e/suites/14_fix_tickets.spec.ts --project=chromium
```

The server and Playwright seed process need the same test configuration.
[Global setup](tests/e2e/global.setup.ts) runs `bundle exec rake db:db_reset`;
[seed helpers](tests/e2e/fixtures/seed.ts) also execute Rails commands.
Without `RAILS_CONTAINER`, they use `RAILS_DIR` and force `RAILS_ENV=test`.
With `RAILS_CONTAINER`, `docker exec` uses the **container's environment**, without
forcing test mode; inspect its database/environment before running anything.
Any nonempty `SKIP_DB_RESET` value (even `false`) skips global reset. Use it only
for deliberately prepared disposable fixtures; other test mutations still run.
Results/traces are under `tmp/playwright-results`.

Finish with changes made, checks actually run, failures/unavailable prerequisites,
documentation updates, and companion-repository/release requirements.

## 6. Cross-repository changes

For shared features, inspect both Git statuses and both handbooks. Trace the Rails
route, authorization, serialization, and specs alongside React wrappers, types,
capabilities, and UI. Authentication changes need password/TOTP/session/CSRF checks
on both sides. Keep compatible deployment order explicit.
Rails endpoint changes require executable API specs and regenerated Swagger;
updating `makerspace-ts-api-client` is a separate publication/dependency update.

For Rails-served UI, run `yarn build` here, set absolute `RAILS_DIR` as above,
then copy **all** compiled assets: lazy JS/CSS chunks, nested images, and generated
manifest included. Do not copy only the main JS/CSS pair. PowerShell:

```powershell
$assetTarget = Join-Path $env:RAILS_DIR 'app/assets/builds'
New-Item -ItemType Directory -Force -Path $assetTarget | Out-Null
Copy-Item -Path './dist/*' -Destination $assetTarget -Recurse -Force
```

Bash:

```sh
mkdir -p "$RAILS_DIR/app/assets/builds"
cp -R dist/. "$RAILS_DIR/app/assets/builds/"
```

Use a disposable/local asset destination; account for stale generated files when
reusing it. Validate served routes and asset resolution in Rails after transfer.

## 7. Operational constraints and common pitfalls

### Native work

Use HTTPS `NATIVE_API_ORIGIN` with no path/trailing slash; it is compiled into native
assets. Supply an intended sandbox/deployment origin, for example:

```powershell
$env:NATIVE_API_ORIGIN = 'https://portal.example.org'
yarn android:sync
yarn android:debug
```

```sh
export NATIVE_API_ORIGIN=https://portal.example.org
yarn android:sync
yarn android:debug
```

Android needs JDK 21 (`JAVA_HOME`) and an Android SDK (`ANDROID_HOME`);
[Gradle variables](android/variables.gradle) specify API 36/minimum 24. Follow
[native setup](docs/nfc-mobile.md) for SDK/build-tools installation.
`yarn android:open` opens Android Studio; `yarn android:release` builds an AAB after
sync and does not publish it. Signing variables are in the mobile environment
inventory; never commit keystores/passwords. Debug output is under
`android/app/build/outputs/apk/debug/`.

iOS needs macOS/Xcode and an NFC-capable signing team: `yarn build:native`,
`yarn ios:add` once, then `yarn ios:sync` and `yarn ios:open`.
Windows cannot compile/accept iOS builds.
Maintain iOS source in [native/ios](native/ios) and generation logic in
[configure-ios.js](scripts/configure-ios.js); `ios/` is generated and ignored.
Maintain app-owned Android code under `android/app/src/main/java`, plus its
manifest/configuration. `dist/`, `dist-native/`, copied platform web assets, and
Gradle outputs are generated; fix their inputs and rebuild/sync.

Build success does not verify NFC, cameras, or authentication. Physical acceptance
must cover real fobs/QRs, permissions/denials, cancellation, repeated scans,
background/resume, UID normalization, and intended role restrictions.
Verify password login, TOTP, logout/expiry, cookie persistence, and enabled Firebase
callbacks on the intended deployment/device. Document platform/hardware gaps.
Preserve read-only NFC scanning, safe URLs, and the PWA policy against caching
authenticated data or offline mutations.

### Other pitfalls

Use manifests/workflows as command authority, not historical comments. Retained
release scripts tag/push/publish artifacts; they are not validation commands and
are not wired into current React GitHub Actions. The older integration script
invokes missing `yarn e2e`; use root Playwright instead.
`yarn clean` is a destructive POSIX-style script, not a portable setup requirement.
Keep secrets out of source, generated bundles, logs, and examples. Do not change
application/configuration behavior merely to match stale prose.
