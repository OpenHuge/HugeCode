import type { AppServerEvent } from "../types";
import { isDesktopHostRuntime } from "../application/runtime/ports/desktopHostCore";
import { normalizeAppServerPayload } from "./eventsRuntimePayloadAdapter";
import {
  createEventIdDeduper,
  parseWebRuntimeWsEventId,
  parseWebRuntimeWsEventIdentifier,
  resolveWebTransportEndpointHints,
  safeParseJson,
  withLastEventIdQuery,
} from "./eventsWebTransportHelpers";
import { logger } from "./logger";
import { createExponentialRetryScheduler } from "./retryScheduler";
import { recordRuntimeEventDedupeHit } from "@ku0/code-runtime-client/runtimeEventStabilityMetrics";
import {
  APP_SERVER_BRIDGE_CHANNEL_ID,
  APP_SERVER_WS_CHANNEL_ID,
  createCompositeUnsubscribe,
  createRuntimeReconnectSignalEvent,
  registerRuntimeEventDesktopHostSubscription,
  RUNTIME_HOST_EVENT_NAME,
  subscribeWebRuntimeSseEventsShared,
  WEB_RUNTIME_EVENTS_RECONNECT_BASE_MS,
  WEB_RUNTIME_EVENTS_RECONNECT_MAX_MS,
  WEB_RUNTIME_EVENTS_RECONNECT_SIGNAL_THROTTLE_MS,
  WEB_RUNTIME_WS_FALLBACK_PROBE_MS,
  type Listener,
  type RuntimeEventReplayCursor,
  type Unsubscribe,
} from "./runtimeEventBridgeTransportShared";
import { createRuntimeEventStateMachine } from "@ku0/code-runtime-client/runtimeEventStateMachine";
import type {
  AgentEnvelopeAck,
  AgentEnvelopeFailure,
  AgentEnvelopeMetadata,
  AgentEnvelopeQueueReference,
  AgentEnvelopeRoute,
} from "@ku0/code-runtime-client/runtimeMessageEnvelope";

type RuntimeEventBridgeOptions = {
  onError?: (error: unknown) => void;
};

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readAgentEnvelopeString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readAgentEnvelopeBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value !== 0;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "y"].includes(normalized)) {
      return true;
    }
    if (["false", "0", "no", "n"].includes(normalized)) {
      return false;
    }
  }
  return null;
}

function readAgentEnvelopeRoute(value: unknown): AgentEnvelopeRoute | null {
  const record = isRecord(value) ? value : null;
  if (!record) {
    return null;
  }
  const source = readAgentEnvelopeString(record.sourceAgentId ?? record.source);
  const target = readAgentEnvelopeString(
    record.targetAgentId ?? record.target ?? record.destination
  );
  const channel = readAgentEnvelopeString(record.channelId ?? record.channel);
  if (!source || !target || !channel) {
    return null;
  }
  return {
    sourceAgentId: source,
    targetAgentId: target,
    channelId: channel,
  };
}

function readAgentEnvelopeQueue(value: unknown): AgentEnvelopeQueueReference | undefined {
  const record = isRecord(value) ? value : null;
  if (!record) {
    return undefined;
  }
  const queueId = readAgentEnvelopeString(record.queueId ?? record.id ?? record.channelId) ?? null;
  if (!queueId) {
    return undefined;
  }
  const priority = typeof record.priority === "number" ? record.priority : undefined;
  return {
    queueId,
    priority,
  };
}

function readAgentEnvelopeAck(value: unknown): AgentEnvelopeAck | undefined {
  const record = isRecord(value) ? value : null;
  if (!record) {
    return undefined;
  }
  const ackId = readAgentEnvelopeString(record.ackId ?? record.id);
  if (!ackId) {
    return undefined;
  }
  const required = typeof record.required === "boolean" ? record.required : false;
  const success = readAgentEnvelopeBoolean(record.success ?? record.succeeded);
  const error = readAgentEnvelopeString(record.error ?? record.message);
  return {
    ackId,
    required,
    success: success ?? undefined,
    error: error ?? undefined,
  };
}

function readAgentEnvelopeFailure(value: unknown): AgentEnvelopeFailure | undefined {
  const record = isRecord(value) ? value : null;
  if (!record) {
    return undefined;
  }
  const code = readAgentEnvelopeString(record.code);
  const message = readAgentEnvelopeString(record.message);
  if (!code && !message) {
    return undefined;
  }
  return {
    code: code ?? undefined,
    message: message ?? undefined,
  };
}

function readAgentEnvelopeMetadataFromEvent(event: AppServerEvent): AgentEnvelopeMetadata | null {
  if (!event || !isRecord(event.message)) {
    return null;
  }
  const message = event.message as UnknownRecord;
  const params = isRecord(message.params) ? message.params : null;
  const paramsMetadata = params && isRecord(params.metadata) ? params.metadata : null;
  const candidateEnvelope =
    (params && (params.envelope ?? paramsMetadata?.envelope ?? params.agentEnvelope)) ??
    (isRecord(message.envelope) ? message.envelope : null);
  if (!candidateEnvelope || !isRecord(candidateEnvelope)) {
    return null;
  }
  const route = readAgentEnvelopeRoute(
    candidateEnvelope.route ?? candidateEnvelope.routing ?? null
  );
  if (!route) {
    return null;
  }
  const eventType =
    readAgentEnvelopeString(candidateEnvelope.eventType ?? candidateEnvelope.type) ??
    readAgentEnvelopeString(message.method);
  if (!eventType) {
    return null;
  }
  return {
    route,
    eventType,
    queue: readAgentEnvelopeQueue(candidateEnvelope.queue ?? candidateEnvelope.channel),
    ack: readAgentEnvelopeAck(candidateEnvelope.ack ?? candidateEnvelope.acknowledgement),
    failure: readAgentEnvelopeFailure(candidateEnvelope.failure ?? candidateEnvelope.error),
    payload: isRecord(candidateEnvelope.payload) ? candidateEnvelope.payload : undefined,
  };
}

function isDesktopHostRuntimeRuntime(): boolean {
  try {
    return isDesktopHostRuntime();
  } catch {
    return false;
  }
}

function notifySubscriptionError(
  options: RuntimeEventBridgeOptions | undefined,
  error: unknown
): void {
  try {
    options?.onError?.(error);
  } catch (callbackError) {
    logger.error("[events-v2] onError handler failed", callbackError);
  }
}

async function registerDesktopHostSubscription(
  eventName: string,
  onPayload: (payload: unknown) => void,
  options?: RuntimeEventBridgeOptions
): Promise<Unsubscribe | null> {
  return registerRuntimeEventDesktopHostSubscription(eventName, onPayload, (error) => {
    notifySubscriptionError(options, error);
  });
}

function subscribeWebRuntimeSseEventsV2(
  endpoint: string,
  onEvent: Listener<AppServerEvent>,
  options?: RuntimeEventBridgeOptions,
  replayCursor?: RuntimeEventReplayCursor
): Unsubscribe | null {
  let reported = false;
  return subscribeWebRuntimeSseEventsShared(
    endpoint,
    onEvent,
    (error) => {
      if (reported) {
        return;
      }
      reported = true;
      notifySubscriptionError(options, error);
    },
    replayCursor
  );
}

function subscribeWebRuntimeWsEventsV2(
  wsEndpoint: string,
  onEvent: Listener<AppServerEvent>,
  options?: RuntimeEventBridgeOptions,
  fallbackToSse?: (replayCursor: RuntimeEventReplayCursor) => Unsubscribe | null
): Unsubscribe | null {
  if (typeof WebSocket !== "function") {
    return null;
  }

  const wsState = createRuntimeEventStateMachine({
    id: APP_SERVER_WS_CHANNEL_ID,
    label: "App server stream",
    defaultTransport: "ws",
  });

  type AgentEnvelopeQueueEntry = {
    envelopeId: string;
    metadata: AgentEnvelopeMetadata;
    queuedAt: number;
  };

  const agentEnvelopeQueues = new Map<string, AgentEnvelopeQueueEntry[]>();
  const agentEnvelopeByAckId = new Map<string, AgentEnvelopeQueueEntry>();

  function enqueueAgentEnvelope(metadata: AgentEnvelopeMetadata): AgentEnvelopeQueueEntry {
    const envelopeId = metadata.ack?.ackId ?? `${metadata.route.channelId}:${Date.now()}`;
    const entry: AgentEnvelopeQueueEntry = {
      envelopeId,
      metadata,
      queuedAt: Date.now(),
    };
    const queueKey = metadata.queue?.queueId ?? metadata.route.channelId;
    const queue = agentEnvelopeQueues.get(queueKey) ?? [];
    queue.push(entry);
    agentEnvelopeQueues.set(queueKey, queue);
    agentEnvelopeByAckId.set(entry.envelopeId, entry);
    return entry;
  }

  function releaseAgentEnvelope(entry: AgentEnvelopeQueueEntry): void {
    const queueKey = entry.metadata.queue?.queueId ?? entry.metadata.route.channelId;
    const queue = agentEnvelopeQueues.get(queueKey);
    if (queue) {
      const index = queue.findIndex((candidate) => candidate.envelopeId === entry.envelopeId);
      if (index >= 0) {
        queue.splice(index, 1);
        if (queue.length === 0) {
          agentEnvelopeQueues.delete(queueKey);
        } else {
          agentEnvelopeQueues.set(queueKey, queue);
        }
      }
    }
    agentEnvelopeByAckId.delete(entry.envelopeId);
  }

  function resolveAgentEnvelope(args: {
    ackId?: string;
    entry?: AgentEnvelopeQueueEntry;
    success: boolean;
    error?: string | null;
  }): void {
    const entry = args.entry ?? (args.ackId ? agentEnvelopeByAckId.get(args.ackId) : undefined);
    if (!entry) {
      return;
    }
    releaseAgentEnvelope(entry);
    const metadata: AgentEnvelopeMetadata = {
      ...entry.metadata,
      eventType: args.success ? "agent.ack" : "agent.failure",
      failure: args.success
        ? undefined
        : {
            message: args.error ?? entry.metadata.failure?.message ?? undefined,
            code: entry.metadata.failure?.code,
          },
    };
    wsState.recordAgentEnvelopeEvent(metadata);
  }

  function handleAgentEnvelopeEvent(event: AppServerEvent): void {
    const metadata = readAgentEnvelopeMetadataFromEvent(event);
    if (!metadata) {
      return;
    }
    const entry = enqueueAgentEnvelope(metadata);
    wsState.recordAgentEnvelopeEvent(metadata);
    if (metadata.ack?.success !== undefined) {
      resolveAgentEnvelope({
        ackId: metadata.ack.ackId,
        entry,
        success: metadata.ack.success,
        error: metadata.ack.error ?? null,
      });
    } else if (metadata.failure) {
      resolveAgentEnvelope({
        entry,
        success: false,
        error: metadata.failure.message ?? metadata.failure.code ?? null,
      });
    }
  }

  let disposed = false;
  const replayCursor: RuntimeEventReplayCursor = { lastEventId: null };
  let socket: WebSocket | null = null;
  let hasOpened = false;
  let usingFallback = false;
  let lastEventId: number | null = null;
  let lastReconnectSignalAt = 0;
  let errorReported = false;
  let fallbackUnsubscribe: Unsubscribe | null = null;
  let fallbackProbeTimer: ReturnType<typeof setTimeout> | null = null;
  const dedupe = createEventIdDeduper();

  const trackReplayEventId = (eventId: number | null) => {
    if (eventId !== null && (lastEventId === null || eventId > lastEventId)) {
      lastEventId = eventId;
    }
  };

  wsState.transition("connecting", {
    reason: "initial-connect",
    transport: "ws",
    retryAttempt: 0,
    retryDelayMs: null,
    consecutiveFailures: 0,
  });

  const reconnectScheduler = createExponentialRetryScheduler({
    baseDelayMs: WEB_RUNTIME_EVENTS_RECONNECT_BASE_MS,
    maxDelayMs: WEB_RUNTIME_EVENTS_RECONNECT_MAX_MS,
    onRetry: () => {
      connect();
    },
    onSchedule: ({ attempt, delayMs }) => {
      wsState.transition("reconnecting", {
        reason: "websocket-reconnect-scheduled",
        transport: "ws",
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

  const reportError = (error: unknown) => {
    if (errorReported) {
      return;
    }
    errorReported = true;
    wsState.setError(error, "websocket-stream-error");
    notifySubscriptionError(options, error);
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
      void 0;
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
    fallbackUnsubscribe = fallbackToSse?.(replayCursor) ?? null;
    if (!fallbackUnsubscribe) {
      usingFallback = false;
      scheduleReconnect();
      return;
    }
    wsState.transition("fallback", {
      reason: "websocket-fallback-sse",
      transport: "sse",
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
      if (fallbackUnsubscribe) {
        fallbackUnsubscribe();
        fallbackUnsubscribe = null;
      }
      usingFallback = false;
      reconnectScheduler.reset();
      errorReported = false;
      wsState.transition("connecting", {
        reason: "fallback-probe",
        transport: "ws",
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

  const handleFailure = (error?: unknown) => {
    if (error !== undefined) {
      reportError(error);
    }
    teardownSocket();
    if (disposed || usingFallback) {
      return;
    }
    if (!hasOpened && fallbackToSse) {
      activateFallback();
      return;
    }
    scheduleReconnect();
  };

  const emitReconnectSignal = () => {
    const now = Date.now();
    if (
      hasOpened &&
      (lastReconnectSignalAt === 0 ||
        now - lastReconnectSignalAt >= WEB_RUNTIME_EVENTS_RECONNECT_SIGNAL_THROTTLE_MS)
    ) {
      lastReconnectSignalAt = now;
      onEvent(createRuntimeReconnectSignalEvent(now));
      return;
    }
    hasOpened = true;
  };

  const connect = () => {
    if (disposed || usingFallback) {
      return;
    }
    wsState.transition("connecting", {
      reason: "websocket-connect",
      transport: "ws",
      retryDelayMs: null,
    });

    trackReplayEventId(replayCursor.lastEventId);
    const endpointWithReplay = withLastEventIdQuery(wsEndpoint, lastEventId);
    try {
      socket = new WebSocket(endpointWithReplay);
    } catch (error) {
      reportError(error);
      if (!hasOpened && fallbackToSse) {
        activateFallback();
        return;
      }
      scheduleReconnect();
      return;
    }

    socket.onopen = () => {
      emitReconnectSignal();
      reconnectScheduler.reset();
      errorReported = false;
      wsState.transition("open", {
        reason: "websocket-open",
        transport: "ws",
        retryAttempt: 0,
        retryDelayMs: null,
        consecutiveFailures: 0,
      });
    };
    socket.onmessage = (messageEvent) => {
      const parsedPayload =
        typeof messageEvent.data === "string"
          ? safeParseJson(messageEvent.data)
          : (messageEvent.data as unknown);
      if (!parsedPayload) {
        return;
      }
      const eventId = parseWebRuntimeWsEventId(parsedPayload);
      if (eventId !== null) {
        lastEventId = eventId;
        replayCursor.lastEventId = eventId;
      }
      const eventIdentifier = parseWebRuntimeWsEventIdentifier(parsedPayload);
      if (dedupe.isDuplicate(eventIdentifier)) {
        recordRuntimeEventDedupeHit();
        return;
      }
      const normalized = normalizeAppServerPayload(parsedPayload);
      if (normalized) {
        handleAgentEnvelopeEvent(normalized);
        onEvent(normalized);
      }
    };
    socket.onerror = (error) => {
      handleFailure(error);
    };
    socket.onclose = () => {
      handleFailure();
    };
  };

  connect();

  return () => {
    disposed = true;
    reconnectScheduler.clear();
    clearFallbackProbeTimer();
    teardownSocket();
    if (fallbackUnsubscribe) {
      fallbackUnsubscribe();
      fallbackUnsubscribe = null;
    }
    wsState.transition("stopped", {
      reason: "disposed",
      retryDelayMs: null,
    });
  };
}

async function subscribeWebRuntimeEventsV2(
  onEvent: Listener<AppServerEvent>,
  options?: RuntimeEventBridgeOptions
): Promise<Unsubscribe | null> {
  const hints = await resolveWebTransportEndpointHints();
  const fallbackToSse = (replayCursor?: RuntimeEventReplayCursor) =>
    hints.eventsEndpoint
      ? subscribeWebRuntimeSseEventsV2(hints.eventsEndpoint, onEvent, options, replayCursor)
      : null;

  if (hints.wsEndpoint) {
    const wsUnsubscribe = subscribeWebRuntimeWsEventsV2(
      hints.wsEndpoint,
      onEvent,
      options,
      fallbackToSse
    );
    if (wsUnsubscribe) {
      return wsUnsubscribe;
    }
  }

  return fallbackToSse({ lastEventId: null });
}

export async function startAppServerBridgeV2(
  onEvent: Listener<AppServerEvent>,
  options?: RuntimeEventBridgeOptions
): Promise<Unsubscribe> {
  const bridgeState = createRuntimeEventStateMachine({
    id: APP_SERVER_BRIDGE_CHANNEL_ID,
    label: "App server bridge",
    defaultTransport: isDesktopHostRuntimeRuntime() ? "electron-bridge" : "bridge",
  });

  bridgeState.transition("connecting", {
    reason: "bridge-start",
    retryDelayMs: null,
  });

  const unsubscribers: Unsubscribe[] = [];
  try {
    if (isDesktopHostRuntimeRuntime()) {
      const runtimeUnsubscribe = await registerDesktopHostSubscription(
        RUNTIME_HOST_EVENT_NAME,
        (payload) => {
          const normalized = normalizeAppServerPayload(payload);
          if (normalized) {
            onEvent(normalized);
          }
        },
        options
      );
      if (runtimeUnsubscribe) {
        unsubscribers.push(runtimeUnsubscribe);
        bridgeState.transition("open", {
          reason: "electron-bridge-listener-open",
          transport: "electron-bridge",
          retryAttempt: 0,
          retryDelayMs: null,
          consecutiveFailures: 0,
        });
        return () => {
          createCompositeUnsubscribe(unsubscribers)();
          bridgeState.transition("stopped", { reason: "disposed", retryDelayMs: null });
        };
      }
    }

    const webUnsubscribe = await subscribeWebRuntimeEventsV2(onEvent, options);
    if (webUnsubscribe) {
      unsubscribers.push(webUnsubscribe);
    }
    bridgeState.transition("open", {
      reason: "web-listener-open",
      transport: "bridge",
      retryAttempt: 0,
      retryDelayMs: null,
      consecutiveFailures: 0,
    });
  } catch (error) {
    bridgeState.setError(error, "bridge-start-failed");
    notifySubscriptionError(options, error);
    throw error;
  }

  return () => {
    createCompositeUnsubscribe(unsubscribers)();
    bridgeState.transition("stopped", { reason: "disposed", retryDelayMs: null });
  };
}
