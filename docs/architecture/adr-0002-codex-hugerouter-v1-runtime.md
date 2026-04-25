# ADR 0002: Codex + HugeRouter V1 Runtime Path

Date: 2026-04-26
Status: Accepted

## Context

HugeCode's previous mainline architecture treated the repo-owned Rust runtime as
the product execution kernel. That runtime carried task/run truth, provider
routing, account pools, multi-backend placement, AutoDrive, approvals,
checkpoints, and Review Pack evidence.

For the first public release, the product priority has changed:

- use the mature Codex execution kernel for local agent work
- route model/provider access through OpenHuge/HugeRouter
- keep account access, route policy, shared capacity, usage, ledger, and
  merchant or relay governance in HugeRouter
- move the repo-owned native runtime to a separate lab branch for later
  development

The current native runtime has been preserved on branch
`codex/native-runtime-lab`. Mainline V1 work should not depend on that runtime
for launch-critical execution.

## Decision

HugeCode V1 will use this production path:

```text
HugeCode desktop UI
  -> embedded Codex app-server
  -> Codex model provider config
  -> HugeRouter /v1 Responses-compatible gateway
  -> HugeRouter route policy, provider resources, usage, ledger, and upstreams
```

The mainline runtime boundary becomes a thin adapter layer. It may start and
supervise Codex app-server, write an isolated Codex config, pass a revocable
HugeRouter route token through environment variables, and render Codex thread,
turn, item, approval, diff, and review events. It must not rebuild HugeRouter's
provider routing, account pool, marketplace, pricing, or ledger behavior.

## V1 Ownership

HugeCode owns:

- desktop onboarding and workspace selection
- embedded Codex app-server lifecycle management
- Codex task entry, event rendering, approval presentation, and Review Lite UI
- local configuration hygiene for a HugeRouter-backed Codex provider
- clear degraded-state messaging when Codex app-server or HugeRouter is not
  ready

HugeRouter owns:

- tenant, project, principal, and virtual-key identity
- provider resources and provenance classes
- route policies, route receipts, admission, retry, and fallback decisions
- shared or brokered capacity eligibility
- usage events, metering, budgets, ledger, pricing, and merchant or relay
  governance
- compliance policy for account rental, seat sharing, and external relay
  capacity

Native runtime lab owns:

- AutoDrive experiments
- repo-owned multi-backend execution
- native task/run/checkpoint/review kernel work
- future evaluation of whether any native runtime capability should return to
  mainline

## V1 Non-Goals

Mainline V1 must not:

- require users to install Codex CLI separately
- use `codex exec` as the primary execution path
- store provider passwords, cookies, OAuth refresh tokens, browser databases, or
  raw provider session material
- implement third-party password sharing or cookie sync
- hide shared or brokered capacity behind an official-provider label
- maintain a second provider routing or billing system inside HugeCode
- extend the native runtime kernel for launch-critical features

## Integration Requirements

The Codex provider config must:

- use `wire_api = "responses"`
- point `base_url` at HugeRouter's protocol-compatible `/v1` root, not at
  `/v1/responses` or `/v1/chat/completions`
- read authorization from an environment variable such as
  `HUGEROUTER_ROUTE_TOKEN`
- keep route tokens out of persisted config files
- allow the selected model to be a HugeRouter model alias, not necessarily an
  upstream vendor model id

HugeCode should treat a successful HugeRouter route receipt as the source of
truth for selected target, provenance, fallback, usage, and support
diagnostics. HugeCode UI may summarize that truth, but it must not infer a
different routing explanation.

## Consequences

This decision intentionally trades native runtime flexibility for a faster,
more reliable V1 launch path. The native runtime is not deleted as a technical
asset, but it is removed from the mainline critical path.

Before any native runtime capability returns to mainline, it must prove one of:

- Codex app-server cannot provide the required execution behavior
- HugeRouter cannot own the required routing, account, policy, or ledger
  responsibility
- the capability provides a clear product advantage without duplicating Codex or
  HugeRouter responsibilities

## Validation

Initial implementation should add focused tests around:

- HugeRouter base URL normalization
- route-token environment isolation
- Codex provider config generation
- refusal to persist secret route token values
- refusal to configure endpoint URLs below `/responses` or `/chat/completions`
