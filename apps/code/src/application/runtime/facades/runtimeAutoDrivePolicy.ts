import type {
  AutoDriveConfidence,
  AutoDriveContextSnapshot,
  AutoDriveExecutionTuning,
  AutoDriveIterationSummary,
  AutoDriveNextDecision,
  AutoDriveRerouteRecord,
  AutoDriveRiskLevel,
  AutoDriveRunRecord,
} from "../types/autoDrive";

const CONFIDENCE_RANK: Record<AutoDriveConfidence, number> = {
  low: 0,
  medium: 1,
  high: 2,
};

const DEFAULT_CHATGPT_DECISION_LAB_MIN_CONFIDENCE: AutoDriveConfidence = "medium";
const DEFAULT_CHATGPT_DECISION_LAB_MAX_SCORE_GAP = 8;
const DEFAULT_CONTINUATION_MIN_CONFIDENCE: AutoDriveConfidence = "high";
const DEFAULT_CONTINUATION_MAX_FOLLOW_UPS = 2;

function resolveChatgptDecisionLabMinConfidence(run: AutoDriveRunRecord): AutoDriveConfidence {
  return (
    run.riskPolicy.chatgptDecisionLabMinConfidence ?? DEFAULT_CHATGPT_DECISION_LAB_MIN_CONFIDENCE
  );
}

function resolveChatgptDecisionLabMaxScoreGap(run: AutoDriveRunRecord): number {
  return run.riskPolicy.chatgptDecisionLabMaxScoreGap ?? DEFAULT_CHATGPT_DECISION_LAB_MAX_SCORE_GAP;
}

function resolveContinuationMinConfidence(run: AutoDriveRunRecord): AutoDriveConfidence {
  return run.continuationPolicy?.minimumConfidenceToStop ?? DEFAULT_CONTINUATION_MIN_CONFIDENCE;
}

function resolveContinuationMaxFollowUps(run: AutoDriveRunRecord): number {
  return run.continuationPolicy?.maxAutomaticFollowUps ?? DEFAULT_CONTINUATION_MAX_FOLLOW_UPS;
}

function shouldContinuePastNominalGoal(params: {
  run: AutoDriveRunRecord;
  latestSummary: AutoDriveIterationSummary;
  criticConfidence: AutoDriveConfidence;
}): boolean {
  const { run, latestSummary, criticConfidence } = params;
  if (run.continuationPolicy?.enabled === false) {
    return false;
  }
  const maxAutomaticFollowUps = resolveContinuationMaxFollowUps(run);
  if (maxAutomaticFollowUps <= 0) {
    return false;
  }
  const automaticFollowUpCount = run.continuationState?.automaticFollowUpCount ?? 0;
  if (automaticFollowUpCount >= maxAutomaticFollowUps) {
    return false;
  }
  if (
    (run.continuationPolicy?.requireValidationSuccessToStop ?? true) &&
    latestSummary.validation.success !== true
  ) {
    return true;
  }
  const minimumConfidence = resolveContinuationMinConfidence(run);
  return (
    CONFIDENCE_RANK[criticConfidence] < CONFIDENCE_RANK[minimumConfidence] ||
    CONFIDENCE_RANK[latestSummary.progress.arrivalConfidence] < CONFIDENCE_RANK[minimumConfidence]
  );
}

function nextRiskLevel(left: AutoDriveRiskLevel, right: AutoDriveRiskLevel): AutoDriveRiskLevel {
  const ranking: Record<AutoDriveRiskLevel, number> = {
    low: 0,
    medium: 1,
    high: 2,
  };
  return ranking[left] >= ranking[right] ? left : right;
}

function buildRerouteRecord(params: {
  run: AutoDriveRunRecord;
  latestSummary: AutoDriveIterationSummary;
}): AutoDriveRerouteRecord {
  return {
    iteration: params.latestSummary.iteration,
    mode: params.latestSummary.routeHealth.offRoute ? "hard" : "soft",
    reason:
      params.latestSummary.routeHealth.rerouteReason ??
      params.latestSummary.blockers[0] ??
      "The route needs to be replanned.",
    trigger: params.latestSummary.routeHealth.triggerSignals[0] ?? "No explicit trigger recorded.",
    previousRouteSummary: params.run.navigation.routeSummary,
    nextRouteSummary: null,
    createdAt: params.latestSummary.createdAt,
  };
}

export function shouldAutoRunChatgptDecisionLab(params: {
  run: AutoDriveRunRecord;
  context: AutoDriveContextSnapshot;
}): boolean {
  const { run, context } = params;
  if (run.riskPolicy.allowChatgptDecisionLab === false) {
    return false;
  }
  if (run.riskPolicy.autoRunChatgptDecisionLab === false) {
    return false;
  }
  const [selected, fallbackSecond] = context.opportunities.candidates;
  const currentSelection =
    context.opportunities.candidates.find(
      (candidate) => candidate.id === context.opportunities.selectedCandidateId
    ) ?? selected;
  const competingCandidate =
    context.opportunities.candidates.find((candidate) => candidate.id !== currentSelection?.id) ??
    fallbackSecond ??
    null;
  if (!currentSelection || !competingCandidate) {
    return false;
  }

  const scoreGap = Math.abs(currentSelection.score - competingCandidate.score);
  if (scoreGap > resolveChatgptDecisionLabMaxScoreGap(run)) {
    return false;
  }

  const minimumConfidence = resolveChatgptDecisionLabMinConfidence(run);
  return (
    CONFIDENCE_RANK[currentSelection.confidence] <= CONFIDENCE_RANK[minimumConfidence] ||
    CONFIDENCE_RANK[context.startState.task.confidence] <= CONFIDENCE_RANK[minimumConfidence]
  );
}

export function shouldAutoRunChatgptResearchRouteLab(params: {
  run: AutoDriveRunRecord;
  context: AutoDriveContextSnapshot;
}): boolean {
  const { run, context } = params;
  if (run.riskPolicy.allowNetworkAnalysis === false) {
    return false;
  }
  const scenarioKeys = [
    ...(run.runtimeScenarioProfile?.scenarioKeys ?? []),
    ...(context.repo.evaluation?.scenarioKeys ?? []),
  ];
  const sourceSignals = [
    ...(run.runtimeScenarioProfile?.sourceSignals ?? []),
    ...(context.repo.evaluation?.sourceSignals ?? []),
  ];
  const researchScenario =
    scenarioKeys.includes("research_route_decide") ||
    sourceSignals.includes("chatgpt_research_route_lab");
  if (!researchScenario) {
    return false;
  }

  const [selected, fallbackSecond] = context.opportunities.candidates;
  const currentSelection =
    context.opportunities.candidates.find(
      (candidate) => candidate.id === context.opportunities.selectedCandidateId
    ) ?? selected;
  const competingCandidate =
    context.opportunities.candidates.find((candidate) => candidate.id !== currentSelection?.id) ??
    fallbackSecond ??
    null;
  if (!currentSelection || !competingCandidate) {
    return false;
  }
  const scoreGap = Math.abs(currentSelection.score - competingCandidate.score);
  if (scoreGap > resolveChatgptDecisionLabMaxScoreGap(run)) {
    return false;
  }
  return true;
}

export function decideAutoDriveNextStep(params: {
  run: AutoDriveRunRecord;
  latestSummary: AutoDriveIterationSummary;
  criticConfidence: AutoDriveConfidence;
  hasDestructiveChange: boolean;
  hasDependencyChange: boolean;
  executionTuning?: AutoDriveExecutionTuning | null;
}): AutoDriveNextDecision {
  const { run, latestSummary, criticConfidence, hasDestructiveChange, hasDependencyChange } =
    params;
  const executionTuning = params.executionTuning ?? null;
  const effectiveRisk = nextRiskLevel(run.navigation.stopRisk, latestSummary.progress.stopRisk);
  const hasHistoricalPublishFailure = Boolean(
    executionTuning?.reasons.includes("historical_publish_failure")
  );
  const hasHistoricalPublishCorridor = Boolean(
    executionTuning?.publishPriority === "push_candidate" &&
    (executionTuning.reasons.includes("historical_publish_corridor") ||
      executionTuning.reasons.includes("publish_corridor_stable"))
  );
  const allowProvenCorridorConfidenceRelaxation =
    hasHistoricalPublishCorridor &&
    latestSummary.validation.success === true &&
    latestSummary.progress.stopRisk !== "high" &&
    latestSummary.blockers.length === 0;

  if (run.totals.consumedTokensEstimate >= run.budget.maxTokens) {
    return {
      action: "stop",
      reason: {
        code: "token_budget_exhausted",
        detail: "The configured token budget has been exhausted.",
      },
    };
  }
  if (run.budget.maxDurationMs !== null && run.totals.elapsedMs >= run.budget.maxDurationMs) {
    return {
      action: "stop",
      reason: {
        code: "duration_budget_exhausted",
        detail: "The configured duration budget has been exhausted.",
      },
    };
  }
  if (run.iteration >= run.budget.maxIterations) {
    return {
      action: "stop",
      reason: {
        code: "max_iterations_reached",
        detail: "The run reached the configured iteration limit.",
      },
    };
  }
  if (
    !latestSummary.progress.overallProgress &&
    run.totals.noProgressCount >= run.budget.maxNoProgressIterations
  ) {
    return {
      action: "stop",
      reason: {
        code: "no_meaningful_progress",
        detail: "The route has made no meaningful progress for too many consecutive iterations.",
      },
    };
  }
  if (
    latestSummary.validation.success === false &&
    run.totals.validationFailureCount >= run.budget.maxValidationFailures
  ) {
    return {
      action: "stop",
      reason: {
        code: "repeated_validation_failures",
        detail: "Validation failed repeatedly and the route should stop for review.",
      },
    };
  }
  if (run.totals.rerouteCount >= run.budget.maxReroutes) {
    return {
      action: "stop",
      reason: {
        code: "reroute_limit_reached",
        detail: "The route has rerouted too many times and should stop safely.",
      },
    };
  }
  if (latestSummary.goalReached) {
    if (shouldContinuePastNominalGoal({ run, latestSummary, criticConfidence })) {
      return {
        action: "continue",
        reason: null,
      };
    }
    return {
      action: "stop",
      reason: {
        code: "goal_reached",
        detail: "The latest waypoint satisfied the destination arrival criteria.",
      },
    };
  }
  if (hasDestructiveChange && run.riskPolicy.pauseOnDestructiveChange) {
    return {
      action: "pause",
      reason: {
        code: "destructive_change_requires_review",
        detail: "A destructive change was detected and the risk policy requires review.",
      },
    };
  }
  if (hasDependencyChange && run.riskPolicy.pauseOnDependencyChange) {
    return {
      action: "pause",
      reason: {
        code: "dependency_change_requires_review",
        detail: "A dependency or manifest change was detected and the risk policy requires review.",
      },
    };
  }
  if (
    run.riskPolicy.pauseOnLowConfidence &&
    (CONFIDENCE_RANK[criticConfidence] < CONFIDENCE_RANK[run.riskPolicy.minimumConfidence] ||
      (!allowProvenCorridorConfidenceRelaxation &&
        CONFIDENCE_RANK[latestSummary.progress.arrivalConfidence] <
          CONFIDENCE_RANK[run.riskPolicy.minimumConfidence]))
  ) {
    return {
      action: "pause",
      reason: {
        code: "confidence_too_low",
        detail: "Proposal or route confidence fell below the configured threshold.",
      },
    };
  }
  if (
    run.riskPolicy.pauseOnHumanCheckpoint &&
    /yes/i.test(latestSummary.summaryText) &&
    /human checkpoint/i.test(latestSummary.summaryText)
  ) {
    return {
      action: "pause",
      reason: {
        code: "human_checkpoint_required",
        detail: "The latest waypoint explicitly requested a human checkpoint.",
      },
    };
  }
  if (
    latestSummary.blockers.some((blocker) =>
      /permission|credential|missing info|clarify|human/i.test(blocker)
    )
  ) {
    return {
      action: "pause",
      reason: {
        code: "missing_human_input",
        detail:
          "The latest summary indicates missing information or permissions that require human input.",
      },
    };
  }
  if (
    latestSummary.routeHealth.rerouteRecommended ||
    latestSummary.waypoint.status === "missed" ||
    latestSummary.waypoint.status === "blocked"
  ) {
    if (hasHistoricalPublishFailure) {
      return {
        action: "pause",
        reason: {
          code: "unsafe_route_requires_review",
          detail:
            "This route matches a historically failed publish corridor and drifted again, so it should pause for review before rerouting.",
        },
      };
    }
    return {
      action: "reroute",
      reason:
        effectiveRisk === "high"
          ? {
              code: "unsafe_route_requires_review",
              detail: "The route drifted under high stop risk and requires replanning.",
            }
          : null,
      reroute: buildRerouteRecord({ run, latestSummary }),
    };
  }
  return {
    action: "continue",
    reason: null,
  };
}
