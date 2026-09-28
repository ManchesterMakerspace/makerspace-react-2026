# Makerspace React

A frontend UI to integrate with [makerspace-rails](https://github.com/ManchesterMakerspace/makerspace-rails), built on React/Redux. 

## Development

Use Node 22 (see [.nvmrc](.nvmrc)) and Yarn Classic with the committed lockfile.
From this repository root, in PowerShell or Bash:

```sh
yarn install --frozen-lockfile
yarn start
```

The webpack development server listens on localhost:3035 and proxies `/api` to
localhost:3002. That target is fixed in [dev.config.js](dev.config.js);
`API_DOMAIN` does not configure it. Run Rails on 3002 for live API development.
Web requests normally use relative paths. `BASE_URL` is exposed at build time,
but does not override every local wrapper's literal `/api` URL; inspect the
relevant client before changing deployment origins. Public runtime configuration
comes from Rails `/api/config`.

See [AGENTS.md](AGENTS.md) for architecture, validation decisions, cross-repository
work, and Codex/Claude Code/Cursor/Copilot entry points. Rails is a separate checkout;
unit tests, typechecking, builds, and mocked UI checks can run without it.

## Testing

See [Local Playwright E2E setup](docs/local-e2e.md) for the current Rails-backed
suite, required services and sandbox credentials, and focused ticket UI checks.

Current tests use Jest/jsdom and Playwright, not the old Selenium workflow:

| Command | Scope |
| --- | --- |
| `yarn typecheck` | TypeScript check including tests. |
| `yarn test --runInBand <test-path>` | Focused Jest file/directory under `tests/unit/`; replace the placeholder. |
| `yarn test --runInBand` | Full Jest suite. |
| `yarn build` | Production webpack bundle and generated Rails asset manifest in `dist/`. |
| `npx playwright test` | Rails-backed browser suite using the root Playwright config. |

Webpack transpiles without replacing the separate typecheck. Start with focused
checks and expand for shared behavior, API/auth contracts, dependencies, and builds.
See [mocked browser checks](tests/browser/README.md) for QR and checkout-link checks;
the checkout-link diagnostic is non-gating and can exit zero after failures.

Rails-backed E2E serves the complete compiled UI and API from Rails on 3035, rather
than the webpack proxy. Set `APP_URL=http://localhost:3035` and absolute `RAILS_DIR`;
the root config otherwise defaults to port 3000. It needs disposable seeded data,
a MongoDB replica set, Redis, and real Braintree sandbox credentials. Global setup
resets the database. `RAILS_CONTAINER` uses its container's environment without
forcing test mode. Follow the local E2E guide and [handbook](AGENTS.md#5-testing-and-completion-criteria)
before running it. No `yarn e2e` script is defined in the current manifest.

## Automation

[GitHub Actions](.github/workflows/ci.yml) defines webpack build, Jest, and typecheck
jobs for pushes and pull requests targeting `master`. Rails' workflow provides
integrated Playwright coverage using compiled UI assets.

Historical [release scripts](scripts/release.js) remain: [tagging](scripts/simple_tag.js)
interprets `#patch`, `#minor`, and `#major`, and [gem packaging](scripts/release_gem.js)
can publish `makerspace-react-rails` to RubyGems. The current React Actions workflow
does not invoke these scripts; commit markers alone do not establish automatic
publication. Release scripts push tags/publish artifacts and are not test commands.

# CONTRIBUTIONS

Bug reports and pull requests are welcome on GitHub at https://github.com/ManchesterMakerspace/makerspace-react. This project is intended to be a safe, welcoming space for collaboration, and contributors are expected to adhere to the Contributor Covenant code of conduct.

Use the current GitHub Actions checks and the focused validation described above;
the historical Travis/Selenium description is not the current workflow.

# LICENSE

The app is available as open source under the terms of the MIT License.
# NFC and native mobile

See [NFC, PWA and native build instructions](docs/nfc-mobile.md) for scanning,
Android builds, optional iOS builds and required backend deployment.
