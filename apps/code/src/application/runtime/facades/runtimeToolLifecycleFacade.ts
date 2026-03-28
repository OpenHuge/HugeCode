import type { AppServerEvent } from "../../../types";
import {
  getAppServerParams,
  getAppServerRawMethod,
  getAppServerRequestId,
} from "../../../utils/appServerEvents";
import { logger } from "../logger";
import type { Unsubscribe } from "../ports/events";
import { subscribeAppServerEvents } from "../ports/events";
import type { RuntimeToolExecutionTelemetryEvent } from "../ports/runtimeToolExecutionTelemetry";
import { subscribeRuntimeToolExecutionTelemetryEvents } from "../ports/runtimeToolExecutionTelemetry";
export {
  buildRuntimeToolLifecyclePresentationSummary,
  describeRuntimeToolLifecycleEvent,
  describeRuntimeToolLifecycleHookCheckpoint,
  formatRuntimeToolLifecycleStatusLabel,
  formatRuntimeToolLifecycleEventKey,
  formatRuntimeToolLifecycleHookCheckpointKey,
  getRuntimeToolLifecycleEventTone,
  getRuntimeToolLifecycleHookCheckpointTone,
  sortRuntimeToolLifecycleEventsByRecency,
  sortRuntimeToolLifecycleHookCheckpointsByRecency,
  type RuntimeToolLifecyclePresentationSummary,
  type RuntimeToolLifecyclePresentationTone,
} from "./runtimeToolLifecyclePresentation";
import type {
  RuntimeToolLifecycleAppEventMethod,
  RuntimeToolLifecycleEvent,
  RuntimeToolLifecycleHookCheckpoint,
  RuntimeToolLifecycleSnapshot,
} from "../types/runtimeToolLifecycle";
import {
  RUNTIME_TOOL_LIFECYCLE_APP_EVENT_METHODS,
  buildRuntimeToolLifecycleEventId,
  deriveRuntimeToolLifecycleHookCheckpoint,
  filterRuntimeToolLifecycleSnapshot,
  getRuntimeToolLifecycleEntityKey,
  isRuntimeGuardrailLifecycleStatus,
  normalizeRuntimeToolLifecycleAppEvent,
  normalizeRuntimeToolLifecycleStatus,
  shouldAcceptRuntimeToolLifecycleTransition,
} from "../types/runtimeToolLifecycle";

const RUNTIME_TOOL_LIFECYCLE_RECENT_LIMIT = 40;
const ALL_WORKSPACE_RUNTIME_TOOL_LIFECYCLE_LISTENER_KEY = "__all__";

type RuntimeToolLifecycleEventListener = (event: RuntimeToolLifecycleEvent) => void;
type RuntimeToolLifecycleSnapshotListener = () => void;

type AppServerEventSubscriber = (listener: (event: AppServerEvent) => void) => Unsubscribe;
type TelemetryEventSubscriber = (
  listener: (event: RuntimeToolExecutionTelemetryEvent) => void
) => Unsubscribe;

function normalizeRuntimeToolLifecycleTelemetryEvent(
  event: RuntimeToolExecutionTelemetryEvent
): RuntimeToolLifecycleEvent | null {
  const correlationKey =
    ("requestId" in event &&
    typeof event.requestId === "string" &&
    event.requestId.trim().length > 0
      ? event.requestId.trim()
      : null) ??
    ("plannerStepKey" in event &&
    typeof event.plannerStepKey === "string" &&
    event.plannerStepKey.trim().length > 0
      ? event.plannerStepKey.trim()
      : null) ??
    ("spanId" in event && typeof event.spanId === "string" && event.spanId.trim().length > 0
      ? event.spanId.trim()
      : null) ??
    ("traceId" in event && typeof event.traceId === "string" && event.traceId.trim().length > 0
      ? event.traceId.trim()
      : null);
  if (event.kind === "execution") {
    const status =
      event.phase === "attempted"
        ? "pending"
        : event.phase === "started"
          ? "in_progress"
          : normalizeRuntimeToolLifecycleStatus(event.status);
    return {
      id: buildRuntimeToolLifecycleEventId(
        "tool",
        event.phase,
        "telemetry",
        event.at,
        correlationKey ?? `${event.toolName}:${event.at}`
      ),
      correlationKey,
      kind: "tool",
      phase: event.phase,
      source: "telemetry",
      workspaceId: event.workspaceId ?? null,
      threadId: null,
      turnId: null,
      toolCallId: null,
      toolName: event.toolName,
      scope: event.scope,
      status,
      at: event.at,
      errorCode: event.errorCode ?? null,
    };
  }
  if (event.kind === "guardrail_evaluated") {
    return {
      id: buildRuntimeToolLifecycleEventId(
        "guardrail",
        "evaluated",
        "telemetry",
        event.at,
        correlationKey ?? `${event.toolName}:${event.at}`
      ),
      correlationKey,
      kind: "guardrail",
      phase: "evaluated",
      source: "telemetry",
      workspaceId: event.workspaceId ?? null,
      threadId: null,
      turnId: null,
      toolCallId: null,
      toolName: event.toolName,
      scope: event.scope,
      status: event.status,
      at: event.at,
      errorCode: event.errorCode ?? null,
      guardrailDecision: event.result.allowed ? "allowed" : "blocked",
    };
  }
  if (event.kind === "guardrail_outcome") {
    const status = normalizeRuntimeToolLifecycleStatus(event.status);
    if (!isRuntimeGuardrailLifecycleStatus(status)) {
      return null;
    }
    return {
      id: buildRuntimeToolLifecycleEventId(
        "guardrail",
        "outcome",
        "telemetry",
        event.at,
        correlationKey ?? `${event.toolName}:${event.at}`
      ),
      correlationKey,
      kind: "guardrail",
      phase: "outcome",
      source: "telemetry",
      workspaceId: event.workspaceId ?? null,
      threadId: null,
      turnId: null,
      toolCallId: null,
      toolName: event.toolName,
      scope: event.scope,
      status,
      at: event.at,
      errorCode: event.errorCode ?? null,
      guardrailDecision: status === "blocked" ? "blocked" : null,
    };
  }
  return null;
}

function notifyLifecycleEventListener(
  listener: RuntimeToolLifecycleEventListener,
  event: RuntimeToolLifecycleEvent
): void {
  try {
    listener(event);
  } catch (error) {
    logger.error("[runtime][tool-lifecycle] event listener failed", error);
  }
}

function notifyLifecycleSnapshotListener(listener: RuntimeToolLifecycleSnapshotListener): void {
  try {
    listener();
  } catch (error) {
    logger.error("[runtime][tool-lifecycle] snapshot listener failed", error);
  }
}

export function createRuntimeToolLifecycleStore(
  subscribeToAppServerEvents: AppServerEventSubscriber,
  subscribeToTelemetryEvents: TelemetryEventSubscriber
) {
  const eventListeners = new Set<RuntimeToolLifecycleEventListener>();
  const workspaceEventListeners = new Map<string, Set<RuntimeToolLifecycleEventListener>>();
  const snapshotListeners = new Set<RuntimeToolLifecycleSnapshotListener>();
  const workspaceSnapshotListeners = new Map<string, Set<RuntimeToolLifecycleSnapshotListener>>();
  let appServerUnsubscribe: Unsubscribe | null = null;
  let telemetryUnsubscribe: Unsubscribe | null = null;
  let snapshot: RuntimeToolLifecycleSnapshot = {
    revision: 0,
    lastEvent: null,
    recentEvents: [],
    lastHookCheckpoint: null,
    recentHookCheckpoints: [],
  };
  const latestEventByEntityKey = new Map<string, RuntimeToolLifecycleEvent>();

  function updateHookCheckpoint(
    checkpoint: RuntimeToolLifecycleHookCheckpoint | null
  ): Pick<RuntimeToolLifecycleSnapshot, "lastHookCheckpoint" | "recentHookCheckpoints"> {
    if (!checkpoint) {
      return {
        lastHookCheckpoint: snapshot.lastHookCheckpoint ?? null,
        recentHookCheckpoints: snapshot.recentHookCheckpoints ?? [],
      };
    }

    return {
      lastHookCheckpoint: checkpoint,
      recentHookCheckpoints: [...(snapshot.recentHookCheckpoints ?? []), checkpoint].slice(
        -RUNTIME_TOOL_LIFECYCLE_RECENT_LIMIT
      ),
    };
  }

  function publish(event: RuntimeToolLifecycleEvent): void {
    const entityKey = getRuntimeToolLifecycleEntityKey(event);
    const previousEvent = latestEventByEntityKey.get(entityKey);
    if (previousEvent && !shouldAcceptRuntimeToolLifecycleTransition(previousEvent, event)) {
      return;
    }
    latestEventByEntityKey.set(entityKey, event);
    const hookCheckpoint = deriveRuntimeToolLifecycleHookCheckpoint(event);
    snapshot = {
      revision: snapshot.revision + 1,
      lastEvent: event,
      recentEvents: [...snapshot.recentEvents, event].slice(-RUNTIME_TOOL_LIFECYCLE_RECENT_LIMIT),
      ...updateHookCheckpoint(hookCheckpoint),
    };

    for (const listener of eventListeners) {
      notifyLifecycleEventListener(listener, event);
    }
    const workspaceListenerKeys = [ALL_WORKSPACE_RUNTIME_TOOL_LIFECYCLE_LISTENER_KEY];
    if (event.workspaceId) {
      workspaceListenerKeys.push(event.workspaceId);
    }
    for (const listenerKey of workspaceListenerKeys) {
      const listeners = workspaceEventListeners.get(listenerKey);
      if (!listeners) {
        continue;
      }
      for (const listener of listeners) {
        notifyLifecycleEventListener(listener, event);
      }
    }
    for (const listener of snapshotListeners) {
      notifyLifecycleSnapshotListener(listener);
    }
    for (const listenerKey of workspaceListenerKeys) {
      const listeners = workspaceSnapshotListeners.get(listenerKey);
      if (!listeners) {
        continue;
      }
      for (const listener of listeners) {
        notifyLifecycleSnapshotListener(listener);
      }
    }
  }

  function getWorkspaceListenerKey(workspaceId: string | null): string {
    return workspaceId ?? ALL_WORKSPACE_RUNTIME_TOOL_LIFECYCLE_LISTENER_KEY;
  }

  function getWorkspaceSnapshotListenerCount(): number {
    let listenerCount = 0;
    for (const listeners of workspaceSnapshotListeners.values()) {
      listenerCount += listeners.size;
    }
    return listenerCount;
  }

  function getWorkspaceEventListenerCount(): number {
    let listenerCount = 0;
    for (const listeners of workspaceEventListeners.values()) {
      listenerCount += listeners.size;
    }
    return listenerCount;
  }

  function ensureSubscriptions(): void {
    if (
      appServerUnsubscribe ||
      telemetryUnsubscribe ||
      eventListeners.size +
        snapshotListeners.size +
        getWorkspaceEventListenerCount() +
        getWorkspaceSnapshotListenerCount() ===
        0
    ) {
      return;
    }

    appServerUnsubscribe = subscribeToAppServerEvents((event) => {
      const method = getAppServerRawMethod(event);
      if (
        !method ||
        !RUNTIME_TOOL_LIFECYCLE_APP_EVENT_METHODS.includes(
          method as RuntimeToolLifecycleAppEventMethod
        )
      ) {
        return;
      }
      const normalized = normalizeRuntimeToolLifecycleAppEvent({
        workspaceId: event.workspace_id,
        requestId: getAppServerRequestId(event),
        method: method as RuntimeToolLifecycleAppEventMethod,
        params: getAppServerParams(event),
        receivedAt: Date.now(),
      });
      if (normalized) {
        publish(normalized);
      }
    });

    telemetryUnsubscribe = subscribeToTelemetryEvents((event) => {
      const normalized = normalizeRuntimeToolLifecycleTelemetryEvent(event);
      if (normalized) {
        publish(normalized);
      }
    });
  }

  function maybeStopSubscriptions(): void {
    if (
      eventListeners.size +
        snapshotListeners.size +
        getWorkspaceEventListenerCount() +
        getWorkspaceSnapshotListenerCount() >
      0
    ) {
      return;
    }
    if (appServerUnsubscribe) {
      appServerUnsubscribe();
      appServerUnsubscribe = null;
    }
    if (telemetryUnsubscribe) {
      telemetryUnsubscribe();
      telemetryUnsubscribe = null;
    }
  }

  function subscribeRuntimeToolLifecycleEvents(
    listener: RuntimeToolLifecycleEventListener
  ): Unsubscribe {
    eventListeners.add(listener);
    ensureSubscriptions();
    return () => {
      eventListeners.delete(listener);
      maybeStopSubscriptions();
    };
  }

  function subscribeWorkspaceRuntimeToolLifecycleEvents(
    workspaceId: string | null,
    listener: RuntimeToolLifecycleEventListener
  ): Unsubscribe {
    const listenerKey = getWorkspaceListenerKey(workspaceId);
    const listeners = workspaceEventListeners.get(listenerKey) ?? new Set();
    listeners.add(listener);
    workspaceEventListeners.set(listenerKey, listeners);
    ensureSubscriptions();
    return () => {
      const currentListeners = workspaceEventListeners.get(listenerKey);
      if (!currentListeners) {
        return;
      }
      currentListeners.delete(listener);
      if (currentListeners.size === 0) {
        workspaceEventListeners.delete(listenerKey);
      }
      maybeStopSubscriptions();
    };
  }

  function subscribeRuntimeToolLifecycleSnapshot(
    listener: RuntimeToolLifecycleSnapshotListener
  ): Unsubscribe {
    snapshotListeners.add(listener);
    ensureSubscriptions();
    return () => {
      snapshotListeners.delete(listener);
      maybeStopSubscriptions();
    };
  }

  function subscribeWorkspaceRuntimeToolLifecycleSnapshot(
    workspaceId: string | null,
    listener: RuntimeToolLifecycleSnapshotListener
  ): Unsubscribe {
    const listenerKey = getWorkspaceListenerKey(workspaceId);
    const listeners = workspaceSnapshotListeners.get(listenerKey) ?? new Set();
    listeners.add(listener);
    workspaceSnapshotListeners.set(listenerKey, listeners);
    ensureSubscriptions();
    return () => {
      const currentListeners = workspaceSnapshotListeners.get(listenerKey);
      if (!currentListeners) {
        return;
      }
      currentListeners.delete(listener);
      if (currentListeners.size === 0) {
        workspaceSnapshotListeners.delete(listenerKey);
      }
      maybeStopSubscriptions();
    };
  }

  function getRuntimeToolLifecycleSnapshot(): RuntimeToolLifecycleSnapshot {
    return snapshot;
  }

  function getWorkspaceRuntimeToolLifecycleSnapshot(
    workspaceId: string | null
  ): RuntimeToolLifecycleSnapshot {
    return filterRuntimeToolLifecycleSnapshot(snapshot, workspaceId);
  }

  return {
    getRuntimeToolLifecycleSnapshot,
    getWorkspaceRuntimeToolLifecycleSnapshot,
    subscribeRuntimeToolLifecycleEvents,
    subscribeWorkspaceRuntimeToolLifecycleEvents,
    subscribeRuntimeToolLifecycleSnapshot,
    subscribeWorkspaceRuntimeToolLifecycleSnapshot,
  };
}

const runtimeToolLifecycleStore = createRuntimeToolLifecycleStore(
  subscribeAppServerEvents,
  subscribeRuntimeToolExecutionTelemetryEvents
);

export const getRuntimeToolLifecycleSnapshot =
  runtimeToolLifecycleStore.getRuntimeToolLifecycleSnapshot;
export const getWorkspaceRuntimeToolLifecycleSnapshot =
  runtimeToolLifecycleStore.getWorkspaceRuntimeToolLifecycleSnapshot;
export const subscribeRuntimeToolLifecycleEvents =
  runtimeToolLifecycleStore.subscribeRuntimeToolLifecycleEvents;
export const subscribeWorkspaceRuntimeToolLifecycleEvents =
  runtimeToolLifecycleStore.subscribeWorkspaceRuntimeToolLifecycleEvents;
export const subscribeRuntimeToolLifecycleSnapshot =
  runtimeToolLifecycleStore.subscribeRuntimeToolLifecycleSnapshot;
export const subscribeWorkspaceRuntimeToolLifecycleSnapshot =
  runtimeToolLifecycleStore.subscribeWorkspaceRuntimeToolLifecycleSnapshot;
