import type { GitCommitDiff } from "../../../types";
import type { GitLogResponse } from "@ku0/code-runtime-host-contract";
import type {
  AutoDriveCollaboratorBoundarySignal,
  AutoDriveCollaboratorIntent,
  AutoDriveCommitEvidence,
  AutoDriveContextSnapshot,
  AutoDriveDirectionHypothesis,
  AutoDriveControllerDeps,
  AutoDriveDestinationModel,
  AutoDriveExecutionTuning,
  AutoDriveExternalResearchEntry,
  AutoDriveHistoricalPublishCorridor,
  AutoDriveIntentModel,
  AutoDriveIntentSignal,
  AutoDriveIterationSummary,
  AutoDriveOpportunityQueue,
  AutoDrivePublishReadiness,
  AutoDriveRepoBacklog,
  AutoDriveRepoEvaluationProfile,
  AutoDriveRiskLevel,
  AutoDriveRuleEvidence,
  AutoDriveRunRecord,
  AutoDriveStartStateModel,
  AutoDriveThreadContext,
} from "../types/autoDrive";
import {
  buildCommitMomentum,
  buildExecutionFeedbackSignal,
  buildRouteStagnationSignal,
  type CommitMomentumSignal,
  type RouteStagnationSignal,
} from "./runtimeAutoDriveRouteSignals";
import { scoreAutoDriveOpportunityQueue } from "./runtimeAutoDriveOpportunityScoring";
import {
  findBestHistoricalPublishCorridor,
  hasHistoricalPublishedCorridor,
  findHistoricalPublishFailureSummary,
  loadHistoricalAutoDrivePublishHandoffs,
  loadHistoricalAutoDriveRuns,
} from "./runtimeAutoDriveHistory";
import { resolveAutoDriveExternalResearchPolicy } from "./runtimeToolExecutionPolicy";

const DEFAULT_GIT_WINDOW = 12;
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

function normalizeLine(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.replace(/^[-*]\s*/, "");
}

function extractRuleEvidence(path: string, content: string): AutoDriveRuleEvidence | null {
  const lines = content
    .split(/\r?\n/)
    .map(normalizeLine)
    .filter((line): line is string => Boolean(line))
    .filter((line) =>
      /(validate|preflight|runtime|boundary|workflow|composer|manual|budget|risk|stop|route)/i.test(
        line
      )
    )
    .slice(0, 3);
  if (lines.length === 0) {
    return null;
  }
  return {
    path,
    summary: lines.join(" "),
  };
}

function extractWorkspaceMarkers(files: string[]): string[] {
  return ["pnpm-workspace.yaml", "turbo.json", "package.json", "apps/code", "packages"].filter(
    (marker) => files.some((file) => file === marker || file.startsWith(`${marker}/`))
  );
}

function summarizeArea(path: string): string {
  if (!path.includes("/")) {
    return path;
  }
  const segments = path.split("/").filter(Boolean);
  if (segments[0] === "apps" && segments.length >= 5) {
    if (segments[3] === "features" || segments[3] === "application") {
      return segments.slice(0, 5).join("/");
    }
    return segments.slice(0, 4).join("/");
  }
  if (segments[0] === "packages" && segments.length >= 2) {
    return segments.slice(0, 2).join("/");
  }
  if (segments[0] === "docs" && segments.length >= 2) {
    return segments.slice(0, 2).join("/");
  }
  return segments.slice(0, Math.min(3, segments.length)).join("/");
}

function rankPaths(paths: string[], limit: number): string[] {
  const counts = new Map<string, number>();
  for (const path of paths) {
    const area = summarizeArea(path);
    counts.set(area, (counts.get(area) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, limit)
    .map(([area]) => area);
}

function buildBoundarySignals(
  commits: AutoDriveCommitEvidence[]
): AutoDriveCollaboratorBoundarySignal[] {
  const signals: AutoDriveCollaboratorBoundarySignal[] = [];
  for (const commit of commits) {
    for (const path of commit.touchedPaths) {
      if (
        path === "AGENTS.md" ||
        path === "CODING_STANDARDS.md" ||
        path.startsWith(".agent/") ||
        path.startsWith("docs/")
      ) {
        signals.push({
          path,
          summary: `${commit.summary} (${commit.author})`,
        });
      }
    }
  }
  return signals.slice(0, 6);
}

function buildCollaboratorIntent(
  run: AutoDriveRunRecord,
  commits: AutoDriveCommitEvidence[],
  ruleEvidence: AutoDriveRuleEvidence[],
  momentum: CommitMomentumSignal
): AutoDriveCollaboratorIntent {
  const touchedPaths = commits.flatMap((commit) => commit.touchedPaths);
  const touchedAreas =
    momentum.topAreas.length > 0 ? momentum.topAreas : rankPaths(touchedPaths, 4);
  const boundarySignals = buildBoundarySignals(commits);
  const commitSummary = commits
    .slice(0, 3)
    .map((commit) => commit.summary)
    .join("; ");
  const recentDirection =
    touchedAreas.length > 0
      ? `Recent work is concentrating on ${touchedAreas.join(", ")} with ${Math.round(momentum.alignmentScore * 100)}% destination alignment.`
      : "Recent work direction is weakly signaled.";
  const probableIntent = (() => {
    if (boundarySignals.length > 0 || ruleEvidence.length > 0) {
      return momentum.alignedSummaries.length > 0
        ? `Recent activity suggests the team is tightening runtime and workflow boundaries. Aligned commit momentum: ${momentum.alignedSummaries.join(" | ")}`
        : "Recent activity suggests the team is tightening runtime and workflow boundaries while continuing feature work in hot surfaces.";
    }
    if (momentum.alignedSummaries.length > 0) {
      return `Recent commit momentum aligns with destination intent: ${momentum.alignedSummaries.join(" | ")}`;
    }
    return `Recent commit themes: ${commitSummary || "limited signal available"}`;
  })();
  const conflictRisk: AutoDriveCollaboratorIntent["conflictRisk"] =
    boundarySignals.length >= 2 && /refactor|rewrite|migrate/i.test(run.destination.title)
      ? "high"
      : momentum.hasHighDivergence
        ? "high"
        : touchedAreas.length > 0
          ? "medium"
          : "low";
  const confidence: AutoDriveCollaboratorIntent["confidence"] =
    commits.length >= 6 && touchedAreas.length >= 2 && momentum.alignmentScore >= 0.45
      ? "high"
      : commits.length >= 4 && touchedAreas.length >= 2 && momentum.alignmentScore >= 0.25
        ? "medium"
        : "low";

  return {
    recentDirection,
    touchedAreas,
    boundarySignals,
    probableIntent,
    conflictRisk,
    confidence,
  };
}

function dedupeNonEmpty(values: Array<string | null | undefined>, limit = values.length): string[] {
  return [
    ...new Set(values.map((value) => value?.trim() ?? "").filter((value) => value.length > 0)),
  ].slice(0, limit);
}

function buildIntentModel(params: {
  run: AutoDriveRunRecord;
  previousSummary: AutoDriveIterationSummary | null;
  collaboratorIntent: AutoDriveCollaboratorIntent;
  momentum: CommitMomentumSignal;
  routeStagnation: RouteStagnationSignal;
  ruleEvidence: AutoDriveRuleEvidence[];
  externalResearch: AutoDriveExternalResearchEntry[];
  repoBacklog: AutoDriveRepoBacklog;
  threadContext: AutoDriveThreadContext | null;
  relevantFiles: string[];
  blockers: string[];
}): AutoDriveIntentModel {
  const {
    run,
    previousSummary,
    collaboratorIntent,
    momentum,
    routeStagnation,
    ruleEvidence,
    externalResearch,
    repoBacklog,
    threadContext,
    relevantFiles,
  } = params;
  const blockers = dedupeNonEmpty(params.blockers, 3);
  const signals: AutoDriveIntentSignal[] = [
    {
      kind: "operator_intent",
      summary: `Operator destination: ${run.destination.title}`,
      source: "destination",
      confidence: "high",
    },
  ];

  if (previousSummary?.summaryText) {
    signals.push({
      kind: "previous_summary",
      summary: previousSummary.summaryText,
      source: previousSummary.task.taskId,
      confidence: previousSummary.progress.arrivalConfidence,
    });
  }

  signals.push({
    kind: "collaborator_intent",
    summary: collaboratorIntent.probableIntent,
    source: null,
    confidence: collaboratorIntent.confidence,
  });
  if (momentum.alignedSummaries.length > 0) {
    signals.push({
      kind: "collaborator_intent",
      summary: `Git momentum: ${momentum.alignedSummaries.join(" | ")}`,
      source: "git_log",
      confidence: momentum.alignmentScore >= 0.35 ? "high" : "medium",
    });
  }

  for (const rule of ruleEvidence.slice(0, 2)) {
    signals.push({
      kind: "repo_rule",
      summary: rule.summary,
      source: rule.path,
      confidence: "high",
    });
  }

  for (const research of externalResearch.slice(0, 2)) {
    signals.push({
      kind: "external_research",
      summary: research.summary,
      source: research.sources[0] ?? null,
      confidence: "medium",
    });
  }

  if ((repoBacklog.openIssues ?? 0) > 0 || (repoBacklog.openPullRequests ?? 0) > 0) {
    signals.push({
      kind: "repo_backlog",
      summary:
        repoBacklog.highlights.join(" | ") ||
        "GitHub issues or pull requests indicate active external backlog pressure.",
      source: null,
      confidence: "medium",
    });
  }

  if (threadContext?.summary) {
    signals.push({
      kind: "thread_history",
      summary: threadContext.summary,
      source: threadContext.threadId,
      confidence: "medium",
    });
  }

  if (threadContext?.longTermMemorySummary) {
    signals.push({
      kind: "thread_memory",
      summary: threadContext.longTermMemorySummary,
      source: threadContext.threadId,
      confidence: "medium",
    });
  }

  if (routeStagnation.summary) {
    signals.push({
      kind: "blocker",
      summary: routeStagnation.summary,
      source: "iteration_history",
      confidence: routeStagnation.isStagnating ? "high" : "medium",
    });
  }

  for (const blocker of blockers) {
    signals.push({
      kind: "blocker",
      summary: blocker,
      source: null,
      confidence: "medium",
    });
  }

  const primaryHypothesis: AutoDriveDirectionHypothesis = {
    summary: `Advance ${run.destination.title} through the highest-signal repo surfaces first.`,
    rationale: [
      `Destination scope centers on ${run.destination.title}.`,
      collaboratorIntent.probableIntent,
      previousSummary?.summaryText ?? null,
      externalResearch[0]?.summary ?? null,
      threadContext?.summary ?? null,
    ]
      .filter((value): value is string => Boolean(value))
      .join(" "),
    suggestedAreas: dedupeNonEmpty(
      [
        ...(previousSummary?.suggestedNextAreas ?? []),
        ...relevantFiles,
        ...collaboratorIntent.touchedAreas,
      ],
      run.budget.maxFilesPerIteration ?? 6
    ),
    confidence:
      collaboratorIntent.confidence === "low" && !previousSummary && externalResearch.length === 0
        ? "low"
        : "medium",
    dominantSignalKinds: dedupeNonEmpty(
      [
        "operator_intent",
        collaboratorIntent.probableIntent ? "collaborator_intent" : null,
        previousSummary?.summaryText ? "previous_summary" : null,
        externalResearch.length > 0 ? "external_research" : null,
        (repoBacklog.openIssues ?? 0) > 0 || (repoBacklog.openPullRequests ?? 0) > 0
          ? "repo_backlog"
          : null,
        threadContext?.summary ? "thread_history" : null,
        threadContext?.longTermMemorySummary ? "thread_memory" : null,
      ],
      4
    ) as AutoDriveDirectionHypothesis["dominantSignalKinds"],
  };

  return {
    summary: [
      `Prioritize ${run.destination.title}.`,
      collaboratorIntent.probableIntent,
      blockers.length > 0 ? `Current blockers: ${blockers.join(" | ")}.` : null,
    ]
      .filter((value): value is string => Boolean(value))
      .join(" "),
    signals,
    directionHypotheses: [primaryHypothesis],
  };
}

function buildOpportunityQueue(params: {
  run: AutoDriveRunRecord;
  previousSummary: AutoDriveIterationSummary | null;
  intent: AutoDriveIntentModel;
  collaboratorIntent: AutoDriveCollaboratorIntent;
  momentum: CommitMomentumSignal;
  routeStagnation: RouteStagnationSignal;
  executionFeedback: AutoDriveExecutionTuning;
  externalResearch: AutoDriveExternalResearchEntry[];
  repoBacklog: AutoDriveRepoBacklog;
  threadContext: AutoDriveThreadContext | null;
  blockers: string[];
  changedPaths: string[];
  repoEvaluation: AutoDriveRepoEvaluationProfile;
  historicalPublishCorridor: AutoDriveHistoricalPublishCorridor | null;
  gitBehind: number;
}): AutoDriveOpportunityQueue {
  const candidates: Array<
    Omit<AutoDriveOpportunityQueue["candidates"][number], "score"> & { baseScore: number }
  > = [];
  const primaryHypothesis = params.intent.directionHypotheses[0] ?? null;

  if (primaryHypothesis && primaryHypothesis.suggestedAreas.length > 0) {
    candidates.push({
      id: "advance_primary_surface",
      title: "Advance the primary AutoDrive surface",
      summary: "Use the strongest direction hypothesis to move the destination forward.",
      rationale: primaryHypothesis.rationale,
      repoAreas: primaryHypothesis.suggestedAreas,
      baseScore: 72,
      confidence: primaryHypothesis.confidence,
      risk: "low",
    });
  }

  if (params.externalResearch.length > 0) {
    candidates.push({
      id: "use_fresh_research",
      title: "Apply fresh external guidance",
      summary: "Use newly gathered external guidance before widening implementation scope.",
      rationale: params.externalResearch[0]?.summary ?? "Fresh research is available.",
      repoAreas: primaryHypothesis?.suggestedAreas ?? [],
      baseScore: 60,
      confidence: "medium",
      risk: "low",
    });
  }

  if ((params.repoBacklog.openIssues ?? 0) > 0 || (params.repoBacklog.openPullRequests ?? 0) > 0) {
    candidates.push({
      id: "triage_external_backlog",
      title: "Triage external backlog pressure",
      summary: "Use GitHub backlog signals to keep the next route aligned with open work.",
      rationale: params.repoBacklog.highlights.join(" | ") || "External backlog is active.",
      repoAreas: primaryHypothesis?.suggestedAreas ?? [],
      baseScore: 55,
      confidence: "medium",
      risk: "low",
    });
  }

  if (params.threadContext?.recentUserPrompts.length) {
    candidates.push({
      id: "align_with_thread_history",
      title: "Align with recent thread prompts",
      summary: "Use recent operator prompts to keep the next route anchored to the active thread.",
      rationale: params.threadContext.summary ?? "Recent thread prompts are available.",
      repoAreas: primaryHypothesis?.suggestedAreas ?? [],
      baseScore: 58,
      confidence: "medium",
      risk: "low",
    });
  }

  if (params.momentum.alignedSummaries.length > 0 && params.momentum.topAreas.length > 0) {
    candidates.push({
      id: "follow_recent_commit_momentum",
      title: "Follow recent commit momentum",
      summary:
        "Use high-alignment commit momentum to choose the next AutoDrive execution corridor.",
      rationale: params.momentum.alignedSummaries.join(" | "),
      repoAreas: params.momentum.topAreas,
      baseScore: 62,
      confidence: params.momentum.alignmentScore >= 0.35 ? "high" : "medium",
      risk: "low",
    });
  }

  if (params.routeStagnation.isStagnating) {
    candidates.push({
      id: "break_route_stagnation",
      title: "Break route stagnation",
      summary:
        "Recent iterations are cycling through the same surfaces. Force a corrective route update.",
      rationale: params.routeStagnation.summary ?? "Stagnation detected from iteration history.",
      repoAreas: params.routeStagnation.repeatedAreas,
      baseScore: 68,
      confidence: "high",
      risk: "medium",
    });
  }

  if (params.executionFeedback.publishPriority === "prepare_branch") {
    candidates.push({
      id: "prepare_publish_corridor",
      title: "Prepare the publish corridor",
      summary: "Stabilize the working tree and handoff artifacts before widening scope again.",
      rationale: params.executionFeedback.summary,
      repoAreas: [
        `.hugecode/runs/${params.run.runId}/publish`,
        ...params.changedPaths.filter((path) => /autodrive|publish|ledger/i.test(path)).slice(0, 2),
      ],
      baseScore: 66,
      confidence: "medium",
      risk: "low",
    });
  }

  if (params.executionFeedback.publishPriority === "push_candidate") {
    candidates.push({
      id: "push_publish_candidate",
      title: "Push the publish candidate",
      summary: "The publish corridor looks stable enough to advance the isolated candidate branch.",
      rationale: [
        params.executionFeedback.summary,
        params.historicalPublishCorridor?.summaryText ?? null,
        params.historicalPublishCorridor?.validationSummary ?? null,
      ]
        .filter((value): value is string => Boolean(value))
        .join(" "),
      repoAreas: [
        `.hugecode/runs/${params.run.runId}/publish`,
        ...(params.historicalPublishCorridor?.changedFiles.length
          ? params.historicalPublishCorridor.changedFiles.slice(0, 2)
          : params.changedPaths
              .filter((path) => /autodrive|publish|ledger/i.test(path))
              .slice(0, 2)),
      ],
      baseScore: 70,
      confidence: "high",
      risk: "low",
    });
  }

  if (params.blockers.length > 0) {
    candidates.push({
      id: "resolve_active_blocker",
      title: "Resolve the active blocker",
      summary: "Address the highest-signal blocker before continuing route expansion.",
      rationale: params.blockers.join(" | "),
      repoAreas: primaryHypothesis?.suggestedAreas ?? [],
      baseScore: 64,
      confidence: "medium",
      risk: "medium",
    });
  }

  if (
    params.previousSummary?.validation.success === false ||
    params.run.destination.routePreference === "validation_first"
  ) {
    candidates.push({
      id: "tighten_validation_loop",
      title: "Tighten the validation loop",
      summary: "Favor validation before any broader implementation expansion.",
      rationale: [
        params.previousSummary?.validation.summary ??
          "The active route preference favors validation-first execution.",
        params.repoEvaluation.representativeCommands.length > 0
          ? `Representative evaluation lane: ${params.repoEvaluation.representativeCommands.join(" | ")}.`
          : null,
        params.repoEvaluation.heldOutGuidance[0] ?? null,
      ]
        .filter((value): value is string => Boolean(value))
        .join(" "),
      repoAreas: dedupeNonEmpty(
        [...params.repoEvaluation.samplePaths, ...(primaryHypothesis?.suggestedAreas ?? [])],
        4
      ),
      baseScore: 65,
      confidence: "medium",
      risk: "low",
    });
  }

  if (params.changedPaths.length > 0) {
    candidates.push({
      id: "stabilize_working_tree",
      title: "Stabilize the existing working tree",
      summary: "Use the current changed paths as the immediate execution corridor.",
      rationale: `Working tree already contains ${params.changedPaths.length} changed path(s).`,
      repoAreas: params.changedPaths,
      baseScore: 52,
      confidence: "medium",
      risk: "medium",
    });
  }
  return scoreAutoDriveOpportunityQueue({
    candidates,
    intent: params.intent,
    collaboratorIntent: params.collaboratorIntent,
    momentum: params.momentum,
    routeStagnation: params.routeStagnation,
    executionTuning: params.executionFeedback,
    externalResearch: params.externalResearch,
    repoBacklog: params.repoBacklog,
    repoEvaluation: params.repoEvaluation,
    threadContext: params.threadContext,
    blockers: params.blockers,
    changedPaths: params.changedPaths,
    previousSummary: params.previousSummary,
    historicalPublishCorridor: params.historicalPublishCorridor,
    git: {
      behind: params.gitBehind,
    },
  });
}

function buildPublishReadiness(params: {
  previousSummary: AutoDriveIterationSummary | null;
  blockers: string[];
  changedPaths: string[];
  git: {
    remote: string | null;
    upstream: string | null;
    behind: number;
  };
  stopRisk: AutoDriveRiskLevel;
}): AutoDrivePublishReadiness {
  const reasonCodes: AutoDrivePublishReadiness["reasonCodes"] = [];
  if (params.changedPaths.length > 0) {
    reasonCodes.push("dirty_working_tree");
  }
  if (!params.git.remote) {
    reasonCodes.push("missing_remote");
  }
  if (params.git.behind > 0) {
    reasonCodes.push("behind_remote");
  }
  if (params.blockers.length > 0) {
    reasonCodes.push("active_blockers");
  }
  if (params.previousSummary?.validation.success !== true) {
    reasonCodes.push("validation_incomplete");
  }
  if (params.stopRisk === "high") {
    reasonCodes.push("route_risk_high");
  }

  const allowed = reasonCodes.length === 0;
  const branchOnlyEligible =
    !allowed &&
    params.previousSummary?.validation.success === true &&
    params.blockers.length === 0 &&
    params.stopRisk !== "high" &&
    params.git.behind === 0 &&
    reasonCodes.every((code) => code === "dirty_working_tree");
  const recommendedMode: AutoDrivePublishReadiness["recommendedMode"] = allowed
    ? "push_candidate"
    : branchOnlyEligible
      ? "branch_only"
      : "hold";
  return {
    allowed,
    recommendedMode,
    summary: allowed
      ? "Publish corridor is open for an automated branch push."
      : recommendedMode === "branch_only"
        ? "Publish corridor is ready for a local stage/commit milestone, but not yet for a remote push."
        : params.git.remote
          ? "Publish corridor is blocked until the route is cleaner and fully validated."
          : "Publish corridor is blocked until the workspace has a pushable git remote and the route is fully validated.",
    reasonCodes,
  };
}

async function maybeRunExternalResearch(params: {
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

async function readRepoBacklog(
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

async function readThreadContext(
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

async function readRepoEvaluationProfile(params: {
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

async function readRelevantDocs(
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

async function loadCommitEvidence(
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

function buildStartState(params: {
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

export async function synthesizeAutoDriveContext(params: {
  deps: AutoDriveControllerDeps;
  run: AutoDriveRunRecord;
  iteration: number;
  previousSummary: AutoDriveIterationSummary | null;
}): Promise<AutoDriveContextSnapshot> {
  const { deps, run, iteration, previousSummary } = params;
  const [gitStatus, gitLog, workspaceFiles, gitBranches, gitRemote] = await Promise.all([
    deps.getGitStatus(run.workspaceId),
    deps.getGitLog(run.workspaceId, DEFAULT_GIT_WINDOW),
    deps.getWorkspaceFiles(run.workspaceId),
    deps.listGitBranches(run.workspaceId),
    deps.getGitRemote ? deps.getGitRemote(run.workspaceId) : Promise.resolve(null),
  ]);
  const [docs, commits, researchResult, repoBacklog, threadContext] = await Promise.all([
    readRelevantDocs(deps, run.workspaceId, workspaceFiles),
    loadCommitEvidence(deps, run.workspaceId, gitLog.entries),
    maybeRunExternalResearch({ deps, run, previousSummary }),
    readRepoBacklog(deps, run.workspaceId),
    readThreadContext(deps, {
      workspaceId: run.workspaceId,
      threadId: run.threadId,
    }),
  ]);
  const historicalRuns = await loadHistoricalAutoDriveRuns({
    deps,
    workspaceId: run.workspaceId,
    workspaceFiles,
    currentRunId: run.runId,
  });
  const historicalPublishHandoffs = await loadHistoricalAutoDrivePublishHandoffs({
    deps,
    workspaceId: run.workspaceId,
    workspaceFiles,
    currentRunId: run.runId,
  });
  const historicalPublishCorridor = findBestHistoricalPublishCorridor({
    destinationTitle: run.destination.title,
    handoffs: historicalPublishHandoffs,
  });
  const historicalPublishFailureSummary = findHistoricalPublishFailureSummary({
    destinationTitle: run.destination.title,
    runs: historicalRuns,
  });

  const ruleEvidence = docs.ruleEvidence;
  const commitMomentum = buildCommitMomentum({
    run,
    commits,
    previousSummary,
    threadContext,
  });
  const routeStagnation = buildRouteStagnationSignal({
    run,
    previousSummary,
  });
  const executionFeedback = buildExecutionFeedbackSignal({
    run,
    previousSummary,
    routeStagnation,
    hasHistoricalPublishedCorridor:
      historicalPublishCorridor !== null ||
      hasHistoricalPublishedCorridor({
        destinationTitle: run.destination.title,
        runs: historicalRuns,
      }),
    historicalPublishFailureSummary,
  });
  const collaboratorIntent = buildCollaboratorIntent(run, commits, ruleEvidence, commitMomentum);
  const relevantFiles = [
    ...new Set([
      ...workspaceFiles
        .filter((path) => /Composer|runtime|mission|thread|autodrive/i.test(path))
        .slice(0, 8),
      ...gitStatus.files.map((file) => file.path),
      ...(previousSummary?.suggestedNextAreas ?? []),
    ]),
  ].slice(0, 12);
  const branch = gitBranches.currentBranch ?? gitStatus.branchName ?? null;
  const changedPaths = gitStatus.files.map((file) => file.path);
  const blockers = dedupeNonEmpty(
    [
      ...(previousSummary?.blockers ?? run.blockers),
      ...routeStagnation.repeatedBlockers,
      routeStagnation.isStagnating ? routeStagnation.summary : null,
    ],
    6
  );
  const intent = buildIntentModel({
    run,
    previousSummary,
    collaboratorIntent,
    momentum: commitMomentum,
    routeStagnation,
    ruleEvidence,
    externalResearch: researchResult.externalResearch,
    repoBacklog,
    threadContext,
    relevantFiles,
    blockers,
  });
  const opportunities = buildOpportunityQueue({
    run,
    previousSummary,
    intent,
    collaboratorIntent,
    momentum: commitMomentum,
    routeStagnation,
    executionFeedback,
    externalResearch: researchResult.externalResearch,
    repoBacklog,
    threadContext,
    blockers,
    changedPaths,
    repoEvaluation: docs.evaluation,
    historicalPublishCorridor,
    gitBehind: gitLog.behind,
  });
  const startState = buildStartState({
    run,
    destination: run.destination,
    previousSummary,
    gitBranch: branch,
    gitChangedPaths: changedPaths,
    commits,
    collaboratorIntent,
  });
  const publishReadiness = buildPublishReadiness({
    previousSummary,
    blockers,
    changedPaths,
    git: {
      remote: gitRemote,
      upstream: gitLog.upstream,
      behind: gitLog.behind,
    },
    stopRisk: startState.system.stopRisk,
  });

  return {
    schemaVersion: "autodrive-context/v2",
    runId: run.runId,
    iteration,
    destination: run.destination,
    startState,
    repo: {
      packageManager: docs.packageManager,
      workspaceMarkers: extractWorkspaceMarkers(workspaceFiles),
      scripts: docs.scripts,
      evaluation: docs.evaluation,
      ruleEvidence,
      relevantDocs: docs.docs,
      relevantFiles,
    },
    git: {
      branch,
      remote: gitRemote,
      upstream: gitLog.upstream,
      ahead: gitLog.ahead,
      behind: gitLog.behind,
      recentCommits: commits,
      workingTree: {
        dirty: gitStatus.files.length > 0,
        stagedCount: gitStatus.stagedFiles.length,
        unstagedCount: gitStatus.unstagedFiles.length,
        changedPaths,
        totalAdditions: gitStatus.totalAdditions,
        totalDeletions: gitStatus.totalDeletions,
      },
    },
    collaboratorIntent,
    intent,
    opportunities,
    executionTuning: executionFeedback,
    publishReadiness,
    publishHistory: {
      bestCorridor: historicalPublishCorridor,
      latestFailureSummary: historicalPublishFailureSummary,
    },
    repoBacklog,
    threadContext,
    previousSummary,
    blockers,
    completedSubgoals: [
      ...new Set([...run.completedSubgoals, ...(previousSummary?.completedSubgoals ?? [])]),
    ],
    externalResearch: researchResult.externalResearch,
    researchPolicy: researchResult.researchPolicy,
    synthesizedAt: deps.now?.() ?? Date.now(),
  };
}
