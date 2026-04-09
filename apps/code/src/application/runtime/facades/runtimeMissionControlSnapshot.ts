import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type {
  OAuthAccountSummary,
  OAuthPoolSummary,
  RuntimePolicySnapshot,
  RuntimeProviderCatalogEntry,
} from "@ku0/code-runtime-host-contract";
import {
  getKernelProjectionStore,
  readCapabilitiesProjectionSlice,
  readDiagnosticsProjectionSlice,
  readMissionControlProjectionSlice,
} from "@ku0/code-workspace-client";
import type { RuntimeAgentControlFacade } from "./runtimeAgentControlFacade";
import { subscribeScopedRuntimeUpdatedEvents } from "../ports/runtimeUpdatedEvents";
import { useRuntimeKernel } from "../kernel/RuntimeKernelContext";
import type { RuntimeAgentTaskSummary } from "../types/webMcpBridge";
import { formatRuntimeError } from "./runtimeMissionControlErrorPresentation";
import {
  buildRuntimeAdvisorySnapshotState,
  CONTROL_PLANE_KERNEL_PROJECTION_SCOPES,
  projectMissionControlSnapshotToRuntimeTasks,
  readRuntimeDurabilityWorkspaceIds,
  reduceRuntimeDurabilityEventWarning,
  reduceRuntimeDurabilityWarning,
  resolveRuntimeCapabilitiesValue,
  type RuntimeDurabilityWarningState,
} from "./runtimeMissionControlSnapshotModel";
import { useWorkspaceRuntimePluginProjection } from "./runtimeKernelPluginProjectionHooks";
import {
  parseRuntimeDurabilityDiagnostics,
  RUNTIME_DURABILITY_WINDOW_MS,
} from "../../../utils/runtimeUpdatedDurability";
export {
  CONTROL_PLANE_KERNEL_PROJECTION_SCOPES,
  projectMissionControlSnapshotToRuntimeTasks,
  reduceRuntimeDurabilityWarning,
  resolveRuntimeCapabilitiesValue,
};
export type { RuntimeDurabilityWarningState };

export function useRuntimeMissionControlSnapshot(input: {
  workspaceId: string;
  runtimeControl: RuntimeAgentControlFacade;
  pollSeconds: number;
}) {
  const runtimeKernel = useRuntimeKernel();
  const workspaceClientRuntime = runtimeKernel.workspaceClientRuntime;
  const kernelProjectionStore = getKernelProjectionStore(workspaceClientRuntime);
  const kernelProjectionState = useSyncExternalStore(
    kernelProjectionStore.subscribe,
    kernelProjectionStore.getSnapshot,
    kernelProjectionStore.getSnapshot
  );
  const capabilitiesProjectionSlice = readCapabilitiesProjectionSlice(kernelProjectionState);
  const missionControlProjectionSlice = readMissionControlProjectionSlice(kernelProjectionState);
  const diagnosticsProjectionSlice = readDiagnosticsProjectionSlice(kernelProjectionState);
  const runtimePluginsState = useWorkspaceRuntimePluginProjection({
    workspaceId: input.workspaceId,
    enabled: true,
  });
  const refreshRuntimePlugins = runtimePluginsState.refresh;
  const [runtimeTasks, setRuntimeTasks] = useState<RuntimeAgentTaskSummary[]>([]);
  const [runtimeProviders, setRuntimeProviders] = useState<RuntimeProviderCatalogEntry[]>([]);
  const [runtimeAccounts, setRuntimeAccounts] = useState<OAuthAccountSummary[]>([]);
  const [runtimePools, setRuntimePools] = useState<OAuthPoolSummary[]>([]);
  const [runtimeCapabilities, setRuntimeCapabilities] = useState<unknown>(null);
  const [runtimeHealth, setRuntimeHealth] = useState<unknown>(null);
  const [runtimeHealthError, setRuntimeHealthError] = useState<string | null>(null);
  const [runtimeToolMetrics, setRuntimeToolMetrics] = useState<unknown>(null);
  const [runtimeToolGuardrails, setRuntimeToolGuardrails] = useState<unknown>(null);
  const [runtimePolicy, setRuntimePolicy] = useState<RuntimePolicySnapshot | null>(null);
  const [runtimePolicyError, setRuntimePolicyError] = useState<string | null>(null);
  const [runtimeAuxLoading, setRuntimeAuxLoading] = useState(false);
  const [runtimeFallbackLoading, setRuntimeFallbackLoading] = useState(false);
  const [runtimeFallbackError, setRuntimeFallbackError] = useState<string | null>(null);
  const [runtimeDurabilityWarning, setRuntimeDurabilityWarning] =
    useState<RuntimeDurabilityWarningState | null>(null);
  const runtimeDurabilityWarningRef = useRef<RuntimeDurabilityWarningState | null>(null);
  const durabilityHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    runtimeDurabilityWarningRef.current = runtimeDurabilityWarning;
  }, [runtimeDurabilityWarning]);

  useEffect(() => {
    if (!workspaceClientRuntime.kernelProjection || !missionControlProjectionSlice) {
      return;
    }
    setRuntimeTasks(projectMissionControlSnapshotToRuntimeTasks(missionControlProjectionSlice));
    setRuntimeFallbackError(null);
  }, [missionControlProjectionSlice, workspaceClientRuntime.kernelProjection]);

  useEffect(() => {
    if (!workspaceClientRuntime.kernelProjection) {
      return;
    }
    setRuntimeCapabilities((current: unknown) =>
      resolveRuntimeCapabilitiesValue({
        kernelProjectionEnabled: true,
        projectionCapabilities: capabilitiesProjectionSlice,
        fallbackCapabilities: current,
      })
    );
  }, [capabilitiesProjectionSlice, workspaceClientRuntime.kernelProjection]);

  useEffect(() => {
    if (!workspaceClientRuntime.kernelProjection) {
      return;
    }
    setRuntimeToolMetrics(diagnosticsProjectionSlice?.toolMetrics ?? null);
    setRuntimeToolGuardrails(diagnosticsProjectionSlice?.toolGuardrails ?? null);
  }, [diagnosticsProjectionSlice, workspaceClientRuntime.kernelProjection]);

  const refreshRuntimeAdvisoryState = useCallback(async () => {
    setRuntimeAuxLoading(true);
    try {
      const getRuntimePolicy = input.runtimeControl.getRuntimePolicy as
        | (() => Promise<RuntimePolicySnapshot | null>)
        | undefined;
      const runtimePolicyPromise: Promise<RuntimePolicySnapshot | null> = getRuntimePolicy
        ? getRuntimePolicy()
        : Promise.resolve(null);

      const [coreResponse, diagnosticsResponse] = await Promise.all([
        Promise.all([
          input.runtimeControl.listRuntimeProviderCatalog
            ? input.runtimeControl.listRuntimeProviderCatalog()
            : Promise.resolve<RuntimeProviderCatalogEntry[]>([]),
          input.runtimeControl.listRuntimeOAuthAccounts
            ? input.runtimeControl.listRuntimeOAuthAccounts(null)
            : Promise.resolve<OAuthAccountSummary[]>([]),
          input.runtimeControl.listRuntimeOAuthPools
            ? input.runtimeControl.listRuntimeOAuthPools(null)
            : Promise.resolve<OAuthPoolSummary[]>([]),
        ]),
        Promise.allSettled([
          !workspaceClientRuntime.kernelProjection &&
          input.runtimeControl.getRuntimeCapabilitiesSummary
            ? input.runtimeControl.getRuntimeCapabilitiesSummary()
            : Promise.resolve(null),
          input.runtimeControl.getRuntimeHealth
            ? input.runtimeControl.getRuntimeHealth()
            : Promise.resolve(null),
          !workspaceClientRuntime.kernelProjection && input.runtimeControl.runtimeToolMetricsRead
            ? input.runtimeControl.runtimeToolMetricsRead()
            : Promise.resolve(diagnosticsProjectionSlice?.toolMetrics ?? null),
          !workspaceClientRuntime.kernelProjection && input.runtimeControl.runtimeToolGuardrailRead
            ? input.runtimeControl.runtimeToolGuardrailRead()
            : Promise.resolve(diagnosticsProjectionSlice?.toolGuardrails ?? null),
          runtimePolicyPromise,
        ]),
      ]);
      const [nextProviders, nextAccounts, nextPools] = coreResponse as [
        RuntimeProviderCatalogEntry[],
        OAuthAccountSummary[],
        OAuthPoolSummary[],
      ];
      const [capabilitiesResult, healthResult, metricsResult, guardrailsResult, policyResult] =
        diagnosticsResponse;
      const advisoryState = buildRuntimeAdvisorySnapshotState({
        nextProviders,
        nextAccounts,
        nextPools,
        kernelProjectionEnabled: workspaceClientRuntime.kernelProjection !== undefined,
        capabilitiesProjectionSlice,
        capabilitiesResult,
        healthResult,
        metricsResult,
        guardrailsResult,
        policyResult,
        previousToolMetrics: runtimeToolMetrics,
        previousToolGuardrails: runtimeToolGuardrails,
      });
      setRuntimeProviders(advisoryState.providers);
      setRuntimeAccounts(advisoryState.accounts);
      setRuntimePools(advisoryState.pools);
      setRuntimeCapabilities(advisoryState.capabilities);
      setRuntimeHealth(advisoryState.health);
      setRuntimeHealthError(advisoryState.healthError);
      setRuntimeToolMetrics(advisoryState.toolMetrics);
      setRuntimeToolGuardrails(advisoryState.toolGuardrails);
      setRuntimePolicy(advisoryState.policy);
      setRuntimePolicyError(advisoryState.policyError);
    } finally {
      setRuntimeAuxLoading(false);
    }
  }, [
    capabilitiesProjectionSlice,
    diagnosticsProjectionSlice,
    input.runtimeControl,
    runtimeToolGuardrails,
    runtimeToolMetrics,
    workspaceClientRuntime.kernelProjection,
  ]);

  const refreshRuntimeTasks = useCallback(async () => {
    if (workspaceClientRuntime.kernelProjection) {
      kernelProjectionStore.ensureScopes(CONTROL_PLANE_KERNEL_PROJECTION_SCOPES);
      await Promise.all([
        kernelProjectionStore.refresh(CONTROL_PLANE_KERNEL_PROJECTION_SCOPES),
        refreshRuntimePlugins(),
      ]);
      await refreshRuntimeAdvisoryState();
      return;
    }

    setRuntimeFallbackLoading(true);
    try {
      const snapshot = await workspaceClientRuntime.missionControl.readMissionControlSnapshot();
      setRuntimeTasks(projectMissionControlSnapshotToRuntimeTasks(snapshot));
      setRuntimeFallbackError(null);
      await refreshRuntimePlugins();
      await refreshRuntimeAdvisoryState();
    } catch (error) {
      setRuntimeFallbackError(formatRuntimeError(error));
    } finally {
      setRuntimeFallbackLoading(false);
    }
  }, [
    kernelProjectionStore,
    refreshRuntimeAdvisoryState,
    refreshRuntimePlugins,
    workspaceClientRuntime.kernelProjection,
    workspaceClientRuntime.missionControl,
  ]);

  useEffect(() => {
    if (workspaceClientRuntime.kernelProjection) {
      kernelProjectionStore.ensureScopes(CONTROL_PLANE_KERNEL_PROJECTION_SCOPES);
    }
    void refreshRuntimeTasks();
  }, [kernelProjectionStore, refreshRuntimeTasks, workspaceClientRuntime.kernelProjection]);

  useEffect(() => {
    if (workspaceClientRuntime.kernelProjection) {
      const unsubscribe = subscribeScopedRuntimeUpdatedEvents(
        {
          workspaceId: input.workspaceId,
          scopes: ["providers", "oauth", "server", "diagnostics"],
        },
        () => {
          void refreshRuntimeAdvisoryState();
        }
      );
      return () => {
        unsubscribe();
      };
    }

    const diagnosticsTimer = window.setInterval(
      () => {
        void refreshRuntimeTasks();
      },
      Math.max(15, input.pollSeconds) * 1000
    );
    return () => {
      window.clearInterval(diagnosticsTimer);
    };
  }, [
    input.pollSeconds,
    input.workspaceId,
    refreshRuntimeAdvisoryState,
    refreshRuntimeTasks,
    workspaceClientRuntime.kernelProjection,
  ]);

  useEffect(() => {
    const unlisten = subscribeScopedRuntimeUpdatedEvents(
      {
        workspaceId: input.workspaceId,
        scopes: ["agents"],
      },
      (runtimeUpdatedEvent) => {
        const { event, params } = runtimeUpdatedEvent;
        const diagnostics = parseRuntimeDurabilityDiagnostics(params);
        const { eventWorkspaceId, paramsWorkspaceId } = readRuntimeDurabilityWorkspaceIds({
          event,
          params,
        });
        const now = Date.now();
        const nextWarning = reduceRuntimeDurabilityEventWarning({
          previous: runtimeDurabilityWarningRef.current,
          workspaceId: input.workspaceId,
          eventWorkspaceId,
          paramsWorkspaceId,
          now,
          diagnostics,
        });
        if (!nextWarning) {
          return;
        }

        if (durabilityHideTimerRef.current) {
          clearTimeout(durabilityHideTimerRef.current);
        }
        durabilityHideTimerRef.current = setTimeout(() => {
          setRuntimeDurabilityWarning((current) =>
            current && current.revision === nextWarning.revision ? null : current
          );
          durabilityHideTimerRef.current = null;
        }, RUNTIME_DURABILITY_WINDOW_MS);

        runtimeDurabilityWarningRef.current = nextWarning;
        setRuntimeDurabilityWarning(nextWarning);
      }
    );

    return () => {
      unlisten();
      if (durabilityHideTimerRef.current) {
        clearTimeout(durabilityHideTimerRef.current);
        durabilityHideTimerRef.current = null;
      }
    };
  }, [input.workspaceId]);

  return {
    runtimeTasks,
    setRuntimeTasks,
    runtimeProviders,
    runtimeAccounts,
    runtimePools,
    runtimeCapabilities,
    runtimeHealth,
    runtimeHealthError,
    runtimeToolMetrics,
    runtimeToolGuardrails,
    runtimePolicy,
    runtimePolicyError,
    runtimePlugins: runtimePluginsState.plugins,
    runtimePluginsError: runtimePluginsState.error,
    runtimePluginsProjectionBacked: runtimePluginsState.projectionBacked,
    runtimePluginRegistryPackages: runtimePluginsState.registry.packages,
    runtimePluginRegistryError: runtimePluginsState.registry.error,
    runtimeCompositionProfiles: runtimePluginsState.composition.profiles,
    runtimeCompositionActiveProfileId: runtimePluginsState.composition.activeProfileId,
    runtimeCompositionActiveProfile: runtimePluginsState.composition.activeProfile,
    runtimeCompositionResolution: runtimePluginsState.composition.resolution,
    runtimeCompositionSnapshot: runtimePluginsState.composition.snapshot,
    runtimeCompositionError: runtimePluginsState.composition.error,
    runtimeLoading:
      runtimeAuxLoading ||
      runtimeFallbackLoading ||
      runtimePluginsState.loading ||
      (workspaceClientRuntime.kernelProjection
        ? kernelProjectionState.loadState === "loading"
        : false),
    runtimeError:
      runtimeFallbackError ??
      (workspaceClientRuntime.kernelProjection ? kernelProjectionState.error : null),
    runtimeDurabilityWarning,
    refreshRuntimeTasks,
  };
}
