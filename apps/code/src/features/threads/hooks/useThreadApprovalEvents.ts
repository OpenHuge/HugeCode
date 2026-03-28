import type { Dispatch, MutableRefObject } from "react";
import { useCallback } from "react";
import { useRuntimeSessionCommandsResolver } from "../../../application/runtime/facades/runtimeSessionCommandFacadeHooks";
import type { ApprovalRequest } from "../../../types";
import { getApprovalCommandInfo, matchesCommandPrefix } from "../../../utils/approvalRules";
import type { ThreadAction } from "./useThreadsReducer";

type UseThreadApprovalEventsOptions = {
  dispatch: Dispatch<ThreadAction>;
  approvalAllowlistRef: MutableRefObject<Record<string, string[][]>>;
};

export function useThreadApprovalEvents({
  dispatch,
  approvalAllowlistRef,
}: UseThreadApprovalEventsOptions) {
  const resolveRuntimeSessionCommands = useRuntimeSessionCommandsResolver();

  return useCallback(
    (approval: ApprovalRequest) => {
      const commandInfo = getApprovalCommandInfo(approval.params ?? {});
      const allowlist = approvalAllowlistRef.current[approval.workspace_id] ?? [];
      if (commandInfo && matchesCommandPrefix(commandInfo.tokens, allowlist)) {
        void resolveRuntimeSessionCommands(approval.workspace_id).respondToApproval({
          requestId: approval.request_id,
          decision: "accept",
        });
        return;
      }
      dispatch({ type: "addApproval", approval });
    },
    [approvalAllowlistRef, dispatch, resolveRuntimeSessionCommands]
  );
}
