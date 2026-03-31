import type { CodeRuntimeHostEventEnvelope } from "@ku0/code-runtime-host-contract";
import type { LocalUsageSnapshot } from "../types";
import { logger } from "./logger";
import { createExponentialRetryScheduler } from "./retryScheduler";
import type { DistributedTaskGraphRequest, RuntimeBackendSetStateRequest } from "./runtimeClient";
import {
  normalizeRuntimeEventChannelError,
  updateRuntimeEventChannelDiagnostics,
} from "@ku0/code-runtime-client/runtimeEventChannelDiagnostics";
import {
  parseRuntimeTurnEventMessage,
  parseRuntimeTurnWsEventId,
  RUNTIME_RESYNC_SCOPE,
  RUNTIME_TURN_SSE_CHANNEL_ID,
  RUNTIME_TURN_WS_CHANNEL_ID,
  WEB_RUNTIME_EVENTS_RECONNECT_BASE_MS,
  WEB_RUNTIME_EVENTS_RECONNECT_MAX_MS,
  WEB_RUNTIME_EVENTS_RECONNECT_SIGNAL_THROTTLE_MS,
  WEB_RUNTIME_WS_FALLBACK_PROBE_MS,
  withLastEventIdQuery,
} from "./runtimeTransport";
import { getPathBasename } from "./workspaceBridge";

type UnlistenFn = () => void;

function logRuntimeWarning(message: string, context?: unknown) {
  logger.warn(message, context);
}

type RuntimeThreadSummary = {
  id: string;
  workspaceId: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  provider: string;
  modelId: string | null;
  status?: string | null;
  archived?: boolean;
  lastActivityAt?: number | null;
  agentRole?: string | null;
  agentNickname?: string | null;
};

type RuntimeTurnAck = {
  accepted: boolean;
  code?: string | null;
  turnId: string | null;
  threadId: string | null;
  routedProvider: string | null;
  routedModelId: string | null;
  routedPool: string | null;
  routedSource: string | null;
  backendId?: string | null;
  message: string;
};

type RuntimeWorkspaceFileSummary = {
  id: string;
  path: string;
};

type RuntimeWorkspaceFileContent = {
  content: string;
};

type RuntimeBackendSetStateInput = {
  backendId: string;
  state?: string | null;
  status?: RuntimeBackendSetStateRequest["status"];
  rolloutState?: RuntimeBackendSetStateRequest["rolloutState"];
  force?: boolean;
  reason?: string | null;
  workspaceId?: string | null;
};

type DistributedTaskGraphInput = Partial<DistributedTaskGraphRequest> & {
  workspaceId?: string | null;
  threadId?: string | null;
  turnId?: string | null;
};

type RuntimeReasonEffort = "low" | "medium" | "high" | "xhigh";
type RuntimeAccessMode = "read-only" | "on-request" | "full-access";

const runtimeWorkspaceFileIdsByPath = new Map<string, Map<string, string>>();
const runtimeTerminalSessionIdsByLegacyId = new Map<string, string>();

function getRuntimeTerminalSessionMapKey(workspaceId: string, terminalId: string) {
  return `${workspaceId}:${terminalId}`;
}

function getRuntimeTerminalSessionId(workspaceId: string, terminalId: string) {
  return runtimeTerminalSessionIdsByLegacyId.get(
    getRuntimeTerminalSessionMapKey(workspaceId, terminalId)
  );
}

function setRuntimeTerminalSessionId(workspaceId: string, terminalId: string, sessionId: string) {
  runtimeTerminalSessionIdsByLegacyId.set(
    getRuntimeTerminalSessionMapKey(workspaceId, terminalId),
    sessionId
  );
}

function clearRuntimeTerminalSessionId(workspaceId: string, terminalId: string) {
  runtimeTerminalSessionIdsByLegacyId.delete(
    getRuntimeTerminalSessionMapKey(workspaceId, terminalId)
  );
}

function requireRuntimeTerminalSessionId(workspaceId: string, terminalId: string): string {
  const runtimeSessionId = getRuntimeTerminalSessionId(workspaceId, terminalId);
  if (!runtimeSessionId) {
    throw new Error(`Runtime terminal session not found for ${workspaceId}:${terminalId}`);
  }
  return runtimeSessionId;
}

function normalizeRuntimeBackendSetStateRequest(
  input: RuntimeBackendSetStateInput
): RuntimeBackendSetStateRequest | null {
  const normalizedStatus = (() => {
    if (input.status) {
      return input.status;
    }
    const rawState = typeof input.state === "string" ? input.state.trim().toLowerCase() : "";
    if (rawState === "enabled" || rawState === "enable" || rawState === "active") {
      return "active";
    }
    if (rawState === "disabled" || rawState === "disable") {
      return "disabled";
    }
    if (rawState === "draining" || rawState === "drain") {
      return "draining";
    }
    return undefined;
  })();

  if (!normalizedStatus && !input.rolloutState) {
    return null;
  }

  return {
    backendId: input.backendId,
    status: normalizedStatus,
    rolloutState: input.rolloutState,
    force: input.force,
    reason: input.reason ?? null,
  };
}

function normalizeRuntimeTimestamp(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return Date.now();
  }
  return value < 1_000_000_000_000 ? value * 1000 : value;
}

function toUsageDayKey(epochMs: number): string {
  return new Date(epochMs).toISOString().slice(0, 10);
}

function parseSessionStartedAtFromPath(path: string | null | undefined): number | null {
  if (typeof path !== "string") {
    return null;
  }
  const match = path.match(/rollout-(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})/i);
  if (!match) {
    return null;
  }
  const [year, month, day, hours, minutes, seconds] = match
    .slice(1)
    .map((value) => Number.parseInt(value, 10));
  if ([year, month, day, hours, minutes, seconds].some((value) => !Number.isFinite(value))) {
    return null;
  }
  const startedAt = Date.UTC(year, month - 1, day, hours, minutes, seconds);
  return Number.isFinite(startedAt) && startedAt > 0 ? startedAt : null;
}

function buildLocalUsageSnapshotFromCliSessions(
  sessions: Array<{ updatedAt: number } & Record<string, unknown>>,
  daysWindow: number,
  workspacePath?: string | null
): LocalUsageSnapshot {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const dayCount = Math.max(1, Math.trunc(daysWindow));
  const dayBuckets = new Map<string, LocalUsageSnapshot["days"][number]>();

  for (let offset = dayCount - 1; offset >= 0; offset -= 1) {
    const date = new Date(today);
    date.setUTCDate(date.getUTCDate() - offset);
    const key = date.toISOString().slice(0, 10);
    dayBuckets.set(key, {
      day: key,
      inputTokens: 0,
      cachedInputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      agentTimeMs: 0,
      agentRuns: 0,
    });
  }

  const normalizedWorkspacePath =
    workspacePath && workspacePath.trim().length > 0 ? workspacePath.trim() : null;

  const filteredSessions = sessions.filter((session) => {
    if (!normalizedWorkspacePath) {
      return true;
    }
    const cwdRaw = session.cwd;
    if (typeof cwdRaw !== "string" || cwdRaw.trim().length === 0) {
      return true;
    }
    return cwdRaw.startsWith(normalizedWorkspacePath);
  });

  const modelTokenTotals = new Map<string, number>();
  let newestUpdatedAt = 0;
  let aggregateInputTokens = 0;
  let aggregateCachedInputTokens = 0;

  for (const session of filteredSessions) {
    const updatedAtRaw = session.updatedAt;
    if (!Number.isFinite(updatedAtRaw) || updatedAtRaw <= 0) {
      continue;
    }
    const updatedAt = normalizeRuntimeTimestamp(updatedAtRaw);
    newestUpdatedAt = Math.max(newestUpdatedAt, updatedAt);

    const dayKey = toUsageDayKey(updatedAt);
    const bucket = dayBuckets.get(dayKey);
    if (!bucket) {
      continue;
    }

    const startedAtRaw = session.startedAt;
    const startedAtFromPath = parseSessionStartedAtFromPath(
      typeof session.path === "string" ? session.path : null
    );
    const startedAt =
      typeof startedAtRaw === "number" && Number.isFinite(startedAtRaw) && startedAtRaw > 0
        ? normalizeRuntimeTimestamp(startedAtRaw)
        : (startedAtFromPath ?? updatedAt);
    const durationMs = Math.max(0, updatedAt - startedAt);
    bucket.agentTimeMs += Math.min(durationMs, 24 * 60 * 60 * 1000);
    bucket.agentRuns += 1;

    const inputTokensRaw = session.inputTokens;
    const inputTokens =
      typeof inputTokensRaw === "number" && Number.isFinite(inputTokensRaw) && inputTokensRaw > 0
        ? Math.trunc(inputTokensRaw)
        : 0;
    const cachedInputTokensRaw = session.cachedInputTokens;
    const cachedInputTokens =
      typeof cachedInputTokensRaw === "number" &&
      Number.isFinite(cachedInputTokensRaw) &&
      cachedInputTokensRaw > 0
        ? Math.trunc(cachedInputTokensRaw)
        : 0;
    const outputTokensRaw = session.outputTokens;
    const outputTokens =
      typeof outputTokensRaw === "number" && Number.isFinite(outputTokensRaw) && outputTokensRaw > 0
        ? Math.trunc(outputTokensRaw)
        : 0;
    const totalTokensRaw = session.totalTokens;
    const totalTokens =
      typeof totalTokensRaw === "number" && Number.isFinite(totalTokensRaw) && totalTokensRaw > 0
        ? Math.trunc(totalTokensRaw)
        : inputTokens + cachedInputTokens + outputTokens;

    bucket.inputTokens += inputTokens;
    bucket.cachedInputTokens += cachedInputTokens;
    bucket.outputTokens += outputTokens;
    bucket.totalTokens += totalTokens;

    aggregateInputTokens += inputTokens;
    aggregateCachedInputTokens += cachedInputTokens;

    const modelRaw = session.model;
    if (typeof modelRaw === "string" && modelRaw.trim().length > 0 && totalTokens > 0) {
      const model = modelRaw.trim();
      modelTokenTotals.set(model, (modelTokenTotals.get(model) ?? 0) + totalTokens);
    }
  }

  const days = [...dayBuckets.values()];
  const last7Days = days.slice(-7);
  const last7DaysTokens = last7Days.reduce((total, day) => total + day.totalTokens, 0);
  const last30DaysTokens = days.reduce((total, day) => total + day.totalTokens, 0);
  const averageDailyTokens = days.length > 0 ? Math.round(last30DaysTokens / days.length) : 0;
  const peakDay = days.reduce<{ day: string; tokens: number } | null>((best, day) => {
    if (day.totalTokens <= 0) {
      return best;
    }
    if (!best || day.totalTokens > best.tokens) {
      return { day: day.day, tokens: day.totalTokens };
    }
    return best;
  }, null);
  const cacheDenominator = aggregateInputTokens + aggregateCachedInputTokens;
  const cacheHitRatePercent =
    cacheDenominator > 0 ? (aggregateCachedInputTokens / cacheDenominator) * 100 : 0;

  const topModelsRaw = [...modelTokenTotals.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5);
  const topModels = topModelsRaw.map(([model, tokens]) => ({
    model,
    tokens,
    sharePercent: last30DaysTokens > 0 ? (tokens / last30DaysTokens) * 100 : 0,
  }));

  return {
    updatedAt: newestUpdatedAt || Date.now(),
    days,
    totals: {
      last7DaysTokens,
      last30DaysTokens,
      averageDailyTokens,
      cacheHitRatePercent,
      peakDay: peakDay?.day ?? null,
      peakDayTokens: peakDay?.tokens ?? 0,
    },
    topModels,
  };
}

function toRuntimeThreadRecord(thread: RuntimeThreadSummary, cwd: string) {
  const createdAt = normalizeRuntimeTimestamp(thread.createdAt);
  const updatedAt = normalizeRuntimeTimestamp(thread.updatedAt);
  const lastActivityAtRaw = thread.lastActivityAt;
  const lastActivityAt =
    typeof lastActivityAtRaw === "number" && Number.isFinite(lastActivityAtRaw)
      ? normalizeRuntimeTimestamp(lastActivityAtRaw)
      : updatedAt;
  return {
    id: thread.id,
    workspaceId: thread.workspaceId,
    preview: thread.title ?? "",
    cwd,
    updatedAt,
    updated_at: updatedAt,
    createdAt,
    created_at: createdAt,
    title: thread.title ?? "",
    provider: thread.provider,
    modelId: thread.modelId,
    model_id: thread.modelId,
    status:
      typeof thread.status === "string" && thread.status.trim().length > 0 ? thread.status : null,
    archived: Boolean(thread.archived),
    lastActivityAt,
    last_activity_at: lastActivityAt,
    agentRole:
      typeof thread.agentRole === "string" && thread.agentRole.trim().length > 0
        ? thread.agentRole
        : null,
    agentNickname:
      typeof thread.agentNickname === "string" && thread.agentNickname.trim().length > 0
        ? thread.agentNickname
        : null,
  };
}

function normalizeRuntimeReasonEffort(
  value: string | null | undefined
): RuntimeReasonEffort | null {
  if (value === "low" || value === "medium" || value === "high" || value === "xhigh") {
    return value;
  }
  return null;
}

function toRuntimeAccessMode(value: RuntimeAccessMode | "current" | null | undefined) {
  if (value === "read-only") {
    return "read-only";
  }
  if (value === "full-access") {
    return "full-access";
  }
  return "on-request";
}

function createWebRuntimeTurnEventListener(
  endpoint: string,
  callback: (event: CodeRuntimeHostEventEnvelope) => void
): UnlistenFn {
  if (typeof window === "undefined" || typeof window.EventSource !== "function") {
    return () => undefined;
  }

  let disposed = false;
  let eventSource: EventSource | null = null;
  let hasOpened = false;
  let lastReconnectSignalAt = 0;
  updateRuntimeEventChannelDiagnostics(RUNTIME_TURN_SSE_CHANNEL_ID, {
    label: "Runtime turn stream (SSE)",
    transport: "sse",
    status: "connecting",
    retryAttempt: 0,
    retryDelayMs: null,
    lastError: null,
  });

  const reconnectScheduler = createExponentialRetryScheduler({
    baseDelayMs: WEB_RUNTIME_EVENTS_RECONNECT_BASE_MS,
    maxDelayMs: WEB_RUNTIME_EVENTS_RECONNECT_MAX_MS,
    onRetry: () => {
      connect();
    },
    onSchedule: ({ attempt, delayMs }) => {
      updateRuntimeEventChannelDiagnostics(RUNTIME_TURN_SSE_CHANNEL_ID, {
        label: "Runtime turn stream (SSE)",
        transport: "sse",
        status: "reconnecting",
        retryAttempt: attempt,
        retryDelayMs: delayMs,
      });
    },
  });

  const handleMessage = (event: MessageEvent) => {
    const parsed = parseRuntimeTurnEventMessage(event.data);
    if (parsed) {
      callback(parsed);
    }
  };

  const handleOpen = () => {
    const now = Date.now();
    if (
      hasOpened &&
      (lastReconnectSignalAt === 0 ||
        now - lastReconnectSignalAt >= WEB_RUNTIME_EVENTS_RECONNECT_SIGNAL_THROTTLE_MS)
    ) {
      lastReconnectSignalAt = now;
      callback({
        kind: "native_state_fabric_updated",
        payload: {
          revision: `stream-reconnect-${now}`,
          scope: [...RUNTIME_RESYNC_SCOPE],
          reason: "stream_reconnected",
        },
        emittedAt: new Date().toISOString(),
      });
    } else {
      hasOpened = true;
    }
    reconnectScheduler.reset();
    updateRuntimeEventChannelDiagnostics(RUNTIME_TURN_SSE_CHANNEL_ID, {
      label: "Runtime turn stream (SSE)",
      transport: "sse",
      status: "open",
      retryAttempt: 0,
      retryDelayMs: null,
      lastError: null,
    });
  };

  const teardownEventSource = () => {
    if (!eventSource) {
      return;
    }
    eventSource.removeEventListener("message", handleMessage);
    eventSource.removeEventListener("open", handleOpen);
    eventSource.removeEventListener("error", handleError);
    eventSource.close();
    eventSource = null;
  };

  const scheduleReconnect = () => {
    if (disposed || reconnectScheduler.hasPendingRetry()) {
      return;
    }
    reconnectScheduler.schedule();
  };

  const handleError = (error?: unknown) => {
    if (disposed) {
      return;
    }
    if (error !== undefined) {
      updateRuntimeEventChannelDiagnostics(RUNTIME_TURN_SSE_CHANNEL_ID, {
        label: "Runtime turn stream (SSE)",
        status: "error",
        lastError: normalizeRuntimeEventChannelError(error),
      });
    }
    if (!eventSource || eventSource.readyState === window.EventSource.CLOSED) {
      teardownEventSource();
      scheduleReconnect();
    }
  };

  const connect = () => {
    if (disposed) {
      return;
    }
    teardownEventSource();
    updateRuntimeEventChannelDiagnostics(RUNTIME_TURN_SSE_CHANNEL_ID, {
      label: "Runtime turn stream (SSE)",
      transport: "sse",
      status: "connecting",
      retryDelayMs: null,
    });
    try {
      eventSource = new window.EventSource(endpoint);
    } catch (error) {
      updateRuntimeEventChannelDiagnostics(RUNTIME_TURN_SSE_CHANNEL_ID, {
        label: "Runtime turn stream (SSE)",
        status: "error",
        lastError: normalizeRuntimeEventChannelError(error),
      });
      scheduleReconnect();
      return;
    }
    eventSource.addEventListener("message", handleMessage);
    eventSource.addEventListener("open", handleOpen);
    eventSource.addEventListener("error", handleError);
  };

  connect();

  return () => {
    disposed = true;
    reconnectScheduler.clear();
    teardownEventSource();
    updateRuntimeEventChannelDiagnostics(RUNTIME_TURN_SSE_CHANNEL_ID, {
      label: "Runtime turn stream (SSE)",
      status: "stopped",
      retryDelayMs: null,
    });
  };
}

function createWebRuntimeTurnWsListener(
  wsEndpoint: string,
  callback: (event: CodeRuntimeHostEventEnvelope) => void,
  fallbackToSse?: () => UnlistenFn | null
): UnlistenFn | null {
  if (typeof WebSocket !== "function") {
    return fallbackToSse?.() ?? null;
  }

  let disposed = false;
  let socket: WebSocket | null = null;
  let hasOpened = false;
  let usingFallback = false;
  let fallbackUnlisten: UnlistenFn | null = null;
  let fallbackProbeTimer: ReturnType<typeof setTimeout> | null = null;
  let lastReconnectSignalAt = 0;
  let lastEventId: number | null = null;
  updateRuntimeEventChannelDiagnostics(RUNTIME_TURN_WS_CHANNEL_ID, {
    label: "Runtime turn stream (WebSocket)",
    transport: "ws",
    status: "connecting",
    retryAttempt: 0,
    retryDelayMs: null,
    lastError: null,
  });

  const reconnectScheduler = createExponentialRetryScheduler({
    baseDelayMs: WEB_RUNTIME_EVENTS_RECONNECT_BASE_MS,
    maxDelayMs: WEB_RUNTIME_EVENTS_RECONNECT_MAX_MS,
    onRetry: () => {
      connect();
    },
    onSchedule: ({ attempt, delayMs }) => {
      updateRuntimeEventChannelDiagnostics(RUNTIME_TURN_WS_CHANNEL_ID, {
        label: "Runtime turn stream (WebSocket)",
        transport: "ws",
        status: "reconnecting",
        retryAttempt: attempt,
        retryDelayMs: delayMs,
      });
    },
  });

  const clearFallbackProbeTimer = () => {
    if (fallbackProbeTimer !== null) {
      clearTimeout(fallbackProbeTimer);
      fallbackProbeTimer = null;
    }
  };

  const emitReconnectSignal = () => {
    const now = Date.now();
    if (
      hasOpened &&
      (lastReconnectSignalAt === 0 ||
        now - lastReconnectSignalAt >= WEB_RUNTIME_EVENTS_RECONNECT_SIGNAL_THROTTLE_MS)
    ) {
      lastReconnectSignalAt = now;
      callback({
        kind: "native_state_fabric_updated",
        payload: {
          revision: `stream-reconnect-${now}`,
          scope: [...RUNTIME_RESYNC_SCOPE],
          reason: "stream_reconnected",
        },
        emittedAt: new Date().toISOString(),
      });
      return;
    }
    hasOpened = true;
  };

  const teardownSocket = () => {
    if (!socket) {
      return;
    }
    socket.onopen = null;
    socket.onmessage = null;
    socket.onerror = null;
    socket.onclose = null;
    try {
      socket.close();
    } catch {
      // Ignore close failures while tearing down.
    }
    socket = null;
  };

  const activateFallback = () => {
    if (disposed || usingFallback) {
      return;
    }
    usingFallback = true;
    reconnectScheduler.clear();
    teardownSocket();
    fallbackUnlisten = fallbackToSse?.() ?? null;
    if (!fallbackUnlisten) {
      usingFallback = false;
      scheduleReconnect();
      return;
    }
    updateRuntimeEventChannelDiagnostics(RUNTIME_TURN_WS_CHANNEL_ID, {
      label: "Runtime turn stream (WebSocket)",
      transport: "sse",
      status: "fallback",
      retryDelayMs: WEB_RUNTIME_WS_FALLBACK_PROBE_MS,
    });
    scheduleFallbackProbe();
  };

  const scheduleFallbackProbe = () => {
    if (disposed || !usingFallback || fallbackProbeTimer !== null) {
      return;
    }
    fallbackProbeTimer = setTimeout(() => {
      fallbackProbeTimer = null;
      if (disposed || !usingFallback) {
        return;
      }
      if (fallbackUnlisten) {
        fallbackUnlisten();
        fallbackUnlisten = null;
      }
      usingFallback = false;
      reconnectScheduler.reset();
      updateRuntimeEventChannelDiagnostics(RUNTIME_TURN_WS_CHANNEL_ID, {
        label: "Runtime turn stream (WebSocket)",
        transport: "ws",
        status: "connecting",
        retryDelayMs: null,
      });
      connect();
    }, WEB_RUNTIME_WS_FALLBACK_PROBE_MS);
  };

  const scheduleReconnect = () => {
    if (disposed || usingFallback || reconnectScheduler.hasPendingRetry()) {
      return;
    }
    reconnectScheduler.schedule();
  };

  const handleMessage = (event: MessageEvent) => {
    const eventId = parseRuntimeTurnWsEventId(event.data);
    if (eventId !== null) {
      lastEventId = eventId;
    }
    const parsed = parseRuntimeTurnEventMessage(event.data);
    if (parsed) {
      callback(parsed);
    }
  };

  const handleOpen = () => {
    emitReconnectSignal();
    reconnectScheduler.reset();
    updateRuntimeEventChannelDiagnostics(RUNTIME_TURN_WS_CHANNEL_ID, {
      label: "Runtime turn stream (WebSocket)",
      transport: "ws",
      status: "open",
      retryAttempt: 0,
      retryDelayMs: null,
      lastError: null,
    });
  };

  const handleFailure = () => {
    if (disposed || usingFallback) {
      return;
    }
    if (!hasOpened && fallbackToSse) {
      activateFallback();
      return;
    }
    scheduleReconnect();
  };

  const handleClose = () => {
    teardownSocket();
    handleFailure();
  };

  const handleError = () => {
    teardownSocket();
    updateRuntimeEventChannelDiagnostics(RUNTIME_TURN_WS_CHANNEL_ID, {
      label: "Runtime turn stream (WebSocket)",
      status: "error",
      lastError: "socket error",
    });
    handleFailure();
  };

  const connect = () => {
    if (disposed || usingFallback) {
      return;
    }
    teardownSocket();
    updateRuntimeEventChannelDiagnostics(RUNTIME_TURN_WS_CHANNEL_ID, {
      label: "Runtime turn stream (WebSocket)",
      transport: "ws",
      status: "connecting",
      retryDelayMs: null,
    });
    const endpointWithReplay = withLastEventIdQuery(wsEndpoint, lastEventId);
    try {
      socket = new WebSocket(endpointWithReplay);
    } catch (error) {
      updateRuntimeEventChannelDiagnostics(RUNTIME_TURN_WS_CHANNEL_ID, {
        label: "Runtime turn stream (WebSocket)",
        status: "error",
        lastError: normalizeRuntimeEventChannelError(error),
      });
      handleFailure();
      return;
    }
    socket.onopen = handleOpen;
    socket.onmessage = handleMessage;
    socket.onerror = handleError;
    socket.onclose = handleClose;
  };

  connect();

  return () => {
    disposed = true;
    reconnectScheduler.clear();
    clearFallbackProbeTimer();
    teardownSocket();
    if (fallbackUnlisten) {
      fallbackUnlisten();
      fallbackUnlisten = null;
    }
    updateRuntimeEventChannelDiagnostics(RUNTIME_TURN_WS_CHANNEL_ID, {
      label: "Runtime turn stream (WebSocket)",
      status: "stopped",
      retryDelayMs: null,
    });
  };
}

function toRuntimeTurnAttachments(images: string[] | null | undefined) {
  if (!images || images.length === 0) {
    return [];
  }
  return images.map((path, index) => ({
    id: `${index + 1}`,
    name: getPathBasename(path),
    mimeType: "application/octet-stream",
    size: 0,
  }));
}

function buildRuntimeTurnRequestId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return `turn-${globalThis.crypto.randomUUID()}`;
  }
  return `turn-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export type {
  DistributedTaskGraphInput,
  RuntimeAccessMode,
  RuntimeThreadSummary,
  RuntimeTurnAck,
  RuntimeWorkspaceFileContent,
  RuntimeWorkspaceFileSummary,
};

export {
  buildLocalUsageSnapshotFromCliSessions,
  buildRuntimeTurnRequestId,
  clearRuntimeTerminalSessionId,
  createWebRuntimeTurnEventListener,
  createWebRuntimeTurnWsListener,
  getRuntimeTerminalSessionId,
  logRuntimeWarning,
  normalizeRuntimeBackendSetStateRequest,
  normalizeRuntimeReasonEffort,
  requireRuntimeTerminalSessionId,
  runtimeWorkspaceFileIdsByPath,
  setRuntimeTerminalSessionId,
  toRuntimeAccessMode,
  toRuntimeThreadRecord,
  toRuntimeTurnAttachments,
};
