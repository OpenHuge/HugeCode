import { detectRuntimeMode, getRuntimeClient } from "./runtimeClient";
import {
  getErrorMessage,
  isWebRuntimeConnectionError,
  type LooseResultEnvelope,
} from "./tauriRuntimeTransport";
import {
  logRuntimeWarning,
  type RuntimeThreadSummary,
  toRuntimeThreadRecord,
} from "./tauriRuntimeTurnHelpers";
import { recordLegacyLifecycleUsage } from "./runtimeLegacyLifecycleTelemetry";
import { resolveRuntimeWorkspacePath } from "./tauriWorkspaceBridge";

type LegacyThreadTelemetryOptions = {
  telemetrySource?: string | null;
};

export async function startThread(
  workspaceId: string,
  options?: LegacyThreadTelemetryOptions
): Promise<LooseResultEnvelope> {
  recordLegacyLifecycleUsage({
    method: "code_thread_create",
    workspaceId,
    source: options?.telemetrySource ?? "thread_actions",
  });
  const runtimeThread = (await getRuntimeClient().createThread({
    workspaceId,
    title: null,
  })) as RuntimeThreadSummary;
  const cwd = await resolveRuntimeWorkspacePath(workspaceId);
  return {
    result: {
      thread: toRuntimeThreadRecord(runtimeThread, cwd),
    },
  };
}

export async function interruptTurn(workspaceId: string, _threadId: string, turnId: string) {
  void workspaceId;
  const interrupted = await getRuntimeClient().interruptTurn({
    turnId: turnId === "pending" ? null : turnId,
    reason: null,
  });
  return {
    result: {
      interrupted: Boolean(interrupted),
    },
  };
}

export async function listThreads(
  workspaceId: string,
  cursor?: string | null,
  limit?: number | null,
  sortKey?: "created_at" | "updated_at" | null
): Promise<LooseResultEnvelope> {
  try {
    const runtimeThreads = (await getRuntimeClient().threads(
      workspaceId
    )) as RuntimeThreadSummary[];
    const cwd = await resolveRuntimeWorkspacePath(workspaceId);
    const mapped = runtimeThreads.map((thread) => toRuntimeThreadRecord(thread, cwd));
    mapped.sort((left, right) => {
      const leftCreated = Number(left.createdAt ?? 0);
      const rightCreated = Number(right.createdAt ?? 0);
      const leftUpdated = Number(left.updatedAt ?? 0);
      const rightUpdated = Number(right.updatedAt ?? 0);
      if (sortKey === "created_at") {
        return rightCreated - leftCreated;
      }
      return rightUpdated - leftUpdated;
    });
    const normalizedLimit = typeof limit === "number" && Number.isFinite(limit) ? limit : null;
    const data = normalizedLimit && normalizedLimit > 0 ? mapped.slice(0, normalizedLimit) : mapped;
    void cursor;
    return {
      result: {
        data,
        nextCursor: null,
      },
    };
  } catch (error) {
    if (detectRuntimeMode() === "runtime-gateway-web" && isWebRuntimeConnectionError(error)) {
      logRuntimeWarning("Web runtime thread list unavailable; returning empty thread list.", {
        workspaceId,
        error: getErrorMessage(error),
      });
      return {
        result: {
          data: [],
          nextCursor: null,
        },
      };
    }
    throw error;
  }
}

export async function resumeThread(
  workspaceId: string,
  threadId: string,
  options?: LegacyThreadTelemetryOptions
): Promise<LooseResultEnvelope> {
  recordLegacyLifecycleUsage({
    method: "code_thread_resume",
    workspaceId,
    threadId,
    source: options?.telemetrySource ?? "thread_actions",
  });
  const runtimeThread = (await getRuntimeClient().resumeThread(
    workspaceId,
    threadId
  )) as RuntimeThreadSummary | null;
  const cwd = await resolveRuntimeWorkspacePath(workspaceId);
  return {
    result: {
      thread: runtimeThread ? toRuntimeThreadRecord(runtimeThread, cwd) : null,
    },
  };
}

export async function archiveThread(
  workspaceId: string,
  threadId: string,
  options?: LegacyThreadTelemetryOptions
): Promise<LooseResultEnvelope> {
  recordLegacyLifecycleUsage({
    method: "code_thread_archive",
    workspaceId,
    threadId,
    source: options?.telemetrySource ?? "thread_actions",
  });
  const archived = await getRuntimeClient().archiveThread(workspaceId, threadId);
  return {
    result: {
      archived: Boolean(archived),
    },
  };
}
