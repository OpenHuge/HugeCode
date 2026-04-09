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
import { formatRuntimeError } from "./runtimeMissionControlErrorPresentation";
import { normalizeRuntimeProviderCatalogEntry } from "./runtimeMissionControlProjectionNormalization";
import type { AppServerEvent } from "../../../types";
import {
  DEFAULT_RUNTIME_WORKSPACE_ID,
  isRuntimeLocalWorkspaceId,
} from "../../../utils/runtimeWorkspaceIds";
import {
  AGENT_TASK_DURABILITY_DEGRADED_REASON,
  parseRuntimeDurabilityWorkspaceId,
  RUNTIME_DURABILITY_WINDOW_MS,
} from "../../../utils/runtimeUpdatedDurability";
import type { RuntimeAgentTaskSummary, RuntimeMissionRunSummary } from "../types/webMcpBridge";

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

export function buildRuntimeAdvisorySnapshotState(input: {
  nextProviders: RuntimeProviderCatalogEntry[];
  nextAccounts: OAuthAccountSummary[];
  nextPools: OAuthPoolSummary[];
  kernelProjectionEnabled: boolean;
  capabilitiesProjectionSlice: KernelCapabilitiesSlice | null;
  capabilitiesResult: PromiseSettledResult<unknown> | undefined;
  healthResult: PromiseSettledResult<unknown> | undefined;
  metricsResult: PromiseSettledResult<unknown> | undefined;
  guardrailsResult: PromiseSettledResult<unknown> | undefined;
  policyResult: PromiseSettledResult<RuntimePolicySnapshot | null> | undefined;
  previousToolMetrics: unknown;
  previousToolGuardrails: unknown;
}) {
  return {
    providers: input.nextProviders.map(normalizeRuntimeProviderCatalogEntry),
    accounts: input.nextAccounts,
    pools: input.nextPools,
    capabilities: resolveRuntimeCapabilitiesValue({
      kernelProjectionEnabled: input.kernelProjectionEnabled,
      projectionCapabilities: input.capabilitiesProjectionSlice,
      fallbackCapabilities:
        input.capabilitiesResult?.status === "fulfilled"
          ? input.capabilitiesResult.value
          : {
              mode: "unavailable",
              methods: [],
              features: [],
              wsEndpointPath: null,
              error: input.capabilitiesResult
                ? formatRuntimeError(input.capabilitiesResult.reason)
                : null,
            },
    }),
    health: input.healthResult?.status === "fulfilled" ? input.healthResult.value : null,
    healthError:
      input.healthResult?.status === "fulfilled"
        ? null
        : input.healthResult
          ? formatRuntimeError(input.healthResult.reason)
          : null,
    toolMetrics:
      input.metricsResult?.status === "fulfilled"
        ? input.metricsResult.value
        : input.previousToolMetrics,
    toolGuardrails:
      input.guardrailsResult?.status === "fulfilled"
        ? input.guardrailsResult.value
        : input.previousToolGuardrails,
    policy: input.policyResult?.status === "fulfilled" ? input.policyResult.value : null,
    policyError:
      input.policyResult?.status === "fulfilled"
        ? null
        : input.policyResult
          ? formatRuntimeError(input.policyResult.reason)
          : null,
  };
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

export function matchesRuntimeDurabilityWorkspace(input: {
  workspaceId: string;
  eventWorkspaceId: string | null;
  paramsWorkspaceId: string | null;
}) {
  return (
    input.eventWorkspaceId === input.workspaceId ||
    input.paramsWorkspaceId === input.workspaceId ||
    isRuntimeLocalWorkspaceId(input.eventWorkspaceId ?? "")
  );
}

export function buildRuntimeDurabilityFallbackRevision(input: {
  workspaceId: string | null;
  reason: string;
  updatedAt: number | null | undefined;
  now: number;
}) {
  return `${input.workspaceId ?? DEFAULT_RUNTIME_WORKSPACE_ID}:${input.reason}:${input.updatedAt ?? input.now}`;
}

export function reduceRuntimeDurabilityEventWarning(input: {
  previous: RuntimeDurabilityWarningState | null;
  workspaceId: string;
  eventWorkspaceId: string | null;
  paramsWorkspaceId: string | null;
  diagnostics: {
    reason: string;
    revision?: string | null;
    mode?: string | null;
    degraded?: boolean | null;
    checkpointWriteTotal?: number | null;
    checkpointWriteFailedTotal?: number | null;
    updatedAt?: number | null;
  } | null;
  now: number;
}) {
  if (
    !input.diagnostics ||
    input.diagnostics.reason !== AGENT_TASK_DURABILITY_DEGRADED_REASON ||
    !matchesRuntimeDurabilityWorkspace({
      workspaceId: input.workspaceId,
      eventWorkspaceId: input.eventWorkspaceId,
      paramsWorkspaceId: input.paramsWorkspaceId,
    })
  ) {
    return null;
  }
  return reduceRuntimeDurabilityWarning({
    previous: input.previous,
    now: input.now,
    diagnostics: input.diagnostics,
    fallbackRevision: buildRuntimeDurabilityFallbackRevision({
      workspaceId: input.paramsWorkspaceId,
      reason: input.diagnostics.reason,
      updatedAt: input.diagnostics.updatedAt,
      now: input.now,
    }),
  });
}

export function readRuntimeDurabilityWorkspaceIds(input: {
  event: Pick<AppServerEvent, "workspace_id"> | null | undefined;
  params: Record<string, unknown>;
}) {
  const eventWorkspaceId = String(input.event?.workspace_id ?? "").trim();
  const paramsWorkspaceId = parseRuntimeDurabilityWorkspaceId(input.event, input.params);
  return {
    eventWorkspaceId,
    paramsWorkspaceId,
  };
}
