import type { AppServerEvent } from "../types";

export const AGENT_TASK_DURABILITY_DEGRADED_REASON = "agent_task_durability_degraded";
export const RUNTIME_DURABILITY_WINDOW_MS = 30_000;

export type RuntimeDurabilityEventKey = {
  revision: string | null;
  workspaceId: string | null;
  reason: string;
};

export type RuntimeDurabilityDiagnostics = RuntimeDurabilityEventKey & {
  scope: string[];
  updatedAt: number | null;
  mode: string | null;
  degraded: boolean | null;
  checkpointWriteTotal: number | null;
  checkpointWriteFailedTotal: number | null;
  agentTaskCheckpointRecoverTotal: number | null;
  subagentCheckpointRecoverTotal: number | null;
  runtimeRecoveryInterruptTotal: number | null;
  agentTaskResumeTotal: number | null;
  agentTaskResumeFailedTotal: number | null;
};

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

function readBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value !== 0 : null;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "on", "enabled"].includes(normalized)) {
      return true;
    }
    if (["false", "0", "no", "off", "disabled"].includes(normalized)) {
      return false;
    }
  }
  return null;
}

function normalizeScope(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return [
    ...new Set(
      value
        .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
        .filter((entry) => entry.length > 0)
    ),
  ];
}

function parseWorkspaceIdFromParams(params: Record<string, unknown>): string | null {
  return readString(params.workspaceId ?? params.workspace_id);
}

export function parseRuntimeDurabilityRevision(params: Record<string, unknown>): string | null {
  return readString(params.revision);
}

export function isRuntimeDurabilityDegraded(params: Record<string, unknown>): boolean {
  return readString(params.reason) === AGENT_TASK_DURABILITY_DEGRADED_REASON;
}

export function parseRuntimeDurabilityWorkspaceId(
  event: Pick<AppServerEvent, "workspace_id"> | null | undefined,
  params: Record<string, unknown>
): string | null {
  const paramsWorkspaceId = parseWorkspaceIdFromParams(params);
  if (paramsWorkspaceId) {
    return paramsWorkspaceId;
  }
  const eventWorkspaceId = readString(event?.workspace_id);
  return eventWorkspaceId;
}

export function parseRuntimeDurabilityDiagnostics(
  params: Record<string, unknown>
): RuntimeDurabilityDiagnostics | null {
  if (!isRuntimeDurabilityDegraded(params)) {
    return null;
  }
  const reason = AGENT_TASK_DURABILITY_DEGRADED_REASON;
  const revision = parseRuntimeDurabilityRevision(params);
  const workspaceId = parseWorkspaceIdFromParams(params);

  return {
    reason,
    revision,
    workspaceId,
    scope: normalizeScope(params.scope),
    updatedAt: readNumber(params.updatedAt ?? params.updated_at ?? params.timestamp ?? params.ts),
    mode: readString(params.mode),
    degraded: readBoolean(params.degraded),
    checkpointWriteTotal: readNumber(params.checkpointWriteTotal ?? params.checkpoint_write_total),
    checkpointWriteFailedTotal: readNumber(
      params.checkpointWriteFailedTotal ?? params.checkpoint_write_failed_total
    ),
    agentTaskCheckpointRecoverTotal: readNumber(
      params.agentTaskCheckpointRecoverTotal ?? params.agent_task_checkpoint_recover_total
    ),
    subagentCheckpointRecoverTotal: readNumber(
      params.subagentCheckpointRecoverTotal ?? params.subagent_checkpoint_recover_total
    ),
    runtimeRecoveryInterruptTotal: readNumber(
      params.runtimeRecoveryInterruptTotal ?? params.runtime_recovery_interrupt_total
    ),
    agentTaskResumeTotal: readNumber(params.agentTaskResumeTotal ?? params.agent_task_resume_total),
    agentTaskResumeFailedTotal: readNumber(
      params.agentTaskResumeFailedTotal ?? params.agent_task_resume_failed_total
    ),
  };
}

export function serializeRuntimeDurabilityEventKey(
  key: RuntimeDurabilityEventKey,
  updatedAt: number | null
): string {
  if (key.revision) {
    return `revision:${key.revision}`;
  }
  return `fallback:${key.workspaceId ?? "workspace-local"}:${key.reason}:${updatedAt ?? 0}`;
}
