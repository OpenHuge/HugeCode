import type {
  AgentTaskDistributedStatus,
  AgentTaskSummary,
  RuntimeProviderCatalogEntry,
} from "@ku0/code-runtime-host-contract";
import type { RuntimeAgentTaskSummary } from "../types/webMcpBridge";

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
    registryVersion: entry.registryVersion ?? null,
  };
}

export function normalizeRuntimeTaskForProjection(task: RuntimeAgentTaskSummary): AgentTaskSummary {
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
    executionGraph: task.executionGraph ?? null,
    runSummary: task.runSummary ?? null,
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
