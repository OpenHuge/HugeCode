import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import {
  buildRuntimeReplayBackgroundReadyQueue,
  buildRuntimeReplayLineageGraph,
  buildRuntimeReplayValidationReport,
  buildRuntimeReplayReport,
  classifyRuntimeReplayWarnings,
  compileRuntimeReplayFixture,
  createRuntimeReplaySelection,
  deriveRuntimeReplayRerecordStability,
  loadRuntimeReplayDataset,
  redactRuntimeReplayText,
  selectRuntimeReplaySamples,
  updateRuntimeReplayGoldenBlockerHistory,
  validateRuntimeReplayDataset,
  writeJson,
} from "./runtimeReplayDataset.mjs";

function cloneSingleSampleDataset(sampleId) {
  const dataset = loadRuntimeReplayDataset();
  const [sampleEntry] = dataset.samples.filter((entry) => entry.sample.sample.id === sampleId);
  assert.ok(sampleEntry, `expected sample ${sampleId} to exist`);
  const clonedEntry = structuredClone(sampleEntry);
  return {
    dataset: {
      ...dataset,
      manifest: {
        ...dataset.manifest,
        samples: [clonedEntry.manifestEntry],
      },
      samples: [clonedEntry],
    },
    sampleEntry: clonedEntry,
  };
}

test("redactRuntimeReplayText normalizes local runtime endpoints and repo paths", () => {
  const input =
    "rpc=http://127.0.0.1:8899/rpc path=/Users/han/Documents/Code/Parallel/P-keep-up/apps/code";
  const redacted = redactRuntimeReplayText(input);
  assert.equal(redacted, "rpc=http://127.0.0.1:{runtimePort}/rpc path=$REPO_ROOT/apps/code");
});

test("writeJson creates parent directories for report exports", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "runtime-replay-json-"));
  const outputPath = path.join(tempRoot, "nested", "reports", "dataset-selection.json");

  writeJson(outputPath, { ok: true });

  assert.deepEqual(JSON.parse(fs.readFileSync(outputPath, "utf8")), { ok: true });
  fs.rmSync(tempRoot, { recursive: true, force: true });
});

test("runtime replay dataset validates its golden slice with recorded samples", () => {
  const dataset = loadRuntimeReplayDataset();
  assert.ok(
    dataset.samples.some(
      (entry) => entry.sample.sample.id === "runtime-core-write-safe-minimal-json-gpt-5.4-low"
    )
  );
  const selectedSamples = selectRuntimeReplaySamples(dataset, {
    stabilities: ["golden"],
  });
  const validation = validateRuntimeReplayDataset(
    {
      ...dataset,
      manifest: {
        ...dataset.manifest,
        samples: selectedSamples.map((entry) => entry.manifestEntry),
      },
      samples: selectedSamples,
    },
    { requireRecorded: true }
  );
  assert.deepEqual(validation.errors, []);
});

test("createRuntimeReplaySelection normalizes harness workspace ids for replay execution", () => {
  const dataset = loadRuntimeReplayDataset();
  const [sampleEntry] = dataset.samples.filter(
    (entry) => entry.sample.sample.id === "runtime-core-read-only-gpt-5.4-low"
  );

  const selection = createRuntimeReplaySelection([sampleEntry]);

  assert.equal(selection.samples[0].process.harness.workspaceId, "workspace-web");
  assert.equal(selection.samples[0].process.harness.timeoutMs, 60_000);
  assert.equal(sampleEntry.sample.process.harness.workspaceId, "ws-playground");
  assert.equal(sampleEntry.sample.process.harness.timeoutMs, undefined);
});

test("validateRuntimeReplayDataset requires runtimeTruth container with no legacy bypass", () => {
  const { dataset, sampleEntry } = cloneSingleSampleDataset("runtime-core-read-only-gpt-5.4-low");
  delete sampleEntry.sample.runtimeTruth;

  const validation = validateRuntimeReplayDataset(dataset, {
    skipCoverageMatrixCatalogStatusAlignment: true,
  });

  assert.match(validation.errors.join("\n"), /must declare runtimeTruth/);
});

test("validateRuntimeReplayDataset allows empty runtimeTruth when coverage is not evidence-backed", () => {
  const { dataset, sampleEntry } = cloneSingleSampleDataset("runtime-core-read-only-gpt-5.4-low");
  sampleEntry.sample.runtimeTruth = {
    taskFields: [],
    review: [],
    autodrive: [],
    eventReplay: [],
  };
  sampleEntry.sample.sample.capabilities = ["placement-routing"];

  const validation = validateRuntimeReplayDataset(dataset, {
    skipCoverageMatrixCatalogStatusAlignment: true,
  });

  assert.deepEqual(validation.errors, []);
});

test("validateRuntimeReplayDataset rejects legacy schema compatibility flags", () => {
  const { dataset, sampleEntry } = cloneSingleSampleDataset("runtime-core-read-only-gpt-5.4-low");
  sampleEntry.sample.governance.legacySchemaCompat = true;

  const validation = validateRuntimeReplayDataset(dataset, {});

  assert.match(validation.errors.join("\n"), /legacySchemaCompat/);
});

test("createRuntimeReplaySelection appends runtimeTruth assertions for migrated samples", () => {
  const { sampleEntry } = cloneSingleSampleDataset("runtime-core-read-only-gpt-5.4-low");
  sampleEntry.sample.runtimeTruth = {
    taskFields: [
      {
        type: "wait-runtime-task-field",
        fieldPath: "checkpointId",
        matcher: "present",
      },
    ],
    review: [
      {
        type: "wait-runtime-summary",
        fieldPath: "missionLinkage.summary",
        matcher: "present",
      },
      {
        type: "assert-runtime-actionability",
        expectedState: "ready",
      },
      {
        type: "assert-review-pack-linkage",
        uiText: "Checkpoint",
        taskFieldPath: "checkpointId",
        canonicalSource: "diagnostics-export",
        canonicalSectionPath: "runtime/checkpoint-review-evidence.json",
        canonicalFieldPath: "checkpointId",
      },
    ],
    autodrive: [],
    eventReplay: [],
  };

  const selection = createRuntimeReplaySelection([sampleEntry]);
  const assertionTypes = selection.samples[0].process.harness.assertions.map((entry) => entry.type);

  assert.ok(assertionTypes.includes("wait-runtime-task-field"));
  assert.ok(assertionTypes.includes("wait-runtime-summary"));
  assert.ok(assertionTypes.includes("assert-runtime-actionability"));
  assert.ok(assertionTypes.includes("assert-review-pack-linkage"));
});

test("compileRuntimeReplayFixture carries write-safe workspace effects into replay variants", () => {
  const { sampleEntry } = cloneSingleSampleDataset("runtime-core-write-safe-minimal-gpt-5.4-low");

  const fixture = compileRuntimeReplayFixture(
    {
      manifest: { datasetId: "runtime-provider-replay" },
      manifestPath: path.join(
        process.cwd(),
        "packages",
        "code-runtime-service-rs",
        "testdata",
        "provider-replay",
        "manifest.json"
      ),
    },
    [sampleEntry]
  );

  assert.deepEqual(fixture.variants[0]?.workspaceEffects, {
    expectedWrites: [
      {
        relativePath: "runtime-replay-write-safe/write-safe-minimal.txt",
        mustContain: "WRITE_SAFE_CONTENT: runtime replay dataset",
      },
    ],
  });
});

test("runtime-only autodrive launch sample validates without provider replay turns", () => {
  const dataset = loadRuntimeReplayDataset();
  const sampleEntry = dataset.samples.find(
    (entry) => entry.sample.sample.id === "runtime-core-autodrive-launch-gpt-5.4-low"
  );

  assert.ok(sampleEntry, "expected runtime-only autodrive launch sample");
  assert.equal(sampleEntry.sample.input.turns.length, 0);
  assert.equal(sampleEntry.sample.input.runtimeOperation?.type, "agent-task-start");
  assert.ok(
    sampleEntry.sample.process.harness.actions.some(
      (entry) => entry.type === "rpc-agent-task-start"
    )
  );
  assert.equal(sampleEntry.sample.result.providerReplay, undefined);
  assert.equal(
    sampleEntry.sample.runtimeTruth?.eventReplay?.[0]?.expectedReason,
    "native_state_fabric_updated"
  );

  const validation = validateRuntimeReplayDataset(dataset, {});

  assert.deepEqual(validation.errors, []);
});

test("compileRuntimeReplayFixture skips runtime-only samples without provider turns", () => {
  const { sampleEntry } = cloneSingleSampleDataset("runtime-core-read-only-gpt-5.4-low");
  sampleEntry.sample.input.turns = [];
  sampleEntry.sample.input.runtimeOperation = {
    type: "agent-task-start",
    title: "Ship runtime truth",
    steps: [{ kind: "read", path: "AGENTS.md" }],
  };
  sampleEntry.sample.process.harness.actions = [{ type: "rpc-agent-task-start" }];
  sampleEntry.sample.result = {
    successStatus: "recorded",
    summaryHeading: "Runtime-only sample",
    runtimeOperation: { type: "agent-task-start", method: "code_runtime_run_start" },
  };

  const fixture = compileRuntimeReplayFixture(
    {
      manifest: { datasetId: "runtime-provider-replay" },
      manifestPath: path.join(
        process.cwd(),
        "packages",
        "code-runtime-service-rs",
        "testdata",
        "provider-replay",
        "manifest.json"
      ),
    },
    [sampleEntry]
  );

  assert.deepEqual(fixture.variants, []);
});

test("classifyRuntimeReplayWarnings ignores benign color-environment noise", () => {
  const summary = classifyRuntimeReplayWarnings(`
    (node:1) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
    (Use \`node --trace-warnings ...\` to show where the warning was created)
    warning: runtime probe took longer than expected
  `);

  assert.deepEqual(summary.ignored, [
    "(node:1) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.",
    "(Use `node --trace-warnings ...` to show where the warning was created)",
  ]);
  assert.deepEqual(summary.actionable, ["warning: runtime probe took longer than expected"]);
});

test("buildRuntimeReplayReport uses actionable warnings for soft budgets", () => {
  const dataset = loadRuntimeReplayDataset();
  const [sampleEntry] = dataset.samples.filter(
    (entry) => entry.sample.sample.id === "runtime-core-read-only-gpt-5.4-low"
  );
  const report = buildRuntimeReplayReport({
    dataset,
    selectedSamples: [sampleEntry],
    playwrightJson: {
      suites: [
        {
          specs: [
            {
              title: sampleEntry.sample.process.harness.testName,
              tests: [{ results: [{ status: "passed", duration: 1000 }] }],
            },
          ],
        },
      ],
    },
    combinedLogs: `
      (node:1) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
      (Use \`node --trace-warnings ...\` to show where the warning was created)
    `,
  });

  assert.equal(report.hardAssertions.passed, true);
  assert.equal(report.softAssertions.passed, true);
  assert.equal(report.softAssertions.actionableWarningCount, 0);
  assert.equal(report.softAssertions.ignoredWarningCount, 2);
});

test("buildRuntimeReplayReport fails runtime-isolation samples when compatible runtime reuse is observed", () => {
  const dataset = loadRuntimeReplayDataset();
  const [sampleEntry] = dataset.samples.filter(
    (entry) => entry.sample.sample.id === "runtime-core-isolation-gpt-5.4-high"
  );
  const report = buildRuntimeReplayReport({
    dataset,
    selectedSamples: [sampleEntry],
    playwrightJson: {
      suites: [
        {
          specs: [
            {
              title: sampleEntry.sample.process.harness.testName,
              tests: [{ results: [{ status: "passed", duration: 1000 }] }],
            },
          ],
        },
      ],
    },
    combinedLogs: "Existing runtime on 127.0.0.1:9999 matched compatibility probe",
  });

  assert.equal(report.hardAssertions.passed, false);
  assert.match(
    report.hardAssertions.failures.join("\n"),
    /forbidden runtime-isolation log pattern present/
  );
});

test("buildRuntimeReplayReport exposes candidate-to-golden blockers for recovery samples", () => {
  const dataset = loadRuntimeReplayDataset();
  const [sampleEntry] = dataset.samples.filter(
    (entry) => entry.sample.sample.id === "runtime-core-tool-error-recovery-gpt-5.3-codex-medium"
  );
  const report = buildRuntimeReplayReport({
    dataset,
    selectedSamples: [sampleEntry],
    playwrightJson: {
      suites: [
        {
          specs: [
            {
              title: sampleEntry.sample.process.harness.testName,
              tests: [{ results: [{ status: "passed", duration: 1000 }] }],
            },
          ],
        },
      ],
    },
    combinedLogs: "",
  });

  assert.equal(report.samples[0]?.failureLeg?.failureClass, "provider.stream-interrupted");
  assert.equal(report.samples[0]?.recoveryLeg?.observed, true);
  assert.equal(
    report.samples[0]?.recoveryQualification?.rerecordStability?.status,
    "stable-incompatible"
  );
  assert.deepEqual(report.samples[0]?.candidateToGolden?.blockers, [
    "failure_leg_not_fully_recorded",
    "evidence_not_fully_recorded",
    "live_failure_class_incompatible",
    "trace_grade_below_threshold",
  ]);
  assert.equal(report.samples[0]?.candidateToGolden?.eligible, false);
});

test("buildRuntimeReplayValidationReport includes machine-readable recovery qualification", () => {
  const { dataset, sampleEntry } = cloneSingleSampleDataset(
    "runtime-core-tool-error-recovery-gpt-5.3-codex-medium"
  );
  const validation = validateRuntimeReplayDataset(dataset, {});
  const report = buildRuntimeReplayValidationReport({
    dataset,
    selectedSamples: [sampleEntry],
    validation,
  });

  assert.equal(
    report.samples[0]?.recoveryQualification?.observedFailureClass,
    "provider.stream-interrupted"
  );
  assert.equal(report.samples[0]?.recoveryQualification?.recoveryObserved, true);
  assert.equal(report.samples[0]?.recoveryQualification?.evidenceMode, "mixed");
  assert.equal(
    report.samples[0]?.recoveryQualification?.rerecordStability?.status,
    "stable-incompatible"
  );
  assert.deepEqual(
    report.samples[0]?.recoveryQualification,
    sampleEntry.sample.governance?.recoveryQualification
  );
});

test("deriveRuntimeReplayRerecordStability distinguishes stable-incompatible probes", () => {
  const stability = deriveRuntimeReplayRerecordStability(["provider.stream-interrupted"], {
    recordedAt: "2026-03-13T00:00:00.000Z",
    observedFailureClasses: ["provider.request-failed"],
    stable: false,
    driftObserved: false,
  });

  assert.deepEqual(stability, {
    status: "stable-incompatible",
    stable: false,
    compatibleWithExpectedFailureClass: false,
    observedFailureClasses: ["provider.request-failed"],
    driftObserved: false,
    lastCheckedAt: "2026-03-13T00:00:00.000Z",
  });
});

test("validateRuntimeReplayDataset requires governance recoveryQualification for recovery samples", () => {
  const { dataset, sampleEntry } = cloneSingleSampleDataset(
    "runtime-core-tool-error-recovery-gpt-5.3-codex-medium"
  );
  delete sampleEntry.sample.governance.recoveryQualification;

  const validation = validateRuntimeReplayDataset(dataset, {});

  assert.match(validation.errors.join("\n"), /governance\.recoveryQualification/);
});

test("buildRuntimeReplayReport reuses governance recoveryQualification", () => {
  const { dataset, sampleEntry } = cloneSingleSampleDataset(
    "runtime-core-tool-error-recovery-gpt-5.3-codex-medium"
  );
  const report = buildRuntimeReplayReport({
    dataset,
    selectedSamples: [sampleEntry],
    playwrightJson: {
      suites: [
        {
          specs: [
            {
              title: sampleEntry.sample.process.harness.testName,
              tests: [{ results: [{ status: "passed", duration: 1000 }] }],
            },
          ],
        },
      ],
    },
    combinedLogs: "",
  });

  assert.deepEqual(
    report.samples[0]?.recoveryQualification,
    sampleEntry.sample.governance?.recoveryQualification
  );
});

test("validateRuntimeReplayDataset requires queue-resume evidence for streaming-long-output samples", () => {
  const { dataset, sampleEntry } = cloneSingleSampleDataset(
    "runtime-core-streaming-queue-resume-gpt-5.4-low"
  );
  sampleEntry.sample.result.providerReplay.coverage = ["multi-turn", "streaming"];
  sampleEntry.sample.result.providerReplay.turns = [
    sampleEntry.sample.result.providerReplay.turns[0],
  ];
  sampleEntry.sample.process.harness.actions = sampleEntry.sample.process.harness.actions.filter(
    (entry) => entry.type !== "queue-prompt"
  );
  sampleEntry.sample.process.expectedStateTransitions =
    sampleEntry.sample.process.expectedStateTransitions.filter(
      (entry) => !entry.startsWith("queued-turn") && entry !== "turn.queue.accepted"
    );

  const validation = validateRuntimeReplayDataset(dataset, {});

  assert.match(validation.errors.join("\n"), /queue-resume evidence/);
});

test("validateRuntimeReplayDataset requires explicit model-selection evidence", () => {
  const { dataset, sampleEntry } = cloneSingleSampleDataset(
    "runtime-core-model-selection-gpt-5.3-codex-medium"
  );
  sampleEntry.sample.process.harness.actions = sampleEntry.sample.process.harness.actions.filter(
    (entry) => !(entry.type === "select-option" && entry.control === "Model")
  );
  sampleEntry.sample.result.providerReplay.coverage = ["alternate-model"];
  sampleEntry.sample.result.providerReplay.turns[0].provenance.recordedModelId = "gpt-5.4";

  const validation = validateRuntimeReplayDataset(dataset, {});

  assert.match(validation.errors.join("\n"), /model-selection evidence/);
});

test("validateRuntimeReplayDataset warns when snapshotPinned samples lack recorded response model ids", () => {
  const { dataset } = cloneSingleSampleDataset("runtime-core-read-only-gpt-5.4-low");

  const validation = validateRuntimeReplayDataset(dataset, {});

  assert.match(validation.warnings.join("\n"), /recordedResponseModelId/);
});

test("validateRuntimeReplayDataset clears snapshotPinned warning once recorded response model ids exist", () => {
  const { dataset, sampleEntry } = cloneSingleSampleDataset("runtime-core-read-only-gpt-5.4-low");
  sampleEntry.sample.result.providerReplay.turns[0].provenance.recordedResponseModelId =
    "gpt-5.4-2026-03-01";

  const validation = validateRuntimeReplayDataset(dataset, {});

  assert.ok(!validation.warnings.some((warning) => /recordedResponseModelId/.test(warning)));
});

test("buildRuntimeReplayValidationReport includes scenario coverage and blocker aging stats", () => {
  const dataset = loadRuntimeReplayDataset();
  const validation = validateRuntimeReplayDataset(dataset, {});
  const report = buildRuntimeReplayValidationReport({
    dataset,
    selectedSamples: dataset.samples,
    validation,
  });

  const recoveryScenario = report.scenarioStats?.scenarioTypes?.find(
    (entry) => entry.scenarioType === "tool-error-recovery"
  );
  const writeSafeScenario = report.scenarioStats?.scenarioTypes?.find(
    (entry) => entry.scenarioType === "write-safe-minimal"
  );
  const isolationScenario = report.scenarioStats?.scenarioTypes?.find(
    (entry) => entry.scenarioType === "runtime-isolation"
  );
  const streamingScenario = report.scenarioStats?.scenarioTypes?.find(
    (entry) => entry.scenarioType === "streaming-long-output"
  );
  const unsupportedScenario = report.scenarioStats?.scenarioTypes?.find(
    (entry) => entry.scenarioType === "unsupported-or-edge"
  );
  const autodriveScenario = report.scenarioStats?.scenarioTypes?.find(
    (entry) => entry.scenarioType === "autodrive-launch"
  );

  assert.equal(report.scenarioStats?.totalSamples, dataset.samples.length);
  assert.deepEqual(report.scenarioStats?.thinScenarioTypes, []);
  assert.equal(autodriveScenario?.sampleCount, 5);
  assert.equal(autodriveScenario?.coverageTier, "family");
  assert.equal(autodriveScenario?.stabilityCounts?.golden, 3);
  assert.equal(recoveryScenario?.sampleCount, 12);
  assert.equal(recoveryScenario?.stabilityCounts?.candidate, 6);
  assert.equal(recoveryScenario?.stabilityCounts?.golden, 4);
  assert.equal(recoveryScenario?.stabilityCounts?.incubating, 2);
  assert.equal(writeSafeScenario?.sampleCount, 8);
  assert.equal(writeSafeScenario?.coverageTier, "family");
  assert.equal(writeSafeScenario?.stabilityCounts?.golden, 5);
  assert.equal(isolationScenario?.sampleCount, 5);
  assert.equal(isolationScenario?.coverageTier, "family");
  assert.equal(streamingScenario?.sampleCount, 8);
  assert.equal(streamingScenario?.coverageTier, "family");
  assert.equal(unsupportedScenario?.sampleCount, 5);
  assert.equal(unsupportedScenario?.coverageTier, "family");
  assert.deepEqual(writeSafeScenario?.gapSignals, []);
  assert.ok(!writeSafeScenario?.gapSignals?.includes("no_golden_baseline"));
  const failureLegBlocker = recoveryScenario?.blockerDwellTime?.blockers?.find(
    (entry) => entry.blocker === "failure_leg_not_fully_recorded"
  );
  assert.equal(failureLegBlocker?.blocker, "failure_leg_not_fully_recorded");
  assert.ok((failureLegBlocker?.dwellMs ?? -1) >= 0);
  assert.ok(
    !report.scenarioStats?.scenarioDensity?.fullyGatedButSingleSample?.some(
      (entry) =>
        entry.scenarioType === "write-safe-minimal" ||
        entry.scenarioType === "runtime-isolation" ||
        entry.scenarioType === "streaming-long-output" ||
        entry.scenarioType === "unsupported-or-edge"
    )
  );
  assert.deepEqual(report.scenarioStats?.scenarioDensity?.backgroundReadyButThin, []);
  assert.deepEqual(report.scenarioStats?.recoveryFailureClassDistribution, {
    "provider.request-failed": 4,
    "provider.rejected": 4,
    "provider.stream-interrupted": 2,
    "runtime.orchestration.unavailable": 2,
  });
  assert.deepEqual(report.scenarioStats?.recoveryEvidenceModeDistribution, {
    mixed: 4,
    recorded: 8,
  });
  assert.deepEqual(report.scenarioStats?.familyDensity?.thinFamilies, []);
  assert.equal(
    report.scenarioStats?.familyDensity?.families?.find((entry) => entry.family === "runtime-core")
      ?.densityStatus,
    "adequate"
  );
  assert.equal(report.traceGradeDistribution?.passingSampleCount, 44);
  assert.equal(report.liveProbeStability?.counts?.["stable-compatible"], 8);
  assert.equal(report.liveProbeStability?.counts?.missing, 2);
  assert.equal(report.freshnessDebt?.overdueCount, 0);
  assert.equal(report.matrixCoverageByAxis?.scenarioType?.["tool-error-recovery"], 12);
  assert.equal(report.promotionCandidatesByRisk?.critical, 11);
});

test("buildRuntimeReplayValidationReport exposes baseline governance closure by scenario and family", () => {
  const dataset = loadRuntimeReplayDataset();
  const validation = validateRuntimeReplayDataset(dataset, {});
  const report = buildRuntimeReplayValidationReport({
    dataset,
    selectedSamples: dataset.samples,
    validation,
  });

  const unsupportedScenario = report.baselineGovernance?.scenarioTypes?.find(
    (entry) => entry.scenarioType === "unsupported-or-edge"
  );
  const autodriveScenario = report.baselineGovernance?.scenarioTypes?.find(
    (entry) => entry.scenarioType === "autodrive-launch"
  );
  const writeSafeScenario = report.baselineGovernance?.scenarioTypes?.find(
    (entry) => entry.scenarioType === "write-safe-minimal"
  );
  const runtimeCoreFamily = report.baselineGovernance?.families?.find(
    (entry) => entry.family === "runtime-core"
  );

  assert.equal(report.baselineGovernance?.baselineClosureStatus, "complete");
  assert.equal(report.baselineGovernance?.baselineBacklogCount, 0);
  assert.equal(report.baselineGovernance?.fullyGatedBaselineCount, 24);
  assert.equal(report.baselineGovernance?.baselineSampleCount, 24);
  assert.equal(report.baselineGovernance?.backgroundReadyFullyGatedCount, 3);
  assert.equal(report.baselineGovernance?.densityStatus, "adequate");
  assert.equal(autodriveScenario?.fullyGated, true);
  assert.equal(autodriveScenario?.thinCoverage, false);
  assert.equal(autodriveScenario?.densityStatus, "adequate");
  assert.equal(unsupportedScenario?.fullyGated, true);
  assert.equal(unsupportedScenario?.baselineBacklogCount, 0);
  assert.equal(unsupportedScenario?.thinCoverage, false);
  assert.equal(writeSafeScenario?.fullyGated, true);
  assert.equal(writeSafeScenario?.densityStatus, "adequate");
  assert.equal(runtimeCoreFamily?.baselineBacklogCount, 0);
  assert.equal(runtimeCoreFamily?.fullyGatedBaselineCount, 24);
  assert.equal(runtimeCoreFamily?.densityStatus, "adequate");
});

test("buildRuntimeReplayValidationReport ranks candidate promotion readiness", () => {
  const dataset = loadRuntimeReplayDataset();
  const validation = validateRuntimeReplayDataset(dataset, {});
  const report = buildRuntimeReplayValidationReport({
    dataset,
    selectedSamples: dataset.samples,
    validation,
  });

  const providerRejectedCandidate = report.scenarioStats?.candidatePromotionQueue?.find(
    (entry) => entry.id === "runtime-core-tool-error-recovery-provider-rejected-gpt-5.4-low"
  );
  const autodriveMiniCandidate = report.scenarioStats?.candidatePromotionQueue?.find(
    (entry) => entry.id === "runtime-core-autodrive-launch-gpt-5.4-mini-low"
  );

  assert.equal(providerRejectedCandidate?.promotionReadiness?.ready, true);
  assert.ok(providerRejectedCandidate?.promotionReadiness?.reasons?.includes("trace_grade_passed"));
  assert.ok(
    report.scenarioStats?.candidatePromotionQueue?.some(
      (entry) => entry.id === "runtime-core-tool-error-recovery-provider-rejected-gpt-5.4-low"
    )
  );
  assert.equal(autodriveMiniCandidate?.promotionReadiness?.ready, true);
  assert.ok(autodriveMiniCandidate?.promotionReadiness?.reasons?.includes("trace_grade_passed"));
  assert.ok(
    !report.scenarioStats?.candidatePromotionQueue?.some(
      (entry) => entry.id === "runtime-core-write-safe-minimal-gpt-5.4-low"
    )
  );
  assert.ok(
    !report.scenarioStats?.candidatePromotionQueue?.some(
      (entry) => entry.id === "runtime-core-write-safe-minimal-json-gpt-5.4-low"
    )
  );
});

test("buildRuntimeReplayValidationReport exposes deterministic regression coverage and backlog", () => {
  const dataset = loadRuntimeReplayDataset();
  const validation = validateRuntimeReplayDataset(dataset, {});
  const report = buildRuntimeReplayValidationReport({
    dataset,
    selectedSamples: dataset.samples,
    validation,
  });

  assert.equal(report.regressionCoverage?.samplesWithLinkedRegressions, dataset.samples.length);
  assert.ok((report.regressionCoverage?.byLayer?.["dataset-lib"] ?? 0) >= 9);
  assert.ok((report.regressionCoverage?.byLayer?.recorder ?? 0) >= 2);
  assert.equal(report.regressionCoverage?.regressionBacklog?.length ?? -1, 0);
  assert.equal(report.regressionCoverage?.baselineBacklogCount, 0);
  assert.equal(report.regressionCoverage?.fullyGatedBaselineCount, 24);
  assert.equal(report.regressionCoverage?.baselineClosureStatus, "complete");
  assert.ok(
    !report.regressionCoverage?.regressionBacklog?.some(
      (entry) => entry.id === "runtime-core-write-safe-minimal-gpt-5.4-low"
    )
  );
  assert.ok(
    !report.regressionCoverage?.regressionBacklog?.some(
      (entry) => entry.id === "runtime-core-tool-error-recovery-gpt-5.3-codex-medium"
    )
  );
  assert.ok(
    !report.regressionCoverage?.regressionBacklog?.some(
      (entry) => entry.id === "runtime-core-isolation-gpt-5.4-high"
    )
  );
  assert.ok(
    !report.regressionCoverage?.regressionBacklog?.some(
      (entry) => entry.id === "runtime-core-tool-error-recovery-request-failed-gpt-5.4-low"
    )
  );
  assert.ok(
    !report.regressionCoverage?.regressionBacklog?.some(
      (entry) => entry.id === "runtime-core-read-only-gpt-5.4-low"
    )
  );
  assert.ok(
    !report.regressionCoverage?.regressionBacklog?.some(
      (entry) => entry.id === "runtime-core-streaming-queue-resume-gpt-5.4-low"
    )
  );
  assert.ok(
    !report.regressionCoverage?.regressionBacklog?.some(
      (entry) => entry.id === "runtime-core-model-selection-gpt-5.3-codex-medium"
    )
  );
  assert.ok(
    !report.regressionCoverage?.regressionBacklog?.some(
      (entry) => entry.id === "runtime-core-model-selection-gpt-5.4-mini-medium"
    )
  );
  assert.ok(
    !report.regressionCoverage?.regressionBacklog?.some(
      (entry) => entry.id === "runtime-core-isolation-gpt-5.4-mini-medium"
    )
  );
  assert.ok(
    !report.regressionCoverage?.regressionBacklog?.some(
      (entry) => entry.id === "runtime-core-streaming-queue-resume-gpt-5.4-mini-low"
    )
  );
  assert.ok(
    !report.regressionCoverage?.regressionBacklog?.some(
      (entry) => entry.id === "runtime-core-write-safe-minimal-json-gpt-5.4-low"
    )
  );
  assert.ok(
    !report.regressionCoverage?.regressionBacklog?.some(
      (entry) => entry.id === "runtime-core-tool-error-recovery-provider-rejected-gpt-5.4-low"
    )
  );
});

test("buildRuntimeReplayValidationReport exposes agent evolution signals", () => {
  const dataset = loadRuntimeReplayDataset();
  const validation = validateRuntimeReplayDataset(dataset, {});
  const report = buildRuntimeReplayValidationReport({
    dataset,
    selectedSamples: dataset.samples,
    validation,
  });

  assert.ok((report.evolutionSignals?.seedSourceCounts?.manual ?? 0) >= 1);
  assert.ok((report.evolutionSignals?.seedSourceCounts?.["workflow-failure"] ?? 0) >= 1);
  assert.ok((report.evolutionSignals?.recommendedLeverCounts?.skills ?? 0) >= 1);
  assert.ok((report.evolutionSignals?.recommendedLeverCounts?.rules ?? 0) >= 1);
  assert.ok((report.evolutionSignals?.safeBackgroundCandidateCount ?? 0) >= 1);
  assert.ok(
    report.evolutionSignals?.lineageLinks?.some(
      (entry) => entry.parentSampleId === "runtime-core-tool-error-recovery-gpt-5.3-codex-medium"
    )
  );
});

test("buildRuntimeReplayBackgroundReadyQueue only selects low-risk recorded golden samples", () => {
  const dataset = loadRuntimeReplayDataset();
  const queue = buildRuntimeReplayBackgroundReadyQueue(dataset.samples);

  assert.deepEqual(
    queue.selected.map((entry) => entry.id),
    [
      "runtime-core-isolation-gpt-5.3-codex-high",
      "runtime-core-isolation-gpt-5.4-high",
      "runtime-core-isolation-gpt-5.4-mini-medium",
    ]
  );
  assert.equal(queue.selected[0]?.queueProfile, "isolated-runtime-check");
  assert.equal(queue.selected[1]?.queueProfile, "isolated-runtime-check");
  assert.equal(queue.selected[2]?.queueProfile, "isolated-runtime-check");
  assert.deepEqual(
    queue.selected.find((entry) => entry.id === "runtime-core-isolation-gpt-5.4-high")?.gaps,
    []
  );
  assert.ok(
    queue.excluded
      .find((entry) => entry.id === "runtime-core-write-safe-minimal-gpt-5.4-low")
      ?.exclusionReasons.includes("temporary_workspace_side_effects_not_proven_safe")
  );
  assert.ok(
    queue.excluded
      .find((entry) => entry.id === "runtime-core-tool-error-recovery-gpt-5.3-codex-medium")
      ?.exclusionReasons.includes("safe_background_not_declared")
  );
  assert.ok(
    queue.excluded
      .find((entry) => entry.id === "runtime-core-streaming-queue-resume-gpt-5.4-low")
      ?.exclusionReasons.includes("safe_background_not_declared")
  );
});

test("buildRuntimeReplayBackgroundReadyQueue excludes read-only samples when access mode drifts", () => {
  const { dataset, sampleEntry } = cloneSingleSampleDataset("runtime-core-read-only-gpt-5.4-low");
  sampleEntry.sample.input.runtimeConfig.accessMode = "on-request";
  sampleEntry.sample.result.providerReplay.recordingAccessMode = "on-request";
  sampleEntry.sample.result.providerReplay.turns[0].provenance.recordedAccessMode = "on-request";

  const queue = buildRuntimeReplayBackgroundReadyQueue(dataset.samples);

  assert.equal(queue.selectedCount, 0);
  assert.ok(queue.excluded[0]?.exclusionReasons.includes("read_only_access_mode_required"));
});

test("buildRuntimeReplayValidationReport exposes background-ready queue and lineage graph summary", () => {
  const dataset = loadRuntimeReplayDataset();
  const validation = validateRuntimeReplayDataset(dataset, {});
  const report = buildRuntimeReplayValidationReport({
    dataset,
    selectedSamples: dataset.samples,
    validation,
  });

  assert.equal(report.backgroundReadyQueue?.selectedCount, 3);
  assert.equal(report.backgroundReadyQueue?.summary?.excludedCount, dataset.samples.length - 3);
  assert.ok(
    report.backgroundReadyQueue?.selected.some(
      (entry) => entry.id === "runtime-core-isolation-gpt-5.4-mini-medium"
    )
  );
  assert.ok(
    report.lineageGraph?.nodes.some(
      (node) =>
        node.type === "sample" &&
        node.sampleId === "runtime-core-tool-error-recovery-gpt-5.3-codex-medium"
    )
  );
  assert.equal(report.lineageGraphSummary?.nodeCounts?.sample, 34);
  assert.equal(report.lineageGraphSummary?.edgeCounts?.["derived-from"], 24);
  assert.equal(report.lineageGraphSummary?.unresolvedCount, 0);
  assert.equal(report.lineageGraphSummary?.blockedCount, 3);
});

test("buildRuntimeReplayValidationReport exposes a manifest-driven coverage matrix", () => {
  const dataset = loadRuntimeReplayDataset();
  const validation = validateRuntimeReplayDataset(dataset, {});
  const report = buildRuntimeReplayValidationReport({
    dataset,
    selectedSamples: dataset.samples,
    validation,
  });

  const runtimeIsolation = report.coverageMatrix?.scenarioCoverage?.find(
    (entry) => entry.scenarioType === "runtime-isolation"
  );
  const streaming = report.coverageMatrix?.scenarioCoverage?.find(
    (entry) => entry.scenarioType === "streaming-long-output"
  );
  const autodrive = report.coverageMatrix?.scenarioCoverage?.find(
    (entry) => entry.scenarioType === "autodrive-launch"
  );
  const unsupported = report.coverageMatrix?.scenarioCoverage?.find(
    (entry) => entry.scenarioType === "unsupported-or-edge"
  );

  assert.equal(report.coverageMatrix?.configuredProfileCount, 3);
  assert.equal(report.coverageMatrix?.gapCount, 0);
  assert.deepEqual(autodrive?.missingProfiles, []);
  assert.deepEqual(runtimeIsolation?.missingProfiles, []);
  assert.deepEqual(streaming?.missingProfiles, []);
  assert.deepEqual(unsupported?.missingProfiles, []);
  assert.ok(autodrive?.coveredProfiles.includes("gpt-5.3-codex"));
  assert.ok(autodrive?.coveredProfiles.includes("gpt-5.4"));
  assert.ok(runtimeIsolation?.coveredProfiles.includes("gpt-5.4-mini"));
  assert.ok(runtimeIsolation?.coveredProfiles.includes("gpt-5.4"));
  assert.ok(streaming?.coveredProfiles.includes("gpt-5.4"));
  assert.ok(streaming?.coveredProfiles.includes("gpt-5.4-mini"));
  assert.ok(unsupported?.coveredProfiles.includes("gpt-5.3-codex"));
  assert.ok(unsupported?.coveredProfiles.includes("gpt-5.4-mini"));
});

test("buildRuntimeReplayValidationReport includes capability coverage and model execution metadata", () => {
  const dataset = loadRuntimeReplayDataset();
  const validation = validateRuntimeReplayDataset(dataset, {});
  const report = buildRuntimeReplayValidationReport({
    dataset,
    selectedSamples: dataset.samples,
    validation,
  });

  const flagshipProfile = report.coverageMatrix?.profiles.find((entry) => entry.id === "gpt-5.4");
  const runtimeTruthCapability = report.coverageMatrix?.capabilityCoverage?.find(
    (entry) => entry.capabilityId === "runtime-truth"
  );
  const autodriveNavigationCapability = report.coverageMatrix?.capabilityCoverage?.find(
    (entry) => entry.capabilityId === "autodrive-navigation"
  );
  const autodriveEvaluationCapability = report.coverageMatrix?.capabilityCoverage?.find(
    (entry) => entry.capabilityId === "autodrive-evaluation-profile"
  );
  const eventReplayGapCapability = report.coverageMatrix?.capabilityCoverage?.find(
    (entry) => entry.capabilityId === "event-replay-gap"
  );

  assert.equal(flagshipProfile?.modelId, "gpt-5.4");
  assert.ok(typeof flagshipProfile?.snapshotPinned === "boolean");
  assert.ok(typeof flagshipProfile?.verbosity === "string");
  assert.ok(typeof flagshipProfile?.reasoningEfforts?.length === "number");
  assert.ok(runtimeTruthCapability);
  assert.ok(Array.isArray(runtimeTruthCapability?.coveredProfiles));
  assert.ok(autodriveNavigationCapability?.coveredProfiles.includes("gpt-5.3-codex"));
  assert.ok(autodriveNavigationCapability?.coveredProfiles.includes("gpt-5.4"));
  assert.ok(autodriveEvaluationCapability?.coveredProfiles.includes("gpt-5.3-codex"));
  assert.ok(autodriveEvaluationCapability?.coveredProfiles.includes("gpt-5.4"));
  assert.deepEqual(eventReplayGapCapability?.coveredProfiles, [
    "gpt-5.3-codex",
    "gpt-5.4",
    "gpt-5.4-mini",
  ]);
  assert.equal(eventReplayGapCapability?.status, "implemented");
});

test("buildRuntimeReplayValidationReport closes autodrive capability debt once runtime-only coverage lands", () => {
  const dataset = loadRuntimeReplayDataset();
  const validation = validateRuntimeReplayDataset(dataset, {});
  const report = buildRuntimeReplayValidationReport({
    dataset,
    selectedSamples: dataset.samples,
    validation,
  });

  const plannedCapabilityDebtIds =
    report.coverageMatrix?.capabilityDebt
      ?.filter((entry) => entry.debtType === "planned-without-coverage")
      .map((entry) => entry.capabilityId)
      .sort() ?? [];

  assert.deepEqual(plannedCapabilityDebtIds, ["continuity-handoff"]);
});

test("validateRuntimeReplayDataset rejects planned capability statuses once coverage exists", () => {
  const dataset = loadRuntimeReplayDataset();
  const eventReplayCapability = dataset.manifest.coverageMatrix.capabilityCatalog.find(
    (entry) => entry.id === "event-replay-gap"
  );
  assert.ok(eventReplayCapability, "expected event-replay-gap capability to exist");
  eventReplayCapability.status = "planned";

  const validation = validateRuntimeReplayDataset(dataset, {});

  assert.match(validation.errors.join("\n"), /event-replay-gap.+planned.+coverage/u);
});

test("validateRuntimeReplayDataset can enforce manifest coverage matrix satisfaction", () => {
  const dataset = loadRuntimeReplayDataset();
  const targets = dataset.samples.filter(
    (entry) =>
      entry.sample.sample.scenarioType === "streaming-long-output" &&
      entry.sample.input.variant?.modelId === "gpt-5.4-mini"
  );
  assert.ok(targets.length > 0, "expected mini streaming samples to exist");
  for (const target of targets) {
    target.sample.input.variant ??= {};
    target.sample.input.variant.modelId = "gpt-5.4";
    target.sample.sample.axisCoverage.modelProfile = "gpt-5.4";
    target.sample.result.providerReplay.modelId = "gpt-5.4";
    target.manifestEntry.axisCoverage.modelProfile = "gpt-5.4";
  }

  const validation = validateRuntimeReplayDataset(dataset, {
    requireCoverageMatrixSatisfaction: true,
  });

  assert.match(
    validation.errors.join("\n"),
    /scenario streaming-long-output is missing required profile gpt-5\.4-mini/
  );
});

test("validateRuntimeReplayDataset rejects duplicate coverage matrix profile ids", () => {
  const dataset = loadRuntimeReplayDataset();
  dataset.manifest.coverageMatrix.modelProfiles.push({
    id: "gpt-5.4",
    modelId: "gpt-5.4-duplicate",
    family: "flagship",
    status: "duplicate",
    notes: "duplicate id for validation coverage",
  });

  const validation = validateRuntimeReplayDataset(dataset, {});

  assert.match(validation.errors.join("\n"), /duplicate profile id gpt-5\.4/);
});

test("buildRuntimeReplayValidationReport exposes candidate intake groups for nightly proving", () => {
  const dataset = loadRuntimeReplayDataset();
  const validation = validateRuntimeReplayDataset(dataset, {});
  const report = buildRuntimeReplayValidationReport({
    dataset,
    selectedSamples: dataset.samples,
    validation,
  });

  assert.deepEqual(report.candidateIntake?.backgroundReadyNightlyIds, [
    "runtime-core-isolation-gpt-5.3-codex-high",
    "runtime-core-isolation-gpt-5.4-high",
    "runtime-core-isolation-gpt-5.4-mini-medium",
  ]);
  assert.equal(report.candidateIntake?.candidateSampleIds?.length, 24);
  assert.ok(
    report.candidateIntake?.candidateSampleIds.includes(
      "runtime-core-tool-error-recovery-gpt-5.3-codex-medium"
    )
  );
  assert.ok(
    report.candidateIntake?.candidateSampleIds.includes(
      "runtime-core-write-safe-minimal-json-gpt-5.4-high"
    )
  );
  assert.equal(report.candidateIntake?.workflowFailureCandidates?.length, 8);
  assert.ok(
    report.candidateIntake?.workflowFailureCandidates.includes(
      "runtime-core-tool-error-recovery-orchestration-gpt-5.4-low"
    )
  );
  assert.ok(
    report.candidateIntake?.workflowFailureCandidates.includes(
      "runtime-core-tool-error-recovery-provider-rejected-gpt-5.4-low"
    )
  );
  assert.ok(
    report.candidateIntake?.autoPromotableCandidates.includes(
      "runtime-core-tool-error-recovery-provider-rejected-gpt-5.4-low"
    )
  );
  assert.deepEqual(report.candidateIntake?.matrixGapSuggestions, []);
});

test("buildRuntimeReplayLineageGraph exports explicit sample lineage and regression links", () => {
  const dataset = loadRuntimeReplayDataset();
  const graph = buildRuntimeReplayLineageGraph({
    dataset,
    selectedSamples: dataset.samples,
  });

  assert.ok(
    graph.nodes.some(
      (node) =>
        node.type === "sample" &&
        node.id === "sample:runtime-core-tool-error-recovery-gpt-5.3-codex-medium"
    )
  );
  assert.ok(
    graph.nodes.some((node) => node.type === "seed" && node.id === "seed:workflow-failure")
  );
  assert.ok(
    graph.nodes.some(
      (node) =>
        node.type === "regression" &&
        node.id === "regression:http-stub-profiles-force-scoped-runtime"
    )
  );
  assert.ok(
    graph.edges.some(
      (edge) =>
        edge.type === "derived-from" &&
        edge.from === "sample:runtime-core-tool-error-recovery-orchestration-gpt-5.4-low" &&
        edge.to === "sample:runtime-core-tool-error-recovery-gpt-5.3-codex-medium"
    )
  );
  assert.ok(
    graph.edges.some(
      (edge) =>
        edge.type === "linked-regression" &&
        edge.from === "sample:runtime-core-tool-error-recovery-orchestration-gpt-5.4-low" &&
        edge.to === "regression:synthetic-failure-profiles-do-not-force-scoped-runtime"
    )
  );
  assert.ok(
    graph.edges.some(
      (edge) =>
        edge.type === "seeded-by" &&
        edge.from === "sample:runtime-core-tool-error-recovery-request-failed-gpt-5.4-low" &&
        edge.to === "seed:workflow-failure"
    )
  );
  assert.ok(
    graph.edges.some(
      (edge) =>
        edge.type === "derived-from" &&
        edge.from === "sample:runtime-core-tool-error-recovery-provider-rejected-gpt-5.4-low" &&
        edge.to === "sample:runtime-core-tool-error-recovery-gpt-5.3-codex-medium"
    )
  );
  assert.equal(graph.summary?.edgeCounts?.["derived-from"], 24);
  assert.equal(graph.summary?.unresolvedCount, 0);
});

test("validateRuntimeReplayDataset rejects unsafe safeBackgroundCandidate declarations", () => {
  const { dataset, sampleEntry } = cloneSingleSampleDataset(
    "runtime-core-write-safe-minimal-gpt-5.4-low"
  );
  sampleEntry.sample.governance.optimizationSignals.safeBackgroundCandidate = true;

  const validation = validateRuntimeReplayDataset(dataset, {
    skipCoverageMatrixCatalogStatusAlignment: true,
  });

  assert.match(validation.errors.join("\n"), /safeBackgroundCandidate must not be true/);
});

test("validateRuntimeReplayDataset requires deterministic regression links to resolve to real tests", () => {
  const { dataset, sampleEntry } = cloneSingleSampleDataset(
    "runtime-core-write-safe-minimal-gpt-5.4-low"
  );
  sampleEntry.sample.governance.deterministicRegressions[0].path =
    "scripts/lib/does-not-exist.node.test.mjs";
  sampleEntry.sample.governance.deterministicRegressions[0].testName = "missing test name";

  const validation = validateRuntimeReplayDataset(dataset, {});

  assert.match(validation.errors.join("\n"), /deterministicRegressions\[0\]\.path does not exist/);
});

test("updateRuntimeReplayGoldenBlockerHistory preserves recurring blocker firstObservedAt", () => {
  const history = updateRuntimeReplayGoldenBlockerHistory(
    [
      {
        blocker: "live_failure_class_incompatible",
        active: true,
        firstObservedAt: "2026-03-10T00:00:00.000Z",
        lastObservedAt: "2026-03-10T00:00:00.000Z",
        observationCount: 1,
      },
      {
        blocker: "failure_leg_not_fully_recorded",
        active: true,
        firstObservedAt: "2026-03-11T00:00:00.000Z",
        lastObservedAt: "2026-03-11T00:00:00.000Z",
        observationCount: 2,
      },
    ],
    ["live_failure_class_incompatible", "live_failure_probe_missing"],
    "2026-03-13T00:00:00.000Z"
  );

  assert.deepEqual(history, [
    {
      blocker: "failure_leg_not_fully_recorded",
      active: false,
      firstObservedAt: "2026-03-11T00:00:00.000Z",
      lastObservedAt: "2026-03-13T00:00:00.000Z",
      observationCount: 2,
      lastClearedAt: "2026-03-13T00:00:00.000Z",
    },
    {
      blocker: "live_failure_class_incompatible",
      active: true,
      firstObservedAt: "2026-03-10T00:00:00.000Z",
      lastObservedAt: "2026-03-13T00:00:00.000Z",
      observationCount: 2,
    },
    {
      blocker: "live_failure_probe_missing",
      active: true,
      firstObservedAt: "2026-03-13T00:00:00.000Z",
      lastObservedAt: "2026-03-13T00:00:00.000Z",
      observationCount: 1,
    },
  ]);
});

test("validateRuntimeReplayDataset requires machine-readable write-safe workspace evidence", () => {
  const { dataset, sampleEntry } = cloneSingleSampleDataset(
    "runtime-core-write-safe-minimal-gpt-5.4-low"
  );
  delete sampleEntry.sample.governance.workspaceEffects;

  const validation = validateRuntimeReplayDataset(dataset, {});

  assert.match(validation.errors.join("\n"), /workspaceEffects\.expectedWrites/);
});

test("validateRuntimeReplayDataset requires replay-visible write-safe workspace assertions", () => {
  const { dataset, sampleEntry } = cloneSingleSampleDataset(
    "runtime-core-write-safe-minimal-gpt-5.4-low"
  );
  sampleEntry.sample.process.harness.assertions =
    sampleEntry.sample.process.harness.assertions.filter(
      (entry) => entry.type !== "workspace-file-contains"
    );

  const validation = validateRuntimeReplayDataset(dataset, {});

  assert.match(validation.errors.join("\n"), /workspace-file-contains/);
});

test("non-recovery samples do not inherit recovery blockers", () => {
  const { dataset, sampleEntry } = cloneSingleSampleDataset("runtime-core-isolation-gpt-5.4-high");
  const report = buildRuntimeReplayReport({
    dataset,
    selectedSamples: [sampleEntry],
    playwrightJson: {
      suites: [
        {
          specs: [
            {
              title: sampleEntry.sample.process.harness.testName,
              tests: [{ results: [{ status: "passed", duration: 1000 }] }],
            },
          ],
        },
      ],
    },
    combinedLogs: "",
  });

  assert.deepEqual(report.samples[0]?.candidateToGolden?.blockers, []);
  assert.equal(report.samples[0]?.candidateToGolden?.eligible, true);
  assert.equal(report.samples[0]?.blockerDwellTime?.blockerCount, 0);
});
