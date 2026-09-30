# Running the Playwright E2E tests locally

The full suite uses real Rails APIs and resets/seeds its database. Use a disposable
database whose name contains `test`, never a development or production database
with data you want to keep.

## Dependencies

- Node.js 22 and Yarn; run `yarn install --frozen-lockfile --ignore-engines` here.
- Ruby 3.4 and Bundler; run `bundle install` in the sibling Rails checkout.
- MongoDB 7.0 configured as a replica set, and Redis 7. Docker Desktop with WSL2
  support can supply these services on Windows. Keep the shell, Ruby, Node and
  repository paths consistent if using WSL.
- Playwright's Chromium: `npx playwright install chromium` on Windows;
  `npx playwright install --with-deps chromium` on Linux.
- Valid Braintree **sandbox** credentials: `BT_MERCHANT_ID`, `BT_PUBLIC_KEY`, and
  `BT_PRIVATE_KEY`. The existing seed creates payment fixtures and requires these
  even for the ticket-only E2E suite. Dummy credentials are not sufficient.

## Prepare Rails and the UI

Use the Rails `.github/workflows/ci.yml` **e2e** job's environment block as the
local configuration reference, supplying sandbox credentials privately. In
particular, set `RAILS_ENV=test`, `MLAB_URI` to your disposable test database with
`?replicaSet=rs0`, `REQUIRE_MONGO_TRANSACTIONS=true`, `REDIS_URL`,
`SKIP_EMAILVALIDATION=true`, `RAILS_SERVE_STATIC_FILES=true`, and the required
Devise/OTP secrets. Set `APP_DOMAIN` and `APP_URL` to `http://localhost:3035`.
These variables must be available both to Rails and to the Playwright seed process.

In the Rails checkout, from a Docker-enabled Bash shell:

```sh
bash scripts/ci/start-mongo.sh
docker run --detach --name makerspace-e2e-redis --publish 127.0.0.1:6379:6379 redis:7
bundle exec ruby scripts/ci/verify-mongo-transactions.rb
```

In the React checkout, build the current code and copy the complete `dist/`
contents into Rails' `app/assets/builds/`. Then run
`bundle exec rails s -b 127.0.0.1 -p 3035` in a separate Rails terminal.

Set `RAILS_DIR` to the absolute Rails checkout path. From the React checkout:

```sh
yarn build
# Copy dist/* into ../makerspace-rails-2026/app/assets/builds/ before testing.
npx playwright test tests/e2e/suites/14_fix_tickets.spec.ts --project=chromium
npx playwright test
```

Playwright uses the root `playwright.config.ts`; no `yarn e2e` script is defined.
Global setup runs `bundle exec rake db:db_reset`. Use `SKIP_DB_RESET=true` only
when deliberately reusing an already prepared disposable fixture database.
Screenshots, videos and retry traces are in `tmp/playwright-results`.

## Member landing and page helpers

`AuthPage.signIn` asserts the default destination from the signed-in member:
regular members land on `/home` (`?newMember=true` for pending members), while
admins, board members, and resource managers retain their own profile landing.
Tests that need profile tabs must call `MemberPage.gotoOwnProfile()` explicitly.
`waitForProfile()` only waits for a profile that was already requested; it never
changes the login destination. Signup tests assert the welcome Home destination
before opening the profile for follow-up checks. `SettingsPage.goto()` uses the
Home Account Settings link or the existing profile button, not the dropdown.
`MemberRentalsPage.clickProceed()` verifies that signing an agreement opens
`/members/:id/dues` with the Dues tab selected, rather than falling back to Home.

After building web assets, `node tests/browser/home.cjs` exercises these same
page objects against the built UI with mocked APIs, including active/pending
members, staff, restored sessions, explicit profile/settings navigation, and
rental-agreement signing through to the rental invoice payment action.
This check does not require backend credentials or reset a database; the full
Rails/Braintree E2E suite remains a separate check.

## Ticket UI checks without backend credentials

`node scripts/check_fix_tickets.cjs --tickets-only` builds an isolated UI fixture
and checks navigation, catalog loading/failure, cancellation, and the E2E page
helper's note/resolution flow at four widths. This harness uses installed
Microsoft Edge and mocked APIs; it does not replace the Rails-backed E2E suite.
