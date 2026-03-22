import { invoke, isTauri } from "@tauri-apps/api/core";
import type { DynamicToolCallResponse, ReviewTarget } from "../types";
import { getRuntimeClient } from "./runtimeClient";

export const REVIEW_START_DESKTOP_ONLY_MESSAGE =
  "Review start is only available in the desktop app.";

export async function startReview(
  workspaceId: string,
  threadId: string,
  target: ReviewTarget,
  delivery?: "inline" | "detached"
) {
  if (!isTauri()) {
    throw new Error(REVIEW_START_DESKTOP_ONLY_MESSAGE);
  }
  const payload: Record<string, unknown> = { workspaceId, threadId, target };
  if (delivery) {
    payload.delivery = delivery;
  }
  return invoke("start_review", payload);
}

export async function respondToServerRequest(
  workspaceId: string,
  requestId: number | string,
  decision: "accept" | "decline"
) {
  if (typeof requestId === "string" && requestId.trim().length > 0) {
    await getRuntimeClient().runtimeRunCheckpointApproval({
      approvalId: requestId.trim(),
      decision: decision === "accept" ? "approved" : "rejected",
      reason: null,
    });
    return;
  }
  return invoke("respond_to_server_request", {
    workspaceId,
    requestId,
    result: { decision },
  });
}

export async function respondToUserInputRequest(
  workspaceId: string,
  requestId: number | string,
  answers: Record<string, { answers: string[] }>
) {
  return invoke("respond_to_server_request", {
    workspaceId,
    requestId,
    result: { answers },
  });
}

export async function respondToToolCallRequest(
  workspaceId: string,
  requestId: number | string,
  response: DynamicToolCallResponse
) {
  return invoke("respond_to_server_request", {
    workspaceId,
    requestId,
    result: response,
  });
}

export async function respondToServerRequestResult(
  workspaceId: string,
  requestId: number | string,
  result: Record<string, unknown>
) {
  return invoke("respond_to_server_request", {
    workspaceId,
    requestId,
    result,
  });
}

export async function rememberApprovalRule(workspaceId: string, command: string[]) {
  return invoke("remember_approval_rule", { workspaceId, command });
}
