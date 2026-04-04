import type {
  AgentTaskSummary,
  HugeCodeReviewDecisionSummary,
  HugeCodeRunApprovalSummary,
  HugeCodeRunInterventionSummary,
  HugeCodeRunNextAction,
  HugeCodeRunRoutingSummary,
  HugeCodeRunSummary,
  HugeCodeSubAgentSummary,
} from "@ku0/code-runtime-host-contract";
import {
  projectAgentTaskSummaryToRunSummary as projectAgentTaskSummaryToRunSummaryWithHelpers,
  type RuntimeMissionControlRunProjectionOptions,
} from "@ku0/code-application/runtimeMissionControlRunProjection";
import { buildRunPublishHandoff } from "@ku0/code-application/runtimeMissionControlReviewPackProjection";
import { resolveExecutionProfile } from "./runtimeMissionControlExecutionProfiles";
import {
  buildProfileReadiness,
  buildRoutingSummary,
  type RunProjectionRoutingContext,
} from "./runtimeMissionControlRouting";
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
import {
  buildMissionLineage,
  buildRunLedger,
  deriveTaskMode,
  isTerminalRunState,
  normalizeSubAgentSessions,
  projectAgentTaskStatusToRunState,
  resolveMissionTaskId,
} from "./runtimeMissionControlProjectionHelpers";

function buildFallbackApprovalSummary(): HugeCodeRunApprovalSummary {
  return {
    status: "not_required",
    approvalId: null,
    label: "No pending approval",
    summary: "This run does not currently require an approval decision.",
  };
}

function buildFallbackInterventionSummary(): HugeCodeRunInterventionSummary {
  return {
    actions: [],
    primaryAction: null,
  };
}

function buildFallbackNextAction(detail: string | null = null): HugeCodeRunNextAction {
  return {
    label: "Inspect run state",
    action: "review",
    detail,
  };
}

function buildFallbackRoutingSummary(): HugeCodeRunRoutingSummary {
  return {
    backendId: null,
    provider: null,
    providerLabel: null,
    pool: null,
    routeLabel: "Runtime route unavailable",
    routeHint: "Runtime routing details are unavailable.",
    health: "attention",
    enabledAccountCount: 0,
    readyAccountCount: 0,
    enabledPoolCount: 0,
  };
}

export function projectAgentTaskSummaryToRunSummary(
  task: AgentTaskSummary,
  options?: {
    taskId?: string | null;
    routingContext?: RunProjectionRoutingContext;
    subAgents?: HugeCodeSubAgentSummary[] | null;
    workspaceRoot?: string | null;
  }
): HugeCodeRunSummary {
  const sharedOptions: RuntimeMissionControlRunProjectionOptions<RunProjectionRoutingContext> = {
    taskId: options?.taskId ?? null,
    preferredExecutionProfileId: options?.routingContext?.preferredExecutionProfileId ?? null,
    routingContext: options?.routingContext,
    subAgents: options?.subAgents,
    workspaceRoot: options?.workspaceRoot ?? null,
  };

  return projectAgentTaskSummaryToRunSummaryWithHelpers(
    task,
    {
      resolveExecutionProfile,
      deriveTaskMode,
      buildRoutingSummary,
      buildProfileReadiness: (routing, readiness) =>
        buildProfileReadiness(routing ?? buildFallbackRoutingSummary(), readiness),
      buildApprovalSummary,
      buildReviewDecisionSummary,
      buildInterventionSummary,
      buildOperatorState: (runTask, approval, routing, reviewDecision) =>
        buildOperatorState(
          runTask,
          approval ?? buildFallbackApprovalSummary(),
          routing ?? buildFallbackRoutingSummary(),
          (reviewDecision ?? null) as HugeCodeReviewDecisionSummary | null
        ),
      buildNextAction: (runTask, approval, intervention, reviewDecision) =>
        buildNextAction(
          runTask,
          approval ?? buildFallbackApprovalSummary(),
          intervention ?? buildFallbackInterventionSummary(),
          (reviewDecision ?? null) as HugeCodeReviewDecisionSummary | null
        ),
      deriveRunValidations,
      deriveRunArtifacts,
      deriveRunChangedPaths,
      deriveRunWarnings,
      deriveRunCompletionReason,
      deriveRuntimeTaskSource,
      normalizeSubAgentSessions,
      buildGovernanceSummary: (input) =>
        buildGovernanceSummary({
          ...input,
          approval: input.approval ?? buildFallbackApprovalSummary(),
          reviewDecision: input.reviewDecision ?? null,
          intervention: input.intervention ?? buildFallbackInterventionSummary(),
          nextAction: input.nextAction ?? buildFallbackNextAction(input.completionReason),
          subAgents: input.subAgents ?? [],
        }),
      buildMissionLineage,
      buildRunLedger,
      buildPlacementEvidence,
      buildRunOperatorSnapshot,
      buildRunWorkspaceEvidence,
      projectRuntimeExecutionGraphSummary,
      projectAgentTaskStatusToRunState,
      isTerminalRunState,
      resolveMissionTaskId,
      buildRunPublishHandoff,
      buildMissionRunCheckpoint,
    },
    sharedOptions
  );
}
