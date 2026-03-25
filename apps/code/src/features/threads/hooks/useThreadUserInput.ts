import type { Dispatch } from "react";
import { useCallback } from "react";
import { useRuntimeSessionCommandsResolver } from "../../../application/runtime/ports/runtimeSessionCommands";
import type { RequestUserInputRequest, RequestUserInputResponse } from "../../../types";
import type { ThreadAction } from "./useThreadsReducer";

type UseThreadUserInputOptions = {
  dispatch: Dispatch<ThreadAction>;
};

export function useThreadUserInput({ dispatch }: UseThreadUserInputOptions) {
  const resolveRuntimeSessionCommands = useRuntimeSessionCommandsResolver();

  const handleUserInputSubmit = useCallback(
    async (request: RequestUserInputRequest, response: RequestUserInputResponse) => {
      await resolveRuntimeSessionCommands(request.workspace_id).respondToUserInput({
        requestId: request.request_id,
        answers: response.answers,
      });
      dispatch({
        type: "removeUserInputRequest",
        requestId: request.request_id,
        workspaceId: request.workspace_id,
      });
    },
    [dispatch, resolveRuntimeSessionCommands]
  );

  return { handleUserInputSubmit };
}
