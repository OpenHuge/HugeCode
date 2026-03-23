# Runtime Replay Evolution Layer Spec

## Status

- Owner: Runtime proving
- Updated: 2026-03-23
- Applies to:
  - `scripts/lib/runtimeReplayDataset.mjs`
  - `scripts/record-runtime-provider-replay.mjs`
  - `scripts/validate-runtime-provider-replay.mjs`
  - `packages/code-runtime-service-rs/testdata/provider-replay/*`

## Architecture Boundary

This layer stays inside the existing runtime replay pipeline.

- Dataset definition lives in `provider-replay` fixtures and manifest.
- Normalization, validation, scoring, queueing, and reporting live in `runtimeReplayDataset.mjs`.
- Recording and live-failure probing live in `record-runtime-provider-replay.mjs`.
- No page-local or UI-local runtime heuristics are introduced.

## Sample Normalization Rules

On load, each sample must normalize into the following additive metadata:

- `sample.riskTier`
- `sample.axisCoverage`
- `sample.traceScorecard`
- `sample.replayFidelity`
- `sample.promotionPolicy`
- `sample.freshnessPolicy`
- `sample.failureTaxonomy`
- `sample.sourceFingerprint`
- `sample.qualityReview`

Normalization may derive missing values, but the canonical generated dataset should persist them in files.

## Trace Scoring Contract

`traceScorecard` provides weighted criteria with both numeric and gate semantics.

- scoring output is `0-1`
- scoring also resolves pass/fail against `passThreshold`
- criteria are independently addressable for report attribution

Phase1 criteria include:

- failure class correctness
- recovery path completeness
- event ordering stability
- runtime truth completeness
- user-visible error clarity
- side-effect or workspace evidence correctness

## Failure Recording Contract

Recorder profiles must support real failure injection for:

- `provider.rejected`
- `runtime.orchestration.unavailable`

If a profile declares environment overrides or an HTTP stub, recording must run in a scoped runtime.

Observed failures are normalized into canonical failure classes before persistence.

## Recovery Promotion Contract

For recovery samples:

- `promotionPolicy.requiresLiveFailureProbe` defaults to `true` unless the sample remains `incubating`
- `governance.liveFailureProbe.enabled` must be `true` when live probing is required
- golden promotion is blocked when:
  - failure leg is not fully recorded
  - evidence mode is not fully recorded
  - live failure probe is missing
  - live failure probe drifts
  - live failure class is incompatible

## Candidate Intake Contract

Candidate ordering is fixed:

1. workflow failures
2. session regressions
3. coverage matrix gap suggestions
4. synthetic adversarial coverage

The intake artifact must expose:

- candidate sample ids
- background-ready nightly ids
- workflow-failure candidates
- auto-promotable candidates
- matrix-gap suggestions

## Background-Ready Contract

Background-ready selection is proof-based, not allowlist-name based.

A sample is only eligible when it is:

- golden
- recorded
- side-effect-safe in a temporary workspace
- free of active blockers
- above the static trace-grade threshold

Samples are excluded for explicit machine-readable reasons, including:

- `safe_background_not_declared`
- `temporary_workspace_side_effects_not_proven_safe`
- `static_trace_grade_failed`

## Validation Output Contract

Validation reports must expose these top-level aggregates:

- `traceGradeDistribution`
- `matrixCoverageByAxis`
- `promotionCandidatesByRisk`
- `liveProbeStability`
- `freshnessDebt`

Validation must also enforce:

- near-duplicate rejection by source fingerprint and axis coverage
- coverage matrix closure
- capability status alignment
- deterministic regression linkage integrity

## Replay Report Contract

Replay execution emits a resilience evidence bundle with:

- selected sample ids
- trace grades
- pre/post steady-state metrics
- failure class
- recovery latency
- blocker delta
- freshness debt
- deterministic regression linkage

## Phase1 Dataset Targets

- total samples `>= 48`
- golden `>= 24`
- candidate `>= 16`
- incubating `>= 8`

Risk-density targets:

- `tool-error-recovery >= 12`
- `launch/continuity >= 10`
- `write-safe >= 8`
- `routing/isolation >= 10`
- `streaming/queue >= 8`

## Verification

Minimum proving flow:

1. regenerate dataset
2. validate dataset and report output
3. run dataset library tests
4. run recorder tests

Recovery golden candidates additionally require repeated live failure probe checks before promotion.
