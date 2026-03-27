# Runtime Continuity Readiness

Updated: 2026-03-25

`continuity readiness` is now the canonical runtime-facing contract for
post-launch continuation, review follow-up, and operator next-action
recommendation.

It answers one narrow question after interruption, reconnect, review completion,
or control-device handoff:

> What is the one correct runtime-published next action for this run, and how
> should shared surfaces describe it without rebuilding semantics locally?

This remains intentionally separate from launch readiness.

This keeps the enhancement aligned with the product direction:
more runtime-owned continuation truth, less UI-side reconstruction, and clearer
operator action after interruption or handoff.

## Canonical Path

The canonical continuation truth path is:

1. runtime-published `takeoverBundle`
2. canonical runtime continuation facade in
   `packages/code-runtime-host-contract/src/runtimeContinuationFacade.ts`
3. thin app/shared adapters that only format or scope the canonical output:
   - `apps/code/src/application/runtime/facades/runtimeContinuityReadiness.ts`
   - `apps/code/src/application/runtime/facades/runtimeReviewContinuationFacade.ts`
   - `apps/code/src/application/runtime/facades/runtimeReviewPackSurfaceFacade.ts`
   - `apps/code/src/application/runtime/facades/runtimeMissionControlSurfaceModel.ts`
   - `packages/code-workspace-client/src/workspace-shell/sharedMissionControlSummary.ts`
4. first-party consumers in Review Pack, Mission Control, and workspace shell

The canonical facade exports two runtime-facing summaries:

- `buildRuntimeContinuationDescriptor`
  The per-run continuation descriptor, canonical next action, blocked reason,
  and navigation target.
- `buildRuntimeContinuationAggregate`
  The cross-run readiness summary for shared Mission Control and workspace
  surfaces.

No page should derive continuation or review follow-up semantics directly from
`checkpoint`, `publishHandoff`, `missionLinkage`, or `reviewActionability`
after these helpers have already combined them.

## Input Precedence

Canonical continuation semantics must follow this precedence order:

1. `takeoverBundle`
   The canonical operator-facing continuation object and first-priority next
   action source.
2. Runtime continuation truth fragments
   `reviewActionability`, `missionLinkage`, `publishHandoff`, `checkpoint`, and
   `nextAction`, composed only by the canonical facade when `takeoverBundle` is
   absent.
3. Missing
   The run has no canonical continuation truth yet and the surface must present
   an explicit missing-path or blocked state rather than inventing one.

## Canonical Next-Action Precedence

For a single run, the canonical facade resolves one `canonicalNextAction` with
these priorities:

| Priority | Source                                                        | Result                                                                            |
| -------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| 1        | `takeoverBundle.primaryAction` and `takeoverBundle.target`    | Canonical `continue`, `resume`, `review`, or `takeover` action                    |
| 2        | Runtime `reviewActionability`                                 | Canonical `review` or `follow_up` action, including blocked reason                |
| 3        | Runtime `checkpoint.resumeReady`                              | Canonical `resume` action                                                         |
| 4        | Runtime `publishHandoff` or `missionLinkage.navigationTarget` | Canonical `takeover` or `follow_up` action                                        |
| 5        | Runtime `nextAction`                                          | Canonical fallback only when no richer continuation truth exists                  |
| 6        | No truth                                                      | Canonical `blocked` or `missing` summary; surfaces must not invent follow-up copy |

Shared surfaces must render the same canonical action kind set:

- `continue`
- `resume`
- `review`
- `takeover`
- `follow_up`
- `blocked`

They must also render the same:

- `blockedReason`
- `navigationTarget`
- `recommendedAction`

## Output Contract

The canonical facade is responsible for all of the following runtime-facing
meaning:

- readiness summary
- continuation summary
- review follow-up actionability summary
- canonical next action
- canonical blocked reason
- canonical navigation target
- takeover priority

The aggregate summary must answer:

- `state`
- `blockingReason`
- `recommendedAction`
- `recoverableRunCount`
- `handoffReadyCount`
- `reviewReadyCount`
- `reviewBlockedCount`
- `missingPathCount`
- `attentionCount`
- `blockedCount`

The per-run descriptor must answer:

- `state`
- `pathKind`
- `continuePathLabel`
- `summary`
- `details`
- `blockingReason`
- `recommendedAction`
- `truthSource`
- `truthSourceLabel`
- `navigationTarget`
- `canonicalNextAction`

## Inventory And Action Plan

This is the current readiness / continuation / review actionability production
inventory for first-party surfaces in scope.

| Semantic type                           | Producer module                                                                                                                                          | Current consumers                                                 | Canonical             | Action                                                 | Owner / exit plan                                                                                                                                                                                                                        |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | --------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Per-run continuation descriptor         | `packages/code-runtime-host-contract/src/runtimeContinuationFacade.ts`                                                                                   | App runtime facades, workspace shell summary, tests               | Yes                   | Retain as the only canonical composer                  | Shared runtime contract. Remove wrappers only after all first-party callers import this facade directly or through one thin adapter.                                                                                                     |
| Aggregate continuity readiness          | `packages/code-runtime-host-contract/src/runtimeContinuationFacade.ts`                                                                                   | `runtimeContinuityReadiness.ts`, `sharedMissionControlSummary.ts` | Yes                   | Retain                                                 | Shared runtime contract. Future runtime-native aggregate may replace this, but must replace rather than coexist.                                                                                                                         |
| App continuity readiness wrapper        | `apps/code/src/application/runtime/facades/runtimeContinuityReadiness.ts`                                                                                | `apps/code` Mission Control and workspace orchestration surfaces  | No, wrapper only      | Retain temporarily as a thin adapter; do not add logic | `apps/code` runtime facade owner. Delete when app callers can consume host-contract aggregate directly.                                                                                                                                  |
| Review continuation adapter             | `apps/code/src/application/runtime/facades/runtimeReviewContinuationFacade.ts`                                                                           | Review Pack continuation UI                                       | No, adapter only      | Retain temporarily; no semantic recompute              | `apps/code` review runtime owner. Delete or flatten once Review Pack consumes descriptor fields directly.                                                                                                                                |
| Review Pack surface adapter             | `apps/code/src/application/runtime/facades/runtimeReviewPackSurfaceFacade.ts`                                                                            | Review Pack detail model                                          | No, adapter only      | Retain; presentation-only                              | `apps/code` review surface owner. Keep only detail shaping and copy assembly.                                                                                                                                                            |
| Mission Control operator-action adapter | `apps/code/src/application/runtime/facades/runtimeMissionControlSurfaceModel.ts`                                                                         | Mission Control rows and review-pack rows                         | No, adapter only      | Retain; presentation-only                              | `apps/code` mission-control owner. Do not reintroduce local next-action precedence.                                                                                                                                                      |
| Shared workspace summary builder        | `packages/code-workspace-client/src/workspace-shell/sharedMissionControlSummary.ts`                                                                      | Shared workspace shell summary                                    | No, adapter only      | Retain; presentation-only                              | Workspace-client owner. Must stay a consumer of the canonical aggregate only.                                                                                                                                                            |
| First-party summary runtime binding     | `packages/code-workspace-client/src/workspace/browserBindings.ts` and `apps/code/src/application/runtime/kernel/createWorkspaceClientRuntimeBindings.ts` | Workspace shell summary state                                     | No, transport adapter | Retain; now snapshot + canonical summary only          | Workspace-client and app-runtime owners. Do not route first-party UI back to summary RPC.                                                                                                                                                |
| Runtime summary RPC compat projection   | `packages/code-runtime-service-rs/src/rpc_dispatch_mission_control_summary.rs` via `code_mission_control_summary_v1`                                     | External or older callers only                                    | No                    | Retain temporarily as compat-only; freeze semantics    | Runtime service owner. Exit trigger: first-party clients remain snapshot/facade-only and external callers migrate to snapshot plus canonical facade. Delete in the next explicit runtime compat prune window after that migration lands. |

## Hard Rules

- `takeoverBundle` is the first-priority source for canonical next action.
- `runtimeContinuationFacade.ts` is the only allowed place to combine
  `takeoverBundle`, `reviewActionability`, `missionLinkage`, `publishHandoff`,
  `checkpoint`, and `nextAction` into runtime-facing continuation semantics.
- Review Pack, Mission Control, and workspace shell must consume the same
  canonical descriptor or aggregate output.
- Pages and components must not rebuild follow-up rules from fragmented fields.
- Compat projections must not become product-semantic authorities.
- Adding a new continuation or review field now means wiring it in one facade,
  not duplicating logic across page summaries or selectors.

## Compat Boundary And Exit Strategy

`code_mission_control_summary_v1` remains in the runtime service as a
compatibility projection only. First-party UI must not treat it as a product
semantic source.

The allowed compat boundary is now:

- one runtime service summary RPC projection for external or lagging callers
- one compat field alias registry in `codeRuntimeRpcCompat.ts`

The following are no longer allowed:

- new compat-derived UI semantics
- page-local next-action precedence
- parallel summary builders that reinterpret the same runtime truth

Compat owner and retirement rule:

- Owner: runtime service + workspace-client maintainers
- Exit trigger: all first-party surfaces remain on snapshot + canonical facade,
  and external dependents of `code_mission_control_summary_v1` have migrated
- Delete window: the next explicit runtime compat prune window after the exit
  trigger is confirmed; do not let the summary RPC remain as an indefinite UI
  semantic dependency

## Consumer Migration Notes

- First-party workspace shell summary now derives from mission-control snapshot
  plus `buildSharedMissionControlSummary`, which itself consumes the canonical
  aggregate facade.
- First-party browser and desktop bindings no longer read summary semantics from
  `code_mission_control_summary_v1`.
- Review Pack continuation, Review Pack mission-run detail, and Mission Control
  operator recommendation now read the same canonical descriptor output.
- Existing thin adapters may keep formatting surface-specific copy, but they may
  not change semantic precedence or recompute blocked / resumable / reviewable
  state from fragments.

## Validation Expectations

Changes in this area must keep the following checks green:

- facade parity tests
- same-run cross-surface consistency tests
- takeover-bundle precedence tests
- compat boundary tests
- review follow-up derivation tests
- blocked / resumable / reviewable / takeover-ready regression cases

For the shared next-action and takeover-first interpretation used by Mission
Control and Review Pack, see
[`runtime-operator-loop.md`](./runtime-operator-loop.md).
