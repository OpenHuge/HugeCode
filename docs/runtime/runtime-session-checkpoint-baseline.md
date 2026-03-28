# Runtime Session / Checkpoint Baseline

Date: 2026-03-28
Status: active

## Goal

Track 2 adds a machine-readable session/checkpoint projection on top of the
frozen Track 1 runtime lifecycle boundary.

This projection must let HugeCode:

- group lifecycle activity into explicit session records
- attach checkpoint payloads to those session records
- replay or compact those records deterministically
- reference Track 1 lifecycle event ids and hook checkpoint keys directly

It must not:

- redefine lifecycle truth
- widen `application/runtime/ports/runtimeToolLifecycle.ts`
- bypass runtime truth with page-local orchestration
- import `pi-mono` package structure, naming, or local session ownership

## Boundary

Track 1 remains the lifecycle baseline:

- lifecycle events and hook checkpoints are still derived from runtime-approved
  channels
- runtime still owns execution, review, checkpoint, and continuity truth
- Track 2 records only reference lifecycle event ids and hook checkpoint keys

This means Track 2 answers:

- "how do we store or replay operator-readable lifecycle-linked session data?"

It does not answer:

- "what is the canonical run state?"

## Proposed Shape

Track 2 introduces a narrow `application/runtime/types` contract and a matching
`application/runtime/facades` projector:

- workspace lifecycle snapshot in
- session/checkpoint baseline out

The projected baseline contains:

- a schema version
- workspace id and lifecycle revision cursor
- explicit session identities
- ordered session records
- checkpoint payloads linked to lifecycle event ids or hook checkpoint keys
- deterministic replay/compaction metadata

## Session Identity

Session identity is derived, not canonical.

Current priority:

1. `threadId`
2. `turnId`
3. `toolCallId`
4. workspace fallback

This keeps Track 2 additive while still producing stable machine-readable
grouping for replay and diagnostics.

## Replay / Compaction Invariants

Track 2 baseline keeps three invariants:

1. dedupe by stable record identity
   - lifecycle records dedupe on `event.id`
   - checkpoint records dedupe on `checkpoint.key`
2. replay order is deterministic
   - older `at` first
   - same timestamp orders lifecycle event before hook checkpoint
   - same timestamp and kind falls back to record id
3. compaction is explicit metadata
   - "latest record per identity" is recorded as projection strategy, not
     inferred by consumers

## Proof Slices

Current implementation slices are intentionally narrow:

1. debug diagnostics metadata export
2. debug runtime lifecycle section summary
3. shared workspace session/checkpoint read hook for product consumers
4. Mission Control session log summary

Why these slices:

- the export artifact is machine-readable first
- the debug panel now reads the same shared projection through a shared
  workspace-scoped hook instead of rebuilding a local session interpretation in
  page components
- Mission Control now consumes the same shared session/checkpoint projection on
  a formal product surface instead of limiting Track 2 to diagnostics-only
  proof
- both stay inside existing HugeCode application/runtime boundaries
- both prove Track 2 records can reference frozen Track 1 lifecycle ids and
  hook checkpoints without changing the lifecycle port

## External Calibration

This borrows the useful part of `pi-mono`'s explicit event/session ergonomics:

- stable event ids
- explicit checkpoint references
- deterministic replay expectations

But HugeCode keeps its own architecture:

- no new `packages/coding-agent/**`
- no local session file as canonical truth
- no new plugin-host or runtime model
