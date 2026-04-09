import { scoreAutoDriveOpportunityQueue } from "./runtimeAutoDriveOpportunityScoring";
import type {
  AutoDriveCollaboratorBoundarySignal,
  AutoDriveCollaboratorIntent,
  AutoDriveCommitEvidence,
  AutoDriveDirectionHypothesis,
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
  AutoDriveThreadContext,
} from "../types/autoDrive";
import type { CommitMomentumSignal, RouteStagnationSignal } from "./runtimeAutoDriveRouteSignals";

function normalizeLine(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.replace(/^[-*]\s*/, "");
}

export function extractRuleEvidence(path: string, content: string): AutoDriveRuleEvidence | null {
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

export function extractWorkspaceMarkers(files: string[]): string[] {
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

export function buildCollaboratorIntent(
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

export function dedupeNonEmpty(
  values: Array<string | null | undefined>,
  limit = values.length
): string[] {
  return [
    ...new Set(values.map((value) => value?.trim() ?? "").filter((value) => value.length > 0)),
  ].slice(0, limit);
}

export function buildIntentModel(params: {
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
      confidence:
        momentum.alignmentScore >= 0.35
          ? "high"
          : momentum.alignmentScore >= 0.25
            ? "medium"
            : "low",
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
  if (externalResearch[0]?.summary) {
    signals.push({
      kind: "external_research",
      summary: externalResearch[0].summary,
      source: externalResearch[0].sources[0] ?? null,
      confidence: "medium",
    });
  }
  if (repoBacklog.highlights.length > 0) {
    signals.push({
      kind: "repo_backlog",
      summary: repoBacklog.highlights.join(" | "),
      source: "github",
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
  for (const blocker of blockers) {
    signals.push({
      kind: "blocker",
      summary: blocker,
      source: null,
      confidence: "medium",
    });
  }
  for (const evidence of ruleEvidence.slice(0, 2)) {
    signals.push({
      kind: "repo_rule",
      summary: evidence.summary,
      source: evidence.path,
      confidence: "high",
    });
  }

  const dominantSignalKinds = dedupeNonEmpty(
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
  ) as AutoDriveDirectionHypothesis["dominantSignalKinds"];

  const primaryHypothesis: AutoDriveDirectionHypothesis = {
    summary: `Advance ${run.destination.title} through the highest-signal repo surfaces first.`,
    rationale: [
      `Destination scope centers on ${run.destination.title}.`,
      collaboratorIntent.probableIntent,
      previousSummary?.summaryText ?? null,
      externalResearch[0]?.summary ?? null,
      threadContext?.summary ?? null,
      threadContext?.longTermMemorySummary ?? null,
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
    dominantSignalKinds,
    confidence:
      collaboratorIntent.confidence === "low" && !previousSummary && externalResearch.length === 0
        ? "low"
        : "medium",
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

export function buildOpportunityQueue(params: {
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

  if (primaryHypothesis) {
    candidates.push({
      id: "advance_primary_surface",
      title: "Advance the primary AutoDrive surface",
      summary: primaryHypothesis.summary,
      rationale: primaryHypothesis.rationale,
      repoAreas: primaryHypothesis.suggestedAreas,
      baseScore: 68,
      confidence: primaryHypothesis.confidence,
      risk: params.blockers.length > 0 ? "medium" : "low",
    });
  }

  if (params.momentum.alignedSummaries.length > 0) {
    candidates.push({
      id: "follow_recent_commit_momentum",
      title: "Follow recent commit momentum",
      summary: "Use the strongest aligned commit corridor as the next route.",
      rationale: params.momentum.alignedSummaries.join(" | "),
      repoAreas: params.collaboratorIntent.touchedAreas,
      baseScore: 60,
      confidence:
        params.momentum.alignmentScore >= 0.55
          ? "high"
          : params.momentum.alignmentScore >= 0.25
            ? "medium"
            : "low",
      risk: params.collaboratorIntent.conflictRisk === "high" ? "medium" : "low",
    });
  }

  if (params.historicalPublishCorridor) {
    candidates.push({
      id: "reuse_historical_publish_corridor",
      title: "Reuse the historical publish corridor",
      summary: "Use prior successful publish evidence to minimize route churn.",
      rationale: params.historicalPublishCorridor.summaryText,
      repoAreas: params.historicalPublishCorridor.changedFiles,
      baseScore: 72,
      confidence: "high",
      risk: "low",
    });
  }

  if (params.externalResearch.length > 0) {
    candidates.push({
      id: "use_fresh_research",
      title: "Align the route with fresh external guidance",
      summary: "Use current ecosystem guidance to choose the next waypoint deliberately.",
      rationale: params.externalResearch[0]?.summary ?? "Fresh research signal is available.",
      repoAreas: primaryHypothesis?.suggestedAreas ?? [],
      baseScore: 58,
      confidence: "medium",
      risk: "medium",
    });
  }

  if (params.repoBacklog.highlights.length > 0) {
    candidates.push({
      id: "triage_external_backlog",
      title: "Resolve the highest-signal backlog item",
      summary: "Use GitHub backlog context to anchor the next step.",
      rationale: params.repoBacklog.highlights.join(" | "),
      repoAreas: primaryHypothesis?.suggestedAreas ?? [],
      baseScore: 55,
      confidence: "medium",
      risk: "medium",
    });
  }

  if (params.threadContext?.summary) {
    candidates.push({
      id: "align_with_thread_history",
      title: "Continue the active operator thread context",
      summary: "Thread-local context still carries useful intent and memory.",
      rationale: params.threadContext.summary,
      repoAreas: primaryHypothesis?.suggestedAreas ?? [],
      baseScore: 54,
      confidence: "medium",
      risk: "low",
    });
  }

  if (params.gitBehind > 0) {
    candidates.push({
      id: "rebase_route_assumptions",
      title: "Rebase route assumptions against upstream movement",
      summary: "Upstream changed, so the route should re-check its assumptions.",
      rationale: `Git is behind upstream by ${params.gitBehind} commit(s).`,
      repoAreas: params.collaboratorIntent.touchedAreas,
      baseScore: 60,
      confidence: "medium",
      risk: "medium",
    });
  }

  if (params.routeStagnation.isStagnating) {
    candidates.push({
      id: "break_route_stagnation",
      title: "Break the current stagnation loop",
      summary: "The route is repeating itself and needs a sharper corridor.",
      rationale: params.routeStagnation.summary ?? "Repeated areas indicate route stagnation.",
      repoAreas: params.routeStagnation.repeatedAreas,
      baseScore: 66,
      confidence: "high",
      risk: "medium",
    });
  }

  if (params.executionFeedback.publishPriority === "prepare_branch") {
    candidates.push({
      id: "prepare_publish_corridor",
      title: "Prepare the publish corridor",
      summary: "Use validation and repo state to prepare a cleaner publish handoff.",
      rationale: [
        "Prefer a local branch-only milestone.",
        params.changedPaths.length === 0
          ? "Working tree is already clean enough to consider publish prep."
          : params.changedPaths
              .filter((path) => /autodrive|publish|ledger/i.test(path))
              .slice(0, 2),
      ]
        .flat()
        .filter((value): value is string => Boolean(value))
        .join(" "),
      repoAreas: primaryHypothesis?.suggestedAreas ?? [],
      baseScore: 70,
      confidence: "high",
      risk: "low",
    });
  }

  if (params.executionFeedback.publishPriority === "push_candidate") {
    candidates.push({
      id: "push_publish_candidate",
      title: "Push the publish candidate",
      summary: "Publish pressure and validation confidence support a push-ready corridor.",
      rationale:
        params.historicalPublishCorridor?.summaryText ??
        "Validation is stable enough to move from branch preparation to push-ready publish.",
      repoAreas:
        params.historicalPublishCorridor?.changedFiles ?? primaryHypothesis?.suggestedAreas ?? [],
      baseScore: 74,
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

export function buildPublishReadiness(params: {
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
