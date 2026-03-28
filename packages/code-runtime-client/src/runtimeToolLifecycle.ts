import type { RuntimeToolExecutionScope } from "@ku0/code-runtime-host-contract";

export type RuntimeToolLifecycleSource = "app-event" | "telemetry";

export type RuntimeToolLifecycleStatus =
  | "allowed"
  | "approved"
  | "blocked"
  | "completed"
  | "failed"
  | "in_progress"
  | "interrupted"
  | "pending"
  | "rejected"
  | "runtime_failed"
  | "success"
  | "timeout"
  | "validation_failed";

export type RuntimeTurnLifecycleEvent = {
  id: string;
  correlationKey?: string | null;
  kind: "turn";
  phase: "started" | "completed" | "failed";
  source: RuntimeToolLifecycleSource;
  workspaceId: string | null;
  threadId: string | null;
  turnId: string | null;
  toolCallId: null;
  toolName: null;
  scope: null;
  status: RuntimeToolLifecycleStatus;
  at: number;
  errorCode: string | null;
};

export type RuntimeToolLifecycleEventRecord = {
  id: string;
  correlationKey?: string | null;
  kind: "tool";
  phase: "attempted" | "started" | "updated" | "progress" | "completed";
  source: RuntimeToolLifecycleSource;
  workspaceId: string | null;
  threadId: string | null;
  turnId: string | null;
  toolCallId: string | null;
  toolName: string | null;
  scope: RuntimeToolExecutionScope | null;
  status: RuntimeToolLifecycleStatus | null;
  at: number;
  errorCode: string | null;
};

export type RuntimeApprovalLifecycleEvent = {
  id: string;
  correlationKey?: string | null;
  kind: "approval";
  phase: "requested" | "resolved";
  source: RuntimeToolLifecycleSource;
  workspaceId: string | null;
  threadId: string | null;
  turnId: string | null;
  toolCallId: null;
  toolName: string | null;
  scope: null;
  status: Extract<RuntimeToolLifecycleStatus, "approved" | "interrupted" | "pending" | "rejected">;
  at: number;
  errorCode: string | null;
  approvalId: string | null;
};

export type RuntimeGuardrailLifecycleEvent = {
  id: string;
  correlationKey?: string | null;
  kind: "guardrail";
  phase: "evaluated" | "outcome";
  source: RuntimeToolLifecycleSource;
  workspaceId: string | null;
  threadId: null;
  turnId: string | null;
  toolCallId: null;
  toolName: string | null;
  scope: RuntimeToolExecutionScope | null;
  status: Extract<
    RuntimeToolLifecycleStatus,
    "allowed" | "blocked" | "runtime_failed" | "success" | "timeout" | "validation_failed"
  >;
  at: number;
  errorCode: string | null;
  guardrailDecision: "allowed" | "blocked" | null;
};

export type RuntimeToolLifecycleEvent =
  | RuntimeApprovalLifecycleEvent
  | RuntimeGuardrailLifecycleEvent
  | RuntimeToolLifecycleEventRecord
  | RuntimeTurnLifecycleEvent;

export type RuntimeToolLifecycleSnapshot = {
  revision: number;
  lastEvent: RuntimeToolLifecycleEvent | null;
  recentEvents: RuntimeToolLifecycleEvent[];
  lastHookCheckpoint?: RuntimeToolLifecycleHookCheckpoint | null;
  recentHookCheckpoints?: RuntimeToolLifecycleHookCheckpoint[];
};

export type RuntimeToolLifecycleHookPoint =
  | "pre_validation_summary"
  | "post_validation_pre_execution"
  | "post_execution_pre_publication";

export type RuntimeToolLifecycleHookCheckpointStatus =
  | "pending"
  | "ready"
  | "blocked"
  | "completed";

export type RuntimeToolLifecycleHookCheckpoint = {
  key: string;
  point: RuntimeToolLifecycleHookPoint;
  status: RuntimeToolLifecycleHookCheckpointStatus;
  source: RuntimeToolLifecycleSource;
  workspaceId: string | null;
  threadId: string | null;
  turnId: string | null;
  toolCallId: string | null;
  toolName: string | null;
  scope: RuntimeToolExecutionScope | null;
  lifecycleEventId: string;
  at: number;
  reason: string | null;
};

export const RUNTIME_TOOL_LIFECYCLE_APP_EVENT_METHODS = [
  "turn/started",
  "turn/completed",
  "error",
  "item/started",
  "item/updated",
  "item/completed",
  "item/mcpToolCall/progress",
  "runtime/requestApproval",
  "runtime/approvalResolved",
] as const;

export type RuntimeToolLifecycleAppEventMethod =
  (typeof RUNTIME_TOOL_LIFECYCLE_APP_EVENT_METHODS)[number];

export type RuntimeToolLifecycleAppEventInput = {
  workspaceId: string | null;
  requestId?: string | number | null;
  method: RuntimeToolLifecycleAppEventMethod;
  params?: Record<string, unknown>;
  receivedAt: number;
};

export const RUNTIME_TOOL_LIFECYCLE_PHASE_SEQUENCE = {
  turn: ["started", "completed", "failed"],
  tool: ["attempted", "started", "updated", "progress", "completed"],
  approval: ["requested", "resolved"],
  guardrail: ["evaluated", "outcome"],
} as const;

const REPEATABLE_RUNTIME_TOOL_LIFECYCLE_PHASES = new Set<RuntimeToolLifecycleEvent["phase"]>([
  "updated",
  "progress",
]);

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

function readEventAt(params: Record<string, unknown>, fallbackAt: number): number {
  return (
    readNumber(params.at) ??
    readNumber(params.updatedAt) ??
    readNumber(params.timestamp) ??
    fallbackAt
  );
}

export function normalizeRuntimeToolLifecycleStatus(
  value: unknown
): RuntimeToolLifecycleStatus | null {
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

export function isRuntimeApprovalLifecycleStatus(
  status: RuntimeToolLifecycleStatus | null
): status is RuntimeApprovalLifecycleEvent["status"] {
  return (
    status === "pending" ||
    status === "approved" ||
    status === "rejected" ||
    status === "interrupted"
  );
}

export function isRuntimeGuardrailLifecycleStatus(
  status: RuntimeToolLifecycleStatus | null
): status is Extract<
  RuntimeToolLifecycleEvent["status"],
  "allowed" | "blocked" | "runtime_failed" | "success" | "timeout" | "validation_failed"
> {
  return (
    status === "allowed" ||
    status === "blocked" ||
    status === "runtime_failed" ||
    status === "success" ||
    status === "timeout" ||
    status === "validation_failed"
  );
}

export function buildRuntimeToolLifecycleEventId(
  kind: RuntimeToolLifecycleEvent["kind"],
  phase: RuntimeToolLifecycleEvent["phase"],
  source: RuntimeToolLifecycleEvent["source"],
  at: number,
  suffix: string | null
): string {
  return [source, kind, phase, String(at), suffix ?? "na"].join(":");
}

export function normalizeRuntimeToolLifecycleAppEvent(
  input: RuntimeToolLifecycleAppEventInput
): RuntimeToolLifecycleEvent | null {
  const params = input.params ?? {};
  if (
    input.method === "turn/started" ||
    input.method === "turn/completed" ||
    input.method === "error"
  ) {
    const turnId = readString(params.turnId);
    if (!turnId) {
      return null;
    }
    const threadId = readString(params.threadId);
    const at = readEventAt(params, input.receivedAt);
    const phase =
      input.method === "turn/started"
        ? "started"
        : input.method === "turn/completed"
          ? "completed"
          : "failed";
    const status =
      phase === "started" ? "in_progress" : phase === "completed" ? "completed" : "failed";
    const errorCode = input.method === "error" ? readString(asRecord(params.error)?.code) : null;

    return {
      id: buildRuntimeToolLifecycleEventId(
        "turn",
        phase,
        "app-event",
        at,
        String(input.requestId ?? turnId)
      ),
      correlationKey: String(input.requestId ?? turnId),
      kind: "turn",
      phase,
      source: "app-event",
      workspaceId: input.workspaceId,
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

  if (
    input.method === "item/started" ||
    input.method === "item/updated" ||
    input.method === "item/completed" ||
    input.method === "item/mcpToolCall/progress"
  ) {
    const item = asRecord(params.item);
    const itemId = readString(params.itemId) ?? readString(item?.id);
    const toolName = readString(item?.tool);
    const toolType = readString(item?.type);
    if (input.method !== "item/mcpToolCall/progress" && toolType && toolType !== "mcpToolCall") {
      return null;
    }

    const at = readEventAt(params, input.receivedAt);
    const status =
      input.method === "item/completed"
        ? (normalizeRuntimeToolLifecycleStatus(item?.status) ?? "completed")
        : (normalizeRuntimeToolLifecycleStatus(item?.status) ?? "in_progress");
    const phase =
      input.method === "item/started"
        ? "started"
        : input.method === "item/updated"
          ? "updated"
          : input.method === "item/mcpToolCall/progress"
            ? "progress"
            : "completed";

    return {
      id: buildRuntimeToolLifecycleEventId(
        "tool",
        phase,
        "app-event",
        at,
        String(input.requestId ?? itemId ?? toolName ?? "tool")
      ),
      correlationKey: String(input.requestId ?? itemId ?? toolName ?? "tool"),
      kind: "tool",
      phase,
      source: "app-event",
      workspaceId: input.workspaceId,
      threadId: readString(params.threadId),
      turnId: readString(params.turnId),
      toolCallId: itemId,
      toolName,
      scope: null,
      status,
      at,
      errorCode: input.method === "item/completed" ? readString(item?.errorCode) : null,
    };
  }

  if (input.method === "runtime/requestApproval" || input.method === "runtime/approvalResolved") {
    const approvalId = readString(params.approvalId);
    if (!approvalId) {
      return null;
    }
    const at = readEventAt(params, input.receivedAt);
    const phase = input.method === "runtime/requestApproval" ? "requested" : "resolved";
    const status =
      input.method === "runtime/requestApproval"
        ? "pending"
        : (normalizeRuntimeToolLifecycleStatus(params.status) ??
          normalizeRuntimeToolLifecycleStatus(params.decision));
    if (!isRuntimeApprovalLifecycleStatus(status)) {
      return null;
    }

    return {
      id: buildRuntimeToolLifecycleEventId(
        "approval",
        phase,
        "app-event",
        at,
        String(input.requestId ?? approvalId)
      ),
      correlationKey: String(input.requestId ?? approvalId),
      kind: "approval",
      phase,
      source: "app-event",
      workspaceId: input.workspaceId,
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

  return null;
}

export function isRuntimeToolLifecycleTerminalEvent(event: RuntimeToolLifecycleEvent): boolean {
  if (event.kind === "turn") {
    return event.phase === "completed" || event.phase === "failed";
  }
  if (event.kind === "tool") {
    return event.phase === "completed";
  }
  if (event.kind === "approval") {
    return event.phase === "resolved";
  }
  return event.phase === "outcome";
}

export function getRuntimeToolLifecyclePhaseIndex(
  event: Pick<RuntimeToolLifecycleEvent, "kind" | "phase">
): number {
  const sequence = RUNTIME_TOOL_LIFECYCLE_PHASE_SEQUENCE[event.kind] as readonly string[];
  return sequence.indexOf(event.phase);
}

export function getRuntimeToolLifecycleEntityKey(event: RuntimeToolLifecycleEvent): string {
  if (event.kind === "turn") {
    return [
      event.kind,
      event.source,
      event.correlationKey ?? event.turnId ?? event.id,
      event.workspaceId ?? "workspace:na",
    ].join(":");
  }
  if (event.kind === "approval") {
    return [
      event.kind,
      event.source,
      event.correlationKey ?? event.approvalId ?? event.turnId ?? event.id,
      event.workspaceId ?? "workspace:na",
    ].join(":");
  }
  return [
    event.kind,
    event.source,
    event.correlationKey ?? event.toolCallId ?? event.toolName ?? event.id,
    event.scope ?? "scope:na",
    event.workspaceId ?? "workspace:na",
  ].join(":");
}

export function shouldAcceptRuntimeToolLifecycleTransition(
  previous: RuntimeToolLifecycleEvent,
  next: RuntimeToolLifecycleEvent
): boolean {
  if (previous.kind !== next.kind) {
    return true;
  }
  if (getRuntimeToolLifecycleEntityKey(previous) !== getRuntimeToolLifecycleEntityKey(next)) {
    return true;
  }

  const previousIndex = getRuntimeToolLifecyclePhaseIndex(previous);
  const nextIndex = getRuntimeToolLifecyclePhaseIndex(next);
  if (previousIndex < 0 || nextIndex < 0) {
    return true;
  }
  if (nextIndex > previousIndex) {
    return true;
  }
  if (nextIndex < previousIndex) {
    return false;
  }
  return REPEATABLE_RUNTIME_TOOL_LIFECYCLE_PHASES.has(next.phase);
}

export function deriveRuntimeToolLifecycleHookCheckpoint(
  event: RuntimeToolLifecycleEvent
): RuntimeToolLifecycleHookCheckpoint | null {
  if (event.kind === "turn") {
    return null;
  }

  if (event.kind === "approval") {
    const status =
      event.phase === "requested" ? "pending" : event.status === "approved" ? "ready" : "blocked";
    return {
      key: `${getRuntimeToolLifecycleEntityKey(event)}:post_validation_pre_execution`,
      point: "post_validation_pre_execution",
      status,
      source: event.source,
      workspaceId: event.workspaceId,
      threadId: event.threadId,
      turnId: event.turnId,
      toolCallId: null,
      toolName: event.toolName,
      scope: null,
      lifecycleEventId: event.id,
      at: event.at,
      reason: event.errorCode,
    };
  }

  if (event.kind === "guardrail") {
    const status = event.status === "allowed" || event.status === "success" ? "ready" : "blocked";
    return {
      key: `${getRuntimeToolLifecycleEntityKey(event)}:post_validation_pre_execution`,
      point: "post_validation_pre_execution",
      status,
      source: event.source,
      workspaceId: event.workspaceId,
      threadId: event.threadId,
      turnId: event.turnId,
      toolCallId: null,
      toolName: event.toolName,
      scope: event.scope,
      lifecycleEventId: event.id,
      at: event.at,
      reason: event.errorCode,
    };
  }

  if (event.phase === "attempted") {
    return {
      key: `${getRuntimeToolLifecycleEntityKey(event)}:pre_validation_summary`,
      point: "pre_validation_summary",
      status: "pending",
      source: event.source,
      workspaceId: event.workspaceId,
      threadId: event.threadId,
      turnId: event.turnId,
      toolCallId: event.toolCallId,
      toolName: event.toolName,
      scope: event.scope,
      lifecycleEventId: event.id,
      at: event.at,
      reason: event.errorCode,
    };
  }

  if (event.phase === "started") {
    return {
      key: `${getRuntimeToolLifecycleEntityKey(event)}:post_validation_pre_execution`,
      point: "post_validation_pre_execution",
      status: "completed",
      source: event.source,
      workspaceId: event.workspaceId,
      threadId: event.threadId,
      turnId: event.turnId,
      toolCallId: event.toolCallId,
      toolName: event.toolName,
      scope: event.scope,
      lifecycleEventId: event.id,
      at: event.at,
      reason: event.errorCode,
    };
  }

  if (event.phase === "completed") {
    return {
      key: `${getRuntimeToolLifecycleEntityKey(event)}:post_execution_pre_publication`,
      point: "post_execution_pre_publication",
      status: "ready",
      source: event.source,
      workspaceId: event.workspaceId,
      threadId: event.threadId,
      turnId: event.turnId,
      toolCallId: event.toolCallId,
      toolName: event.toolName,
      scope: event.scope,
      lifecycleEventId: event.id,
      at: event.at,
      reason: event.errorCode,
    };
  }

  return null;
}

export function runtimeToolLifecycleEventMatchesWorkspace(
  event: RuntimeToolLifecycleEvent,
  workspaceId: string | null
): boolean {
  if (!workspaceId) {
    return true;
  }
  return event.workspaceId === workspaceId;
}

export function filterRuntimeToolLifecycleSnapshot(
  snapshot: RuntimeToolLifecycleSnapshot,
  workspaceId: string | null
): RuntimeToolLifecycleSnapshot {
  const recentEvents = snapshot.recentEvents.filter((event) =>
    runtimeToolLifecycleEventMatchesWorkspace(event, workspaceId)
  );
  const recentHookCheckpoints = (snapshot.recentHookCheckpoints ?? []).filter((checkpoint) =>
    workspaceId ? checkpoint.workspaceId === workspaceId : true
  );
  const lastEvent =
    snapshot.lastEvent && runtimeToolLifecycleEventMatchesWorkspace(snapshot.lastEvent, workspaceId)
      ? snapshot.lastEvent
      : (recentEvents.at(-1) ?? null);
  const lastHookCheckpoint =
    snapshot.lastHookCheckpoint &&
    (workspaceId ? snapshot.lastHookCheckpoint.workspaceId === workspaceId : true)
      ? snapshot.lastHookCheckpoint
      : (recentHookCheckpoints.at(-1) ?? null);

  return {
    revision: snapshot.revision,
    lastEvent,
    recentEvents,
    lastHookCheckpoint,
    recentHookCheckpoints,
  };
}
