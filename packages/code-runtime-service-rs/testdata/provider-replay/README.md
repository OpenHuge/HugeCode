# Runtime Replay Dataset

This directory now holds a managed replay dataset for AI coding agent runtime workflows.

It exists to solve a specific quality problem: keep the real browser/runtime path under test while replacing nondeterministic provider output when applicable and preserving runtime-only truth samples that can be linted, filtered, re-recorded, and reported on in CI.

## What Lives Here

- `manifest.json`
  The dataset index. It is the entrypoint for runners, recorders, and lint.
- `samples/*.json`
  Individual sample assets. These are the source of truth.
- `schemas/*.json`
  Human-readable JSON schemas for the manifest and sample envelope.

The old single-fixture model has been retired. Replay fixtures are now compiled from selected samples at execution time.

## Dataset Shape

Each sample is organized in four layers:

1. `input`
   Prompt/task input, model/runtime config, and isolated endpoint metadata.
2. `process`
   Expected state transitions, provider/tool/runtime evidence, harness actions, and workflow expectations.
3. `result`
   Canonical replay output or runtime-only invocation evidence, completion status, and replay-facing assertions.
4. `governance`
   Owner, refresh reason, redaction metadata, and lifecycle status.

Samples may also declare a top-level `runtimeTruth` section.

This is the migration path away from transcript-only replay assertions:

- `runtimeTruth.taskFields`
  Task-level truth such as `checkpointId`, `traceId`, and `publishHandoff`.
- `runtimeTruth.review`
  Review-continuation truth such as `missionLinkage`, `reviewActionability`, and `takeoverBundle`.
- `runtimeTruth.autodrive`
  AutoDrive decision, scenario, and outcome state.
- `runtimeTruth.eventReplay`
  Replay-gap and resync assertions.

Every sample must declare explicit `runtimeTruth` assertions.
`governance.legacySchemaCompat` is retired and forbidden.
Samples may be either provider-backed (`result.providerReplay`) or runtime-only (`input.runtimeOperation` + `result.runtimeOperation`).

## Taxonomy

The current taxonomy is tracked in `manifest.json`.

- `read-only`
  Stable baseline for analysis/query turns.
- `streaming-long-output`
  Chunked output and queued follow-up behavior.
- `tool-error-recovery`
  Candidate coverage for recoverable provider/runtime failures with explicit failed-then-recovered turn evidence.
- `runtime-isolation`
  Dedicated runtime binding and anti-reuse behavior.
- `write-safe-minimal`
  Implemented. Low-risk write path coverage with machine-readable workspace write evidence and replay-visible workspace-file assertions.
- `unsupported-or-edge`
  Implemented. Unsupported/boundary behavior protection.

## Coverage Matrix

`manifest.json` now also declares a `coverageMatrix` section.

It is the contract for model-aware replay expansion:

- `modelProfiles`
  Named model tracks such as flagship, mini, and coding-route coverage.
- `scenarioRequirements`
  Which model profiles each scenario type must cover before the matrix is considered complete.
- `capabilityCatalog`
  The capability axes tracked independently from legacy scenario buckets.
- `capabilityRequirements`
  Which model profiles must cover a capability before that capability is considered replay-complete.

The validator turns this metadata into a machine-readable `coverageMatrix` report so dataset growth is no longer just "more samples" but explicit closure of scenario/model gaps.
Capability coverage is derived from the sample evidence itself, including `runtimeTruth`,
so manifest status cannot drift ahead of or behind the recorded proof.

Not every taxonomy bucket must start with a golden sample, but every bucket must have an explicit reason and status.

## Stability Levels

- `golden`
  Stable, replayable, redacted, CI-worthy.
- `candidate`
  Valuable scenario coverage, not yet stable enough for default CI.
- `flaky-blocked`
  Known-important scenario that currently violates determinism or harness constraints.
- `archived`
  Retained for history, excluded from default replay.

## Hard vs Soft Assertions

The dataset uses two assertion classes:

- Hard assertions
  Blocking. These fail CI. Examples: schema validity, sample selection validity, dedicated runtime isolation, Playwright sample pass/fail, canonical replay integrity.
- Soft assertions
  Non-blocking. These produce structured warnings. Examples: duration budget, warning budget, chunk-count range.

Known benign log noise, such as local `NO_COLOR`/`FORCE_COLOR` clashes emitted by child processes, is normalized out of the structured warning budget so soft assertions reflect actionable drift.

The goal is to block on workflow correctness and report on drift, not to encode brittle full-text snapshots as the only truth.

Recovery-oriented candidates should also declare explicit upgrade gates and blockers in `governance`, so validator/report can explain why they are not yet `golden`.

## Redaction Rules

Recorder output is normalized before it becomes a sample:

- local runtime endpoints become `http://127.0.0.1:{runtimePort}/rpc`
- workspace ids become `workspace-web`
- repo paths become `$REPO_ROOT`
- live tokens, cookies, auth headers, and host-specific user paths are forbidden

Redaction is not optional and is checked by dataset lint.

## Admission Rules

Golden samples must:

- have a clear task description with no hidden human context
- pass schema lint and replay lint
- be replay-stable under dedicated runtime isolation
- carry workflow assertions beyond final string matching
- contain no disallowed secrets or host-specific leakage

Archive or reject samples when:

- they depend on unstable environment behavior
- they cannot be replayed deterministically in the current harness
- they encode obsolete workflows
- they require brittle text snapshots to stay green

## Default Runtime Isolation Strategy

Replay and re-record commands allocate a dedicated runtime port by default.

Why:

- avoids accidental reuse of stale local runtimes
- keeps method-set mismatches out of replay results
- makes failures attributable to the current code, not background processes

Only explicit `--rpc-endpoint` or `--use-existing-runtime` should bypass isolation.

## Commands

Lint the dataset:

```bash
pnpm validate:runtime:provider-replay
```

Compile and lint a filtered fixture:

```bash
node scripts/validate-runtime-provider-replay.mjs --family runtime-core --stability golden --emit-compiled-fixture .tmp/runtime-replay-fixture.json
```

Run runtime-core golden replay:

```bash
pnpm test:e2e:runtime-replay
```

Run a filtered replay slice:

```bash
node scripts/run-runtime-core-replay-e2e.mjs --id runtime-core-read-only-gpt-5.4-low
node scripts/run-runtime-core-replay-e2e.mjs --tag runtime-isolation
node scripts/run-runtime-core-replay-e2e.mjs --scenario-type read-only
```

Re-record selected samples:

```bash
pnpm -C internal/runtime-proving provider:record -- --id runtime-core-read-only-gpt-5.4-low
pnpm -C internal/runtime-proving provider:record -- --tag runtime-isolation
pnpm -C internal/runtime-proving provider:record -- --scenario-type streaming-long-output
pnpm -C internal/runtime-proving provider:record -- --scenario-type tool-error-recovery
```

Export the explicit lineage graph:

```bash
pnpm -C internal/runtime-proving replay:lineage
node scripts/export-runtime-replay-lineage.mjs --output artifacts/runtime-replay/lineage-graph.json
```

Export candidate intake for nightly proving or recorder ingestion:

```bash
pnpm -C internal/runtime-proving replay:intake
node scripts/export-runtime-replay-candidate-intake.mjs --report-json artifacts/runtime-replay/candidate-intake.json
```

Run the background-ready nightly proving slice from that intake artifact:

```bash
pnpm -C internal/runtime-proving replay:nightly
node scripts/run-runtime-replay-background-nightly.mjs --candidate-intake artifacts/runtime-replay/candidate-intake.json
```

## How To Add a Sample

1. Copy an existing sample shape from `samples/`.
2. Fill `sample`, `input`, `process`, `result`, `assertions`, and `governance`.
3. Add a manifest entry in `manifest.json`.
4. Re-record it if it is intended to be `recorded`.
5. Run dataset lint and replay for that sample.
6. Only promote to `golden` once it is stable under isolated runtime replay.

If a sample must mix evidence kinds, keep that explicit. For example, a controlled synthetic failure leg may be acceptable when live failure rerecords still drift, but that sample must stay below `golden` until the live failure class is stable.

AutoDrive capability closure is stricter than event-gap closure:

- `event-replay-gap`
  Implemented when samples carry explicit replay-gap assertions.
- `autodrive-navigation` and `autodrive-evaluation-profile`
  Implemented only after recorded samples carry positive AutoDrive runtime truth, not just `absent` assertions, and should not remain single-sample thin once alternate runtime routes are available.

## What The CI Entry Produces

The runtime replay runner emits a structured report under `artifacts/runtime-replay/`.

That report includes:

- selected sample ids
- hard assertion failures
- soft assertion warnings
- per-sample status and duration
- scenario-level coverage, density, freshness, rerecord success, and blocker dwell metrics
- family-level density summaries so thin families stay machine-visible
- recovery failure-class and evidence-mode distributions for comparing recovery sample quality
- agent-evolution signals such as seed source, incubation track, safe background candidates, and prompt-lineage links
- linked deterministic regression coverage and backlog for workflow failures that still need smaller gates

This makes the dataset useful for future trend analysis and PR annotations, not just local spot checks.

## Dataset Growth Loop

Keep expanding this dataset with the smallest loop that improves quality:

- Mine production or workflow failures into candidate samples first.
- Convert recurring candidate failures into cheaper deterministic regression tests as close to the fault domain as possible.
- Promote candidates to `golden` only when automated gates and machine-readable blockers agree they are stable.
- Periodically calibrate automated promotion heuristics against human review for ambiguous cases, especially recovery and edge workflows.
- Keep write and recovery samples inside isolated runtime/workspace boundaries so side effects stay attributable to the current run.

## External Strategy Alignment

This dataset intentionally follows the common shape used by mature LLM eval products:

- Keep scenario families small but versioned, then grow them with boundary variants instead of cloning near-duplicate baselines.
- Prefer workflow assertions and machine-readable metadata over brittle transcript snapshots.
- Track which candidates are closest to promotion and which scenario buckets are still thin, so growth pressure stays tied to quality risk.
- Convert expensive workflow failures into cheaper deterministic regression tests whenever the failure can be isolated to parser, validator, replay-core, or harness code.

In practice that means the structured validation report should answer four questions without manual note-taking:

1. Which scenario types are still baseline-only or missing a golden?
2. Which candidates are closest to golden and what blockers remain?
3. Which blockers have been stuck the longest?
4. Which workflow failures have already been pushed down into cheaper regression gates?
5. Which scenario or family slices are fully gated but still too thin to trust for bug discovery?

## OB-1 Style Evolution Layer

To support more autonomous agent improvement without changing the core replay framework, samples may also declare `governance.optimizationSignals`.

These fields are meant to stage capabilities similar to the public OB-1 roadmap:

- `seedSource`
  Distinguishes manually-authored samples from ones mined from workflow failures or session regressions.
- `incubationTrack`
  Separates blocking gates from nightly or incubation tracks before promotion.
- `recommendedLevers`
  Flags whether the next improvement should likely come from hooks, rules, skills, sandbox behavior, or session-lineage changes.
- `safeBackgroundCandidate`
  Marks scenarios that are safe to delegate to background agents without risky side effects.
- `lineage`
  Records parent/branch relationships between samples so recovery families and prompt-derived forks stay explicit.

This keeps the current system grounded in deterministic replay while preparing for future layers such as PR-derived eval generation, self-growing skills/rules, safe background execution, and prompt/session branching workflows.

The formal product boundary and implementation contract for this layer live in:

- `docs/runtime-replay-evolution-layer.prd.md`
- `docs/runtime-replay-evolution-layer.spec.md`

The current implementation turns these signals into two concrete governance artifacts:

- `backgroundReadyQueue`
  A conservative selector for low-risk samples that could later be used by background-safe agent workflows.
- `lineage graph`
  A minimal JSON graph of explicit sample derivation, seed source, and linked deterministic regressions.
