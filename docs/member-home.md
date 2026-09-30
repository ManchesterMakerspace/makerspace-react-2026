# Member home

`/home` is the authenticated member landing page. Anonymous visits go to login
with the complete Home path, query, and fragment preserved. The Rails catch-all
serves the React shell; personal data comes from authenticated APIs.

## Arrival and navigation

After root/default login or session restoration, regular members go to `/home`.
Pending regular members go to `/home?newMember=true`. Admins, board members, and
resource managers retain their profile landing. Everyone can use the Home menu
entry, which opens plain `/home`. Explicit destinations and required TOTP setup
take precedence over these defaults, including across provider callbacks.

New signup completion, including choosing no membership, goes to
`/home?newMember=true`. The signup workflow captures this intent before agreement
signing and shares the completion destination with the membership and payment
steps. Existing-member membership changes continue to their profile.

Only the exact query value `newMember=true` displays the Welcome banner and
onboarding paragraph. Plain Home shows membership coverage, status, and
expiration. Paid membership awaiting its start is labeled “Awaiting activation”;
other absent expiration dates are “Not set”. Household roles, subscriptions,
active earned memberships, and prepaid terms are distinguished.

## Data and actions

`GET /api/home` returns the current member, confirmed Slack acceptance and the
New Members channel link, and up to ten eligible safety checkouts. This response
is private and must not be cached. It never accepts a different member selector.
Home and invoices load independently and expose their own retry actions.

Slack guidance shows the email-invitation reminder until the member has a valid
linked Slack ID and current-email provisioning records confirm acceptance.
Accepted members see an HTTPS link based on the existing New Members channel
setting and workspace ID. Missing link configuration displays an unavailable
message. Viewing Home does not send invitations or perform provisioning.

The checkout list respects member status, expiration, all prerequisites, existing
checkout records, open requests, and tool/shop visibility and service status.
Orientation sorts first, followed by names alphabetically. Tool annotations
override shop annotations and appear inline. “Request Safety Checkout” opens the
existing request page, which revalidates eligibility before submission. Returning
to Home or refocusing the tab refreshes the recommendations.

Invoices always use the self-service `GET /api/invoices?settled=false` endpoint,
including for staff. Results are ordered by due date ascending and paginated.
Manual invoices use the existing cart/checkout flow; automatic invoices link to
subscription settings. Payment controls follow the existing billing permission.
The details dialog is read-only on Home.

## Delivery and checks

Deploy the additive Rails API before the React bundle. No data migration or new
environment variable is needed. Rails request/service/API specs cover privacy,
eligibility and Slack states; React tests cover content, navigation, signup
completion and invoice actions. The browser check uses mocked APIs and verifies
320/600/900/1280 px layouts and keyboard operation. Follow the shared
[user-experience standard](user-experience.MD).
