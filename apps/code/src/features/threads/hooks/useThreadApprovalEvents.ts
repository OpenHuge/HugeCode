import type { Dispatch, MutableRefObject } from "react";
import { useCallback } from "react";
import { useRuntimeInvocationExecuteResolver } from "../../../application/runtime/facades/runtimeInvocationExecuteFacadeHooks";
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
  const resolveRuntimeInvocationExecute = useRuntimeInvocationExecuteResolver();

  return useCallback(
    (approval: ApprovalRequest) => {
      const commandInfo = getApprovalCommandInfo(approval.params ?? {});
      const allowlist = approvalAllowlistRef.current[approval.workspace_id] ?? [];
      if (commandInfo && matchesCommandPrefix(commandInfo.tokens, allowlist)) {
        void resolveRuntimeInvocationExecute(approval.workspace_id)
          .invoke({
            invocationId: "session:respond-to-approval",
            arguments: {
              requestId: approval.request_id,
              decision: "accept",
            },
            caller: "operator",
          })
          .then((result) => {
            if (!result.ok) {
              dispatch({ type: "addApproval", approval });
            }
          })
          .catch(() => {
            dispatch({ type: "addApproval", approval });
          });
        return;
      }
      dispatch({ type: "addApproval", approval });
    },
    [approvalAllowlistRef, dispatch, resolveRuntimeInvocationExecute]
  );
}
