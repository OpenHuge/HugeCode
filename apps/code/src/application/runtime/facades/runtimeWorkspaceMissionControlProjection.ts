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
import {
  buildRuntimeProviderRoutingHealth,
  type RuntimeProviderRoutingHealth,
} from "./runtimeRoutingHealth";
import type { RuntimeAgentTaskSummary } from "../types/webMcpBridge";

export type WorkspaceMissionControlRouteOption = {
  value: string;
  label: string;
  ready: boolean;
  detail: string;
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

function buildRouteOptions(input: {
  providers: RuntimeProviderCatalogEntry[];
  routingHealth: RuntimeProviderRoutingHealth[];
}): WorkspaceMissionControlRouteOption[] {
  const hasNonOAuthRoute = input.providers.some(
    (provider) => provider.available && provider.oauthProviderId === null
  );
  const readyOAuthRoutes = input.routingHealth.filter((entry) => entry.poolRoutingReady).length;
  const readyEntries = input.providers
    .filter((provider) => provider.available)
    .map((provider) => {
      const healthEntry =
        input.routingHealth.find((entry) => entry.providerId === provider.oauthProviderId) ??
        input.routingHealth.find((entry) => entry.providerId === provider.providerId);
      return {
        value: provider.providerId,
        label: provider.displayName,
        ready: healthEntry?.poolRoutingReady ?? provider.oauthProviderId === null,
        detail:
          provider.oauthProviderId === null
            ? "No OAuth route required."
            : (healthEntry?.recommendation ??
              `${healthEntry?.enabledPools ?? 0} pool(s), ${healthEntry?.credentialReadyAccounts ?? 0} ready account(s)`),
        healthEntry: healthEntry ?? null,
      };
    });

  return [
    {
      value: "auto",
      label: "Automatic workspace routing",
      ready: readyOAuthRoutes > 0 || hasNonOAuthRoute || input.routingHealth.length === 0,
      detail:
        input.routingHealth.length === 0
          ? "No OAuth-backed providers detected; runtime can still use local routing."
          : readyOAuthRoutes > 0
            ? `${readyOAuthRoutes}/${input.routingHealth.length} provider routes ready.`
            : hasNonOAuthRoute
              ? "No OAuth-backed provider routes are ready, but local/native routing remains available."
              : `0/${input.routingHealth.length} provider routes ready.`,
      healthEntry: null,
    },
    ...readyEntries,
  ];
}

export function buildWorkspaceRuntimeMissionControlProjection(
  input: BuildWorkspaceRuntimeMissionControlProjectionInput
): WorkspaceRuntimeMissionControlProjection {
  const runtimeSummary = buildRuntimeSummary(input.runtimeTasks);
  const missionRunSummary = buildMissionRunSummary(input.runtimeTasks);
  const missionControlLoopItems = buildMissionControlLoopItems(input.runtimeTasks);
  const routingHealth = buildRuntimeProviderRoutingHealth({
    providers: input.runtimeProviders,
    accounts: input.runtimeAccounts,
    pools: input.runtimePools,
  });
  const routeOptions = buildRouteOptions({
    providers: input.runtimeProviders,
    routingHealth,
  });
  const selected = routeOptions.find((option) => option.value === input.selectedProviderRoute) ??
    routeOptions[0] ?? {
      value: "auto",
      label: "Automatic workspace routing",
      ready: true,
      detail: "Routing details unavailable.",
      healthEntry: null,
    };

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
      value: selected.value,
      label: selected.label,
      ready: selected.ready,
      detail: selected.detail,
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
      routingHealth,
      options: routeOptions,
      selected,
      normalizedValue: selected.value,
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
