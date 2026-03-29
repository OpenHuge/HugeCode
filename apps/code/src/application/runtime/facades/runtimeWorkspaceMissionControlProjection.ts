import type {
  HugeCodeRunSummary,
  OAuthAccountSummary,
  OAuthPoolSummary,
  RuntimeCompositionProfile,
  RuntimeCompositionResolution,
  RuntimeRegistryPackageDescriptor,
  RuntimeProviderCatalogEntry,
} from "@ku0/code-runtime-host-contract";
import {
  resolveRuntimeControlPlaneRouteSelection,
  type RuntimeControlPlaneRouteOption,
} from "./runtimeControlPlaneRouting";
import {
  readRuntimeKernelRoutingPluginMetadata,
  type RuntimeKernelPluginDescriptor,
} from "../kernel/runtimeKernelPlugins";
import { readRuntimeKernelPluginCompositionMetadata } from "../kernel/runtimeKernelComposition";
import { readRuntimeKernelPluginRegistryMetadata } from "../kernel/runtimeKernelPluginRegistry";
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

export type WorkspaceMissionControlRouteOption = Pick<
  RuntimeControlPlaneRouteOption,
  | "value"
  | "label"
  | "ready"
  | "launchAllowed"
  | "readiness"
  | "detail"
  | "blockingReason"
  | "recommendedAction"
  | "fallbackDetail"
  | "healthEntry"
>;

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
  pluginCatalog: {
    plugins: RuntimeKernelPluginDescriptor[];
    total: number;
    enabled: number;
    runtimeBacked: number;
    executableCount: number;
    nonExecutableCount: number;
    readableResourceCount: number;
    permissionEvaluableCount: number;
    contractSurfaceCount: number;
    contractImportSurfaceCount: number;
    contractExportSurfaceCount: number;
    boundCount: number;
    declarationOnlyCount: number;
    unboundCount: number;
    runtimeExtensionCount: number;
    liveSkillCount: number;
    repoManifestCount: number;
    routingCount: number;
    providerRouteCount: number;
    backendRouteCount: number;
    executionRouteCount: number;
    externalPackageCount: number;
    verifiedPackageCount: number;
    blockedPackageCount: number;
    selectedInActiveProfileCount: number;
    readyRouteCount: number;
    attentionRouteCount: number;
    blockedRouteCount: number;
    unsupportedHostCount: number;
    healthyCount: number;
    degradedCount: number;
    unsupportedCount: number;
    projectionBacked: boolean;
    error: string | null;
  };
  composition: {
    profileCount: number;
    activeProfileId: string | null;
    activeProfileName: string | null;
    verifiedPluginCount: number;
    blockedPluginCount: number;
    selectedRouteCount: number;
    selectedBackendCount: number;
    error: string | null;
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
  runtimePlugins: RuntimeKernelPluginDescriptor[];
  runtimePluginsError: string | null;
  runtimePluginsProjectionBacked: boolean;
  runtimePluginRegistryPackages: RuntimeRegistryPackageDescriptor[];
  runtimePluginRegistryError: string | null;
  runtimeCompositionProfiles: RuntimeCompositionProfile[];
  runtimeCompositionActiveProfileId: string | null;
  runtimeCompositionActiveProfile: RuntimeCompositionProfile | null;
  runtimeCompositionResolution: RuntimeCompositionResolution | null;
  runtimeCompositionError: string | null;
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

function buildPluginCatalogSummary(input: {
  plugins: RuntimeKernelPluginDescriptor[];
  error: string | null;
  projectionBacked: boolean;
}): WorkspaceRuntimeMissionControlProjection["pluginCatalog"] {
  const summary: WorkspaceRuntimeMissionControlProjection["pluginCatalog"] = {
    plugins: input.plugins,
    total: input.plugins.length,
    enabled: 0,
    runtimeBacked: 0,
    executableCount: 0,
    nonExecutableCount: 0,
    readableResourceCount: 0,
    permissionEvaluableCount: 0,
    contractSurfaceCount: 0,
    contractImportSurfaceCount: 0,
    contractExportSurfaceCount: 0,
    boundCount: 0,
    declarationOnlyCount: 0,
    unboundCount: 0,
    runtimeExtensionCount: 0,
    liveSkillCount: 0,
    repoManifestCount: 0,
    routingCount: 0,
    providerRouteCount: 0,
    backendRouteCount: 0,
    executionRouteCount: 0,
    externalPackageCount: 0,
    verifiedPackageCount: 0,
    blockedPackageCount: 0,
    selectedInActiveProfileCount: 0,
    readyRouteCount: 0,
    attentionRouteCount: 0,
    blockedRouteCount: 0,
    unsupportedHostCount: 0,
    healthyCount: 0,
    degradedCount: 0,
    unsupportedCount: 0,
    projectionBacked: input.projectionBacked,
    error: input.error,
  };

  for (const plugin of input.plugins) {
    if (plugin.enabled) {
      summary.enabled += 1;
    }
    if (plugin.runtimeBacked) {
      summary.runtimeBacked += 1;
    }
    if (plugin.operations.execution.executable) {
      summary.executableCount += 1;
    } else {
      summary.nonExecutableCount += 1;
    }
    if (plugin.operations.resources.readable) {
      summary.readableResourceCount += 1;
    }
    if (plugin.operations.permissions.evaluable) {
      summary.permissionEvaluableCount += 1;
    }
    summary.contractSurfaceCount += plugin.binding.surfaces.length;
    for (const surface of plugin.binding.surfaces) {
      if (surface.direction === "import") {
        summary.contractImportSurfaceCount += 1;
      } else {
        summary.contractExportSurfaceCount += 1;
      }
    }
    if (plugin.binding.state === "bound") {
      summary.boundCount += 1;
    } else if (plugin.binding.state === "declaration_only") {
      summary.declarationOnlyCount += 1;
    } else if (plugin.binding.state === "unbound") {
      summary.unboundCount += 1;
    }
    if (plugin.source === "runtime_extension") {
      summary.runtimeExtensionCount += 1;
    } else if (plugin.source === "live_skill") {
      summary.liveSkillCount += 1;
    } else if (plugin.source === "repo_manifest") {
      summary.repoManifestCount += 1;
    } else if (
      plugin.source === "mcp_remote" ||
      plugin.source === "wasi_component" ||
      plugin.source === "a2a_remote" ||
      plugin.source === "host_bridge"
    ) {
      summary.externalPackageCount += 1;
    } else if (
      plugin.source === "provider_route" ||
      plugin.source === "backend_route" ||
      plugin.source === "execution_route"
    ) {
      summary.routingCount += 1;
      if (plugin.source === "provider_route") {
        summary.providerRouteCount += 1;
      } else if (plugin.source === "backend_route") {
        summary.backendRouteCount += 1;
      } else {
        summary.executionRouteCount += 1;
      }
      const routingMetadata = readRuntimeKernelRoutingPluginMetadata(plugin.metadata);
      if (routingMetadata?.readiness === "ready") {
        summary.readyRouteCount += 1;
      } else if (routingMetadata?.readiness === "attention") {
        summary.attentionRouteCount += 1;
      } else if (routingMetadata?.readiness === "blocked") {
        summary.blockedRouteCount += 1;
      }
    } else {
      summary.unsupportedHostCount += 1;
    }

    const registryMetadata = readRuntimeKernelPluginRegistryMetadata(plugin.metadata);
    if (
      registryMetadata?.trust.status === "verified" ||
      registryMetadata?.trust.status === "runtime_managed"
    ) {
      summary.verifiedPackageCount += 1;
    } else if (registryMetadata?.trust.status === "blocked") {
      summary.blockedPackageCount += 1;
    }
    const compositionMetadata = readRuntimeKernelPluginCompositionMetadata(plugin.metadata);
    if (compositionMetadata?.selectedInActiveProfile) {
      summary.selectedInActiveProfileCount += 1;
    }

    if (plugin.health?.state === "healthy") {
      summary.healthyCount += 1;
    } else if (plugin.health?.state === "degraded") {
      summary.degradedCount += 1;
    } else if (plugin.health?.state === "unsupported") {
      summary.unsupportedCount += 1;
    }
  }

  return summary;
}

function buildCompositionSummary(input: {
  profiles: RuntimeCompositionProfile[];
  activeProfile: RuntimeCompositionProfile | null;
  activeProfileId: string | null;
  resolution: RuntimeCompositionResolution | null;
  error: string | null;
}): WorkspaceRuntimeMissionControlProjection["composition"] {
  return {
    profileCount: input.profiles.length,
    activeProfileId: input.activeProfileId,
    activeProfileName: input.activeProfile?.name ?? null,
    verifiedPluginCount:
      input.resolution?.trustDecisions.filter(
        (decision) => decision.status === "verified" || decision.status === "runtime_managed"
      ).length ?? 0,
    blockedPluginCount: input.resolution?.blockedPlugins.length ?? 0,
    selectedRouteCount: input.resolution?.selectedRouteCandidates.length ?? 0,
    selectedBackendCount: input.resolution?.selectedBackendCandidates.length ?? 0,
    error: input.error,
  };
}

export function buildWorkspaceRuntimeMissionControlProjection(
  input: BuildWorkspaceRuntimeMissionControlProjectionInput
): WorkspaceRuntimeMissionControlProjection {
  const runtimeSummary = buildRuntimeSummary(input.runtimeTasks);
  const missionRunSummary = buildMissionRunSummary(input.runtimeTasks);
  const missionControlLoopItems = buildMissionControlLoopItems(input.runtimeTasks);
  const pluginCatalog = buildPluginCatalogSummary({
    plugins: input.runtimePlugins,
    error: input.runtimePluginsError,
    projectionBacked: input.runtimePluginsProjectionBacked,
  });
  pluginCatalog.externalPackageCount = Math.max(
    pluginCatalog.externalPackageCount,
    input.runtimePluginRegistryPackages.filter((entry) => entry.source !== "runtime_managed").length
  );
  const composition = buildCompositionSummary({
    profiles: input.runtimeCompositionProfiles,
    activeProfile: input.runtimeCompositionActiveProfile,
    activeProfileId: input.runtimeCompositionActiveProfileId,
    resolution: input.runtimeCompositionResolution,
    error: input.runtimeCompositionError ?? input.runtimePluginRegistryError,
  });
  const routeSelection = resolveRuntimeControlPlaneRouteSelection({
    selectedRoute: input.selectedProviderRoute,
    plugins: input.runtimePlugins,
    preferredBackendIds:
      input.runtimeCompositionResolution?.selectedBackendCandidates.map(
        (entry) => entry.backendId
      ) ?? null,
    provenance:
      (input.runtimeCompositionResolution?.selectedBackendCandidates.length ?? 0) > 0
        ? "backend_preference"
        : undefined,
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
            : routeSelection.selected.source === "backend_preference"
              ? "Backend-preferred route"
              : routeSelection.selected.source === "runtime_fallback"
                ? "Runtime fallback route"
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
    pluginCatalog,
    composition,
    executionReliability: orchestration.executionReliability,
    launchReadiness: orchestration.launchReadiness,
  };
}
