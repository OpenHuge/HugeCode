import type { Dispatch } from "react";
import { useCallback } from "react";
import { useRuntimeSessionCommandsResolver } from "../../../application/runtime/facades/runtimeSessionCommandFacade";
import type { DynamicToolCallRequest, DynamicToolCallResponse } from "../../../types";
import type { ThreadAction } from "./useThreadsReducer";

type UseThreadToolCallOptions = {
  dispatch: Dispatch<ThreadAction>;
};

export function useThreadToolCall({ dispatch }: UseThreadToolCallOptions) {
  const resolveRuntimeSessionCommands = useRuntimeSessionCommandsResolver();

  const handleToolCallSubmit = useCallback(
    async (request: DynamicToolCallRequest, response: DynamicToolCallResponse) => {
      await resolveRuntimeSessionCommands(request.workspace_id).respondToToolCall({
        requestId: request.request_id,
        response,
      });
      dispatch({
        type: "removeToolCallRequest",
        requestId: request.request_id,
        workspaceId: request.workspace_id,
      });
    },
    [dispatch, resolveRuntimeSessionCommands]
  );

  return { handleToolCallSubmit };
}
