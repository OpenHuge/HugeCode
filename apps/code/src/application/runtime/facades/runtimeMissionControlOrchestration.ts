import {
  buildRuntimeContextPressureSummary,
  mergeRuntimeContextPressureSummaries,
  type HugeCodeRunSummary,
} from "@ku0/code-runtime-host-contract";
import type { RuntimeAgentTaskSummary } from "../types/webMcpBridge";
import {
  buildRuntimeContinuityReadiness,
  type RuntimeContinuityReadinessSummary,
} from "./runtimeContinuityReadiness";
import {
  buildRuntimeExecutionReliability,
  type RuntimeExecutionReliabilitySummary,
} from "./runtimeExecutionReliability";
import {
  buildRuntimeLaunchReadiness,
  type RuntimeLaunchReadinessRoute,
  type RuntimeLaunchReadinessSummary,
} from "./runtimeLaunchReadiness";
import { normalizeRuntimeTaskForProjection } from "./runtimeMissionControlProjectionNormalization";
import { projectAgentTaskStatusToRunState } from "./runtimeMissionControlProjectionHelpers";
import type { RunProjectionRoutingContext } from "./runtimeMissionControlFacade";

export type RuntimeMissionControlVisibleRun = {
  task: RuntimeAgentTaskSummary;
  run: HugeCodeRunSummary | null;
};

export type RuntimeMissionControlOrchestrationState = {
  projectedRunsByTaskId: Map<string, HugeCodeRunSummary>;
  continuityReadiness: RuntimeContinuityReadinessSummary;
  continuityItemsByTaskId: Map<string, RuntimeContinuityReadinessSummary["items"][number]>;
  resumeReadyRuntimeTasks: RuntimeAgentTaskSummary[];
  visibleRuntimeRuns: RuntimeMissionControlVisibleRun[];
  pendingApprovalTasks: RuntimeAgentTaskSummary[];
  oldestPendingApprovalTask: RuntimeAgentTaskSummary | null;
  oldestPendingApprovalId: string | null;
  stalePendingApprovalTasks: RuntimeAgentTaskSummary[];
  executionReliability: RuntimeExecutionReliabilitySummary;
  launchReadiness: RuntimeLaunchReadinessSummary;
};

type RuntimeDurabilityWarningSummary = {
  degraded: boolean | null;
} | null;

type BuildRuntimeMissionControlOrchestrationStateInput = {
  runtimeTasks: RuntimeAgentTaskSummary[];
  statusFilter: RuntimeAgentTaskSummary["status"] | "all";
  routingContext?: RunProjectionRoutingContext;
  durabilityWarning?: RuntimeDurabilityWarningSummary;
  capabilities: unknown;
  health: unknown;
  healthError: string | null;
  selectedRoute: RuntimeLaunchReadinessRoute;
  runtimeToolMetrics: unknown;
  runtimeToolGuardrails: unknown;
  stalePendingApprovalMs: number;
  now?: () => number;
};

function isPendingApprovalTask(task: RuntimeAgentTaskSummary): boolean {
  return (
    task.status === "awaiting_approval" &&
    typeof task.pendingApprovalId === "string" &&
    task.pendingApprovalId.trim().length > 0
  );
}

function hasTaskLevelContinuityTruth(task: RuntimeAgentTaskSummary): boolean {
  return Boolean(
    task.continuation ||
    task.takeoverBundle ||
    task.publishHandoff ||
    task.missionLinkage ||
    task.reviewActionability ||
    task.nextOperatorAction
  );
}

function resolveContinuityRunSummary(task: RuntimeAgentTaskSummary): HugeCodeRunSummary | null {
  if (task.runSummary) {
    return task.runSummary;
  }
  if (!hasTaskLevelContinuityTruth(task)) {
    return null;
  }
  return {
    id: task.taskId,
    taskId: task.taskId,
    workspaceId: task.workspaceId,
    taskSource: task.taskSource ?? null,
    state: projectAgentTaskStatusToRunState(task.status),
    title: task.title ?? task.taskId,
    summary: null,
    startedAt: task.startedAt,
    finishedAt: task.completedAt,
    updatedAt: task.updatedAt,
    currentStepIndex: task.currentStep,
    profileReadiness: task.profileReadiness ?? null,
    routing: task.routing ?? null,
    reviewDecision: task.reviewDecision ?? null,
    intervention: task.intervention ?? null,
    operatorState: task.operatorState ?? null,
    nextAction: task.nextAction ?? null,
    reviewPackId: task.reviewPackId ?? task.missionLinkage?.reviewPackId ?? null,
    checkpoint: null,
    missionLinkage: task.missionLinkage ?? null,
    actionability: task.reviewActionability ?? null,
    sessionBoundary: task.sessionBoundary ?? null,
    continuation: task.continuation ?? null,
    nextOperatorAction: task.nextOperatorAction ?? null,
    publishHandoff: task.publishHandoff ?? null,
    takeoverBundle: task.takeoverBundle ?? null,
    contextBoundary: task.contextBoundary ?? null,
    contextProjection: task.contextProjection ?? null,
    compactionSummary: task.compactionSummary ?? null,
  } satisfies HugeCodeRunSummary;
}

export function buildRuntimeMissionControlOrchestrationState({
  runtimeTasks,
  statusFilter,
  routingContext,
  durabilityWarning = null,
  capabilities,
  health,
  healthError,
  selectedRoute,
  runtimeToolMetrics,
  runtimeToolGuardrails,
  stalePendingApprovalMs,
  now = Date.now,
}: BuildRuntimeMissionControlOrchestrationStateInput): RuntimeMissionControlOrchestrationState {
  void routingContext;
  const runtimeTasksWithRunSummary = runtimeTasks.filter(
    (task): task is RuntimeAgentTaskSummary & { runSummary: HugeCodeRunSummary } =>
      task.runSummary !== undefined && task.runSummary !== null
  );
  const projectedRunsByTaskId = new Map(
    runtimeTasksWithRunSummary.map((task) => [task.taskId, task.runSummary])
  );
  const continuityCandidates = runtimeTasks.flatMap((task) => {
    const run = resolveContinuityRunSummary(task);
    if (!run) {
      return [];
    }
    return [
      {
        task: normalizeRuntimeTaskForProjection(task),
        run,
      },
    ];
  });

  const continuityReadiness = buildRuntimeContinuityReadiness({
    candidates: continuityCandidates,
    durabilityWarning,
  });

  const continuityItemsByTaskId = new Map(
    continuityReadiness.items.map((item) => [item.taskId, item])
  );

  const resumeReadyRuntimeTasks = runtimeTasks.filter(
    (task) => continuityItemsByTaskId.get(task.taskId)?.pathKind === "resume"
  );

  const visibleRuntimeTasks =
    statusFilter === "all"
      ? runtimeTasks
      : runtimeTasks.filter((task) => task.status === statusFilter);

  const visibleRuntimeRuns = visibleRuntimeTasks.map((task) => ({
    task,
    run: projectedRunsByTaskId.get(task.taskId) ?? null,
  }));

  const pendingApprovalTasks = runtimeTasks
    .filter(isPendingApprovalTask)
    .sort((left, right) => left.updatedAt - right.updatedAt);
  const oldestPendingApprovalTask = pendingApprovalTasks[0] ?? null;
  const oldestPendingApprovalId = oldestPendingApprovalTask?.pendingApprovalId ?? null;
  const currentTime = now();
  const stalePendingApprovalTasks = pendingApprovalTasks.filter(
    (task) => currentTime - task.updatedAt >= stalePendingApprovalMs
  );

  const executionReliability = buildRuntimeExecutionReliability({
    metrics: runtimeToolMetrics,
    guardrails: runtimeToolGuardrails,
  });
  const contextPressure = mergeRuntimeContextPressureSummaries(
    runtimeTasks.map((task) =>
      buildRuntimeContextPressureSummary({
        compactionSummary: task.compactionSummary ?? task.runSummary?.compactionSummary ?? null,
        contextBoundary: task.contextBoundary ?? task.runSummary?.contextBoundary ?? null,
        contextProjection: task.contextProjection ?? task.runSummary?.contextProjection ?? null,
      })
    )
  );

  const launchReadiness = buildRuntimeLaunchReadiness({
    capabilities,
    health,
    healthError,
    selectedRoute,
    executionReliability,
    contextPressure,
    pendingApprovalCount: pendingApprovalTasks.length,
    stalePendingApprovalCount: stalePendingApprovalTasks.length,
  });

  return {
    projectedRunsByTaskId,
    continuityReadiness,
    continuityItemsByTaskId,
    resumeReadyRuntimeTasks,
    visibleRuntimeRuns,
    pendingApprovalTasks,
    oldestPendingApprovalTask,
    oldestPendingApprovalId,
    stalePendingApprovalTasks,
    executionReliability,
    launchReadiness,
  };
}
