# Makerspace React instructions summary

Read [the canonical AGENTS.md](../AGENTS.md) before working. This file is a
self-contained summary, not an automatic import. Copilot support varies by surface.
Update overlapping instructions here whenever the canonical handbook changes.

- Stack: Node 22, Yarn Classic with committed `yarn.lock`, React/TypeScript, Redux,
  MUI, webpack, and Capacitor. Use explicit working directories, inspect Git status,
  and preserve existing changes. Rails is independent; UI-only work does not need it.
- Setup: `yarn install --frozen-lockfile`, then `yarn start`. Development UI is on
  3035 with a fixed `/api` proxy to Rails on 3002; `API_DOMAIN` does not configure it.
- Validation: start with `yarn test --runInBand <test-path>` and `yarn typecheck`.
  Expand to `yarn test --runInBand` and `yarn build` for shared behavior, auth,
  contracts, dependencies, or builds. Documentation-only work needs static
  command/link checks and `git diff --check`, not application suites.
- Before any user-visible change, read [the UX standard](../docs/user-experience.MD).
  Reuse the established MUI theme/patterns. Check 320, 600, 900, and 1280 px,
  keyboard/focus access, accessible names, and loading, empty, success, validation,
  and error states. Document narrowly scoped intentional exceptions; update the
  standard in the same change when a shared convention changes.
- Reuse capability helpers and server-provided capabilities. Rails enforces
  authorization. Preserve cookie auth, TOTP, CSRF, runtime `/api/config`, and
  endpoint-specific response shapes. Keep TypeScript settings/local style;
  both the published TypeScript client and local Axios/fetch wrappers exist.
- Mocked browser checks do not validate real APIs/hardware. The checkout-link
  diagnostic is non-gating, including when its process exits zero.
- Rails-backed `npx playwright test` needs complete compiled assets served by Rails
  on 3035, `APP_URL`, absolute `RAILS_DIR`, a disposable test database/replica set,
  Redis, and real Braintree sandbox credentials. Global setup resets data.
  `RAILS_CONTAINER` uses its container environment without forcing test mode.
- Native builds need HTTPS `NATIVE_API_ORIGIN` without path/trailing slash. Android
  needs JDK 21/SDK: `yarn android:sync`, then `yarn android:debug`. iOS compilation
  needs macOS/Xcode. Maintain source inputs, rebuild generated assets, and distinguish
  build success from physical NFC/camera/authentication acceptance.
- For cross-repository changes, read both handbooks and verify API/auth contracts.
  Report changes, checks actually run, failures/missing prerequisites, docs updated,
  and companion-repository or release requirements.
