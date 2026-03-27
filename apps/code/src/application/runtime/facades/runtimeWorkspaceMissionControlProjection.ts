import type {
  HugeCodeRunSummary,
  OAuthAccountSummary,
  OAuthPoolSummary,
  RuntimeProviderCatalogEntry,
} from "@ku0/code-runtime-host-contract";
import type { RuntimeExecutionReliabilitySummary } from "./runtimeExecutionReliability";
import type { RuntimeLaunchReadinessSummary } from "./runtimeLaunchReadiness";
import {
  buildMissionControlLoopItems,
  buildMissionRunSummary,
  type MissionControlLoopItem,
  type MissionRunSummary,
} from "./runtimeMissionControlLoop";
import {
  buildRuntimeMissionControlOrchestrationState,
  type RuntimeMissionControlOrchestrationState,
} from "./runtimeMissionControlOrchestration";
import { type RuntimeProviderRoutingHealth } from "./runtimeRoutingHealth";
import type { RuntimeAgentTaskSummary } from "../types/webMcpBridge";
import { resolveRuntimeProviderRouteSelection } from "./runtimeProviderRouting";

export type WorkspaceMissionControlRouteOption = {
  value: string;
  label: string;
  ready: boolean;
  launchAllowed: boolean;
  readiness: "ready" | "attention" | "blocked";
  detail: string;
  blockingReason: string | null;
  recommendedAction: string;
  fallbackDetail: string | null;
  healthEntry: RuntimeProviderRoutingHealth | null;
};

export type WorkspaceRuntimeTaskRun = {
  task: RuntimeAgentTaskSummary;
  run: HugeCodeRunSummary | undefined;
};

export type WorkspaceRuntimeMissionControlProjection = {
  runtimeSummary: {
    total: number;
    running: number;
    queued: number;
    awaitingApproval: number;
    finished: number;
  };
  missionRunSummary: MissionRunSummary;
  missionControlLoopItems: MissionControlLoopItem[];
  routeSelection: {
    routingHealth: RuntimeProviderRoutingHealth[];
    options: WorkspaceMissionControlRouteOption[];
    selected: WorkspaceMissionControlRouteOption;
    normalizedValue: string;
  };
  runList: {
    projectedRunsByTaskId: Map<string, HugeCodeRunSummary>;
    visibleRuntimeRuns: WorkspaceRuntimeTaskRun[];
    activeRuntimeCount: number;
  };
  continuity: {
    summary: RuntimeMissionControlOrchestrationState["continuityReadiness"];
    itemsByTaskId: RuntimeMissionControlOrchestrationState["continuityItemsByTaskId"];
    resumeReadyTasks: RuntimeAgentTaskSummary[];
  };
  approvalPressure: {
    pendingTasks: RuntimeAgentTaskSummary[];
    staleTasks: RuntimeAgentTaskSummary[];
    oldestPendingTask: RuntimeAgentTaskSummary | null;
  };
  executionReliability: RuntimeExecutionReliabilitySummary;
  launchReadiness: RuntimeLaunchReadinessSummary;
};

type BuildWorkspaceRuntimeMissionControlProjectionInput = {
  workspaceId: string;
  runtimeTasks: RuntimeAgentTaskSummary[];
  runtimeProviders: RuntimeProviderCatalogEntry[];
  runtimeAccounts: OAuthAccountSummary[];
  runtimePools: OAuthPoolSummary[];
  runtimeCapabilities: unknown;
  runtimeHealth: unknown;
  runtimeHealthError: string | null;
  runtimeToolMetrics: unknown;
  runtimeToolGuardrails: unknown;
  selectedProviderRoute: string;
  runtimeStatusFilter: RuntimeAgentTaskSummary["status"] | "all";
  runtimeDurabilityWarning: {
    degraded: boolean | null;
  } | null;
  now?: () => number;
};

function buildRuntimeSummary(runtimeTasks: RuntimeAgentTaskSummary[]) {
  const counts = {
    total: runtimeTasks.length,
    running: 0,
    queued: 0,
    awaitingApproval: 0,
    finished: 0,
  };
  runtimeTasks.forEach((task) => {
    if (task.status === "running") {
      counts.running += 1;
    } else if (task.status === "queued") {
      counts.queued += 1;
    } else if (task.status === "awaiting_approval") {
      counts.awaitingApproval += 1;
    } else {
      counts.finished += 1;
    }
  });
  return counts;
}

export function buildWorkspaceRuntimeMissionControlProjection(
  input: BuildWorkspaceRuntimeMissionControlProjectionInput
): WorkspaceRuntimeMissionControlProjection {
  const runtimeSummary = buildRuntimeSummary(input.runtimeTasks);
  const missionRunSummary = buildMissionRunSummary(input.runtimeTasks);
  const missionControlLoopItems = buildMissionControlLoopItems(input.runtimeTasks);
  const routeSelection = resolveRuntimeProviderRouteSelection({
    selectedRoute: input.selectedProviderRoute,
    providers: input.runtimeProviders,
    accounts: input.runtimeAccounts,
    pools: input.runtimePools,
  });

  const orchestration = buildRuntimeMissionControlOrchestrationState({
    runtimeTasks: input.runtimeTasks,
    statusFilter: input.runtimeStatusFilter,
    routingContext: {
      providers: input.runtimeProviders,
      accounts: input.runtimeAccounts,
      pools: input.runtimePools,
    },
    durabilityWarning:
      input.runtimeDurabilityWarning === null
        ? null
        : {
            degraded: input.runtimeDurabilityWarning.degraded,
          },
    capabilities: input.runtimeCapabilities,
    health: input.runtimeHealth,
    healthError: input.runtimeHealthError,
    selectedRoute: {
      value: routeSelection.selected.value,
      label: routeSelection.selected.label,
      state: routeSelection.selected.readiness,
      ready: routeSelection.selected.ready,
      launchAllowed: routeSelection.selected.launchAllowed,
      detail: routeSelection.selected.detail,
      blockingReason: routeSelection.selected.blockingReason,
      recommendedAction: routeSelection.selected.recommendedAction,
      fallbackDetail: routeSelection.selected.fallbackDetail,
      provenanceLabel:
        routeSelection.selected.source === "auto"
          ? "Workspace auto route"
          : routeSelection.selected.source === "explicit_route"
            ? "Explicit provider route"
            : "Model-derived route",
    },
    runtimeToolMetrics: input.runtimeToolMetrics,
    runtimeToolGuardrails: input.runtimeToolGuardrails,
    stalePendingApprovalMs: 10 * 60_000,
    now: input.now,
  });

  return {
    runtimeSummary,
    missionRunSummary,
    missionControlLoopItems,
    routeSelection: {
      routingHealth: routeSelection.routingHealth,
      options: routeSelection.options,
      selected: routeSelection.selected,
      normalizedValue: routeSelection.normalizedValue,
    },
    runList: {
      projectedRunsByTaskId: orchestration.projectedRunsByTaskId,
      visibleRuntimeRuns: orchestration.visibleRuntimeRuns.map((entry) => ({
        task: entry.task,
        run: entry.run ?? undefined,
      })),
      activeRuntimeCount:
        runtimeSummary.running + runtimeSummary.queued + runtimeSummary.awaitingApproval,
    },
    continuity: {
      summary: orchestration.continuityReadiness,
      itemsByTaskId: orchestration.continuityItemsByTaskId,
      resumeReadyTasks: orchestration.resumeReadyRuntimeTasks,
    },
    approvalPressure: {
      pendingTasks: orchestration.pendingApprovalTasks,
      staleTasks: orchestration.stalePendingApprovalTasks,
      oldestPendingTask: orchestration.oldestPendingApprovalTask,
    },
    executionReliability: orchestration.executionReliability,
    launchReadiness: orchestration.launchReadiness,
  };
}
