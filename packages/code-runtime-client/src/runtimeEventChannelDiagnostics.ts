export type RuntimeEventChannelTransport = "bridge" | "desktop-host" | "ws" | "sse" | "unknown";

export type RuntimeEventChannelStatus =
  | "idle"
  | "connecting"
  | "open"
  | "reconnecting"
  | "fallback"
  | "error"
  | "stopped";

export type RuntimeEventChannelDiagnostics = {
  id: string;
  label: string;
  transport: RuntimeEventChannelTransport;
  status: RuntimeEventChannelStatus;
  retryAttempt: number;
  retryDelayMs: number | null;
  lastError: string | null;
  fallbackSinceMs: number | null;
  consecutiveFailures: number;
  lastTransitionReason: string | null;
  updatedAt: number;
};

type RuntimeEventChannelDiagnosticsPatch = Partial<
  Omit<RuntimeEventChannelDiagnostics, "id" | "updatedAt">
>;

type DiagnosticsListener = (channels: RuntimeEventChannelDiagnostics[]) => void;

const diagnosticsById = new Map<string, RuntimeEventChannelDiagnostics>();
const listeners = new Set<DiagnosticsListener>();

function emitDiagnosticsSnapshot() {
  const snapshot = readRuntimeEventChannelDiagnostics();
  for (const listener of listeners) {
    listener(snapshot);
  }
}

export function readRuntimeEventChannelDiagnostics(): RuntimeEventChannelDiagnostics[] {
  return Array.from(diagnosticsById.values()).sort((left, right) =>
    left.label.localeCompare(right.label)
  );
}

export function updateRuntimeEventChannelDiagnostics(
  id: string,
  patch: RuntimeEventChannelDiagnosticsPatch
): RuntimeEventChannelDiagnostics {
  const now = Date.now();
  const previous = diagnosticsById.get(id);
  const next: RuntimeEventChannelDiagnostics = {
    id,
    label: patch.label ?? previous?.label ?? id,
    transport: patch.transport ?? previous?.transport ?? "unknown",
    status: patch.status ?? previous?.status ?? "idle",
    retryAttempt: patch.retryAttempt ?? previous?.retryAttempt ?? 0,
    retryDelayMs:
      patch.retryDelayMs !== undefined ? patch.retryDelayMs : (previous?.retryDelayMs ?? null),
    lastError: patch.lastError !== undefined ? patch.lastError : (previous?.lastError ?? null),
    fallbackSinceMs:
      patch.fallbackSinceMs !== undefined
        ? patch.fallbackSinceMs
        : patch.status === "fallback"
          ? (previous?.fallbackSinceMs ?? now)
          : null,
    consecutiveFailures:
      patch.consecutiveFailures !== undefined
        ? patch.consecutiveFailures
        : patch.status === "open"
          ? 0
          : patch.status === "error"
            ? (previous?.consecutiveFailures ?? 0) + 1
            : (previous?.consecutiveFailures ?? 0),
    lastTransitionReason:
      patch.lastTransitionReason !== undefined
        ? patch.lastTransitionReason
        : (previous?.lastTransitionReason ?? null),
    updatedAt: now,
  };
  diagnosticsById.set(id, next);
  emitDiagnosticsSnapshot();
  return next;
}

export function subscribeRuntimeEventChannelDiagnostics(listener: DiagnosticsListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function normalizeRuntimeEventChannelError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  if (error === null || error === undefined) {
    return "unknown error";
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export function __resetRuntimeEventChannelDiagnosticsForTests(): void {
  diagnosticsById.clear();
  emitDiagnosticsSnapshot();
}
