import type {
  AgentTaskAutoDriveRoutePreference,
  AgentTaskAutoDriveState,
  AgentTaskAutoDriveStopReason,
  HugeCodeMissionControlSnapshot,
  HugeCodeRunSummary,
  HugeCodeTaskSummary,
} from "@ku0/code-runtime-host-contract";
import type {
  AutoDriveControllerHookDraft,
  AutoDriveChatgptResearchRouteLabResult,
  AutoDriveContinuationPolicy,
  AutoDriveResearchSourceAssessment,
  AutoDriveResearchSource,
  AutoDriveRiskPolicy,
  AutoDriveRoutePreference,
  AutoDriveRuntimeContinuationState,
  AutoDriveRuntimeAutonomyState,
  AutoDriveRuntimeDecisionTrace,
  AutoDriveRuntimeOutcomeFeedback,
  AutoDriveRuntimeResearchSession,
  AutoDriveRuntimeResearchTrace,
  AutoDriveRuntimeScenarioProfile,
  AutoDriveRunRecord,
  AutoDriveRunStage,
  AutoDriveStopReason,
} from "../../../application/runtime/types/autoDrive";
import { buildMissionScenarioProfile } from "../../../application/runtime/facades/runtimeScenarioProfiles";

const DEFAULT_BUDGET: AutoDriveControllerHookDraft["budget"] = {
  maxTokens: 6000,
  maxIterations: 3,
  maxDurationMinutes: 10,
  maxFilesPerIteration: 6,
  maxNoProgressIterations: 2,
  maxValidationFailures: 2,
  maxReroutes: 2,
};

const DEFAULT_RISK_POLICY: AutoDriveRiskPolicy = {
  pauseOnDestructiveChange: true,
  pauseOnDependencyChange: true,
  pauseOnLowConfidence: true,
  pauseOnHumanCheckpoint: true,
  allowNetworkAnalysis: true,
  allowValidationCommands: true,
  allowChatgptDecisionLab: true,
  autoRunChatgptDecisionLab: true,
  chatgptDecisionLabMinConfidence: "medium",
  chatgptDecisionLabMaxScoreGap: 8,
  minimumConfidence: "medium",
};

const DEFAULT_CONTINUATION_POLICY: AutoDriveContinuationPolicy = {
  enabled: true,
  maxAutomaticFollowUps: 2,
  requireValidationSuccessToStop: true,
  minimumConfidenceToStop: "high",
};

export type AutoDriveRuntimeRunStatus = AutoDriveRunRecord["status"] | "review_ready" | "cancelled";

export type AutoDriveRuntimeRunRecord = Omit<AutoDriveRunRecord, "status"> & {
  status: AutoDriveRuntimeRunStatus;
};

export type AutoDriveSnapshotSelection = {
  source: HugeCodeMissionControlSnapshot["source"] | null;
  task: HugeCodeTaskSummary | null;
  run: HugeCodeRunSummary | null;
  runtimeTaskId: string | null;
  adaptedRun: AutoDriveRuntimeRunRecord | null;
  recovering: boolean;
  recoverySummary: string | null;
};

function toRuntimeRoutePreference(
  value: AutoDriveRoutePreference
): AgentTaskAutoDriveRoutePreference {
  if (value === "stability_first") {
    return "stability_first";
  }
  if (value === "speed_first") {
    return "speed_first";
  }
  return "balanced";
}

export function fromRuntimeRoutePreference(
  value: AgentTaskAutoDriveRoutePreference | null | undefined
): AutoDriveRoutePreference {
  if (value === "stability_first") {
    return "stability_first";
  }
  if (value === "speed_first") {
    return "speed_first";
  }
  return "validation_first";
}

export function mapDraftToRuntimeAutoDriveState(
  draft: AutoDriveControllerHookDraft
): AgentTaskAutoDriveState {
  const scenarioProfile = buildMissionScenarioProfile(draft.scenarioProfile);
  return {
    enabled: true,
    destination: {
      title: draft.destination.title.trim(),
      desiredEndState: draft.destination.endState
        .split(/\r?\n/)
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0),
      doneDefinition: {
        arrivalCriteria: draft.destination.doneDefinition
          .split(/\r?\n/)
          .map((entry) => entry.trim())
          .filter((entry) => entry.length > 0),
        requiredValidation: ["Validation", "Goal reached"],
        waypointIndicators: ["Progress", "Waypoint Status"],
      },
      hardBoundaries: draft.destination.avoid
        .split(/\r?\n/)
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0),
      routePreference: toRuntimeRoutePreference(draft.destination.routePreference),
    },
    budget: {
      maxTokens: Math.max(100, Math.round(draft.budget.maxTokens)),
      maxIterations: Math.max(1, Math.round(draft.budget.maxIterations)),
      maxDurationMs: Math.max(1, Math.round(draft.budget.maxDurationMinutes)) * 60 * 1000,
      maxFilesPerIteration: Math.max(1, Math.round(draft.budget.maxFilesPerIteration)),
      maxNoProgressIterations: Math.max(1, Math.round(draft.budget.maxNoProgressIterations)),
      maxValidationFailures: Math.max(1, Math.round(draft.budget.maxValidationFailures)),
      maxReroutes: Math.max(1, Math.round(draft.budget.maxReroutes)),
    },
    riskPolicy: {
      pauseOnDestructiveChange: draft.riskPolicy.pauseOnDestructiveChange,
      pauseOnDependencyChange: draft.riskPolicy.pauseOnDependencyChange,
      pauseOnLowConfidence: draft.riskPolicy.pauseOnLowConfidence,
      pauseOnHumanCheckpoint: draft.riskPolicy.pauseOnHumanCheckpoint,
      allowNetworkAnalysis: draft.riskPolicy.allowNetworkAnalysis,
      allowValidationCommands: draft.riskPolicy.allowValidationCommands,
      allowChatgptDecisionLab: draft.riskPolicy.allowChatgptDecisionLab,
      autoRunChatgptDecisionLab: draft.riskPolicy.autoRunChatgptDecisionLab,
      chatgptDecisionLabMinConfidence: draft.riskPolicy.chatgptDecisionLabMinConfidence,
      chatgptDecisionLabMaxScoreGap: draft.riskPolicy.chatgptDecisionLabMaxScoreGap,
      minimumConfidence: draft.riskPolicy.minimumConfidence,
    },
    continuationPolicy: {
      enabled: draft.continuation?.enabled ?? DEFAULT_CONTINUATION_POLICY.enabled,
      maxAutomaticFollowUps:
        draft.continuation?.maxAutomaticFollowUps ??
        DEFAULT_CONTINUATION_POLICY.maxAutomaticFollowUps,
      requireValidationSuccessToStop:
        draft.continuation?.requireValidationSuccessToStop ??
        DEFAULT_CONTINUATION_POLICY.requireValidationSuccessToStop,
      minimumConfidenceToStop:
        draft.continuation?.minimumConfidenceToStop ??
        DEFAULT_CONTINUATION_POLICY.minimumConfidenceToStop,
    },
    scenarioProfile,
  };
}

function mapRuntimeRunStateToStatus(state: HugeCodeRunSummary["state"]): AutoDriveRuntimeRunStatus {
  if (
    state === "queued" ||
    state === "preparing" ||
    state === "running" ||
    state === "validating"
  ) {
    return "running";
  }
  if (state === "paused" || state === "needs_input") {
    return "paused";
  }
  if (state === "review_ready") {
    return "review_ready";
  }
  if (state === "failed") {
    return "failed";
  }
  if (state === "cancelled") {
    return "cancelled";
  }
  return "created";
}

function mapRuntimeRunStateToStage(state: HugeCodeRunSummary["state"]): AutoDriveRunStage {
  switch (state) {
    case "queued":
    case "draft":
      return "created";
    case "preparing":
      return "preparing_context";
    case "running":
      return "executing_task";
    case "validating":
      return "validating_result";
    case "paused":
    case "needs_input":
      return "paused";
    case "review_ready":
      return "completed";
    case "cancelled":
      return "stopped";
    case "failed":
      return "failed";
    default: {
      const exhaustiveCheck: never = state;
      return exhaustiveCheck;
    }
  }
}

function mapRuntimeStopReasonCode(
  reason: AgentTaskAutoDriveStopReason | null | undefined
): AutoDriveStopReason["code"] | null {
  switch (reason) {
    case "completed":
      return "goal_reached";
    case "paused":
      return "missing_human_input";
    case "budget_exhausted":
      return "token_budget_exhausted";
    case "validation_failed":
      return "repeated_validation_failures";
    case "rerouted":
      return "no_meaningful_progress";
    case "operator_intervened":
    case "cancelled":
      return "manual_stop";
    case "failed":
      return "execution_failed";
    default:
      return null;
  }
}

function computeOverallProgress(params: {
  completedWaypoints: string[];
  pendingWaypoints: string[];
  activeWaypoint: string | null;
  status: AutoDriveRuntimeRunStatus;
}): number {
  const { completedWaypoints, pendingWaypoints, activeWaypoint, status } = params;
  if (status === "review_ready") {
    return 100;
  }
  if (status === "cancelled" || status === "failed") {
    return Math.min(
      99,
      Math.max(
        0,
        Math.round(
          (completedWaypoints.length /
            Math.max(1, completedWaypoints.length + pendingWaypoints.length)) *
            100
        )
      )
    );
  }
  const activeCount =
    activeWaypoint &&
    !completedWaypoints.includes(activeWaypoint) &&
    !pendingWaypoints.includes(activeWaypoint)
      ? 1
      : 0;
  const total = completedWaypoints.length + pendingWaypoints.length + activeCount;
  if (total <= 0) {
    return status === "running" || status === "paused" ? 5 : 0;
  }
  return Math.max(0, Math.min(100, Math.round((completedWaypoints.length / total) * 100)));
}

function deriveRuntimeTaskId(task: HugeCodeTaskSummary, run: HugeCodeRunSummary): string {
  if (task.origin.runId && task.origin.runId.trim().length > 0) {
    return task.origin.runId;
  }
  return run.id;
}

function normalizeStringArray(values: string[] | null | undefined): string[] {
  return values?.filter((value) => value.trim().length > 0) ?? [];
}

function toRuntimeScenarioProfile(
  profile: AgentTaskAutoDriveState["scenarioProfile"]
): AutoDriveRuntimeScenarioProfile | null {
  if (!profile) {
    return null;
  }
  return {
    authorityScope: profile.authorityScope ?? null,
    authoritySources: normalizeStringArray(profile.authoritySources),
    representativeCommands: normalizeStringArray(profile.representativeCommands),
    componentCommands: normalizeStringArray(profile.componentCommands),
    endToEndCommands: normalizeStringArray(profile.endToEndCommands),
    samplePaths: normalizeStringArray(profile.samplePaths),
    heldOutGuidance: normalizeStringArray(profile.heldOutGuidance),
    sourceSignals: normalizeStringArray(profile.sourceSignals),
    scenarioKeys: normalizeStringArray(profile.scenarioKeys),
    safeBackground: profile.safeBackground ?? null,
  };
}

function toRuntimeDecisionTrace(
  trace: AgentTaskAutoDriveState["decisionTrace"]
): AutoDriveRuntimeDecisionTrace | null {
  if (!trace) {
    return null;
  }
  return {
    phase: trace.phase ?? null,
    summary: trace.summary ?? null,
    selectedCandidateId: trace.selectedCandidateId ?? null,
    selectedCandidateSummary: trace.selectedCandidateSummary ?? null,
    selectionTags: normalizeStringArray(trace.selectionTags),
    representativeCommand: trace.representativeCommand ?? null,
    authoritySources: normalizeStringArray(trace.authoritySources),
    heldOutGuidance: normalizeStringArray(trace.heldOutGuidance),
  };
}

function toRuntimeOutcomeFeedback(
  feedback: AgentTaskAutoDriveState["outcomeFeedback"]
): AutoDriveRuntimeOutcomeFeedback | null {
  if (!feedback) {
    return null;
  }
  return {
    status: feedback.status ?? null,
    summary: feedback.summary ?? null,
    failureClass: feedback.failureClass ?? null,
    validationCommands: normalizeStringArray(feedback.validationCommands),
    humanInterventionRequired: feedback.humanInterventionRequired ?? null,
    heldOutPreserved: feedback.heldOutPreserved ?? null,
    at: feedback.at ?? null,
  };
}

function toRuntimeAutonomyState(
  state: AgentTaskAutoDriveState["autonomyState"]
): AutoDriveRuntimeAutonomyState | null {
  if (!state) {
    return null;
  }
  return {
    independentThread: state.independentThread ?? null,
    autonomyPriority: state.autonomyPriority ?? null,
    highPriority: state.highPriority ?? null,
    escalationPressure:
      state.escalationPressure === "low" ||
      state.escalationPressure === "medium" ||
      state.escalationPressure === "high"
        ? state.escalationPressure
        : null,
    unattendedContinuationAllowed: state.unattendedContinuationAllowed ?? null,
    backgroundSafe: state.backgroundSafe ?? null,
    humanInterventionHotspots: normalizeStringArray(state.humanInterventionHotspots),
  };
}

function toRuntimeContinuationPolicy(
  policy: AgentTaskAutoDriveState["continuationPolicy"]
): AutoDriveContinuationPolicy | null {
  if (!policy) {
    return null;
  }
  return {
    enabled: policy.enabled ?? DEFAULT_CONTINUATION_POLICY.enabled,
    maxAutomaticFollowUps:
      policy.maxAutomaticFollowUps ?? DEFAULT_CONTINUATION_POLICY.maxAutomaticFollowUps,
    requireValidationSuccessToStop:
      policy.requireValidationSuccessToStop ??
      DEFAULT_CONTINUATION_POLICY.requireValidationSuccessToStop,
    minimumConfidenceToStop:
      policy.minimumConfidenceToStop ?? DEFAULT_CONTINUATION_POLICY.minimumConfidenceToStop,
  };
}

function toRuntimeContinuationState(
  state: AgentTaskAutoDriveState["continuationState"]
): AutoDriveRuntimeContinuationState | null {
  if (!state) {
    return null;
  }
  return {
    automaticFollowUpCount: state.automaticFollowUpCount ?? 0,
    status: state.status === "continuing" || state.status === "stopped" ? state.status : "idle",
    lastContinuationAt: state.lastContinuationAt ?? null,
    lastContinuationReason: state.lastContinuationReason ?? null,
  };
}

function toRuntimeResearchTrace(
  trace: AgentTaskAutoDriveState["researchTrace"]
): AutoDriveRuntimeResearchTrace | null {
  if (!trace) {
    return null;
  }
  return {
    status:
      trace.status === "in_progress" ||
      trace.status === "selected" ||
      trace.status === "gap" ||
      trace.status === "blocked"
        ? trace.status
        : "gap",
    summary: trace.summary ?? "",
    blockingReason: trace.blockingReason ?? null,
  };
}

function toRuntimeResearchSources(
  sources: AgentTaskAutoDriveState["researchSources"]
): AutoDriveResearchSource[] {
  return (sources ?? [])
    .map((entry) => ({
      label: typeof entry.label === "string" ? entry.label.trim() : "",
      url: typeof entry.url === "string" && entry.url.trim().length > 0 ? entry.url.trim() : null,
      domain:
        typeof entry.domain === "string" && entry.domain.trim().length > 0
          ? entry.domain.trim()
          : null,
    }))
    .filter((entry) => entry.label.length > 0);
}

function toRuntimeResearchSourceAssessment(
  value: NonNullable<AgentTaskAutoDriveState["lastChatgptResearchRouteLab"]>["sourceAssessment"]
): AutoDriveResearchSourceAssessment | null {
  if (!value) {
    return null;
  }
  return {
    status:
      value.status === "trusted" || value.status === "mixed" || value.status === "insufficient"
        ? value.status
        : null,
    trustedSourceCount: value.trustedSourceCount ?? 0,
    totalSourceCount: value.totalSourceCount ?? 0,
    domains: normalizeStringArray(value.domains),
  };
}

function toRuntimeResearchSession(
  value: AgentTaskAutoDriveState["researchSession"]
): AutoDriveRuntimeResearchSession | null {
  if (!value) {
    return null;
  }
  return {
    phase:
      value.phase === "queued" ||
      value.phase === "researching" ||
      value.phase === "synthesizing" ||
      value.phase === "selected" ||
      value.phase === "gap" ||
      value.phase === "blocked"
        ? value.phase
        : "gap",
    summary: value.summary ?? "",
    blockingReason: value.blockingReason ?? null,
    trustedSourceCount: value.trustedSourceCount ?? 0,
    totalSourceCount: value.totalSourceCount ?? 0,
    sourceDomains: normalizeStringArray(value.sourceDomains),
    trustedDomains: normalizeStringArray(value.trustedDomains),
    focusAreas: normalizeStringArray(value.focusAreas),
    allowLiveWebResearch:
      typeof value.allowLiveWebResearch === "boolean" ? value.allowLiveWebResearch : null,
    coverageGaps: normalizeStringArray(value.coverageGaps),
    recommendedCandidateId: value.recommendedCandidateId ?? null,
  };
}

function toRuntimeResearchRouteLabResult(
  value: AgentTaskAutoDriveState["lastChatgptResearchRouteLab"]
): AutoDriveChatgptResearchRouteLabResult | null {
  if (!value) {
    return null;
  }
  return {
    phase:
      value.phase === "queued" ||
      value.phase === "researching" ||
      value.phase === "synthesizing" ||
      value.phase === "selected" ||
      value.phase === "gap" ||
      value.phase === "blocked"
        ? value.phase
        : null,
    recommendedRoute: value.recommendedRoute ?? null,
    alternativeRoutes: normalizeStringArray(value.alternativeRoutes),
    decisionMemo: value.decisionMemo ?? null,
    recommendedRouteRationale: value.recommendedRouteRationale ?? null,
    sources: toRuntimeResearchSources(value.sources),
    sourceAssessment: toRuntimeResearchSourceAssessment(value.sourceAssessment),
    confidence:
      value.confidence === "low" || value.confidence === "medium" || value.confidence === "high"
        ? value.confidence
        : null,
    openQuestions: normalizeStringArray(value.openQuestions),
    coverageGaps: normalizeStringArray(value.coverageGaps),
    blockedReason: value.blockedReason ?? null,
  };
}

function adaptRun(params: {
  run: HugeCodeRunSummary;
  task: HugeCodeTaskSummary;
  workspaceRootPath: string;
}): AutoDriveRuntimeRunRecord | null {
  const autoDrive = params.run.autoDrive;
  if (!autoDrive) {
    return null;
  }
  const destination = autoDrive.destination;
  const budget = {
    maxTokens: autoDrive.budget?.maxTokens ?? DEFAULT_BUDGET.maxTokens,
    maxIterations: autoDrive.budget?.maxIterations ?? DEFAULT_BUDGET.maxIterations,
    maxDurationMs: autoDrive.budget?.maxDurationMs ?? DEFAULT_BUDGET.maxDurationMinutes * 60 * 1000,
    maxFilesPerIteration:
      autoDrive.budget?.maxFilesPerIteration ?? DEFAULT_BUDGET.maxFilesPerIteration,
    maxNoProgressIterations:
      autoDrive.budget?.maxNoProgressIterations ?? DEFAULT_BUDGET.maxNoProgressIterations,
    maxValidationFailures:
      autoDrive.budget?.maxValidationFailures ?? DEFAULT_BUDGET.maxValidationFailures,
    maxReroutes: autoDrive.budget?.maxReroutes ?? DEFAULT_BUDGET.maxReroutes,
  };
  const runtimeRiskPolicy = autoDrive.riskPolicy;
  const riskPolicy = {
    pauseOnDestructiveChange:
      runtimeRiskPolicy?.pauseOnDestructiveChange ?? DEFAULT_RISK_POLICY.pauseOnDestructiveChange,
    pauseOnDependencyChange:
      runtimeRiskPolicy?.pauseOnDependencyChange ?? DEFAULT_RISK_POLICY.pauseOnDependencyChange,
    pauseOnLowConfidence:
      runtimeRiskPolicy?.pauseOnLowConfidence ?? DEFAULT_RISK_POLICY.pauseOnLowConfidence,
    pauseOnHumanCheckpoint:
      runtimeRiskPolicy?.pauseOnHumanCheckpoint ?? DEFAULT_RISK_POLICY.pauseOnHumanCheckpoint,
    allowNetworkAnalysis:
      runtimeRiskPolicy?.allowNetworkAnalysis ?? DEFAULT_RISK_POLICY.allowNetworkAnalysis,
    allowValidationCommands:
      runtimeRiskPolicy?.allowValidationCommands ?? DEFAULT_RISK_POLICY.allowValidationCommands,
    minimumConfidence:
      runtimeRiskPolicy?.minimumConfidence ?? DEFAULT_RISK_POLICY.minimumConfidence,
  };
  const completedWaypoints = autoDrive.navigation?.completedWaypoints ?? [];
  const pendingWaypoints = autoDrive.navigation?.pendingWaypoints ?? [];
  const activeWaypoint = autoDrive.navigation?.activeWaypoint ?? null;
  const runtimeScenarioProfile = toRuntimeScenarioProfile(autoDrive.scenarioProfile);
  const runtimeDecisionTrace = toRuntimeDecisionTrace(autoDrive.decisionTrace);
  const runtimeOutcomeFeedback = toRuntimeOutcomeFeedback(autoDrive.outcomeFeedback);
  const runtimeAutonomyState = toRuntimeAutonomyState(autoDrive.autonomyState);
  const runtimeContinuationPolicy = toRuntimeContinuationPolicy(autoDrive.continuationPolicy);
  const runtimeContinuationState = toRuntimeContinuationState(autoDrive.continuationState);
  const runtimeResearchTrace = toRuntimeResearchTrace(autoDrive.researchTrace);
  const runtimeResearchSession = toRuntimeResearchSession(autoDrive.researchSession);
  const runtimeResearchSources = toRuntimeResearchSources(autoDrive.researchSources);
  const lastChatgptResearchRouteLab = toRuntimeResearchRouteLabResult(
    autoDrive.lastChatgptResearchRouteLab
  );
  const status = mapRuntimeRunStateToStatus(params.run.state);
  const overallProgress = computeOverallProgress({
    completedWaypoints,
    pendingWaypoints,
    activeWaypoint,
    status,
  });
  const iteration = completedWaypoints.length + (activeWaypoint ? 1 : 0);
  const maxIterations = Math.max(1, budget.maxIterations ?? DEFAULT_BUDGET.maxIterations);
  const remainingIterations = Math.max(0, maxIterations - iteration);
  const elapsedMs =
    params.run.startedAt !== null
      ? Math.max(0, (params.run.finishedAt ?? params.run.updatedAt) - params.run.startedAt)
      : 0;
  const remainingTokens = null;
  const remainingDurationMs =
    budget.maxDurationMs !== null && budget.maxDurationMs !== undefined
      ? Math.max(0, budget.maxDurationMs - elapsedMs)
      : null;
  const stopCode = mapRuntimeStopReasonCode(autoDrive.stop?.reason);
  const lastStopReason = stopCode
    ? {
        code: stopCode,
        detail:
          autoDrive.stop?.summary ??
          (status === "review_ready"
            ? "Destination reached and queued for review."
            : status === "cancelled"
              ? "Route cancelled by operator intervention."
              : status === "failed"
                ? "Route failed and requires operator action."
                : "AutoDrive state updated."),
      }
    : null;

  return {
    schemaVersion: "autodrive-run/v2",
    runId: params.run.id,
    workspaceId: params.run.workspaceId,
    workspacePath: params.workspaceRootPath,
    threadId: params.task.origin.threadId ?? null,
    status,
    stage: mapRuntimeRunStateToStage(params.run.state),
    destination: {
      title: destination.title,
      desiredEndState: destination.desiredEndState ?? [],
      doneDefinition: {
        arrivalCriteria: destination.doneDefinition?.arrivalCriteria ?? [],
        requiredValidation: destination.doneDefinition?.requiredValidation ?? [],
        waypointIndicators: destination.doneDefinition?.waypointIndicators ?? [],
      },
      hardBoundaries: destination.hardBoundaries ?? [],
      routePreference: fromRuntimeRoutePreference(destination.routePreference),
    },
    budget: {
      maxTokens: budget.maxTokens ?? DEFAULT_BUDGET.maxTokens,
      maxIterations,
      maxDurationMs: budget.maxDurationMs ?? null,
      maxFilesPerIteration: budget.maxFilesPerIteration ?? null,
      maxNoProgressIterations:
        budget.maxNoProgressIterations ?? DEFAULT_BUDGET.maxNoProgressIterations,
      maxValidationFailures: budget.maxValidationFailures ?? DEFAULT_BUDGET.maxValidationFailures,
      maxReroutes: budget.maxReroutes ?? DEFAULT_BUDGET.maxReroutes,
    },
    riskPolicy,
    continuationPolicy: runtimeContinuationPolicy ?? DEFAULT_CONTINUATION_POLICY,
    continuationState: runtimeContinuationState,
    execution: null,
    iteration,
    totals: {
      consumedTokensEstimate: 0,
      elapsedMs,
      validationFailureCount: autoDrive.navigation?.validationFailureCount ?? 0,
      noProgressCount: autoDrive.navigation?.noProgressIterations ?? 0,
      repeatedFailureCount: 0,
      rerouteCount: autoDrive.navigation?.rerouteCount ?? 0,
    },
    blockers: [],
    completedSubgoals: completedWaypoints,
    summaries: [],
    navigation: {
      destinationSummary: destination.title,
      startStateSummary: null,
      routeSummary:
        params.run.summary ??
        (destination.desiredEndState?.length ? destination.desiredEndState.join(" -> ") : null),
      currentWaypointTitle: activeWaypoint,
      currentWaypointObjective: activeWaypoint ? `Advance waypoint: ${activeWaypoint}.` : null,
      currentWaypointArrivalCriteria:
        destination.doneDefinition?.arrivalCriteria ??
        destination.doneDefinition?.waypointIndicators ??
        [],
      waypointStatus:
        status === "review_ready"
          ? "arrived"
          : status === "failed"
            ? "blocked"
            : activeWaypoint
              ? "active"
              : null,
      remainingMilestones: pendingWaypoints,
      currentMilestone: activeWaypoint,
      overallProgress,
      waypointCompletion:
        status === "review_ready"
          ? 100
          : status === "paused"
            ? Math.max(20, Math.min(95, overallProgress))
            : status === "running"
              ? Math.max(10, Math.min(95, overallProgress))
              : overallProgress,
      offRoute: autoDrive.stop?.reason === "rerouted",
      rerouting: autoDrive.stop?.reason === "rerouted",
      rerouteReason:
        autoDrive.stop?.reason === "rerouted" ? (autoDrive.stop?.summary ?? null) : null,
      remainingBlockers: [],
      arrivalConfidence: riskPolicy.minimumConfidence,
      stopRisk:
        runtimeAutonomyState?.escalationPressure ??
        (status === "failed" ? "high" : status === "paused" ? "medium" : "low"),
      remainingTokens,
      remainingIterations,
      remainingDurationMs,
      lastDecision: runtimeDecisionTrace?.summary ?? autoDrive.stop?.reason ?? null,
    },
    createdAt: params.run.startedAt ?? params.run.updatedAt,
    updatedAt: params.run.updatedAt,
    startedAt: params.run.startedAt,
    completedAt: params.run.finishedAt,
    lastStopReason,
    sessionId: null,
    lastValidationSummary: params.run.validations?.[0]?.summary ?? null,
    currentBlocker: runtimeOutcomeFeedback?.summary ?? params.run.warnings?.[0] ?? null,
    latestReroute:
      autoDrive.stop?.reason === "rerouted"
        ? {
            iteration,
            mode: "soft",
            reason: autoDrive.stop.summary ?? "Runtime signalled a reroute.",
            trigger: "runtime_stop",
            previousRouteSummary: params.run.summary ?? null,
            nextRouteSummary: null,
            createdAt: autoDrive.stop.at ?? params.run.updatedAt,
          }
        : null,
    runtimeScenarioProfile,
    runtimeDecisionTrace,
    runtimeOutcomeFeedback,
    runtimeAutonomyState,
    runtimeContinuationState,
    runtimeResearchTrace,
    runtimeResearchSession,
    runtimeResearchSources,
    lastChatgptResearchRouteLab,
  };
}

function isStandaloneAutoDriveTask(task: HugeCodeTaskSummary): boolean {
  const source = task.taskSource;
  if (!source) {
    return false;
  }
  if (source.kind === "autodrive") {
    return true;
  }
  return source.externalId?.startsWith("autodrive:") ?? false;
}

function selectThreadCandidateTasks(params: {
  snapshot: HugeCodeMissionControlSnapshot;
  workspaceId: string;
  threadId: string;
}): HugeCodeTaskSummary[] {
  return params.snapshot.tasks.filter((task) => {
    if (task.workspaceId !== params.workspaceId) {
      return false;
    }
    if (task.id === params.threadId) {
      return true;
    }
    return task.origin.threadId === params.threadId;
  });
}

function selectWorkspaceAutoDriveTasks(params: {
  snapshot: HugeCodeMissionControlSnapshot;
  workspaceId: string;
}): HugeCodeTaskSummary[] {
  return params.snapshot.tasks.filter((task) => {
    if (task.workspaceId !== params.workspaceId) {
      return false;
    }
    return isStandaloneAutoDriveTask(task);
  });
}

function selectAutoDriveRuns(params: {
  snapshot: HugeCodeMissionControlSnapshot;
  workspaceId: string;
  taskIds: Set<string>;
}): HugeCodeRunSummary[] {
  return params.snapshot.runs
    .filter((run) => run.workspaceId === params.workspaceId)
    .filter((run) => params.taskIds.has(run.taskId))
    .filter((run) => run.autoDrive !== null && run.autoDrive !== undefined)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export function selectAutoDriveSnapshot(params: {
  missionControlProjection: HugeCodeMissionControlSnapshot | null;
  workspaceId: string | null;
  threadId: string | null;
}): AutoDriveSnapshotSelection {
  const snapshot = params.missionControlProjection;
  if (!snapshot || !params.workspaceId) {
    return {
      source: snapshot?.source ?? null,
      task: null,
      run: null,
      runtimeTaskId: null,
      adaptedRun: null,
      recovering: false,
      recoverySummary: null,
    };
  }

  const threadBoundTasks =
    params.threadId === null
      ? []
      : selectThreadCandidateTasks({
          snapshot,
          workspaceId: params.workspaceId,
          threadId: params.threadId,
        });
  const standaloneAutoDriveTasks = selectWorkspaceAutoDriveTasks({
    snapshot,
    workspaceId: params.workspaceId,
  });
  const candidateTasks = params.threadId === null ? standaloneAutoDriveTasks : threadBoundTasks;
  const candidateTaskIds = new Set(candidateTasks.map((task) => task.id));
  let candidateRuns = selectAutoDriveRuns({
    snapshot,
    workspaceId: params.workspaceId,
    taskIds: candidateTaskIds,
  });

  if (
    params.threadId === null &&
    candidateRuns.length === 0 &&
    standaloneAutoDriveTasks.length > 0
  ) {
    const fallbackTaskIds = new Set(standaloneAutoDriveTasks.map((task) => task.id));
    candidateRuns = selectAutoDriveRuns({
      snapshot,
      workspaceId: params.workspaceId,
      taskIds: fallbackTaskIds,
    });
  }

  if (candidateTasks.length === 0 && candidateRuns.length === 0) {
    return {
      source: snapshot.source,
      task: null,
      run: null,
      runtimeTaskId: null,
      adaptedRun: null,
      recovering: false,
      recoverySummary: null,
    };
  }

  const selectedRun = candidateRuns[0] ?? null;
  if (!selectedRun) {
    return {
      source: snapshot.source,
      task: candidateTasks[0] ?? null,
      run: null,
      runtimeTaskId: null,
      adaptedRun: null,
      recovering: false,
      recoverySummary: null,
    };
  }

  const selectedTask =
    candidateTasks.find((task) => task.id === selectedRun.taskId) ??
    (params.threadId === null
      ? standaloneAutoDriveTasks.find((task) => task.id === selectedRun.taskId)
      : undefined) ??
    candidateTasks[0] ??
    (params.threadId === null ? standaloneAutoDriveTasks[0] : undefined) ??
    null;
  if (!selectedTask) {
    return {
      source: snapshot.source,
      task: null,
      run: null,
      runtimeTaskId: null,
      adaptedRun: null,
      recovering: false,
      recoverySummary: null,
    };
  }

  const workspaceRootPath =
    snapshot.workspaces.find((workspace) => workspace.id === selectedRun.workspaceId)?.rootPath ??
    "";
  const recovering =
    selectedRun.autoDrive?.recovery?.recovered === true ||
    (selectedRun.ledger?.recovered === true &&
      (selectedRun.state === "paused" || selectedRun.state === "cancelled"));
  const recoverySummary =
    selectedRun.autoDrive?.recovery?.summary ??
    (recovering ? "Runtime recovered AutoDrive from a checkpoint. Resume to continue." : null);

  return {
    source: snapshot.source,
    task: selectedTask,
    run: selectedRun,
    runtimeTaskId: deriveRuntimeTaskId(selectedTask, selectedRun),
    adaptedRun: adaptRun({
      run: selectedRun,
      task: selectedTask,
      workspaceRootPath,
    }),
    recovering,
    recoverySummary,
  };
}
