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
  RuntimeRunCancelAck,
  RuntimeRunCancelRequest,
  RuntimeRunCheckpointApprovalAck,
  RuntimeRunCheckpointApprovalRequest,
  RuntimeRunResumeAck,
} from "./runtimeClient";
export type {
  RuntimeJobInterventionAck,
  RuntimeJobInterventionRequest,
} from "../../../services/tauriRuntimeJobsBridge";
export {
  cancelRuntimeJob,
  submitRuntimeJobApprovalDecision,
  getRuntimeJob,
  interveneRuntimeJob,
  listRuntimeJobs,
  registerRuntimeJobCallback,
  removeRuntimeJobCallback,
  resumeRuntimeJob,
  startRuntimeJob,
  subscribeRuntimeJob,
} from "../../../services/tauriRuntimeJobsBridge";
