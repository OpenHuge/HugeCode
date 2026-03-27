# Runtime Launch Readiness

`launch readiness` is the active operator preflight concept for HugeCode runtime launches.

It exists to answer one narrow question before a run starts:

> Is the runtime ready enough to launch this run now, and if not, what is the first concrete thing the operator should fix?

This is intentionally narrower than backend placement truth, task truth, review truth,
or continuity truth after a run has already started.

## Design Intent

Launch readiness should help the operator:

- confirm whether the current control surface can talk to the runtime
- see whether the selected route is viable right now
- notice approval pressure or degraded state before piling on more work
- notice when the runtime tool execution channel has degraded enough that
  launching more work would likely compound failures
- choose between launching now, changing route, or resolving a blocking issue first

It should not:

- replace runtime-confirmed placement after launch
- invent new orchestration or approval state locally
- create a second routing engine in the UI
- become a generic backend dashboard or fleet manager
- absorb recovery, handoff, or post-launch review continuation into the same summary

## Canonical Inputs

Launch readiness is a summary over existing runtime truth and app-runtime facades.

The intended source inputs are:

- runtime capabilities summary from the current transport
- runtime health / liveness
- provider routing health derived from provider catalog, OAuth accounts, and OAuth pools
- operator pressure such as pending approvals or stale approval backlog
- execution reliability derived from existing runtime diagnostics such as
  `runtimeToolMetricsRead` and `runtimeToolGuardrailRead`
- route intent from the current launch choice (`auto` or explicit provider route)

Provider-route intent and readiness should come from the shared routing
control-plane facade described in
[`provider-routing-control-plane.md`](./provider-routing-control-plane.md),
not from page-local provider/model heuristics.

These inputs are advisory. The runtime still owns canonical task, run, approval, placement, and review truth.
Post-launch recovery and handoff remain the job of continuity readiness over
checkpoint, mission-linkage, publish-handoff, and review-actionability truth.
When runtime publishes `takeover bundle`, launch readiness should still stay out
of that path. `takeover bundle` is for post-launch continuation, not launch
gating.

## Output Shape

A launch-readiness summary should stay compact and operator-facing.

At minimum it should answer:

- `overall`: ready, attention, or blocked
- `route`: what launch route is being evaluated
- `blockingReason`: the first concrete issue that should stop launch
- `recommendedAction`: the next operator move
- `executionReliability`: whether the runtime tool execution channel is healthy
  enough to accept more launch traffic right now
- `signals`: a small set of inspectable facts, not a generic diagnostics dump

Route signals should stay explainable:

- why this route/backend intent was selected
- whether the current route is directly ready, degraded-but-launchable, or blocked
- whether launch is relying on local/native fallback
- which concrete routing blocker must be fixed first when launch cannot proceed

## Boundary Rules

- Build launch readiness inside `apps/code/src/application/runtime/*`, not in page-local component logic.
- Prefer existing truth surfaces over new contracts.
- If a future runtime contract adds canonical launch-readiness payloads, that contract should replace app-side derivation rather than coexist with it.
- Launch readiness may explain route viability before launch, but once a run starts, Mission Control and Review must switch back to runtime-confirmed placement and governance truth.
- Launch readiness must stay preflight-only. Do not use it as the summary for
  recoverable runs, control-device handoff, or Review Pack follow-up after a run
  already exists.

## Current Implementation Direction

The shipped implementation remains conservative:

- no new runtime RPC contract for v1
- no new backend policy engine
- no marketplace or integration expansion
- Mission Control in `apps/code` now renders launch readiness next to run-start controls
- the summary is still derived in app runtime facades rather than emitted as canonical runtime task truth
- execution reliability reuse should come from the same app-runtime summary used by
  Mission Control and WebMCP diagnostics, not from duplicated page-local gate logic
- shared workspace shell, desktop shell, and web shell should all read the same
  snapshot-backed launch summary semantics for fallback, blocked placement, and
  backend operability instead of rebuilding separate heuristics
- the current shipped reliability gate is moderately conservative:
  diagnostics channel `unavailable`, any open runtime-tool circuit breaker, or
  an overall success gate below `0.95` block launch; degraded channels or
  recoverable failure pressure stay at attention
- operator or agent-facing bridge reuse remains allowed, but this change does not add a dedicated WebMCP launch-readiness tool yet
- continuity readiness is the separate post-launch summary for recovery and handoff;
  do not merge the two concepts into one operator object
- runtime takeover bundle is the canonical per-run continuation object for
  resume, handoff, approval takeover, and review follow-up after launch

This keeps the enhancement aligned with the current product direction:
stronger runtime execution supervision, less UI guesswork, and lower operator ambiguity.
