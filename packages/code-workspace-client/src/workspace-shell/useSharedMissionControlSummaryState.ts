import type { HugeCodeMissionControlSnapshot } from "@ku0/code-runtime-host-contract";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useWorkspaceClientRuntimeBindings } from "../workspace/WorkspaceClientBindingsProvider";
import { EMPTY_SHARED_MISSION_CONTROL_SUMMARY } from "./sharedMissionControlSummary";
import { createMissionControlSummaryLoader } from "./missionControlSummaryLoader";
import type { SharedMissionControlSummary } from "./sharedMissionControlSummary";
import type { MissionControlLoadState } from "./missionControlSnapshotStore";

export type {
  SharedMissionActivityItem,
  SharedMissionControlReadinessSummary,
  SharedMissionControlSummary,
  SharedReviewQueueItem,
} from "./sharedMissionControlSummary";

const IDLE_MISSION_CONTROL_STATE = {
  snapshot: null,
  summary: EMPTY_SHARED_MISSION_CONTROL_SUMMARY,
  loadState: "idle" as const,
  error: null,
};

type SharedMissionControlSummaryState = {
  snapshot: HugeCodeMissionControlSnapshot | null;
  summary: SharedMissionControlSummary;
  loadState: MissionControlLoadState;
  error: string | null;
};

export function useSharedMissionControlSummaryState(
  activeWorkspaceId: string | null,
  options?: {
    enabled?: boolean;
  }
) {
  const runtime = useWorkspaceClientRuntimeBindings();
  const enabled = options?.enabled ?? true;
  const summaryLoader = useMemo(
    () => createMissionControlSummaryLoader(runtime.missionControl),
    [runtime.missionControl]
  );

  const [state, setState] = useState<SharedMissionControlSummaryState>(IDLE_MISSION_CONTROL_STATE);
  const requestIdRef = useRef(0);
  const refreshTimeoutRef = useRef<number | null>(null);

  const loadSummary = useCallback(
    async (loadState: MissionControlLoadState = "loading") => {
      if (!enabled) {
        setState(IDLE_MISSION_CONTROL_STATE);
        return;
      }

      requestIdRef.current += 1;
      const requestId = requestIdRef.current;
      setState((current) => ({
        snapshot: current.snapshot,
        summary: current.summary,
        loadState,
        error: null,
      }));

      try {
        const { snapshot, summary } = await summaryLoader.load(activeWorkspaceId);
        if (requestId !== requestIdRef.current) {
          return;
        }
        setState({
          snapshot,
          summary,
          loadState: "ready",
          error: null,
        });
      } catch (error) {
        if (requestId !== requestIdRef.current) {
          return;
        }
        setState({
          snapshot: null,
          summary: EMPTY_SHARED_MISSION_CONTROL_SUMMARY,
          loadState: "error",
          error: error instanceof Error ? error.message : "Unable to load mission control.",
        });
      }
    },
    [activeWorkspaceId, enabled, summaryLoader]
  );

  // Prevent stale closure capture in delayed refresh callbacks.
  // Even if a workspace switch happens between scheduling and execution,
  // the timer will always call the latest loader.
  const latestLoadSummaryRef = useRef(loadSummary);
  useEffect(() => {
    latestLoadSummaryRef.current = loadSummary;
  }, [loadSummary]);

  const refresh = useCallback(() => loadSummary("refreshing"), [loadSummary]);

  useEffect(() => {
    if (!enabled) {
      setState(IDLE_MISSION_CONTROL_STATE);
      return;
    }
    void loadSummary("loading");
  }, [enabled, loadSummary]);

  useEffect(() => {
    if (!enabled || !runtime.runtimeUpdated) {
      return;
    }
    return runtime.runtimeUpdated.subscribeScopedRuntimeUpdatedEvents(
      { scopes: ["bootstrap", "workspaces", "agents"] },
      () => {
        if (typeof window === "undefined") {
          void loadSummary("loading");
          return;
        }
        if (refreshTimeoutRef.current !== null) {
          return;
        }
        refreshTimeoutRef.current = window.setTimeout(() => {
          refreshTimeoutRef.current = null;
          void latestLoadSummaryRef.current("refreshing");
        }, 160);
      }
    );
  }, [enabled, loadSummary, runtime.runtimeUpdated]);

  useEffect(
    () => () => {
      if (refreshTimeoutRef.current !== null) {
        window.clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = null;
      }
    },
    [enabled, loadSummary]
  );

  return {
    snapshot: enabled ? state.snapshot : null,
    summary: enabled ? state.summary : EMPTY_SHARED_MISSION_CONTROL_SUMMARY,
    loadState: enabled ? state.loadState : "idle",
    error: enabled ? state.error : null,
    refresh,
  };
}
