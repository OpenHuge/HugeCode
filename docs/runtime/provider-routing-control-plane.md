# Provider Routing Control Plane

This document defines the provider-aware routing control plane used by HugeCode
Phase 1 launch, continuation, and review flows.

The goal is not to turn HugeCode into a provider marketplace or a settings
panel. The goal is to keep provider and backend choice inside one runtime/app
control plane so launch success rate, placement control, and review continuity
stay aligned.

## Scope

The shared control-plane inputs are:

- runtime provider catalog
- OAuth accounts and OAuth pools
- explicit provider route selection from Mission Control launch
- selected composer model and its provider family
- explicit or inherited backend preference
- runtime placement truth after launch

The shared control-plane outputs are:

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
  model-derived provider routing against the runtime provider catalog plus OAuth
  readiness state.
- `runtimeRemoteExecutionFacade.ts`
  Owns preferred-backend normalization and default-backend fallback resolution
  helpers used by thread/composer state and runtime job starts.

UI surfaces should consume those facades instead of rebuilding route semantics
locally from page state.

## Readiness Semantics

Provider-route readiness uses one shared mapping:

- `ready`
  Provider is available and either:
  - native/local routing does not require OAuth, or
  - at least one enabled pool and one credential-ready account exist
- `attention`
  Provider route metadata exists, but catalog or OAuth state is incomplete
  enough that launch may succeed only after operator inspection
- `blocked`
  Provider is unavailable, or no schedulable pool/account path exists for that
  provider family

Mission Control `launch readiness`, composer/provider send flow, and explicit
provider-route selection all consume this same readiness shape.

## Truth Sources

Use these sources in order:

1. runtime provider catalog for canonical provider family metadata
2. OAuth accounts and pools for credential/readiness truth
3. explicit Mission Control provider route for manual launch intent
4. selected composer model for provider-aware send intent
5. runtime placement/routing fields after launch for continuation and review

Do not show a provider as launchable in one surface while another surface has
already marked the same provider family unavailable or un-routable.

## Routing Matrix

| Provider family         | Canonical provider route | OAuth provider | Route modes                                                  | Readiness requirements                                                                   | Continuation / review                                                                | Feature flag |
| ----------------------- | ------------------------ | -------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------ |
| Codex / OpenAI          | `openai`                 | `codex`        | `auto`, explicit provider route, model-derived send          | provider catalog available, at least 1 enabled pool, at least 1 credential-ready account | inherits runtime placement and backend preference through runtime follow-up defaults | none         |
| Claude Code / Anthropic | `anthropic`              | `claude_code`  | `auto`, explicit provider route, model-derived send          | provider catalog available, at least 1 enabled pool, at least 1 credential-ready account | inherits runtime placement and backend preference through runtime follow-up defaults | none         |
| Gemini / Google         | `google`                 | `gemini`       | `auto`, explicit provider route, model-derived send          | provider catalog available, at least 1 enabled pool, at least 1 credential-ready account | inherits runtime placement and backend preference through runtime follow-up defaults | none         |
| Native local runtime    | `local`                  | none           | `auto`, explicit provider route when catalog publishes local | runtime provider catalog marks provider available; no OAuth path required                | continuation/review use runtime placement truth directly                             | none         |

Notes:

- `auto` remains the workspace-default path.
- explicit provider routes normalize against the same catalog used by
  model-derived send flow.
- backend fallback remains runtime-owned after launch; the control plane only
  explains the request path and preflight state.

## Capability Differences

Provider families may differ in native support, OpenAI-compatible support, and
OAuth requirements. The control plane handles those differences through catalog
metadata and adapters, not page-specific branching.

Current strategy:

- use catalog aliases to normalize provider family identity
- keep model-derived provider resolution in the runtime/app facade
- keep OAuth readiness logic provider-family agnostic
- treat native/local providers as non-OAuth routes

## Regression Samples

Targeted regression samples now live in tests:

- `runtimeProviderRouting.test.ts`
  - auto route blocked when no provider family is ready
  - auto route remains ready when native/local runtime is available
  - model-derived Codex/OpenAI route resolves through OAuth readiness
  - model-derived Claude route blocks without pool readiness
  - explicit provider route uses the same readiness calculation
- `runtimeWorkspaceMissionControlProjection.test.ts`
  - launch-readiness route summary stays aligned with shared provider routing
- `runtimeRemoteExecutionFacade.test.ts`
  - default-backend fallback and explicit backend precedence stay centralized
- `useThreadMessagingHelpers.test.ts`
  - provider-aware send payload keeps provider/model/service-tier aligned

## Rollout Guidance

Recommended rollout order:

1. keep `auto` as the default launch path
2. enable explicit provider-route launch only for catalog-backed provider
   families already wired into OAuth readiness
3. validate targeted provider families first:
   Codex/OpenAI and Claude Code/Anthropic
4. expand provider-family coverage only after routing/readiness/reporting stay
   consistent across launch, send, continuation, and review

No new repo-owned feature flag is required for the current control-plane
implementation. Runtime provider catalog availability is the effective capability
gate. If a later rollout needs staged exposure, gate the UI affordance at the
facade boundary rather than forking route logic in page code.
