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
import type {
  RuntimeApprovalLifecycleEvent,
  RuntimeToolLifecycleEvent,
  RuntimeToolLifecycleEventRecord,
  RuntimeToolLifecycleSnapshot,
  RuntimeToolLifecycleStatus,
  RuntimeTurnLifecycleEvent,
} from "../types/runtimeToolLifecycle";

const RUNTIME_TOOL_LIFECYCLE_RECENT_LIMIT = 40;

type RuntimeToolLifecycleEventListener = (event: RuntimeToolLifecycleEvent) => void;
type RuntimeToolLifecycleSnapshotListener = () => void;

type AppServerEventSubscriber = (listener: (event: AppServerEvent) => void) => Unsubscribe;
type TelemetryEventSubscriber = (
  listener: (event: RuntimeToolExecutionTelemetryEvent) => void
) => Unsubscribe;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function readString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function normalizeLifecycleStatus(value: unknown): RuntimeToolLifecycleStatus | null {
  const raw = readString(value);
  if (!raw) {
    return null;
  }
  const normalized = raw.trim().toLowerCase();
  switch (normalized) {
    case "allowed":
    case "approved":
    case "blocked":
    case "completed":
    case "failed":
    case "interrupted":
    case "pending":
    case "rejected":
    case "runtime_failed":
    case "success":
    case "timeout":
    case "validation_failed":
      return normalized;
    case "inprogress":
    case "in_progress":
      return "in_progress";
    default:
      return null;
  }
}

function readEventAt(params: Record<string, unknown>, fallbackAt: number): number {
  return (
    readNumber(params.at) ??
    readNumber(params.updatedAt) ??
    readNumber(params.timestamp) ??
    fallbackAt
  );
}

function buildLifecycleEventId(
  kind: RuntimeToolLifecycleEvent["kind"],
  phase: RuntimeToolLifecycleEvent["phase"],
  source: RuntimeToolLifecycleEvent["source"],
  at: number,
  suffix: string | null
): string {
  return [source, kind, phase, String(at), suffix ?? "na"].join(":");
}

function createTurnLifecycleEvent(
  method: "turn/started" | "turn/completed" | "error",
  event: AppServerEvent,
  receivedAt: number
): RuntimeTurnLifecycleEvent | null {
  const params = getAppServerParams(event);
  const turnId = readString(params.turnId);
  if (!turnId) {
    return null;
  }
  const threadId = readString(params.threadId);
  const at = readEventAt(params, receivedAt);
  const requestId = getAppServerRequestId(event);
  const phase =
    method === "turn/started" ? "started" : method === "turn/completed" ? "completed" : "failed";
  const status =
    phase === "started" ? "in_progress" : phase === "completed" ? "completed" : "failed";
  const errorCode = method === "error" ? readString(asRecord(params.error)?.code) : null;

  return {
    id: buildLifecycleEventId("turn", phase, "app-event", at, String(requestId ?? turnId)),
    kind: "turn",
    phase,
    source: "app-event",
    workspaceId: event.workspace_id,
    threadId,
    turnId,
    toolCallId: null,
    toolName: null,
    scope: null,
    status,
    at,
    errorCode,
  };
}

function createToolLifecycleEventFromAppEvent(
  method: "item/started" | "item/updated" | "item/completed" | "item/mcpToolCall/progress",
  event: AppServerEvent,
  receivedAt: number
): RuntimeToolLifecycleEventRecord | null {
  const params = getAppServerParams(event);
  const item = asRecord(params.item);
  const itemId = readString(params.itemId) ?? readString(item?.id);
  const toolName = readString(item?.tool);
  const toolType = readString(item?.type);
  if (method !== "item/mcpToolCall/progress" && toolType && toolType !== "mcpToolCall") {
    return null;
  }
  const at = readEventAt(params, receivedAt);
  const requestId = getAppServerRequestId(event);
  const status =
    method === "item/started" || method === "item/updated" || method === "item/mcpToolCall/progress"
      ? (normalizeLifecycleStatus(item?.status) ?? "in_progress")
      : (normalizeLifecycleStatus(item?.status) ?? "completed");
  const phase =
    method === "item/started"
      ? "started"
      : method === "item/updated"
        ? "updated"
        : method === "item/mcpToolCall/progress"
          ? "progress"
          : "completed";

  return {
    id: buildLifecycleEventId(
      "tool",
      phase,
      "app-event",
      at,
      String(requestId ?? itemId ?? toolName ?? "tool")
    ),
    kind: "tool",
    phase,
    source: "app-event",
    workspaceId: event.workspace_id,
    threadId: readString(params.threadId),
    turnId: readString(params.turnId),
    toolCallId: itemId,
    toolName,
    scope: null,
    status,
    at,
    errorCode: method === "item/completed" ? readString(item?.errorCode) : null,
  };
}

function createApprovalLifecycleEvent(
  method: "runtime/requestApproval" | "runtime/approvalResolved",
  event: AppServerEvent,
  receivedAt: number
): RuntimeApprovalLifecycleEvent | null {
  const params = getAppServerParams(event);
  const approvalId = readString(params.approvalId);
  if (!approvalId) {
    return null;
  }
  const at = readEventAt(params, receivedAt);
  const requestId = getAppServerRequestId(event);
  const phase = method === "runtime/requestApproval" ? "requested" : "resolved";
  const status =
    method === "runtime/requestApproval"
      ? "pending"
      : (normalizeLifecycleStatus(params.status) ?? normalizeLifecycleStatus(params.decision));
  if (!status || !["pending", "approved", "rejected", "interrupted"].includes(status)) {
    return null;
  }

  return {
    id: buildLifecycleEventId("approval", phase, "app-event", at, String(requestId ?? approvalId)),
    kind: "approval",
    phase,
    source: "app-event",
    workspaceId: event.workspace_id,
    threadId: readString(params.threadId),
    turnId: readString(params.turnId),
    toolCallId: null,
    toolName: readString(params.action) ?? readString(params.command),
    scope: null,
    status,
    at,
    errorCode: null,
    approvalId,
  };
}

function normalizeRuntimeToolLifecycleAppEvent(
  event: AppServerEvent,
  receivedAt: number
): RuntimeToolLifecycleEvent | null {
  const method = getAppServerRawMethod(event);
  if (!method) {
    return null;
  }
  if (method === "turn/started" || method === "turn/completed" || method === "error") {
    return createTurnLifecycleEvent(method, event, receivedAt);
  }
  if (
    method === "item/started" ||
    method === "item/updated" ||
    method === "item/completed" ||
    method === "item/mcpToolCall/progress"
  ) {
    return createToolLifecycleEventFromAppEvent(method, event, receivedAt);
  }
  if (method === "runtime/requestApproval" || method === "runtime/approvalResolved") {
    return createApprovalLifecycleEvent(method, event, receivedAt);
  }
  return null;
}

function normalizeRuntimeToolLifecycleTelemetryEvent(
  event: RuntimeToolExecutionTelemetryEvent
): RuntimeToolLifecycleEvent | null {
  if (event.kind === "execution") {
    const status =
      event.phase === "attempted"
        ? "pending"
        : event.phase === "started"
          ? "in_progress"
          : normalizeLifecycleStatus(event.status);
    return {
      id: buildLifecycleEventId(
        "tool",
        event.phase,
        "telemetry",
        event.at,
        event.requestId ?? event.toolName
      ),
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
      id: buildLifecycleEventId(
        "guardrail",
        "evaluated",
        "telemetry",
        event.at,
        event.requestId ?? event.toolName
      ),
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
    const status = normalizeLifecycleStatus(event.status);
    if (
      !status ||
      !["success", "validation_failed", "runtime_failed", "timeout", "blocked"].includes(status)
    ) {
      return null;
    }
    return {
      id: buildLifecycleEventId(
        "guardrail",
        "outcome",
        "telemetry",
        event.at,
        event.requestId ?? event.toolName
      ),
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
  const snapshotListeners = new Set<RuntimeToolLifecycleSnapshotListener>();
  let appServerUnsubscribe: Unsubscribe | null = null;
  let telemetryUnsubscribe: Unsubscribe | null = null;
  let snapshot: RuntimeToolLifecycleSnapshot = {
    revision: 0,
    lastEvent: null,
    recentEvents: [],
  };

  function publish(event: RuntimeToolLifecycleEvent): void {
    snapshot = {
      revision: snapshot.revision + 1,
      lastEvent: event,
      recentEvents: [...snapshot.recentEvents, event].slice(-RUNTIME_TOOL_LIFECYCLE_RECENT_LIMIT),
    };

    for (const listener of eventListeners) {
      notifyLifecycleEventListener(listener, event);
    }
    for (const listener of snapshotListeners) {
      notifyLifecycleSnapshotListener(listener);
    }
  }

  function ensureSubscriptions(): void {
    if (
      appServerUnsubscribe ||
      telemetryUnsubscribe ||
      eventListeners.size + snapshotListeners.size === 0
    ) {
      return;
    }

    appServerUnsubscribe = subscribeToAppServerEvents((event) => {
      const normalized = normalizeRuntimeToolLifecycleAppEvent(event, Date.now());
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
    if (eventListeners.size + snapshotListeners.size > 0) {
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

  function getRuntimeToolLifecycleSnapshot(): RuntimeToolLifecycleSnapshot {
    return snapshot;
  }

  return {
    getRuntimeToolLifecycleSnapshot,
    subscribeRuntimeToolLifecycleEvents,
    subscribeRuntimeToolLifecycleSnapshot,
  };
}

const runtimeToolLifecycleStore = createRuntimeToolLifecycleStore(
  subscribeAppServerEvents,
  subscribeRuntimeToolExecutionTelemetryEvents
);

export const getRuntimeToolLifecycleSnapshot =
  runtimeToolLifecycleStore.getRuntimeToolLifecycleSnapshot;
export const subscribeRuntimeToolLifecycleEvents =
  runtimeToolLifecycleStore.subscribeRuntimeToolLifecycleEvents;
export const subscribeRuntimeToolLifecycleSnapshot =
  runtimeToolLifecycleStore.subscribeRuntimeToolLifecycleSnapshot;
