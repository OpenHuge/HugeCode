# ADR 0002: Codex + HugeRouter V1 Runtime Path

Date: 2026-04-26
Status: Accepted

## Context

HugeCode's previous mainline architecture treated the repo-owned Rust runtime as
the product execution kernel. That runtime carried task/run truth, provider
routing, account pools, multi-backend placement, AutoDrive, approvals,
checkpoints, and Review Pack evidence.

For the first public release, the product priority has changed:

- use the built-in Codex app-server as the mainline execution path
- support local Codex and Claude as provider routes
- route model/provider access through OpenHuge/HugeRouter, including both
  arbitrary relay/provider+key paths and the official HugeRouter commercial
  service path
- keep merchant, metering, settlement, route receipts, and actual route
  decisions in HugeRouter
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
provider routing, merchant, metering, settlement, route receipt, or route
decision behavior.

The UI shell boundary should be a single runtime RPC invoker shape:

```text
shell / desktop bridge / web gateway / future embedded Codex app-server
  -> invoke(method, params)
  -> HugeCode runtime bridge facade
  -> T3-shaped provider, model, task, approval, and route-token adapters
```

Do not add separate per-shell implementations for each T3 runtime method. New
shells and the built-in Codex app-server path should provide only the invoker
transport and reuse the same method mapping. This keeps desktop preload, web
gateway, standalone Vite, and future app-server integrations compatible without
duplicating route-token, task-start, interrupt, approval, model, or backend
mapping logic.

This follows the current upstream Codex app-server direction: the app-server is
a rich-client control surface over JSON-RPC 2.0, exposes thread/turn/item
primitives, streams turn notifications, requires an initialize handshake, and
can generate version-matched TypeScript or JSON schema artifacts for the exact
Codex version being embedded. HugeCode should consume that boundary as a
transport-agnostic adapter surface instead of copying Codex agent lifecycle
logic into each product shell.

## V1 Ownership

HugeCode owns:

- desktop onboarding and workspace selection
- embedded Codex app-server lifecycle management
- Codex task entry, event rendering, approval presentation, and Review Lite UI
- typed connection, capacity, plan, order, and route-token UI and contract
  surfaces
- local configuration hygiene for a HugeRouter-backed Codex provider
- clear degraded-state messaging when Codex app-server or HugeRouter is not
  ready

HugeRouter owns:

- tenant, project, principal, and virtual-key identity
- arbitrary relay/provider+key execution paths
- official HugeRouter commercial service routing
- merchant, metering, settlement, pricing, and ledger behavior
- route receipts, admission, retry, fallback, and actual route decisions
- provider resources, provenance classes, and shared or brokered capacity
  eligibility
- compliance policy for external relay capacity

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
- maintain a second provider routing, merchant, metering, settlement, or billing
  system inside HugeCode
- extend the repo-owned native runtime kernel for launch-critical features

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

For V1, built-in Codex/app-server is the mainline path. Local Codex and Claude
remain supported provider routes. Repo-owned native runtime work stays in
future/lab development until it can return without duplicating Codex execution
or HugeRouter routing responsibilities.

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
- shell/runtime-gateway/app-server invoker reuse for T3 runtime bridge methods

## Reference Inputs

- OpenAI Codex app-server README:
  <https://github.com/openai/codex/blob/main/codex-rs/app-server/README.md>
- OpenAI Codex config reference entrypoint:
  <https://developers.openai.com/codex/config-reference>
