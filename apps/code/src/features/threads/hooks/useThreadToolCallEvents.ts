import type { Dispatch } from "react";
import { useCallback } from "react";
import type { DynamicToolCallRequest } from "../../../types";
import type { ThreadAction } from "./useThreadsReducer";

type UseThreadToolCallEventsOptions = {
  dispatch: Dispatch<ThreadAction>;
};

export function useThreadToolCallEvents({ dispatch }: UseThreadToolCallEventsOptions) {
  return useCallback(
    (request: DynamicToolCallRequest) => {
      dispatch({ type: "addToolCallRequest", request });
    },
    [dispatch]
  );
}
