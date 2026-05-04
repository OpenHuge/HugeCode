# Code T3 Browser Profiles

`apps/code-t3` exposes browser profiles as user-selected session references for opening web
products from the t3code-style workspace.

## Safety Model

- HugeCode may support same-user, multi-device profile migration through encrypted, cloud-managed
  browser-state bundles. Those bundles can include cookies, Local Storage, IndexedDB, Cache Storage,
  Service Worker state, extension data, bookmarks, history, site settings, and disclosed browser
  environment configuration when the user explicitly syncs or migrates a profile.
- Raw credential and browser-storage export remains blocked. The product must not expose plaintext
  cookies, passwords, OAuth tokens, refresh tokens, private keys, raw browser databases, or session
  storage dumps through UI, logs, import/export files, or local mocks.
- A browser profile is a pointer to an existing browser session or a remote DevTools endpoint, not a
  plaintext credential container. Production sync payloads must be encrypted, versioned, scoped to
  the same authenticated user, and restorable only on trusted devices.
- Profile migration uses a single-writer lock. One device may open a profile read-write; other
  devices should see the active device, last sync time, latest version, and takeover options instead
  of writing concurrently.
- "Sync and close" or "migrate to another device" is the reliable commit point. Do not imply that an
  open profile is already safely uploaded until the profile is closed, the encrypted bundle is
  committed, and the write lock is released.
- Force takeover is allowed for stale or lost devices, but it must show data-loss risk, record an
  audit entry, and mark the previous device stale or read-only until it refreshes.
- Every successful close-and-sync should create a version snapshot so users can restore a previous
  stable profile when a site logs out, state conflicts, or profile data becomes corrupt.
- Fingerprint support means native fingerprint transparency and consistency checks. HugeCode may
  show browser-exposed attributes such as browser family, language, timezone, device class, profile
  source, and connection state.
- Custom web product URLs must use `http` or `https` and must not embed credentials.
- Plain-HTTP remote DevTools endpoints are only allowed for loopback hosts such as `localhost` or
  `127.0.0.1`; non-loopback remote endpoints must use HTTPS.
- Do not implement anti-detect behavior, CAPTCHA bypasses, risk-control evasion, or fingerprint
  spoofing. If a future managed browser profile needs stable device metadata, it must be disclosed
  as a user-controlled local profile and must not impersonate another user or device.
- Product copy must distinguish same-user multi-device migration from multi-person account sharing.

## Supported Session Types

- Hugerouter-native service session: opens Hugerouter as a first-party AI service product with
  ChatGPT/Gemini/Claude-compatible routing labels. Hugerouter membership policy supports carpool
  seats, user rental, platform rental, revocation, and marketplace settlement.
- Current browser session: opens Hugerouter, ChatGPT, Gemini, or a custom URL with the account
  already available to the current browser context.
- Remote DevTools reference: saves only a sanitized endpoint URL and label. Credentials remain in
  the remote browser.
- Hugerouter profile sync mock: stores profile metadata, device count, remote-session availability,
  single-writer lock state, device names, version snapshots, and audit entries locally. It models
  encrypted cloud-managed browser-state sync without exposing raw cookies, tokens, Local Storage,
  IndexedDB, or extension databases in the web mock.
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

- The Electron desktop browser opens a persistent Chrome-like HugeCode Browser shell with tabs,
  an address/search bar, HTTPS status, quick starts, and embedded web content hosted below the
  renderer chrome. This applies to normal provider launches and the ChatGPT assistant launch.
  The web fallback keeps the Chrome-like launch page and navigates away to the target site because
  browser-hosted cross-origin pages cannot be embedded reliably there.
- Browser profile, Hugerouter marketplace, Guest Pass, and Seat Pool controls live behind the
  dedicated Browser entry page in `apps/code-t3`. Keep the t3code workspace/sidebar close to upstream
  shape by exposing only a lightweight sidebar entry instead of embedding product management forms in
  the primary chat navigation.
- Keep profile/space language aligned with mainstream browser concepts: profiles separate browsing
  data, while spaces or launch contexts organize links and sessions.
- In-app browser surfaces must show enough URL and security context before users enter credentials.
- Multi-device UX should expose "Continue here", "Sync and close", "Migrate to another device",
  "Force takeover", and "Restore version" as explicit profile lifecycle actions.
- Profile status should show whether the profile is available, in use, syncing, conflicted, or
  stale-locked; the source device; recent sync time; latest version; and whether encrypted restore is
  approval-gated.
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

## Portable Account Data File Contract

- Customer handoff `.hcbrowser` files use `hugecode.t3-browser-account-data/v2` with
  `portable-browser-account-state`; the legacy `hugecode.t3-browser-static-data/v1` host-bound
  safeStorage bundle remains compatibility-only.
- Portable account data requires a separate import code. Do not include that code in the file,
  logs, task notes, screenshots, or repository fixtures.
- The portable payload is limited to allowlisted ChatGPT origins and must not include non-P0 profile
  metadata, marketplace records, account-pool data, raw cookies in plaintext, OAuth tokens,
  passwords, or unscoped browser storage dumps.
- Import succeeds only after the desktop bridge returns a structured restore success result. The
  renderer must not mark browser data ready or auto-open ChatGPT from bundle count alone.
- Wrong import code, tampered ciphertext, unsupported schema, empty portable payload, missing
  desktop bridge, or no allowlisted ChatGPT state must fail closed without marking data imported.

## ChatGPT Login Witness Closure

- After a successful portable account-data import, the renderer marks account data ready and opens
  ChatGPT through the HugeCode built-in browser provider path. This must stay on the `hcbrowser=1`
  Electron route; external browser fallback is not a valid P0-04 result.
- The HugeCode Browser shell derives a ChatGPT login witness from the desktop browser snapshot:
  active tab id, URL, title, loading state, HTTPS state, and target URL. The witness classifies
  failures as import-not-ready, browser-launch failure, target-load failure, session-restore failure,
  or external-site-blocked.
- ChatGPT DOM state is not read automatically. When ChatGPT loads in the built-in browser without a
  readable login proof, the shell reports `MANUAL_WITNESS_REQUIRED`; the operator can record a
  local `VERIFIED` witness only after visually confirming the signed-in ChatGPT UI.
- The local witness record is stored under `hugecode:t3-browser-chatgpt-login-witness:v1` and is
  intended for P0-06 handoff evidence. It must not contain plaintext cookies, tokens, import codes,
  screenshots, or raw ChatGPT account data.

## Customer Startup Import Gate

- When `hugecode:t3-browser-imported-data-ready` is absent, the startup surface must keep the
  customer on the account-data import gate. The primary action is importing a `.hcbrowser` account
  file.
- The manual ChatGPT login button inside that gate is only a fallback mount. It must not write the
  ready flag, must not be treated as a successful import, and must not trigger the P0-04 success
  handoff.
- The import flow may write the ready flag only after the P0-01 restore helper returns a structured
  `success: true` result. Empty bundles, unsupported schema, wrong import code, missing desktop
  bridge, or restore failure must stay fail-closed.
- Import notices should use masked summaries only. Do not render import codes, raw cookies, tokens,
  ciphertext, or browser-storage values in UI, logs, or tests.

## P0 Runtime Role Freeze

- `P0_RUNTIME_ROLE_MODE` is the P0 role carrier. Allowed values are `customer`, `operator`, and
  `developer`; missing or unknown values must resolve to `customer`.
- Customer mode exposes only account-data import, import retry, and the HugeCode built-in ChatGPT
  browser path. It must not show account rental, relay/proxy, guest pass, seat pool, marketplace,
  Chrome export, or browser account export controls.
- Operator mode preserves the `.hcbrowser` browser account export and login-state check needed for
  handoff preparation. It must not expose customer-only import success as a substitute for export.
- Developer mode may retain unreleased local debug surfaces such as account rental and relay helpers.

## Hugerouter Contract Direction

The future `openhuge/hugerouter` service should expose profile sync as a same-user encrypted
profile-migration contract:

- Syncable as plaintext metadata: profile label, provider capability, device binding, remote session
  reference, health, last sync timestamp, active lock holder, version number, source device, audit
  summaries, and user-visible policy text.
- Syncable only inside encrypted cloud payloads: cookies, Local Storage, IndexedDB, Cache Storage,
  Service Worker state, extension data, bookmarks, history, site settings, and browser environment
  configuration needed to restore the same user's Web environment.
- Not syncable or exportable as raw values: passwords, refresh tokens outside browser-managed
  storage, OAuth access-token fields, private keys, raw browser database files, and plaintext session
  storage dumps.
- Account usability across machines should come from controlling or resuming a logged-in browser
  profile on an authorized device, or from the provider's official login/sync flow. Same-user profile
  migration must not become multi-user account resale.
- Profile migration fields should include `status`, `lock`, `lastSourceDeviceName`, `lastSyncedAt`,
  `latestVersionId`, `latestVersionNumber`, `snapshots`, `stateClasses`, and `auditLog`. The lock is
  single-writer; force takeover records the previous device and warns about unsynced state.
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
