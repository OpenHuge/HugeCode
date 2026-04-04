import {
  resolveCanonicalRuntimeTruth,
  type AgentTaskExecutionProfileReadiness,
  type AgentTaskSummary,
  type HugeCodeMissionLineage,
  type HugeCodeRunLedger,
  type HugeCodeRunState,
  type HugeCodeRunSummary,
  type HugeCodeSubAgentSummary,
  type HugeCodeTaskMode,
  type HugeCodeTaskModeSource,
  type HugeCodeTaskSourceSummary,
} from "@ku0/code-runtime-host-contract";

export type RuntimeMissionControlTaskModeSummary = {
  mode: HugeCodeTaskMode | null;
  modeSource: HugeCodeTaskModeSource;
};

export type RuntimeMissionControlRunProjectionHelpers<TRoutingContext = unknown> = {
  resolveExecutionProfile: (
    task: AgentTaskSummary,
    preferredExecutionProfileId: string | null
  ) => HugeCodeRunSummary["executionProfile"];
  deriveTaskMode: (
    run: Pick<HugeCodeRunSummary, "executionProfile">
  ) => RuntimeMissionControlTaskModeSummary;
  buildRoutingSummary: (
    task: AgentTaskSummary,
    routingContext?: TRoutingContext
  ) => HugeCodeRunSummary["routing"];
  buildProfileReadiness: (
    routing: HugeCodeRunSummary["routing"],
    readiness: AgentTaskExecutionProfileReadiness | null
  ) => HugeCodeRunSummary["profileReadiness"];
  buildApprovalSummary: (task: AgentTaskSummary) => HugeCodeRunSummary["approval"];
  buildReviewDecisionSummary: (
    task: AgentTaskSummary,
    state: HugeCodeRunState
  ) => HugeCodeRunSummary["reviewDecision"];
  buildInterventionSummary: (task: AgentTaskSummary) => HugeCodeRunSummary["intervention"];
  buildOperatorState: (
    task: AgentTaskSummary,
    approval: HugeCodeRunSummary["approval"],
    routing: HugeCodeRunSummary["routing"],
    reviewDecision: HugeCodeRunSummary["reviewDecision"]
  ) => HugeCodeRunSummary["operatorState"];
  buildNextAction: (
    task: AgentTaskSummary,
    approval: HugeCodeRunSummary["approval"],
    intervention: HugeCodeRunSummary["intervention"],
    reviewDecision: HugeCodeRunSummary["reviewDecision"]
  ) => HugeCodeRunSummary["nextAction"];
  deriveRunValidations: (task: AgentTaskSummary) => HugeCodeRunSummary["validations"];
  deriveRunArtifacts: (task: AgentTaskSummary) => HugeCodeRunSummary["artifacts"];
  deriveRunChangedPaths: (task: AgentTaskSummary) => HugeCodeRunSummary["changedPaths"];
  deriveRunWarnings: (
    task: AgentTaskSummary,
    routeHint: string | null
  ) => HugeCodeRunSummary["warnings"];
  deriveRunCompletionReason: (task: AgentTaskSummary) => string | null;
  deriveRuntimeTaskSource: (
    task: AgentTaskSummary,
    fallbackTitle: string | null
  ) => HugeCodeTaskSourceSummary | null;
  normalizeSubAgentSessions: (
    subAgents: HugeCodeSubAgentSummary[] | null | undefined
  ) => HugeCodeSubAgentSummary[];
  buildGovernanceSummary: (input: {
    runState: HugeCodeRunState;
    approval: HugeCodeRunSummary["approval"];
    reviewDecision: HugeCodeRunSummary["reviewDecision"];
    intervention: HugeCodeRunSummary["intervention"];
    nextAction: HugeCodeRunSummary["nextAction"];
    completionReason: string | null;
    subAgents: HugeCodeSubAgentSummary[];
  }) => HugeCodeRunSummary["governance"];
  buildMissionLineage: (input: {
    objective: string | null;
    taskSource?: HugeCodeTaskSourceSummary | null;
    threadId?: string | null;
    requestId?: string | null;
    executionProfileId?: string | null;
    taskMode?: HugeCodeTaskMode | null;
    rootTaskId?: string | null;
    parentTaskId?: string | null;
    childTaskIds?: string[] | null;
    autoDrive?: HugeCodeRunSummary["autoDrive"] | null;
    reviewDecision?: HugeCodeRunSummary["reviewDecision"] | null;
  }) => HugeCodeMissionLineage;
  buildRunLedger: (input: {
    task: AgentTaskSummary;
    warnings: string[];
    validations: HugeCodeRunSummary["validations"];
    artifacts: HugeCodeRunSummary["artifacts"];
    routing: HugeCodeRunSummary["routing"];
    completionReason: string | null;
  }) => HugeCodeRunLedger;
  buildPlacementEvidence: (input: {
    task: AgentTaskSummary;
    routing: HugeCodeRunSummary["routing"];
    executionProfile: HugeCodeRunSummary["executionProfile"];
  }) => HugeCodeRunSummary["placement"];
  buildRunOperatorSnapshot: (input: {
    task: AgentTaskSummary;
    runState: HugeCodeRunState;
    executionProfile: HugeCodeRunSummary["executionProfile"];
    routing: HugeCodeRunSummary["routing"];
    workspaceRoot: string | null;
  }) => HugeCodeRunSummary["operatorSnapshot"];
  buildRunWorkspaceEvidence: (input: {
    run: HugeCodeRunSummary;
  }) => HugeCodeRunSummary["workspaceEvidence"];
  projectRuntimeExecutionGraphSummary: (
    executionGraph: AgentTaskSummary["executionGraph"]
  ) => HugeCodeRunSummary["executionGraph"];
  projectAgentTaskStatusToRunState: (status: AgentTaskSummary["status"]) => HugeCodeRunState;
  isTerminalRunState: (state: HugeCodeRunState) => boolean;
  resolveMissionTaskId: (taskId: string, threadId?: string | null) => string;
  buildRunPublishHandoff: (
    task: Pick<AgentTaskSummary, "taskId" | "publishHandoff" | "autoDrive">
  ) => HugeCodeRunSummary["publishHandoff"];
  buildMissionRunCheckpoint: (task: AgentTaskSummary) => HugeCodeRunSummary["checkpoint"];
};

export type RuntimeMissionControlRunProjectionOptions<TRoutingContext = unknown> = {
  taskId?: string | null;
  preferredExecutionProfileId?: string | null;
  routingContext?: TRoutingContext;
  subAgents?: HugeCodeSubAgentSummary[] | null;
  workspaceRoot?: string | null;
};

export function projectAgentTaskSummaryToRunSummary<TRoutingContext = unknown>(
  task: AgentTaskSummary,
  helpers: RuntimeMissionControlRunProjectionHelpers<TRoutingContext>,
  options?: RuntimeMissionControlRunProjectionOptions<TRoutingContext>
): HugeCodeRunSummary {
  const summary =
    (task.steps ?? [])
      .map((step) => step.message?.trim() ?? "")
      .find((entry) => entry.length > 0) ?? null;
  const executionProfile = helpers.resolveExecutionProfile(
    task,
    options?.preferredExecutionProfileId ?? null
  );
  const state =
    task.status === "running" && task.distributedStatus === "planning"
      ? "preparing"
      : task.status === "running" && task.distributedStatus === "aggregating"
        ? "validating"
        : helpers.projectAgentTaskStatusToRunState(task.status);
  const routing = helpers.buildRoutingSummary(task, options?.routingContext);
  const approval = helpers.buildApprovalSummary(task);
  const reviewDecision = helpers.buildReviewDecisionSummary(task, state);
  const intervention = helpers.buildInterventionSummary(task);
  const operatorState = helpers.buildOperatorState(task, approval, routing, reviewDecision);
  const nextAction = helpers.buildNextAction(task, approval, intervention, reviewDecision);
  const validations = helpers.deriveRunValidations(task) ?? [];
  const artifacts = helpers.deriveRunArtifacts(task) ?? [];
  const changedPaths = helpers.deriveRunChangedPaths(task) ?? [];
  const warnings = helpers.deriveRunWarnings(task, routing?.routeHint ?? null) ?? [];
  const taskMode = helpers.deriveTaskMode({ executionProfile });
  const completionReason = helpers.deriveRunCompletionReason(task);
  const taskSource = helpers.deriveRuntimeTaskSource(task, task.title?.trim() || summary || null);
  const normalizedSubAgents = helpers.normalizeSubAgentSessions(options?.subAgents);
  const governance = helpers.buildGovernanceSummary({
    runState: state,
    approval,
    reviewDecision,
    intervention,
    nextAction,
    completionReason,
    subAgents: normalizedSubAgents,
  });
  const lineage = helpers.buildMissionLineage({
    objective: task.title?.trim() || summary || null,
    taskSource,
    threadId: task.threadId ?? null,
    requestId: task.requestId ?? null,
    executionProfileId: executionProfile?.id ?? task.executionProfileId ?? null,
    taskMode: taskMode.mode,
    rootTaskId: task.rootTaskId ?? null,
    parentTaskId: task.parentTaskId ?? null,
    childTaskIds: task.childTaskIds ?? [],
    autoDrive: task.autoDrive ?? null,
    reviewDecision,
  });
  const ledger = helpers.buildRunLedger({
    task,
    warnings,
    validations,
    artifacts,
    routing,
    completionReason,
  });
  const placement = helpers.buildPlacementEvidence({
    task,
    routing,
    executionProfile,
  });
  const operatorSnapshot = helpers.buildRunOperatorSnapshot({
    task,
    runState: state,
    executionProfile,
    routing,
    workspaceRoot: options?.workspaceRoot ?? null,
  });

  const baseRun: HugeCodeRunSummary = {
    id: task.taskId,
    taskId: options?.taskId ?? helpers.resolveMissionTaskId(task.taskId, task.threadId),
    workspaceId: task.workspaceId,
    state,
    title: task.title?.trim() || null,
    summary,
    taskSource,
    startedAt: task.startedAt,
    finishedAt: task.completedAt,
    updatedAt: task.updatedAt,
    currentStepIndex: task.currentStep,
    pendingIntervention: intervention?.primaryAction ?? null,
    executionProfile,
    reviewProfileId: task.reviewProfileId ?? null,
    profileReadiness: helpers.buildProfileReadiness(routing, task.profileReadiness ?? null),
    routing,
    approval,
    reviewDecision,
    intervention,
    operatorState,
    nextAction,
    warnings,
    validations,
    artifacts,
    changedPaths,
    autoDrive: task.autoDrive ?? null,
    completionReason,
    reviewPackId:
      task.reviewPackId ??
      (helpers.isTerminalRunState(state) ? `review-pack:${task.taskId}` : null),
    lineage,
    ledger,
    checkpoint: helpers.buildMissionRunCheckpoint(task),
    missionLinkage: task.missionLinkage ?? null,
    actionability: task.reviewActionability ?? null,
    takeoverBundle: task.takeoverBundle ?? null,
    reviewGate: task.reviewGate ?? null,
    reviewFindings: task.reviewFindings ?? null,
    reviewRunId: task.reviewRunId ?? null,
    skillUsage: task.skillUsage ?? null,
    autofixCandidate: task.autofixCandidate ?? null,
    governance,
    placement,
    operatorSnapshot,
    missionBrief: task.missionBrief ?? null,
    relaunchContext: task.relaunchContext ?? null,
    subAgents: normalizedSubAgents,
    publishHandoff: helpers.buildRunPublishHandoff(task),
    executionGraph: helpers.projectRuntimeExecutionGraphSummary(task.executionGraph),
  };

  const canonicalTruth = resolveCanonicalRuntimeTruth({
    workspaceId: baseRun.workspaceId,
    taskId: baseRun.taskId,
    runId: baseRun.id,
    reviewPackId: baseRun.reviewPackId ?? null,
    state: baseRun.state,
    checkpoint: baseRun.checkpoint ?? null,
    missionLinkage: baseRun.missionLinkage ?? null,
    actionability: baseRun.actionability ?? null,
    publishHandoff: baseRun.publishHandoff ?? null,
    takeoverBundle: baseRun.takeoverBundle ?? null,
    sessionBoundary: task.sessionBoundary ?? null,
    continuation: task.continuation ?? null,
    approval: baseRun.approval ?? null,
    reviewDecision: baseRun.reviewDecision ?? null,
    nextAction: baseRun.nextAction ?? null,
    nextOperatorAction: task.nextOperatorAction ?? null,
  });

  const run: HugeCodeRunSummary = {
    ...baseRun,
    sessionBoundary: canonicalTruth.sessionBoundary,
    continuation: canonicalTruth.continuation,
    nextOperatorAction: canonicalTruth.nextOperatorAction,
  };

  return {
    ...run,
    workspaceEvidence: helpers.buildRunWorkspaceEvidence({ run }),
  };
}
