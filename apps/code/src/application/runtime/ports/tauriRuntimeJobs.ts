/**
 * Narrow kernel-job bridge backed by the canonical kernel job v3 RPC contract.
 *
 * Job identity is runtime-owned here. UI code should treat `jobId`/`runId` as
 * the stable control-plane handle and avoid rebuilding page-local background
 * orchestration around legacy transport aliases.
 */
export type {
  KernelJob,
  KernelJobCallbackRegistrationAckV3,
  KernelJobCallbackRegistrationV3,
  KernelJobCallbackRemoveAckV3,
  KernelJobCallbackRemoveRequestV3,
  KernelJobGetRequestV3,
  KernelJobsListRequest,
  KernelJobResumeRequestV3,
  KernelJobStartRequestV3,
  KernelJobSubscribeRequestV3,
  RuntimeRunPrepareV2Request,
  RuntimeRunPrepareV2Response,
  RuntimeRunGetV2Request,
  RuntimeRunGetV2Response,
  RuntimeRunStartRequest,
  RuntimeRunStartV2Response,
  RuntimeRunCancelAck,
  RuntimeRunCancelRequest,
  RuntimeRunCheckpointApprovalAck,
  RuntimeRunCheckpointApprovalRequest,
  RuntimeRunResumeAck,
  RuntimeReviewGetV2Request,
  RuntimeReviewGetV2Response,
} from "./runtimeClient";
export type {
  RuntimeJobInterventionAck,
  RuntimeJobInterventionRequest,
} from "../../../services/tauriRuntimeJobsBridge";
export {
  cancelRuntimeJob,
  getRuntimeRunV2,
  getRuntimeReviewV2,
  submitRuntimeJobApprovalDecision,
  getRuntimeJob,
  interveneRuntimeJob,
  listRuntimeJobs,
  prepareRuntimeRunV2,
  startRuntimeRunV2,
  registerRuntimeJobCallback,
  removeRuntimeJobCallback,
  resumeRuntimeJob,
  startRuntimeJob,
  subscribeRuntimeJob,
} from "../../../services/tauriRuntimeJobsBridge";
