import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type {
  HugeCodeMissionControlSnapshot,
  HugeCodeReviewActionabilitySummary,
  HugeCodeRunSummary,
  KernelCapabilitiesSlice,
  KernelProjectionScope,
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
import { readRuntimeErrorCode, readRuntimeErrorMessage } from "../ports/runtimeErrorClassifier";
import { useRuntimeKernel } from "../kernel/RuntimeKernelContext";
import type { RuntimeAgentTaskSummary, RuntimeMissionRunSummary } from "../types/webMcpBridge";
import { normalizeRuntimeProviderCatalogEntry } from "./runtimeMissionControlProjectionNormalization";
import { useWorkspaceRuntimePluginProjection } from "./runtimeKernelPluginProjectionHooks";
import {
  AGENT_TASK_DURABILITY_DEGRADED_REASON,
  parseRuntimeDurabilityDiagnostics,
  parseRuntimeDurabilityWorkspaceId,
  RUNTIME_DURABILITY_WINDOW_MS,
} from "../../../utils/runtimeUpdatedDurability";
import {
  DEFAULT_RUNTIME_WORKSPACE_ID,
  isRuntimeLocalWorkspaceId,
} from "../../../utils/runtimeWorkspaceIds";

export type RuntimeDurabilityWarningState = {
  reason: string;
  revision: string;
  repeatCount: number;
  mode: string | null;
  degraded: boolean | null;
  checkpointWriteTotal: number | null;
  checkpointWriteFailedTotal: number | null;
  updatedAt: number;
  firstSeenAt: number;
  lastSeenAt: number;
  expiresAt: number;
};

type MissionTaskMetadata = {
  createdAt: number | null;
  title: string | null;
};

export const CONTROL_PLANE_KERNEL_PROJECTION_SCOPES: readonly KernelProjectionScope[] = [
  "mission_control",
  "continuity",
  "diagnostics",
  "capabilities",
  "extensions",
];

function readOptionalText(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function normalizePreferredBackendIds(value: string[] | null | undefined) {
  if (!Array.isArray(value)) {
    return null;
  }
  const normalized = [...new Set(value.map(readOptionalText).filter((entry) => entry !== null))];
  return normalized.length > 0 ? normalized : null;
}

function mapRunStateToRuntimeTaskStatus(
  state: HugeCodeRunSummary["state"]
): RuntimeAgentTaskSummary["status"] {
  switch (state) {
    case "draft":
    case "queued":
    case "preparing":
      return "queued";
    case "running":
    case "validating":
      return "running";
    case "paused":
      return "paused";
    case "needs_input":
      return "awaiting_approval";
    case "review_ready":
      return "completed";
    case "failed":
      return "failed";
    case "cancelled":
      return "cancelled";
    default: {
      const exhaustiveCheck: never = state;
      return exhaustiveCheck;
    }
  }
}

function resolveRunReviewActionability(
  run: HugeCodeRunSummary
): HugeCodeReviewActionabilitySummary | null {
  const reviewActionability = (
    run as HugeCodeRunSummary & {
      reviewActionability?: HugeCodeReviewActionabilitySummary | null;
    }
  ).reviewActionability;
  return reviewActionability ?? run.actionability ?? null;
}

function projectMissionControlRunToRuntimeTaskSummary(input: {
  run: HugeCodeRunSummary;
  taskMetadata: MissionTaskMetadata | null;
}): RuntimeAgentTaskSummary {
  const { run, taskMetadata } = input;
  const runtimeRun = run as RuntimeMissionRunSummary;
  return {
    taskId: run.id,
    workspaceId: run.workspaceId,
    threadId: run.lineage?.threadId ?? null,
    requestId: run.lineage?.requestId ?? null,
    title: run.title ?? taskMetadata?.title ?? null,
    status: mapRunStateToRuntimeTaskStatus(run.state),
    accessMode: run.executionProfile?.accessMode ?? "on-request",
    executionMode:
      run.executionProfile?.executionMode === "remote_sandbox" ? "distributed" : "single",
    provider: run.routing?.provider ?? null,
    modelId: null,
    routedProvider: run.routing?.provider ?? null,
    routedModelId: null,
    routedPool: run.routing?.pool ?? null,
    routedSource: null,
    currentStep: run.currentStepIndex ?? null,
    createdAt: taskMetadata?.createdAt ?? run.startedAt ?? run.updatedAt,
    updatedAt: run.updatedAt,
    startedAt: run.startedAt,
    completedAt: run.finishedAt,
    errorCode: null,
    errorMessage: null,
    pendingApprovalId: run.approval?.approvalId ?? null,
    executionProfileId: run.executionProfile?.id ?? null,
    executionProfile: null,
    profileReadiness: run.profileReadiness ?? null,
    routing: run.routing ?? null,
    approvalState: run.approval
      ? ({
          status: run.approval.status,
          approvalId: run.approval.approvalId,
          summary: run.approval.summary,
        } as RuntimeAgentTaskSummary["approvalState"])
      : null,
    reviewDecision: run.reviewDecision ?? null,
    reviewPackId: run.reviewPackId ?? null,
    intervention: run.intervention ?? null,
    operatorState: run.operatorState ?? null,
    nextAction: run.nextAction ?? null,
    missionBrief: run.missionBrief ?? null,
    relaunchContext: run.relaunchContext ?? null,
    publishHandoff: run.publishHandoff ?? null,
    autoDrive: run.autoDrive ?? null,
    checkpointId: run.checkpoint?.checkpointId ?? null,
    traceId: run.checkpoint?.traceId ?? null,
    recovered: run.checkpoint?.recovered ?? null,
    checkpointState: (run.checkpoint ?? null) as RuntimeAgentTaskSummary["checkpointState"],
    missionLinkage: run.missionLinkage ?? null,
    reviewActionability: resolveRunReviewActionability(run),
    takeoverBundle: run.takeoverBundle ?? null,
    contextBoundary: runtimeRun.contextBoundary ?? null,
    contextProjection: runtimeRun.contextProjection ?? null,
    compactionSummary: runtimeRun.compactionSummary ?? null,
    executionGraph: (run.executionGraph ?? null) as RuntimeAgentTaskSummary["executionGraph"],
    runSummary: runtimeRun,
    reviewPackSummary: null,
    backendId: run.routing?.backendId ?? run.placement?.resolvedBackendId ?? null,
    preferredBackendIds: normalizePreferredBackendIds(run.placement?.requestedBackendIds) ?? null,
    taskSource: run.taskSource ?? null,
    rootTaskId: run.lineage?.rootTaskId ?? null,
    parentTaskId: run.lineage?.parentTaskId ?? null,
    childTaskIds: run.lineage?.childTaskIds ?? [],
    steps: [],
  };
}

export function projectMissionControlSnapshotToRuntimeTasks(
  snapshot: HugeCodeMissionControlSnapshot
): RuntimeAgentTaskSummary[] {
  const taskMetadataById = new Map<string, MissionTaskMetadata>();
  for (const task of snapshot.tasks) {
    taskMetadataById.set(task.id, {
      createdAt: task.createdAt ?? null,
      title: task.title ?? null,
    });
    if (task.currentRunId) {
      taskMetadataById.set(task.currentRunId, {
        createdAt: task.createdAt ?? null,
        title: task.title ?? null,
      });
    }
    if (task.latestRunId) {
      taskMetadataById.set(task.latestRunId, {
        createdAt: task.createdAt ?? null,
        title: task.title ?? null,
      });
    }
  }

  return snapshot.runs
    .map((run) =>
      projectMissionControlRunToRuntimeTaskSummary({
        run,
        taskMetadata: taskMetadataById.get(run.taskId) ?? taskMetadataById.get(run.id) ?? null,
      })
    )
    .sort((left, right) => right.updatedAt - left.updatedAt);
}

export function formatRuntimeError(error: unknown): string {
  const message = readRuntimeErrorMessage(error);
  const code = readRuntimeErrorCode(error);
  if (message && code) {
    return `${message} (${code})`;
  }
  if (message) {
    return message;
  }
  if (code) {
    return code;
  }
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message.trim();
  }
  if (typeof error === "string" && error.trim().length > 0) {
    return error.trim();
  }
  return "Unknown runtime error.";
}

export function resolveRuntimeCapabilitiesValue(input: {
  kernelProjectionEnabled: boolean;
  projectionCapabilities: KernelCapabilitiesSlice | null;
  fallbackCapabilities: unknown;
}) {
  if (input.kernelProjectionEnabled) {
    return input.projectionCapabilities ?? null;
  }
  return input.fallbackCapabilities;
}

export function resolveRuntimeErrorLabel(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const code =
    typeof record.code === "string" && record.code.trim().length > 0 ? record.code : null;
  const message =
    typeof record.message === "string" && record.message.trim().length > 0 ? record.message : null;
  return code ?? message;
}

export function reduceRuntimeDurabilityWarning(input: {
  previous: RuntimeDurabilityWarningState | null;
  now: number;
  diagnostics: {
    reason: string;
    revision?: string | null;
    mode?: string | null;
    degraded?: boolean | null;
    checkpointWriteTotal?: number | null;
    checkpointWriteFailedTotal?: number | null;
    updatedAt?: number | null;
  };
  fallbackRevision: string;
}) {
  const revision = input.diagnostics.revision ?? input.fallbackRevision;
  if (
    input.previous &&
    input.previous.revision === revision &&
    input.now < input.previous.expiresAt
  ) {
    return {
      ...input.previous,
      repeatCount: input.previous.repeatCount + 1,
      mode: input.diagnostics.mode ?? input.previous.mode,
      degraded: input.diagnostics.degraded ?? input.previous.degraded,
      checkpointWriteTotal:
        input.diagnostics.checkpointWriteTotal ?? input.previous.checkpointWriteTotal,
      checkpointWriteFailedTotal:
        input.diagnostics.checkpointWriteFailedTotal ?? input.previous.checkpointWriteFailedTotal,
      updatedAt: input.diagnostics.updatedAt ?? input.previous.updatedAt,
      lastSeenAt: input.now,
    };
  }
  return {
    reason: input.diagnostics.reason,
    revision,
    repeatCount: 1,
    mode: input.diagnostics.mode ?? null,
    degraded: input.diagnostics.degraded ?? null,
    checkpointWriteTotal: input.diagnostics.checkpointWriteTotal ?? null,
    checkpointWriteFailedTotal: input.diagnostics.checkpointWriteFailedTotal ?? null,
    updatedAt: input.diagnostics.updatedAt ?? input.now,
    firstSeenAt: input.now,
    lastSeenAt: input.now,
    expiresAt: input.now + RUNTIME_DURABILITY_WINDOW_MS,
  };
}

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
      setRuntimeProviders(nextProviders.map(normalizeRuntimeProviderCatalogEntry));
      setRuntimeAccounts(nextAccounts);
      setRuntimePools(nextPools);
      setRuntimeCapabilities(
        resolveRuntimeCapabilitiesValue({
          kernelProjectionEnabled: workspaceClientRuntime.kernelProjection !== undefined,
          projectionCapabilities: capabilitiesProjectionSlice,
          fallbackCapabilities:
            capabilitiesResult?.status === "fulfilled"
              ? capabilitiesResult.value
              : {
                  mode: "unavailable",
                  methods: [],
                  features: [],
                  wsEndpointPath: null,
                  error: capabilitiesResult ? formatRuntimeError(capabilitiesResult.reason) : null,
                },
        })
      );
      if (healthResult?.status === "fulfilled") {
        setRuntimeHealth(healthResult.value);
        setRuntimeHealthError(null);
      } else {
        setRuntimeHealth(null);
        setRuntimeHealthError(healthResult ? formatRuntimeError(healthResult.reason) : null);
      }
      if (metricsResult?.status === "fulfilled") {
        setRuntimeToolMetrics(metricsResult.value);
      }
      if (guardrailsResult?.status === "fulfilled") {
        setRuntimeToolGuardrails(guardrailsResult.value);
      }
      if (policyResult?.status === "fulfilled") {
        setRuntimePolicy(policyResult.value);
        setRuntimePolicyError(null);
      } else {
        setRuntimePolicy(null);
        setRuntimePolicyError(policyResult ? formatRuntimeError(policyResult.reason) : null);
      }
    } finally {
      setRuntimeAuxLoading(false);
    }
  }, [
    capabilitiesProjectionSlice,
    diagnosticsProjectionSlice,
    input.runtimeControl,
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
        if (!diagnostics || diagnostics.reason !== AGENT_TASK_DURABILITY_DEGRADED_REASON) {
          return;
        }

        const eventWorkspaceId = String(event.workspace_id ?? "").trim();
        const paramsWorkspaceId = parseRuntimeDurabilityWorkspaceId(event, params);
        const workspaceMatches =
          eventWorkspaceId === input.workspaceId ||
          paramsWorkspaceId === input.workspaceId ||
          isRuntimeLocalWorkspaceId(eventWorkspaceId);
        if (!workspaceMatches) {
          return;
        }

        const now = Date.now();
        const nextWarning = reduceRuntimeDurabilityWarning({
          previous: runtimeDurabilityWarningRef.current,
          now,
          diagnostics,
          fallbackRevision: `${paramsWorkspaceId ?? DEFAULT_RUNTIME_WORKSPACE_ID}:${diagnostics.reason}:${diagnostics.updatedAt ?? now}`,
        });

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
