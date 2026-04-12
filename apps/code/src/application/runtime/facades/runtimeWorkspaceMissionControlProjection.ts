import type {
  HugeCodeRunSummary,
  OAuthAccountSummary,
  OAuthPoolSummary,
  RuntimeCompositionProfile,
  RuntimeCompositionResolution,
  RuntimeInvocationHostRegistry,
  RuntimePolicySnapshot,
  RuntimeRegistryPackageDescriptor,
  RuntimeProviderCatalogEntry,
} from "@ku0/code-runtime-host-contract";
import {
  readRuntimeCompositionPreferredBackendIds,
  readRuntimeCompositionResolvedBackendId,
} from "@ku0/code-application/runtimeBackendPreferences";
import type {
  RuntimeMissionControlCompositionSummary,
  RuntimeMissionControlPolicyCapability,
  RuntimeMissionControlPolicyIndicator,
  RuntimeMissionControlSummaryCounts,
} from "@ku0/code-application/runtimeMissionControlProjectionSummaries";
import {
  buildRuntimeMissionControlCompositionSummary as buildCompositionSummary,
  buildRuntimeMissionControlPolicyIndicator as buildRuntimePolicyIndicator,
  buildRuntimeMissionControlSummaryCounts as buildRuntimeSummary,
} from "@ku0/code-application/runtimeMissionControlProjectionSummaries";
import {
  buildRuntimeMissionControlPluginCatalogSummary,
  type RuntimeMissionControlPluginCatalogSummary,
} from "@ku0/code-application/runtimeMissionControlPluginCatalog";
import {
  buildMissionControlLoopItems,
  buildMissionRunSummary,
  type MissionControlLoopItem,
  type MissionRunSummary,
} from "@ku0/code-application/runtimeMissionControlLoop";
import {
  resolveRuntimeControlPlaneRouteSelection,
  type RuntimeControlPlaneRouteOption,
} from "./runtimeControlPlaneRouting";
import type { RuntimeKernelPluginDescriptor } from "../kernel/runtimeKernelPluginTypes";
import type { RuntimeExecutionReliabilitySummary } from "./runtimeExecutionReliability";
import type { RuntimeLaunchReadinessSummary } from "./runtimeLaunchReadiness";
import {
  buildRuntimeMissionControlOrchestrationState,
  type RuntimeMissionControlOrchestrationState,
} from "./runtimeMissionControlOrchestration";
import type { RuntimeBrowserReadinessSummary } from "./runtimeBrowserReadiness";
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
  | "preferredBackendIds"
  | "provenance"
  | "resolvedBackendId"
  | "healthEntry"
>;

export type WorkspaceRuntimeTaskRun = {
  task: RuntimeAgentTaskSummary;
  run: HugeCodeRunSummary | undefined;
};

export type WorkspaceRuntimePolicyCapability = RuntimeMissionControlPolicyCapability;

export type WorkspaceRuntimePolicyIndicator = RuntimeMissionControlPolicyIndicator;

export type WorkspaceRuntimeMissionControlProjection = {
  runtimeSummary: RuntimeMissionControlSummaryCounts;
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
  policy: WorkspaceRuntimePolicyIndicator;
  browserReadiness: RuntimeBrowserReadinessSummary;
  pluginCatalog: RuntimeMissionControlPluginCatalogSummary;
  composition: RuntimeMissionControlCompositionSummary;
  executionReliability: RuntimeExecutionReliabilitySummary;
  launchReadiness: RuntimeLaunchReadinessSummary;
  launchInvocationTruth: RuntimeMissionControlOrchestrationState["launchInvocationTruth"];
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
  runtimePolicy: RuntimePolicySnapshot | null;
  runtimePolicyError: string | null;
  browserReadiness: RuntimeBrowserReadinessSummary;
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
  runtimeInvocationHostRegistry?: RuntimeInvocationHostRegistry | null;
  selectedProviderRoute: string;
  runtimeStatusFilter: RuntimeAgentTaskSummary["status"] | "all";
  runtimeDurabilityWarning: {
    degraded: boolean | null;
  } | null;
  now?: () => number;
};

export function buildWorkspaceRuntimeMissionControlProjection(
  input: BuildWorkspaceRuntimeMissionControlProjectionInput
): WorkspaceRuntimeMissionControlProjection {
  const runtimeSummary = buildRuntimeSummary(input.runtimeTasks);
  const missionRunSummary = buildMissionRunSummary(input.runtimeTasks);
  const missionControlLoopItems = buildMissionControlLoopItems(input.runtimeTasks);
  const pluginCatalog = buildRuntimeMissionControlPluginCatalogSummary({
    plugins: input.runtimePlugins,
    error: input.runtimePluginsError,
    projectionBacked: input.runtimePluginsProjectionBacked,
    registryPackages: input.runtimePluginRegistryPackages,
  });
  const composition = buildCompositionSummary({
    profiles: input.runtimeCompositionProfiles,
    activeProfile: input.runtimeCompositionActiveProfile,
    activeProfileId: input.runtimeCompositionActiveProfileId,
    resolution: input.runtimeCompositionResolution,
    error: input.runtimeCompositionError ?? input.runtimePluginRegistryError,
  });
  const policy = buildRuntimePolicyIndicator({
    runtimePolicy: input.runtimePolicy,
    runtimePolicyError: input.runtimePolicyError,
  });
  const preferredBackendIds = readRuntimeCompositionPreferredBackendIds(
    input.runtimeCompositionResolution
  );
  const resolvedBackendId = readRuntimeCompositionResolvedBackendId({
    selectedRoute: input.selectedProviderRoute,
    activeProfile: input.runtimeCompositionActiveProfile,
    resolution: input.runtimeCompositionResolution,
  });
  const routeSelection = resolveRuntimeControlPlaneRouteSelection({
    selectedRoute: input.selectedProviderRoute,
    plugins: input.runtimePlugins,
    preferredBackendIds,
    resolvedBackendId,
    provenance: preferredBackendIds || resolvedBackendId ? "backend_preference" : undefined,
  });

  const orchestration = buildRuntimeMissionControlOrchestrationState({
    workspaceId: input.workspaceId,
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
    runtimeInvocationHostRegistry: input.runtimeInvocationHostRegistry ?? null,
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
    policy,
    browserReadiness: input.browserReadiness,
    pluginCatalog,
    composition,
    executionReliability: orchestration.executionReliability,
    launchReadiness: orchestration.launchReadiness,
    launchInvocationTruth: orchestration.launchInvocationTruth,
  };
}
