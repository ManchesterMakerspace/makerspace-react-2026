# Continuous paid membership profile

The Rails-backed `continuous_paid_membership.spec.ts` acceptance suite creates
scoped test accounts with the Rails fixture runner. It covers real Admin
conflict/increase transport and owner/Board/Resource Manager enforcement, with
no payment operations. For deliberately prepared disposable fixtures,
`SKIP_DB_RESET=true` avoids the unrelated global Braintree seed. The full root
E2E suite retains its documented sandbox prerequisites.

Authorized profiles display **Continuous paid membership: N months**, with
**Estimated history** and its explanation when Rails flags incomplete historical
evidence. Self, Admin and Board may read; Resource Manager alone may not read
another profile. `canViewOtherPaidMembershipMonths` and
`canIncreasePaidMembershipMonths` are dedicated capabilities. The latter is Admin
only. Generic profile editing cannot change the counter.

The compact, outlined **Adjust months** button opens the accessible MUI
**Increase paid membership months** dialog with the current value,
**Proposed months**, and required **Correction reason**. The value
must be a greater whole number; the reason is retained in the audit log. Saving
disables repeat submission. Success updates the counter. A 409 refreshes the
current value/revision and keeps the dialog open for review before a new submit;
read failures provide **Retry** and disable edits. Revoked, deadline-expired and
missing-expiration profiles explain that eligibility/expiration must be restored.
Profile status or expiration updates refresh the displayed count, so a revocation
shows its reset without requiring a page reload.

The dedicated Axios wrapper uses the existing global auth/native transport and
the current XSRF cookie on each request. GET returns the stored integer, revision
and estimated flag; PUT sends the desired integer, expected revision and reason.
Rails enforces the same roles, CSRF/TOTP, eligibility, validation and audit rollback.
Unpaid/earned renewals add no months, prepaid terms count immediately at duration
application, held payments count on first-fob release, refunds can retain internal
fractions, and 240 elapsed hours past expiration or revocation resets the streak.

Deploy Rails accounting/indexes first; review and apply historical baselines
before releasing the generated client and complete UI bundle. Client publication
is separate from Swagger generation. Wiki profile/admin/troubleshooting changes
remain held until deployment. There are no new environment variables.

Validation: Jest covers owner/Board/RM/Admin visibility, request transport,
validation, success, load retry and conflict recovery. The browser fixture uses
real controls and mocked APIs at 320/600/900/1280 px and checks keyboard/focus and
overflow. This does not replace the Rails-backed disposable-data acceptance flow.
