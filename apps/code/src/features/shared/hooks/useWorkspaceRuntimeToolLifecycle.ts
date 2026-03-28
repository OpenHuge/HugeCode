import { useCallback, useRef, useSyncExternalStore } from "react";
import {
  buildRuntimeToolLifecyclePresentationSummary,
  getWorkspaceRuntimeToolLifecycleSnapshot,
  sortRuntimeToolLifecycleEventsByRecency,
  sortRuntimeToolLifecycleHookCheckpointsByRecency,
  subscribeWorkspaceRuntimeToolLifecycleSnapshot,
  type RuntimeToolLifecycleEvent,
  type RuntimeToolLifecycleHookCheckpoint,
  type RuntimeToolLifecyclePresentationSummary,
  type RuntimeToolLifecycleSnapshot,
} from "../../../application/runtime/ports/runtimeToolLifecycle";

export type WorkspaceRuntimeToolLifecycleState = {
  summary: RuntimeToolLifecyclePresentationSummary;
  revision: number;
  lastHookCheckpoint: RuntimeToolLifecycleHookCheckpoint | null;
  lastEvent: RuntimeToolLifecycleEvent | null;
  hookCheckpoints: RuntimeToolLifecycleHookCheckpoint[];
  lifecycleEvents: RuntimeToolLifecycleEvent[];
};

type UseWorkspaceRuntimeToolLifecycleOptions = {
  workspaceId: string | null;
  enabled?: boolean;
};

type WorkspaceRuntimeToolLifecycleCache = {
  sourceRevision: number;
  workspaceId: string | null;
  snapshot: WorkspaceRuntimeToolLifecycleState;
};

const EMPTY_RUNTIME_TOOL_LIFECYCLE_STATE: WorkspaceRuntimeToolLifecycleState = {
  summary: {
    approvalEventCount: 0,
    hasActivity: false,
    latestEvent: null,
    latestEventKey: null,
    latestHookCheckpoint: null,
    latestHookCheckpointKey: null,
    toolEventCount: 0,
    totalEvents: 0,
    totalHookCheckpoints: 0,
  },
  revision: 0,
  lastHookCheckpoint: null,
  lastEvent: null,
  hookCheckpoints: [],
  lifecycleEvents: [],
};

function toWorkspaceRuntimeToolLifecycleState(
  snapshot: RuntimeToolLifecycleSnapshot
): WorkspaceRuntimeToolLifecycleState {
  const lifecycleEvents = sortRuntimeToolLifecycleEventsByRecency(snapshot.recentEvents);
  const hookCheckpoints = sortRuntimeToolLifecycleHookCheckpointsByRecency(
    snapshot.recentHookCheckpoints ?? []
  );

  return {
    summary: buildRuntimeToolLifecyclePresentationSummary({
      lifecycleEvents,
      hookCheckpoints,
    }),
    revision: snapshot.revision,
    lastHookCheckpoint: snapshot.lastHookCheckpoint ?? null,
    lastEvent: snapshot.lastEvent,
    hookCheckpoints,
    lifecycleEvents,
  };
}

export function useWorkspaceRuntimeToolLifecycle({
  workspaceId,
  enabled = true,
}: UseWorkspaceRuntimeToolLifecycleOptions): WorkspaceRuntimeToolLifecycleState {
  const cacheRef = useRef<WorkspaceRuntimeToolLifecycleCache>({
    sourceRevision: -1,
    workspaceId: null,
    snapshot: EMPTY_RUNTIME_TOOL_LIFECYCLE_STATE,
  });

  const subscribe = useCallback(
    (callback: () => void) => {
      if (!enabled) {
        return () => undefined;
      }
      return subscribeWorkspaceRuntimeToolLifecycleSnapshot(workspaceId, callback);
    },
    [enabled, workspaceId]
  );

  const getSnapshot = useCallback(() => {
    if (!enabled) {
      cacheRef.current = {
        sourceRevision: -1,
        workspaceId,
        snapshot: EMPTY_RUNTIME_TOOL_LIFECYCLE_STATE,
      };
      return EMPTY_RUNTIME_TOOL_LIFECYCLE_STATE;
    }

    const sourceSnapshot = getWorkspaceRuntimeToolLifecycleSnapshot(workspaceId);
    if (
      cacheRef.current.sourceRevision === sourceSnapshot.revision &&
      cacheRef.current.workspaceId === workspaceId
    ) {
      return cacheRef.current.snapshot;
    }

    const nextSnapshot = toWorkspaceRuntimeToolLifecycleState(sourceSnapshot);
    cacheRef.current = {
      sourceRevision: sourceSnapshot.revision,
      workspaceId,
      snapshot: nextSnapshot,
    };
    return nextSnapshot;
  }, [enabled, workspaceId]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
