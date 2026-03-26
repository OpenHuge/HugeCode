import { useCallback, useEffect, useRef, useState } from "react";
import type {
  WorkspaceClientHostBindings,
  WorkspaceClientHostStartupStatus,
} from "../workspace/bindings";

type SharedHostStartupStatusState = {
  status: WorkspaceClientHostStartupStatus | null;
  loadState: "idle" | "loading" | "refreshing" | "ready" | "error";
  error: string | null;
};

const IDLE_HOST_STARTUP_STATUS_STATE: SharedHostStartupStatusState = {
  status: null,
  loadState: "idle",
  error: null,
};

export function useSharedHostStartupStatusState(
  host: WorkspaceClientHostBindings,
  options?: {
    enabled?: boolean;
  }
) {
  const enabled = options?.enabled ?? true;
  const [state, setState] = useState<SharedHostStartupStatusState>(IDLE_HOST_STARTUP_STATUS_STATE);
  const requestIdRef = useRef(0);

  const loadStatus = useCallback(
    async (loadState: SharedHostStartupStatusState["loadState"] = "loading") => {
      if (!enabled || !host.shell.readStartupStatus) {
        setState({
          status: null,
          loadState: "ready",
          error: null,
        });
        return;
      }

      requestIdRef.current += 1;
      const requestId = requestIdRef.current;
      setState((current) => ({
        status: current.status,
        loadState,
        error: null,
      }));

      try {
        const status = await host.shell.readStartupStatus();
        if (requestId !== requestIdRef.current) {
          return;
        }
        setState({
          status,
          loadState: "ready",
          error: null,
        });
      } catch (error) {
        if (requestId !== requestIdRef.current) {
          return;
        }
        setState({
          status: null,
          loadState: "error",
          error: error instanceof Error ? error.message : "Unable to load desktop startup status.",
        });
      }
    },
    [enabled, host.shell]
  );

  const refresh = useCallback(() => loadStatus("refreshing"), [loadStatus]);

  useEffect(() => {
    if (!enabled) {
      setState(IDLE_HOST_STARTUP_STATUS_STATE);
      return;
    }
    void loadStatus("loading");
  }, [enabled, loadStatus]);

  return {
    status: enabled ? state.status : null,
    loadState: enabled ? state.loadState : "idle",
    error: enabled ? state.error : null,
    refresh,
  };
}
