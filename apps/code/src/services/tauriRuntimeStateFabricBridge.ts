import { invoke, isTauri } from "@tauri-apps/api/core";
import type {
  NativeStateFabricChange,
  NativeStateFabricDelta,
  NativeStateFabricDiagnostics,
  NativeStateFabricEnvelope,
  NativeStateFabricResyncRequired,
  NativeStateFabricScope,
  NativeStateFabricSnapshot,
} from "@ku0/native-runtime-host-contract";
import { detectRuntimeMode } from "./runtimeClient";
import { invokeWebRuntimeDirectRpc } from "./runtimeWebDirectRpc";

type RpcEnvelope = {
  result?: unknown;
  data?: unknown;
};

export type NativeStateFabricDeltaRead = NativeStateFabricDelta | NativeStateFabricResyncRequired;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Invalid native state fabric ${label}.`);
  }
  return value;
}

function extractRpcPayload(payload: unknown): unknown {
  if (!isRecord(payload)) {
    return payload;
  }
  const envelope = payload as RpcEnvelope;
  if (envelope.result !== undefined) {
    return envelope.result;
  }
  if (envelope.data !== undefined) {
    return envelope.data;
  }
  return payload;
}

function normalizeScope(value: unknown): NativeStateFabricScope {
  if (!isRecord(value)) {
    throw new Error("Invalid native state fabric scope.");
  }
  const kind = normalizeText(value.kind);
  if (!kind) {
    throw new Error("Invalid native state fabric scope.");
  }
  switch (kind) {
    case "global":
      return { kind };
    case "workspace": {
      const workspaceId = normalizeText(value.workspaceId);
      if (!workspaceId) {
        throw new Error("Invalid native state fabric workspace scope.");
      }
      return { kind, workspaceId };
    }
    case "thread": {
      const workspaceId = normalizeText(value.workspaceId);
      const threadId = normalizeText(value.threadId);
      if (!workspaceId || !threadId) {
        throw new Error("Invalid native state fabric thread scope.");
      }
      return { kind, workspaceId, threadId };
    }
    case "terminal": {
      const workspaceId = normalizeText(value.workspaceId);
      const sessionId = normalizeText(value.sessionId);
      if (!workspaceId || !sessionId) {
        throw new Error("Invalid native state fabric terminal scope.");
      }
      return { kind, workspaceId, sessionId };
    }
    case "skills":
      return {
        kind,
        workspaceId: normalizeText(value.workspaceId) ?? undefined,
      };
    case "task": {
      const taskId = normalizeText(value.taskId);
      if (!taskId) {
        throw new Error("Invalid native state fabric task scope.");
      }
      return { kind, taskId };
    }
    case "run": {
      const runId = normalizeText(value.runId);
      if (!runId) {
        throw new Error("Invalid native state fabric run scope.");
      }
      return { kind, runId };
    }
    default:
      throw new Error(`Unsupported native state fabric scope kind: ${kind}`);
  }
}

function normalizeChange(value: unknown): NativeStateFabricChange {
  if (!isRecord(value)) {
    throw new Error("Invalid native state fabric change.");
  }
  const kind = normalizeText(value.kind);
  if (!kind) {
    throw new Error("Invalid native state fabric change.");
  }
  const workspaceId = normalizeText(value.workspaceId);
  const threadId = normalizeText(value.threadId);
  const taskId = normalizeText(value.taskId);
  const runId = normalizeText(value.runId);
  const sessionId = normalizeText(value.sessionId);
  switch (kind) {
    case "workspaceUpsert":
    case "workspaceRemove":
      if (!workspaceId) {
        throw new Error(`Invalid native state fabric change: ${kind}.`);
      }
      return { kind, workspaceId };
    case "threadUpsert":
    case "threadRemove":
    case "threadLiveStatePatched":
    case "threadLiveHeartbeatObserved":
    case "threadLiveDetached":
      if (!workspaceId || !threadId) {
        throw new Error(`Invalid native state fabric change: ${kind}.`);
      }
      return { kind, workspaceId, threadId };
    case "taskUpsert":
    case "taskRemove":
      if (!taskId) {
        throw new Error(`Invalid native state fabric change: ${kind}.`);
      }
      return { kind, taskId, workspaceId: workspaceId ?? undefined };
    case "runUpsert":
    case "runRemove":
      if (!runId) {
        throw new Error(`Invalid native state fabric change: ${kind}.`);
      }
      return {
        kind,
        runId,
        taskId: taskId ?? undefined,
        workspaceId: workspaceId ?? undefined,
      };
    case "terminalSessionUpsert":
    case "terminalOutputAppended":
    case "terminalSessionStatePatched":
      if (!workspaceId || !sessionId) {
        throw new Error(`Invalid native state fabric change: ${kind}.`);
      }
      return { kind, workspaceId, sessionId };
    case "skillsCatalogPatched":
    case "skillsWatcherStatePatched":
    case "skillsFingerprintPatched":
      return { kind, workspaceId: workspaceId ?? undefined };
    case "runtimeCapabilitiesPatched":
      return { kind };
    default:
      throw new Error(`Unsupported native state fabric change kind: ${kind}`);
  }
}

function normalizeEnvelope(value: unknown): NativeStateFabricEnvelope {
  if (!isRecord(value)) {
    throw new Error("Invalid native state fabric envelope.");
  }
  return {
    revision: normalizeNumber(value.revision, "envelope revision"),
    emittedAt: normalizeNumber(value.emittedAt, "envelope emittedAt"),
    scopeHints: Array.isArray(value.scopeHints)
      ? value.scopeHints.map((entry) => normalizeScope(entry))
      : [],
    change: normalizeChange(value.change),
  };
}

function normalizeSnapshot(value: unknown): NativeStateFabricSnapshot {
  if (!isRecord(value) || !isRecord(value.state)) {
    throw new Error("Invalid native state fabric snapshot.");
  }
  return {
    revision: normalizeNumber(value.revision, "snapshot revision"),
    scope: normalizeScope(value.scope),
    state: value.state,
  };
}

function normalizeDelta(value: unknown): NativeStateFabricDelta {
  if (!isRecord(value) || !Array.isArray(value.changes)) {
    throw new Error("Invalid native state fabric delta.");
  }
  return {
    baseRevision: normalizeNumber(value.baseRevision, "delta baseRevision"),
    revision: normalizeNumber(value.revision, "delta revision"),
    scope: normalizeScope(value.scope),
    changes: value.changes.map((entry) => normalizeEnvelope(entry)),
  };
}

function normalizeResyncRequired(value: unknown): NativeStateFabricResyncRequired {
  if (!isRecord(value)) {
    throw new Error("Invalid native state fabric resync payload.");
  }
  return {
    requestedRevision: normalizeNumber(value.requestedRevision, "resync requestedRevision"),
    latestRevision: normalizeNumber(value.latestRevision, "resync latestRevision"),
    oldestAvailableRevision:
      value.oldestAvailableRevision === null
        ? null
        : normalizeNumber(value.oldestAvailableRevision, "resync oldestAvailableRevision"),
    scope: normalizeScope(value.scope),
  };
}

function normalizeDiagnostics(value: unknown): NativeStateFabricDiagnostics {
  if (!isRecord(value)) {
    throw new Error("Invalid native state fabric diagnostics.");
  }
  return {
    revision: normalizeNumber(value.revision, "diagnostics revision"),
    oldestAvailableRevision:
      value.oldestAvailableRevision === null
        ? null
        : normalizeNumber(value.oldestAvailableRevision, "diagnostics oldestAvailableRevision"),
    retainedChangeCount: normalizeNumber(
      value.retainedChangeCount,
      "diagnostics retainedChangeCount"
    ),
    retainedChangeBytes:
      value.retainedChangeBytes === undefined
        ? undefined
        : normalizeNumber(value.retainedChangeBytes, "diagnostics retainedChangeBytes"),
    projectionKeys: Array.isArray(value.projectionKeys)
      ? value.projectionKeys
          .map((entry) => normalizeText(entry))
          .filter((entry): entry is string => Boolean(entry))
      : undefined,
  };
}

async function invokeNativeStateFabric(method: string, params: Record<string, unknown> = {}) {
  if (isTauri()) {
    return extractRpcPayload(await invoke(method, params));
  }
  if (detectRuntimeMode() === "runtime-gateway-web") {
    return extractRpcPayload(await invokeWebRuntimeDirectRpc(method, params));
  }
  throw new Error("Native state fabric is unavailable outside desktop/runtime-gateway mode.");
}

export async function getNativeStateFabricSnapshot(
  scope: NativeStateFabricScope
): Promise<NativeStateFabricSnapshot> {
  return normalizeSnapshot(
    await invokeNativeStateFabric("native_state_fabric_snapshot", { scope })
  );
}

export async function getNativeStateFabricDelta(input: {
  scope: NativeStateFabricScope;
  revision: number;
}): Promise<NativeStateFabricDeltaRead> {
  const payload = await invokeNativeStateFabric("native_state_fabric_delta", {
    scope: input.scope,
    revision: input.revision,
  });
  if (isRecord(payload) && Array.isArray(payload.changes)) {
    return normalizeDelta(payload);
  }
  return normalizeResyncRequired(payload);
}

export async function getNativeStateFabricDiagnostics(): Promise<NativeStateFabricDiagnostics> {
  return normalizeDiagnostics(await invokeNativeStateFabric("native_state_fabric_diagnostics"));
}
