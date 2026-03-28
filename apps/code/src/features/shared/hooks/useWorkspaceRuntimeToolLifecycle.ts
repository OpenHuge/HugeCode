import { useCallback, useRef, useSyncExternalStore } from "react";
import {
  getWorkspaceRuntimeToolLifecycleSnapshot,
  subscribeWorkspaceRuntimeToolLifecycleSnapshot,
  type RuntimeToolLifecycleEvent,
  type RuntimeToolLifecycleHookCheckpoint,
  type RuntimeToolLifecycleSnapshot,
} from "../../../application/runtime/ports/runtimeToolLifecycle";

export type WorkspaceRuntimeToolLifecycleState = {
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
  revision: 0,
  lastHookCheckpoint: null,
  lastEvent: null,
  hookCheckpoints: [],
  lifecycleEvents: [],
};

function toWorkspaceRuntimeToolLifecycleState(
  snapshot: RuntimeToolLifecycleSnapshot
): WorkspaceRuntimeToolLifecycleState {
  return {
    revision: snapshot.revision,
    lastHookCheckpoint: snapshot.lastHookCheckpoint ?? null,
    lastEvent: snapshot.lastEvent,
    hookCheckpoints: snapshot.recentHookCheckpoints ?? [],
    lifecycleEvents: snapshot.recentEvents,
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
