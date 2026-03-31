# Runtime Truth Contract Freeze 2026-03-25

This document freezes the Phase 1 canonical runtime truth contract for HugeCode control-plane consumers.

The runtime is the canonical source for run truth.
Mission Control, Review Pack, workspace-client summaries, and runtime run-record views must consume runtime-published truth instead of rebuilding operator meaning in page-local selectors.

## Canonical Scope

The frozen canonical fields for a single run are:

| Field / object                   | Canonical producer      | Canonical read path                                                   | Notes                                                                              |
| -------------------------------- | ----------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `taskSource`                     | Rust runtime projection | `missionRun.taskSource`, `reviewPack.taskSource`                      | Preserve launch origin and repo/source mapping.                                    |
| `executionProfile`               | Rust runtime projection | `missionRun.executionProfile`                                         | UI must not re-infer autonomy or access posture from page state.                   |
| `routing` / placement resolution | Rust runtime projection | `missionRun.routing`, `missionRun.placement`                          | Requested backends stay distinct from resolved placement.                          |
| `continuation`                   | Rust runtime projection | `missionRun.continuation`, `reviewPack.continuation`                  | Canonical continuation state over takeover, review, handoff, and checkpoint truth. |
| `takeoverBundle`                 | Rust runtime projection | `missionRun.takeoverBundle`, `reviewPack.takeoverBundle`              | Continuation detail source of record when present.                                 |
| `reviewPackId`                   | Rust runtime projection | `missionRun.reviewPackId`, `reviewPack.id`                            | Review identity stays runtime-owned.                                               |
| `reviewActionability`            | Rust runtime projection | `missionRun.actionability`, `reviewPack.actionability`                | Review actions no longer imply navigation by themselves.                           |
| `navigationTarget`               | Rust runtime projection | `sessionBoundary.navigationTarget`, `missionLinkage.navigationTarget` | `sessionBoundary` is the preferred read path.                                      |
| `runtime session boundary`       | Rust runtime projection | `missionRun.sessionBoundary`, `reviewPack.sessionBoundary`            | Canonical run/thread boundary with ids, checkpoint, trace, and navigation target.  |
| `next operator action`           | Rust runtime projection | `missionRun.nextOperatorAction`, `reviewPack.nextOperatorAction`      | Canonical UI action target and label.                                              |

## Precedence

`continuation` precedence is frozen as:

1. `takeoverBundle`
2. `reviewActionability`
3. `publishHandoff`
4. `missionLinkage`
5. `checkpoint`
6. `missing`

`nextOperatorAction` precedence is frozen as:

1. runtime-published `nextOperatorAction`
2. runtime-published review continuation (`continuation.pathKind = "review"`)
3. pending approval truth
4. failure truth
5. active run truth
6. legacy `nextAction` fallback via centralized compat resolver

`sessionBoundary` precedence is frozen as:

1. runtime-published `sessionBoundary`
2. `missionLinkage`
3. run/task id fallback synthesized by the compat resolver

## Truth Ownership

| Surface                               | Owns truth? | Responsibilities                                                                                           |
| ------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------- |
| `packages/code-runtime-service-rs`    | Yes         | Produce canonical session boundary, continuation, and next operator action.                                |
| `packages/code-runtime-host-contract` | Yes         | Freeze types, compat aliases, and centralized legacy resolvers.                                            |
| `packages/code-workspace-client`      | No          | Read canonical continuation for shared Mission Control readiness summaries.                                |
| `apps/code` runtime facades           | No          | Consume canonical fields, map targets into local navigation models, avoid page-local truth reconstruction. |
| Mission Control / Review Pack pages   | No          | Render already-projected truth only.                                                                       |

## Compatibility Layer

Short-term compatibility stays centralized in:

- `packages/code-runtime-host-contract/src/runtimeTruthCompat.ts`
- `resolveCanonicalRuntimeTruth(...)` is the canonical shared helper for the
  frozen `sessionBoundary`, `continuation`, and `nextOperatorAction` trio when
  runtime producers have not yet published all three fields directly.

Rules:

- read-new first: `sessionBoundary`, `continuation`, `nextOperatorAction`
- fall back to legacy runtime fields only inside the shared compat resolver
- treat legacy `nextAction` as gap-filling fallback only; it must not override
  richer review or continuation truth when `continuation`, `takeoverBundle`,
  `reviewActionability`, or review-pack readiness already identify the next
  operator move
- do not add page-local fallback rebuilds in `apps/code` selectors or components

Retirement criteria for the compat resolver:

1. all runtime producers publish the new fields
2. stored fixtures and snapshot tests stop depending on legacy-only payloads
3. Mission Control, Review Pack, and workspace-client consumers no longer read legacy continuation fields directly

## Migration Notes

- `missionLinkage`, `reviewActionability`, `takeoverBundle`, `checkpoint`, and `nextAction` remain available as supporting runtime facts.
- App and workspace projections should consume the frozen trio through
  `resolveCanonicalRuntimeTruth(...)` or directly from runtime-published
  `sessionBoundary`, `continuation`, and `nextOperatorAction`; they should not
  recompute those fields independently.
- UI-facing operator actions should now read `nextOperatorAction` first.
- Review follow-up summaries should now read `continuation` first.
- `reviewPack.recommendedNextAction` remains for compatibility, but it now mirrors canonical runtime operator/continuation truth.
- Legacy fields are still serialized for backward compatibility; they are no longer the preferred downstream read path.

## Test Matrix

The freeze requires coverage for:

- Rust review/run projection serialization for `sessionBoundary`, `continuation`, and `nextOperatorAction`
- TS contract compat alias coverage for camelCase and snake_case reads
- TS compat resolver precedence tests
- nullability and missing-field fallbacks through the compat resolver
- backward-compat snapshots that only provide legacy runtime truth
- same-run next-action consistency across Mission Control and Review Pack projection tests

## Track Integration

Track 2/3/4 consumers should:

1. read `sessionBoundary` for canonical run/thread identity and navigation
2. read `continuation` for recovery, review follow-up, and handoff state
3. read `nextOperatorAction` for the operator-facing next step
4. treat `missionLinkage`, `reviewActionability`, and `takeoverBundle` as supporting truth, not as separate UI state models

Avoid:

- rebuilding action labels from page-local state
- inferring continuation state from scattered checkpoint/review fragments
- selecting different navigation targets per page for the same run
