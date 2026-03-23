# Runtime Replay Evolution Layer PRD

## Status

- Owner: Runtime proving
- Scope: `packages/code-runtime-service-rs/testdata/provider-replay/*`
- Phase: phase1
- Updated: 2026-03-23

## Problem

The runtime replay dataset was strong enough to validate a small golden slice, but it was not yet strong enough to drive continuous execution-chain improvement. The main gaps were:

- too little sample density across risk-heavy runtime paths
- weak recovery-failure fidelity for `tool-error-recovery`
- insufficient machine-readable scoring beyond transcript hits
- weak promotion governance for moving candidates into golden
- limited nightly proving signal for resilient but side-effect-safe samples

## Goal

Turn runtime replay into a governed evaluation layer that improves runtime execution quality end to end:

- collect higher-signal samples
- record realistic failure and recovery legs
- grade traces with structured criteria
- prove candidate quality in nightly slices
- promote only when gates are satisfied
- report resilience evidence in a machine-readable bundle

## Non-Goals

- no new parallel eval platform
- no UI-page-local runtime heuristics
- no expansion of collaboration-mode coverage beyond `default` in phase1
- no relaxation of runtime isolation or write-safety boundaries

## Product Constraints

- Keep the existing runtime architecture boundary intact.
- Build on the existing replay chain:
  - `packages/code-runtime-service-rs/testdata/provider-replay/manifest.json`
  - `scripts/lib/runtimeReplayDataset.mjs`
  - `scripts/record-runtime-provider-replay.mjs`
- Preserve additive-only compatibility. Existing hard and soft assertions continue to work.

## Phase1 Outcomes

- Dataset expands to at least 48 samples.
- Golden baseline expands to at least 24 samples.
- Recovery goldens require:
  - recorded failure leg
  - recorded recovery leg
  - stable live failure probe
- Reporting answers:
  - why the sample failed
  - why it recovered
  - which coverage gap it closes
  - whether a cheaper deterministic regression already exists

## Data Contract Additions

Each sample adds:

- `riskTier`
- `axisCoverage`
- `traceScorecard`
- `replayFidelity`
- `promotionPolicy`
- `freshnessPolicy`
- `failureTaxonomy`
- `sourceFingerprint`
- `qualityReview`

Validation and report outputs add:

- `traceGradeDistribution`
- `matrixCoverageByAxis`
- `promotionCandidatesByRisk`
- `liveProbeStability`
- `freshnessDebt`

## Coverage Strategy

Use risk-driven combinatorial growth instead of ad hoc sample cloning.

- default coverage method: pairwise
- elevated 3-way slices:
  - `tool-error-recovery`
  - `autodrive-launch`
  - `placement-routing`

Tracked phase1 axes:

- `scenarioType`
- `failureClass`
- `modelProfile`
- `reasoningEffort`
- `accessMode`
- `backendPreference`
- `runtimeTruth capability`

## Governance Strategy

Promotion is explicitly gated, not implied by replay pass/fail alone.

- recovery candidates require live failure probes
- mixed evidence cannot auto-promote to golden
- stale samples accumulate freshness debt
- near-duplicate samples are rejected
- nightly background-ready slices must prove temporary-workspace safety

## Success Criteria

- validator reports `0` matrix gaps
- total samples `>= 48`
- golden samples `>= 24`
- recovery goldens satisfy all failure/recovery/live-probe gates
- reports expose resilience evidence, not just transcript outcomes
