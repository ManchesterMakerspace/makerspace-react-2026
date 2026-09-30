# NFC scanning and native mobile implementation plan

Status: implementation added 2026-09-26. This document preserves the design plan; see [implementation and build instructions](nfc-mobile.md) for the delivered behavior and remaining device/deployment acceptance checks. The implementation reuses the existing `/api/shortcodes/:code` resolver and selected-resource Workshop views rather than adding duplicate endpoints/routes.

## Platform decision

Use a common scanner interface with Web NFC and native Capacitor implementations. Web NFC is NDEF-oriented: `NDEFReadingEvent.serialNumber` can supply a UID but may be empty, and it cannot reliably discover arbitrary non-NDEF cards or identify their technology. Native Android scanning is required to meet the broader MIFARE UID requirement. MIFARE compatibility depends on the card and phone; do not promise that every MIFARE variant works on every device.

| Environment | NDEF | UID |
| --- | --- | --- |
| Supported Android browser over HTTPS | Web NFC | Best effort through serialNumber on readable tags |
| Capacitor Android app | Native NFC bridge | Android Tag.getId, including supported non-NDEF tags |
| Optional Capacitor iOS app | Core NFC bridge | Supported tag families only; validate on hardware |
| Unsupported browser/device | Explain unavailable capability | Keep existing front-door import flow |

Native builds must select the native adapter explicitly; wrapping the app does not make Web NFC available in its WebView. Never format or write cards to make them readable. UID scanning is inventory input, not proof of identity or card authenticity.

Sources: [Web NFC specification](https://w3c-cg.github.io/web-nfc/), [Chrome Web NFC guidance](https://developer.chrome.com/docs/capabilities/nfc), [Android NFC technologies](https://developer.android.com/develop/connectivity/nfc/advanced-nfc), [Android Tag API](https://developer.android.com/reference/android/nfc/Tag), [Apple Core NFC](https://developer.apple.com/documentation/corenfc).

## PWA recommendation

Offer an installable PWA as the primary member experience alongside the optional Capacitor build. A manifest, app icons, standalone display, and a narrowly scoped service worker provide installation and an offline shell while preserving the existing hosted session architecture. Installation does not expand Web NFC beyond the browser's NDEF/serial-number capabilities. Keep Capacitor for broader native UID scanning; test actual fobs early to establish whether individual deployments can operate entirely as a PWA.

Cache only versioned static assets and a generic offline page. Do not cache authenticated HTML, member/card responses or CSRF tokens, and do not queue card release/assignment for offline replay. Lookup and mutation require a live server response. Plan service-worker scope and updates with the Rails host so an update cannot interrupt an active fob operation. Serve the manifest and worker from appropriate same-origin paths; test install, update and offline states on Android Chrome.

Source: [PWA capabilities](https://web.dev/learn/pwa/capabilities). Include PWA delivery in the web-feature phase below; it does not replace the Android bridge required for non-NDEF UID coverage.

## Existing integration points

- `src/ui/common/Header.tsx`: right-hand signed-in menu; already suppresses the menu while TOTP enrollment is required.
- `src/app/permissions.ts`: central capability mapping. Add NFC capabilities here rather than spreading role tests through components.
- `src/ui/accessCards/AccessCardForm.tsx`: Register Fob / Replace Fob entry points and Register New Fob modal. Currently imports the latest front-door rejection through `adminGetNewCard`, then submits `adminCreateCard`; retains contract and ID-verification checks.
- `src/app/PrivateRouting.tsx`: existing `/workshops`, `/tools/:id/request-checkout`, and `/volunteer/tasks/:id` destinations. Dedicated shop/tool detail routes need to be added or mapped to a selected resource view.
- Rails `Admin::CardsController`: new/create/index/update only; index requires member_id. No UID lookup or deletion endpoint exists. `AdminController` permits admin and board roles.
- Rails `CardSerializer`: id, holder, expiry, validity, uid and member association. New lookup response should expose member_id explicitly without embedding full member details.
- Rails `Card`: unique UID index; lost/stolen flags; create/update provisioning callbacks. Creation currently invalidates existing cards before saving the new one, so duplicate assignment failures can affect existing access unless this order is fixed.
- Production webpack emits a Rails-oriented `/assets/` bundle. API requests include same-origin fetches and credentialed Axios requests; a native build needs both a standalone entry page and a coherent remote API transport.

## User behavior

### Menu scanning

Add `SCAN NFC` to the right-hand dropdown for authenticated active, unexpired members. Apply the same eligibility to admins/board by default; do not bypass the existing TOTP gate. Resource managers without admin/board privileges use the regular-member flow. Centralize eligibility using the server's membership semantics, including expiration, rather than Card.is_active? (which includes expired cards).

Opening the scanner shows a MUI dialog with instructions, scanning state, Cancel, retry/error feedback, and Scan Again. Start scanning from the button gesture; no automatic scanning on login. Show an unsupported-device explanation when needed. Feature detection alone does not establish that hardware exists or is enabled.

- Regular member: scan NDEF only. Discard incidental UID data before it reaches application state, display, logging, or API calls.
- Admin/board: read NDEF and available UID. For each distinct UID, retrieve its card record and display UID, holder, validity, expiry, and record/member identifiers. Unknown UID is clearly distinguished from lookup failure. Never treat an API timeout or forbidden response as “unregistered.”
- If member_id exists, offer `View member details`; only that action fetches the existing `getMember({ id })` API and opens the member detail view. Server-derived release eligibility avoids fetching full member details merely to show a release button.
- For privileged scans containing both UID and NDEF, retain the card result and offer the internal resource action so navigation does not hide card management. A single internal NDEF destination for a regular member can navigate directly; multiple destinations get a chooser.
- Process one tag result at a time, deduplicate repeat reads within a session, and allow another scan after results. Cancel listeners and pending requests on close, logout, navigation, backgrounding, or capability loss; ignore stale responses.

### NDEF destination handling

Create a shared decoder and URL classifier. Support URI, absolute-URI and Smart Poster records; honor Smart Poster precedence. Decode text for display and present unsupported record types safely without executing content. Put size/depth limits on nested records.

Only configured portal origins plus recognized shop/tool/bounty resource paths qualify for internal navigation. Match parsed origins and exact route patterns, not substrings. Treat the production portal origin separately from the native local origin. Support existing singular/plural public shop/tool HTML links and `/api` aliases, plus `/volunteer/tasks/:id` and existing tool checkout links.

Add authenticated React shop/tool detail destinations reusing workshop data/components and current visibility rules. Resolve portal `/L...` shortcodes through a small JSON resolver reusing Rails' existing mapping and authorization logic; current shortcodes are internally rewritten by Rails, not expanded by HTTP redirects. Revalidate the resolved target through the same classifier. Do not fetch arbitrary external destinations to discover redirects.

For all other URLs show the full URL and offer an explicit new-window action for safe HTTP(S) destinations (`noopener,noreferrer` in browser; external browser in native). Display unsupported or executable schemes as text with an explanation rather than executing them. Never automatically open an external URL. Missing or forbidden internal resources show the existing appropriate error.

### Release card

Offer `RELEASE CARD` only to admin/board when the card is lost OR its currently assigned member is expired or revoked. Lost orphaned cards remain eligible; an orphaned non-lost card does not become eligible merely because its member is missing. Stolen/suspended status alone does not add eligibility.

The release request removes the cards record, not the member. On confirmed success show exactly `Released, reusable`, clear stale assignment details, and allow rescanning. Disable duplicate submissions. Do not show success on failure. Preserve an audit snapshot of the released assignment and reconcile downstream access provisioning/caches. UID uniqueness means one record is expected; detect legacy duplicate records and resolve them before enabling release rather than silently deleting an ambiguous assignment.

### Register / replace fob

Place `SCAN NFC` beside `IMPORT NEW KEY` in AccessCardForm when an admin/board device offers a UID-capable adapter. Browser support is best effort and must explain that non-NDEF fobs may require the Android app. Hardware-disabled devices get an actionable NFC-settings message.

Maintain explicit candidate state `{ uid, source, lookupState }` shared by import and scan. A successful scan can become the candidate only after authoritative UID lookup returns not found. Existing records, including lost/expired assignments, block registration until released through the inspection flow. Empty UID or failed lookup never supplies a candidate. A late front-door import response must not overwrite a newer scanned candidate; reset candidate and ID verification when switching members or closing the form.

Scanning fills the card identifier; it does not submit. Preserve contract-on-file, identity verification, member refresh, replacement behavior and final Submit. The server rechecks UID uniqueness at assignment time and returns a conflict without invalidating any existing fob.

## API and data work (Rails plus React client)

Proposed endpoints, preserving existing member-filtered listing:

| Endpoint | Contract |
| --- | --- |
| `GET /api/admin/cards/lookup?uid=...` | Admin/board only; 200 card fields plus member_id, releasable, release_reason; 404 unknown UID; no embedded member profile; no-store |
| `DELETE /api/admin/cards/:id` | Admin/board only; recheck eligibility and expected assignment/version; delete eligible record and audit; 204 success; 409 changed/ineligible assignment |
| `GET /api/shortcodes/:code/resolve` | Authenticated, permission-checked internal target resolution; no arbitrary target fetch; no-store |

Use existing authentication, TOTP and CSRF controls, 401/403 handling, and normal validation conventions. Eligibility must be computed from authoritative member status/expiration rather than a potentially stale card copy. Use a concurrency-safe service for release, membership changes and assignment so a renewal/reassignment cannot race a stale release; select transaction/locking details after checking the deployment's MongoDB capabilities. A repeated delete must never remove a newly assigned card sharing the old UID.

Normalize every NFC-read UID to an uppercase hexadecimal ASCII string before deduplication, display, lookup, or use as a registration candidate. Use exactly two hexadecimal characters per byte, no separators or prefix, preserving leading zero bytes and the byte order returned by the NFC API. For example, bytes `[0x1B, 0x1A, 0x4D, 0x2F]`, Web NFC `1b:1a:4d:2f`, and `1b-1a-4d-2f` all become `"1B1A4D2F"`; `[0x00, 0x0A, 0xFF]` becomes `"000AFF"`. This is the hexadecimal representation of the UID bytes, not hexadecimal encoding of the serial string's ASCII characters.

The shared codec accepts native byte arrays (treat signed bridge bytes as unsigned) and validated Web NFC serial strings: contiguous byte pairs or consistently colon/hyphen-separated pairs, with optional surrounding whitespace. Reject empty strings, odd-length hexadecimal, malformed separators and non-hex characters rather than silently stripping arbitrary characters. Validate canonical NFC UID input server-side with `^(?:[0-9A-F]{2})+$`. Do not truncate longer UIDs, reverse bytes, parse the whole UID as a number, or infer decimal encodings. Reject missing/unstable identifiers for enrollment.

Before enabling UID assignment, compare physical samples read by the front door, Web NFC and Android against this fixed representation. Existing stored IDs may require a separately reviewed compatibility migration (current fixtures include non-hex examples). Check historical formats and normalization collisions first; do not silently rewrite legacy IDs or try ambiguous alternate lookups. The canonical format for newly scanned NFC UIDs is uppercase hexadecimal ASCII regardless of legacy storage discrepancies.

Harden create so validation/duplicate failures do not invalidate prior cards, and ensure both registration methods follow the same service. Ensure release triggers appropriate provisioning; the current model has no destroy provisioning callback. Inspect how rejection-card holder information is reconciled when a released UID is reused.

Update executable API specs, regenerate `swagger/v1/swagger.json`, and update the generated TypeScript client (or a typed local adapter consistent with existing APIs). Update applicable environment, public-resource, and job/service inventories for actual implementation changes.

## Scanner and Capacitor implementation

Create `src/nfc/` types, adapter selection, Web NFC adapter, native adapter, UID codec, NDEF decoder and URL classifier; `src/ui/nfc/` owns dialogs/results. Expose `getCapabilities`, `start(mode)` and `stop`, with modes `ndef`, `inspect`, `enroll`. Model support/enabled/permission separately.

Web adapter uses NDEFReader with AbortController, secure-context checks, and reading/readingerror handling. Native Android implementation uses a small app-owned Capacitor plugin with foreground reader mode, Tag.getId and optional Ndef data, technology metadata, hardware/enabled checks, and lifecycle cleanup. Enrollment can skip NDEF probing; inspection must not skip it. NDEF-only mode must not return UID. Neither adapter writes tags. Validate real MIFARE samples before declaring technology support.

Add pinned compatible Capacitor core/CLI/Android packages, `capacitor.config.ts`, Android project, native build scripts and a separate webpack output such as `dist-native`. Generate a complete HTML shell with viewport, assets and working lazy chunks, preserving the Rails build. Set webDir to that standalone output; package local assets for release.

Centralize API origin/transport across generated client, fetch and Axios calls. Prove cookie persistence, CSRF acquisition/header handling, CORS origin restrictions, login/logout, TOTP, session expiry and Firebase callbacks from the native local origin. Do not disable CSRF or use wildcard credentialed CORS. If native HTTP is chosen, migrate relevant calls consistently and verify cookie-jar behavior. This authentication spike precedes full native rollout.

Android: NFC permission and optional hardware feature declaration, foreground lifecycle, Android back navigation, safe areas, external-browser handling, and release signing configuration outside source control. Supply Windows Android Studio/SDK/JDK build instructions and debug APK/release AAB scripts. Pin prerequisites to the selected Capacitor version.

iOS is an optional macOS/Xcode build target using Capacitor iOS and Core NFC sessions, usage descriptions, entitlements and signing. Implement capability checks and technology-specific UID support; do not promise MIFARE Classic parity. Document device testing and leave unsupported tag operations unavailable. Windows can maintain shared source but cannot perform native iOS builds.

Sources: [Capacitor documentation](https://capacitorjs.com/docs), [native environment prerequisites](https://capacitorjs.com/docs/getting-started/environment-setup), [Capacitor cookie handling](https://capacitorjs.com/docs/apis/cookies).

## Delivery order and acceptance checks

1. **Hardware/UID and native-auth spike:** verify representative fobs, byte format, non-NDEF behavior, Android session/CSRF, and shortlist supported devices. Record findings as deployment prerequisites.
2. **Backend contracts:** UID lookup, conditional release with audit/provisioning, safe duplicate handling on assignment, shortcode resolution, API specs/client updates. Test role denial, lost/orphan cases, expiry/revocation, renewal/reassignment races, duplicates and failed creation preserving current access.
3. **Web feature:** capabilities, NDEF routing, scan dialog, card results/release, fob candidate integration. Unit-test normalization, URL-origin matching, malicious schemes, Smart Posters, stale responses, empty serials, API failures and scan cleanup. Mock NFC in browser tests to verify regular members never call card APIs or receive UID results.
4. **Android delivery:** standalone build, native plugin, complete authenticated flows and signed-build instructions. Test physical NDEF URI/text/Smart Poster tags, non-NDEF MIFARE cards, unknown/assigned/lost/expired/revoked cards, NFC disabled, unsupported hardware, permission denial, repeated taps, cancellation and background/resume. Verify reuse after release through the door system.
5. **Optional iOS:** build and sign on macOS, test supported tag families on real iPhones, and document limitations.

Run React typecheck, targeted Jest tests and web/native production builds; run Rails request/model/service specs and Swagger generation. Use Playwright for mocked UI coverage, not as evidence that physical NFC works. Verify MUI dialogs at 320, 600, 900 px and desktop, keyboard/focus restoration, accessible status announcements, long UIDs/URLs and safe-area layouts per `docs/user-experience.MD`.

Release gates: verified UID correspondence to stored cards; concurrency-safe assignment/release; native authenticated API access; actual hardware compatibility. Remaining deployment inputs are representative fobs, approved portal origins, Android application ID/signing ownership, and optional Apple signing team. These do not prevent implementing the shared interfaces and test fixtures.
