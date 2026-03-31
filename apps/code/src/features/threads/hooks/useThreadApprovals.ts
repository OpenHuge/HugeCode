import type { Dispatch } from "react";
import { useCallback, useRef } from "react";
import {
  rememberApprovalRule,
  respondToServerRequest,
  submitRuntimeJobApprovalDecision,
} from "../../../application/runtime/ports/threads";
import type { ApprovalRequest, DebugEntry } from "../../../types";
import { normalizeCommandTokens } from "../../../utils/approvalRules";
import type { ThreadAction } from "./useThreadsReducer";

type UseThreadApprovalsOptions = {
  dispatch: Dispatch<ThreadAction>;
  onDebug?: (entry: DebugEntry) => void;
};

export function useThreadApprovals({ dispatch, onDebug }: UseThreadApprovalsOptions) {
  const approvalAllowlistRef = useRef<Record<string, string[][]>>({});

  const rememberApprovalPrefix = useCallback((workspaceId: string, command: string[]) => {
    const normalized = normalizeCommandTokens(command);
    if (!normalized.length) {
      return;
    }
    const allowlist = approvalAllowlistRef.current[workspaceId] ?? [];
    const exists = allowlist.some(
      (entry) =>
        entry.length === normalized.length &&
        entry.every((token, index) => token === normalized[index])
    );
    if (!exists) {
      approvalAllowlistRef.current = {
        ...approvalAllowlistRef.current,
        [workspaceId]: [...allowlist, normalized],
      };
    }
  }, []);

  const resolveApprovalDecision = useCallback(
    async (request: ApprovalRequest, decision: "accept" | "decline") => {
      if (typeof request.request_id === "string" && request.request_id.trim().length > 0) {
        await submitRuntimeJobApprovalDecision({
          approvalId: request.request_id.trim(),
          decision: decision === "accept" ? "approved" : "rejected",
          reason: null,
        });
        return;
      }
      await respondToServerRequest(request.workspace_id, request.request_id, decision);
    },
    []
  );

  const handleApprovalDecision = useCallback(
    async (request: ApprovalRequest, decision: "accept" | "decline") => {
      await resolveApprovalDecision(request, decision);
      dispatch({
        type: "removeApproval",
        requestId: request.request_id,
        workspaceId: request.workspace_id,
      });
    },
    [dispatch, resolveApprovalDecision]
  );

  const handleApprovalRemember = useCallback(
    async (request: ApprovalRequest, command: string[]) => {
      try {
        await rememberApprovalRule(request.workspace_id, command);
      } catch (error) {
        onDebug?.({
          id: `${Date.now()}-client-approval-rule-error`,
          timestamp: Date.now(),
          source: "error",
          label: "approval rule error",
          payload: error instanceof Error ? error.message : String(error),
        });
      }

      rememberApprovalPrefix(request.workspace_id, command);

      await resolveApprovalDecision(request, "accept");
      dispatch({
        type: "removeApproval",
        requestId: request.request_id,
        workspaceId: request.workspace_id,
      });
    },
    [dispatch, onDebug, rememberApprovalPrefix, resolveApprovalDecision]
  );

  return {
    approvalAllowlistRef,
    handleApprovalDecision,
    handleApprovalRemember,
  };
}
