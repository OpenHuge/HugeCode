import type {
  AgentTaskSummary,
  HugeCodeMissionLineage,
  HugeCodeRunLedger,
  HugeCodeRunState,
  HugeCodeRunSummary,
  HugeCodeSubAgentSummary,
  HugeCodeTaskMode,
  HugeCodeTaskModeSource,
  HugeCodeTaskSourceSummary,
} from "@ku0/code-runtime-host-contract";
import { resolveExecutionProfile } from "./runtimeMissionControlExecutionProfiles";
import { buildProfileReadiness, buildRoutingSummary } from "./runtimeMissionControlRouting";
import type { RunProjectionRoutingContext } from "./runtimeMissionControlRouting";
import { buildMissionRunCheckpoint } from "./runtimeMissionControlCheckpoint";
import {
  buildApprovalSummary,
  buildGovernanceSummary,
  buildInterventionSummary,
  buildNextAction,
  buildOperatorState,
  buildReviewDecisionSummary,
} from "./runtimeMissionControlRunState";
import {
  deriveRunArtifacts,
  deriveRunChangedPaths,
  deriveRunCompletionReason,
  deriveRunValidations,
  deriveRunWarnings,
} from "./runtimeMissionControlReviewPack";
import {
  buildRunOperatorSnapshot,
  buildRunWorkspaceEvidence,
} from "./runtimeMissionControlRuntimeTruth";
import { projectRuntimeExecutionGraphSummary } from "./runtimeMissionControlExecutionGraph";
import { deriveRuntimeTaskSource } from "./runtimeMissionControlTaskSourceSummary";
import { buildPlacementEvidence } from "./runtimeMissionControlPlacement";

type TaskModeSummary = {
  mode: HugeCodeTaskMode | null;
  modeSource: HugeCodeTaskModeSource;
};

type RunProjectionHelpers = {
  deriveTaskMode(run: Pick<HugeCodeRunSummary, "executionProfile">): TaskModeSummary;
  buildMissionLineage(input: {
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
  }): HugeCodeMissionLineage;
  buildRunLedger(input: {
    task: AgentTaskSummary;
    warnings: string[];
    validations: HugeCodeRunSummary["validations"];
    artifacts: HugeCodeRunSummary["artifacts"];
    routing: HugeCodeRunSummary["routing"];
    completionReason: string | null;
  }): HugeCodeRunLedger;
  normalizeSubAgentSessions(
    subAgents: HugeCodeSubAgentSummary[] | null | undefined
  ): HugeCodeSubAgentSummary[];
  projectAgentTaskStatusToRunState(status: AgentTaskSummary["status"]): HugeCodeRunState;
  isTerminalRunState(state: HugeCodeRunState): boolean;
  resolveMissionTaskId(taskId: string, threadId?: string | null): string;
  buildRunPublishHandoff(
    task: Pick<AgentTaskSummary, "taskId" | "publishHandoff" | "autoDrive">
  ): HugeCodeRunSummary["publishHandoff"];
};

export function projectAgentTaskSummaryToRunSummary(
  task: AgentTaskSummary,
  helpers: RunProjectionHelpers,
  options?: {
    taskId?: string | null;
    routingContext?: RunProjectionRoutingContext;
    subAgents?: HugeCodeSubAgentSummary[] | null;
    workspaceRoot?: string | null;
  }
): HugeCodeRunSummary {
  const summary =
    (task.steps ?? [])
      .map((step) => step.message?.trim() ?? "")
      .find((entry) => entry.length > 0) ?? null;
  const executionProfile = resolveExecutionProfile(
    task,
    options?.routingContext?.preferredExecutionProfileId ?? null
  );
  const state =
    task.status === "running" && task.distributedStatus === "planning"
      ? "preparing"
      : task.status === "running" && task.distributedStatus === "aggregating"
        ? "validating"
        : helpers.projectAgentTaskStatusToRunState(task.status);
  const routing = buildRoutingSummary(task, options?.routingContext);
  const approval = buildApprovalSummary(task);
  const reviewDecision = buildReviewDecisionSummary(task, state);
  const intervention = buildInterventionSummary(task);
  const operatorState = buildOperatorState(task, approval, routing, reviewDecision);
  const nextAction = buildNextAction(task, approval, intervention, reviewDecision);
  const validations = deriveRunValidations(task);
  const artifacts = deriveRunArtifacts(task);
  const changedPaths = deriveRunChangedPaths(task);
  const warnings = deriveRunWarnings(task, routing?.routeHint ?? null);
  const taskMode = helpers.deriveTaskMode({ executionProfile });
  const completionReason = deriveRunCompletionReason(task);
  const taskSource = deriveRuntimeTaskSource(task, task.title?.trim() || summary || null);
  const normalizedSubAgents = helpers.normalizeSubAgentSessions(options?.subAgents);
  const governance = buildGovernanceSummary({
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
  const placement = buildPlacementEvidence({
    task,
    routing,
    executionProfile,
    routingContext: options?.routingContext,
  });
  const operatorSnapshot = buildRunOperatorSnapshot({
    task,
    runState: state,
    executionProfile,
    routing,
    workspaceRoot: options?.workspaceRoot ?? null,
  });

  const run: HugeCodeRunSummary = {
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
    pendingIntervention: intervention.primaryAction,
    executionProfile,
    reviewProfileId: task.reviewProfileId ?? null,
    profileReadiness: buildProfileReadiness(routing, task.profileReadiness ?? null),
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
    checkpoint: buildMissionRunCheckpoint(task),
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
    executionGraph: projectRuntimeExecutionGraphSummary(task.executionGraph),
  };

  return {
    ...run,
    workspaceEvidence: buildRunWorkspaceEvidence({ run }),
  };
}
