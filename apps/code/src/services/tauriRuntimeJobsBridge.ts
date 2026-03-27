import {
  type AccessMode,
  type AgentTaskExecutionMode,
  type AgentTaskExecutionProfile,
  type AgentTaskInterventionAction,
  type AgentTaskRelaunchContext,
  type AgentTaskStatus,
  type KernelJob,
  type KernelJobCallbackRegistrationAckV3,
  type KernelJobCallbackRegistrationV3,
  type KernelJobCallbackRemoveAckV3,
  type KernelJobCallbackRemoveRequestV3,
  type KernelJobGetRequestV3,
  type KernelJobResumeRequestV3,
  type KernelJobsListRequest,
  type KernelJobStartRequestV3,
  type KernelJobSubscribeRequestV3,
  type ModelProvider,
  type RuntimeRunPrepareV2Request,
  type RuntimeRunPrepareV2Response,
  type RuntimeRunGetV2Request,
  type RuntimeRunGetV2Response,
  type RuntimeRunInterventionRequest,
  type RuntimeRunRecordV2,
  type RuntimeRunResumeRequest,
  type RuntimeRunSubscribeV2Response,
  type RuntimeRunStartRequest,
  type RuntimeRunStartV2Response,
  type RuntimeReviewGetV2Request,
  type RuntimeReviewGetV2Response,
  buildRuntimeContinuationDescriptor,
  resolvePreferredPublishHandoff,
  resolvePreferredReviewActionability,
} from "@ku0/code-runtime-host-contract";
import {
  getRuntimeClient,
  type RuntimeRunCancelAck,
  type RuntimeRunCancelRequest,
  type RuntimeRunCheckpointApprovalAck,
  type RuntimeRunCheckpointApprovalRequest,
  type RuntimeRunResumeAck,
} from "./runtimeClient";

export type RuntimeJobInterventionRequest = {
  runId: string;
  action: AgentTaskInterventionAction;
  reason?: string | null;
  instructionPatch?: string | null;
  executionProfileId?: string | null;
  reviewProfileId?: string | null;
  executionProfile?: AgentTaskExecutionProfile | null;
  accessMode?: AccessMode | null;
  executionMode?: AgentTaskExecutionMode | null;
  provider?: ModelProvider | null;
  modelId?: string | null;
  preferredBackendIds?: string[] | null;
  relaunchContext?: AgentTaskRelaunchContext | null;
  approvedPlanVersion?: string | null;
};

type RuntimeJobInterventionOutcome =
  | "submitted"
  | "spawned"
  | "completed"
  | "blocked"
  | "unsupported"
  | "unavailable";

export type RuntimeJobInterventionAck = {
  accepted: boolean;
  action: AgentTaskInterventionAction;
  runId: string;
  status: AgentTaskStatus;
  outcome: RuntimeJobInterventionOutcome;
  spawnedRunId?: string | null;
  checkpointId?: string | null;
};

function toRuntimeJobInterventionOutcome(
  outcome: string | null | undefined,
  accepted: boolean,
  spawnedRunId?: string | null
): RuntimeJobInterventionOutcome {
  switch (outcome) {
    case "submitted":
    case "spawned":
    case "completed":
    case "blocked":
    case "unsupported":
    case "unavailable":
      return outcome;
    default:
      return accepted ? (spawnedRunId ? "spawned" : "submitted") : "blocked";
  }
}

function readRuntimeRunId(record: RuntimeRunRecordV2): string {
  const missionRunRecord = record.missionRun as { runId?: string | null };
  return (
    missionRunRecord.runId?.trim() ||
    record.missionRun.id?.trim() ||
    record.run.taskId?.trim() ||
    record.run.runSummary?.id?.trim() ||
    ""
  );
}

function toKernelExecutionProfile(record: RuntimeRunRecordV2): KernelJob["executionProfile"] {
  const distributed = record.run.executionMode === "distributed";
  return {
    placement: distributed ? "remote" : "local",
    interactivity: distributed ? "background" : "interactive",
    isolation: distributed ? "container_sandbox" : "host",
    network: record.run.accessMode === "read-only" ? "restricted" : "default",
    authority: distributed ? "service" : "user",
  };
}

function toKernelContinuation(record: RuntimeRunRecordV2): KernelJob["continuation"] {
  const continuation = record.missionRun.continuation ?? null;
  const reviewPack = record.reviewPack;
  const takeoverBundle = reviewPack?.takeoverBundle ?? record.missionRun.takeoverBundle ?? null;
  const missionLinkage = reviewPack?.missionLinkage ?? record.missionRun.missionLinkage ?? null;
  const reviewActionability = resolvePreferredReviewActionability({
    takeoverBundle,
    actionability: reviewPack?.actionability ?? record.missionRun.actionability ?? null,
  });
  const publishHandoff = resolvePreferredPublishHandoff({
    takeoverBundle,
    publishHandoff: reviewPack?.publishHandoff ?? record.missionRun.publishHandoff ?? null,
  });
  const continuationDescriptor = buildRuntimeContinuationDescriptor({
    runState: record.missionRun.state ?? null,
    checkpoint: record.missionRun.checkpoint ?? null,
    missionLinkage,
    actionability: reviewActionability,
    publishHandoff,
    takeoverBundle,
    nextAction: record.missionRun.nextAction ?? null,
    reviewPackId: reviewPack?.id ?? record.missionRun.reviewPackId ?? null,
  });
  const resumeSupported =
    record.run.checkpointState?.resumeReady === true ||
    continuation?.pathKind === "resume" ||
    continuationDescriptor?.pathKind === "resume";

  return {
    checkpointId: record.run.checkpointId ?? record.missionRun.checkpoint?.checkpointId ?? null,
    resumeSupported,
    recovered: record.run.recovered === true || record.missionRun.checkpoint?.recovered === true,
    reviewActionability,
    takeover: takeoverBundle,
    missionLinkage,
    publishHandoff,
    summary:
      continuation?.summary ??
      continuationDescriptor?.summary ??
      takeoverBundle?.summary ??
      publishHandoff?.summary ??
      null,
  };
}

function toKernelJob(record: RuntimeRunRecordV2): KernelJob {
  return {
    id: readRuntimeRunId(record),
    workspaceId: record.run.workspaceId,
    threadId: record.run.threadId ?? record.missionRun.lineage?.threadId ?? null,
    title: record.run.title ?? record.missionRun.title ?? null,
    status: record.run.status,
    provider:
      record.run.provider ??
      record.run.routedProvider ??
      record.missionRun.routing?.provider ??
      null,
    modelId: record.run.modelId ?? record.run.routedModelId ?? null,
    backendId:
      record.run.backendId ??
      record.missionRun.routing?.backendId ??
      record.missionRun.placement?.resolvedBackendId ??
      null,
    preferredBackendIds:
      record.run.preferredBackendIds ?? record.missionRun.placement?.requestedBackendIds ?? null,
    executionProfile: toKernelExecutionProfile(record),
    createdAt: record.run.createdAt,
    updatedAt: record.run.updatedAt,
    startedAt: record.run.startedAt ?? record.missionRun.startedAt ?? null,
    completedAt: record.run.completedAt ?? record.missionRun.finishedAt ?? null,
    continuation: toKernelContinuation(record),
    metadata: {
      canonicalMethod: "code_runtime_run_subscribe_v2",
      runId: record.missionRun.id ?? readRuntimeRunId(record),
      reviewPackId: record.reviewPack?.id ?? record.missionRun.reviewPackId ?? null,
    },
  };
}

function toRuntimeRunResumeAck(record: RuntimeRunRecordV2): RuntimeRunResumeAck {
  return {
    accepted: true,
    runId: readRuntimeRunId(record),
    status: record.run.status,
    code: null,
    message: null,
    recovered: record.run.recovered ?? null,
    checkpointId: record.run.checkpointId ?? null,
    traceId: record.run.traceId ?? null,
    updatedAt: record.run.updatedAt ?? null,
  };
}

// Compat-only: product launches must call prepare/start v2 instead.
export async function startRuntimeJob(request: KernelJobStartRequestV3): Promise<KernelJob> {
  return getRuntimeClient().kernelJobStartV3(request);
}

export async function prepareRuntimeRunV2(
  request: RuntimeRunPrepareV2Request
): Promise<RuntimeRunPrepareV2Response> {
  return getRuntimeClient().runtimeRunPrepareV2(request);
}

export async function startRuntimeRunV2(
  request: RuntimeRunStartRequest
): Promise<RuntimeRunStartV2Response> {
  return getRuntimeClient().runtimeRunStartV2(request);
}

export async function getRuntimeRunV2(
  request: RuntimeRunGetV2Request
): Promise<RuntimeRunGetV2Response> {
  return getRuntimeClient().runtimeRunGetV2(request);
}

export async function subscribeRuntimeRunV2(
  request: RuntimeRunGetV2Request
): Promise<RuntimeRunSubscribeV2Response> {
  return getRuntimeClient().runtimeRunSubscribeV2(request);
}

export async function getRuntimeReviewV2(
  request: RuntimeReviewGetV2Request
): Promise<RuntimeReviewGetV2Response> {
  return getRuntimeClient().runtimeReviewGetV2(request);
}

export async function getRuntimeJob(request: KernelJobGetRequestV3): Promise<KernelJob | null> {
  return getRuntimeClient().kernelJobGetV3(request);
}

export async function cancelRuntimeJob(
  request: RuntimeRunCancelRequest
): Promise<RuntimeRunCancelAck> {
  return getRuntimeClient().kernelJobCancelV3(request);
}

export async function interveneRuntimeJob(
  request: RuntimeJobInterventionRequest
): Promise<RuntimeJobInterventionAck> {
  const record = await getRuntimeClient().runtimeRunInterveneV2({
    runId: request.runId,
    action: request.action,
    reason: request.reason ?? null,
    instructionPatch: request.instructionPatch ?? null,
    executionProfileId: request.executionProfileId ?? null,
    reviewProfileId: request.reviewProfileId ?? null,
    preferredBackendIds: request.preferredBackendIds ?? null,
    relaunchContext: request.relaunchContext ?? null,
    approvedPlanVersion: request.approvedPlanVersion ?? null,
  } satisfies RuntimeRunInterventionRequest);

  const runId = readRuntimeRunId(record);
  const spawnedRunId = runId !== request.runId ? runId : null;

  return {
    accepted: true,
    action: request.action,
    runId,
    status: record.run.status,
    outcome: toRuntimeJobInterventionOutcome(null, true, spawnedRunId),
    spawnedRunId,
    checkpointId: record.run.checkpointId ?? null,
  } satisfies RuntimeJobInterventionAck;
}

export async function resumeRuntimeJob(
  request: KernelJobResumeRequestV3
): Promise<RuntimeRunResumeAck> {
  const record = await getRuntimeClient().runtimeRunResumeV2(
    request satisfies RuntimeRunResumeRequest
  );
  return toRuntimeRunResumeAck(record);
}

export async function subscribeRuntimeJob(
  request: KernelJobSubscribeRequestV3
): Promise<KernelJob | null> {
  const record = await getRuntimeClient().runtimeRunSubscribeV2(request);
  return record ? toKernelJob(record) : null;
}

export async function listRuntimeJobs(request: KernelJobsListRequest): Promise<KernelJob[]> {
  return getRuntimeClient().kernelJobsListV2(request);
}

export async function submitRuntimeJobApprovalDecision(
  request: RuntimeRunCheckpointApprovalRequest
): Promise<RuntimeRunCheckpointApprovalAck> {
  return getRuntimeClient().runtimeRunCheckpointApproval(request);
}

export async function registerRuntimeJobCallback(
  request: KernelJobCallbackRegistrationV3
): Promise<KernelJobCallbackRegistrationAckV3> {
  return getRuntimeClient().kernelJobCallbackRegisterV3(request);
}

export async function removeRuntimeJobCallback(
  request: KernelJobCallbackRemoveRequestV3
): Promise<KernelJobCallbackRemoveAckV3> {
  return getRuntimeClient().kernelJobCallbackRemoveV3(request);
}
