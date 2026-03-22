# Runtime Takeover Bundle

`takeover bundle` is the canonical runtime-owned continuation object for an
operator who returns to a delegated run after interruption, reconnect, or
cross-device handoff.

It answers one narrow question:

> What is the first correct takeover action for this task, run, review, or
> sub-agent session, and which runtime-published target should the operator use?

This object exists to collapse fragmented continuation truth into one
runtime-owned payload. It does not replace checkpoint, review, approval, or
mission-linkage truth. It packages them into a single operator-facing summary.

## Design Intent

The takeover bundle should let Mission Control, Review Pack, and sub-agent
surfaces:

- point at one canonical continuation target
- explain whether the next action is approval, resume, review, handoff, or
  inspection
- surface a blocked reason without recomputing continuation heuristics locally
- keep continuation semantics aligned across devices and product surfaces

It should not:

- become a new runtime RPC on its own
- merge launch gating with post-launch continuation
- replace diagnostics export or the ledger
- reintroduce a page-local orchestration layer

## Canonical Inputs

The runtime takeover bundle is built from existing runtime truth:

- `approvalState`
- `checkpointState`
- `missionLinkage`
- `publishHandoff`
- `reviewActionability`
- `nextAction`
- sub-agent `approvalEvents`, `checkpointState`, `threadId`, and `parentRunId`

These source fields remain authoritative when a deeper surface needs them.
`takeover bundle` is the canonical operator-facing continuation summary over
those inputs.

## Output Shape

At minimum the bundle should include:

- `state`: `ready`, `attention`, or `blocked`
- `pathKind`: `approval`, `resume`, `review`, `handoff`, or `missing`
- `primaryAction`: one concrete operator action
- `summary`
- `blockingReason`
- `recommendedAction`
- `target`
- `checkpointId`
- `traceId`
- `reviewPackId`
- `publishHandoff`
- `reviewActionability`

`target` should identify the canonical place to continue:

- `thread`
- `run`
- `review_pack`
- `sub_agent_session`

## Precedence Rules

### Main task / run precedence

1. pending approval -> `approval`
2. `review_ready` with runtime `reviewActionability` -> `review`
3. `checkpointState.resumeReady === true` -> `resume`
4. `publishHandoff` or `missionLinkage.navigationTarget` -> `handoff`
5. interrupted, paused, or recovered candidate without a canonical path ->
   `missing`

### Sub-agent precedence

1. pending `approvalEvents` -> `approval`
2. `checkpointState.resumeReady === true` or recovered session -> `resume`
3. stable `sessionId` plus `parentRunId` or `threadId` -> `handoff`
4. otherwise -> `missing`

## Boundary Rules

- Build `takeover bundle` inside the runtime and host-contract boundary first.
- Mission Control, Review Pack, and sub-agent tools should consume the bundle
  through `apps/code/src/application/runtime/*`.
- `continuity readiness` may aggregate takeover bundles, but should no longer
  reconstruct continuation meaning directly from raw fragments when the bundle
  is present.
- During the mixed-version window, app-side fallback may derive an equivalent
  bundle from legacy runtime fields. That fallback should live in one frontend
  runtime facade only.

## Relationship To Other Runtime Summaries

- `launch readiness` remains the preflight summary for whether a new run should
  start.
- `continuity readiness` remains the compact aggregate summary for post-launch
  continuation posture across many runs.
- `takeover bundle` is the canonical per-task, per-run, per-review, or
  per-sub-agent continuation object that those surfaces consume.
