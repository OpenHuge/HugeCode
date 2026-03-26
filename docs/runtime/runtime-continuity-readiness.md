# Runtime Continuity Readiness

`continuity readiness` is the active operator summary for runtime recovery,
handoff, and review continuation after a run has already started.

It exists to answer one narrow question after interruption, reconnect, or
control-device handoff:

> Can this run continue safely from runtime-published truth, and if not, what is
> the first concrete thing the operator should do next?

This is intentionally separate from launch readiness.

## Design Intent

Continuity readiness should help the operator:

- understand whether a recoverable run has a canonical resume path
- understand whether a completed or interrupted run has a canonical handoff path
- see whether Review Pack follow-up is still actionable according to runtime
- notice when durability degradation undermines continuity confidence
- choose between resume, handoff, review, or explicit follow-up

It should not:

- replace runtime-owned task, run, checkpoint, or review truth
- become a second mission board or post-launch dashboard
- invent page-local recovery or handoff paths
- merge launch gating and post-launch continuity into one control surface

## Canonical Inputs

Continuity readiness is a compact summary over existing runtime truth.

The intended source inputs are:

- runtime-published `takeoverBundle`
- runtime-published checkpoint truth
- runtime-published `missionLinkage`, especially `recoveryPath` and
  `navigationTarget`
- runtime-published `publishHandoff`
- runtime-published `reviewActionability`
- runtime durability warnings when checkpoint writing is degraded

These inputs are authoritative when present.
Clients should prefer them over local heuristics, legacy fallbacks, or
page-shaped control logic.

When runtime publishes `takeoverBundle`, continuity readiness should treat it as
the canonical per-run continuation object and aggregate over it instead of
reconstructing per-run path semantics from raw continuation fragments.

## Output Shape

A continuity-readiness summary should stay compact and operator-facing.

At minimum it should answer:

- `overall`: ready, attention, or blocked
- `blockingReason`: the first concrete issue that prevents safe continuation
- `recommendedAction`: the next operator move
- `recoverableRunCount`: how many runs can continue from a canonical resume path
- `handoffReadyCount`: how many runs already expose a canonical handoff path
- `reviewBlockedCount`: how many review-ready runs are blocked by runtime actionability
- `missingPathCount`: how many candidate runs still lack a canonical continue path
- `durabilityDegraded`: whether checkpoint durability degraded recently

If per-run detail is shown, it should classify each candidate as one of:

- `resume`
- `handoff`
- `review`
- `missing`

## Boundary Rules

- Build continuity readiness inside `apps/code/src/application/runtime/*`.
- Reuse the same runtime-owned fields that Mission Control and Review Pack already
  consume; do not add a new runtime RPC for v1.
- If runtime later emits a canonical continuity-readiness payload, that contract
  should replace app-side derivation rather than coexist with it.
- Mission Control and Review Pack may summarize continuity readiness, but they
  must not reconstruct `takeoverBundle`, `missionLinkage`, `publishHandoff`, or
  `reviewActionability` from page-local state.

## Current Implementation Direction

The intended implementation remains conservative:

- no new runtime RPC contract for v1
- no new operator dashboard or diagnostics surface
- no new checkpoint persistence policy
- no new launch-time gating semantics
- runtime should prefer publishing `takeover bundle` as the canonical per-run
  continuation object, while continuity readiness remains the aggregate summary
- Mission Control may surface continuity readiness near recoverable-run and
  durability signals
- Review Pack may reuse continuity truth to explain whether follow-up is resume,
  handoff, review, or blocked
- Review Pack and Mission Control should prefer `takeoverBundle` when present
  before falling back to raw checkpoint, handoff, or actionability fragments
- Review Pack should treat `missionLinkage.navigationTarget` as the canonical
  cross-device continue path when runtime publishes it, and should prefer
  `reviewActionability.summary` over local fallback next-action copy
- `launch readiness` remains preflight-only; `continuity readiness` is the
  runtime-backed summary for post-launch continuation and handoff

This keeps the enhancement aligned with the product direction:
more runtime-owned continuation truth, less UI-side reconstruction, and clearer
operator action after interruption or handoff.

For the shared next-action and takeover-first interpretation used by Mission
Control and Review Pack, see
[`runtime-operator-loop.md`](./runtime-operator-loop.md).
