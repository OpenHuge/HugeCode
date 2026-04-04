import { normalizeRuntimeProviderCapabilityMatrix } from "@ku0/code-runtime-client/runtimeCapabilityMatrix";
import type {
  AgentTaskDistributedStatus,
  AgentTaskSummary,
  RuntimeProviderExecutionKind,
  RuntimeProviderCatalogEntry,
  RuntimeProviderReadinessKind,
} from "@ku0/code-runtime-host-contract";
import type { RuntimeAgentTaskSummary, RuntimeMissionRunSummary } from "../types/webMcpBridge";

const AGENT_TASK_DISTRIBUTED_STATUSES: ReadonlySet<AgentTaskDistributedStatus> = new Set([
  "idle",
  "planning",
  "running",
  "aggregating",
  "failed",
  "zombie",
]);

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function toDistributedStatus(value: unknown): AgentTaskDistributedStatus | null {
  if (!isNonEmptyString(value)) {
    return null;
  }
  return AGENT_TASK_DISTRIBUTED_STATUSES.has(value as AgentTaskDistributedStatus)
    ? (value as AgentTaskDistributedStatus)
    : null;
}

const RUNTIME_PROVIDER_READINESS_KINDS = new Set<RuntimeProviderReadinessKind>([
  "ready",
  "not_installed",
  "not_authenticated",
  "unsupported_platform",
  "degraded",
]);

const RUNTIME_PROVIDER_EXECUTION_KINDS = new Set<RuntimeProviderExecutionKind>(["local", "cloud"]);

function toReadinessKind(value: unknown): RuntimeProviderReadinessKind | null {
  if (!isNonEmptyString(value)) {
    return null;
  }
  return RUNTIME_PROVIDER_READINESS_KINDS.has(value as RuntimeProviderReadinessKind)
    ? (value as RuntimeProviderReadinessKind)
    : null;
}

function toExecutionKind(value: unknown): RuntimeProviderExecutionKind | null {
  if (!isNonEmptyString(value)) {
    return null;
  }
  return RUNTIME_PROVIDER_EXECUTION_KINDS.has(value as RuntimeProviderExecutionKind)
    ? (value as RuntimeProviderExecutionKind)
    : null;
}

export function normalizeRuntimeProviderCatalogEntry(
  entry: RuntimeProviderCatalogEntry
): RuntimeProviderCatalogEntry {
  return {
    providerId: entry.providerId,
    displayName: isNonEmptyString(entry.displayName) ? entry.displayName : String(entry.providerId),
    pool: entry.pool ?? null,
    oauthProviderId: entry.oauthProviderId ?? null,
    aliases: Array.isArray(entry.aliases) ? entry.aliases.filter(isNonEmptyString) : [],
    defaultModelId: isNonEmptyString(entry.defaultModelId) ? entry.defaultModelId : null,
    available: entry.available === true,
    supportsNative: entry.supportsNative === true,
    supportsOpenaiCompat: entry.supportsOpenaiCompat === true,
    readinessKind: toReadinessKind(entry.readinessKind),
    readinessMessage: isNonEmptyString(entry.readinessMessage) ? entry.readinessMessage : null,
    executionKind: toExecutionKind(entry.executionKind),
    registryVersion: entry.registryVersion ?? null,
    capabilityMatrix: normalizeRuntimeProviderCapabilityMatrix(entry),
  };
}

export function normalizeRuntimeTaskForProjection(
  task: RuntimeAgentTaskSummary
): AgentTaskSummary & RuntimeAgentTaskSummary {
  const runtimeRun = task.runSummary as RuntimeMissionRunSummary | null | undefined;
  return {
    taskId: task.taskId,
    workspaceId: task.workspaceId,
    threadId: task.threadId ?? null,
    requestId: task.requestId ?? null,
    title: task.title ?? null,
    taskSource: task.taskSource ?? null,
    status: task.status as AgentTaskSummary["status"],
    accessMode: task.accessMode,
    executionMode: task.executionMode ?? (task.distributedStatus ? "distributed" : "single"),
    provider: task.provider ?? null,
    modelId: task.modelId ?? null,
    reasonEffort: task.reasonEffort ?? null,
    routedProvider: task.routedProvider ?? null,
    routedModelId: task.routedModelId ?? null,
    routedPool: task.routedPool ?? null,
    routedSource: task.routedSource ?? null,
    currentStep: task.currentStep,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    startedAt: task.startedAt,
    completedAt: task.completedAt,
    errorCode: task.errorCode,
    errorMessage: task.errorMessage,
    pendingApprovalId: task.pendingApprovalId,
    executionProfileId: task.executionProfileId ?? null,
    executionProfile: task.executionProfile ?? null,
    profileReadiness: task.profileReadiness ?? null,
    routing: task.routing ?? null,
    approvalState: task.approvalState ?? null,
    reviewDecision: task.reviewDecision ?? null,
    reviewPackId: task.reviewPackId ?? null,
    intervention: task.intervention ?? null,
    operatorState: task.operatorState ?? null,
    nextAction: task.nextAction ?? null,
    missionBrief: task.missionBrief ?? null,
    relaunchContext: task.relaunchContext ?? null,
    publishHandoff: task.publishHandoff ?? null,
    autoDrive: task.autoDrive ?? null,
    checkpointId: task.checkpointId ?? null,
    traceId: task.traceId ?? null,
    recovered: task.recovered ?? null,
    checkpointState: task.checkpointState ?? null,
    missionLinkage: task.missionLinkage ?? null,
    reviewActionability: task.reviewActionability ?? null,
    takeoverBundle: task.takeoverBundle ?? null,
    sessionBoundary: task.sessionBoundary ?? null,
    continuation: task.continuation ?? null,
    nextOperatorAction: task.nextOperatorAction ?? null,
    contextBoundary: task.contextBoundary ?? runtimeRun?.contextBoundary ?? null,
    contextProjection: task.contextProjection ?? runtimeRun?.contextProjection ?? null,
    compactionSummary: task.compactionSummary ?? runtimeRun?.compactionSummary ?? null,
    executionGraph: task.executionGraph ?? null,
    runSummary: runtimeRun ?? task.runSummary ?? null,
    reviewPackSummary: task.reviewPackSummary ?? null,
    backendId: task.backendId ?? null,
    preferredBackendIds: task.preferredBackendIds ?? null,
    rootTaskId: task.rootTaskId ?? null,
    parentTaskId: task.parentTaskId ?? null,
    childTaskIds: task.childTaskIds ?? [],
    distributedStatus: toDistributedStatus(task.distributedStatus),
    steps: task.steps ?? [],
  };
}
