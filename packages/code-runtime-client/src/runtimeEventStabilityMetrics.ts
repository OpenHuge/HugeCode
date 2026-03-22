export type RuntimeEventStabilitySnapshot = {
  fallbackEnterTotal: number;
  fallbackRecoverTotal: number;
  reconnectAttemptTotal: number;
  reconnectSuccessTotal: number;
  dedupeHitTotal: number;
  lastFallbackReason: string | null;
  lastFallbackDurationMs: number | null;
  updatedAt: number;
};

type RuntimeEventStabilityListener = (snapshot: RuntimeEventStabilitySnapshot) => void;

const listeners = new Set<RuntimeEventStabilityListener>();

let snapshot: RuntimeEventStabilitySnapshot = {
  fallbackEnterTotal: 0,
  fallbackRecoverTotal: 0,
  reconnectAttemptTotal: 0,
  reconnectSuccessTotal: 0,
  dedupeHitTotal: 0,
  lastFallbackReason: null,
  lastFallbackDurationMs: null,
  updatedAt: Date.now(),
};

function emitSnapshot() {
  for (const listener of listeners) {
    listener({ ...snapshot });
  }
}

function updateSnapshot(
  patch: Partial<Omit<RuntimeEventStabilitySnapshot, "updatedAt">>
): RuntimeEventStabilitySnapshot {
  snapshot = {
    ...snapshot,
    ...patch,
    updatedAt: Date.now(),
  };
  emitSnapshot();
  return snapshot;
}

export function readRuntimeEventStabilityMetrics(): RuntimeEventStabilitySnapshot {
  return { ...snapshot };
}

export function subscribeRuntimeEventStabilityMetrics(
  listener: RuntimeEventStabilityListener
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function recordRuntimeEventFallbackEntered(reason: string): RuntimeEventStabilitySnapshot {
  return updateSnapshot({
    fallbackEnterTotal: snapshot.fallbackEnterTotal + 1,
    lastFallbackReason: reason.trim() || "unknown",
    lastFallbackDurationMs: null,
  });
}

export function recordRuntimeEventFallbackRecovered(
  durationMs: number | null
): RuntimeEventStabilitySnapshot {
  const normalizedDuration =
    typeof durationMs === "number" && Number.isFinite(durationMs) && durationMs >= 0
      ? Math.floor(durationMs)
      : null;
  return updateSnapshot({
    fallbackRecoverTotal: snapshot.fallbackRecoverTotal + 1,
    lastFallbackDurationMs: normalizedDuration,
  });
}

export function recordRuntimeEventReconnectAttempt(): RuntimeEventStabilitySnapshot {
  return updateSnapshot({
    reconnectAttemptTotal: snapshot.reconnectAttemptTotal + 1,
  });
}

export function recordRuntimeEventReconnectSuccess(): RuntimeEventStabilitySnapshot {
  return updateSnapshot({
    reconnectSuccessTotal: snapshot.reconnectSuccessTotal + 1,
  });
}

export function recordRuntimeEventDedupeHit(): RuntimeEventStabilitySnapshot {
  return updateSnapshot({
    dedupeHitTotal: snapshot.dedupeHitTotal + 1,
  });
}

export function __resetRuntimeEventStabilityMetricsForTests(): void {
  snapshot = {
    fallbackEnterTotal: 0,
    fallbackRecoverTotal: 0,
    reconnectAttemptTotal: 0,
    reconnectSuccessTotal: 0,
    dedupeHitTotal: 0,
    lastFallbackReason: null,
    lastFallbackDurationMs: null,
    updatedAt: Date.now(),
  };
  emitSnapshot();
}
