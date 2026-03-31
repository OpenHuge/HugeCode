import {
  normalizeRuntimeProviderCatalogEntry,
  normalizeRuntimeTaskForProjection,
} from "../../../application/runtime/facades/runtimeMissionControlProjectionNormalization";
export {
  normalizeRuntimeProviderCatalogEntry,
  normalizeRuntimeTaskForProjection,
} from "../../../application/runtime/facades/runtimeMissionControlProjectionNormalization";
export {
  parseRuntimeParallelDispatchPlan as parseRuntimeBatchPreviewState,
  readRuntimeParallelDispatchPlanLaunchError,
} from "../../../application/runtime/facades/runtimeParallelDispatchManager";
import {
  readRuntimeErrorCode,
  readRuntimeErrorMessage,
} from "../../../application/runtime/ports/runtimeErrorClassifier";
import type {
  RuntimeAgentTaskInterruptResult,
  RuntimeAgentTaskResumeResult,
  RuntimeAgentTaskSummary,
} from "../../../application/runtime/types/webMcpBridge";
import { formatRuntimeTimestamp as formatWorkspaceRuntimeTimestamp } from "./workspaceHomeAgentControlState";

const DEFAULT_BATCH_PREVIEW = {
  enabled: false,
  maxParallel: 2,
  tasks: [
    {
      taskKey: "inspect",
      title: "Inspect runtime boundary",
      instruction: "Inspect runtime composition routing and summarize the abstraction seam.",
      preferredBackendIds: ["backend-inspect"],
      dependsOn: [],
      maxRetries: 1,
      onFailure: "halt",
    },
    {
      taskKey: "summarize",
      title: "Summarize orchestration impact",
      instruction: "Summarize dispatch progress and note any residual queue limits.",
      preferredBackendIds: ["backend-review"],
      dependsOn: ["inspect"],
      maxRetries: 1,
      onFailure: "continue",
    },
  ],
};

export type RuntimeDurabilityWarningState = {
  reason: string;
  revision: string;
  repeatCount: number;
  mode: string | null;
  degraded: boolean | null;
  checkpointWriteTotal: number | null;
  checkpointWriteFailedTotal: number | null;
  updatedAt: number;
  firstSeenAt: number;
  lastSeenAt: number;
  expiresAt: number;
};

export const STALE_PENDING_APPROVAL_MS = 10 * 60_000;

export const DEFAULT_RUNTIME_BATCH_PREVIEW_CONFIG = JSON.stringify(DEFAULT_BATCH_PREVIEW, null, 2);

function toNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function formatRuntimeError(error: unknown): string {
  const message = readRuntimeErrorMessage(error);
  const code = readRuntimeErrorCode(error);
  if (message && code) {
    return `${message} (${code})`;
  }
  if (message) {
    return message;
  }
  if (code) {
    return code;
  }
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message.trim();
  }
  if (typeof error === "string" && error.trim().length > 0) {
    return error.trim();
  }
  return "Unknown runtime error.";
}

export function formatRuntimeTimestamp(value: number | null): string {
  return formatWorkspaceRuntimeTimestamp(value);
}

export function formatTaskCheckpoint(
  task: Pick<RuntimeAgentTaskSummary, "checkpointId">
): string | null {
  return toNonEmptyString(task.checkpointId);
}

export function formatTaskTrace(task: Pick<RuntimeAgentTaskSummary, "traceId">): string | null {
  return toNonEmptyString(task.traceId);
}

export function isRecoverableRuntimeTask(
  task: Pick<RuntimeAgentTaskSummary, "status" | "errorCode" | "recovered">
): boolean {
  if (task.status !== "interrupted") {
    return false;
  }
  if (task.recovered === true) {
    return true;
  }
  const errorCode = task.errorCode?.trim().toLowerCase();
  return (
    errorCode === "runtime_restart_recovery" ||
    errorCode === "runtime.restart.recovery" ||
    errorCode === "runtime.task.interrupt.recoverable" ||
    errorCode === "runtime.task.interrupt.recovery"
  );
}

export function resolveRuntimeErrorLabel(
  value: RuntimeAgentTaskInterruptResult | RuntimeAgentTaskResumeResult | unknown
): string | null {
  if (isRecord(value)) {
    const code = toNonEmptyString(value.code);
    const message = toNonEmptyString(value.message);
    return code ?? message;
  }
  return null;
}
