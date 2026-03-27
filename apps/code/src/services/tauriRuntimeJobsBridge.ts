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
  type RuntimeRunsListRequest,
  type RuntimeReviewGetV2Request,
  type RuntimeReviewGetV2Response,
  projectRuntimeRunRecordToInterventionAckCompat,
  projectRuntimeRunRecordToKernelJobCompat,
  projectRuntimeRunRecordToResumeAckCompat,
  projectRuntimeRunSummariesToKernelJobsCompat,
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

function toRuntimeRunResumeAck(record: RuntimeRunRecordV2): RuntimeRunResumeAck {
  return projectRuntimeRunRecordToResumeAckCompat(record, { message: "" });
}

function toRuntimeRunsListRequest(request: KernelJobsListRequest): RuntimeRunsListRequest {
  return {
    ...request,
    status: request.status as RuntimeRunsListRequest["status"],
  };
}

// Compat-only: product launches must call prepare/start v2 instead.
export async function startRuntimeJob(request: KernelJobStartRequestV3): Promise<KernelJob> {
  const { delivery: _delivery, ...startRequest } = request;
  const record = await getRuntimeClient().runtimeRunStartV2(
    startRequest satisfies RuntimeRunStartRequest
  );
  return projectRuntimeRunRecordToKernelJobCompat(record, "code_runtime_run_start_v2");
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
  const record = await getRuntimeClient().runtimeRunGetV2({ runId: request.jobId });
  return record
    ? projectRuntimeRunRecordToKernelJobCompat(record, "code_runtime_run_get_v2")
    : null;
}

export async function cancelRuntimeJob(
  request: RuntimeRunCancelRequest
): Promise<RuntimeRunCancelAck> {
  return getRuntimeClient().runtimeRunCancel(request);
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

  const ack = projectRuntimeRunRecordToInterventionAckCompat(request, record);
  return {
    ...ack,
    outcome: toRuntimeJobInterventionOutcome(ack.outcome, ack.accepted, ack.spawnedRunId),
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
  return record
    ? projectRuntimeRunRecordToKernelJobCompat(record, "code_runtime_run_subscribe_v2")
    : null;
}

export async function listRuntimeJobs(request: KernelJobsListRequest): Promise<KernelJob[]> {
  return projectRuntimeRunSummariesToKernelJobsCompat(
    await getRuntimeClient().runtimeRunsList(toRuntimeRunsListRequest(request)),
    "code_runtime_runs_list"
  );
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
