# Runtime Operator Loop

`operator loop` is the shared continuation and review-control interpretation for
post-launch runtime work in HugeCode.

It exists to keep Mission Control, Review Pack, continuation entrypoints, and
takeover entrypoints on one canonical answer to two questions:

1. what should the operator do next
2. which runtime-published object is the source of that recommendation

## Scope

The operator loop covers:

- interrupted run resume
- completed-run review
- takeover and handoff
- operator approval and follow-up
- Mission Control next-action recommendations
- Review Pack next-action recommendations

It does not create a second runtime state model.

## Shared Facade

Phase 1 uses one shared truth helper in
`packages/code-runtime-host-contract/src/hugeCodeOperatorLoop.ts`.

Primary consumers:

- `apps/code/src/application/runtime/facades/runtimeMissionControlSurfaceModel.ts`
- `apps/code/src/application/runtime/facades/runtimeReviewPackSurfaceFacade.ts`
- `apps/code/src/application/runtime/facades/runtimeReviewPackDecisionActionsFacade.ts`
- `apps/code/src/application/runtime/facades/runtimeContinuityReadiness.ts`
- `packages/code-workspace-client/src/workspace-shell/sharedMissionControlSummary.ts`

Rules:

- operator-facing actions come from the shared helper, not page-local heuristics
- Mission Control and Review Pack must not diverge on the same run
- navigation targets come from canonical runtime truth, not UI reconstruction

## Canonical Inputs

The operator loop reads runtime-published truth in this order:

1. `takeoverBundle`
2. `reviewActionability`
3. `missionLinkage`
4. `publishHandoff`
5. `checkpoint`

Interpretation rule:

- when `takeoverBundle` exists, it is the primary continuation object
- standalone `reviewActionability` or `publishHandoff` must not override an
  existing `takeoverBundle`

## Actionability Semantics

| Runtime condition                | Canonical action     | Canonical target                |
| -------------------------------- | -------------------- | ------------------------------- |
| resumable takeover bundle        | `resume_run`         | run                             |
| handoff-ready takeover bundle    | `take_over`          | thread, run, or session         |
| review-ready takeover bundle     | `open_review`        | review pack                     |
| blocked review actionability     | `continue_follow_up` | mission run                     |
| pending approval                 | `open_approval`      | action center / mission target  |
| running / preparing / validating | `continue_execution` | runtime-backed operator surface |
| missing or partial truth         | `inspect`            | runtime-backed surface          |

Shared copy expectations:

- the same run must show the same recommended next step in Mission Control and
  Review Pack
- blocked reason text must come from runtime truth
- review-ready fallback copy must not replace runtime-published continuation copy

## Operator Provenance

Top-tier operator surfaces must expose not only the recommendation, but also the
source of that recommendation.

Required presentation rules:

- Mission Control review entries must show the follow-up source label from the
  shared continuation summary
- Review Pack must show the decision-availability source for accept, reject,
  and follow-up actions
- page components must not invent canonical-vs-fallback wording on their own;
  they render the shared facade output

Current source labels:

- `Runtime takeover bundle`
- `Runtime review actionability`
- `Runtime mission linkage`
- `Runtime publish handoff`
- `Runtime checkpoint`
- `Controlled legacy follow-up fallback`
- `Runtime routing gate`
- `Default review policy`

Interpretation guidance:

- `Runtime takeover bundle` and `Runtime review actionability` are the preferred
  operator sources
- `Controlled legacy follow-up fallback` is the only intentionally retained
  non-canonical actionability path
- `Runtime routing gate` means decisions are intentionally read-only until
  routing is confirmed
- `Default review policy` is a temporary safety net when runtime has not yet
  published explicit decision actionability

## Controlled Fallback

Exactly one controlled fallback remains in Phase 1:

- `getHugeCodeReviewActionAvailability(...)` may consult legacy follow-up action
  arrays only when `reviewActionability.actions` is empty

Removal condition:

- runtime publishes action entries for all operator-loop-eligible review states

This fallback is intentionally narrow. It exists to preserve operator controls
while runtime contracts finish converging.

## Migration Notes

Pages and view models should migrate in this order:

1. stop inferring next action from run state alone
2. consume shared operator-loop action resolution
3. consume takeover-first continuation summaries
4. remove page-local fallback copy unless it is the controlled legacy action
   availability fallback

Current Phase 1 migration result:

- Mission Control now resolves operator next actions through shared truth
- Review Pack continuity and decision actions consume the same continuation
  summary and actionability fallback rule
- shared workspace Mission Control summaries count readiness from the same
  continuation helper
- page-local continuation reconstruction is reduced to presentation-only mapping

## Validation Expectations

Changes to the operator loop should include:

- contract helper unit tests
- Mission Control and Review Pack parity tests
- continuity readiness and blocked-state tests
- provenance visibility tests for Mission Control and Review Pack
- targeted e2e verification for resume, takeover, review, and blocked follow-up
