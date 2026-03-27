import { invoke, isTauri } from "../application/runtime/ports/tauriCore";
import { logger } from "./logger";
import {
  isRuntimeMethodUnsupportedError,
  isWebRuntimeConnectionError,
} from "@ku0/code-runtime-client/runtimeErrorClassifier";
import { detectRuntimeMode } from "./runtimeClient";
import { invokeWebRuntimeDirectRpc } from "./runtimeWebDirectRpc";

export type NativeScheduleRecord = Record<string, unknown> & {
  id: string;
  enabled: boolean;
  name: string | null;
  status: string | null;
  cron: string | null;
  updatedAt: number | null;
  lastActionAt: number | null;
};

export type NativeScheduleListRequest = {
  workspaceId?: string | null;
};

export type NativeScheduleCreateRequest = {
  workspaceId?: string | null;
  scheduleId?: string | null;
  schedule: Record<string, unknown>;
};

export type NativeScheduleUpdateRequest = {
  workspaceId?: string | null;
  scheduleId: string;
  schedule: Record<string, unknown>;
};

export type NativeScheduleDeleteRequest = {
  workspaceId?: string | null;
  scheduleId: string;
};

export type NativeScheduleRunRequest = {
  workspaceId?: string | null;
  scheduleId: string;
};

type NativeScheduleRpcEnvelope = {
  ok?: boolean;
  result?: unknown;
  data?: unknown;
};

type RuntimeOptionalMethodFallback<Result> = {
  message: string;
  details: Record<string, unknown>;
  value: Result | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeNumber(value: unknown): number | null {
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

function isTauriRuntime(): boolean {
  try {
    return isTauri();
  } catch {
    return false;
  }
}

function extractNativeSchedulePayload(payload: unknown): unknown {
  if (!isRecord(payload)) {
    return payload;
  }
  const envelope = payload as NativeScheduleRpcEnvelope;
  if (envelope.result !== undefined) {
    const result = envelope.result;
    if (isRecord(result) && Array.isArray(result.data)) {
      return result.data;
    }
    return result;
  }
  if (envelope.data !== undefined) {
    return envelope.data;
  }
  return payload;
}

function extractNativeScheduleListEntries(payload: unknown): unknown[] {
  const unwrapped = extractNativeSchedulePayload(payload);
  if (Array.isArray(unwrapped)) {
    return unwrapped;
  }
  if (!isRecord(unwrapped)) {
    return [];
  }
  if (Array.isArray(unwrapped.result)) {
    return unwrapped.result;
  }
  if (Array.isArray(unwrapped.data)) {
    return unwrapped.data;
  }
  const nestedResult = isRecord(unwrapped.result) ? unwrapped.result : null;
  if (Array.isArray(nestedResult?.data)) {
    return nestedResult.data;
  }
  return [];
}

function normalizeNativeScheduleRecord(value: unknown): NativeScheduleRecord | null {
  if (!isRecord(value)) {
    return null;
  }
  const id = normalizeText(value.id);
  if (!id) {
    return null;
  }
  const enabled = typeof value.enabled === "boolean" ? value.enabled : true;
  const updatedAt = normalizeNumber(value.updatedAt ?? value.updated_at);
  const lastActionAt = normalizeNumber(value.lastActionAt ?? value.last_action_at);
  const name =
    normalizeText(value.name) ??
    normalizeText(value.displayName) ??
    normalizeText(value.display_name);
  const status = normalizeText(value.status);
  const cron = normalizeText(value.cron);

  return {
    ...value,
    id,
    enabled,
    name,
    status,
    cron,
    updatedAt,
    lastActionAt,
  };
}

function normalizeNativeScheduleRecords(payload: unknown): NativeScheduleRecord[] | null {
  if (payload === null) {
    return null;
  }
  return extractNativeScheduleListEntries(payload)
    .map((entry) => normalizeNativeScheduleRecord(entry))
    .filter((entry): entry is NativeScheduleRecord => Boolean(entry));
}

function normalizeNativeScheduleResult(payload: unknown): NativeScheduleRecord | null {
  if (payload === null) {
    return null;
  }
  return normalizeNativeScheduleRecord(extractNativeSchedulePayload(payload));
}

function normalizeBooleanResult(payload: unknown): boolean {
  const unwrapped = extractNativeSchedulePayload(payload);
  if (typeof unwrapped === "boolean") {
    return unwrapped;
  }
  return false;
}

function logNativeScheduleWarning(message: string, context: Record<string, unknown>): void {
  logger.warn(message, context);
}

async function invokeNativeScheduleRpc<Result>(
  method: string,
  params: Record<string, unknown>,
  options?: {
    webConnectionFallback?: RuntimeOptionalMethodFallback<Result>;
  }
): Promise<Result | null> {
  const runtimeMode = detectRuntimeMode();
  try {
    if (isTauriRuntime()) {
      return await invoke<Result>(method, params);
    }
    if (runtimeMode === "runtime-gateway-web") {
      return (await invokeWebRuntimeDirectRpc(method, params)) as Result;
    }
    return options?.webConnectionFallback?.value ?? null;
  } catch (error) {
    if (isRuntimeMethodUnsupportedError(error)) {
      return null;
    }
    if (
      options?.webConnectionFallback &&
      runtimeMode === "runtime-gateway-web" &&
      isWebRuntimeConnectionError(error)
    ) {
      logNativeScheduleWarning(options.webConnectionFallback.message, {
        ...options.webConnectionFallback.details,
        error: error instanceof Error ? error.message : String(error),
      });
      return options.webConnectionFallback.value;
    }
    throw error;
  }
}

export async function listNativeSchedules(
  request: NativeScheduleListRequest = {}
): Promise<NativeScheduleRecord[] | null> {
  void request.workspaceId;
  const payload = await invokeNativeScheduleRpc<unknown>(
    "native_schedules_list",
    {},
    {
      webConnectionFallback: {
        message:
          "Web native schedules list unavailable; schedule state is read-only until a runtime-backed connection is restored.",
        details: {
          workspaceId: request.workspaceId ?? null,
        },
        value: null,
      },
    }
  );
  return normalizeNativeScheduleRecords(payload);
}

export async function createNativeSchedule(
  request: NativeScheduleCreateRequest
): Promise<NativeScheduleRecord | null> {
  const { workspaceId, scheduleId, schedule } = request;
  const trimmedScheduleId = normalizeText(scheduleId);
  const normalizedSchedule = isRecord(schedule) ? schedule : null;
  if (!normalizedSchedule) {
    return null;
  }
  const params: Record<string, unknown> = {
    schedule: normalizedSchedule,
  };
  if (trimmedScheduleId) {
    params.scheduleId = trimmedScheduleId;
  }
  const payload = await invokeNativeScheduleRpc<unknown>("native_schedule_create", params, {
    webConnectionFallback: {
      message:
        "Web native schedule create unavailable; schedule state is read-only until a runtime-backed connection is restored.",
      details: {
        workspaceId: workspaceId ?? null,
        scheduleId: trimmedScheduleId,
      },
      value: null,
    },
  });
  return normalizeNativeScheduleResult(payload);
}

export async function updateNativeSchedule(
  request: NativeScheduleUpdateRequest
): Promise<NativeScheduleRecord | null> {
  const { workspaceId, scheduleId, schedule } = request;
  const trimmedScheduleId = normalizeText(scheduleId);
  const normalizedSchedule = isRecord(schedule) ? schedule : null;
  if (!trimmedScheduleId || !normalizedSchedule) {
    return null;
  }
  const payload = await invokeNativeScheduleRpc<unknown>(
    "native_schedule_update",
    {
      scheduleId: trimmedScheduleId,
      schedule: normalizedSchedule,
    },
    {
      webConnectionFallback: {
        message:
          "Web native schedule update unavailable; schedule state is read-only until a runtime-backed connection is restored.",
        details: {
          workspaceId: workspaceId ?? null,
          scheduleId: trimmedScheduleId,
        },
        value: null,
      },
    }
  );
  return normalizeNativeScheduleResult(payload);
}

export async function deleteNativeSchedule(request: NativeScheduleDeleteRequest): Promise<boolean> {
  const { workspaceId, scheduleId } = request;
  const trimmedScheduleId = normalizeText(scheduleId);
  if (!trimmedScheduleId) {
    return false;
  }
  const payload = await invokeNativeScheduleRpc<unknown>(
    "native_schedule_delete",
    {
      scheduleId: trimmedScheduleId,
    },
    {
      webConnectionFallback: {
        message:
          "Web native schedule delete unavailable; schedule state is read-only until a runtime-backed connection is restored.",
        details: {
          workspaceId: workspaceId ?? null,
          scheduleId: trimmedScheduleId,
        },
        value: false,
      },
    }
  );
  return normalizeBooleanResult(payload);
}

export async function runNativeScheduleNow(
  request: NativeScheduleRunRequest
): Promise<NativeScheduleRecord | null> {
  const { workspaceId, scheduleId } = request;
  const trimmedScheduleId = normalizeText(scheduleId);
  const trimmedWorkspaceId = normalizeText(workspaceId);
  if (!trimmedScheduleId) {
    return null;
  }
  const params: Record<string, unknown> = {
    scheduleId: trimmedScheduleId,
  };
  if (trimmedWorkspaceId) {
    params.workspaceId = trimmedWorkspaceId;
  }
  const payload = await invokeNativeScheduleRpc<unknown>("native_schedule_run_now", params, {
    webConnectionFallback: {
      message:
        "Web native schedule run-now unavailable; schedule state is read-only until a runtime-backed connection is restored.",
      details: {
        workspaceId: workspaceId ?? null,
        scheduleId: trimmedScheduleId,
      },
      value: null,
    },
  });
  return normalizeNativeScheduleResult(payload);
}

export async function cancelNativeScheduleRun(
  request: NativeScheduleRunRequest
): Promise<NativeScheduleRecord | null> {
  const { workspaceId, scheduleId } = request;
  const trimmedScheduleId = normalizeText(scheduleId);
  const trimmedWorkspaceId = normalizeText(workspaceId);
  if (!trimmedScheduleId) {
    return null;
  }
  const params: Record<string, unknown> = {
    scheduleId: trimmedScheduleId,
  };
  if (trimmedWorkspaceId) {
    params.workspaceId = trimmedWorkspaceId;
  }
  const payload = await invokeNativeScheduleRpc<unknown>("native_schedule_cancel_run", params, {
    webConnectionFallback: {
      message:
        "Web native schedule cancel unavailable; schedule state is read-only until a runtime-backed connection is restored.",
      details: {
        workspaceId: workspaceId ?? null,
        scheduleId: trimmedScheduleId,
      },
      value: null,
    },
  });
  return normalizeNativeScheduleResult(payload);
}
