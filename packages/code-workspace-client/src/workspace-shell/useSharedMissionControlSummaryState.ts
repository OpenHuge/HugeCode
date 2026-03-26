import type { HugeCodeMissionControlSnapshot } from "@ku0/code-runtime-host-contract";
import { useCallback, useEffect, useRef, useState } from "react";
import { useWorkspaceClientRuntimeBindings } from "../workspace/WorkspaceClientBindingsProvider";
import {
  buildSharedMissionControlSummary,
  EMPTY_SHARED_MISSION_CONTROL_SUMMARY,
} from "./sharedMissionControlSummary";
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
        if (runtime.missionControl.readMissionControlSummary) {
          const summary = await runtime.missionControl.readMissionControlSummary(activeWorkspaceId);
          if (requestId !== requestIdRef.current) {
            return;
          }
          setState({
            snapshot: null,
            summary,
            loadState: "ready",
            error: null,
          });
          return;
        }

        const snapshot = await runtime.missionControl.readMissionControlSnapshot();
        if (requestId !== requestIdRef.current) {
          return;
        }
        setState({
          snapshot,
          summary: buildSharedMissionControlSummary(snapshot, activeWorkspaceId),
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
    [activeWorkspaceId, enabled, runtime]
  );

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
          void loadSummary("refreshing");
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
