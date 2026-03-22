import { useCallback, useRef, useSyncExternalStore } from "react";
import {
  getRuntimeUpdatedSnapshot,
  runtimeUpdatedEventMatchesWorkspace,
  subscribeRuntimeUpdatedSnapshot,
  type RuntimeUpdatedEvent,
  type RuntimeUpdatedEventSubscriptionOptions,
  type RuntimeUpdatedStoreSnapshot,
} from "../runtimeUpdatedEvents";

export type ScopedRuntimeUpdatedEventSnapshot = {
  revision: number;
  lastEvent: RuntimeUpdatedEvent | null;
};

type UseScopedRuntimeUpdatedEventOptions = RuntimeUpdatedEventSubscriptionOptions & {
  enabled?: boolean;
};

type ScopedRuntimeUpdatedCache = {
  scopesKey: string;
  sourceRevision: number;
  workspaceId: string | null;
  snapshot: ScopedRuntimeUpdatedEventSnapshot;
};

const EMPTY_SCOPED_RUNTIME_UPDATED_EVENT_SNAPSHOT: ScopedRuntimeUpdatedEventSnapshot = {
  revision: 0,
  lastEvent: null,
};

function normalizeScopes(
  scopes: RuntimeUpdatedEventSubscriptionOptions["scopes"]
): ReadonlyArray<string> {
  return [
    ...new Set((scopes ?? []).map((scope) => scope.trim()).filter((scope) => scope.length > 0)),
  ];
}

function resolveWorkspaceId(
  workspaceId: RuntimeUpdatedEventSubscriptionOptions["workspaceId"]
): string | null {
  const resolved = typeof workspaceId === "function" ? workspaceId() : workspaceId;
  if (typeof resolved !== "string") {
    return null;
  }
  const trimmed = resolved.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function matchesScopedRuntimeUpdatedEvent(
  storeSnapshot: RuntimeUpdatedStoreSnapshot,
  workspaceId: string | null,
  scopes: ReadonlyArray<string>
): RuntimeUpdatedEvent | null {
  const runtimeUpdatedEvent = storeSnapshot.lastEvent;
  if (!runtimeUpdatedEvent) {
    return null;
  }
  if (workspaceId && !runtimeUpdatedEventMatchesWorkspace(runtimeUpdatedEvent, workspaceId)) {
    return null;
  }
  if (scopes.length > 0 && !runtimeUpdatedEvent.scope.some((scope) => scopes.includes(scope))) {
    return null;
  }
  return runtimeUpdatedEvent;
}

export function useScopedRuntimeUpdatedEvent({
  enabled = true,
  workspaceId,
  scopes,
}: UseScopedRuntimeUpdatedEventOptions): ScopedRuntimeUpdatedEventSnapshot {
  const cacheRef = useRef<ScopedRuntimeUpdatedCache>({
    scopesKey: "",
    sourceRevision: -1,
    workspaceId: null,
    snapshot: EMPTY_SCOPED_RUNTIME_UPDATED_EVENT_SNAPSHOT,
  });
  const normalizedScopes = normalizeScopes(scopes);
  const normalizedWorkspaceId = resolveWorkspaceId(workspaceId);
  const scopesKey = normalizedScopes.join("\0");

  const subscribe = useCallback(
    (callback: () => void) => {
      if (!enabled) {
        return () => undefined;
      }
      return subscribeRuntimeUpdatedSnapshot(callback);
    },
    [enabled]
  );

  const getSnapshot = useCallback(() => {
    if (!enabled) {
      cacheRef.current = {
        scopesKey,
        sourceRevision: -1,
        workspaceId: normalizedWorkspaceId,
        snapshot: EMPTY_SCOPED_RUNTIME_UPDATED_EVENT_SNAPSHOT,
      };
      return EMPTY_SCOPED_RUNTIME_UPDATED_EVENT_SNAPSHOT;
    }

    const storeSnapshot = getRuntimeUpdatedSnapshot();
    const cached = cacheRef.current;
    if (
      cached.sourceRevision === storeSnapshot.revision &&
      cached.scopesKey === scopesKey &&
      cached.workspaceId === normalizedWorkspaceId
    ) {
      return cached.snapshot;
    }

    const matchedEvent = matchesScopedRuntimeUpdatedEvent(
      storeSnapshot,
      normalizedWorkspaceId,
      normalizedScopes
    );
    const nextSnapshot = matchedEvent
      ? {
          revision: storeSnapshot.revision,
          lastEvent: matchedEvent,
        }
      : EMPTY_SCOPED_RUNTIME_UPDATED_EVENT_SNAPSHOT;

    cacheRef.current = {
      scopesKey,
      sourceRevision: storeSnapshot.revision,
      workspaceId: normalizedWorkspaceId,
      snapshot: nextSnapshot,
    };
    return nextSnapshot;
  }, [enabled, normalizedScopes, normalizedWorkspaceId, scopesKey]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
