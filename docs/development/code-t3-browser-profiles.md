# Code T3 Browser Profiles

`apps/code-t3` exposes browser profiles as user-selected session references for opening web
products from the t3code-style workspace.

## Safety Model

- HugeCode must not store, export, copy, or replay cookies, passwords, OAuth tokens, or session
  storage.
- A browser profile is a pointer to an existing browser session or a remote DevTools endpoint, not a
  credential container.
- Fingerprint support means native fingerprint transparency and consistency checks. HugeCode may
  show browser-exposed attributes such as browser family, language, timezone, device class, profile
  source, and connection state.
- Custom web product URLs must use `http` or `https` and must not embed credentials.
- Plain-HTTP remote DevTools endpoints are only allowed for loopback hosts such as `localhost` or
  `127.0.0.1`; non-loopback remote endpoints must use HTTPS.
- Do not implement anti-detect behavior, CAPTCHA bypasses, risk-control evasion, or fingerprint
  spoofing. If a future managed browser profile needs stable device metadata, it must be disclosed
  as a user-controlled local profile and must not impersonate another user or device.

## Supported Session Types

- Hugerouter-native service session: opens Hugerouter as a first-party AI service product with
  ChatGPT/Gemini/Claude-compatible routing labels. Hugerouter membership policy supports carpool
  seats, user rental, platform rental, revocation, and marketplace settlement.
- Current browser session: opens Hugerouter, ChatGPT, Gemini, or a custom URL with the account
  already available to the current browser context.
- Remote DevTools reference: saves only a sanitized endpoint URL and label. Credentials remain in
  the remote browser.
- Hugerouter profile sync mock: stores profile metadata, device count, and remote-session
  availability locally while explicitly blocking credential payloads. This models how two HugeCode
  installations can use a member account through a remote session without copying cookies or tokens
  between machines.
- Guest Pass mock: creates a time-limited, revocable, supervised-use pass for a selected provider
  profile. The pass stores only a local invite code, profile/provider metadata, expiry, audit mode,
  and blocked-action policy; it does not store passwords, cookies, tokens, local storage, session
  storage, or browser database material.
- Seat Pool mock: groups supervised Guest Pass seats for a provider profile without enforcing a web
  device-count cap in the local product mock. For Hugerouter-native memberships, this is a supported
  first-party carpool/rental model. For third-party web products, it keeps each member revocable
  without sharing account credentials while Hugerouter validates eligibility.
- Commercial Seat Listing mock: lets the owner publish seat-pool metadata such as account tier
  (for example ChatGPT Plus, Pro 5x, Pro 20x, Gemini Advanced), monthly seat price, optional
  commercial seat limit, platform-rental discount terms, and listed/draft state. This is product
  metadata only; payments, order fulfillment, refund handling, KYC, and provider policy checks are
  not implemented in the local mock.
- Hugerouter Site Scope mock: all web-product data is assigned a Hugerouter-managed `siteId` derived
  only from the URL origin (`protocol://host[:port]`). Path, query, and hash are ignored for local
  identity so `https://linear.app/a?x=1` and `https://linear.app/b` share the same site record.
  Site-specific policy, eligibility, and plan interpretation belong to Hugerouter cloud.
- AI Gateway capacity mock: lets HugeCode register route metadata for a future Hugerouter service
  relay. Hugerouter-native, organization-approved API, and local CLI capacity can be counted as
  routable. Third-party personal browser sessions are recorded as owner-supervised references and are
  not counted as shared-account fan-out capacity unless Hugerouter later marks them authorized.
- Hugerouter Membership Marketplace mock: lets sellers publish Hugerouter-native AI credits or
  Hugerouter-authorized provider capacity, lets buyers place orders, and models escrow, relay
  provisioning, settlement, and refund states. This is HugeCode-side product state only; real
  payments, account-pool eligibility, service relay, dispute handling, and ledger writes belong to
  `openhuge/hugerouter`.
- Isolated App mock: creates multiple local app scopes for the same browser profile/provider. Each
  app has its own `appId`, app key, target URL, launch count, and browser-window launch parameters.
  The web mock proves product flow locally but cannot isolate third-party cookies. Electron binds
  isolated app opens to a dedicated managed session partition derived from profile id, site id, and
  `appId`, and keeps separate partition windows alive side by side.

## Product Shape

- The web fallback opens a HugeCode Browser launch window before navigating to the target site. This
  window exposes browser-like chrome: tab title, address bar, HTTPS status, profile label, quick
  starts, fingerprint profile, and explicit "Open Site" navigation.
- Browser profile, Hugerouter marketplace, Guest Pass, and Seat Pool controls live behind the
  dedicated Browser entry page in `apps/code-t3`. Keep the t3code workspace/sidebar close to upstream
  shape by exposing only a lightweight sidebar entry instead of embedding product management forms in
  the primary chat navigation.
- Keep profile/space language aligned with mainstream browser concepts: profiles separate browsing
  data, while spaces or launch contexts organize links and sessions.
- In-app browser surfaces must show enough URL and security context before users enter credentials.
- Friend or teammate sharing should be presented as "supervised remote-session access", not account
  credential sharing. The owner must be able to revoke access, see active passes, and keep sensitive
  actions blocked by default.
- Membership-pool UX should make policy deferral visible: show active/paused members, invite codes,
  and a clear note that site policy and plan compliance are handled later by Hugerouter strategy.
  Do not market it as password sharing, credential sync, or fingerprint/risk-control bypass.
- Custom website UX should show the Hugerouter site identity as the URL origin and avoid creating
  separate local product records for different paths or query strings under the same origin.
- Hugerouter-native membership UX should be more direct: show Hugerouter as the service product,
  expose Starter/Pro/Scale tiers, and state that carpool, user rental, platform rental, and compatible
  AI service routing are supported by Hugerouter product policy.
- Commercial UX should let sellers configure plan tier, multiplier, price per seat, and optional
  commercial inventory limit. Buyer-facing discovery should filter by service type/tier before any
  order or payment flow exists.
- Employee carpool UX can add platform-rental terms: the sharer may enable a discounted platform
  price and select supported relay platforms. This only describes Hugerouter rental metadata; actual
  platform leasing, eligibility checks, settlement, and revocation belong to Hugerouter.
- Enterprise gateway UX should lead with a simple capacity registry: owner, service tier, source
  mode, daily request budget, and concurrency. HugeCode should show routed capacity totals only for
  approved API or local CLI modes. Account-pool trading, settlement, compliance adjudication, and
  provider-specific eligibility belong to `openhuge/hugerouter`.
- Hugerouter market UX should cover the complete local transaction shape without pretending to be
  the settlement system: seller publishes credits, buyer selects credits, mock escrow is held,
  Hugerouter relay is provisioned, then the order can be settled or refunded. Listing sources should
  distinguish Hugerouter-native credits from Hugerouter-authorized pools.
- Isolated-app UX should let users create and open multiple local app scopes side by side for testing.
  Web mode only carries isolation metadata and will still inherit the current browser's login state.
  Real storage isolation belongs in the Electron/browser host by mapping `appId` to a persistent
  partition and window; separate Gemini app partitions should not share Google login cookies until the
  user logs into each partition.

## Hugerouter Contract Direction

The future `openhuge/hugerouter` service should expose profile sync as a remote-session handoff
contract, not a credential-sync contract:

- Syncable: profile label, provider capability, device binding, remote session reference, health,
  last sync timestamp, and user-visible policy text.
- Not syncable: cookies, passwords, refresh tokens, OAuth access tokens, local storage, session
  storage, private keys, or raw browser databases.
- Account usability across machines should come from controlling or resuming a logged-in browser
  session on an authorized device, or from the provider's official login/sync flow.
- Guest pass fields should remain capability metadata: pass id, profile id, provider id, expiry,
  revoked state, approval policy, audit mode, and blocked-action categories. A production pass is a
  Hugerouter capability to a controlled remote session, not a serialized browser profile.
- Website-scoped fields should use `siteId`, `siteOrigin`, and `siteLabel` derived from URL origin
  only. Hugerouter cloud is the policy source for provider-specific site rules, not HugeCode local
  path matching or hard-coded site-policy tables.
- Seat pool fields should remain management metadata: pool id, provider id, profile id, site id,
  optional site-policy seat limit, member labels, member pass ids, active/paused status, and policy text.
  Hugerouter-native pools may be marked `hugerouter-native-supported`. Third-party pools remain
  policy-deferred. Seat pools must not introduce password sharing, cookie sync, fingerprint spoofing,
  or credential export.
- Commercial listing fields should remain marketplace metadata: plan type, plan label, service
  multiplier, monthly seat price, listing status, optional seat inventory, and derived availability.
  Platform-rental fields may include enabled state, supported platform ids, discount price, and
  Hugerouter settlement mode. They must not imply payment has been collected or that a provider's
  terms have been validated.
- AI gateway route fields should remain relay metadata: owner label, provider, service tier, source
  mode, daily request budget, concurrency, routable flag, and review status. A route backed by a
  personal browser session must default to review-required and must not be used as a team-wide
  account resale channel unless Hugerouter can prove provider authorization.
- Hugerouter marketplace fields should remain transaction metadata: listing id, tier, seller label,
  source kind, available credits, minimum purchase, unit price, buyer label, order id, escrow state,
  relay state, platform fee, seller proceeds, settlement state, and refund state. HugeCode must not
  store payment credentials, raw account credentials, cookies, tokens, or provider session material.
- Isolated app fields should remain app-scope metadata: app id, app key, provider id, profile id,
  target URL, launch count, and storage-boundary state. They must not serialize cookies, tokens,
  passwords, session storage, local storage, or browser databases.
- Sensitive owner surfaces should require owner approval or be blocked outright: account settings,
  billing, password changes, security settings, payment methods, credential export, and raw developer
  access to browser storage.

## Validation

Run:

```bash
pnpm --filter @ku0/code-t3 test
pnpm --filter @ku0/code-t3 typecheck
pnpm --filter @ku0/code-t3 build
```
