# Paid membership client contracts

`makerspace-ts-api-client-2.11.0.tgz` preserves the existing 2.10.0 client and
adds `ContinuousPaidMembership`, `IncreaseContinuousPaidMembership`,
`getContinuousPaidMembership`, and `increaseContinuousPaidMembership` generated
from Rails OpenAPI. The portal imports these generated types and uses its
existing authenticated Axios/native transport for the dedicated endpoints.

To regenerate, first run Rails' `bundle exec rake rswag:specs:swaggerize`, then
`node scripts/generate-paid-membership-client.cjs <swagger JSON> <client checkout>`
from this React checkout. Build the client, set its package version to 2.11.0,
and pack the resulting `lib/` and `dist/` into this vendor archive. Verify
`yarn install --frozen-lockfile`, typechecking, tests and the production build.

The archive is a tested local dependency. Publish the corresponding client
release separately, then replace the file dependency with registry version
2.11.0 and regenerate `yarn.lock` before coordinated release. Swagger generation
does not publish npm packages. Deploy Rails accounting/indexes and review/apply
the historical baseline before releasing the UI and held wiki documentation.
