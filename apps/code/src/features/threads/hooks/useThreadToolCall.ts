import type { Dispatch } from "react";
import { useCallback } from "react";
import { respondToToolCallRequest } from "../../../application/runtime/ports/tauriThreads";
import type { DynamicToolCallRequest, DynamicToolCallResponse } from "../../../types";
import type { ThreadAction } from "./useThreadsReducer";

type UseThreadToolCallOptions = {
  dispatch: Dispatch<ThreadAction>;
};

export function useThreadToolCall({ dispatch }: UseThreadToolCallOptions) {
  const handleToolCallSubmit = useCallback(
    async (request: DynamicToolCallRequest, response: DynamicToolCallResponse) => {
      await respondToToolCallRequest(request.workspace_id, request.request_id, response);
      dispatch({
        type: "removeToolCallRequest",
        requestId: request.request_id,
        workspaceId: request.workspace_id,
      });
    },
    [dispatch]
  );

  return { handleToolCallSubmit };
}
