import type { DynamicToolCallResponse, ReviewTarget } from "../types";
import { getRuntimeClient } from "./runtimeClient";

export const REVIEW_START_DESKTOP_ONLY_MESSAGE =
  "Review start is only available in the desktop app.";

export async function startReview(
  workspaceId: string,
  threadId: string,
  target: ReviewTarget,
  delivery?: "inline" | "detached"
): Promise<unknown> {
  void workspaceId;
  void threadId;
  void target;
  void delivery;
  throw new Error(REVIEW_START_DESKTOP_ONLY_MESSAGE);
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
  void workspaceId;
  void requestId;
  void decision;
  throw new Error("Numeric approval requests are unavailable in the Electron desktop host.");
}

export async function respondToUserInputRequest(
  workspaceId: string,
  requestId: number | string,
  answers: Record<string, { answers: string[] }>
) {
  void workspaceId;
  void requestId;
  void answers;
  throw new Error("User-input request responses are unavailable in the Electron desktop host.");
}

export async function respondToToolCallRequest(
  workspaceId: string,
  requestId: number | string,
  response: DynamicToolCallResponse
) {
  void workspaceId;
  void requestId;
  void response;
  throw new Error("Tool-call request responses are unavailable in the Electron desktop host.");
}

export async function respondToServerRequestResult(
  workspaceId: string,
  requestId: number | string,
  result: Record<string, unknown>
) {
  void workspaceId;
  void requestId;
  void result;
  throw new Error("Server request result replies are unavailable in the Electron desktop host.");
}

export async function rememberApprovalRule(workspaceId: string, command: string[]) {
  void workspaceId;
  void command;
}
