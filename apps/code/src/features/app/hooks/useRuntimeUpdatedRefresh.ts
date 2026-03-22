import { useEffect, useMemo, useRef } from "react";
import {
  useScopedRuntimeUpdatedEvent,
  type RuntimeUpdatedEvent,
  type RuntimeUpdatedEventSubscriptionOptions,
} from "../../../application/runtime/ports/runtimeUpdatedEvents";
import type { DebugEntry } from "../../../types";
import { getAppServerRawMethod } from "../../../utils/appServerEvents";

type UseRuntimeUpdatedRefreshOptions = {
  enabled?: boolean;
  workspaceId?: RuntimeUpdatedEventSubscriptionOptions["workspaceId"];
  scopes: RuntimeUpdatedEventSubscriptionOptions["scopes"];
  onRefresh: () => void | Promise<void>;
  onDebug?: (entry: DebugEntry) => void;
  debugLabel?: string;
  shouldRefresh?: (event: RuntimeUpdatedEvent) => boolean;
};

function normalizeRuntimeUpdatedScopes(
  scopes: RuntimeUpdatedEventSubscriptionOptions["scopes"]
): string[] {
  return [
    ...new Set(
      (scopes ?? [])
        .map((scope: string) => scope.trim())
        .filter((scope: string) => scope.length > 0)
    ),
  ];
}

export function useRuntimeUpdatedRefresh({
  enabled = true,
  workspaceId,
  scopes,
  onRefresh,
  onDebug,
  debugLabel,
  shouldRefresh,
}: UseRuntimeUpdatedRefreshOptions) {
  const onRefreshRef = useRef(onRefresh);
  const onDebugRef = useRef(onDebug);
  const normalizedScopes = useMemo(() => normalizeRuntimeUpdatedScopes(scopes), [scopes]);
  const runtimeUpdatedEvent = useScopedRuntimeUpdatedEvent({
    enabled,
    ...(workspaceId === undefined ? {} : { workspaceId }),
    scopes: normalizedScopes,
  });

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    onDebugRef.current = onDebug;
  }, [onDebug]);

  useEffect(() => {
    if (!enabled || !runtimeUpdatedEvent.lastEvent) {
      return;
    }
    if (shouldRefresh && !shouldRefresh(runtimeUpdatedEvent.lastEvent)) {
      return;
    }

    if (debugLabel) {
      const method = getAppServerRawMethod(runtimeUpdatedEvent.lastEvent.event);
      const timestamp = Date.now();
      onDebugRef.current?.({
        id: `${timestamp}-server-runtime-updated-refresh`,
        timestamp,
        source: "server",
        label: debugLabel,
        payload: {
          method,
          event: runtimeUpdatedEvent.lastEvent.event,
        },
      });
    }
    void onRefreshRef.current();
  }, [debugLabel, enabled, runtimeUpdatedEvent, shouldRefresh]);
}
