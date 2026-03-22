import fs from "node:fs";
import path from "node:path";

const DEFAULT_DATASET_DIR = path.join(
  process.cwd(),
  "packages",
  "code-runtime-service-rs",
  "testdata",
  "provider-replay"
);

const REPO_ROOT = process.cwd();
const DEFAULT_MANIFEST_PATH = path.join(DEFAULT_DATASET_DIR, "manifest.json");

const SENSITIVE_PATTERNS = [
  /\bsk-[A-Za-z0-9_-]{10,}\b/u,
  /\bBearer\s+[A-Za-z0-9._-]{12,}\b/u,
  /Authorization:\s*\S+/iu,
  /api[_-]?key\s*[:=]\s*\S+/iu,
  /cookie\s*[:=]\s*\S+/iu,
  /\/Users\/[^/\s]+/u,
];

const ANSI_ESCAPE_PATTERN = new RegExp(String.raw`\u001B\[[0-9;]*m`, "gu");
const IGNORABLE_WARNING_PATTERNS = [
  /The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set\./u,
  /Use `node --trace-warnings \.\.\.` to show where the warning was created/u,
];
const BACKGROUND_READY_SCENARIO_ALLOWLIST = new Set(["read-only", "runtime-isolation"]);
const BACKGROUND_READY_QUEUE_PROFILES = {
  "read-only": "read-only-safe",
  "runtime-isolation": "isolated-runtime-check",
};
const DEFAULT_RUNTIME_REPLAY_HARNESS_TIMEOUT_MS = 60_000;
const RUNTIME_TRUTH_ASSERTION_TYPES = new Set([
  "wait-runtime-task-field",
  "wait-runtime-summary",
  "assert-runtime-actionability",
  "assert-autodrive-trace",
  "assert-replay-gap-event",
  "assert-review-pack-linkage",
]);
const RUNTIME_TRUTH_VALUE_MATCHERS = new Set(["present", "absent", "equals", "includes"]);

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function isObjectRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function ensureStringArray(value) {
  return ensureArray(value)
    .filter((entry) => typeof entry === "string" && entry.trim().length > 0)
    .map((entry) => entry.trim());
}

function normalizeRuntimeTruthSectionAssertions(value) {
  return ensureArray(value)
    .filter((entry) => isObjectRecord(entry))
    .filter(
      (entry) => typeof entry.type === "string" && RUNTIME_TRUTH_ASSERTION_TYPES.has(entry.type)
    )
    .map((entry) => structuredClone(entry));
}

function collectRuntimeTruthHarnessAssertions(sample) {
  const runtimeTruth = isObjectRecord(sample?.runtimeTruth) ? sample.runtimeTruth : null;
  if (!runtimeTruth) {
    return [];
  }
  return [
    ...normalizeRuntimeTruthSectionAssertions(runtimeTruth.taskFields),
    ...normalizeRuntimeTruthSectionAssertions(runtimeTruth.review),
    ...normalizeRuntimeTruthSectionAssertions(runtimeTruth.autodrive),
    ...normalizeRuntimeTruthSectionAssertions(runtimeTruth.eventReplay),
  ];
}

function buildRuntimeReplayCapabilityEvidence(sample) {
  const declaredCapabilities = ensureStringArray(sample?.sample?.capabilities);
  const runtimeTruth = isObjectRecord(sample?.runtimeTruth) ? sample.runtimeTruth : null;
  const taskAssertions = normalizeRuntimeTruthSectionAssertions(runtimeTruth?.taskFields);
  const reviewAssertions = normalizeRuntimeTruthSectionAssertions(runtimeTruth?.review);
  const autodriveAssertions = normalizeRuntimeTruthSectionAssertions(runtimeTruth?.autodrive);
  const eventReplayAssertions = normalizeRuntimeTruthSectionAssertions(runtimeTruth?.eventReplay);
  const inferredCapabilities = new Set();

  if (
    taskAssertions.length > 0 ||
    reviewAssertions.length > 0 ||
    autodriveAssertions.length > 0 ||
    eventReplayAssertions.length > 0
  ) {
    inferredCapabilities.add("runtime-truth");
  }
  if (taskAssertions.length > 0 || reviewAssertions.length > 0) {
    inferredCapabilities.add("continuity-handoff");
  }
  if (eventReplayAssertions.length > 0) {
    inferredCapabilities.add("event-replay-gap");
  }

  let hasPositiveAutodriveNavigation = false;
  let hasPositiveAutodriveEvaluationProfile = false;
  for (const assertion of autodriveAssertions) {
    if (assertion.type !== "assert-autodrive-trace") {
      continue;
    }
    if (
      assertion.decisionTraceMatcher === "present" ||
      assertion.autonomyStateMatcher === "present"
    ) {
      hasPositiveAutodriveNavigation = true;
    }
    if (
      assertion.runtimeScenarioProfileMatcher === "present" ||
      assertion.repoEvaluationProfileMatcher === "present" ||
      assertion.outcomeFeedbackMatcher === "present"
    ) {
      hasPositiveAutodriveEvaluationProfile = true;
    }
  }
  if (hasPositiveAutodriveNavigation) {
    inferredCapabilities.add("autodrive-navigation");
  }
  if (hasPositiveAutodriveEvaluationProfile) {
    inferredCapabilities.add("autodrive-evaluation-profile");
  }

  return {
    capabilityIds: [...new Set([...declaredCapabilities, ...inferredCapabilities])].sort(),
    declaredCapabilities,
    inferredCapabilities: [...inferredCapabilities].sort(),
    hasPositiveAutodriveNavigation,
    hasPositiveAutodriveEvaluationProfile,
  };
}

function resolveRuntimeReplaySampleCapabilities(sample) {
  return buildRuntimeReplayCapabilityEvidence(sample).capabilityIds;
}

function hasRecordedProviderReplay(sample) {
  const replay = sample?.result?.providerReplay;
  return Boolean(replay?.variantId) && ensureArray(replay?.turns).length > 0;
}

function hasRuntimeOnlyOperation(sample) {
  const runtimeOperation = sample?.input?.runtimeOperation;
  return (
    isObjectRecord(runtimeOperation) &&
    typeof runtimeOperation.type === "string" &&
    runtimeOperation.type.trim().length > 0
  );
}

export function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

export function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

export function resolveRuntimeReplayManifestPath(manifestPath = DEFAULT_MANIFEST_PATH) {
  return path.isAbsolute(manifestPath) ? manifestPath : path.resolve(REPO_ROOT, manifestPath);
}

export function resolveDatasetDirFromManifest(manifestPath) {
  return path.dirname(resolveRuntimeReplayManifestPath(manifestPath));
}

export function normalizeRuntimeReplayEndpoint(_value) {
  return "http://127.0.0.1:{runtimePort}/rpc";
}

export function normalizeRuntimeReplayWorkspaceId(_value) {
  return "workspace-web";
}

export function redactRuntimeReplayText(value) {
  if (typeof value !== "string" || value.length === 0) {
    return value;
  }

  return value
    .replaceAll(REPO_ROOT, "$REPO_ROOT")
    .replace(
      /\/Users\/[^/\s]+(?:\/[^\s]+)*?(\/(?:apps|packages|scripts|docs)\/[^\s]+)/gu,
      "$REPO_ROOT$1"
    )
    .replace(/http:\/\/127\.0\.0\.1:\d+\/rpc/gu, "http://127.0.0.1:{runtimePort}/rpc")
    .replace(/http:\/\/127\.0\.0\.1:\d+\/events/gu, "http://127.0.0.1:{runtimePort}/events")
    .replace(/ws:\/\/127\.0\.0\.1:\d+\/ws/gu, "ws://127.0.0.1:{runtimePort}/ws")
    .replace(/workspace-[A-Za-z0-9_-]+/gu, "workspace-web");
}

function walkStrings(value, visit) {
  if (typeof value === "string") {
    visit(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      walkStrings(entry, visit);
    }
    return;
  }
  if (value && typeof value === "object") {
    for (const entry of Object.values(value)) {
      walkStrings(entry, visit);
    }
  }
}

function replayTurnHasFailure(turn) {
  return typeof turn?.failure?.message === "string" && turn.failure.message.trim().length > 0;
}

function replayTurnOutcome(turn) {
  return replayTurnHasFailure(turn) ? "failed" : "completed";
}

function isWorkspaceFileContainsAssertion(assertion) {
  return assertion?.type === "workspace-file-contains";
}

function findWriteSafeWorkspaceAssertionGaps(sample) {
  const expectedWrites = ensureArray(sample.governance?.workspaceEffects?.expectedWrites);
  const harnessAssertions = ensureArray(sample.process?.harness?.assertions);
  return expectedWrites.filter((expectedWrite) => {
    if (
      typeof expectedWrite?.relativePath !== "string" ||
      expectedWrite.relativePath.trim().length === 0 ||
      typeof expectedWrite?.mustContain !== "string" ||
      expectedWrite.mustContain.trim().length === 0
    ) {
      return false;
    }
    return !harnessAssertions.some(
      (assertion) =>
        isWorkspaceFileContainsAssertion(assertion) &&
        assertion.relativePath === expectedWrite.relativePath &&
        assertion.text === expectedWrite.mustContain
    );
  });
}

function normalizeFailureClass(value) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function parseIsoTimestamp(value) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toCountRecord(entries) {
  return Object.fromEntries(
    [...entries.entries()].sort(([left], [right]) => left.localeCompare(right))
  );
}

function normalizeRuntimeReplayCoverageMatrix(manifest) {
  const coverageMatrix =
    manifest?.coverageMatrix && typeof manifest.coverageMatrix === "object"
      ? manifest.coverageMatrix
      : null;
  if (!coverageMatrix) {
    return null;
  }

  const modelProfiles = ensureArray(coverageMatrix.modelProfiles)
    .filter(
      (entry) =>
        entry &&
        typeof entry === "object" &&
        typeof entry.id === "string" &&
        entry.id.trim().length > 0 &&
        typeof entry.modelId === "string" &&
        entry.modelId.trim().length > 0
    )
    .map((entry) => ({
      id: entry.id.trim(),
      modelId: entry.modelId.trim(),
      family:
        typeof entry.family === "string" && entry.family.trim().length > 0
          ? entry.family.trim()
          : "unknown",
      coverageRole:
        typeof entry.coverageRole === "string" && entry.coverageRole.trim().length > 0
          ? entry.coverageRole.trim()
          : "supporting",
      reasoningEffort:
        typeof entry.reasoningEffort === "string" && entry.reasoningEffort.trim().length > 0
          ? entry.reasoningEffort.trim()
          : "unspecified",
      verbosity:
        typeof entry.verbosity === "string" && entry.verbosity.trim().length > 0
          ? entry.verbosity.trim()
          : "default",
      snapshotPinned: entry.snapshotPinned === true,
      status:
        typeof entry.status === "string" && entry.status.trim().length > 0
          ? entry.status.trim()
          : "active",
      notes:
        typeof entry.notes === "string" && entry.notes.trim().length > 0 ? entry.notes.trim() : "",
    }));

  const profileIdSet = new Set(modelProfiles.map((entry) => entry.id));
  const capabilityCatalog = ensureArray(coverageMatrix.capabilityCatalog)
    .filter(
      (entry) =>
        entry &&
        typeof entry === "object" &&
        typeof entry.id === "string" &&
        entry.id.trim().length > 0
    )
    .map((entry) => ({
      id: entry.id.trim(),
      status:
        typeof entry.status === "string" && entry.status.trim().length > 0
          ? entry.status.trim()
          : "implemented",
      notes:
        typeof entry.notes === "string" && entry.notes.trim().length > 0 ? entry.notes.trim() : "",
    }));
  const knownCapabilityIds = new Set(capabilityCatalog.map((entry) => entry.id));
  const scenarioRequirements = ensureArray(coverageMatrix.scenarioRequirements)
    .filter(
      (entry) =>
        entry &&
        typeof entry === "object" &&
        typeof entry.scenarioType === "string" &&
        entry.scenarioType.trim().length > 0
    )
    .map((entry) => ({
      scenarioType: entry.scenarioType.trim(),
      requiredProfiles: ensureArray(entry.requiredProfiles)
        .filter((value) => typeof value === "string" && value.trim().length > 0)
        .map((value) => value.trim())
        .filter((value) => profileIdSet.has(value)),
      notes:
        typeof entry.notes === "string" && entry.notes.trim().length > 0 ? entry.notes.trim() : "",
    }));
  const capabilityRequirements = ensureArray(coverageMatrix.capabilityRequirements)
    .filter(
      (entry) =>
        entry &&
        typeof entry === "object" &&
        typeof entry.capabilityId === "string" &&
        entry.capabilityId.trim().length > 0
    )
    .map((entry) => ({
      capabilityId: entry.capabilityId.trim(),
      requiredProfiles: ensureArray(entry.requiredProfiles)
        .filter((value) => typeof value === "string" && value.trim().length > 0)
        .map((value) => value.trim())
        .filter((value) => profileIdSet.has(value)),
      notes:
        typeof entry.notes === "string" && entry.notes.trim().length > 0 ? entry.notes.trim() : "",
      status:
        typeof entry.status === "string" && entry.status.trim().length > 0
          ? entry.status.trim()
          : "implemented",
    }))
    .map((entry) => {
      knownCapabilityIds.add(entry.capabilityId);
      return entry;
    });

  return {
    sources: ensureArray(coverageMatrix.sources)
      .filter((entry) => typeof entry === "string" && entry.trim().length > 0)
      .map((entry) => entry.trim()),
    modelProfiles,
    capabilityCatalog,
    capabilityRequirements,
    scenarioRequirements,
  };
}

function resolveRuntimeReplaySampleModelId(sample) {
  const candidateModelId =
    sample.input?.variant?.modelId ?? sample.result?.providerReplay?.modelId ?? null;
  return typeof candidateModelId === "string" && candidateModelId.trim().length > 0
    ? candidateModelId.trim()
    : null;
}

function resolveRuntimeReplaySampleReasonEffort(sample) {
  const candidateReasonEffort =
    sample.input?.variant?.reasonEffort ?? sample.result?.providerReplay?.reasonEffort ?? null;
  return typeof candidateReasonEffort === "string" && candidateReasonEffort.trim().length > 0
    ? candidateReasonEffort.trim()
    : null;
}

function buildRuntimeReplayCoverageMatrix({ dataset, selectedSamples }) {
  const coverageMatrix = normalizeRuntimeReplayCoverageMatrix(dataset.manifest);
  if (!coverageMatrix) {
    return null;
  }

  const selectedScenarioTypes = new Set(
    selectedSamples.map((entry) => entry.sample.sample?.scenarioType).filter(Boolean)
  );
  const includeAllScenarioRequirements = selectedSamples.length === dataset.samples.length;
  const relevantScenarioRequirements = coverageMatrix.scenarioRequirements.filter(
    (entry) => includeAllScenarioRequirements || selectedScenarioTypes.has(entry.scenarioType)
  );
  const profileByModelId = new Map(
    coverageMatrix.modelProfiles.map((entry) => [entry.modelId, entry])
  );
  const profileStatsMap = new Map(
    coverageMatrix.modelProfiles.map((entry) => [
      entry.id,
      {
        profileId: entry.id,
        modelId: entry.modelId,
        family: entry.family,
        coverageRole: entry.coverageRole,
        reasoningEffort: entry.reasoningEffort,
        verbosity: entry.verbosity,
        snapshotPinned: entry.snapshotPinned,
        status: entry.status,
        sampleCount: 0,
        capabilityIds: new Set(),
        scenarioTypes: new Set(),
        reasoningEfforts: new Set(),
      },
    ])
  );
  const scenarioCoverage = relevantScenarioRequirements.map((requirement) => {
    const scenarioSamples = selectedSamples.filter(
      (entry) => entry.sample.sample?.scenarioType === requirement.scenarioType
    );
    const coveredProfiles = new Set();
    const observedReasoningEfforts = new Set();
    const sampleIds = [];

    for (const entry of scenarioSamples) {
      const sample = entry.sample;
      const modelId = resolveRuntimeReplaySampleModelId(sample);
      const profile = modelId ? (profileByModelId.get(modelId) ?? null) : null;
      const reasonEffort = resolveRuntimeReplaySampleReasonEffort(sample);
      sampleIds.push(sample.sample.id);
      if (reasonEffort) {
        observedReasoningEfforts.add(reasonEffort);
      }
      if (!profile) {
        continue;
      }
      coveredProfiles.add(profile.id);
      const profileStats = profileStatsMap.get(profile.id);
      profileStats.sampleCount += 1;
      profileStats.scenarioTypes.add(requirement.scenarioType);
      if (reasonEffort) {
        profileStats.reasoningEfforts.add(reasonEffort);
      }
    }

    const missingProfiles = requirement.requiredProfiles.filter((id) => !coveredProfiles.has(id));
    return {
      scenarioType: requirement.scenarioType,
      requiredProfiles: [...requirement.requiredProfiles].sort(),
      coveredProfiles: [...coveredProfiles].sort(),
      missingProfiles,
      sampleIds: sampleIds.sort(),
      observedReasoningEfforts: [...observedReasoningEfforts].sort(),
      coverageStatus: missingProfiles.length === 0 ? "complete" : "incomplete",
      notes: requirement.notes,
    };
  });
  const selectedCapabilityIds = new Set(
    selectedSamples.flatMap((entry) => resolveRuntimeReplaySampleCapabilities(entry.sample))
  );
  const includeAllCapabilities =
    selectedSamples.length === dataset.samples.length || selectedCapabilityIds.size === 0;
  const capabilityRequirementById = new Map(
    coverageMatrix.capabilityRequirements.map((entry) => [entry.capabilityId, entry])
  );
  const relevantCapabilityCatalog = coverageMatrix.capabilityCatalog.filter(
    (entry) =>
      includeAllCapabilities ||
      selectedCapabilityIds.has(entry.id) ||
      capabilityRequirementById.has(entry.id)
  );
  const capabilityCoverage = relevantCapabilityCatalog.map((catalogEntry) => {
    const requirement = capabilityRequirementById.get(catalogEntry.id) ?? null;
    const capabilitySamples = selectedSamples.filter((entry) =>
      resolveRuntimeReplaySampleCapabilities(entry.sample).includes(catalogEntry.id)
    );
    const coveredProfiles = new Set();
    const sampleIds = [];

    for (const entry of capabilitySamples) {
      const sample = entry.sample;
      const modelId = resolveRuntimeReplaySampleModelId(sample);
      const profile = modelId ? (profileByModelId.get(modelId) ?? null) : null;
      sampleIds.push(sample.sample.id);
      if (!profile) {
        continue;
      }
      coveredProfiles.add(profile.id);
      const profileStats = profileStatsMap.get(profile.id);
      profileStats.capabilityIds.add(catalogEntry.id);
    }

    const requiredProfiles = requirement?.requiredProfiles ?? [];
    const missingProfiles = requiredProfiles.filter((id) => !coveredProfiles.has(id));
    return {
      capabilityId: catalogEntry.id,
      requiredProfiles: [...requiredProfiles].sort(),
      coveredProfiles: [...coveredProfiles].sort(),
      missingProfiles,
      sampleIds: sampleIds.sort(),
      coverageStatus:
        coveredProfiles.size === 0
          ? "uncovered"
          : missingProfiles.length === 0
            ? "complete"
            : "incomplete",
      notes: requirement?.notes || catalogEntry.notes,
      status: catalogEntry.status,
    };
  });
  const capabilityDebt = capabilityCoverage
    .flatMap((entry) => {
      if (entry.status === "planned" && entry.coveredProfiles.length > 0) {
        return [
          {
            capabilityId: entry.capabilityId,
            debtType: "planned-with-coverage",
            status: entry.status,
            coveredProfiles: entry.coveredProfiles,
            sampleIds: entry.sampleIds,
          },
        ];
      }
      if (entry.status === "planned") {
        return [
          {
            capabilityId: entry.capabilityId,
            debtType: "planned-without-coverage",
            status: entry.status,
            coveredProfiles: entry.coveredProfiles,
            sampleIds: entry.sampleIds,
          },
        ];
      }
      if (entry.status === "implemented" && entry.coveredProfiles.length === 0) {
        return [
          {
            capabilityId: entry.capabilityId,
            debtType: "implemented-without-coverage",
            status: entry.status,
            coveredProfiles: entry.coveredProfiles,
            sampleIds: entry.sampleIds,
          },
        ];
      }
      return [];
    })
    .sort((left, right) => left.capabilityId.localeCompare(right.capabilityId));

  const gaps = [
    ...scenarioCoverage.flatMap((entry) =>
      entry.missingProfiles.map((profileId) => ({
        scenarioType: entry.scenarioType,
        profileId,
        type: "missing_model_profile",
      }))
    ),
    ...capabilityCoverage.flatMap((entry) =>
      entry.missingProfiles.map((profileId) => ({
        capabilityId: entry.capabilityId,
        profileId,
        type: "missing_capability_profile",
      }))
    ),
  ];

  return {
    configuredProfileCount: coverageMatrix.modelProfiles.length,
    sources: coverageMatrix.sources,
    profiles: coverageMatrix.modelProfiles.map((entry) => ({
      id: entry.id,
      modelId: entry.modelId,
      family: entry.family,
      coverageRole: entry.coverageRole,
      reasoningEffort: entry.reasoningEffort,
      verbosity: entry.verbosity,
      snapshotPinned: entry.snapshotPinned,
      status: entry.status,
      notes: entry.notes,
      sampleCount: profileStatsMap.get(entry.id)?.sampleCount ?? 0,
      capabilityIds: [...(profileStatsMap.get(entry.id)?.capabilityIds ?? new Set())].sort(),
      scenarioTypes: [...(profileStatsMap.get(entry.id)?.scenarioTypes ?? new Set())].sort(),
      reasoningEfforts: [...(profileStatsMap.get(entry.id)?.reasoningEfforts ?? new Set())].sort(),
    })),
    capabilityCatalog: coverageMatrix.capabilityCatalog,
    capabilityCoverage,
    capabilityDebt,
    scenarioCoverage,
    gaps,
    gapCount: gaps.length,
  };
}

export function resolveRuntimeReplayFailureClass(failure) {
  const explicit = normalizeFailureClass(failure?.class);
  if (explicit) {
    return explicit;
  }
  const normalizedCode = String(failure?.code ?? "")
    .trim()
    .toLowerCase();
  const normalizedMessage = String(failure?.message ?? "")
    .trim()
    .toLowerCase();
  const detail = `${normalizedCode} ${normalizedMessage}`;
  if (
    detail.includes("runtime.turn.provider.stream_read_failed") ||
    detail.includes("failed to read chatgpt codex response stream") ||
    detail.includes("error decoding response body")
  ) {
    return "provider.stream-interrupted";
  }
  if (
    detail.includes("runtime.turn.provider.rejected") ||
    detail.includes("provider rejected") ||
    detail.includes("rejected by provider")
  ) {
    return "provider.rejected";
  }
  if (detail.includes("request failed") || detail.includes("error sending request")) {
    return "provider.request-failed";
  }
  return replayTurnHasFailure({ failure }) ? "provider.unknown" : null;
}

export function deriveRuntimeReplayRerecordStability(expectedFailureClasses, lastRun) {
  const expectedClasses = ensureArray(expectedFailureClasses);
  if (!lastRun || typeof lastRun !== "object") {
    return {
      status: "missing",
      stable: false,
      compatibleWithExpectedFailureClass: null,
      observedFailureClasses: [],
      driftObserved: false,
      lastCheckedAt: null,
    };
  }

  const observedFailureClasses = ensureArray(lastRun.observedFailureClasses);
  const compatibleWithExpectedFailureClass =
    observedFailureClasses.length > 0 &&
    expectedClasses.length > 0 &&
    observedFailureClasses.every((entry) => expectedClasses.includes(entry));

  let status = "stable-incompatible";
  if (observedFailureClasses.length === 0) {
    status = "no-failure-class";
  } else if (lastRun.driftObserved) {
    status = "drifting";
  } else if (lastRun.stable === true && compatibleWithExpectedFailureClass) {
    status = "stable-compatible";
  }

  return {
    status,
    stable: lastRun.stable === true,
    compatibleWithExpectedFailureClass,
    observedFailureClasses,
    driftObserved: lastRun.driftObserved === true,
    lastCheckedAt: typeof lastRun.recordedAt === "string" ? lastRun.recordedAt : null,
  };
}

export function deriveRuntimeReplayGovernanceGoldenBlockers(sample) {
  const replayTurns = ensureArray(sample.result?.providerReplay?.turns);
  const turnSources = replayTurns.map((turn) => turn?.provenance?.source ?? "unknown");
  const expectsRecovery = sample.process?.errorRecovery?.expected === true;
  const expectedFailureClasses = ensureArray(sample.process?.errorRecovery?.expectedFailureClasses);
  const blockers = ensureArray(sample.governance?.manualGoldenBlockers).filter(
    (entry) => typeof entry === "string" && entry.trim().length > 0
  );

  if (turnSources.some((source) => source === "controlled-synthetic")) {
    blockers.push("failure_leg_not_fully_recorded", "evidence_not_fully_recorded");
  }

  if (expectsRecovery) {
    const rerecordStability = deriveRuntimeReplayRerecordStability(
      expectedFailureClasses,
      sample.governance?.liveFailureProbe?.lastRun
    );
    if (rerecordStability.status === "drifting") {
      blockers.push("live_failure_class_drift_observed");
    } else if (rerecordStability.status === "missing") {
      blockers.push("live_failure_probe_missing");
    } else if (rerecordStability.status !== "stable-compatible") {
      blockers.push("live_failure_class_incompatible");
    }
  }

  if (
    sample.sample?.scenarioType === "write-safe-minimal" &&
    findWriteSafeWorkspaceAssertionGaps(sample).length > 0
  ) {
    blockers.push("workspace_effects_not_replayed");
  }

  return [...new Set(blockers)];
}

export function updateRuntimeReplayGoldenBlockerHistory(
  existingHistory,
  observedBlockers,
  observedAt
) {
  const observedAtIso =
    typeof observedAt === "string" && observedAt.trim().length > 0
      ? observedAt
      : new Date().toISOString();
  const observedSet = new Set(
    ensureArray(observedBlockers).filter(
      (entry) => typeof entry === "string" && entry.trim().length > 0
    )
  );
  const historyMap = new Map(
    ensureArray(existingHistory)
      .filter((entry) => entry && typeof entry === "object" && typeof entry.blocker === "string")
      .map((entry) => [entry.blocker, { ...entry }])
  );

  for (const blocker of observedSet) {
    const previous = historyMap.get(blocker);
    if (!previous) {
      historyMap.set(blocker, {
        blocker,
        active: true,
        firstObservedAt: observedAtIso,
        lastObservedAt: observedAtIso,
        observationCount: 1,
      });
      continue;
    }
    const stillActive = previous.active === true;
    historyMap.set(blocker, {
      blocker,
      active: true,
      firstObservedAt:
        stillActive && typeof previous.firstObservedAt === "string"
          ? previous.firstObservedAt
          : observedAtIso,
      lastObservedAt: observedAtIso,
      observationCount:
        typeof previous.observationCount === "number" && Number.isFinite(previous.observationCount)
          ? previous.observationCount + 1
          : 1,
    });
  }

  for (const [blocker, previous] of historyMap.entries()) {
    if (observedSet.has(blocker)) {
      continue;
    }
    historyMap.set(blocker, {
      ...previous,
      blocker,
      active: false,
      lastObservedAt: observedAtIso,
      lastClearedAt: observedAtIso,
    });
  }

  return [...historyMap.values()].sort((left, right) => left.blocker.localeCompare(right.blocker));
}

function summarizeRuntimeReplayBlockerDwell(sample, nowMs = Date.now()) {
  const blockers = deriveRuntimeReplayGovernanceGoldenBlockers(sample);
  const historyMap = new Map(
    ensureArray(sample.governance?.goldenBlockerHistory)
      .filter((entry) => entry && typeof entry === "object" && typeof entry.blocker === "string")
      .map((entry) => [entry.blocker, entry])
  );
  const fallbackObservedAt =
    sample.governance?.rerecordStability?.lastCheckedAt ?? sample.sample?.recordedAt ?? null;
  const blockerEntries = blockers.map((blocker) => {
    const history = historyMap.get(blocker);
    const firstObservedAt =
      history?.active === true && typeof history.firstObservedAt === "string"
        ? history.firstObservedAt
        : fallbackObservedAt;
    const firstObservedMs = parseIsoTimestamp(firstObservedAt);
    return {
      blocker,
      firstObservedAt,
      dwellMs: firstObservedMs === null ? null : Math.max(0, nowMs - firstObservedMs),
    };
  });
  const maxDwellMs = blockerEntries.reduce(
    (max, entry) =>
      typeof entry.dwellMs === "number" && entry.dwellMs > max ? entry.dwellMs : max,
    0
  );
  const oldestEntry = blockerEntries
    .filter((entry) => typeof entry.dwellMs === "number")
    .sort((left, right) => right.dwellMs - left.dwellMs)[0];

  return {
    blockerCount: blockerEntries.length,
    oldestFirstObservedAt: oldestEntry?.firstObservedAt ?? null,
    maxDwellMs,
    blockers: blockerEntries,
  };
}

function summarizeRuntimeReplayRerecordSuccessRate(sample) {
  const attemptRecords = ensureArray(sample.governance?.liveFailureProbe?.lastRun?.attemptRecords);
  const expectedFailureClasses = ensureArray(sample.process?.errorRecovery?.expectedFailureClasses);
  if (attemptRecords.length > 0 && expectedFailureClasses.length > 0) {
    const successfulAttempts = attemptRecords.filter(
      (entry) =>
        entry?.outcome === "failed" &&
        typeof entry.failureClass === "string" &&
        expectedFailureClasses.includes(entry.failureClass)
    ).length;
    return {
      source: "live-failure-probe",
      totalAttempts: attemptRecords.length,
      successfulAttempts,
      rate: successfulAttempts / attemptRecords.length,
    };
  }
  const hasRecordedAt = typeof sample.sample?.recordedAt === "string";
  return {
    source: "sample-recorded-at",
    totalAttempts: hasRecordedAt ? 1 : 0,
    successfulAttempts: hasRecordedAt ? 1 : 0,
    rate: hasRecordedAt ? 1 : null,
  };
}

function summarizeRuntimeReplaySampleMetrics(sample, nowMs = Date.now()) {
  const recordedAtMs = parseIsoTimestamp(sample.sample?.recordedAt);
  return {
    lastVerifiedAt: sample.sample?.recordedAt ?? null,
    sampleAgeMs: recordedAtMs === null ? null : Math.max(0, nowMs - recordedAtMs),
    rerecordSuccessRate: summarizeRuntimeReplayRerecordSuccessRate(sample),
    blockerDwellTime: summarizeRuntimeReplayBlockerDwell(sample, nowMs),
  };
}

function deriveRuntimeReplayScenarioCoverageTier(sampleCount) {
  if (sampleCount >= 3) {
    return "family";
  }
  if (sampleCount === 2) {
    return "baseline-plus-variant";
  }
  if (sampleCount === 1) {
    return "baseline-only";
  }
  return "missing";
}

function buildRuntimeReplayScenarioGapSignals({
  sampleCount,
  goldenCount,
  rerecordRate,
  maxBlockerDwellMs,
}) {
  const gapSignals = [];
  if (sampleCount === 0) {
    gapSignals.push("needs_first_sample");
    return gapSignals;
  }
  if (sampleCount < 2) {
    gapSignals.push("needs_variant");
  }
  if (goldenCount === 0) {
    gapSignals.push("no_golden_baseline");
  }
  if (typeof rerecordRate === "number" && rerecordRate < 0.75) {
    gapSignals.push("rerecord_instability");
  }
  if (typeof maxBlockerDwellMs === "number" && maxBlockerDwellMs > 0) {
    gapSignals.push("blocker_backlog");
  }
  return gapSignals;
}

function scoreRuntimeReplayScenarioPriority(gapSignals) {
  return gapSignals.reduce((score, signal) => {
    switch (signal) {
      case "needs_first_sample":
        return score + 100;
      case "needs_variant":
        return score + 35;
      case "no_golden_baseline":
        return score + 30;
      case "rerecord_instability":
        return score + 20;
      case "blocker_backlog":
        return score + 15;
      default:
        return score;
    }
  }, 0);
}

function summarizeRuntimeReplayPromotionReadiness(item) {
  const blockerCount = item.metrics.blockerDwellTime.blockerCount;
  const evidenceMode = item.entry.sample.sample?.source ?? "unknown";
  const rerecordRate = item.metrics.rerecordSuccessRate.rate;
  const reasons = [];
  let score = 100;

  if (evidenceMode === "recorded") {
    reasons.push("recorded_evidence");
  } else {
    reasons.push("mixed_evidence");
    score -= 20;
  }

  if (blockerCount === 1) {
    reasons.push("single_manual_blocker");
  } else if (blockerCount > 1) {
    reasons.push("multiple_blockers");
  } else {
    reasons.push("no_blockers");
  }
  score -= blockerCount * 20;

  if (typeof rerecordRate === "number" && rerecordRate >= 0.75) {
    reasons.push("rerecord_stable");
  } else if (typeof rerecordRate === "number") {
    reasons.push("rerecord_unstable");
    score -= 15;
  } else {
    reasons.push("rerecord_unknown");
    score -= 10;
  }

  return {
    ready: blockerCount === 0,
    score: Math.max(0, score),
    reasons,
  };
}

function normalizeRuntimeReplayDeterministicRegressions(sample) {
  return ensureArray(sample.governance?.deterministicRegressions)
    .filter((entry) => entry && typeof entry === "object")
    .filter(
      (entry) =>
        typeof entry.id === "string" &&
        entry.id.trim().length > 0 &&
        typeof entry.layer === "string" &&
        entry.layer.trim().length > 0 &&
        typeof entry.path === "string" &&
        entry.path.trim().length > 0 &&
        typeof entry.testName === "string" &&
        entry.testName.trim().length > 0
    )
    .map((entry) => ({
      id: entry.id.trim(),
      layer: entry.layer.trim(),
      path: entry.path.trim(),
      testName: entry.testName.trim(),
      status:
        typeof entry.status === "string" && entry.status.trim().length > 0
          ? entry.status.trim()
          : "active",
    }));
}

function normalizeRuntimeReplayOptimizationSignals(sample) {
  const signals = sample.governance?.optimizationSignals;
  if (!signals || typeof signals !== "object") {
    return null;
  }
  const recommendedLevers = ensureArray(signals.recommendedLevers).filter(
    (entry) => typeof entry === "string" && entry.trim().length > 0
  );
  const lineage =
    signals.lineage && typeof signals.lineage === "object"
      ? {
          parentSampleId:
            typeof signals.lineage.parentSampleId === "string" &&
            signals.lineage.parentSampleId.trim().length > 0
              ? signals.lineage.parentSampleId.trim()
              : null,
          strategy:
            typeof signals.lineage.strategy === "string" &&
            signals.lineage.strategy.trim().length > 0
              ? signals.lineage.strategy.trim()
              : null,
        }
      : null;
  return {
    seedSource:
      typeof signals.seedSource === "string" && signals.seedSource.trim().length > 0
        ? signals.seedSource.trim()
        : null,
    incubationTrack:
      typeof signals.incubationTrack === "string" && signals.incubationTrack.trim().length > 0
        ? signals.incubationTrack.trim()
        : null,
    recommendedLevers,
    safeBackgroundCandidate: signals.safeBackgroundCandidate === true,
    lineage: lineage?.parentSampleId && lineage?.strategy ? lineage : null,
  };
}

function collectRuntimeReplayGoldenBlockers(sample) {
  return [
    ...new Set([
      ...ensureArray(sample.governance?.goldenBlockers),
      ...deriveRuntimeReplayGovernanceGoldenBlockers(sample),
    ]),
  ].filter((entry) => typeof entry === "string" && entry.trim().length > 0);
}

function assessRuntimeReplayBackgroundReadyCandidate(sample) {
  const meta = sample.sample ?? {};
  const optimizationSignals = normalizeRuntimeReplayOptimizationSignals(sample);
  const deterministicRegressions = normalizeRuntimeReplayDeterministicRegressions(sample);
  const accessMode = sample.input?.runtimeConfig?.accessMode ?? null;
  const replayAccessMode = sample.result?.providerReplay?.recordingAccessMode ?? null;
  const provenanceAccessModes = ensureArray(sample.result?.providerReplay?.turns)
    .map((turn) => turn?.provenance?.recordedAccessMode ?? null)
    .filter((entry) => typeof entry === "string" && entry.trim().length > 0);
  const queueProfile = BACKGROUND_READY_QUEUE_PROFILES[meta.scenarioType] ?? null;
  const selectionReasons = [];
  const exclusionReasons = [];
  const gaps = [];
  const blockers = collectRuntimeReplayGoldenBlockers(sample);
  const evidenceSources = ensureArray(sample.result?.providerReplay?.turns).map(
    (turn) => turn?.provenance?.source ?? "unknown"
  );
  const hasNonRecordedTurnSources = evidenceSources.some((source) => source !== "recorded");
  const isRecoverySample = sample.process?.errorRecovery?.expected === true;
  const isWritePathSample =
    meta.scenarioType === "write-safe-minimal" || accessMode === "full-access";
  const scenarioAllowed = BACKGROUND_READY_SCENARIO_ALLOWLIST.has(meta.scenarioType);

  if (optimizationSignals?.safeBackgroundCandidate === true) {
    selectionReasons.push("declared_safe_background_candidate");
  } else {
    exclusionReasons.push("safe_background_not_declared");
  }

  if (meta.stability === "golden") {
    selectionReasons.push("stability_golden");
  } else {
    exclusionReasons.push("stability_not_golden");
  }

  if (meta.source === "recorded") {
    selectionReasons.push("source_recorded");
  } else {
    exclusionReasons.push("source_not_recorded");
  }

  if (scenarioAllowed) {
    selectionReasons.push("scenario_allowlisted");
  } else {
    exclusionReasons.push("scenario_type_not_allowed");
  }

  if (meta.scenarioType === "read-only") {
    const readOnlyAccessConfirmed =
      accessMode === "read-only" &&
      replayAccessMode === "read-only" &&
      provenanceAccessModes.every((entry) => entry === "read-only");
    if (readOnlyAccessConfirmed) {
      selectionReasons.push("read_only_access_mode_confirmed");
    } else {
      exclusionReasons.push("read_only_access_mode_required");
    }
  }

  if (isRecoverySample) {
    exclusionReasons.push("recovery_path_not_allowed");
  }

  if (isWritePathSample) {
    exclusionReasons.push("write_path_not_allowed");
  }

  if (hasNonRecordedTurnSources || meta.source === "mixed") {
    exclusionReasons.push("mixed_evidence_not_allowed");
  }

  if (blockers.length > 0) {
    exclusionReasons.push("active_golden_blockers");
  } else {
    selectionReasons.push("no_active_golden_blockers");
  }

  if (!queueProfile && scenarioAllowed) {
    exclusionReasons.push("queue_profile_unconfigured");
  }

  if (deterministicRegressions.length === 0) {
    gaps.push("missing_deterministic_regression");
  }

  return {
    eligible: exclusionReasons.length === 0,
    queueProfile,
    accessMode,
    selectionReasons: [...new Set(selectionReasons)],
    exclusionReasons: [...new Set(exclusionReasons)],
    gaps,
    blockers,
    optimizationSignals,
    deterministicRegressions,
  };
}

export function buildRuntimeReplayBackgroundReadyQueue(selectedSamples) {
  const selected = [];
  const excluded = [];

  for (const entry of selectedSamples) {
    const sample = entry.sample;
    const assessment = assessRuntimeReplayBackgroundReadyCandidate(sample);
    const target = assessment.eligible ? selected : excluded;
    target.push({
      id: sample.sample.id,
      scenarioType: sample.sample.scenarioType,
      stability: sample.sample.stability,
      source: sample.sample.source,
      queueProfile: assessment.queueProfile,
      accessMode: assessment.accessMode,
      selectionReasons: assessment.eligible ? assessment.selectionReasons : [],
      exclusionReasons: assessment.eligible ? [] : assessment.exclusionReasons,
      blockers: assessment.blockers,
      gaps: assessment.gaps,
    });
  }

  selected.sort((left, right) => left.id.localeCompare(right.id));
  excluded.sort((left, right) => left.id.localeCompare(right.id));

  return {
    generatedAt: new Date().toISOString(),
    allowlist: [...BACKGROUND_READY_SCENARIO_ALLOWLIST].sort(),
    selectedCount: selected.length,
    selected,
    excluded,
    summary: {
      selectedIds: selected.map((entry) => entry.id),
      excludedCount: excluded.length,
      queueProfiles: toCountRecord(
        new Map(
          selected.reduce((entries, entry) => {
            entries.set(entry.queueProfile, (entries.get(entry.queueProfile) ?? 0) + 1);
            return entries;
          }, new Map())
        )
      ),
      samplesMissingRegressionGate: selected
        .filter((entry) => entry.gaps.includes("missing_deterministic_regression"))
        .map((entry) => entry.id),
    },
  };
}

export function buildRuntimeReplayLineageGraph({ dataset, selectedSamples }) {
  const datasetSampleMap = new Map(
    dataset.samples.map((entry) => [entry.sample.sample.id, entry.sample])
  );
  const explicitLineageSamples = [];
  const lineageRelevantIds = new Set();

  for (const entry of selectedSamples) {
    const sample = entry.sample;
    const optimizationSignals = normalizeRuntimeReplayOptimizationSignals(sample);
    if (!optimizationSignals?.lineage) {
      continue;
    }
    explicitLineageSamples.push(sample);
    lineageRelevantIds.add(sample.sample.id);
    lineageRelevantIds.add(optimizationSignals.lineage.parentSampleId);
  }

  const nodes = [];
  const edges = [];
  const unresolved = [];
  const blocked = [];
  const nodeIds = new Set();
  const edgeIds = new Set();
  const seedCounts = new Map();
  const incubationTrackCounts = new Map();
  const strategyCounts = new Map();

  function pushNode(node) {
    if (nodeIds.has(node.id)) {
      return;
    }
    nodeIds.add(node.id);
    nodes.push(node);
  }

  function pushEdge(edge) {
    if (edgeIds.has(edge.id)) {
      return;
    }
    edgeIds.add(edge.id);
    edges.push(edge);
  }

  for (const sampleId of [...lineageRelevantIds].sort()) {
    const sample = datasetSampleMap.get(sampleId);
    if (!sample) {
      unresolved.push({
        type: "missing-sample",
        sampleId,
      });
      continue;
    }
    const optimizationSignals = normalizeRuntimeReplayOptimizationSignals(sample);
    const assessment = assessRuntimeReplayBackgroundReadyCandidate(sample);
    const blockers = collectRuntimeReplayGoldenBlockers(sample);
    pushNode({
      id: `sample:${sample.sample.id}`,
      type: "sample",
      sampleId: sample.sample.id,
      scenarioType: sample.sample.scenarioType,
      stability: sample.sample.stability,
      source: sample.sample.source,
      seedSource: optimizationSignals?.seedSource ?? null,
      incubationTrack: optimizationSignals?.incubationTrack ?? null,
      recommendedLevers: optimizationSignals?.recommendedLevers ?? [],
      backgroundReady: assessment.eligible,
      backgroundReadyQueueProfile: assessment.queueProfile,
      goldenBlockers: blockers,
    });

    if (optimizationSignals?.seedSource) {
      const seedNodeId = `seed:${optimizationSignals.seedSource}`;
      pushNode({
        id: seedNodeId,
        type: "seed",
        seedSource: optimizationSignals.seedSource,
      });
      pushEdge({
        id: `seeded-by:${sample.sample.id}:${optimizationSignals.seedSource}`,
        type: "seeded-by",
        from: `sample:${sample.sample.id}`,
        to: seedNodeId,
        origin: "governance.optimizationSignals.seedSource",
        evidence: {
          seedSource: optimizationSignals.seedSource,
        },
      });
      seedCounts.set(
        optimizationSignals.seedSource,
        (seedCounts.get(optimizationSignals.seedSource) ?? 0) + 1
      );
    }

    if (optimizationSignals?.incubationTrack) {
      incubationTrackCounts.set(
        optimizationSignals.incubationTrack,
        (incubationTrackCounts.get(optimizationSignals.incubationTrack) ?? 0) + 1
      );
    }

    for (const regression of normalizeRuntimeReplayDeterministicRegressions(sample)) {
      const regressionNodeId = `regression:${regression.id}`;
      pushNode({
        id: regressionNodeId,
        type: "regression",
        regressionId: regression.id,
        layer: regression.layer,
        path: regression.path,
        testName: regression.testName,
        status: regression.status,
      });
      pushEdge({
        id: `linked-regression:${sample.sample.id}:${regression.id}`,
        type: "linked-regression",
        from: `sample:${sample.sample.id}`,
        to: regressionNodeId,
        origin: "governance.deterministicRegressions",
        evidence: {
          layer: regression.layer,
          path: regression.path,
          testName: regression.testName,
        },
      });
    }
  }

  for (const sample of explicitLineageSamples) {
    const optimizationSignals = normalizeRuntimeReplayOptimizationSignals(sample);
    const parentSampleId = optimizationSignals?.lineage?.parentSampleId;
    if (!parentSampleId || !datasetSampleMap.has(parentSampleId)) {
      unresolved.push({
        type: "missing-parent",
        sampleId: sample.sample.id,
        parentSampleId,
      });
      continue;
    }
    const strategy = optimizationSignals.lineage.strategy;
    pushEdge({
      id: `derived-from:${sample.sample.id}:${parentSampleId}`,
      type: "derived-from",
      from: `sample:${sample.sample.id}`,
      to: `sample:${parentSampleId}`,
      origin: "governance.optimizationSignals.lineage",
      evidence: {
        strategy,
      },
    });
    strategyCounts.set(strategy, (strategyCounts.get(strategy) ?? 0) + 1);

    const blockers = collectRuntimeReplayGoldenBlockers(sample);
    if (blockers.length > 0) {
      blocked.push({
        sampleId: sample.sample.id,
        parentSampleId,
        blockers,
        reason: "active_golden_blockers",
      });
    }
  }

  nodes.sort((left, right) => left.id.localeCompare(right.id));
  edges.sort((left, right) => left.id.localeCompare(right.id));
  blocked.sort((left, right) => left.sampleId.localeCompare(right.sampleId));
  unresolved.sort((left, right) =>
    `${left.sampleId ?? ""}:${left.parentSampleId ?? ""}`.localeCompare(
      `${right.sampleId ?? ""}:${right.parentSampleId ?? ""}`
    )
  );

  const nodeCounts = new Map();
  const edgeCounts = new Map();
  for (const node of nodes) {
    nodeCounts.set(node.type, (nodeCounts.get(node.type) ?? 0) + 1);
  }
  for (const edge of edges) {
    edgeCounts.set(edge.type, (edgeCounts.get(edge.type) ?? 0) + 1);
  }

  return {
    generatedAt: new Date().toISOString(),
    datasetId: dataset.manifest.datasetId,
    selection: [...lineageRelevantIds].sort(),
    nodes,
    edges,
    blocked,
    unresolved,
    summary: {
      sampleIds: [...lineageRelevantIds].sort(),
      nodeCounts: toCountRecord(nodeCounts),
      edgeCounts: toCountRecord(edgeCounts),
      seedSourceCounts: toCountRecord(seedCounts),
      incubationTrackCounts: toCountRecord(incubationTrackCounts),
      lineageStrategyCounts: toCountRecord(strategyCounts),
      unresolvedCount: unresolved.length,
      blockedCount: blocked.length,
    },
  };
}

function summarizeRuntimeReplayEvolutionSignals(selectedSamples) {
  const seedSourceCounts = new Map();
  const incubationTrackCounts = new Map();
  const recommendedLeverCounts = new Map();
  const backgroundReadyQueue = buildRuntimeReplayBackgroundReadyQueue(selectedSamples);
  const lineageLinks = [];

  for (const entry of selectedSamples) {
    const sample = entry.sample;
    const optimizationSignals = normalizeRuntimeReplayOptimizationSignals(sample);
    if (!optimizationSignals) {
      continue;
    }
    if (optimizationSignals.seedSource) {
      seedSourceCounts.set(
        optimizationSignals.seedSource,
        (seedSourceCounts.get(optimizationSignals.seedSource) ?? 0) + 1
      );
    }
    if (optimizationSignals.incubationTrack) {
      incubationTrackCounts.set(
        optimizationSignals.incubationTrack,
        (incubationTrackCounts.get(optimizationSignals.incubationTrack) ?? 0) + 1
      );
    }
    for (const lever of optimizationSignals.recommendedLevers) {
      recommendedLeverCounts.set(lever, (recommendedLeverCounts.get(lever) ?? 0) + 1);
    }
    if (optimizationSignals.lineage) {
      lineageLinks.push({
        id: sample.sample.id,
        parentSampleId: optimizationSignals.lineage.parentSampleId,
        strategy: optimizationSignals.lineage.strategy,
      });
    }
  }

  lineageLinks.sort((left, right) => left.id.localeCompare(right.id));

  return {
    seedSourceCounts: toCountRecord(seedSourceCounts),
    incubationTrackCounts: toCountRecord(incubationTrackCounts),
    recommendedLeverCounts: toCountRecord(recommendedLeverCounts),
    safeBackgroundCandidateCount: backgroundReadyQueue.selectedCount,
    safeBackgroundQueue: backgroundReadyQueue.selected,
    lineageLinks,
  };
}

function summarizeRuntimeReplayRegressionCoverage(
  selectedSamples,
  scenarioStats,
  nowMs = Date.now()
) {
  const byLayer = new Map();
  const scenarioPriorityMap = new Map(
    ensureArray(scenarioStats?.scenarioPriorityQueue).map((entry) => [
      entry.scenarioType,
      entry.priorityScore ?? 0,
    ])
  );
  let samplesWithLinkedRegressions = 0;
  const regressionBacklog = [];

  for (const entry of selectedSamples) {
    const sample = entry.sample;
    const regressions = normalizeRuntimeReplayDeterministicRegressions(sample);
    if (regressions.length > 0) {
      samplesWithLinkedRegressions += 1;
      for (const regression of regressions) {
        byLayer.set(regression.layer, (byLayer.get(regression.layer) ?? 0) + 1);
      }
      continue;
    }

    const metrics = summarizeRuntimeReplaySampleMetrics(sample, nowMs);
    regressionBacklog.push({
      id: sample.sample.id,
      scenarioType: sample.sample.scenarioType,
      stability: sample.sample.stability,
      blockerCount: metrics.blockerDwellTime.blockerCount,
      priorityScore: scenarioPriorityMap.get(sample.sample.scenarioType) ?? 0,
    });
  }

  regressionBacklog.sort((left, right) => {
    const leftCandidate = left.stability === "golden" ? 0 : 1;
    const rightCandidate = right.stability === "golden" ? 0 : 1;
    if (leftCandidate !== rightCandidate) {
      return rightCandidate - leftCandidate;
    }
    if (left.priorityScore !== right.priorityScore) {
      return right.priorityScore - left.priorityScore;
    }
    if (left.blockerCount !== right.blockerCount) {
      return right.blockerCount - left.blockerCount;
    }
    return left.id.localeCompare(right.id);
  });

  const baselineSamples = selectedSamples.filter(
    (entry) => entry.sample.sample?.stability === "golden"
  );
  const fullyGatedBaselineCount = baselineSamples.filter(
    (entry) => normalizeRuntimeReplayDeterministicRegressions(entry.sample).length > 0
  ).length;

  return {
    samplesWithLinkedRegressions,
    samplesWithoutLinkedRegressions: selectedSamples.length - samplesWithLinkedRegressions,
    byLayer: toCountRecord(byLayer),
    regressionBacklog,
    baselineSampleCount: baselineSamples.length,
    fullyGatedBaselineCount,
    baselineBacklogCount: baselineSamples.length - fullyGatedBaselineCount,
    baselineClosureStatus:
      baselineSamples.length - fullyGatedBaselineCount === 0 ? "complete" : "incomplete",
  };
}

function summarizeRuntimeReplayBaselineReadiness(sample, backgroundReadyEntry = null) {
  const regressions = normalizeRuntimeReplayDeterministicRegressions(sample);
  const isBaseline = sample.sample?.stability === "golden";
  const fullyGated = isBaseline && regressions.length > 0;
  const missingHardEvidence = [];

  if (isBaseline && regressions.length === 0) {
    missingHardEvidence.push("missing_deterministic_regression");
  }

  return {
    isBaseline,
    fullyGated,
    deterministicRegressionCount: regressions.length,
    missingHardEvidence,
    backgroundReady: Boolean(backgroundReadyEntry),
    backgroundReadyGaps: backgroundReadyEntry?.gaps ?? [],
    backgroundReadyQueueProfile: backgroundReadyEntry?.queueProfile ?? null,
  };
}

function summarizeRuntimeReplayBaselineGovernance(
  selectedSamples,
  scenarioStats,
  backgroundReadyQueue
) {
  const thinScenarioTypes = new Set(
    ensureArray(scenarioStats?.thinScenarioTypes).map((entry) => entry.scenarioType)
  );
  const thinFamilies = new Set(
    ensureArray(scenarioStats?.familyDensity?.thinFamilies).map((entry) => entry.family)
  );
  const backgroundReadyMap = new Map(
    ensureArray(backgroundReadyQueue?.selected).map((entry) => [entry.id, entry])
  );
  const scenarioMap = new Map();
  const familyMap = new Map();
  const fullyGatedSampleIds = [];
  const baselineBacklogSampleIds = [];
  let baselineSampleCount = 0;
  let fullyGatedBaselineCount = 0;
  let backgroundReadyFullyGatedCount = 0;

  for (const entry of selectedSamples) {
    const sample = entry.sample;
    const meta = sample.sample;
    const readiness = summarizeRuntimeReplayBaselineReadiness(
      sample,
      backgroundReadyMap.get(meta.id) ?? null
    );

    if (!scenarioMap.has(meta.scenarioType)) {
      scenarioMap.set(meta.scenarioType, {
        scenarioType: meta.scenarioType,
        sampleCount: 0,
        baselineSampleCount: 0,
        fullyGatedBaselineCount: 0,
      });
    }
    if (!familyMap.has(meta.family)) {
      familyMap.set(meta.family, {
        family: meta.family,
        sampleCount: 0,
        baselineSampleCount: 0,
        fullyGatedBaselineCount: 0,
      });
    }

    const scenarioSummary = scenarioMap.get(meta.scenarioType);
    const familySummary = familyMap.get(meta.family);
    scenarioSummary.sampleCount += 1;
    familySummary.sampleCount += 1;

    if (!readiness.isBaseline) {
      continue;
    }

    baselineSampleCount += 1;
    scenarioSummary.baselineSampleCount += 1;
    familySummary.baselineSampleCount += 1;

    if (readiness.fullyGated) {
      fullyGatedBaselineCount += 1;
      scenarioSummary.fullyGatedBaselineCount += 1;
      familySummary.fullyGatedBaselineCount += 1;
      fullyGatedSampleIds.push(meta.id);
      if (readiness.backgroundReady) {
        backgroundReadyFullyGatedCount += 1;
      }
    } else {
      baselineBacklogSampleIds.push(meta.id);
    }
  }

  const scenarioTypes = [...scenarioMap.values()]
    .map((entry) => {
      const baselineBacklogCount = entry.baselineSampleCount - entry.fullyGatedBaselineCount;
      return {
        ...entry,
        baselineBacklogCount,
        fullyGated: entry.baselineSampleCount > 0 && baselineBacklogCount === 0,
        thinCoverage: thinScenarioTypes.has(entry.scenarioType),
        closureStatus: baselineBacklogCount === 0 ? "complete" : "incomplete",
        densityStatus: thinScenarioTypes.has(entry.scenarioType) ? "thin" : "adequate",
        regressionCoverageRate:
          entry.sampleCount > 0 ? entry.fullyGatedBaselineCount / entry.sampleCount : 0,
      };
    })
    .sort((left, right) => left.scenarioType.localeCompare(right.scenarioType));

  const families = [...familyMap.values()]
    .map((entry) => {
      const baselineBacklogCount = entry.baselineSampleCount - entry.fullyGatedBaselineCount;
      return {
        ...entry,
        baselineBacklogCount,
        fullyGated: entry.baselineSampleCount > 0 && baselineBacklogCount === 0,
        thinCoverage: thinFamilies.has(entry.family),
        closureStatus: baselineBacklogCount === 0 ? "complete" : "incomplete",
        densityStatus: thinFamilies.has(entry.family) ? "thin" : "adequate",
        regressionCoverageRate:
          entry.sampleCount > 0 ? entry.fullyGatedBaselineCount / entry.sampleCount : 0,
      };
    })
    .sort((left, right) => left.family.localeCompare(right.family));

  return {
    baselineSampleCount,
    fullyGatedBaselineCount,
    baselineBacklogCount: baselineSampleCount - fullyGatedBaselineCount,
    baselineClosureStatus:
      baselineSampleCount - fullyGatedBaselineCount === 0 ? "complete" : "incomplete",
    densityStatus: thinScenarioTypes.size > 0 ? "thin-scenarios-remain" : "adequate",
    fullyGatedSampleIds: fullyGatedSampleIds.sort(),
    baselineBacklogSampleIds: baselineBacklogSampleIds.sort(),
    backgroundReadyFullyGatedCount,
    backgroundReadySamplesWithGaps: ensureArray(backgroundReadyQueue?.selected)
      .filter((entry) => ensureArray(entry.gaps).length > 0)
      .map((entry) => entry.id)
      .sort(),
    scenarioTypes,
    families,
  };
}

function buildRuntimeReplayScenarioStats(dataset, selectedSamples, nowMs = Date.now()) {
  const implementedScenarioTypes = ensureArray(dataset.manifest?.taxonomy)
    .filter((entry) => entry?.status === "implemented")
    .map((entry) => entry.scenarioType);
  const plannedScenarioTypes = ensureArray(dataset.manifest?.taxonomy)
    .filter((entry) => entry?.status === "planned")
    .map((entry) => entry.scenarioType);
  const perSample = selectedSamples.map((entry) => ({
    entry,
    metrics: summarizeRuntimeReplaySampleMetrics(entry.sample, nowMs),
    recoveryQualification:
      entry.sample.process?.errorRecovery?.expected === true
        ? (entry.sample.governance?.recoveryQualification ??
          summarizeRuntimeReplayRecoveryQualification(entry.sample))
        : null,
  }));
  const byScenario = new Map();
  const byFamily = new Map();
  const overallStabilityCounts = new Map();
  const overallEvidenceModeCounts = new Map();
  const recoveryFailureClassDistribution = new Map();
  const recoveryEvidenceModeDistribution = new Map();

  for (const item of perSample) {
    const scenarioType = item.entry.sample.sample?.scenarioType ?? "unknown";
    const family = item.entry.sample.sample?.family ?? "unknown";
    if (!byScenario.has(scenarioType)) {
      byScenario.set(scenarioType, []);
    }
    if (!byFamily.has(family)) {
      byFamily.set(family, []);
    }
    byScenario.get(scenarioType).push(item);
    byFamily.get(family).push(item);
    overallStabilityCounts.set(
      item.entry.sample.sample?.stability ?? "unknown",
      (overallStabilityCounts.get(item.entry.sample.sample?.stability ?? "unknown") ?? 0) + 1
    );
    overallEvidenceModeCounts.set(
      item.entry.sample.sample?.source ?? "unknown",
      (overallEvidenceModeCounts.get(item.entry.sample.sample?.source ?? "unknown") ?? 0) + 1
    );
    if (item.recoveryQualification?.observedFailureClass) {
      recoveryFailureClassDistribution.set(
        item.recoveryQualification.observedFailureClass,
        (recoveryFailureClassDistribution.get(item.recoveryQualification.observedFailureClass) ??
          0) + 1
      );
      recoveryEvidenceModeDistribution.set(
        item.recoveryQualification.evidenceMode ?? "unknown",
        (recoveryEvidenceModeDistribution.get(
          item.recoveryQualification.evidenceMode ?? "unknown"
        ) ?? 0) + 1
      );
    }
  }

  const scenarioTypes = [...byScenario.entries()]
    .map(([scenarioType, items]) => {
      const stabilityCounts = new Map();
      const evidenceModeCounts = new Map();
      const failureClassCounts = new Map();
      const blockerStats = new Map();
      let oldestMs = 0;
      let newestMs = Number.POSITIVE_INFINITY;
      let ageTotal = 0;
      let ageCount = 0;
      let lastVerifiedAt = null;
      let totalAttempts = 0;
      let successfulAttempts = 0;

      for (const item of items) {
        const sample = item.entry.sample;
        stabilityCounts.set(
          sample.sample?.stability ?? "unknown",
          (stabilityCounts.get(sample.sample?.stability ?? "unknown") ?? 0) + 1
        );
        evidenceModeCounts.set(
          sample.sample?.source ?? "unknown",
          (evidenceModeCounts.get(sample.sample?.source ?? "unknown") ?? 0) + 1
        );
        if (item.recoveryQualification?.observedFailureClass) {
          failureClassCounts.set(
            item.recoveryQualification.observedFailureClass,
            (failureClassCounts.get(item.recoveryQualification.observedFailureClass) ?? 0) + 1
          );
        }
        for (const blockerEntry of item.metrics.blockerDwellTime.blockers) {
          const existing = blockerStats.get(blockerEntry.blocker) ?? {
            blocker: blockerEntry.blocker,
            count: 0,
            oldestFirstObservedAt: blockerEntry.firstObservedAt,
            dwellMs: 0,
          };
          existing.count += 1;
          if (
            typeof blockerEntry.firstObservedAt === "string" &&
            (existing.oldestFirstObservedAt === null ||
              parseIsoTimestamp(blockerEntry.firstObservedAt) <
                parseIsoTimestamp(existing.oldestFirstObservedAt))
          ) {
            existing.oldestFirstObservedAt = blockerEntry.firstObservedAt;
          }
          if (typeof blockerEntry.dwellMs === "number" && blockerEntry.dwellMs > existing.dwellMs) {
            existing.dwellMs = blockerEntry.dwellMs;
          }
          blockerStats.set(blockerEntry.blocker, existing);
        }
        if (typeof item.metrics.sampleAgeMs === "number") {
          oldestMs = Math.max(oldestMs, item.metrics.sampleAgeMs);
          newestMs = Math.min(newestMs, item.metrics.sampleAgeMs);
          ageTotal += item.metrics.sampleAgeMs;
          ageCount += 1;
        }
        if (
          typeof item.metrics.lastVerifiedAt === "string" &&
          (lastVerifiedAt === null ||
            parseIsoTimestamp(item.metrics.lastVerifiedAt) > parseIsoTimestamp(lastVerifiedAt))
        ) {
          lastVerifiedAt = item.metrics.lastVerifiedAt;
        }
        totalAttempts += item.metrics.rerecordSuccessRate.totalAttempts;
        successfulAttempts += item.metrics.rerecordSuccessRate.successfulAttempts;
      }

      const stabilityCountsRecord = toCountRecord(stabilityCounts);
      const rerecordRate = totalAttempts > 0 ? successfulAttempts / totalAttempts : null;
      const blockerEntries = [...blockerStats.values()].sort((left, right) =>
        left.blocker.localeCompare(right.blocker)
      );
      const gapSignals = buildRuntimeReplayScenarioGapSignals({
        sampleCount: items.length,
        goldenCount: stabilityCountsRecord.golden ?? 0,
        rerecordRate,
        maxBlockerDwellMs: blockerEntries.reduce(
          (max, entry) =>
            typeof entry.dwellMs === "number" && entry.dwellMs > max ? entry.dwellMs : max,
          0
        ),
      });

      return {
        scenarioType,
        sampleCount: items.length,
        coverageTier: deriveRuntimeReplayScenarioCoverageTier(items.length),
        gapSignals,
        priorityScore: scoreRuntimeReplayScenarioPriority(gapSignals),
        stabilityCounts: stabilityCountsRecord,
        evidenceModeCounts: toCountRecord(evidenceModeCounts),
        lastVerifiedAt,
        sampleAge: {
          oldestMs,
          newestMs: Number.isFinite(newestMs) ? newestMs : null,
          averageMs: ageCount > 0 ? Math.round(ageTotal / ageCount) : null,
        },
        rerecordSuccessRate: {
          totalAttempts,
          successfulAttempts,
          rate: rerecordRate,
        },
        blockerDwellTime: {
          blockers: blockerEntries,
        },
        failureClassCounts: toCountRecord(failureClassCounts),
      };
    })
    .sort((left, right) => left.scenarioType.localeCompare(right.scenarioType));

  const presentScenarioTypes = new Set(scenarioTypes.map((entry) => entry.scenarioType));
  const families = [...byFamily.entries()]
    .map(([family, items]) => {
      const stabilityCounts = new Map();
      const evidenceModeCounts = new Map();
      const scenarioTypeSet = new Set();

      for (const item of items) {
        const sample = item.entry.sample;
        stabilityCounts.set(
          sample.sample?.stability ?? "unknown",
          (stabilityCounts.get(sample.sample?.stability ?? "unknown") ?? 0) + 1
        );
        evidenceModeCounts.set(
          sample.sample?.source ?? "unknown",
          (evidenceModeCounts.get(sample.sample?.source ?? "unknown") ?? 0) + 1
        );
        scenarioTypeSet.add(sample.sample?.scenarioType ?? "unknown");
      }

      return {
        family,
        sampleCount: items.length,
        scenarioTypeCount: scenarioTypeSet.size,
        stabilityCounts: toCountRecord(stabilityCounts),
        evidenceModeCounts: toCountRecord(evidenceModeCounts),
        densityStatus: items.length < 2 ? "thin" : "adequate",
      };
    })
    .sort((left, right) => left.family.localeCompare(right.family));
  const thinScenarioTypes = scenarioTypes
    .filter((entry) => entry.sampleCount < 2)
    .map((entry) => ({ scenarioType: entry.scenarioType, sampleCount: entry.sampleCount }));
  const thinScenarioTypeSet = new Set(thinScenarioTypes.map((entry) => entry.scenarioType));
  const thinFamilies = families
    .filter((entry) => entry.sampleCount < 2)
    .map((entry) => ({ family: entry.family, sampleCount: entry.sampleCount }));
  const staleSamples = perSample
    .map((item) => ({
      id: item.entry.sample.sample.id,
      scenarioType: item.entry.sample.sample.scenarioType,
      sampleAgeMs: item.metrics.sampleAgeMs,
      lastVerifiedAt: item.metrics.lastVerifiedAt,
    }))
    .sort((left, right) => (right.sampleAgeMs ?? 0) - (left.sampleAgeMs ?? 0))
    .slice(0, 5);
  const candidatePromotionQueue = perSample
    .filter((item) => item.entry.sample.sample?.stability !== "golden")
    .map((item) => ({
      id: item.entry.sample.sample.id,
      scenarioType: item.entry.sample.sample.scenarioType,
      stability: item.entry.sample.sample.stability,
      evidenceMode: item.entry.sample.sample.source,
      blockerCount: item.metrics.blockerDwellTime.blockerCount,
      blockers: item.metrics.blockerDwellTime.blockers.map((entry) => entry.blocker),
      sampleAgeMs: item.metrics.sampleAgeMs,
      promotionReadiness: summarizeRuntimeReplayPromotionReadiness(item),
    }))
    .sort((left, right) => {
      if ((left.promotionReadiness?.score ?? 0) !== (right.promotionReadiness?.score ?? 0)) {
        return (right.promotionReadiness?.score ?? 0) - (left.promotionReadiness?.score ?? 0);
      }
      return left.blockerCount - right.blockerCount;
    });
  const scenarioPriorityQueue = scenarioTypes
    .filter((entry) => entry.priorityScore > 0)
    .map((entry) => ({
      scenarioType: entry.scenarioType,
      coverageTier: entry.coverageTier,
      sampleCount: entry.sampleCount,
      gapSignals: entry.gapSignals,
      priorityScore: entry.priorityScore,
      lastVerifiedAt: entry.lastVerifiedAt,
    }))
    .sort(
      (left, right) =>
        right.priorityScore - left.priorityScore ||
        left.scenarioType.localeCompare(right.scenarioType)
    );
  const fullyGatedButSingleSample = scenarioTypes
    .filter((entry) => entry.sampleCount === 1 && (entry.stabilityCounts?.golden ?? 0) > 0)
    .map((entry) => ({
      scenarioType: entry.scenarioType,
      sampleCount: entry.sampleCount,
      goldenCount: entry.stabilityCounts?.golden ?? 0,
    }));
  const backgroundReadyButThin = perSample
    .map((item) => {
      const assessment = assessRuntimeReplayBackgroundReadyCandidate(item.entry.sample);
      return assessment.eligible
        ? {
            id: item.entry.sample.sample.id,
            scenarioType: item.entry.sample.sample.scenarioType,
            queueProfile: assessment.queueProfile,
          }
        : null;
    })
    .filter((entry) => entry && thinScenarioTypeSet.has(entry.scenarioType))
    .sort((left, right) => left.id.localeCompare(right.id));

  return {
    totalSamples: selectedSamples.length,
    implementedScenarioTypes,
    plannedScenarioTypes,
    missingImplementedScenarioTypes: implementedScenarioTypes.filter(
      (scenarioType) => !presentScenarioTypes.has(scenarioType)
    ),
    stabilityCounts: toCountRecord(overallStabilityCounts),
    evidenceModeCounts: toCountRecord(overallEvidenceModeCounts),
    recoveryFailureClassDistribution: toCountRecord(recoveryFailureClassDistribution),
    recoveryEvidenceModeDistribution: toCountRecord(recoveryEvidenceModeDistribution),
    thinScenarioTypes,
    scenarioDensity: {
      minimumSampleCount: 2,
      thinScenarioTypes,
      denseScenarioTypes: scenarioTypes
        .filter((entry) => entry.sampleCount >= 2)
        .map((entry) => ({ scenarioType: entry.scenarioType, sampleCount: entry.sampleCount })),
      fullyGatedButSingleSample,
      backgroundReadyButThin,
    },
    familyDensity: {
      minimumSampleCount: 2,
      families,
      thinFamilies,
      denseFamilies: families
        .filter((entry) => entry.sampleCount >= 2)
        .map((entry) => ({ family: entry.family, sampleCount: entry.sampleCount })),
    },
    staleSamples,
    candidatePromotionQueue,
    scenarioPriorityQueue,
    scenarioTypes,
  };
}

export function summarizeRuntimeReplayRecoveryQualification(sample) {
  const replayTurns = ensureArray(sample.result?.providerReplay?.turns);
  const turnOutcomes = replayTurns.map(replayTurnOutcome);
  const failureTurnIndex = turnOutcomes.indexOf("failed");
  const recoveryTurnIndex = turnOutcomes.findIndex(
    (outcome, index) => index > failureTurnIndex && outcome === "completed"
  );
  const failureTurn = failureTurnIndex >= 0 ? replayTurns[failureTurnIndex] : null;
  const failureClass = resolveRuntimeReplayFailureClass(failureTurn?.failure);
  const expectedFailureClasses = ensureArray(sample.process?.errorRecovery?.expectedFailureClasses);
  const disallowedFailureClasses = ensureArray(
    sample.process?.errorRecovery?.disallowedFailureClasses
  );
  const rerecordStability = deriveRuntimeReplayRerecordStability(
    expectedFailureClasses,
    sample.governance?.liveFailureProbe?.lastRun
  );
  const evidenceMode = sample.sample?.source ?? "unknown";
  const goldenBlockers = deriveRuntimeReplayGovernanceGoldenBlockers(sample);
  const recoveryObserved = recoveryTurnIndex >= 0;

  return {
    expectedFailureClasses,
    disallowedFailureClasses,
    observedFailureClass: failureClass,
    recoveryObserved,
    recoveryTurnId: sample.process?.errorRecovery?.recoveryTurnId ?? null,
    evidenceMode,
    rerecordStability,
    goldenBlockers,
    recoveryStable: recoveryObserved && rerecordStability.status === "stable-compatible",
    eligibleForGolden:
      recoveryObserved &&
      evidenceMode === "recorded" &&
      rerecordStability.status === "stable-compatible" &&
      goldenBlockers.length === 0,
  };
}

function normalizeLogLine(line) {
  return line.replace(ANSI_ESCAPE_PATTERN, "").trim();
}

export function classifyRuntimeReplayWarnings(logText) {
  const actionable = [];
  const ignored = [];

  for (const rawLine of String(logText ?? "").split(/\r?\n/u)) {
    const line = normalizeLogLine(rawLine);
    if (!line || !/warning/iu.test(line)) {
      continue;
    }
    if (IGNORABLE_WARNING_PATTERNS.some((pattern) => pattern.test(line))) {
      ignored.push(line);
      continue;
    }
    actionable.push(line);
  }

  return {
    actionable,
    ignored,
  };
}

function loadSampleFile(samplePath) {
  const sample = readJson(samplePath);
  return sample;
}

export function loadRuntimeReplayDataset({ manifestPath = DEFAULT_MANIFEST_PATH } = {}) {
  const resolvedManifestPath = resolveRuntimeReplayManifestPath(manifestPath);
  const datasetDir = resolveDatasetDirFromManifest(resolvedManifestPath);
  const manifest = readJson(resolvedManifestPath);
  const samples = ensureArray(manifest.samples).map((entry) => {
    const samplePath = path.resolve(datasetDir, entry.file);
    const sample = loadSampleFile(samplePath);
    return {
      filePath: samplePath,
      manifestEntry: entry,
      sample,
    };
  });

  return {
    manifestPath: resolvedManifestPath,
    datasetDir,
    manifest,
    samples,
  };
}

export function parseRuntimeReplayFilters(argv) {
  const filters = {
    manifestPath: DEFAULT_MANIFEST_PATH,
    ids: [],
    variants: [],
    tags: [],
    scenarioTypes: [],
    stabilities: [],
    families: [],
    includeArchived: false,
    requireRecorded: false,
    emitCompiledFixture: null,
    outputReportPath: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === "--manifest" && next) {
      filters.manifestPath = next;
      index += 1;
      continue;
    }
    if (arg === "--id" && next) {
      filters.ids.push(next.trim());
      index += 1;
      continue;
    }
    if (arg === "--variant" && next) {
      filters.variants.push(next.trim());
      index += 1;
      continue;
    }
    if (arg === "--tag" && next) {
      filters.tags.push(next.trim());
      index += 1;
      continue;
    }
    if (arg === "--scenario-type" && next) {
      filters.scenarioTypes.push(next.trim());
      index += 1;
      continue;
    }
    if (arg === "--stability" && next) {
      filters.stabilities.push(next.trim());
      index += 1;
      continue;
    }
    if (arg === "--family" && next) {
      filters.families.push(next.trim());
      index += 1;
      continue;
    }
    if (arg === "--include-archived") {
      filters.includeArchived = true;
      continue;
    }
    if (arg === "--require-recorded") {
      filters.requireRecorded = true;
      continue;
    }
    if (arg === "--emit-compiled-fixture" && next) {
      filters.emitCompiledFixture = next;
      index += 1;
      continue;
    }
    if (arg === "--report-json" && next) {
      filters.outputReportPath = next;
      index += 1;
    }
  }

  return filters;
}

export function selectRuntimeReplaySamples(dataset, filters = {}) {
  const ids = new Set(ensureArray(filters.ids));
  const variants = new Set(ensureArray(filters.variants));
  const tags = new Set(ensureArray(filters.tags));
  const scenarioTypes = new Set(ensureArray(filters.scenarioTypes));
  const stabilities = new Set(ensureArray(filters.stabilities));
  const families = new Set(ensureArray(filters.families));

  return dataset.samples.filter((entry) => {
    const { sample } = entry;
    const meta = sample.sample;
    if (!filters.includeArchived && meta.stability === "archived") {
      return false;
    }
    if (ids.size > 0 && !ids.has(meta.id)) {
      return false;
    }
    if (variants.size > 0 && !variants.has(meta.variant)) {
      return false;
    }
    if (scenarioTypes.size > 0 && !scenarioTypes.has(meta.scenarioType)) {
      return false;
    }
    if (stabilities.size > 0 && !stabilities.has(meta.stability)) {
      return false;
    }
    if (families.size > 0 && !families.has(meta.family)) {
      return false;
    }
    if (tags.size > 0) {
      const sampleTags = new Set(ensureArray(meta.tags));
      for (const tag of tags) {
        if (!sampleTags.has(tag)) {
          return false;
        }
      }
    }
    return true;
  });
}

function compareManifestToSample(entry, errors) {
  const manifestEntry = entry.manifestEntry;
  const meta = entry.sample.sample;
  const mirroredFields = [
    "id",
    "variant",
    "family",
    "scenarioType",
    "mode",
    "source",
    "recordedAt",
    "schemaVersion",
    "runtimeKind",
    "providerKind",
    "requiresRealRuntime",
    "supportsReplayOnly",
    "stability",
    "redactionVersion",
    "notes",
  ];

  for (const field of mirroredFields) {
    if (JSON.stringify(manifestEntry[field]) !== JSON.stringify(meta[field])) {
      errors.push(
        `Manifest/sample mismatch for ${meta.id}: field ${field} differs between manifest and sample.`
      );
    }
  }

  if (JSON.stringify(ensureArray(manifestEntry.tags)) !== JSON.stringify(ensureArray(meta.tags))) {
    errors.push(
      `Manifest/sample mismatch for ${meta.id}: tags differ between manifest and sample.`
    );
  }
}

function validateRuntimeTruthAssertion(assertion, sampleId, location, errors) {
  if (!assertion || typeof assertion !== "object") {
    errors.push(`Sample ${sampleId} ${location} must be an object.`);
    return;
  }
  if (typeof assertion.type !== "string" || !RUNTIME_TRUTH_ASSERTION_TYPES.has(assertion.type)) {
    errors.push(`Sample ${sampleId} ${location}.type must be a supported runtimeTruth assertion.`);
    return;
  }
  if (
    assertion.matcher !== undefined &&
    (typeof assertion.matcher !== "string" || !RUNTIME_TRUTH_VALUE_MATCHERS.has(assertion.matcher))
  ) {
    errors.push(`Sample ${sampleId} ${location}.matcher must be a supported matcher.`);
  }
  if (assertion.type === "wait-runtime-task-field" || assertion.type === "wait-runtime-summary") {
    if (typeof assertion.fieldPath !== "string" || assertion.fieldPath.trim().length === 0) {
      errors.push(`Sample ${sampleId} ${location}.fieldPath must be a non-empty string.`);
    }
    if (
      (assertion.matcher === "equals" || assertion.matcher === "includes") &&
      assertion.expected === undefined
    ) {
      errors.push(
        `Sample ${sampleId} ${location}.expected is required for matcher ${assertion.matcher}.`
      );
    }
  }
  if (assertion.type === "assert-runtime-actionability") {
    if (
      assertion.expectedState === undefined &&
      assertion.summaryMatcher === undefined &&
      assertion.minimumActionCount === undefined
    ) {
      errors.push(
        `Sample ${sampleId} ${location} must declare expectedState, summaryMatcher, or minimumActionCount.`
      );
    }
  }
  if (assertion.type === "assert-autodrive-trace") {
    if (
      assertion.decisionTraceMatcher === undefined &&
      assertion.runtimeScenarioProfileMatcher === undefined &&
      assertion.repoEvaluationProfileMatcher === undefined &&
      assertion.outcomeFeedbackMatcher === undefined &&
      assertion.autonomyStateMatcher === undefined
    ) {
      errors.push(`Sample ${sampleId} ${location} must declare at least one AutoDrive matcher.`);
    }
  }
  if (assertion.type === "assert-replay-gap-event") {
    if (
      typeof assertion.text !== "string" &&
      typeof assertion.expectedReason !== "string" &&
      typeof assertion.messageText !== "string"
    ) {
      errors.push(
        `Sample ${sampleId} ${location} must declare text, messageText, or expectedReason.`
      );
    }
  }
  if (assertion.type === "assert-review-pack-linkage") {
    if (typeof assertion.uiText !== "string" || assertion.uiText.trim().length === 0) {
      errors.push(`Sample ${sampleId} ${location}.uiText must be a non-empty string.`);
    }
    if (
      typeof assertion.taskFieldPath !== "string" ||
      assertion.taskFieldPath.trim().length === 0
    ) {
      errors.push(`Sample ${sampleId} ${location}.taskFieldPath must be a non-empty string.`);
    }
    if (assertion.canonicalSource === "diagnostics-export") {
      if (
        typeof assertion.canonicalSectionPath !== "string" ||
        assertion.canonicalSectionPath.trim().length === 0
      ) {
        errors.push(
          `Sample ${sampleId} ${location}.canonicalSectionPath must be a non-empty string when canonicalSource=diagnostics-export.`
        );
      }
      if (
        typeof assertion.canonicalFieldPath !== "string" ||
        assertion.canonicalFieldPath.trim().length === 0
      ) {
        errors.push(
          `Sample ${sampleId} ${location}.canonicalFieldPath must be a non-empty string when canonicalSource=diagnostics-export.`
        );
      }
    }
  }
}

function validateSampleStructure(entry, errors, warnings, options) {
  const { sample, filePath } = entry;
  const meta = sample.sample;
  const recordingProfiles =
    sample.governance?.recordingProfiles && typeof sample.governance.recordingProfiles === "object"
      ? sample.governance.recordingProfiles
      : {};
  if (sample.schemaVersion !== 1) {
    errors.push(`Sample ${filePath} must set schemaVersion to 1.`);
  }
  if (!meta?.id || typeof meta.id !== "string") {
    errors.push(`Sample ${filePath} is missing sample.id.`);
    return;
  }
  if (!ensureArray(sample.input?.turns).length && !hasRuntimeOnlyOperation(sample)) {
    errors.push(`Sample ${meta.id} must define input.turns.`);
  }
  if (!ensureArray(sample.process?.expectedStateTransitions).length) {
    errors.push(`Sample ${meta.id} must define process.expectedStateTransitions.`);
  }
  if (!sample.process?.harness?.runner) {
    errors.push(`Sample ${meta.id} must define process.harness.runner.`);
  }
  if (!ensureArray(sample.assertions?.hard).length) {
    errors.push(`Sample ${meta.id} must define at least one hard assertion.`);
  }
  if (!ensureArray(sample.assertions?.soft).length) {
    warnings.push(`Sample ${meta.id} has no soft assertions.`);
  }
  const runtimeTruthAssertions = collectRuntimeTruthHarnessAssertions(sample);
  if (sample.governance?.legacySchemaCompat !== undefined) {
    errors.push(
      `Sample ${meta.id} must not declare governance.legacySchemaCompat; runtimeTruth assertions are now required for every sample.`
    );
  }
  if (runtimeTruthAssertions.length === 0) {
    errors.push(`Sample ${meta.id} must declare runtimeTruth assertions.`);
  }
  if (sample.runtimeTruth !== undefined && !isObjectRecord(sample.runtimeTruth)) {
    errors.push(`Sample ${meta.id} runtimeTruth must be an object when provided.`);
  }
  if (isObjectRecord(sample.runtimeTruth)) {
    for (const [sectionName, assertions] of [
      ["taskFields", sample.runtimeTruth.taskFields],
      ["review", sample.runtimeTruth.review],
      ["autodrive", sample.runtimeTruth.autodrive],
      ["eventReplay", sample.runtimeTruth.eventReplay],
    ]) {
      for (const [index, assertion] of ensureArray(assertions).entries()) {
        validateRuntimeTruthAssertion(
          assertion,
          meta.id,
          `runtimeTruth.${sectionName}[${index}]`,
          errors
        );
      }
    }
  }
  const capabilities = resolveRuntimeReplaySampleCapabilities(sample);
  if (sample.sample?.capabilities !== undefined && capabilities.length === 0) {
    errors.push(`Sample ${meta.id} sample.capabilities must include at least one capability.`);
  }

  const replay = sample.result?.providerReplay;
  const harnessActions = ensureArray(sample.process?.harness?.actions);
  const hasProviderReplay = hasRecordedProviderReplay(sample);
  const hasRuntimeOperation = hasRuntimeOnlyOperation(sample);
  if (!hasProviderReplay && !hasRuntimeOperation) {
    errors.push(
      `Sample ${meta.id} must define either result.providerReplay with at least one turn or input.runtimeOperation.`
    );
    return;
  }
  if (hasRuntimeOperation) {
    if (sample.input?.runtimeOperation?.type !== "agent-task-start") {
      errors.push(
        `Sample ${meta.id} input.runtimeOperation.type must be "agent-task-start" when runtimeOperation is used.`
      );
    }
    if (!harnessActions.some((entry) => entry?.type === "rpc-agent-task-start")) {
      errors.push(
        `Sample ${meta.id} runtime-only samples must include process.harness.actions.rpc-agent-task-start.`
      );
    }
  }
  if (!hasProviderReplay) {
    return;
  }

  if (replay.variantId !== meta.variant) {
    errors.push(`Sample ${meta.id} providerReplay.variantId does not match sample.variant.`);
  }
  if (sample.input?.variant?.modelId !== replay.modelId) {
    errors.push(`Sample ${meta.id} input.variant.modelId does not match providerReplay.modelId.`);
  }
  if (sample.input?.runtimeConfig?.accessMode !== replay.recordingAccessMode) {
    errors.push(
      `Sample ${meta.id} input.runtimeConfig.accessMode does not match providerReplay.recordingAccessMode.`
    );
  }
  if (sample.input?.runtimeConfig?.executionMode !== replay.recordingExecutionMode) {
    errors.push(
      `Sample ${meta.id} input.runtimeConfig.executionMode does not match providerReplay.recordingExecutionMode.`
    );
  }

  const coverage = ensureArray(replay.coverage);
  const inputTurns = ensureArray(sample.input?.turns);
  const expectedStateTransitions = ensureArray(sample.process?.expectedStateTransitions);
  const requiresModelSelectionEvidence =
    meta.mode === "model-selection" ||
    coverage.includes("model-selection") ||
    ensureArray(meta.tags).includes("model-selection");
  if (requiresModelSelectionEvidence) {
    const missingModelSelectionEvidence = [];
    const modelSelectionAction = harnessActions.find(
      (entry) => entry?.type === "select-option" && entry.control === "Model"
    );
    if (!modelSelectionAction || modelSelectionAction.value !== sample.input?.variant?.modelId) {
      missingModelSelectionEvidence.push("process.harness.actions.select-option[Model]");
    }
    if (!coverage.includes("model-selection")) {
      missingModelSelectionEvidence.push("result.providerReplay.coverage.model-selection");
    }
    if (sample.input?.variant?.provider !== replay.provider) {
      missingModelSelectionEvidence.push("result.providerReplay.provider");
    }
    if (
      replay.turns.some(
        (turn) => turn?.provenance?.recordedModelId !== sample.input?.variant?.modelId
      )
    ) {
      missingModelSelectionEvidence.push("turn.provenance.recordedModelId");
    }
    if (
      replay.turns.some(
        (turn) => turn?.provenance?.recordedProvider !== sample.input?.variant?.provider
      )
    ) {
      missingModelSelectionEvidence.push("turn.provenance.recordedProvider");
    }
    if (missingModelSelectionEvidence.length > 0) {
      errors.push(
        `Sample ${meta.id} must preserve explicit model-selection evidence (${missingModelSelectionEvidence.join(", ")}).`
      );
    }
  }

  for (const [turnIndex, turn] of replay.turns.entries()) {
    const hasFailure = replayTurnHasFailure(turn);
    if (typeof turn.recordingProfile === "string" && turn.recordingProfile.trim().length > 0) {
      const profile = recordingProfiles[turn.recordingProfile];
      if (!profile || typeof profile !== "object") {
        errors.push(
          `Sample ${meta.id} turn ${turnIndex + 1} references missing recordingProfile ${turn.recordingProfile}.`
        );
      }
    }
    if (hasFailure) {
      if (Array.isArray(turn.deltaChunks) && turn.deltaChunks.length > 0) {
        errors.push(
          `Sample ${meta.id} turn ${turnIndex + 1} must not store deltaChunks for failures.`
        );
      }
      if (typeof turn.output === "string" && turn.output.trim().length > 0) {
        errors.push(`Sample ${meta.id} turn ${turnIndex + 1} must not store output for failures.`);
      }
    } else if (!Array.isArray(turn.deltaChunks) || turn.deltaChunks.join("") !== turn.output) {
      errors.push(`Sample ${meta.id} turn ${turnIndex + 1} deltaChunks must reconstruct output.`);
    }
    if (turn.provenance?.rpcEndpoint !== "http://127.0.0.1:{runtimePort}/rpc") {
      errors.push(`Sample ${meta.id} turn ${turnIndex + 1} stores a non-canonical rpcEndpoint.`);
    }
    if (turn.provenance?.workspaceId !== "workspace-web") {
      errors.push(`Sample ${meta.id} turn ${turnIndex + 1} stores a non-canonical workspaceId.`);
    }
    if (options.requireRecorded && turn.provenance?.source !== "recorded") {
      errors.push(`Sample ${meta.id} turn ${turnIndex + 1} must be recorded.`);
    }
  }

  const requiresQueueResumeEvidence =
    meta.scenarioType === "streaming-long-output" &&
    (coverage.includes("queue-resume") ||
      harnessActions.some((entry) => entry?.type === "queue-prompt") ||
      inputTurns.length > 1);
  if (requiresQueueResumeEvidence) {
    const missingQueueResumeEvidence = [];
    if (!harnessActions.some((entry) => entry?.type === "queue-prompt")) {
      missingQueueResumeEvidence.push("process.harness.actions.queue-prompt");
    }
    for (const expectedTransition of [
      "turn.queue.accepted",
      "queued-turn.resumed",
      "queued-turn.completed",
    ]) {
      if (!expectedStateTransitions.includes(expectedTransition)) {
        missingQueueResumeEvidence.push(`process.expectedStateTransitions.${expectedTransition}`);
      }
    }
    if (!coverage.includes("queue-resume")) {
      missingQueueResumeEvidence.push("result.providerReplay.coverage.queue-resume");
    }
    if (inputTurns.length < 2) {
      missingQueueResumeEvidence.push("input.turns>=2");
    }
    if (replay.turns.length < 2) {
      missingQueueResumeEvidence.push("result.providerReplay.turns>=2");
    }
    if (missingQueueResumeEvidence.length > 0) {
      errors.push(
        `Sample ${meta.id} must preserve queue-resume evidence for streaming-long-output coverage (${missingQueueResumeEvidence.join(", ")}).`
      );
    }
  }

  if (sample.process?.errorRecovery?.expected === true) {
    const expectedFailureClasses = ensureArray(sample.process.errorRecovery.expectedFailureClasses);
    const disallowedFailureClasses = ensureArray(
      sample.process.errorRecovery.disallowedFailureClasses
    );
    if (expectedFailureClasses.length === 0) {
      errors.push(
        `Sample ${meta.id} expects recovery but does not declare expectedFailureClasses.`
      );
    }
    if (
      typeof sample.process.errorRecovery.recoveryTurnId !== "string" ||
      sample.process.errorRecovery.recoveryTurnId.trim().length === 0
    ) {
      errors.push(`Sample ${meta.id} expects recovery but does not declare recoveryTurnId.`);
    }
    const turnOutcomes = replay.turns.map(replayTurnOutcome);
    const firstFailureIndex = turnOutcomes.indexOf("failed");
    const recoveredIndex = turnOutcomes.findIndex(
      (outcome, index) => index > firstFailureIndex && outcome === "completed"
    );
    if (firstFailureIndex < 0) {
      errors.push(`Sample ${meta.id} expects recovery but has no failed replay turn.`);
    } else if (recoveredIndex < 0) {
      errors.push(
        `Sample ${meta.id} expects recovery but has no successful replay turn after failure.`
      );
    } else {
      const failureTurn = replay.turns[firstFailureIndex];
      const failureClass = resolveRuntimeReplayFailureClass(failureTurn?.failure);
      if (!failureClass) {
        errors.push(`Sample ${meta.id} expects recovery but the failed turn has no failure class.`);
      }
      if (expectedFailureClasses.length > 0 && !expectedFailureClasses.includes(failureClass)) {
        errors.push(
          `Sample ${meta.id} failed turn class ${failureClass ?? "unknown"} is outside expectedFailureClasses.`
        );
      }
      if (failureClass && disallowedFailureClasses.includes(failureClass)) {
        errors.push(
          `Sample ${meta.id} failed turn class ${failureClass} is listed in disallowedFailureClasses.`
        );
      }
    }

    if (
      !sample.governance?.promotionCriteria ||
      typeof sample.governance.promotionCriteria !== "object"
    ) {
      errors.push(
        `Sample ${meta.id} expects recovery but does not declare governance.promotionCriteria.`
      );
    } else if (!ensureArray(sample.governance.promotionCriteria.upgradeToGolden).length) {
      errors.push(
        `Sample ${meta.id} expects recovery but governance.promotionCriteria.upgradeToGolden is empty.`
      );
    }

    if (!Array.isArray(sample.governance?.goldenBlockers)) {
      errors.push(
        `Sample ${meta.id} expects recovery but does not declare governance.goldenBlockers.`
      );
    } else if (meta.stability === "golden" && sample.governance.goldenBlockers.length > 0) {
      errors.push(
        `Sample ${meta.id} is marked golden but still declares governance.goldenBlockers.`
      );
    }
    const liveFailureProbe = sample.governance?.liveFailureProbe;
    if (!liveFailureProbe || typeof liveFailureProbe !== "object") {
      warnings.push(`Sample ${meta.id} does not declare governance.liveFailureProbe.`);
    } else {
      if (
        typeof liveFailureProbe.profileId !== "string" ||
        liveFailureProbe.profileId.trim().length === 0
      ) {
        errors.push(`Sample ${meta.id} liveFailureProbe is missing profileId.`);
      }
      if (
        typeof liveFailureProbe.turnId !== "string" ||
        liveFailureProbe.turnId.trim().length === 0
      ) {
        errors.push(`Sample ${meta.id} liveFailureProbe is missing turnId.`);
      }
      const lastRun = liveFailureProbe.lastRun;
      if (lastRun && typeof lastRun === "object") {
        if (!Array.isArray(lastRun.observedFailureClasses)) {
          errors.push(
            `Sample ${meta.id} liveFailureProbe.lastRun must declare observedFailureClasses.`
          );
        }
        if (!Array.isArray(lastRun.attemptRecords)) {
          errors.push(`Sample ${meta.id} liveFailureProbe.lastRun must declare attemptRecords.`);
        }
        if (
          typeof sample.governance.lastLiveRerecordStable === "boolean" &&
          sample.governance.lastLiveRerecordStable !== lastRun.stable
        ) {
          errors.push(
            `Sample ${meta.id} governance.lastLiveRerecordStable disagrees with liveFailureProbe.lastRun.stable.`
          );
        }
      }
    }

    const recoveryQualification = sample.governance?.recoveryQualification;
    if (!recoveryQualification || typeof recoveryQualification !== "object") {
      errors.push(
        `Sample ${meta.id} expects recovery but does not declare governance.recoveryQualification.`
      );
    } else {
      const derivedRecoveryQualification = summarizeRuntimeReplayRecoveryQualification(sample);
      if (JSON.stringify(recoveryQualification) !== JSON.stringify(derivedRecoveryQualification)) {
        errors.push(
          `Sample ${meta.id} governance.recoveryQualification disagrees with derived recovery qualification.`
        );
      }
    }

    const rerecordStability = sample.governance?.rerecordStability;
    if (!rerecordStability || typeof rerecordStability !== "object") {
      errors.push(
        `Sample ${meta.id} expects recovery but does not declare governance.rerecordStability.`
      );
    } else {
      const derivedRerecordStability = deriveRuntimeReplayRerecordStability(
        expectedFailureClasses,
        sample.governance?.liveFailureProbe?.lastRun
      );
      if (rerecordStability.status !== derivedRerecordStability.status) {
        errors.push(
          `Sample ${meta.id} governance.rerecordStability.status disagrees with liveFailureProbe-derived status.`
        );
      }
      if (rerecordStability.stable !== derivedRerecordStability.stable) {
        errors.push(
          `Sample ${meta.id} governance.rerecordStability.stable disagrees with liveFailureProbe-derived stability.`
        );
      }
      if (
        rerecordStability.compatibleWithExpectedFailureClass !==
        derivedRerecordStability.compatibleWithExpectedFailureClass
      ) {
        errors.push(
          `Sample ${meta.id} governance.rerecordStability.compatibleWithExpectedFailureClass disagrees with liveFailureProbe-derived compatibility.`
        );
      }
    }
  }

  if (sample.sample?.scenarioType === "write-safe-minimal") {
    const expectedWrites = ensureArray(sample.governance?.workspaceEffects?.expectedWrites);
    if (expectedWrites.length === 0) {
      errors.push(
        `Sample ${meta.id} write-safe-minimal must declare governance.workspaceEffects.expectedWrites.`
      );
    }
    for (const expectedWrite of expectedWrites) {
      if (
        typeof expectedWrite?.relativePath !== "string" ||
        expectedWrite.relativePath.trim().length === 0
      ) {
        errors.push(
          `Sample ${meta.id} write-safe expectedWrite is missing a non-empty relativePath.`
        );
        continue;
      }
      if (
        typeof expectedWrite?.mustContain !== "string" ||
        expectedWrite.mustContain.trim().length === 0
      ) {
        errors.push(
          `Sample ${meta.id} write-safe expectedWrite ${expectedWrite.relativePath} is missing mustContain.`
        );
      }
    }
    if (findWriteSafeWorkspaceAssertionGaps(sample).length > 0) {
      errors.push(
        `Sample ${meta.id} write-safe-minimal must mirror governance.workspaceEffects via process.harness.assertions workspace-file-contains entries.`
      );
    }
  }

  const deterministicRegressions = ensureArray(sample.governance?.deterministicRegressions);
  for (const [index, regression] of deterministicRegressions.entries()) {
    if (!regression || typeof regression !== "object") {
      errors.push(
        `Sample ${meta.id} governance.deterministicRegressions[${index}] must be an object.`
      );
      continue;
    }
    for (const field of ["id", "layer", "path", "testName"]) {
      if (typeof regression[field] !== "string" || regression[field].trim().length === 0) {
        errors.push(
          `Sample ${meta.id} governance.deterministicRegressions[${index}].${field} must be a non-empty string.`
        );
      }
    }
    const regressionPath =
      typeof regression.path === "string" && regression.path.trim().length > 0
        ? path.resolve(REPO_ROOT, regression.path)
        : null;
    if (regressionPath && !fs.existsSync(regressionPath)) {
      errors.push(
        `Sample ${meta.id} governance.deterministicRegressions[${index}].path does not exist: ${regression.path}`
      );
      continue;
    }
    if (
      regressionPath &&
      typeof regression.testName === "string" &&
      regression.testName.trim().length > 0
    ) {
      const regressionFile = fs.readFileSync(regressionPath, "utf8");
      if (!regressionFile.includes(regression.testName)) {
        errors.push(
          `Sample ${meta.id} governance.deterministicRegressions[${index}].testName was not found in ${regression.path}.`
        );
      }
    }
  }

  const optimizationSignals = normalizeRuntimeReplayOptimizationSignals(sample);
  if (sample.governance?.optimizationSignals !== undefined) {
    if (!optimizationSignals) {
      errors.push(
        `Sample ${meta.id} governance.optimizationSignals must be an object when provided.`
      );
    } else {
      if (!optimizationSignals.seedSource) {
        errors.push(
          `Sample ${meta.id} governance.optimizationSignals.seedSource must be a non-empty string.`
        );
      }
      if (!optimizationSignals.incubationTrack) {
        errors.push(
          `Sample ${meta.id} governance.optimizationSignals.incubationTrack must be a non-empty string.`
        );
      }
      if (optimizationSignals.recommendedLevers.length === 0) {
        errors.push(
          `Sample ${meta.id} governance.optimizationSignals.recommendedLevers must include at least one lever.`
        );
      }
      if (optimizationSignals.lineage && optimizationSignals.lineage.parentSampleId === meta.id) {
        errors.push(
          `Sample ${meta.id} governance.optimizationSignals.lineage.parentSampleId must reference another dataset sample.`
        );
      }
      if (optimizationSignals.safeBackgroundCandidate) {
        const backgroundAssessment = assessRuntimeReplayBackgroundReadyCandidate(sample);
        if (!backgroundAssessment.eligible) {
          errors.push(
            `Sample ${meta.id} governance.optimizationSignals.safeBackgroundCandidate must not be true unless the sample is currently background-ready (${backgroundAssessment.exclusionReasons.join(", ")}).`
          );
        }
      }
    }
  }

  if (sample.governance?.redaction?.applied !== true) {
    errors.push(`Sample ${meta.id} must mark governance.redaction.applied=true.`);
  }

  walkStrings(sample, (value) => {
    for (const pattern of SENSITIVE_PATTERNS) {
      if (pattern.test(value)) {
        errors.push(`Sample ${meta.id} contains a sensitive or host-specific string: ${value}`);
        return;
      }
    }
    if (/http:\/\/127\.0\.0\.1:\d+\/rpc/gu.test(value)) {
      errors.push(`Sample ${meta.id} stores a concrete local rpc endpoint instead of a template.`);
    }
  });
}

export function validateRuntimeReplayDataset(dataset, options = {}) {
  const errors = [];
  const warnings = [];
  const manifest = dataset.manifest;
  const sampleIdsSet = new Set(
    dataset.samples.map((entry) => entry.sample.sample?.id).filter(Boolean)
  );
  const validationOptions = {
    ...options,
    sampleIdsSet,
  };
  if (manifest.schemaVersion !== 1) {
    errors.push("Manifest schemaVersion must be 1.");
  }
  if (!manifest.datasetId || typeof manifest.datasetId !== "string") {
    errors.push("Manifest must define datasetId.");
  }
  if (!ensureArray(manifest.taxonomy).length) {
    errors.push("Manifest must define a non-empty taxonomy.");
  }
  if (!ensureArray(manifest.samples).length) {
    errors.push("Manifest must define a non-empty samples array.");
  }

  const coverageMatrix = normalizeRuntimeReplayCoverageMatrix(manifest);
  if (manifest.coverageMatrix && !coverageMatrix) {
    errors.push("Manifest coverageMatrix must declare at least one model profile.");
  }
  if (coverageMatrix) {
    const taxonomyScenarioTypes = new Set(
      ensureArray(manifest.taxonomy)
        .map((entry) => entry?.scenarioType)
        .filter(Boolean)
    );
    const profileIds = new Set(coverageMatrix.modelProfiles.map((entry) => entry.id));
    const capabilityIds = new Set(coverageMatrix.capabilityCatalog.map((entry) => entry.id));
    const duplicateProfileIds = coverageMatrix.modelProfiles
      .map((entry) => entry.id)
      .filter((entry, index, collection) => collection.indexOf(entry) !== index);
    const duplicateModelIds = coverageMatrix.modelProfiles
      .map((entry) => entry.modelId)
      .filter((entry, index, collection) => collection.indexOf(entry) !== index);
    const duplicateScenarioRequirements = coverageMatrix.scenarioRequirements
      .map((entry) => entry.scenarioType)
      .filter((entry, index, collection) => collection.indexOf(entry) !== index);
    const duplicateCapabilityIds = coverageMatrix.capabilityCatalog
      .map((entry) => entry.id)
      .filter((entry, index, collection) => collection.indexOf(entry) !== index);
    const duplicateCapabilityRequirements = coverageMatrix.capabilityRequirements
      .map((entry) => entry.capabilityId)
      .filter((entry, index, collection) => collection.indexOf(entry) !== index);
    if (coverageMatrix.sources.length === 0) {
      errors.push("Manifest coverageMatrix must declare at least one source.");
    }
    for (const profileId of [...new Set(duplicateProfileIds)]) {
      errors.push(
        `Manifest coverageMatrix.modelProfiles contains duplicate profile id ${profileId}.`
      );
    }
    for (const modelId of [...new Set(duplicateModelIds)]) {
      errors.push(`Manifest coverageMatrix.modelProfiles contains duplicate modelId ${modelId}.`);
    }
    for (const scenarioType of [...new Set(duplicateScenarioRequirements)]) {
      errors.push(
        `Manifest coverageMatrix.scenarioRequirements contains duplicate scenarioType ${scenarioType}.`
      );
    }
    for (const capabilityId of [...new Set(duplicateCapabilityIds)]) {
      errors.push(
        `Manifest coverageMatrix.capabilityCatalog contains duplicate capability id ${capabilityId}.`
      );
    }
    for (const capabilityId of [...new Set(duplicateCapabilityRequirements)]) {
      errors.push(
        `Manifest coverageMatrix.capabilityRequirements contains duplicate capabilityId ${capabilityId}.`
      );
    }
    for (const requirement of coverageMatrix.scenarioRequirements) {
      if (!taxonomyScenarioTypes.has(requirement.scenarioType)) {
        errors.push(
          `Manifest coverageMatrix.scenarioRequirements references unknown scenarioType ${requirement.scenarioType}.`
        );
      }
      if (requirement.requiredProfiles.length === 0) {
        errors.push(
          `Manifest coverageMatrix.scenarioRequirements for ${requirement.scenarioType} must declare at least one required profile.`
        );
      }
      for (const profileId of requirement.requiredProfiles) {
        if (!profileIds.has(profileId)) {
          errors.push(
            `Manifest coverageMatrix.scenarioRequirements for ${requirement.scenarioType} references unknown profile ${profileId}.`
          );
        }
      }
    }
    for (const requirement of coverageMatrix.capabilityRequirements) {
      if (!capabilityIds.has(requirement.capabilityId)) {
        errors.push(
          `Manifest coverageMatrix.capabilityRequirements references unknown capabilityId ${requirement.capabilityId}.`
        );
      }
      if (requirement.requiredProfiles.length === 0) {
        errors.push(
          `Manifest coverageMatrix.capabilityRequirements for ${requirement.capabilityId} must declare at least one required profile.`
        );
      }
      for (const profileId of requirement.requiredProfiles) {
        if (!profileIds.has(profileId)) {
          errors.push(
            `Manifest coverageMatrix.capabilityRequirements for ${requirement.capabilityId} references unknown profile ${profileId}.`
          );
        }
      }
    }
    const datasetCoverage = buildRuntimeReplayCoverageMatrix({
      dataset,
      selectedSamples: dataset.samples,
    });
    if (options.skipCoverageMatrixCatalogStatusAlignment !== true) {
      for (const entry of ensureArray(datasetCoverage?.capabilityCoverage)) {
        if (entry.status === "planned" && entry.coveredProfiles.length > 0) {
          errors.push(
            `Manifest coverageMatrix.capabilityCatalog marks ${entry.capabilityId} as planned even though dataset samples already provide coverage.`
          );
        }
        if (entry.status === "implemented" && entry.coveredProfiles.length === 0) {
          errors.push(
            `Manifest coverageMatrix.capabilityCatalog marks ${entry.capabilityId} as implemented but dataset samples do not provide coverage.`
          );
        }
      }
    }
    if (options.requireCoverageMatrixSatisfaction === true) {
      for (const gap of ensureArray(datasetCoverage?.gaps)) {
        if (gap.type === "missing_capability_profile") {
          errors.push(
            `Manifest coverageMatrix is not satisfied by dataset samples: capability ${gap.capabilityId} is missing required profile ${gap.profileId}.`
          );
        } else {
          errors.push(
            `Manifest coverageMatrix is not satisfied by dataset samples: scenario ${gap.scenarioType} is missing required profile ${gap.profileId}.`
          );
        }
      }
    }
  }

  const seenIds = new Set();
  const seenFiles = new Set();
  for (const entry of dataset.samples) {
    const meta = entry.sample.sample;
    if (seenIds.has(meta.id)) {
      errors.push(`Duplicate sample id detected: ${meta.id}`);
    }
    seenIds.add(meta.id);
    if (seenFiles.has(entry.manifestEntry.file)) {
      errors.push(`Duplicate sample file detected in manifest: ${entry.manifestEntry.file}`);
    }
    seenFiles.add(entry.manifestEntry.file);
    compareManifestToSample(entry, errors);
    validateSampleStructure(entry, errors, warnings, validationOptions);
  }

  if (!validationOptions.skipTaxonomyCoverageWarnings) {
    const implementedScenarioTypes = new Set(
      dataset.samples.map((entry) => entry.sample.sample.scenarioType)
    );
    for (const taxonomyEntry of ensureArray(manifest.taxonomy)) {
      if (
        taxonomyEntry.status === "implemented" &&
        !implementedScenarioTypes.has(taxonomyEntry.scenarioType)
      ) {
        warnings.push(
          `Taxonomy marks ${taxonomyEntry.scenarioType} as implemented but no sample currently uses it.`
        );
      }
    }
  }

  return { errors, warnings };
}

export function compileRuntimeReplayFixture(dataset, selectedSamples) {
  const samples = selectedSamples
    .map((entry) => entry.sample)
    .filter((sample) => hasRecordedProviderReplay(sample));
  return {
    fixtureVersion: 1,
    datasetId: dataset.manifest.datasetId,
    compiledAt: new Date().toISOString(),
    description:
      "Compiled provider replay fixture generated from the managed runtime replay dataset manifest.",
    qualityPolicy: {
      strategy: "managed-runtime-replay-dataset",
      sourceManifest: path.relative(REPO_ROOT, dataset.manifestPath),
      sampleIds: samples.map((entry) => entry.sample.id),
    },
    variants: samples.map((entry) => {
      const variant = structuredClone(entry.result.providerReplay);
      const expectedWrites = ensureArray(entry.governance?.workspaceEffects?.expectedWrites)
        .filter(
          (expectedWrite) =>
            typeof expectedWrite?.relativePath === "string" &&
            expectedWrite.relativePath.trim().length > 0 &&
            typeof expectedWrite?.mustContain === "string" &&
            expectedWrite.mustContain.trim().length > 0
        )
        .map((expectedWrite) => ({
          relativePath: expectedWrite.relativePath.trim(),
          mustContain: expectedWrite.mustContain,
        }));
      if (expectedWrites.length > 0) {
        variant.workspaceEffects = { expectedWrites };
      }
      return variant;
    }),
  };
}

export function createRuntimeReplaySelection(selectedSamples) {
  const normalizedSamples = selectedSamples.map((entry) => {
    const sample = structuredClone(entry.sample);
    if (sample.process?.harness) {
      sample.process.harness.workspaceId = normalizeRuntimeReplayWorkspaceId(
        sample.process.harness.workspaceId
      );
      if (typeof sample.process.harness.timeoutMs !== "number") {
        sample.process.harness.timeoutMs = DEFAULT_RUNTIME_REPLAY_HARNESS_TIMEOUT_MS;
      }
      const runtimeTruthAssertions = collectRuntimeTruthHarnessAssertions(sample);
      if (runtimeTruthAssertions.length > 0) {
        const mergedAssertions = [...ensureArray(sample.process.harness.assertions)];
        for (const runtimeTruthAssertion of runtimeTruthAssertions) {
          const serialized = JSON.stringify(runtimeTruthAssertion);
          if (!mergedAssertions.some((entry) => JSON.stringify(entry) === serialized)) {
            mergedAssertions.push(runtimeTruthAssertion);
          }
        }
        sample.process.harness.assertions = mergedAssertions;
      }
    }
    return sample;
  });

  return {
    generatedAt: new Date().toISOString(),
    sampleIds: selectedSamples.map((entry) => entry.sample.sample.id),
    samples: normalizedSamples,
  };
}

function buildRuntimeReplayCandidateIntake({
  selectedSamples,
  scenarioStats,
  backgroundReadyQueue,
  coverageMatrix,
}) {
  const candidateSampleIds = selectedSamples
    .filter((entry) => entry.sample.sample?.stability !== "golden")
    .map((entry) => entry.sample.sample.id)
    .sort();

  const workflowFailureCandidates = selectedSamples
    .filter((entry) => {
      if (entry.sample.sample?.stability === "golden") {
        return false;
      }
      const signals = normalizeRuntimeReplayOptimizationSignals(entry.sample);
      return signals?.seedSource === "workflow-failure";
    })
    .map((entry) => entry.sample.sample.id)
    .sort();

  const autoPromotableCandidates = ensureArray(scenarioStats?.candidatePromotionQueue)
    .filter((entry) => entry.promotionReadiness?.ready === true)
    .map((entry) => entry.id)
    .sort();

  const matrixGapSuggestions = ensureArray(coverageMatrix?.gaps)
    .map((entry) => ({
      scenarioType: entry.scenarioType,
      capabilityId: entry.capabilityId ?? null,
      profileId: entry.profileId,
      type: entry.type ?? "missing_model_profile",
    }))
    .sort(
      (left, right) =>
        (left.scenarioType ?? left.capabilityId ?? "").localeCompare(
          right.scenarioType ?? right.capabilityId ?? ""
        ) || left.profileId.localeCompare(right.profileId)
    );

  const backgroundReadyNightlyIds = ensureArray(backgroundReadyQueue?.selected)
    .map((entry) => entry.id)
    .sort();

  return {
    generatedAt: new Date().toISOString(),
    backgroundReadyNightlyIds,
    candidateSampleIds,
    workflowFailureCandidates,
    autoPromotableCandidates,
    matrixGapSuggestions,
    summary: {
      backgroundReadyNightlyCount: backgroundReadyNightlyIds.length,
      candidateSampleCount: candidateSampleIds.length,
      workflowFailureCandidateCount: workflowFailureCandidates.length,
      autoPromotableCandidateCount: autoPromotableCandidates.length,
      matrixGapSuggestionCount: matrixGapSuggestions.length,
    },
  };
}

export function buildRuntimeReplayValidationReport({ dataset, selectedSamples, validation }) {
  const nowMs = Date.now();
  const scenarioStats = buildRuntimeReplayScenarioStats(dataset, selectedSamples, nowMs);
  const backgroundReadyQueue = buildRuntimeReplayBackgroundReadyQueue(selectedSamples);
  const coverageMatrix = buildRuntimeReplayCoverageMatrix({ dataset, selectedSamples });
  const lineageGraph = buildRuntimeReplayLineageGraph({ dataset, selectedSamples });
  const backgroundReadyMap = new Map(
    ensureArray(backgroundReadyQueue.selected).map((entry) => [entry.id, entry])
  );
  const regressionCoverage = summarizeRuntimeReplayRegressionCoverage(
    selectedSamples,
    scenarioStats,
    nowMs
  );
  const baselineGovernance = summarizeRuntimeReplayBaselineGovernance(
    selectedSamples,
    scenarioStats,
    backgroundReadyQueue
  );
  const candidateIntake = buildRuntimeReplayCandidateIntake({
    selectedSamples,
    scenarioStats,
    backgroundReadyQueue,
    coverageMatrix,
  });
  return {
    validatedAt: new Date().toISOString(),
    datasetId: dataset.manifest.datasetId,
    manifestPath: dataset.manifestPath,
    selectedSampleIds: selectedSamples.map((entry) => entry.sample.sample.id),
    warningCount: validation.warnings.length,
    errorCount: validation.errors.length,
    warnings: validation.warnings,
    errors: validation.errors,
    scenarioStats,
    coverageMatrix,
    candidateIntake,
    backgroundReadyQueue,
    baselineGovernance,
    evolutionSignals: summarizeRuntimeReplayEvolutionSignals(selectedSamples),
    lineageGraph,
    lineageGraphSummary: lineageGraph.summary,
    regressionCoverage,
    samples: selectedSamples.map((entry) => {
      const sample = entry.sample;
      const sampleMetrics = summarizeRuntimeReplaySampleMetrics(sample, nowMs);
      return {
        id: sample.sample.id,
        stability: sample.sample.stability,
        scenarioType: sample.sample.scenarioType,
        source: sample.sample.source,
        sampleAgeMs: sampleMetrics.sampleAgeMs,
        lastVerifiedAt: sampleMetrics.lastVerifiedAt,
        rerecordSuccessRate: sampleMetrics.rerecordSuccessRate,
        blockerDwellTime: sampleMetrics.blockerDwellTime,
        optimizationSignals: normalizeRuntimeReplayOptimizationSignals(sample),
        deterministicRegressions: normalizeRuntimeReplayDeterministicRegressions(sample),
        baselineReadiness: summarizeRuntimeReplayBaselineReadiness(
          sample,
          backgroundReadyMap.get(sample.sample.id) ?? null
        ),
        recoveryQualification:
          sample.process?.errorRecovery?.expected === true
            ? (sample.governance?.recoveryQualification ??
              summarizeRuntimeReplayRecoveryQualification(sample))
            : null,
      };
    }),
  };
}

export function updateManifestEntryFromSample(dataset, updatedSample) {
  const meta = updatedSample.sample;
  const manifestEntry = dataset.manifest.samples.find((entry) => entry.id === meta.id);
  if (!manifestEntry) {
    throw new Error(`Manifest entry not found for sample ${meta.id}`);
  }
  for (const field of [
    "variant",
    "family",
    "scenarioType",
    "mode",
    "source",
    "recordedAt",
    "schemaVersion",
    "runtimeKind",
    "providerKind",
    "requiresRealRuntime",
    "supportsReplayOnly",
    "tags",
    "stability",
    "redactionVersion",
    "notes",
  ]) {
    manifestEntry[field] = meta[field];
  }
  return manifestEntry;
}

export function summarizeReRecordDiff(previousSample, nextSample) {
  const previousTurns = ensureArray(previousSample.result?.providerReplay?.turns);
  const nextTurns = ensureArray(nextSample.result?.providerReplay?.turns);
  const changes = [];
  for (let index = 0; index < Math.max(previousTurns.length, nextTurns.length); index += 1) {
    const before = previousTurns[index];
    const after = nextTurns[index];
    if (!before || !after) {
      changes.push(`turn ${index + 1}: turn count changed`);
      continue;
    }
    if (before.output !== after.output) {
      changes.push(
        `turn ${index + 1}: output changed (${before.output.length} -> ${after.output.length} chars)`
      );
    }
    if (ensureArray(before.deltaChunks).length !== ensureArray(after.deltaChunks).length) {
      changes.push(
        `turn ${index + 1}: delta chunk count changed (${ensureArray(before.deltaChunks).length} -> ${ensureArray(after.deltaChunks).length})`
      );
    }
    if (before.recordedAt !== after.recordedAt) {
      changes.push(`turn ${index + 1}: recordedAt ${before.recordedAt} -> ${after.recordedAt}`);
    }
  }
  return changes;
}

function flattenPlaywrightSuites(suites, tests = []) {
  for (const suite of ensureArray(suites)) {
    for (const spec of ensureArray(suite.specs)) {
      tests.push(spec);
    }
    flattenPlaywrightSuites(suite.suites, tests);
  }
  return tests;
}

export function buildRuntimeReplayReport({
  dataset,
  selectedSamples,
  playwrightJson,
  combinedLogs,
}) {
  const nowMs = Date.now();
  const specs = flattenPlaywrightSuites(playwrightJson?.suites);
  const warningSummary = classifyRuntimeReplayWarnings(combinedLogs);
  const actionableWarningCount = warningSummary.actionable.length;
  const scenarioStats = buildRuntimeReplayScenarioStats(dataset, selectedSamples, nowMs);
  const backgroundReadyQueue = buildRuntimeReplayBackgroundReadyQueue(selectedSamples);
  const backgroundReadyMap = new Map(
    ensureArray(backgroundReadyQueue.selected).map((entry) => [entry.id, entry])
  );
  const regressionCoverage = summarizeRuntimeReplayRegressionCoverage(
    selectedSamples,
    scenarioStats,
    nowMs
  );
  const baselineGovernance = summarizeRuntimeReplayBaselineGovernance(
    selectedSamples,
    scenarioStats,
    backgroundReadyQueue
  );
  const sampleReports = [];
  const hardFailures = [];
  const softWarnings = [];

  for (const entry of selectedSamples) {
    const sample = entry.sample;
    const meta = sample.sample;
    const testName = sample.process?.harness?.testName;
    const turnOutcomes = ensureArray(sample.result?.providerReplay?.turns).map(replayTurnOutcome);
    const replayTurns = ensureArray(sample.result?.providerReplay?.turns);
    const spec = specs.find((candidate) => candidate.title === testName);
    const testResult = ensureArray(spec?.tests)[0];
    const resultRecord = ensureArray(testResult?.results)[0];
    const status = resultRecord?.status ?? "missing";
    const durationMs = typeof resultRecord?.duration === "number" ? resultRecord.duration : null;
    const perSampleSoftWarnings = [];

    for (const assertion of ensureArray(sample.assertions?.hard)) {
      if (
        assertion.type === "runtime-isolation" &&
        typeof assertion.forbidLogPattern === "string" &&
        combinedLogs.includes(assertion.forbidLogPattern)
      ) {
        hardFailures.push(
          `${meta.id}: forbidden runtime-isolation log pattern present: ${assertion.forbidLogPattern}`
        );
      }
    }

    if (sample.process?.errorRecovery?.expected === true) {
      const expectedFailureClasses = ensureArray(
        sample.process.errorRecovery.expectedFailureClasses
      );
      const disallowedFailureClasses = ensureArray(
        sample.process.errorRecovery.disallowedFailureClasses
      );
      const firstFailureIndex = turnOutcomes.indexOf("failed");
      const recoveredIndex = turnOutcomes.findIndex(
        (outcome, index) => index > firstFailureIndex && outcome === "completed"
      );
      const failureTurn = firstFailureIndex >= 0 ? replayTurns[firstFailureIndex] : null;
      const failureClass = resolveRuntimeReplayFailureClass(failureTurn?.failure);
      if (firstFailureIndex < 0 || recoveredIndex < 0) {
        hardFailures.push(
          `${meta.id}: replay data does not preserve a failed-then-recovered turn order`
        );
      }
      if (expectedFailureClasses.length > 0 && !expectedFailureClasses.includes(failureClass)) {
        hardFailures.push(
          `${meta.id}: failure class ${failureClass ?? "unknown"} did not match expectedFailureClasses`
        );
      }
      if (failureClass && disallowedFailureClasses.includes(failureClass)) {
        hardFailures.push(
          `${meta.id}: failure class ${failureClass} matched disallowedFailureClasses`
        );
      }
    }

    for (const assertion of ensureArray(sample.assertions?.soft)) {
      if (assertion.type === "duration-ms" && durationMs !== null && durationMs > assertion.max) {
        perSampleSoftWarnings.push(`duration ${durationMs}ms exceeded budget ${assertion.max}ms`);
      }
      if (assertion.type === "log-warning-budget" && actionableWarningCount > assertion.max) {
        perSampleSoftWarnings.push(
          `warning count ${actionableWarningCount} exceeded budget ${assertion.max}`
        );
      }
      if (assertion.type === "delta-chunk-range") {
        const turnIndex = Number.parseInt(String(assertion.turnId).replace("turn-", ""), 10) - 1;
        const deltaCount = ensureArray(
          sample.result?.providerReplay?.turns?.[turnIndex]?.deltaChunks
        ).length;
        if (deltaCount < assertion.min || deltaCount > assertion.max) {
          perSampleSoftWarnings.push(
            `delta chunk count ${deltaCount} outside range ${assertion.min}-${assertion.max}`
          );
        }
      }
    }

    if (status !== "passed") {
      hardFailures.push(`${meta.id}: playwright status ${status}`);
    }

    for (const warning of perSampleSoftWarnings) {
      softWarnings.push(`${meta.id}: ${warning}`);
    }

    const liveFailureProbe = sample.governance?.liveFailureProbe;
    const lastLiveFailureProbeRun =
      liveFailureProbe && typeof liveFailureProbe === "object" ? liveFailureProbe.lastRun : null;
    const evidenceSources = replayTurns.map((turn) => turn?.provenance?.source ?? "unknown");
    const recoveryQualification =
      sample.process?.errorRecovery?.expected === true
        ? (sample.governance?.recoveryQualification ??
          summarizeRuntimeReplayRecoveryQualification(sample))
        : null;
    const sampleMetrics = summarizeRuntimeReplaySampleMetrics(sample, nowMs);
    const failureTurnIndex = turnOutcomes.indexOf("failed");
    const recoveryTurnIndex = turnOutcomes.findIndex(
      (outcome, index) => index > failureTurnIndex && outcome === "completed"
    );
    const failureTurn = failureTurnIndex >= 0 ? replayTurns[failureTurnIndex] : null;
    const failureClass = recoveryQualification?.observedFailureClass ?? null;
    const expectedFailureClasses = recoveryQualification?.expectedFailureClasses ?? [];
    const disallowedFailureClasses = recoveryQualification?.disallowedFailureClasses ?? [];
    const isRecoverySample = sample.process?.errorRecovery?.expected === true;
    const promotionBlockers = isRecoverySample
      ? [...ensureArray(recoveryQualification?.goldenBlockers)]
      : [...deriveRuntimeReplayGovernanceGoldenBlockers(sample)];
    if (evidenceSources.some((source) => source !== "recorded")) {
      promotionBlockers.push("evidence_not_fully_recorded");
    }
    if (status !== "passed") {
      promotionBlockers.push("playwright_not_green");
    }
    if (isRecoverySample && (failureTurnIndex < 0 || recoveryTurnIndex < 0)) {
      promotionBlockers.push("failed_then_recovered_not_observed");
    }
    if (
      isRecoverySample &&
      expectedFailureClasses.length > 0 &&
      !expectedFailureClasses.includes(failureClass)
    ) {
      promotionBlockers.push("failure_class_drifted");
    }
    if (isRecoverySample && failureClass && disallowedFailureClasses.includes(failureClass)) {
      promotionBlockers.push("failure_class_disallowed");
    }
    if (actionableWarningCount > 0) {
      promotionBlockers.push("actionable_runtime_warnings_present");
    }
    const rerecordStability = recoveryQualification?.rerecordStability;
    if (isRecoverySample && rerecordStability && rerecordStability.status !== "stable-compatible") {
      if (rerecordStability.status === "drifting") {
        promotionBlockers.push("live_failure_class_drift_observed");
      } else if (rerecordStability.status === "missing") {
        promotionBlockers.push("live_failure_probe_missing");
      } else {
        promotionBlockers.push("live_failure_class_incompatible");
      }
    }

    sampleReports.push({
      id: meta.id,
      testName,
      status,
      durationMs,
      turnOutcomes,
      failedTurnCount: turnOutcomes.filter((outcome) => outcome === "failed").length,
      successfulTurnCount: turnOutcomes.filter((outcome) => outcome === "completed").length,
      failureLeg: {
        observed: failureTurnIndex >= 0,
        turnIndex: failureTurnIndex >= 0 ? failureTurnIndex + 1 : null,
        failureClass,
        expectedFailureClasses,
        disallowedFailureClasses,
        matchedExpectedFailureClass:
          expectedFailureClasses.length === 0
            ? null
            : expectedFailureClasses.includes(failureClass),
        provenanceSource: failureTurn?.provenance?.source ?? null,
      },
      recoveryLeg: {
        observed: recoveryTurnIndex >= 0,
        turnIndex: recoveryTurnIndex >= 0 ? recoveryTurnIndex + 1 : null,
        recoveryTurnId: sample.process?.errorRecovery?.recoveryTurnId ?? null,
        provenanceSource:
          recoveryTurnIndex >= 0
            ? (replayTurns[recoveryTurnIndex]?.provenance?.source ?? null)
            : null,
      },
      candidateToGolden: {
        eligible: promotionBlockers.length === 0,
        blockers: [...new Set(promotionBlockers)],
      },
      sampleAgeMs: sampleMetrics.sampleAgeMs,
      lastVerifiedAt: sampleMetrics.lastVerifiedAt,
      rerecordSuccessRate: sampleMetrics.rerecordSuccessRate,
      blockerDwellTime: sampleMetrics.blockerDwellTime,
      deterministicRegressions: normalizeRuntimeReplayDeterministicRegressions(sample),
      baselineReadiness: summarizeRuntimeReplayBaselineReadiness(
        sample,
        backgroundReadyMap.get(meta.id) ?? null
      ),
      recoveryQualification,
      liveFailureProbe: lastLiveFailureProbeRun
        ? {
            profileId: liveFailureProbe.profileId,
            turnId: liveFailureProbe.turnId,
            attempts: lastLiveFailureProbeRun.attempts,
            observedFailureClasses: lastLiveFailureProbeRun.observedFailureClasses,
            stable: lastLiveFailureProbeRun.stable,
            driftObserved: lastLiveFailureProbeRun.driftObserved,
            matchedExpectedFailureClass:
              lastLiveFailureProbeRun.observedFailureClasses.length === 1 &&
              ensureArray(liveFailureProbe.expectedFailureClasses).includes(
                lastLiveFailureProbeRun.observedFailureClasses[0]
              ),
          }
        : null,
      evidenceSources,
      softWarnings: perSampleSoftWarnings,
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    datasetId: dataset.manifest.datasetId,
    selection: selectedSamples.map((entry) => entry.sample.sample.id),
    scenarioStats,
    backgroundReadyQueue,
    baselineGovernance,
    evolutionSignals: summarizeRuntimeReplayEvolutionSignals(selectedSamples),
    lineageGraphSummary: buildRuntimeReplayLineageGraph({ dataset, selectedSamples }).summary,
    regressionCoverage,
    hardAssertions: {
      passed: hardFailures.length === 0,
      failures: hardFailures,
    },
    softAssertions: {
      passed: softWarnings.length === 0,
      warnings: softWarnings,
      actionableWarningCount,
      ignoredWarningCount: warningSummary.ignored.length,
      ignoredWarnings: warningSummary.ignored,
      actionableWarnings: warningSummary.actionable,
    },
    samples: sampleReports,
  };
}
