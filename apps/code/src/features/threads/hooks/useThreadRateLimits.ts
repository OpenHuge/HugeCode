import { useCallback, useEffect, useRef } from "react";
import { getAccountRateLimits } from "../../../application/runtime/ports/threads";
import type { DebugEntry, RateLimitSnapshot } from "../../../types";
import { resolveRateLimitsSnapshot } from "../../../utils/rateLimits";
import { normalizeRateLimits } from "../utils/threadNormalize";
import type { ThreadAction } from "./useThreadsReducer";

type UseThreadRateLimitsOptions = {
  activeWorkspaceId: string | null;
  activeWorkspaceConnected?: boolean;
  getCurrentRateLimits?: (workspaceId: string) => RateLimitSnapshot | null;
  dispatch: React.Dispatch<ThreadAction>;
  onDebug?: (entry: DebugEntry) => void;
};

export function useThreadRateLimits({
  activeWorkspaceId,
  activeWorkspaceConnected,
  getCurrentRateLimits,
  dispatch,
  onDebug,
}: UseThreadRateLimitsOptions) {
  const inFlightByWorkspaceRef = useRef<Map<string, Promise<void>>>(new Map());
  const getCurrentRateLimitsRef = useRef(getCurrentRateLimits);

  useEffect(() => {
    getCurrentRateLimitsRef.current = getCurrentRateLimits;
  }, [getCurrentRateLimits]);

  const refreshAccountRateLimits = useCallback(
    async (workspaceId?: string) => {
      const targetId = workspaceId ?? activeWorkspaceId;
      if (!targetId) {
        return;
      }
      const inFlight = inFlightByWorkspaceRef.current.get(targetId);
      if (inFlight) {
        return inFlight;
      }
      const refreshPromise = (async () => {
        onDebug?.({
          id: `${Date.now()}-client-account-rate-limits`,
          timestamp: Date.now(),
          source: "client",
          label: "account/rateLimits/read",
          payload: { workspaceId: targetId },
        });
        try {
          const response = await getAccountRateLimits(targetId);
          onDebug?.({
            id: `${Date.now()}-server-account-rate-limits`,
            timestamp: Date.now(),
            source: "server",
            label: "account/rateLimits/read response",
            payload: response,
          });
          const rateLimits = resolveRateLimitsSnapshot(response);
          if (rateLimits) {
            const previousRateLimits = getCurrentRateLimitsRef.current?.(targetId) ?? null;
            dispatch({
              type: "setRateLimits",
              workspaceId: targetId,
              rateLimits: normalizeRateLimits(rateLimits, previousRateLimits),
            });
          }
        } catch (error) {
          onDebug?.({
            id: `${Date.now()}-client-account-rate-limits-error`,
            timestamp: Date.now(),
            source: "error",
            label: "account/rateLimits/read error",
            payload: error instanceof Error ? error.message : String(error),
          });
        }
      })();
      inFlightByWorkspaceRef.current.set(targetId, refreshPromise);
      try {
        await refreshPromise;
      } finally {
        if (inFlightByWorkspaceRef.current.get(targetId) === refreshPromise) {
          inFlightByWorkspaceRef.current.delete(targetId);
        }
      }
    },
    [activeWorkspaceId, dispatch, onDebug]
  );

  const refreshAccountRateLimitsBatch = useCallback(
    async (workspaceIds: ReadonlyArray<string>) => {
      const ids = Array.from(
        new Set(workspaceIds.map((workspaceId) => workspaceId.trim()).filter(Boolean))
      );
      if (ids.length === 0) {
        return;
      }
      await Promise.allSettled(ids.map((workspaceId) => refreshAccountRateLimits(workspaceId)));
    },
    [refreshAccountRateLimits]
  );

  useEffect(() => {
    if (activeWorkspaceId) {
      void refreshAccountRateLimits(activeWorkspaceId);
    }
  }, [activeWorkspaceConnected, activeWorkspaceId, refreshAccountRateLimits]);

  return { refreshAccountRateLimits, refreshAccountRateLimitsBatch };
}
