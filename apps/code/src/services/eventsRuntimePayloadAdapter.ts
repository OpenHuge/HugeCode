import {
  type CodeRuntimeHostEventEnvelope,
  parseCodeRuntimeHostEventEnvelope,
} from "@ku0/code-runtime-host-contract";
import type { AppServerEvent } from "../types";
import { normalizeLifecycleStatus } from "../utils/lifecycleStatus";
import { normalizeRuntimeExecutionMode } from "../utils/runtimeExecutionMode";
import { DEFAULT_RUNTIME_WORKSPACE_ID } from "../utils/runtimeWorkspaceIds";

const RUNTIME_TURN_CONTEXT_TTL_MS = 10 * 60 * 1000;
const RUNTIME_TURN_CONTEXT_MAX_ENTRIES = 512;

type UnknownRecord = Record<string, unknown>;
type RuntimeTurnStreamContext = {
  workspaceId: string;
  threadId: string;
  recordedAtMs: number;
};

function normalizeLifecycleItem(item: UnknownRecord): UnknownRecord {
  const status = normalizeLifecycleStatus(item.status);
  return status ? { ...item, status } : item;
}

const runtimeTurnContextByRequestId = new Map<string, RuntimeTurnStreamContext>();
const runtimeTurnContextByTurnId = new Map<string, RuntimeTurnStreamContext>();

function pruneRuntimeTurnContextMap(store: Map<string, RuntimeTurnStreamContext>, nowMs: number) {
  for (const [key, value] of store.entries()) {
    if (nowMs - value.recordedAtMs > RUNTIME_TURN_CONTEXT_TTL_MS) {
      store.delete(key);
    }
  }
  while (store.size > RUNTIME_TURN_CONTEXT_MAX_ENTRIES) {
    const oldestKey = store.keys().next().value as string | undefined;
    if (!oldestKey) {
      break;
    }
    store.delete(oldestKey);
  }
}

function registerRuntimeTurnRequestContextInternal(
  requestId: string,
  workspaceId: string,
  threadId: string
) {
  const normalizedRequestId = requestId.trim();
  const normalizedWorkspaceId = workspaceId.trim();
  const normalizedThreadId = threadId.trim();
  if (!normalizedRequestId || !normalizedWorkspaceId || !normalizedThreadId) {
    return;
  }
  const nowMs = Date.now();
  runtimeTurnContextByRequestId.set(normalizedRequestId, {
    workspaceId: normalizedWorkspaceId,
    threadId: normalizedThreadId,
    recordedAtMs: nowMs,
  });
  pruneRuntimeTurnContextMap(runtimeTurnContextByRequestId, nowMs);
}

function registerRuntimeTurnContextByTurnIdInternal(
  turnId: string,
  workspaceId: string,
  threadId: string
) {
  const normalizedTurnId = turnId.trim();
  const normalizedWorkspaceId = workspaceId.trim();
  const normalizedThreadId = threadId.trim();
  if (!normalizedTurnId || !normalizedWorkspaceId || !normalizedThreadId) {
    return;
  }
  const nowMs = Date.now();
  runtimeTurnContextByTurnId.set(normalizedTurnId, {
    workspaceId: normalizedWorkspaceId,
    threadId: normalizedThreadId,
    recordedAtMs: nowMs,
  });
  pruneRuntimeTurnContextMap(runtimeTurnContextByTurnId, nowMs);
}

function getRuntimeTurnContextFromRequestId(
  requestId: string | null
): RuntimeTurnStreamContext | null {
  if (!requestId) {
    return null;
  }
  const normalizedRequestId = requestId.trim();
  if (!normalizedRequestId) {
    return null;
  }
  const entry = runtimeTurnContextByRequestId.get(normalizedRequestId) ?? null;
  if (!entry) {
    return null;
  }
  if (Date.now() - entry.recordedAtMs > RUNTIME_TURN_CONTEXT_TTL_MS) {
    runtimeTurnContextByRequestId.delete(normalizedRequestId);
    return null;
  }
  return entry;
}

function getRuntimeTurnContextFromTurnId(turnId: string | null): RuntimeTurnStreamContext | null {
  if (!turnId) {
    return null;
  }
  const normalizedTurnId = turnId.trim();
  if (!normalizedTurnId) {
    return null;
  }
  const entry = runtimeTurnContextByTurnId.get(normalizedTurnId) ?? null;
  if (!entry) {
    return null;
  }
  if (Date.now() - entry.recordedAtMs > RUNTIME_TURN_CONTEXT_TTL_MS) {
    runtimeTurnContextByTurnId.delete(normalizedTurnId);
    return null;
  }
  return entry;
}

export function registerRuntimeTurnRequestContext(
  requestId: string,
  workspaceId: string,
  threadId: string
): void {
  registerRuntimeTurnRequestContextInternal(requestId, workspaceId, threadId);
}

export function registerRuntimeTurnContextByTurnId(
  turnId: string,
  workspaceId: string,
  threadId: string
): void {
  registerRuntimeTurnContextByTurnIdInternal(turnId, workspaceId, threadId);
}

export function __resetRuntimeTurnContextForTests(): void {
  runtimeTurnContextByRequestId.clear();
  runtimeTurnContextByTurnId.clear();
}

function isRecord(value: unknown): value is UnknownRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function readNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readRecordField(record: UnknownRecord, field: string): UnknownRecord | null {
  const value = record[field];
  return isRecord(value) ? value : null;
}

function readFieldString(record: UnknownRecord, fields: string[]): string | null {
  for (const field of fields) {
    const value = readNonEmptyString(record[field]);
    if (value) {
      return value;
    }
  }
  return null;
}

function readFieldNumber(record: UnknownRecord, fields: string[]): number | null {
  for (const field of fields) {
    const raw = record[field];
    if (typeof raw === "number" && Number.isFinite(raw)) {
      return raw;
    }
    if (typeof raw === "string" && raw.trim().length > 0) {
      const parsed = Number(raw);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return null;
}

function readFieldBoolean(record: UnknownRecord, fields: string[]): boolean | null {
  for (const field of fields) {
    const raw = record[field];
    if (typeof raw === "boolean") {
      return raw;
    }
    if (typeof raw === "number" && Number.isFinite(raw)) {
      return raw !== 0;
    }
    if (typeof raw === "string") {
      const normalized = raw.trim().toLowerCase();
      if (["true", "1", "yes", "on", "enabled"].includes(normalized)) {
        return true;
      }
      if (["false", "0", "no", "off", "disabled"].includes(normalized)) {
        return false;
      }
    }
  }
  return null;
}

function readFieldExecutionMode(
  record: UnknownRecord,
  fields: string[]
): "runtime" | "local-cli" | "hybrid" | null {
  for (const field of fields) {
    const raw = readNonEmptyString(record[field]);
    if (!raw) {
      continue;
    }
    const normalized = normalizeRuntimeExecutionMode(raw);
    if (normalized) {
      return normalized;
    }
  }
  return null;
}

function readFieldApprovalResolutionStatus(record: UnknownRecord): string | null {
  const rawStatus = readFieldString(record, ["status"]);
  const rawDecision = readFieldString(record, ["decision"]);
  const normalized = (rawStatus ?? rawDecision)?.trim().toLowerCase() ?? "";
  if (!normalized) {
    return null;
  }
  if (["approved", "accepted", "allow", "allowed"].includes(normalized)) {
    return "approved";
  }
  if (["rejected", "declined", "deny", "denied"].includes(normalized)) {
    return "rejected";
  }
  if (["interrupted", "cancelled", "canceled", "aborted"].includes(normalized)) {
    return "interrupted";
  }
  if (normalized === "resolved") {
    return "resolved";
  }
  return null;
}

function parseIsoTimestampToEpochMs(value: unknown): number | null {
  const text = readNonEmptyString(value);
  if (!text) {
    return null;
  }
  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function stringifyEventValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (value === null || value === undefined) {
    return "";
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function safeParseJson(value: string): unknown | null {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function isAppServerEvent(value: unknown): value is AppServerEvent {
  if (!isRecord(value)) {
    return false;
  }
  if (!readNonEmptyString(value.workspace_id)) {
    return false;
  }
  return isRecord(value.message);
}

function parseRuntimeHostEventEnvelope(value: unknown): CodeRuntimeHostEventEnvelope | null {
  const candidates: unknown[] = [value];
  if (isRecord(value)) {
    candidates.push(value.event, value.payload);
    if (typeof value.data === "string") {
      candidates.push(safeParseJson(value.data));
    }
  }

  for (const candidate of candidates) {
    if (candidate === undefined || candidate === null) {
      continue;
    }
    const parsed = parseCodeRuntimeHostEventEnvelope(candidate);
    if (parsed.ok) {
      return parsed.value;
    }
  }

  return null;
}

function readWorkspaceIdFromRuntimeHostEvent(event: CodeRuntimeHostEventEnvelope): string | null {
  const payload = isRecord(event.payload) ? event.payload : null;
  if (!payload) {
    return null;
  }
  return (
    readFieldString(payload, ["workspaceId", "workspace_id"]) ??
    readFieldString(readRecordField(payload, "metadata") ?? {}, ["workspaceId", "workspace_id"]) ??
    readFieldString(readRecordField(payload, "context") ?? {}, ["workspaceId", "workspace_id"])
  );
}

type AdaptedRuntimeMethod = {
  method: string;
  params: UnknownRecord;
};

function adaptToolCallingRuntimeEvent(
  payload: UnknownRecord,
  turnId: string,
  threadId: string
): AdaptedRuntimeMethod {
  const lifecycleItem = readRecordField(payload, "item");
  if (lifecycleItem) {
    const itemId =
      readFieldString(lifecycleItem, ["id"]) ??
      readFieldString(payload, ["itemId", "item_id"]) ??
      `${turnId}:item`;
    return {
      method: "item/started",
      params: {
        threadId,
        turnId,
        itemId,
        item: {
          ...normalizeLifecycleItem(lifecycleItem),
          id: itemId,
        },
      },
    };
  }

  const toolCallId = readFieldString(payload, ["toolCallId", "tool_call_id"]) ?? `${turnId}:tool`;
  const toolName = readFieldString(payload, ["toolName", "tool_name"]) ?? "runtime_tool";
  const batchId = readFieldString(payload, ["batchId", "batch_id"]);
  const attempt = readFieldNumber(payload, ["attempt"]);
  const checkpointId = readFieldString(payload, ["checkpointId", "checkpoint_id"]);
  const traceId = readFieldString(payload, ["traceId", "trace_id"]);
  const recovered = readFieldBoolean(payload, ["recovered"]);
  return {
    method: "item/started",
    params: {
      threadId,
      turnId,
      itemId: toolCallId,
      item: {
        id: toolCallId,
        type: "mcpToolCall",
        server: "runtime",
        tool: toolName,
        arguments: {
          ...(readRecordField(payload, "input") ?? {}),
          ...(batchId ? { batchId } : {}),
          ...(attempt !== null ? { attempt } : {}),
          ...(checkpointId ? { checkpointId } : {}),
          ...(traceId ? { traceId } : {}),
          ...(recovered !== null ? { recovered } : {}),
        },
        status: "inProgress",
        ...(batchId ? { batchId } : {}),
        ...(attempt !== null ? { attempt } : {}),
        ...(checkpointId ? { checkpointId } : {}),
        ...(traceId ? { traceId } : {}),
        ...(recovered !== null ? { recovered } : {}),
      },
    },
  };
}

function adaptToolResultRuntimeEvent(
  payload: UnknownRecord,
  turnId: string,
  threadId: string
): AdaptedRuntimeMethod {
  const lifecycleItem = readRecordField(payload, "item");
  if (lifecycleItem) {
    const itemId =
      readFieldString(lifecycleItem, ["id"]) ??
      readFieldString(payload, ["itemId", "item_id"]) ??
      `${turnId}:item`;
    return {
      method: "item/completed",
      params: {
        threadId,
        turnId,
        itemId,
        item: {
          ...normalizeLifecycleItem(lifecycleItem),
          id: itemId,
        },
      },
    };
  }

  const toolCallId = readFieldString(payload, ["toolCallId", "tool_call_id"]) ?? `${turnId}:tool`;
  const toolName = readFieldString(payload, ["toolName", "tool_name"]) ?? "runtime_tool";
  const batchId = readFieldString(payload, ["batchId", "batch_id"]);
  const attempt = readFieldNumber(payload, ["attempt"]);
  const checkpointId = readFieldString(payload, ["checkpointId", "checkpoint_id"]);
  const traceId = readFieldString(payload, ["traceId", "trace_id"]);
  const errorClass = readFieldString(payload, ["errorClass", "error_class"]);
  const durationMs = readFieldNumber(payload, ["durationMs", "duration_ms"]);
  const recovered = readFieldBoolean(payload, ["recovered"]);
  const ok = payload.ok === true;
  const error = readRecordField(payload, "error");
  return {
    method: "item/completed",
    params: {
      threadId,
      turnId,
      itemId: toolCallId,
      item: {
        id: toolCallId,
        type: "mcpToolCall",
        server: "runtime",
        tool: toolName,
        arguments: {
          ...(readRecordField(payload, "input") ?? {}),
          ...(batchId ? { batchId } : {}),
          ...(attempt !== null ? { attempt } : {}),
          ...(checkpointId ? { checkpointId } : {}),
          ...(traceId ? { traceId } : {}),
          ...(errorClass ? { errorClass } : {}),
          ...(durationMs !== null ? { durationMs } : {}),
          ...(recovered !== null ? { recovered } : {}),
        },
        status: ok ? "completed" : "failed",
        result: ok ? stringifyEventValue(payload.output) : "",
        error: ok
          ? ""
          : (readFieldString(error ?? {}, ["message"]) ??
            stringifyEventValue(error ?? payload.output) ??
            "Tool execution failed."),
        ...(batchId ? { batchId } : {}),
        ...(attempt !== null ? { attempt } : {}),
        ...(checkpointId ? { checkpointId } : {}),
        ...(traceId ? { traceId } : {}),
        ...(errorClass ? { errorClass } : {}),
        ...(durationMs !== null ? { durationMs } : {}),
        ...(recovered !== null ? { recovered } : {}),
      },
    },
  };
}

function adaptItemUpdatedRuntimeEvent(
  payload: UnknownRecord,
  turnId: string,
  threadId: string
): AdaptedRuntimeMethod {
  const lifecycleItem = readRecordField(payload, "item");
  const itemId =
    readFieldString(lifecycleItem ?? {}, ["id"]) ??
    readFieldString(payload, ["itemId", "item_id"]) ??
    `${turnId}:item`;
  return {
    method: "item/updated",
    params: {
      threadId,
      turnId,
      itemId,
      item: lifecycleItem
        ? {
            ...normalizeLifecycleItem(lifecycleItem),
            id: itemId,
          }
        : {
            id: itemId,
            type: "runtimeItem",
            status: "inProgress",
          },
    },
  };
}

function adaptItemMcpToolCallProgressRuntimeEvent(
  payload: UnknownRecord,
  turnId: string,
  threadId: string
): AdaptedRuntimeMethod | null {
  const itemId =
    readFieldString(payload, ["itemId", "item_id"]) ??
    readFieldString(payload, ["toolCallId", "tool_call_id"]);
  const message =
    readFieldString(payload, ["message"]) ??
    readFieldString(payload, ["delta"]) ??
    stringifyEventValue(payload.message ?? payload.delta);
  if (!itemId || !message) {
    return null;
  }
  return {
    method: "item/mcpToolCall/progress",
    params: {
      threadId,
      turnId,
      itemId,
      message,
    },
  };
}

function adaptRuntimeUpdatedRuntimeEvent(
  payload: UnknownRecord,
  emittedAt: unknown
): AdaptedRuntimeMethod {
  const scope = Array.isArray(payload.scope)
    ? payload.scope
        .map((entry) => readNonEmptyString(entry))
        .filter((entry): entry is string => entry !== null)
    : [];
  const diagnostics =
    readRecordField(payload, "diagnostics") ?? readRecordField(payload, "metrics");
  const replayGapLastEventId = readFieldNumber(payload, [
    "replayGapLastEventId",
    "replay_gap_last_event_id",
  ]);
  const replayGapOldestEventId = readFieldNumber(payload, [
    "replayGapOldestEventId",
    "replay_gap_oldest_event_id",
  ]);
  const streamLaggedDroppedEvents = readFieldNumber(payload, [
    "streamLaggedDroppedEvents",
    "stream_lagged_dropped_events",
  ]);
  const backendsTotal =
    readFieldNumber(payload, ["backendsTotal", "backends_total"]) ??
    readFieldNumber(diagnostics ?? {}, ["backendsTotal", "backends_total"]);
  const backendsHealthy =
    readFieldNumber(payload, ["backendsHealthy", "backends_healthy"]) ??
    readFieldNumber(diagnostics ?? {}, ["backendsHealthy", "backends_healthy"]);
  const backendsDraining =
    readFieldNumber(payload, ["backendsDraining", "backends_draining"]) ??
    readFieldNumber(diagnostics ?? {}, ["backendsDraining", "backends_draining"]);
  const placementFailuresTotal =
    readFieldNumber(payload, ["placementFailuresTotal", "placement_failures_total"]) ??
    readFieldNumber(diagnostics ?? {}, ["placementFailuresTotal", "placement_failures_total"]);
  const queueDepth =
    readFieldNumber(payload, ["queueDepth", "queue_depth"]) ??
    readFieldNumber(diagnostics ?? {}, ["queueDepth", "queue_depth"]);
  const accessMode =
    readFieldString(payload, ["accessMode", "access_mode"]) ??
    readFieldString(diagnostics ?? {}, ["accessMode", "access_mode"]);
  const routedProvider =
    readFieldString(payload, ["routedProvider", "routed_provider"]) ??
    readFieldString(diagnostics ?? {}, ["routedProvider", "routed_provider"]);
  const executionMode =
    readFieldExecutionMode(payload, ["executionMode", "execution_mode"]) ??
    readFieldExecutionMode(diagnostics ?? {}, ["executionMode", "execution_mode"]);
  const diagnosticReason =
    readFieldString(payload, ["diagnosticReason", "diagnostic_reason"]) ??
    readFieldString(diagnostics ?? {}, ["diagnosticReason", "diagnostic_reason", "reason"]);
  const mode = readFieldString(payload, ["mode"]) ?? readFieldString(diagnostics ?? {}, ["mode"]);
  const degraded =
    readFieldBoolean(payload, ["degraded"]) ?? readFieldBoolean(diagnostics ?? {}, ["degraded"]);
  const checkpointWriteTotal =
    readFieldNumber(payload, ["checkpointWriteTotal", "checkpoint_write_total"]) ??
    readFieldNumber(diagnostics ?? {}, ["checkpointWriteTotal", "checkpoint_write_total"]);
  const checkpointWriteFailedTotal =
    readFieldNumber(payload, ["checkpointWriteFailedTotal", "checkpoint_write_failed_total"]) ??
    readFieldNumber(diagnostics ?? {}, [
      "checkpointWriteFailedTotal",
      "checkpoint_write_failed_total",
    ]);
  const agentTaskCheckpointRecoverTotal =
    readFieldNumber(payload, [
      "agentTaskCheckpointRecoverTotal",
      "agent_task_checkpoint_recover_total",
    ]) ??
    readFieldNumber(diagnostics ?? {}, [
      "agentTaskCheckpointRecoverTotal",
      "agent_task_checkpoint_recover_total",
    ]);
  const subagentCheckpointRecoverTotal =
    readFieldNumber(payload, [
      "subagentCheckpointRecoverTotal",
      "subagent_checkpoint_recover_total",
    ]) ??
    readFieldNumber(diagnostics ?? {}, [
      "subagentCheckpointRecoverTotal",
      "subagent_checkpoint_recover_total",
    ]);
  const runtimeRecoveryInterruptTotal =
    readFieldNumber(payload, [
      "runtimeRecoveryInterruptTotal",
      "runtime_recovery_interrupt_total",
    ]) ??
    readFieldNumber(diagnostics ?? {}, [
      "runtimeRecoveryInterruptTotal",
      "runtime_recovery_interrupt_total",
    ]);
  const agentTaskResumeTotal =
    readFieldNumber(payload, ["agentTaskResumeTotal", "agent_task_resume_total"]) ??
    readFieldNumber(diagnostics ?? {}, ["agentTaskResumeTotal", "agent_task_resume_total"]);
  const agentTaskResumeFailedTotal =
    readFieldNumber(payload, ["agentTaskResumeFailedTotal", "agent_task_resume_failed_total"]) ??
    readFieldNumber(diagnostics ?? {}, [
      "agentTaskResumeFailedTotal",
      "agent_task_resume_failed_total",
    ]);
  const oauthLoginSuccessRaw = payload.oauthLoginSuccess ?? payload.oauth_login_success;
  const oauthLoginSuccess = typeof oauthLoginSuccessRaw === "boolean" ? oauthLoginSuccessRaw : null;
  const oauthLoginId = readFieldString(payload, ["oauthLoginId", "oauth_login_id"]);
  const oauthLoginError = readFieldString(payload, ["oauthLoginError", "oauth_login_error"]);
  const workspaceId = readFieldString(payload, ["workspaceId", "workspace_id"]);
  const updatedAt =
    readFieldNumber(payload, ["updatedAt", "updated_at", "timestamp", "ts"]) ??
    parseIsoTimestampToEpochMs(emittedAt);
  const params: UnknownRecord = {
    revision: readFieldString(payload, ["revision"]),
    scope,
    reason: readFieldString(payload, ["reason"]),
  };
  if (workspaceId) {
    params.workspaceId = workspaceId;
  }
  if (updatedAt !== null) {
    params.updatedAt = updatedAt;
  }
  if (replayGapLastEventId !== null) {
    params.replayGapLastEventId = replayGapLastEventId;
  }
  if (replayGapOldestEventId !== null) {
    params.replayGapOldestEventId = replayGapOldestEventId;
  }
  if (streamLaggedDroppedEvents !== null) {
    params.streamLaggedDroppedEvents = streamLaggedDroppedEvents;
  }
  if (backendsTotal !== null) {
    params.backendsTotal = backendsTotal;
  }
  if (backendsHealthy !== null) {
    params.backendsHealthy = backendsHealthy;
  }
  if (backendsDraining !== null) {
    params.backendsDraining = backendsDraining;
  }
  if (placementFailuresTotal !== null) {
    params.placementFailuresTotal = placementFailuresTotal;
  }
  if (queueDepth !== null) {
    params.queueDepth = queueDepth;
  }
  if (accessMode) {
    params.accessMode = accessMode;
  }
  if (routedProvider) {
    params.routedProvider = routedProvider;
  }
  if (executionMode !== null) {
    params.executionMode = executionMode;
  }
  if (diagnosticReason) {
    params.diagnosticReason = diagnosticReason;
  }
  if (mode) {
    params.mode = mode;
  }
  if (degraded !== null) {
    params.degraded = degraded;
  }
  if (checkpointWriteTotal !== null) {
    params.checkpointWriteTotal = checkpointWriteTotal;
  }
  if (checkpointWriteFailedTotal !== null) {
    params.checkpointWriteFailedTotal = checkpointWriteFailedTotal;
  }
  if (agentTaskCheckpointRecoverTotal !== null) {
    params.agentTaskCheckpointRecoverTotal = agentTaskCheckpointRecoverTotal;
  }
  if (subagentCheckpointRecoverTotal !== null) {
    params.subagentCheckpointRecoverTotal = subagentCheckpointRecoverTotal;
  }
  if (runtimeRecoveryInterruptTotal !== null) {
    params.runtimeRecoveryInterruptTotal = runtimeRecoveryInterruptTotal;
  }
  if (agentTaskResumeTotal !== null) {
    params.agentTaskResumeTotal = agentTaskResumeTotal;
  }
  if (agentTaskResumeFailedTotal !== null) {
    params.agentTaskResumeFailedTotal = agentTaskResumeFailedTotal;
  }
  if (oauthLoginSuccess !== null) {
    params.oauthLoginSuccess = oauthLoginSuccess;
  }
  if (oauthLoginId) {
    params.oauthLoginId = oauthLoginId;
  }
  if (oauthLoginError) {
    params.oauthLoginError = oauthLoginError;
  }
  return {
    method: "native_state_fabric_updated",
    params,
  };
}

function adaptRuntimeHostEventToAppServerEvent(
  event: CodeRuntimeHostEventEnvelope
): AppServerEvent | null {
  const payload = isRecord(event.payload) ? event.payload : null;
  if (!payload) {
    return null;
  }

  const requestId = readNonEmptyString(event.requestId);
  const turnId = readFieldString(payload, ["turnId", "turn_id"]) ?? "runtime-turn";
  const requestContext = getRuntimeTurnContextFromRequestId(requestId);
  const turnContext = getRuntimeTurnContextFromTurnId(turnId);
  if (!turnContext && requestContext) {
    registerRuntimeTurnContextByTurnIdInternal(
      turnId,
      requestContext.workspaceId,
      requestContext.threadId
    );
  }
  const resolvedContext = turnContext ?? requestContext;
  const workspaceId =
    readWorkspaceIdFromRuntimeHostEvent(event) ??
    resolvedContext?.workspaceId ??
    DEFAULT_RUNTIME_WORKSPACE_ID;
  const threadId =
    readFieldString(payload, ["threadId", "thread_id"]) ??
    resolvedContext?.threadId ??
    (turnId.startsWith("thread-") ? turnId : "");
  const approvalId = readFieldString(payload, ["approvalId", "approval_id"]);

  let method: string | null = null;
  let params: UnknownRecord | null = null;

  if (event.kind === "turn.started") {
    method = "turn/started";
    params = {
      threadId,
      turnId,
      turn: {
        id: turnId,
        threadId,
      },
    };
  } else if (event.kind === "item.agentMessage.delta") {
    const stepIndex = readFieldNumber(payload, ["stepIndex", "step_index"]);
    const transient = readFieldBoolean(payload, ["transient"]);
    method = "item/agentMessage/delta";
    params = {
      threadId,
      turnId,
      itemId: readFieldString(payload, ["itemId", "item_id"]) ?? turnId,
      delta: typeof payload.delta === "string" ? payload.delta : "",
    };
    if (stepIndex !== null) {
      params.stepIndex = stepIndex;
    }
    if (transient !== null) {
      params.transient = transient;
    }
  } else if (event.kind === "turn.completed") {
    const accessMode = readFieldString(payload, ["accessMode", "access_mode"]);
    const routedProvider = readFieldString(payload, ["routedProvider", "routed_provider"]);
    const routedModelId = readFieldString(payload, ["routedModelId", "routed_model_id"]);
    const routedPool = readFieldString(payload, ["routedPool", "routed_pool"]);
    const routedSource = readFieldString(payload, ["routedSource", "routed_source"]);
    const executionMode = readFieldExecutionMode(payload, ["executionMode", "execution_mode"]);
    const recoveredFromStaleResume = readFieldBoolean(payload, [
      "recoveredFromStaleResume",
      "recovered_from_stale_resume",
    ]);
    method = "turn/completed";
    params = {
      threadId,
      turnId,
      output: readFieldString(payload, ["output"]),
      turn: {
        id: turnId,
        threadId,
      },
    };
    if (accessMode) {
      params.accessMode = accessMode;
    }
    if (routedProvider) {
      params.routedProvider = routedProvider;
    }
    if (routedModelId) {
      params.routedModelId = routedModelId;
    }
    if (routedPool) {
      params.routedPool = routedPool;
    }
    if (routedSource) {
      params.routedSource = routedSource;
    }
    if (executionMode !== null) {
      params.executionMode = executionMode;
    }
    if (recoveredFromStaleResume !== null) {
      params.recoveredFromStaleResume = recoveredFromStaleResume;
    }
  } else if (event.kind === "turn.failed") {
    const error = readRecordField(payload, "error") ?? {};
    const accessMode = readFieldString(payload, ["accessMode", "access_mode"]);
    const routedProvider = readFieldString(payload, ["routedProvider", "routed_provider"]);
    const executionMode = readFieldExecutionMode(payload, ["executionMode", "execution_mode"]);
    method = "error";
    params = {
      threadId,
      turnId,
      error: {
        code: readFieldString(error, ["code"]) ?? "TURN_FAILED",
        message: readFieldString(error, ["message"]) ?? "Turn execution failed.",
      },
      willRetry: false,
    };
    if (accessMode) {
      params.accessMode = accessMode;
    }
    if (routedProvider) {
      params.routedProvider = routedProvider;
    }
    if (executionMode !== null) {
      params.executionMode = executionMode;
    }
  } else if (event.kind === "item.started") {
    const adapted = adaptToolCallingRuntimeEvent(payload, turnId, threadId);
    method = adapted.method;
    params = adapted.params;
  } else if (event.kind === "item.updated") {
    const adapted = adaptItemUpdatedRuntimeEvent(payload, turnId, threadId);
    method = adapted.method;
    params = adapted.params;
  } else if (event.kind === "item.completed") {
    const adapted = adaptToolResultRuntimeEvent(payload, turnId, threadId);
    method = adapted.method;
    params = adapted.params;
  } else if (event.kind === "item.mcpToolCall.progress") {
    const adapted = adaptItemMcpToolCallProgressRuntimeEvent(payload, turnId, threadId);
    if (!adapted) {
      return null;
    }
    method = adapted.method;
    params = adapted.params;
  } else if (event.kind === "approval.required") {
    method = "runtime/requestApproval";
    const input = readRecordField(payload, "input") ?? {};
    params = {
      threadId,
      turnId,
      approvalId,
      reason: readFieldString(payload, ["reason"]) ?? "Approval required.",
      action: readFieldString(payload, ["action"]),
      command:
        readFieldString(input, ["command", "cmd", "exec", "script"]) ??
        readFieldString(payload, ["action"]),
      input,
    };
  } else if (event.kind === "approval.resolved") {
    method = "runtime/approvalResolved";
    const status = readFieldApprovalResolutionStatus(payload);
    const decision = readFieldString(payload, ["decision"]);
    const reason = readFieldString(payload, ["reason"]);
    const action = readFieldString(payload, ["action"]);
    params = {
      threadId,
      turnId,
      approvalId,
      ...(status ? { status } : {}),
      ...(decision ? { decision } : {}),
      ...(reason ? { reason } : {}),
      ...(action ? { action } : {}),
    };
  } else if (event.kind === "native_state_fabric_updated") {
    const adapted = adaptRuntimeUpdatedRuntimeEvent(payload, event.emittedAt);
    method = adapted.method;
    params = adapted.params;
  } else if (event.kind === "thread.live_update") {
    const reason = readFieldString(payload, ["reason"]);
    method = "native_state_fabric_updated";
    params = {
      scopeKind: "thread",
      workspaceId,
      threadId,
      subscriptionId: readFieldString(payload, ["subscriptionId", "subscription_id"]) ?? "",
      changeKind: "threadLiveStatePatched",
      ...(reason ? { reason } : {}),
    };
  } else if (event.kind === "thread.live_heartbeat") {
    const sentAtMs = readFieldNumber(payload, ["sentAtMs", "sent_at_ms"]);
    const heartbeatIntervalMs = readFieldNumber(payload, [
      "heartbeatIntervalMs",
      "heartbeat_interval_ms",
    ]);
    method = "native_state_fabric_updated";
    params = {
      scopeKind: "thread",
      workspaceId,
      threadId,
      subscriptionId: readFieldString(payload, ["subscriptionId", "subscription_id"]) ?? "",
      changeKind: "threadLiveHeartbeatObserved",
      ...(sentAtMs !== null ? { sentAtMs } : {}),
      ...(heartbeatIntervalMs !== null ? { heartbeatIntervalMs } : {}),
    };
  } else if (event.kind === "thread.live_detached") {
    const reason = readFieldString(payload, ["reason"]);
    method = "native_state_fabric_updated";
    params = {
      scopeKind: "thread",
      workspaceId,
      threadId,
      subscriptionId: readFieldString(payload, ["subscriptionId", "subscription_id"]) ?? "",
      changeKind: "threadLiveDetached",
      ...(reason ? { reason } : {}),
    };
  }

  if (!method || !params) {
    return null;
  }

  if (threadId) {
    if (requestId) {
      registerRuntimeTurnRequestContextInternal(requestId, workspaceId, threadId);
    }
    if (turnId) {
      registerRuntimeTurnContextByTurnIdInternal(turnId, workspaceId, threadId);
    }
  }

  const message: UnknownRecord = {
    method,
    params,
  };
  const messageId = approvalId ?? requestId;
  if (messageId) {
    message.id = messageId;
  }

  return {
    workspace_id: workspaceId,
    message,
  };
}

export function normalizeAppServerPayload(payload: unknown): AppServerEvent | null {
  if (isAppServerEvent(payload)) {
    return payload;
  }
  const runtimeEvent = parseRuntimeHostEventEnvelope(payload);
  if (!runtimeEvent) {
    return null;
  }
  return adaptRuntimeHostEventToAppServerEvent(runtimeEvent);
}
