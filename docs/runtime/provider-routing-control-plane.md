# Provider Routing Control Plane

This document defines the provider-aware routing control plane used by HugeCode
Phase 1 launch, continuation, and review flows.

The goal is not to turn HugeCode into a provider marketplace or a settings
panel. The goal is to keep provider and backend choice inside one runtime/app
control plane so launch success rate, placement control, and review continuity
stay aligned. V1 includes both arbitrary relay/provider+key paths and the
official HugeRouter commercial service path, while HugeRouter remains the source
of truth for route decisions.

## Scope

The shared control-plane inputs are:

- typed connection, capacity, plan, order, and route-token contracts
- HugeRouter commercial-service availability and route-token state
- arbitrary relay/provider+key configuration
- explicit provider route selection from Mission Control launch
- selected composer model and its provider family
- explicit or inherited backend preference
- HugeRouter route receipts and runtime placement truth after launch

The shared control-plane outputs are:

- typed connection, capacity, plan, order, and route-token UI state
- normalized provider route selection
- launch-readiness route status
- send-turn provider field
- relaunch/review backend inheritance
- operator-facing routing diagnostics

## Route Resolution

Route resolution now stays inside `apps/code/src/application/runtime/facades/*`.

Current shared facades:

- `runtimeProviderRouting.ts`
  Normalizes provider-route options, explicit provider-route selection, and
  model-derived provider routing against the runtime provider catalog plus
  connection, capacity, plan, order, and route-token readiness.
- `runtimeRemoteExecutionFacade.ts`
  Owns preferred-backend normalization and default-backend fallback resolution
  helpers used by thread/composer state and runtime job starts.

UI surfaces should consume those facades instead of rebuilding route semantics
locally from page state.

HugeCode owns typed connection/capacity/plan/order/route-token UI and contract
surfaces. HugeRouter owns merchant, metering, settlement, route receipts, and
actual route decisions. HugeCode may display receipts and readiness summaries,
but it must not infer or override the selected upstream, fallback reason,
commercial status, or usage accounting.

## Readiness Semantics

Provider-route readiness uses one shared mapping:

- `ready`
  Built-in Codex/app-server is available and the selected provider route has a
  valid local provider configuration, relay/provider+key configuration, or
  HugeRouter commercial route token.
- `attention`
  Provider route metadata exists, but connection, capacity, plan, order, or
  route-token state is incomplete enough that launch may succeed only after
  operator inspection.
  The current `auto` route also uses `attention` when remote provider routes are
  not ready but local Codex or Claude fallback is still available, so the
  control plane can explain a degraded-but-launchable fallback instead of
  reporting a false green state.
- `blocked`
  Built-in Codex/app-server is unavailable, or no configured provider route,
  relay/provider+key path, or commercial route token is usable for that provider
  family.

Mission Control `launch readiness`, composer/provider send flow, and explicit
provider-route selection all consume this same readiness shape.

## Truth Sources

Use these sources in order:

1. runtime provider catalog for canonical provider family metadata
2. typed connection/capacity/plan/order/route-token state for readiness truth
3. explicit Mission Control provider route for manual launch intent
4. selected composer model for provider-aware send intent
5. HugeRouter route receipts and runtime placement/routing fields after launch
   for continuation and review

Do not show a provider as launchable in one surface while another surface has
already marked the same provider family unavailable or un-routable.

## Routing Matrix

| Provider family           | Canonical provider route | Route modes                                         | Readiness requirements                                                                               | Continuation / review                                                                | Feature flag |
| ------------------------- | ------------------------ | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------ |
| Built-in Codex/app-server | `codex-app-server`       | `auto`, default launch path                         | embedded Codex app-server available and isolated Codex provider config can be written                | inherits runtime placement and backend preference through runtime follow-up defaults | none         |
| Codex / OpenAI            | `openai`                 | `auto`, explicit provider route, model-derived send | local provider config, arbitrary relay/provider+key path, or HugeRouter commercial route token ready | inherits runtime placement and HugeRouter route receipt truth                        | none         |
| Claude Code / Anthropic   | `anthropic`              | `auto`, explicit provider route, model-derived send | local provider config, arbitrary relay/provider+key path, or HugeRouter commercial route token ready | inherits runtime placement and HugeRouter route receipt truth                        | none         |
| Native runtime lab        | `local-lab`              | lab/future only                                     | excluded from mainline V1 launch-critical readiness                                                  | lab continuation/review only until promoted by a later ADR                           | lab only     |

Notes:

- `auto` remains the workspace-default path.
- explicit provider routes normalize against the same catalog used by
  model-derived send flow.
- HugeRouter-owned route receipts remain the source of truth for selected
  target, provenance, fallback, usage, and support diagnostics.
- backend fallback remains runtime-owned after launch when it is outside
  HugeRouter's route decision; the control plane only explains the request path
  and preflight state.
- explicit backend preference, workspace-default backend fallback, and
  runtime-confirmed fallback placement remain separate truths:
  preflight explains intent, while Mission Control and Review explain the
  runtime-confirmed backend, fallback reason, and operability after launch.

## Capability Differences

Provider families may differ in local provider support, OpenAI-compatible relay
support, provider-key requirements, and HugeRouter commercial availability. The
control plane handles those differences through catalog metadata and adapters,
not page-specific branching.

Current strategy:

- use catalog aliases to normalize provider family identity
- keep model-derived provider resolution in the runtime/app facade
- keep connection, capacity, plan, order, and route-token readiness logic
  provider-family agnostic
- treat local Codex and Claude as supported provider routes
- keep repo-owned native runtime work in future/lab development

## Regression Samples

Targeted regression samples now live in tests:

- `runtimeProviderRouting.test.ts`
  - auto route blocked when no provider family is ready
  - auto route remains ready when built-in Codex/app-server is available
  - model-derived Codex/OpenAI route resolves through shared route-token
    readiness
  - model-derived Claude route blocks without a configured provider path
  - explicit provider route uses the same readiness calculation
- `runtimeWorkspaceMissionControlProjection.test.ts`
  - launch-readiness route summary stays aligned with shared provider routing
- `runtimeRemoteExecutionFacade.test.ts`
  - default-backend fallback and explicit backend precedence stay centralized
- `useThreadMessagingHelpers.test.ts`
  - provider-aware send payload keeps provider/model/service-tier aligned

## Rollout Guidance

Recommended rollout order:

1. keep built-in Codex/app-server and `auto` as the default launch path
2. keep local Codex and Claude as supported provider routes
3. enable arbitrary relay/provider+key and HugeRouter commercial-service paths
   only through typed connection, capacity, plan, order, and route-token
   surfaces
4. expand provider-family coverage only after readiness and route-receipt
   reporting stay consistent across launch, send, continuation, and review

No new repo-owned feature flag is required for the current control-plane
implementation. Runtime provider catalog availability is the effective capability
gate. If a later rollout needs staged exposure, gate the UI affordance at the
facade boundary rather than forking route logic in page code.
