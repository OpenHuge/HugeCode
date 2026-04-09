import type { GitCommitDiff } from "../../../types";
import type { GitLogResponse } from "@ku0/code-runtime-host-contract";
import { resolveAutoDriveExternalResearchPolicy } from "./runtimeToolExecutionPolicy";
import { dedupeNonEmpty, extractRuleEvidence } from "./runtimeAutoDriveContextSignals";
import type {
  AutoDriveCollaboratorIntent,
  AutoDriveCommitEvidence,
  AutoDriveContextSnapshot,
  AutoDriveControllerDeps,
  AutoDriveDestinationModel,
  AutoDriveExternalResearchEntry,
  AutoDriveIterationSummary,
  AutoDriveRepoBacklog,
  AutoDriveRepoEvaluationProfile,
  AutoDriveRiskLevel,
  AutoDriveRuleEvidence,
  AutoDriveRunRecord,
  AutoDriveStartStateModel,
  AutoDriveThreadContext,
} from "../types/autoDrive";

export const DEFAULT_GIT_WINDOW = 12;

const RELEVANT_DOC_PATHS = [
  "AGENTS.md",
  "README.md",
  "docs/development/README.md",
  "CODING_STANDARDS.md",
  ".agent/quality-gates.md",
  ".agent/agent-specs.md",
];

const EVALUATION_SAMPLE_PATHS = [
  ".codex/e2e-map.json",
  "tests",
  "test",
  "fixtures",
  "__fixtures__",
  "playwright",
];

export async function maybeRunExternalResearch(params: {
  deps: AutoDriveControllerDeps;
  run: AutoDriveRunRecord;
  previousSummary: AutoDriveIterationSummary | null;
}): Promise<{
  researchPolicy: NonNullable<AutoDriveContextSnapshot["researchPolicy"]>;
  externalResearch: AutoDriveExternalResearchEntry[];
}> {
  const researchPolicy = resolveAutoDriveExternalResearchPolicy({
    allowNetworkAnalysis: params.run.riskPolicy.allowNetworkAnalysis,
    modelId: params.run.execution?.modelId ?? null,
    destinationTitle: params.run.destination.title,
    desiredEndState: params.run.destination.desiredEndState,
    arrivalCriteria: params.run.destination.doneDefinition.arrivalCriteria,
    hardBoundaries: params.run.destination.hardBoundaries,
    previousSummaryText: params.previousSummary?.summaryText ?? null,
  });
  if (!researchPolicy.enabled || !researchPolicy.query) {
    return {
      researchPolicy,
      externalResearch: [],
    };
  }
  const query = researchPolicy.query;
  try {
    const result = await params.deps.runRuntimeExecutableSkill({
      request: {
        skillId: "network-analysis",
        input: query,
        context: {
          provider: researchPolicy.provider,
          modelId: params.run.execution?.modelId ?? null,
        },
        options: {
          workspaceId: params.run.workspaceId,
          allowNetwork: true,
          fetchPageContent: researchPolicy.fetchPageContent,
          recencyDays: researchPolicy.recencyDays ?? 30,
        },
      },
    });
    return {
      researchPolicy,
      externalResearch: [
        {
          query,
          summary: result.output?.trim() || "Network analysis completed.",
          sources: Array.isArray(result.network?.items)
            ? result.network.items
                .map((item) => item.url)
                .filter((url): url is string => typeof url === "string" && url.length > 0)
                .slice(0, 5)
            : [],
        },
      ],
    };
  } catch {
    return {
      researchPolicy,
      externalResearch: [],
    };
  }
}

export async function readRepoBacklog(
  deps: AutoDriveControllerDeps,
  workspaceId: string
): Promise<AutoDriveRepoBacklog> {
  try {
    const [issuesResponse, pullRequestsResponse] = await Promise.all([
      deps.getGitHubIssues?.(workspaceId) ?? Promise.resolve(null),
      deps.getGitHubPullRequests?.(workspaceId) ?? Promise.resolve(null),
    ]);
    const issueHighlights =
      issuesResponse?.issues
        ?.slice(0, 2)
        .map((issue) => `Issue #${issue.number}: ${issue.title}`) ?? [];
    const pullRequestHighlights =
      pullRequestsResponse?.pullRequests
        ?.slice(0, 2)
        .map((pullRequest) => `PR #${pullRequest.number}: ${pullRequest.title}`) ?? [];
    return {
      openIssues: issuesResponse?.total ?? null,
      openPullRequests: pullRequestsResponse?.total ?? null,
      highlights: [...issueHighlights, ...pullRequestHighlights].slice(0, 4),
    };
  } catch {
    return {
      openIssues: null,
      openPullRequests: null,
      highlights: [],
    };
  }
}

function buildThreadSnapshotKey(workspaceId: string, threadId: string): string {
  return `${workspaceId}:${threadId}`;
}

export async function readThreadContext(
  deps: AutoDriveControllerDeps,
  input: {
    workspaceId: string;
    threadId: string | null;
  }
): Promise<AutoDriveThreadContext | null> {
  if (!input.threadId || !deps.readPersistedThreadSnapshots) {
    return null;
  }
  try {
    const emptyMemoryDigests: Record<string, { summary: string; updatedAt: number }> = {};
    const [snapshots, memoryDigests] = await Promise.all([
      deps.readPersistedThreadSnapshots(),
      deps.readThreadAtlasMemoryDigests?.() ?? Promise.resolve(emptyMemoryDigests),
    ]);
    const snapshot = snapshots[buildThreadSnapshotKey(input.workspaceId, input.threadId)];
    const memoryDigest = memoryDigests[buildThreadSnapshotKey(input.workspaceId, input.threadId)];
    const longTermMemorySummary =
      typeof memoryDigest?.summary === "string" && memoryDigest.summary.trim().length > 0
        ? memoryDigest.summary.trim()
        : null;
    const longTermMemoryUpdatedAt =
      typeof memoryDigest?.updatedAt === "number" && Number.isFinite(memoryDigest.updatedAt)
        ? memoryDigest.updatedAt
        : null;
    if (!snapshot || !Array.isArray(snapshot.items)) {
      return longTermMemorySummary
        ? {
            threadId: input.threadId,
            snapshotUpdatedAt: null,
            recentUserPrompts: [],
            recentAssistantReplies: [],
            longTermMemorySummary,
            longTermMemoryUpdatedAt,
            summary: `Long-term thread memory: ${longTermMemorySummary}`,
          }
        : null;
    }
    const messageItems = snapshot.items.filter(
      (item): item is Extract<(typeof snapshot.items)[number], { kind: "message" }> =>
        item.kind === "message"
    );
    const recentUserPrompts = messageItems
      .filter((item) => item.role === "user")
      .slice(-3)
      .map((item) => item.text.trim())
      .filter((text) => text.length > 0);
    const recentAssistantReplies = messageItems
      .filter((item) => item.role === "assistant")
      .slice(-2)
      .map((item) => item.text.trim())
      .filter((text) => text.length > 0);
    if (
      recentUserPrompts.length === 0 &&
      recentAssistantReplies.length === 0 &&
      !longTermMemorySummary
    ) {
      return null;
    }
    const summaryParts = [
      longTermMemorySummary ? `Long-term thread memory: ${longTermMemorySummary}` : null,
      recentUserPrompts.length > 0
        ? `Recent operator prompts: ${recentUserPrompts.join(" | ")}`
        : null,
      recentAssistantReplies.length > 0
        ? `Recent assistant replies: ${recentAssistantReplies.join(" | ")}`
        : null,
    ].filter((value): value is string => Boolean(value));
    return {
      threadId: input.threadId,
      snapshotUpdatedAt:
        typeof snapshot.updatedAt === "number" && Number.isFinite(snapshot.updatedAt)
          ? snapshot.updatedAt
          : null,
      recentUserPrompts,
      recentAssistantReplies,
      longTermMemorySummary,
      longTermMemoryUpdatedAt,
      summary: summaryParts.join(" "),
    };
  } catch {
    return null;
  }
}

function parsePackageScripts(content: string): AutoDriveContextSnapshot["repo"]["scripts"] {
  try {
    const parsed = JSON.parse(content) as {
      scripts?: Record<string, string>;
      packageManager?: string;
    };
    const scripts = parsed.scripts ?? {};
    return {
      test: scripts.test,
      testComponent: scripts["test:component"],
      dev: scripts.dev,
      build: scripts.build,
      validateFast: scripts["validate:fast"],
      validate: scripts.validate,
      validateFull: scripts["validate:full"],
      preflight: scripts["preflight:codex"],
      ...Object.fromEntries(Object.entries(scripts).filter(([key]) => key.startsWith("test:e2e:"))),
    };
  } catch {
    return {};
  }
}

function resolveRepresentativeEvaluationCommands(
  scripts: AutoDriveContextSnapshot["repo"]["scripts"],
  files: string[]
): string[] {
  return dedupeNonEmpty([
    scripts.test,
    scripts.validateFast,
    scripts.test == null && scripts.validateFast == null ? scripts.validate : null,
    files.includes("Cargo.toml") ? "cargo test" : null,
  ]);
}

function parseEvaluationScenarioKeys(content: string): string[] {
  try {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    if (parsed == null || Array.isArray(parsed) || typeof parsed !== "object") {
      return [];
    }
    return dedupeNonEmpty(
      Object.entries(parsed).map(([key, value]) =>
        typeof value === "string" && value.trim().length > 0 ? key : null
      )
    );
  } catch {
    return [];
  }
}

export async function readRepoEvaluationProfile(params: {
  deps: AutoDriveControllerDeps;
  workspaceId: string;
  files: string[];
  scripts: AutoDriveContextSnapshot["repo"]["scripts"];
}): Promise<AutoDriveRepoEvaluationProfile> {
  const representativeCommands = resolveRepresentativeEvaluationCommands(
    params.scripts,
    params.files
  );
  const componentCommands = dedupeNonEmpty([params.scripts.testComponent]);
  const endToEndCommands = dedupeNonEmpty(
    Object.entries(params.scripts)
      .filter(([key, value]) => key.startsWith("test:e2e:") && typeof value === "string")
      .map(([, value]) => value)
  );
  const samplePaths = EVALUATION_SAMPLE_PATHS.filter((candidate) =>
    params.files.some((path) => path === candidate || path.startsWith(`${candidate}/`))
  );
  const scenarioKeys = params.files.includes(".codex/e2e-map.json")
    ? parseEvaluationScenarioKeys(
        (
          await params.deps
            .readWorkspaceFile(params.workspaceId, ".codex/e2e-map.json")
            .catch(() => ({ content: "", truncated: false }))
        ).content
      )
    : [];
  const sourceSignals = dedupeNonEmpty([
    representativeCommands.length > 0 ? "representative_commands" : null,
    componentCommands.length > 0 ? "component_commands" : null,
    endToEndCommands.length > 0 ? "end_to_end_commands" : null,
    samplePaths.length > 0 ? "sample_paths" : null,
    params.files.includes(".codex/e2e-map.json") ? "e2e_map" : null,
    scenarioKeys.length > 0 ? "scenario_keys" : null,
    params.files.includes("Cargo.toml") ? "cargo_test" : null,
  ]);
  const heldOutGuidance =
    samplePaths.length > 0
      ? [
          "Keep at least one held-out fixture or representative scenario untouched so drift detection stays meaningful.",
        ]
      : [];

  return {
    representativeCommands,
    componentCommands,
    endToEndCommands,
    samplePaths,
    heldOutGuidance,
    sourceSignals,
    scenarioKeys,
  };
}

export async function readRelevantDocs(
  deps: AutoDriveControllerDeps,
  workspaceId: string,
  files: string[]
): Promise<{
  ruleEvidence: AutoDriveRuleEvidence[];
  docs: AutoDriveRuleEvidence[];
  scripts: AutoDriveContextSnapshot["repo"]["scripts"];
  evaluation: AutoDriveRepoEvaluationProfile;
  packageManager: string | null;
}> {
  const selectedPaths = RELEVANT_DOC_PATHS.filter((path) => files.includes(path)).slice(0, 6);
  const ruleEvidence: AutoDriveRuleEvidence[] = [];
  const docs: AutoDriveRuleEvidence[] = [];
  let scripts: AutoDriveContextSnapshot["repo"]["scripts"] = {};
  let packageManager: string | null = null;

  if (files.includes("package.json")) {
    try {
      const packageJson = await deps.readWorkspaceFile(workspaceId, "package.json");
      scripts = parsePackageScripts(packageJson.content);
      const parsed = JSON.parse(packageJson.content) as { packageManager?: string };
      packageManager = typeof parsed.packageManager === "string" ? parsed.packageManager : null;
    } catch {
      packageManager = null;
    }
  }
  const evaluation = await readRepoEvaluationProfile({
    deps,
    workspaceId,
    files,
    scripts,
  });

  for (const path of selectedPaths) {
    try {
      const file = await deps.readWorkspaceFile(workspaceId, path);
      const extracted = extractRuleEvidence(path, file.content);
      if (!extracted) {
        continue;
      }
      if (path === "AGENTS.md" || path.startsWith(".agent/")) {
        ruleEvidence.push(extracted);
      } else {
        docs.push(extracted);
      }
    } catch {
      continue;
    }
  }

  return { ruleEvidence, docs, scripts, evaluation, packageManager };
}

export async function loadCommitEvidence(
  deps: AutoDriveControllerDeps,
  workspaceId: string,
  commits: GitLogResponse["entries"]
): Promise<AutoDriveCommitEvidence[]> {
  const limited = commits.slice(0, Math.min(DEFAULT_GIT_WINDOW, commits.length));
  const output: AutoDriveCommitEvidence[] = [];

  for (const commit of limited) {
    let diff: GitCommitDiff[] = [];
    try {
      diff = await deps.getGitCommitDiff(workspaceId, commit.sha);
    } catch {
      diff = [];
    }
    output.push({
      ...commit,
      touchedPaths: diff.map((entry) => entry.path).filter((path) => path.trim().length > 0),
    });
  }

  return output;
}

function toStopRisk(input: {
  run: AutoDriveRunRecord;
  previousSummary: AutoDriveIterationSummary | null;
  gitChangedPaths: string[];
}): AutoDriveRiskLevel {
  if (
    input.run.totals.validationFailureCount >= input.run.budget.maxValidationFailures ||
    input.run.totals.rerouteCount >= input.run.budget.maxReroutes
  ) {
    return "high";
  }
  if (
    input.previousSummary?.routeHealth.offRoute ||
    input.run.totals.noProgressCount >= input.run.budget.maxNoProgressIterations - 1 ||
    input.gitChangedPaths.length > (input.run.budget.maxFilesPerIteration ?? 6)
  ) {
    return "medium";
  }
  return "low";
}

export function buildStartState(params: {
  run: AutoDriveRunRecord;
  destination: AutoDriveDestinationModel;
  previousSummary: AutoDriveIterationSummary | null;
  gitBranch: string | null;
  gitChangedPaths: string[];
  commits: AutoDriveCommitEvidence[];
  collaboratorIntent: AutoDriveCollaboratorIntent;
}): AutoDriveStartStateModel {
  const {
    run,
    destination,
    previousSummary,
    gitBranch,
    gitChangedPaths,
    commits,
    collaboratorIntent,
  } = params;
  const remainingTokens =
    run.budget.maxTokens > 0
      ? Math.max(0, run.budget.maxTokens - run.totals.consumedTokensEstimate)
      : null;
  const remainingIterations = Math.max(0, run.budget.maxIterations - run.iteration);
  const remainingDurationMs =
    run.budget.maxDurationMs === null
      ? null
      : Math.max(0, run.budget.maxDurationMs - run.totals.elapsedMs);
  const stopRisk = toStopRisk({
    run,
    previousSummary,
    gitChangedPaths,
  });
  const pendingMilestones = previousSummary?.progress.remainingMilestones.length
    ? previousSummary.progress.remainingMilestones
    : destination.doneDefinition.arrivalCriteria;
  const routeHealth = {
    offRoute: previousSummary?.routeHealth.offRoute ?? false,
    noProgressLoop:
      (previousSummary?.routeHealth.noProgressLoop ?? false) ||
      run.totals.noProgressCount >= run.budget.maxNoProgressIterations - 1,
    rerouteRecommended:
      previousSummary?.routeHealth.rerouteRecommended ??
      run.totals.noProgressCount >= run.budget.maxNoProgressIterations - 1,
    rerouteReason:
      previousSummary?.routeHealth.rerouteReason ??
      (run.totals.noProgressCount >= run.budget.maxNoProgressIterations - 1
        ? "No-progress threshold is approaching."
        : null),
    triggerSignals: previousSummary?.routeHealth.triggerSignals.length
      ? previousSummary.routeHealth.triggerSignals
      : [
          remainingIterations <= 1 ? "Iteration budget nearly exhausted." : null,
          remainingTokens !== null && remainingTokens <= Math.ceil(run.budget.maxTokens * 0.2)
            ? "Token budget is under 20%."
            : null,
          gitChangedPaths.length > 0
            ? `Working tree already has ${gitChangedPaths.length} changed paths.`
            : null,
        ].filter((value): value is string => Boolean(value)),
  };

  return {
    summary: [
      `Branch ${gitBranch ?? "unknown"} with ${gitChangedPaths.length} changed path(s).`,
      `Route preference is ${destination.routePreference.replace(/_/g, " ")}.`,
      previousSummary?.progress.remainingDistance ?? "No prior route distance is available yet.",
    ].join(" "),
    repo: {
      branch: gitBranch,
      dirtyWorkingTree: gitChangedPaths.length > 0,
      recentCommits: commits.slice(0, 3).map((commit) => commit.summary),
      touchedAreas: collaboratorIntent.touchedAreas,
      changedPaths: gitChangedPaths,
      unresolvedBlockers: previousSummary?.blockers ?? run.blockers,
    },
    task: {
      completedSubgoals: [
        ...new Set([...run.completedSubgoals, ...(previousSummary?.completedSubgoals ?? [])]),
      ],
      pendingMilestones,
      confidence: previousSummary?.progress.arrivalConfidence ?? "medium",
      risk: stopRisk,
      currentBlocker: previousSummary?.blockers[0] ?? run.currentBlocker ?? run.blockers[0] ?? null,
    },
    system: {
      consumedTokensEstimate: run.totals.consumedTokensEstimate,
      remainingTokensEstimate: remainingTokens,
      iterationsUsed: run.iteration,
      remainingIterations,
      elapsedMs: run.totals.elapsedMs,
      remainingDurationMs,
      validationFailureCount: run.totals.validationFailureCount,
      noProgressCount: run.totals.noProgressCount,
      repeatedFailureCount: run.totals.repeatedFailureCount,
      rerouteCount: run.totals.rerouteCount,
      stopRisk,
    },
    routeHealth,
  };
}
