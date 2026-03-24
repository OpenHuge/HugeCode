import { useCallback, useRef, useSyncExternalStore } from "react";
import {
  getRuntimeToolLifecycleSnapshot,
  runtimeToolLifecycleEventMatchesWorkspace,
  subscribeRuntimeToolLifecycleSnapshot,
  type RuntimeToolLifecycleEvent,
  type RuntimeToolLifecycleSnapshot,
} from "../../../application/runtime/ports/runtimeToolLifecycle";

type UseDebugRuntimeToolLifecycleOptions = {
  workspaceId: string | null;
  enabled: boolean;
};

type DebugRuntimeToolLifecycleState = {
  revision: number;
  lastEvent: RuntimeToolLifecycleEvent | null;
  lifecycleEvents: RuntimeToolLifecycleEvent[];
};

const EMPTY_RUNTIME_TOOL_LIFECYCLE_STATE: DebugRuntimeToolLifecycleState = {
  revision: 0,
  lastEvent: null,
  lifecycleEvents: [],
};

type DebugRuntimeToolLifecycleCache = {
  sourceRevision: number;
  workspaceId: string | null;
  snapshot: DebugRuntimeToolLifecycleState;
};

function filterLifecycleSnapshot(
  snapshot: RuntimeToolLifecycleSnapshot,
  workspaceId: string | null
): DebugRuntimeToolLifecycleState {
  const lifecycleEvents = snapshot.recentEvents.filter((event) =>
    runtimeToolLifecycleEventMatchesWorkspace(event, workspaceId)
  );
  const lastEvent = [...lifecycleEvents].pop() ?? null;
  return {
    revision: snapshot.revision,
    lastEvent,
    lifecycleEvents,
  };
}

export function useDebugRuntimeToolLifecycle({
  workspaceId,
  enabled,
}: UseDebugRuntimeToolLifecycleOptions): DebugRuntimeToolLifecycleState {
  const cacheRef = useRef<DebugRuntimeToolLifecycleCache>({
    sourceRevision: -1,
    workspaceId: null,
    snapshot: EMPTY_RUNTIME_TOOL_LIFECYCLE_STATE,
  });

  const subscribe = useCallback(
    (callback: () => void) => {
      if (!enabled) {
        return () => undefined;
      }
      return subscribeRuntimeToolLifecycleSnapshot(callback);
    },
    [enabled]
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

    const sourceSnapshot = getRuntimeToolLifecycleSnapshot();
    if (
      cacheRef.current.sourceRevision === sourceSnapshot.revision &&
      cacheRef.current.workspaceId === workspaceId
    ) {
      return cacheRef.current.snapshot;
    }

    const nextSnapshot = filterLifecycleSnapshot(sourceSnapshot, workspaceId);
    cacheRef.current = {
      sourceRevision: sourceSnapshot.revision,
      workspaceId,
      snapshot: nextSnapshot,
    };
    return nextSnapshot;
  }, [enabled, workspaceId]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
