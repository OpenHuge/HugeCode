import { useCallback, useRef, useSyncExternalStore } from "react";
import {
  readRuntimeToolExecutionMetrics,
  subscribeRuntimeToolExecutionMetrics,
  type RuntimeToolExecutionRecentEntry,
  type RuntimeToolExecutionTotals,
} from "../../../application/runtime/ports/runtimeToolExecutionMetrics";

type UseDebugRuntimeToolExecutionMetricsOptions = {
  enabled: boolean;
};

export type DebugRuntimeToolExecutionMetricsState = {
  updatedAt: number;
  totals: RuntimeToolExecutionTotals;
  recentExecutions: RuntimeToolExecutionRecentEntry[];
};

const EMPTY_RUNTIME_TOOL_EXECUTION_TOTALS: RuntimeToolExecutionTotals = {
  attemptedTotal: 0,
  startedTotal: 0,
  completedTotal: 0,
  successTotal: 0,
  validationFailedTotal: 0,
  runtimeFailedTotal: 0,
  timeoutTotal: 0,
  blockedTotal: 0,
  truncatedTotal: 0,
};

const EMPTY_RUNTIME_TOOL_EXECUTION_METRICS_STATE: DebugRuntimeToolExecutionMetricsState = {
  updatedAt: 0,
  totals: EMPTY_RUNTIME_TOOL_EXECUTION_TOTALS,
  recentExecutions: [],
};

type DebugRuntimeToolExecutionMetricsCache = {
  updatedAt: number;
  snapshot: DebugRuntimeToolExecutionMetricsState;
};

function buildSnapshot(): DebugRuntimeToolExecutionMetricsState {
  const snapshot = readRuntimeToolExecutionMetrics();
  return {
    updatedAt: snapshot.updatedAt,
    totals: snapshot.totals,
    recentExecutions: snapshot.recent,
  };
}

export function useDebugRuntimeToolExecutionMetrics({
  enabled,
}: UseDebugRuntimeToolExecutionMetricsOptions): DebugRuntimeToolExecutionMetricsState {
  const cacheRef = useRef<DebugRuntimeToolExecutionMetricsCache>({
    updatedAt: -1,
    snapshot: EMPTY_RUNTIME_TOOL_EXECUTION_METRICS_STATE,
  });

  const subscribe = useCallback(
    (callback: () => void) => {
      if (!enabled) {
        return () => undefined;
      }
      return subscribeRuntimeToolExecutionMetrics(callback);
    },
    [enabled]
  );

  const getSnapshot = useCallback(() => {
    if (!enabled) {
      cacheRef.current = {
        updatedAt: -1,
        snapshot: EMPTY_RUNTIME_TOOL_EXECUTION_METRICS_STATE,
      };
      return EMPTY_RUNTIME_TOOL_EXECUTION_METRICS_STATE;
    }

    const snapshot = buildSnapshot();
    if (cacheRef.current.updatedAt === snapshot.updatedAt) {
      return cacheRef.current.snapshot;
    }

    cacheRef.current = {
      updatedAt: snapshot.updatedAt,
      snapshot,
    };
    return snapshot;
  }, [enabled]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
