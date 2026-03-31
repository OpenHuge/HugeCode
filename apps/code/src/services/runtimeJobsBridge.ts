import type {
  RuntimeRunCancelRequest,
  RuntimeRunCancelV2Response,
  RuntimeRunCheckpointApprovalAck,
  RuntimeRunCheckpointApprovalRequest,
  RuntimeRunGetV2Request,
  RuntimeRunGetV2Response,
  RuntimeRunInterventionRequest,
  RuntimeRunInterventionV2Response,
  RuntimeRunPrepareV2Request,
  RuntimeRunPrepareV2Response,
  RuntimeRunResumeRequest,
  RuntimeRunResumeV2Response,
  RuntimeRunSubscribeRequest,
  RuntimeRunSubscribeV2Response,
  RuntimeRunStartRequest,
  RuntimeRunStartV2Response,
  RuntimeReviewGetV2Request,
  RuntimeReviewGetV2Response,
} from "@ku0/code-runtime-host-contract";
import { getRuntimeClient } from "./runtimeClient";

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
  request: RuntimeRunSubscribeRequest
): Promise<RuntimeRunSubscribeV2Response> {
  return getRuntimeClient().runtimeRunSubscribeV2(request);
}

export async function getRuntimeReviewV2(
  request: RuntimeReviewGetV2Request
): Promise<RuntimeReviewGetV2Response> {
  return getRuntimeClient().runtimeReviewGetV2(request);
}

export async function cancelRuntimeRun(
  request: RuntimeRunCancelRequest
): Promise<RuntimeRunCancelV2Response> {
  return getRuntimeClient().runtimeRunCancelV2(request);
}

export async function interveneRuntimeRun(
  request: RuntimeRunInterventionRequest
): Promise<RuntimeRunInterventionV2Response> {
  return getRuntimeClient().runtimeRunInterveneV2(request);
}

export async function resumeRuntimeRun(
  request: RuntimeRunResumeRequest
): Promise<RuntimeRunResumeV2Response> {
  return getRuntimeClient().runtimeRunResumeV2(request);
}

export async function submitRuntimeJobApprovalDecision(
  request: RuntimeRunCheckpointApprovalRequest
): Promise<RuntimeRunCheckpointApprovalAck> {
  return getRuntimeClient().runtimeRunCheckpointApproval(request);
}
