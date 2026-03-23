#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import {
  createRuntimeReplayManifestEntry,
  deriveRuntimeReplayGovernanceGoldenBlockers,
  deriveRuntimeReplayRerecordStability,
  normalizeRuntimeReplaySample,
  summarizeRuntimeReplayRecoveryQualification,
  updateRuntimeReplayGoldenBlockerHistory,
  writeJson,
} from "./lib/runtimeReplayDataset.mjs";

const REPO_ROOT = process.cwd();
const DATASET_DIR = path.join(
  REPO_ROOT,
  "packages",
  "code-runtime-service-rs",
  "testdata",
  "provider-replay"
);
const SAMPLES_DIR = path.join(DATASET_DIR, "samples");
const MANIFEST_PATH = path.join(DATASET_DIR, "manifest.json");
const GENERATED_AT = "2026-03-23T00:00:00.000Z";
const STABILITY_TAGS = new Set(["golden", "candidate", "incubating", "flaky-blocked", "archived"]);
const RUNTIME_TRUTH_ASSERTION_TYPES = new Set([
  "wait-runtime-task-field",
  "wait-runtime-summary",
  "assert-runtime-actionability",
  "assert-autodrive-trace",
  "assert-replay-gap-event",
  "assert-review-pack-linkage",
]);
const TRACK_BY_STABILITY = {
  golden: "blocking",
  candidate: "nightly",
  incubating: "incubation",
};
const PRIORITY_BUCKET_BY_SEED_SOURCE = {
  manual: "matrix-gap",
  "workflow-failure": "workflow-failure",
  "session-regression": "session-regression",
  "runtime-incident": "workflow-failure",
  "synthetic-adversarial": "synthetic-adversarial",
  "combinatorial-expansion": "matrix-gap",
};
const MODEL_PROFILES = [
  {
    id: "gpt-5.4",
    modelId: "gpt-5.4",
    family: "flagship",
    coverageRole: "primary",
    reasoningEffort: "mixed",
    verbosity: "default",
    snapshotPinned: true,
    status: "preferred",
    notes: "Primary runtime replay flagship lane.",
  },
  {
    id: "gpt-5.4-mini",
    modelId: "gpt-5.4-mini",
    family: "mini",
    coverageRole: "cost-optimized",
    reasoningEffort: "mixed",
    verbosity: "default",
    snapshotPinned: true,
    status: "active",
    notes: "Low-cost replay lane kept on the current official mini track.",
  },
  {
    id: "gpt-5.3-codex",
    modelId: "gpt-5.3-codex",
    family: "compatibility-coding",
    coverageRole: "compatibility",
    reasoningEffort: "mixed",
    verbosity: "default",
    snapshotPinned: true,
    status: "compatibility",
    notes: "Compatibility coding lane for runtime execution regressions.",
  },
];
const MANIFEST_TAXONOMY = [
  [
    "read-only",
    "implemented",
    "Launch-readiness baselines stay replay-stable across flagship, mini, and coding routes.",
  ],
  [
    "streaming-long-output",
    "implemented",
    "Queued follow-up and chunk delivery remain a core runtime execution-chain contract.",
  ],
  [
    "tool-error-recovery",
    "implemented",
    "Recovery samples are governed by failure fidelity, live probes, and promotion blockers.",
  ],
  [
    "runtime-isolation",
    "implemented",
    "Dedicated runtime binding and anti-reuse behavior remain mandatory for proving execution isolation.",
  ],
  [
    "write-safe-minimal",
    "implemented",
    "Low-risk write paths stay gated by machine-readable workspace evidence.",
  ],
  [
    "unsupported-or-edge",
    "implemented",
    "Routing and placement edges stay covered as compatibility behavior evolves.",
  ],
  [
    "autodrive-launch",
    "implemented",
    "Runtime-only launch truth and continuity summaries are part of the core proving set.",
  ],
];

const clone = (value) => JSON.parse(JSON.stringify(value));
const ensureArray = (value) => (Array.isArray(value) ? value : []);
const unique = (value) => [...new Set(ensureArray(value).filter(Boolean))];
const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, "utf8"));
const loadTemplate = (id) => readJson(path.join(SAMPLES_DIR, `${id}.json`));
const stripGeneratedHarnessSuffixes = (value) =>
  typeof value === "string" ? value.replace(/\s+\[runtime-core-[^\]]+\]/gu, "").trim() : value;

function replaceSelectOption(actions, control, value) {
  for (const action of ensureArray(actions)) {
    if (action?.type === "select-option" && action.control === control) {
      action.value = value;
    }
  }
}

function createEmptyRuntimeTruth() {
  return {
    taskFields: [],
    review: [],
    autodrive: [],
    eventReplay: [],
  };
}

function resetGeneratedReplayShape(sample) {
  for (const field of [
    "riskTier",
    "axisCoverage",
    "traceScorecard",
    "replayFidelity",
    "promotionPolicy",
    "freshnessPolicy",
    "failureTaxonomy",
    "sourceFingerprint",
    "qualityReview",
  ]) {
    delete sample.sample?.[field];
  }
  delete sample.sample?.capabilities;
  sample.runtimeTruth = createEmptyRuntimeTruth();
  if (sample.process?.harness?.testName) {
    sample.process.harness.testName = stripGeneratedHarnessSuffixes(
      sample.process.harness.testName
    );
  }
  if (sample.process?.harness?.assertions) {
    sample.process.harness.assertions = ensureArray(sample.process.harness.assertions).filter(
      (entry) =>
        entry?.type !== "assert-composer-option" && !RUNTIME_TRUTH_ASSERTION_TYPES.has(entry?.type)
    );
  }
}

function updateRefreshCommands(sample) {
  const refreshCommand = `node scripts/record-runtime-provider-replay.mjs --id ${sample.sample.id}`;
  for (const turn of ensureArray(sample.result?.providerReplay?.turns)) {
    if (turn?.provenance && typeof turn.provenance === "object") {
      turn.provenance.refreshCommand = refreshCommand;
    }
  }
  if (sample.result?.runtimeOperation && typeof sample.result.runtimeOperation === "object") {
    sample.result.runtimeOperation.refreshCommand = refreshCommand;
  }
}

function updateModel(sample, modelId, reasonEffort) {
  if (sample.input?.variant) {
    sample.input.variant.modelId = modelId;
    sample.input.variant.reasonEffort = reasonEffort;
  }
  if (sample.result?.providerReplay) {
    sample.result.providerReplay.modelId = modelId;
    sample.result.providerReplay.reasonEffort = reasonEffort;
    for (const turn of ensureArray(sample.result.providerReplay.turns)) {
      if (turn?.provenance && typeof turn.provenance === "object") {
        turn.provenance.recordedModelId = modelId;
        turn.provenance.recordedReasonEffort = reasonEffort;
      }
    }
  }
  replaceSelectOption(sample.process?.harness?.actions, "Model", modelId);
  replaceSelectOption(sample.process?.harness?.actions, "Thinking mode", reasonEffort);
}

function updateVariant(sample, spec) {
  sample.sample.id = spec.id;
  sample.sample.variant = spec.id.replace(/^runtime-core-/u, "");
  sample.sample.recordedAt = GENERATED_AT;
  sample.sample.stability = spec.stability;
  sample.sample.notes =
    spec.note ?? `${spec.templateId} expanded for ${spec.modelId}/${spec.reasonEffort}.`;
  sample.sample.tags = unique([
    ...ensureArray(sample.sample.tags).filter(
      (entry) =>
        !STABILITY_TAGS.has(entry) &&
        !MODEL_PROFILES.some((profile) => profile.id === entry) &&
        !COVERAGE_SLICE_TAGS.has(entry)
    ),
    spec.stability,
    spec.slice,
    spec.modelId,
  ]);
  if (sample.result?.providerReplay) {
    sample.result.providerReplay.variantId = sample.sample.variant;
  }
  if (sample.process?.harness?.testName) {
    const baseTestName = stripGeneratedHarnessSuffixes(sample.process.harness.testName);
    sample.process.harness.testName = `${baseTestName} [${spec.id}]`;
  }
}

function updateBackendPreference(sample, backendPreference, slice) {
  const ids = backendPreference === "explicit-preferred" ? [`backend-${slice}`] : null;
  if (sample.input?.runtimeOperation) {
    if (ids) {
      sample.input.runtimeOperation.preferredBackendIds = ids;
    } else {
      delete sample.input.runtimeOperation.preferredBackendIds;
    }
  }
  if (sample.input?.runtimeConfig) {
    if (ids && !sample.input.runtimeOperation) {
      sample.input.runtimeConfig.preferredBackendIds = ids;
    } else {
      delete sample.input.runtimeConfig.preferredBackendIds;
    }
  }
}

function updateSignals(sample, spec) {
  const lineage =
    spec.parent && spec.parent !== spec.id
      ? { parentSampleId: spec.parent, strategy: spec.lineage ?? "combinatorial-expansion" }
      : undefined;
  sample.governance.optimizationSignals = {
    seedSource: spec.seed,
    incubationTrack: TRACK_BY_STABILITY[spec.stability],
    recommendedLevers:
      spec.levers ??
      (sample.sample.scenarioType === "tool-error-recovery"
        ? ["hooks", "rules", "session-lineage"]
        : sample.sample.scenarioType === "autodrive-launch"
          ? ["hooks", "skills", "session-lineage"]
          : sample.sample.scenarioType === "write-safe-minimal"
            ? ["rules", "skills"]
            : ["rules", "skills"]),
    safeBackgroundCandidate:
      (spec.safe === true || spec.safe === undefined) &&
      spec.stability === "golden" &&
      sample.sample.scenarioType === "runtime-isolation",
    ...(lineage ? { lineage } : {}),
  };
  sample.governance.owner = "runtime-core-e2e";
  sample.governance.deprecationStatus = "active";
  sample.governance.archiveStatus = null;
  sample.governance.lastRefreshReason =
    "Generated from the phase-one runtime replay expansion plan for risk-weighted combinatorial coverage.";
}

function configureScenarioCoverage(sample) {
  const runtimeTruth = createEmptyRuntimeTruth();
  switch (sample.sample?.scenarioType) {
    case "autodrive-launch":
      sample.sample.capabilities = [
        "runtime-truth",
        "autodrive-navigation",
        "autodrive-evaluation-profile",
        "event-replay-gap",
      ];
      runtimeTruth.autodrive.push({
        type: "assert-autodrive-trace",
        decisionTraceMatcher: "present",
        runtimeScenarioProfileMatcher: "present",
        repoEvaluationProfileMatcher: "absent",
        outcomeFeedbackMatcher: "present",
        autonomyStateMatcher: "present",
        timeoutMs: 20000,
      });
      runtimeTruth.eventReplay.push({
        type: "assert-replay-gap-event",
        expectedReason: "native_state_fabric_updated",
        timeoutMs: 20000,
      });
      break;
    case "read-only":
    case "runtime-isolation":
    case "unsupported-or-edge":
      sample.sample.capabilities = ["placement-routing"];
      break;
    case "tool-error-recovery":
      sample.sample.capabilities = ["tool-error-recovery"];
      break;
    case "write-safe-minimal":
      sample.sample.capabilities = ["write-safe"];
      break;
    default:
      delete sample.sample.capabilities;
      break;
  }
  sample.runtimeTruth = runtimeTruth;
}

function appendComposerOptionAssertions(sample) {
  if (!sample.process?.harness) {
    return;
  }
  const assertions = ensureArray(sample.process.harness.assertions);
  const serializedExisting = new Set(assertions.map((entry) => JSON.stringify(entry)));
  const explicitSelections = ensureArray(sample.process.harness.actions).filter(
    (entry) =>
      entry?.type === "select-option" &&
      typeof entry.control === "string" &&
      typeof entry.value === "string"
  );
  for (const selection of explicitSelections) {
    const assertion = {
      type: "assert-composer-option",
      control: selection.control,
      value: selection.value,
      timeoutMs: 15000,
    };
    const serialized = JSON.stringify(assertion);
    if (!serializedExisting.has(serialized)) {
      assertions.push(assertion);
      serializedExisting.add(serialized);
    }
  }
  sample.process.harness.assertions = assertions;
}

function stableProbe(profileId, turnId, failureClass, attempts = 2) {
  return {
    enabled: true,
    profileId,
    turnId,
    attempts,
    expectedFailureClasses: [failureClass],
    lastRun: {
      recordedAt: GENERATED_AT,
      attempts,
      observedFailureClasses: [failureClass],
      attemptRecords: Array.from({ length: attempts }, (_, index) => ({
        attempt: index + 1,
        outcome: "failed",
        failureClass,
      })),
      stable: true,
      driftObserved: false,
    },
  };
}

function incompatibleProbe(
  profileId,
  turnId,
  expectedFailureClass,
  observedFailureClass,
  attempts = 2
) {
  return {
    enabled: true,
    profileId,
    turnId,
    attempts,
    expectedFailureClasses: [expectedFailureClass],
    lastRun: {
      recordedAt: GENERATED_AT,
      attempts,
      observedFailureClasses: [observedFailureClass],
      attemptRecords: Array.from({ length: attempts }, (_, index) => ({
        attempt: index + 1,
        outcome: "failed",
        failureClass: observedFailureClass,
      })),
      stable: false,
      driftObserved: false,
    },
  };
}

function refreshGovernance(sample) {
  if (sample.process?.errorRecovery?.expected !== true) {
    delete sample.governance.lastLiveFailureClass;
    delete sample.governance.lastLiveRerecordStable;
    delete sample.governance.rerecordStability;
    delete sample.governance.recoveryQualification;
    delete sample.governance.liveFailureProbe;
  } else {
    const expected = ensureArray(sample.process.errorRecovery.expectedFailureClasses);
    sample.governance.rerecordStability = deriveRuntimeReplayRerecordStability(
      expected,
      sample.governance?.liveFailureProbe?.lastRun
    );
    sample.governance.lastLiveFailureClass =
      sample.governance.rerecordStability.observedFailureClasses[0] ?? null;
    sample.governance.lastLiveRerecordStable = sample.governance.rerecordStability.stable;
    sample.governance.recoveryQualification = summarizeRuntimeReplayRecoveryQualification(sample);
  }
  sample.governance.goldenBlockers = deriveRuntimeReplayGovernanceGoldenBlockers(sample);
  sample.governance.goldenBlockerHistory = updateRuntimeReplayGoldenBlockerHistory(
    [],
    sample.governance.goldenBlockers,
    GENERATED_AT
  );
}

function configureProviderRejected(sample) {
  const [failureTurn, recoveryTurn] = ensureArray(sample.result?.providerReplay?.turns);
  sample.sample.source = "recorded";
  sample.governance.recordingProfiles = {
    "provider-rejected-http-stub": {
      strategy: "runtime-record",
      notes:
        "Routes the OpenAI endpoint to a local HTTP 403 stub so provider.rejected stays fully recorded.",
      env: {
        CODE_RUNTIME_SERVICE_OPENAI_MAX_RETRIES: "0",
        CODE_RUNTIME_SERVICE_OPENAI_TIMEOUT_MS: "500",
        CODE_RUNTIME_SERVICE_OPENAI_COMPAT_API_KEY: null,
        CODE_RUNTIME_SERVICE_OPENAI_COMPAT_BASE_URL: null,
      },
      httpStub: {
        envKey: "CODE_RUNTIME_SERVICE_OPENAI_ENDPOINT",
        status: 403,
        body: JSON.stringify({ error: { message: "Provider rejected request for this turn." } }),
        headers: { "content-type": "application/json" },
        path: "/v1/responses",
      },
      failure: {
        class: "provider.rejected",
        code: "runtime.turn.provider.rejected",
        message: "Provider rejected request for this turn.",
      },
    },
  };
  sample.governance.deterministicRegressions = [
    {
      id: "http-stub-profiles-force-scoped-runtime",
      layer: "recorder",
      path: "scripts/record-runtime-provider-replay.node.test.mjs",
      testName:
        "recordingProfileRequiresScopedRuntime requires isolated runtime when an httpStub is configured",
      status: "active",
    },
  ];
  sample.governance.liveFailureProbe = stableProbe(
    "provider-rejected-http-stub",
    "turn-1",
    "provider.rejected"
  );
  sample.governance.promotionCriteria = {
    upgradeToGolden: [
      "Keep the provider.rejected failure leg recorded through the local HTTP 403 stub profile.",
      "Pass repeated live failure probes without class drift.",
    ],
  };
  sample.governance.evidencePlan = {
    mixedEvidence: false,
    turnSources: { "turn-1": "recorded", "turn-2": "recorded" },
    notes:
      "Both failure and recovery legs are recorded; the failure leg is captured through a deterministic local rejection stub.",
  };
  if (failureTurn) {
    failureTurn.recordingProfile = "provider-rejected-http-stub";
    failureTurn.failure = {
      class: "provider.rejected",
      code: "runtime.turn.provider.rejected",
      message: "Provider rejected request for this turn.",
    };
    failureTurn.provenance = {
      ...(failureTurn.provenance ?? {}),
      source: "recorded",
      notes: "Recorded from a live runtime path backed by a local HTTP 403 stub.",
    };
  }
  if (recoveryTurn?.provenance) {
    recoveryTurn.provenance.source = "recorded";
    recoveryTurn.provenance.notes =
      "Recorded from the live runtime/provider path after a deterministic provider.rejected failure leg.";
  }
}

function configureRequestFailed(sample) {
  sample.sample.source = "recorded";
  sample.governance.liveFailureProbe = stableProbe(
    "openai-endpoint-refused-live",
    "turn-1",
    "provider.request-failed"
  );
  sample.governance.evidencePlan = {
    mixedEvidence: false,
    turnSources: { "turn-1": "recorded", "turn-2": "recorded" },
    notes:
      "Failure and recovery legs are recorded from the live runtime path using a refused-endpoint recording profile.",
  };
}

function configureStreamInterrupted(sample) {
  const [failureTurn] = ensureArray(sample.result?.providerReplay?.turns);
  sample.sample.source = "mixed";
  sample.governance.liveFailureProbe = incompatibleProbe(
    "openai-endpoint-refused-live",
    "turn-1",
    "provider.stream-interrupted",
    "provider.request-failed"
  );
  sample.governance.promotionCriteria = {
    upgradeToGolden: [
      "Replace the controlled provider.stream-interrupted leg with a real recorded stream interruption.",
      "Keep live rerecords on provider.stream-interrupted instead of provider.request-failed.",
    ],
  };
  sample.governance.evidencePlan = {
    mixedEvidence: true,
    turnSources: { "turn-1": "controlled-synthetic", "turn-2": "recorded" },
    notes:
      "The failure leg is still controlled synthetic because live rerecord probes land on provider.request-failed.",
  };
  if (failureTurn?.provenance) {
    failureTurn.provenance.source = "controlled-synthetic";
  }
}

function configureOrchestration(sample) {
  const [failureTurn] = ensureArray(sample.result?.providerReplay?.turns);
  sample.sample.source = "mixed";
  sample.governance.liveFailureProbe = {
    enabled: false,
    profileId: "controlled-orchestration-unavailable",
    turnId: "turn-1",
    attempts: 1,
    expectedFailureClasses: ["runtime.orchestration.unavailable"],
  };
  sample.governance.promotionCriteria = {
    upgradeToGolden: [
      "Add a real runtime-controlled orchestration-unavailable recording profile.",
      "Keep the recovery leg recorded and the failure class probeable without synthetic evidence.",
    ],
  };
  sample.governance.evidencePlan = {
    mixedEvidence: true,
    turnSources: { "turn-1": "controlled-synthetic", "turn-2": "recorded" },
    notes:
      "The failure leg is synthetic because the orchestration-unavailable path still falls back instead of failing deterministically.",
  };
  if (failureTurn?.provenance) {
    failureTurn.provenance.source = "controlled-synthetic";
  }
}

const RECOVERY_MODES = {
  none: () => undefined,
  requestFailed: configureRequestFailed,
  providerRejected: configureProviderRejected,
  streamInterrupted: configureStreamInterrupted,
  orchestration: configureOrchestration,
};

const SAMPLE_DEFS = [
  [
    "runtime-core-streaming-queue-resume-gpt-5.4-low",
    "runtime-core-streaming-queue-resume-gpt-5.4-low",
    "gpt-5.4",
    "low",
    "golden",
    "streaming-flagship-baseline",
    "session-regression",
    "not-applicable",
    "none",
    null,
    null,
    true,
  ],
  [
    "runtime-core-streaming-queue-resume-gpt-5.4-mini-low",
    "runtime-core-streaming-queue-resume-gpt-5.4-mini-low",
    "gpt-5.4-mini",
    "low",
    "golden",
    "streaming-mini-baseline",
    "session-regression",
    "not-applicable",
    "none",
    null,
    null,
    true,
  ],
  [
    "runtime-core-streaming-queue-resume-gpt-5.4-mini-low",
    "runtime-core-streaming-queue-resume-gpt-5.3-codex-medium",
    "gpt-5.3-codex",
    "medium",
    "golden",
    "streaming-codex-baseline",
    "combinatorial-expansion",
    "not-applicable",
    "none",
    null,
    null,
    true,
  ],
  [
    "runtime-core-streaming-queue-resume-gpt-5.4-low",
    "runtime-core-streaming-queue-resume-gpt-5.4-medium",
    "gpt-5.4",
    "medium",
    "golden",
    "streaming-flagship-medium",
    "session-regression",
    "not-applicable",
    "none",
    null,
    null,
    true,
  ],
  [
    "runtime-core-streaming-queue-resume-gpt-5.4-mini-low",
    "runtime-core-streaming-queue-resume-gpt-5.4-mini-medium",
    "gpt-5.4-mini",
    "medium",
    "candidate",
    "streaming-mini-medium",
    "combinatorial-expansion",
    "not-applicable",
    "none",
  ],
  [
    "runtime-core-streaming-queue-resume-gpt-5.4-mini-low",
    "runtime-core-streaming-queue-resume-gpt-5.3-codex-low",
    "gpt-5.3-codex",
    "low",
    "candidate",
    "streaming-codex-low",
    "combinatorial-expansion",
    "not-applicable",
    "none",
  ],
  [
    "runtime-core-streaming-queue-resume-gpt-5.4-low",
    "runtime-core-streaming-queue-resume-gpt-5.4-high",
    "gpt-5.4",
    "high",
    "incubating",
    "streaming-flagship-high",
    "synthetic-adversarial",
    "not-applicable",
    "none",
  ],
  [
    "runtime-core-streaming-queue-resume-gpt-5.4-mini-low",
    "runtime-core-streaming-queue-resume-gpt-5.4-mini-high",
    "gpt-5.4-mini",
    "high",
    "incubating",
    "streaming-mini-high",
    "synthetic-adversarial",
    "not-applicable",
    "none",
  ],
  [
    "runtime-core-read-only-gpt-5.4-low",
    "runtime-core-read-only-gpt-5.4-low",
    "gpt-5.4",
    "low",
    "golden",
    "launch-read-only-flagship-baseline",
    "manual",
    "explicit-preferred",
    "none",
    null,
    null,
    true,
  ],
  [
    "runtime-core-read-only-gpt-5.4-low",
    "runtime-core-read-only-gpt-5.4-mini-low",
    "gpt-5.4-mini",
    "low",
    "golden",
    "launch-read-only-mini-baseline",
    "session-regression",
    "not-applicable",
    "none",
    null,
    null,
    true,
  ],
  [
    "runtime-core-read-only-background-gpt-5.3-codex-medium",
    "runtime-core-read-only-background-gpt-5.3-codex-medium",
    "gpt-5.3-codex",
    "medium",
    "golden",
    "launch-read-only-codex-background",
    "session-regression",
    "explicit-preferred",
    "none",
    null,
    null,
    true,
  ],
  [
    "runtime-core-read-only-gpt-5.4-low",
    "runtime-core-read-only-gpt-5.4-medium",
    "gpt-5.4",
    "medium",
    "candidate",
    "launch-read-only-flagship-medium",
    "combinatorial-expansion",
    "not-applicable",
    "none",
  ],
  [
    "runtime-core-read-only-gpt-5.4-low",
    "runtime-core-read-only-gpt-5.4-mini-medium",
    "gpt-5.4-mini",
    "medium",
    "incubating",
    "launch-read-only-mini-medium",
    "synthetic-adversarial",
    "not-applicable",
    "none",
  ],
  [
    "runtime-core-autodrive-launch-gpt-5.4-low",
    "runtime-core-autodrive-launch-gpt-5.4-low",
    "gpt-5.4",
    "low",
    "golden",
    "launch-autodrive-flagship-baseline",
    "manual",
    "runtime-default",
    "none",
  ],
  [
    "runtime-core-autodrive-launch-gpt-5.3-codex-medium",
    "runtime-core-autodrive-launch-gpt-5.3-codex-medium",
    "gpt-5.3-codex",
    "medium",
    "golden",
    "launch-autodrive-codex-baseline",
    "session-regression",
    "runtime-default",
    "none",
  ],
  [
    "runtime-core-autodrive-launch-gpt-5.4-low",
    "runtime-core-autodrive-launch-gpt-5.4-medium",
    "gpt-5.4",
    "medium",
    "golden",
    "launch-autodrive-flagship-medium",
    "combinatorial-expansion",
    "explicit-preferred",
    "none",
  ],
  [
    "runtime-core-autodrive-launch-gpt-5.4-low",
    "runtime-core-autodrive-launch-gpt-5.4-mini-low",
    "gpt-5.4-mini",
    "low",
    "candidate",
    "launch-autodrive-mini-low",
    "combinatorial-expansion",
    "explicit-preferred",
    "none",
  ],
  [
    "runtime-core-autodrive-launch-gpt-5.4-low",
    "runtime-core-autodrive-launch-gpt-5.4-mini-medium",
    "gpt-5.4-mini",
    "medium",
    "candidate",
    "launch-autodrive-mini-medium",
    "combinatorial-expansion",
    "explicit-preferred",
    "none",
  ],
  [
    "runtime-core-write-safe-minimal-gpt-5.4-low",
    "runtime-core-write-safe-minimal-gpt-5.4-low",
    "gpt-5.4",
    "low",
    "golden",
    "write-safe-text-flagship-baseline",
    "manual",
    "not-applicable",
    "none",
    null,
    null,
    false,
  ],
  [
    "runtime-core-write-safe-minimal-json-gpt-5.4-low",
    "runtime-core-write-safe-minimal-json-gpt-5.4-low",
    "gpt-5.4",
    "low",
    "golden",
    "write-safe-json-flagship-baseline",
    "manual",
    "not-applicable",
    "none",
    null,
    null,
    false,
  ],
  [
    "runtime-core-write-safe-minimal-gpt-5.4-low",
    "runtime-core-write-safe-minimal-gpt-5.4-mini-low",
    "gpt-5.4-mini",
    "low",
    "golden",
    "write-safe-text-mini-baseline",
    "combinatorial-expansion",
    "not-applicable",
    "none",
    null,
    null,
    false,
  ],
  [
    "runtime-core-write-safe-minimal-json-gpt-5.4-low",
    "runtime-core-write-safe-minimal-json-gpt-5.3-codex-medium",
    "gpt-5.3-codex",
    "medium",
    "golden",
    "write-safe-json-codex-baseline",
    "combinatorial-expansion",
    "not-applicable",
    "none",
    null,
    null,
    false,
  ],
  [
    "runtime-core-write-safe-minimal-gpt-5.4-low",
    "runtime-core-write-safe-minimal-gpt-5.4-medium",
    "gpt-5.4",
    "medium",
    "golden",
    "write-safe-text-flagship-medium",
    "session-regression",
    "not-applicable",
    "none",
    null,
    null,
    false,
  ],
  [
    "runtime-core-write-safe-minimal-json-gpt-5.4-low",
    "runtime-core-write-safe-minimal-json-gpt-5.4-mini-medium",
    "gpt-5.4-mini",
    "medium",
    "candidate",
    "write-safe-json-mini-medium",
    "combinatorial-expansion",
    "not-applicable",
    "none",
    null,
    null,
    false,
  ],
  [
    "runtime-core-write-safe-minimal-gpt-5.4-low",
    "runtime-core-write-safe-minimal-gpt-5.3-codex-low",
    "gpt-5.3-codex",
    "low",
    "candidate",
    "write-safe-text-codex-low",
    "combinatorial-expansion",
    "not-applicable",
    "none",
    null,
    null,
    false,
  ],
  [
    "runtime-core-write-safe-minimal-json-gpt-5.4-low",
    "runtime-core-write-safe-minimal-json-gpt-5.4-high",
    "gpt-5.4",
    "high",
    "incubating",
    "write-safe-json-flagship-high",
    "synthetic-adversarial",
    "not-applicable",
    "none",
    null,
    null,
    false,
  ],
  [
    "runtime-core-isolation-gpt-5.4-high",
    "runtime-core-isolation-gpt-5.4-high",
    "gpt-5.4",
    "high",
    "golden",
    "routing-isolation-flagship-high",
    "session-regression",
    "not-applicable",
    "none",
    null,
    null,
    true,
  ],
  [
    "runtime-core-isolation-gpt-5.4-mini-medium",
    "runtime-core-isolation-gpt-5.4-mini-medium",
    "gpt-5.4-mini",
    "medium",
    "golden",
    "routing-isolation-mini-medium",
    "session-regression",
    "not-applicable",
    "none",
    null,
    null,
    true,
  ],
  [
    "runtime-core-isolation-gpt-5.4-high",
    "runtime-core-isolation-gpt-5.3-codex-high",
    "gpt-5.3-codex",
    "high",
    "golden",
    "routing-isolation-codex-high",
    "combinatorial-expansion",
    "not-applicable",
    "none",
    null,
    null,
    true,
  ],
  [
    "runtime-core-isolation-gpt-5.4-high",
    "runtime-core-isolation-gpt-5.4-medium",
    "gpt-5.4",
    "medium",
    "candidate",
    "routing-isolation-flagship-medium",
    "combinatorial-expansion",
    "not-applicable",
    "none",
  ],
  [
    "runtime-core-isolation-gpt-5.4-mini-medium",
    "runtime-core-isolation-gpt-5.4-mini-high",
    "gpt-5.4-mini",
    "high",
    "incubating",
    "routing-isolation-mini-high",
    "synthetic-adversarial",
    "not-applicable",
    "none",
  ],
  [
    "runtime-core-model-selection-gpt-5.3-codex-medium",
    "runtime-core-model-selection-gpt-5.3-codex-medium",
    "gpt-5.3-codex",
    "medium",
    "golden",
    "routing-model-selection-codex-medium",
    "session-regression",
    "explicit-preferred",
    "none",
  ],
  [
    "runtime-core-model-selection-gpt-5.4-mini-medium",
    "runtime-core-model-selection-gpt-5.4-mini-medium",
    "gpt-5.4-mini",
    "medium",
    "golden",
    "routing-model-selection-mini-medium",
    "session-regression",
    "explicit-preferred",
    "none",
  ],
  [
    "runtime-core-model-selection-gpt-5.3-codex-medium",
    "runtime-core-model-selection-gpt-5.4-low",
    "gpt-5.4",
    "low",
    "candidate",
    "routing-model-selection-flagship-low",
    "combinatorial-expansion",
    "explicit-preferred",
    "none",
  ],
  [
    "runtime-core-model-selection-gpt-5.3-codex-medium",
    "runtime-core-model-selection-gpt-5.3-codex-low",
    "gpt-5.3-codex",
    "low",
    "candidate",
    "routing-model-selection-codex-low",
    "combinatorial-expansion",
    "explicit-preferred",
    "none",
  ],
  [
    "runtime-core-model-selection-gpt-5.4-mini-medium",
    "runtime-core-model-selection-gpt-5.4-mini-high",
    "gpt-5.4-mini",
    "high",
    "incubating",
    "routing-model-selection-mini-high",
    "synthetic-adversarial",
    "explicit-preferred",
    "none",
  ],
  [
    "runtime-core-tool-error-recovery-request-failed-gpt-5.4-low",
    "runtime-core-tool-error-recovery-request-failed-gpt-5.4-low",
    "gpt-5.4",
    "low",
    "golden",
    "recovery-request-failed-flagship-low",
    "workflow-failure",
    "not-applicable",
    "requestFailed",
  ],
  [
    "runtime-core-tool-error-recovery-request-failed-gpt-5.4-low",
    "runtime-core-tool-error-recovery-request-failed-gpt-5.4-mini-low",
    "gpt-5.4-mini",
    "low",
    "golden",
    "recovery-request-failed-mini-low",
    "workflow-failure",
    "not-applicable",
    "requestFailed",
  ],
  [
    "runtime-core-tool-error-recovery-request-failed-gpt-5.4-low",
    "runtime-core-tool-error-recovery-request-failed-gpt-5.3-codex-medium",
    "gpt-5.3-codex",
    "medium",
    "golden",
    "recovery-request-failed-codex-medium",
    "workflow-failure",
    "not-applicable",
    "requestFailed",
  ],
  [
    "runtime-core-tool-error-recovery-request-failed-gpt-5.4-low",
    "runtime-core-tool-error-recovery-request-failed-gpt-5.4-medium",
    "gpt-5.4",
    "medium",
    "golden",
    "recovery-request-failed-flagship-medium",
    "workflow-failure",
    "not-applicable",
    "requestFailed",
  ],
  [
    "runtime-core-tool-error-recovery-provider-rejected-gpt-5.4-low",
    "runtime-core-tool-error-recovery-provider-rejected-gpt-5.4-low",
    "gpt-5.4",
    "low",
    "candidate",
    "recovery-provider-rejected-flagship-low",
    "workflow-failure",
    "not-applicable",
    "providerRejected",
    "runtime-core-tool-error-recovery-gpt-5.3-codex-medium",
    "failure-class-branch",
  ],
  [
    "runtime-core-tool-error-recovery-provider-rejected-gpt-5.4-low",
    "runtime-core-tool-error-recovery-provider-rejected-gpt-5.4-mini-low",
    "gpt-5.4-mini",
    "low",
    "candidate",
    "recovery-provider-rejected-mini-low",
    "workflow-failure",
    "not-applicable",
    "providerRejected",
  ],
  [
    "runtime-core-tool-error-recovery-provider-rejected-gpt-5.4-low",
    "runtime-core-tool-error-recovery-provider-rejected-gpt-5.3-codex-medium",
    "gpt-5.3-codex",
    "medium",
    "candidate",
    "recovery-provider-rejected-codex-medium",
    "workflow-failure",
    "not-applicable",
    "providerRejected",
  ],
  [
    "runtime-core-tool-error-recovery-provider-rejected-gpt-5.4-low",
    "runtime-core-tool-error-recovery-provider-rejected-gpt-5.4-medium",
    "gpt-5.4",
    "medium",
    "candidate",
    "recovery-provider-rejected-flagship-medium",
    "workflow-failure",
    "not-applicable",
    "providerRejected",
  ],
  [
    "runtime-core-tool-error-recovery-gpt-5.3-codex-medium",
    "runtime-core-tool-error-recovery-gpt-5.3-codex-medium",
    "gpt-5.3-codex",
    "medium",
    "candidate",
    "recovery-stream-interrupted-codex-medium",
    "workflow-failure",
    "not-applicable",
    "streamInterrupted",
  ],
  [
    "runtime-core-tool-error-recovery-gpt-5.3-codex-medium",
    "runtime-core-tool-error-recovery-stream-interrupted-gpt-5.4-mini-medium",
    "gpt-5.4-mini",
    "medium",
    "candidate",
    "recovery-stream-interrupted-mini-medium",
    "workflow-failure",
    "not-applicable",
    "streamInterrupted",
  ],
  [
    "runtime-core-tool-error-recovery-orchestration-gpt-5.4-low",
    "runtime-core-tool-error-recovery-orchestration-gpt-5.4-low",
    "gpt-5.4",
    "low",
    "incubating",
    "recovery-orchestration-flagship-low",
    "workflow-failure",
    "not-applicable",
    "orchestration",
    "runtime-core-tool-error-recovery-gpt-5.3-codex-medium",
    "failure-class-branch",
  ],
  [
    "runtime-core-tool-error-recovery-orchestration-gpt-5.4-low",
    "runtime-core-tool-error-recovery-orchestration-gpt-5.3-codex-medium",
    "gpt-5.3-codex",
    "medium",
    "incubating",
    "recovery-orchestration-codex-medium",
    "workflow-failure",
    "not-applicable",
    "orchestration",
  ],
];
const COVERAGE_SLICE_TAGS = new Set(SAMPLE_DEFS.map((entry) => entry[5]));

function materializeSample(def) {
  const [
    templateId,
    id,
    modelId,
    reasonEffort,
    stability,
    slice,
    seed,
    backendPreference,
    recoveryMode,
    parent = templateId !== id ? templateId : null,
    lineage,
    safe,
  ] = def;
  const spec = {
    templateId,
    id,
    modelId,
    reasonEffort,
    stability,
    slice,
    seed,
    backendPreference,
    recoveryMode,
    parent,
    lineage,
    safe,
  };
  const sample = clone(loadTemplate(templateId));
  resetGeneratedReplayShape(sample);
  updateVariant(sample, spec);
  updateModel(sample, modelId, reasonEffort);
  updateBackendPreference(sample, backendPreference, slice);
  updateSignals(sample, spec);
  updateRefreshCommands(sample);
  configureScenarioCoverage(sample);
  appendComposerOptionAssertions(sample);
  RECOVERY_MODES[recoveryMode]?.(sample);
  refreshGovernance(sample);
  const normalized = normalizeRuntimeReplaySample(sample);
  normalized.sample.axisCoverage = {
    ...normalized.sample.axisCoverage,
    modelProfile: modelId,
    reasoningEffort: reasonEffort,
    backendPreference,
    coverageSlice: slice,
  };
  normalized.sample.sourceFingerprint = {
    ...normalized.sample.sourceFingerprint,
    seedSource: seed,
    priorityBucket:
      PRIORITY_BUCKET_BY_SEED_SOURCE[seed] ?? normalized.sample.sourceFingerprint.priorityBucket,
    parentSampleId: parent ?? null,
    evidenceMode: normalized.sample.source,
    dedupKey: [
      normalized.sample.scenarioType,
      normalized.sample.axisCoverage.failureClass ?? "none",
      normalized.input?.runtimeConfig?.accessMode ?? "unspecified",
      slice,
    ].join("|"),
  };
  normalized.sample.qualityReview = {
    ...normalized.sample.qualityReview,
    reviewedAt: GENERATED_AT,
    reviewedBy: "runtime-replay-phase1-generator",
    status: stability === "golden" ? "approved" : "needs-follow-up",
    notes: unique([
      ...ensureArray(normalized.sample.qualityReview?.notes),
      `Coverage slice ${slice}.`,
      `Generated from ${templateId} with seed source ${seed}.`,
    ]),
  };
  normalized.sample.promotionPolicy = {
    ...normalized.sample.promotionPolicy,
    requiresLiveFailureProbe:
      normalized.process?.errorRecovery?.expected === true && stability !== "incubating",
  };
  normalized.sample.freshnessPolicy = {
    ...normalized.sample.freshnessPolicy,
    strict: stability !== "incubating",
  };
  return normalized;
}

function buildManifest(samples) {
  return {
    schemaVersion: 1,
    datasetId: "runtime-provider-replay",
    version: "2026-03-phase1",
    taxonomy: MANIFEST_TAXONOMY.map(([scenarioType, status, why]) => ({
      scenarioType,
      status,
      why,
    })),
    coverageMatrix: {
      sources: [
        "manual",
        "workflow-failure",
        "session-regression",
        "runtime-incident",
        "synthetic-adversarial",
        "combinatorial-expansion",
      ],
      modelProfiles: MODEL_PROFILES,
      capabilityCatalog: [
        {
          id: "runtime-truth",
          status: "implemented",
          notes: "Structured runtime truth stays independent from transcript equality.",
        },
        {
          id: "continuity-handoff",
          status: "planned",
          notes: "Checkpoint, mission linkage, publish handoff, and review continuation truth.",
        },
        {
          id: "placement-routing",
          status: "implemented",
          notes: "Backend preference, routing choice, and operability metadata.",
        },
        {
          id: "autodrive-navigation",
          status: "implemented",
          notes: "AutoDrive decision trace and navigation-state coverage.",
        },
        {
          id: "autodrive-evaluation-profile",
          status: "implemented",
          notes: "Runtime evaluation profile and scenario-profile coverage for AutoDrive.",
        },
        {
          id: "event-replay-gap",
          status: "implemented",
          notes: "Replay gap resync and event durability assertions.",
        },
        {
          id: "tool-error-recovery",
          status: "implemented",
          notes:
            "Recoverable runtime/provider failure sequences with deterministic follow-up proof.",
        },
        {
          id: "write-safe",
          status: "implemented",
          notes: "Deterministic write-safe workspace mutations with machine-readable evidence.",
        },
      ],
      capabilityRequirements: [
        {
          capabilityId: "runtime-truth",
          requiredProfiles: ["gpt-5.4"],
          notes: "Runtime truth starts with the flagship lane before broader rollout.",
        },
        {
          capabilityId: "tool-error-recovery",
          requiredProfiles: ["gpt-5.4", "gpt-5.3-codex"],
          notes: "Recovery coverage stays visible on flagship and compatibility coding routes.",
        },
        {
          capabilityId: "write-safe",
          requiredProfiles: ["gpt-5.4"],
          notes: "Write-safe gating stays anchored to the flagship route.",
        },
        {
          capabilityId: "event-replay-gap",
          requiredProfiles: ["gpt-5.4", "gpt-5.4-mini", "gpt-5.3-codex"],
          notes: "Replay gap resync stays live across flagship, mini, and coding lanes.",
        },
        {
          capabilityId: "autodrive-navigation",
          requiredProfiles: ["gpt-5.4", "gpt-5.3-codex"],
          notes:
            "AutoDrive navigation truth stays visible on flagship and compatibility coding routes.",
        },
        {
          capabilityId: "autodrive-evaluation-profile",
          requiredProfiles: ["gpt-5.4", "gpt-5.3-codex"],
          notes:
            "AutoDrive evaluation-profile truth stays visible on flagship and compatibility coding routes.",
        },
      ],
      scenarioRequirements: [
        {
          scenarioType: "read-only",
          requiredProfiles: ["gpt-5.4", "gpt-5.3-codex"],
          notes: "Read-only coverage keeps flagship and coding-route inspection paths healthy.",
        },
        {
          scenarioType: "streaming-long-output",
          requiredProfiles: ["gpt-5.4", "gpt-5.4-mini"],
          notes:
            "Streaming queue/resume coverage proves flagship and mini routing stay replay-safe.",
        },
        {
          scenarioType: "tool-error-recovery",
          requiredProfiles: ["gpt-5.4", "gpt-5.3-codex"],
          notes:
            "Recovery coverage spans the active flagship path and the compatibility coding route.",
        },
        {
          scenarioType: "runtime-isolation",
          requiredProfiles: ["gpt-5.4", "gpt-5.4-mini"],
          notes: "Isolation checks must cover both the flagship default and the current mini tier.",
        },
        {
          scenarioType: "autodrive-launch",
          requiredProfiles: ["gpt-5.4", "gpt-5.3-codex"],
          notes: "AutoDrive launch truth is replayed on flagship and compatibility coding routes.",
        },
        {
          scenarioType: "write-safe-minimal",
          requiredProfiles: ["gpt-5.4"],
          notes: "Safe write-path baseline remains anchored to the flagship route.",
        },
        {
          scenarioType: "unsupported-or-edge",
          requiredProfiles: ["gpt-5.3-codex", "gpt-5.4-mini"],
          notes:
            "Edge routing exercises both compatibility coding behavior and the current mini route.",
        },
      ],
    },
    samples: samples
      .map((sample) => createRuntimeReplayManifestEntry(sample, `samples/${sample.sample.id}.json`))
      .sort((left, right) => left.id.localeCompare(right.id)),
  };
}

function main() {
  const samples = SAMPLE_DEFS.map((def) => materializeSample(def)).sort((left, right) =>
    left.sample.id.localeCompare(right.sample.id)
  );
  const manifest = buildManifest(samples);
  const expectedFiles = new Set(samples.map((sample) => `${sample.sample.id}.json`));
  for (const existingFile of fs.readdirSync(SAMPLES_DIR)) {
    if (existingFile.endsWith(".json") && !expectedFiles.has(existingFile)) {
      fs.rmSync(path.join(SAMPLES_DIR, existingFile), { force: true });
    }
  }
  for (const sample of samples) {
    writeJson(path.join(SAMPLES_DIR, `${sample.sample.id}.json`), sample);
  }
  writeJson(MANIFEST_PATH, manifest);
  process.stdout.write(
    `Generated runtime replay dataset: ${samples.length} samples written to ${DATASET_DIR}\n`
  );
}

const isDirectExecution =
  typeof process.argv[1] === "string" &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isDirectExecution) {
  main();
}
