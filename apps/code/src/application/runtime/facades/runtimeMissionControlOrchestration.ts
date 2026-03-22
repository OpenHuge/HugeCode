import type { HugeCodeRunSummary } from "@ku0/code-runtime-host-contract";
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
import {
  projectAgentTaskSummaryToRunSummary,
  type RunProjectionRoutingContext,
} from "./runtimeMissionControlFacade";

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
  const resolveRunSummary = (task: RuntimeAgentTaskSummary): HugeCodeRunSummary =>
    task.runSummary ??
    projectAgentTaskSummaryToRunSummary(normalizeRuntimeTaskForProjection(task), {
      routingContext,
    });
  const projectedRunsByTaskId = new Map(
    runtimeTasks.map((task) => [task.taskId, resolveRunSummary(task)])
  );

  const continuityReadiness = buildRuntimeContinuityReadiness({
    candidates: runtimeTasks.map((task) => ({
      task: normalizeRuntimeTaskForProjection(task),
      run: projectedRunsByTaskId.get(task.taskId)!,
    })),
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

  const launchReadiness = buildRuntimeLaunchReadiness({
    capabilities,
    health,
    healthError,
    selectedRoute,
    executionReliability,
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
