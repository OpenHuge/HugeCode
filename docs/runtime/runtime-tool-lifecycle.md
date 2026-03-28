# Runtime Tool Lifecycle

Date: 2026-03-28
Status: Active

## Decision

HugeCode now treats the app-facing runtime tool lifecycle as a shared runtime
boundary primitive.

The canonical shared implementation lives in:

- `packages/code-runtime-client/src/runtimeToolLifecycle.ts`
- `apps/code/src/application/runtime/facades/runtimeToolLifecycleFacade.ts`

This slice is the Track 1 baseline for:

- tool and turn lifecycle event vocabulary
- lifecycle ordering guarantees
- hook checkpoint publication
- Mission Control and debug-surface consumption

It is intentionally not a new runtime contract. It is a shared app/runtime
summary derived from runtime-approved channels.

## Why This Exists

HugeCode needed one place to answer these questions without transcript
archaeology or page-local heuristics:

- what lifecycle step just happened
- whether a later event should replace an earlier event for the same entity
- where the pre-validation, pre-execution, and post-execution hook boundaries are
- how Mission Control can render those boundaries without inventing runtime truth

This is borrowed from the useful part of `pi-mono`'s small loop/event model
while preserving HugeCode's runtime-first architecture.

## Event Vocabulary

The shared lifecycle event envelope currently covers:

- `turn`
  - `started`
  - `completed`
  - `failed`
- `tool`
  - `attempted`
  - `started`
  - `updated`
  - `progress`
  - `completed`
- `approval`
  - `requested`
  - `resolved`
- `guardrail`
  - `evaluated`
  - `outcome`

Every event remains machine-readable and carries runtime-facing correlation
fields such as:

- `workspaceId`
- `threadId`
- `turnId`
- `toolCallId`
- `toolName`
- `source`
- `status`
- `at`
- `correlationKey`

The event envelope is shared through
`@ku0/code-runtime-client/runtimeToolLifecycle` and re-exported through the
approved `apps/code/src/application/runtime/*` boundary.

## Ordering Guarantees

The shared lifecycle baseline now owns phase-order semantics per entity.

Current rules:

- events are grouped by a stable lifecycle entity key
- each lifecycle kind has an explicit phase sequence
- retrograde transitions for the same entity are rejected
- repeatable phases are allowed only for `tool/updated` and `tool/progress`
- terminal semantics stay kind-specific and local to the shared lifecycle model

This means a stale `started` event cannot overwrite an already observed
`completed` event for the same tool entity, approval, or turn.

## Hook Checkpoints

Track 1 also freezes three shared hook checkpoints:

- `pre_validation_summary`
- `post_validation_pre_execution`
- `post_execution_pre_publication`

These are not imperative hooks owned by page code.

They are derived checkpoints published from lifecycle events so app-runtime
facades and UI consumers can reason about tool-shaping boundaries without
bypassing runtime policy.

Current mapping is:

- `tool/attempted`
  - derives `pre_validation_summary`
- `approval/requested`, `approval/resolved`
  - derive `post_validation_pre_execution`
- `guardrail/evaluated`, `guardrail/outcome`
  - derive `post_validation_pre_execution`
- `tool/started`
  - completes `post_validation_pre_execution`
- `tool/completed`
  - derives `post_execution_pre_publication`

The shared snapshot now exposes:

- `lastHookCheckpoint`
- `recentHookCheckpoints`

## Runtime Truth Compatibility

This lifecycle layer is not canonical execution truth.

Boundary rules:

- runtime still owns execution, checkpoint, review, and continuation truth
- lifecycle events are app-facing summaries over runtime-approved event channels
- hook checkpoints are operator-facing interpretation points, not permission
  grants
- Mission Control may render lifecycle and hook checkpoints, but may not infer
  new run truth from them
- if runtime later publishes canonical hook or loop events directly, those
  runtime payloads replace the current app-side derivation

In short:

- runtime truth answers "what is canonical for this run?"
- lifecycle truth answers "what operator-readable step did we just observe?"

Track 2, Track 3, and Track 4 must build on that distinction instead of
collapsing the two.

## Current Consumers

The baseline is already consumed in:

- runtime lifecycle facade
  - `apps/code/src/application/runtime/facades/runtimeToolLifecycleFacade.ts`
- workspace lifecycle hook
  - `apps/code/src/features/shared/hooks/useWorkspaceRuntimeToolLifecycle.ts`
- Mission Control session log
  - `apps/code/src/features/workspaces/components/WorkspaceHomeMissionControlSections.tsx`
- debug diagnostics
  - `apps/code/src/features/debug/components/DebugRuntimeToolLifecycleSection.tsx`

This gives HugeCode one shared vocabulary for event rendering and one shared
hook-checkpoint projection for operator-facing tool-shaping visibility.

The approved workspace-scoped read path is now:

- `apps/code/src/application/runtime/ports/runtimeToolLifecycle.ts`
  - `getWorkspaceRuntimeToolLifecycleSnapshot(workspaceId)`
  - `subscribeWorkspaceRuntimeToolLifecycleSnapshot(workspaceId, listener)`

Consumers should prefer that boundary over composing
`getRuntimeToolLifecycleSnapshot() + filterRuntimeToolLifecycleSnapshot(...)`
or subscribing to the unscoped snapshot stream inside feature code.

## Follow-On Work

Track 1 is complete when new work treats this lifecycle baseline as frozen and
stops redefining equivalent sequencing or hook semantics in page code.

Future tracks should use it like this:

- Track 2 references lifecycle events or hook checkpoints from structured
  session/checkpoint records
- Track 3 consumes the shared boundary instead of re-normalizing lifecycle data
  in each surface
- Track 4 remains capability-aware but does not leak provider-specific branching
  into lifecycle ordering rules
