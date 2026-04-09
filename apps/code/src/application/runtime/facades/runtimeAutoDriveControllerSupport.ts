import type { AgentTaskSummary } from "@ku0/code-runtime-host-contract";
import {
  clampPercent,
  extractFilePaths,
  extractLatestTaskOutput,
  extractListSection,
  extractSingleLineSection,
  parseBooleanSection,
  parseGoalReached,
} from "./runtimeAutoDriveReviewParsing";
import type {
  AutoDriveConfidence,
  AutoDriveContextSnapshot,
  AutoDriveControllerDeps,
  AutoDriveIterationSummary,
  AutoDriveProposalReview,
  AutoDriveRouteHealth,
  AutoDriveRouteProposal,
  AutoDriveRerouteRecord,
  AutoDriveRunNavigationState,
  AutoDriveRunRecord,
  AutoDriveStopReason,
  AutoDriveValidationResult,
} from "../types/autoDrive";

export function defaultNow(deps: AutoDriveControllerDeps): number {
  return deps.now?.() ?? Date.now();
}

export function estimateTokens(...parts: Array<string | null | undefined>): number {
  const text = parts
    .filter((part): part is string => typeof part === "string" && part.length > 0)
    .join("\n");
  return Math.ceil(text.length / 4);
}

export function buildEmptyNavigation(run: AutoDriveRunRecord): AutoDriveRunNavigationState {
  return {
    destinationSummary: run.destination.title,
    startStateSummary: null,
    routeSummary: null,
    currentWaypointTitle: null,
    currentWaypointObjective: null,
    currentWaypointArrivalCriteria: [],
    waypointStatus: null,
    remainingMilestones: [],
    currentMilestone: null,
    overallProgress: 0,
    waypointCompletion: 0,
    offRoute: false,
    rerouting: false,
    rerouteReason: null,
    remainingBlockers: [],
    arrivalConfidence: "medium",
    stopRisk: "low",
    remainingTokens:
      run.budget.maxTokens > 0
        ? Math.max(0, run.budget.maxTokens - run.totals.consumedTokensEstimate)
        : null,
    remainingIterations: Math.max(0, run.budget.maxIterations - run.iteration),
    remainingDurationMs:
      run.budget.maxDurationMs === null
        ? null
        : Math.max(0, run.budget.maxDurationMs - run.totals.elapsedMs),
    lastDecision: null,
  };
}

export function buildNavigationFromContext(
  run: AutoDriveRunRecord,
  context: AutoDriveContextSnapshot
) {
  return {
    ...run.navigation,
    destinationSummary: context.destination.title,
    startStateSummary: context.startState.summary,
    offRoute: context.startState.routeHealth.offRoute,
    rerouting: context.startState.routeHealth.rerouteRecommended,
    rerouteReason: context.startState.routeHealth.rerouteReason,
    remainingBlockers: context.startState.repo.unresolvedBlockers,
    stopRisk: context.startState.system.stopRisk,
    remainingTokens: context.startState.system.remainingTokensEstimate,
    remainingIterations: context.startState.system.remainingIterations,
    remainingDurationMs: context.startState.system.remainingDurationMs,
  } satisfies AutoDriveRunNavigationState;
}

export function buildNavigationFromProposal(
  run: AutoDriveRunRecord,
  proposal: AutoDriveRouteProposal
) {
  return {
    ...run.navigation,
    routeSummary: proposal.routeSummary,
    currentWaypointTitle: proposal.currentWaypoint.title,
    currentWaypointObjective: proposal.currentWaypoint.objective,
    currentWaypointArrivalCriteria: proposal.currentWaypoint.arrivalCriteria,
    waypointStatus: "active",
    remainingMilestones: proposal.remainingMilestones,
    currentMilestone: proposal.currentWaypoint.title,
    arrivalConfidence: proposal.routeConfidence,
  } satisfies AutoDriveRunNavigationState;
}

function parseStopRisk(params: {
  validation: AutoDriveValidationResult;
  offRoute: boolean;
  confidence: AutoDriveConfidence;
}): AutoDriveRunNavigationState["stopRisk"] {
  if (params.validation.success === false || params.offRoute || params.confidence === "low") {
    return "high";
  }
  if (params.validation.ran || params.confidence === "medium") {
    return "medium";
  }
  return "low";
}

function buildDefaultRouteHealth(params: {
  output: string;
  validation: AutoDriveValidationResult;
  waypointStatus: AutoDriveIterationSummary["waypoint"]["status"];
  previousSummary: AutoDriveIterationSummary | null;
}): AutoDriveRouteHealth {
  const offRoute =
    parseBooleanSection(params.output, "Off Route") || params.waypointStatus !== "arrived";
  const rerouteReason = extractSingleLineSection(params.output, "Reroute Reason");
  return {
    offRoute,
    noProgressLoop:
      (params.previousSummary?.routeHealth.noProgressLoop ?? false) ||
      (!params.validation.success && params.validation.ran),
    rerouteRecommended:
      offRoute ||
      Boolean(rerouteReason) ||
      params.waypointStatus === "blocked" ||
      params.waypointStatus === "missed",
    rerouteReason,
    triggerSignals: [
      offRoute ? "Waypoint result diverged from the planned route." : null,
      params.validation.success === false ? params.validation.summary : null,
      rerouteReason,
    ].filter((value): value is string => Boolean(value)),
  };
}

export function buildDefaultSummary(params: {
  iteration: number;
  run: AutoDriveRunRecord;
  proposal: AutoDriveRouteProposal;
  validation: AutoDriveValidationResult;
  task: AgentTaskSummary;
}): AutoDriveIterationSummary {
  const output = extractLatestTaskOutput(params.task);
  const changedFiles = [
    ...new Set([...extractFilePaths(output), ...extractListSection(output, "Changed Files")]),
  ];
  const blockers = [
    ...extractListSection(output, "Blockers"),
    ...output
      .split(/\r?\n/)
      .filter((line) => /^blockers?:/i.test(line))
      .map((line) => line.replace(/^blockers?:/i, "").trim())
      .filter((line) => line.length > 0),
  ];
  const waypointStatusRaw = extractSingleLineSection(output, "Waypoint Status")?.toLowerCase();
  const waypointStatus: AutoDriveIterationSummary["waypoint"]["status"] =
    waypointStatusRaw === "missed" ||
    waypointStatusRaw === "blocked" ||
    waypointStatusRaw === "arrived"
      ? waypointStatusRaw
      : changedFiles.length > 0
        ? "arrived"
        : blockers.length > 0
          ? "blocked"
          : "missed";
  const arrivalCriteriaMet = extractListSection(output, "Arrival Criteria Met");
  const arrivalCriteriaMissed = extractListSection(output, "Arrival Criteria Missed");
  const goalReached =
    parseGoalReached(output) ||
    (params.validation.success === true &&
      waypointStatus === "arrived" &&
      params.proposal.remainingMilestones.length === 0 &&
      arrivalCriteriaMissed.length === 0);
  const previousSummary = params.run.summaries[params.run.summaries.length - 1] ?? null;
  const previousCompleted = previousSummary?.progress.completedWaypoints ?? 0;
  const completedWaypoints =
    previousCompleted + (waypointStatus === "arrived" && !previousSummary?.goalReached ? 1 : 0);
  const totalWaypoints = Math.max(1, params.proposal.milestones.length);
  const overallProgress = goalReached
    ? 100
    : clampPercent((completedWaypoints / totalWaypoints) * 100);
  const waypointCompletion =
    waypointStatus === "arrived"
      ? 100
      : waypointStatus === "blocked"
        ? 35
        : changedFiles.length > 0
          ? 70
          : 0;
  const routeHealth = buildDefaultRouteHealth({
    output,
    validation: params.validation,
    waypointStatus,
    previousSummary,
  });
  const remainingMilestones =
    waypointStatus === "arrived"
      ? params.proposal.remainingMilestones
      : [params.proposal.currentWaypoint.title, ...params.proposal.remainingMilestones];
  const progress = {
    currentMilestone: params.proposal.currentWaypoint.title,
    currentWaypointTitle: params.proposal.currentWaypoint.title,
    completedWaypoints,
    totalWaypoints,
    waypointCompletion,
    overallProgress,
    remainingMilestones,
    remainingBlockers: blockers,
    remainingDistance: goalReached
      ? "Destination reached."
      : `${remainingMilestones.length} milestone(s) remain before arrival.`,
    arrivalConfidence:
      params.validation.success === false
        ? "low"
        : routeHealth.offRoute
          ? "low"
          : waypointStatus === "arrived"
            ? "high"
            : "medium",
    stopRisk: parseStopRisk({
      validation: params.validation,
      offRoute: routeHealth.offRoute,
      confidence:
        params.validation.success === false
          ? "low"
          : waypointStatus === "arrived"
            ? "high"
            : "medium",
    }),
  } satisfies AutoDriveIterationSummary["progress"];

  return {
    schemaVersion: "autodrive-summary/v2",
    runId: params.run.runId,
    iteration: params.iteration,
    status: params.task.status === "failed" ? "failed" : "success",
    taskTitle: params.proposal.currentWaypoint.title,
    summaryText: output,
    changedFiles,
    blockers,
    completedSubgoals:
      waypointStatus === "arrived"
        ? [`waypoint_${params.iteration}_arrived`]
        : changedFiles.length
          ? [`waypoint_${params.iteration}_advanced`]
          : [],
    unresolvedItems: blockers,
    suggestedNextAreas:
      extractFilePaths(output).length > 0
        ? extractFilePaths(output)
        : params.proposal.currentWaypoint.repoAreas,
    validation: params.validation,
    progress,
    routeHealth,
    waypoint: {
      id: params.proposal.currentWaypoint.id,
      title: params.proposal.currentWaypoint.title,
      status: waypointStatus,
      arrivalCriteriaMet,
      arrivalCriteriaMissed:
        arrivalCriteriaMissed.length > 0
          ? arrivalCriteriaMissed
          : waypointStatus === "arrived"
            ? []
            : params.proposal.currentWaypoint.arrivalCriteria,
    },
    goalReached,
    task: {
      taskId: params.task.taskId,
      status: params.task.status,
      outputExcerpt: output.slice(0, 400),
    },
    reroute: null,
    createdAt: params.run.updatedAt,
  };
}

export function hasDestructiveSignals(summary: AutoDriveIterationSummary): boolean {
  return summary.changedFiles.some((file) =>
    /package\.json|pnpm-lock|Cargo\.toml|Cargo\.lock/i.test(file)
  );
}

export function mapProposalReviewToStopReason(
  review: AutoDriveProposalReview
): AutoDriveStopReason {
  const detail = review.issues.map((issue) => issue.detail).join(" ");
  if (review.issues.some((issue) => issue.code === "protected_boundary_conflict")) {
    return {
      code: "mainline_conflict_requires_review",
      detail,
    };
  }
  if (review.confidence === "low") {
    return {
      code: "confidence_too_low",
      detail,
    };
  }
  return {
    code: "proposal_rejected",
    detail,
  };
}

export function buildRerouteFromReview(params: {
  run: AutoDriveRunRecord;
  iteration: number;
  review: AutoDriveProposalReview;
  proposal: AutoDriveRouteProposal;
  deps: AutoDriveControllerDeps;
}): AutoDriveRerouteRecord {
  return {
    iteration: params.iteration,
    mode: "soft",
    reason: params.review.rerouteReason ?? "The planner review requested a route correction.",
    trigger:
      params.review.issues.find((issue) => issue.code === "reroute_required")?.detail ??
      "Review requested a reroute.",
    previousRouteSummary: params.run.navigation.routeSummary,
    nextRouteSummary: params.proposal.routeSummary,
    createdAt: defaultNow(params.deps),
  };
}

export function getPreIterationStopReason(run: AutoDriveRunRecord): AutoDriveStopReason | null {
  if (run.totals.consumedTokensEstimate >= run.budget.maxTokens) {
    return {
      code: "token_budget_exhausted",
      detail: "The configured token budget has been exhausted.",
    };
  }
  if (run.budget.maxDurationMs !== null && run.totals.elapsedMs >= run.budget.maxDurationMs) {
    return {
      code: "duration_budget_exhausted",
      detail: "The configured duration budget has been exhausted.",
    };
  }
  if (run.iteration >= run.budget.maxIterations) {
    return {
      code: "max_iterations_reached",
      detail: "The run reached the configured iteration limit.",
    };
  }
  if (run.totals.rerouteCount >= run.budget.maxReroutes) {
    return {
      code: "reroute_limit_reached",
      detail: "The route has rerouted too many times and should stop safely.",
    };
  }
  if (run.totals.validationFailureCount >= run.budget.maxValidationFailures) {
    return {
      code: "repeated_validation_failures",
      detail: "Validation failed repeatedly and the route should stop for review.",
    };
  }
  if (run.totals.noProgressCount >= run.budget.maxNoProgressIterations) {
    return {
      code: "no_meaningful_progress",
      detail: "The route has made no meaningful progress for too many consecutive iterations.",
    };
  }
  return null;
}

export function resolveTerminalState(reason: AutoDriveStopReason): {
  status: AutoDriveRunRecord["status"];
  stage: AutoDriveRunRecord["stage"];
} {
  if (reason.code === "goal_reached") {
    return {
      status: "completed",
      stage: "completed",
    };
  }
  if (reason.code === "missing_human_input") {
    return {
      status: "paused",
      stage: "paused",
    };
  }
  return {
    status: "stopped",
    stage: "stopped",
  };
}
