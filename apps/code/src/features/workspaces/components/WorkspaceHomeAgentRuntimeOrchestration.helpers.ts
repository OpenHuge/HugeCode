import {
  normalizeRuntimeProviderCatalogEntry,
  normalizeRuntimeTaskForProjection,
} from "../../../application/runtime/facades/runtimeMissionControlProjectionNormalization";
import {
  formatRuntimeError,
  resolveRuntimeErrorLabel,
} from "../../../application/runtime/facades/runtimeMissionControlErrorPresentation";
export {
  normalizeRuntimeProviderCatalogEntry,
  normalizeRuntimeTaskForProjection,
} from "../../../application/runtime/facades/runtimeMissionControlProjectionNormalization";
export {
  formatRuntimeError,
  resolveRuntimeErrorLabel,
} from "../../../application/runtime/facades/runtimeMissionControlErrorPresentation";
export {
  parseRuntimeParallelDispatchPlan as parseRuntimeBatchPreviewState,
  readRuntimeParallelDispatchPlanLaunchError,
} from "../../../application/runtime/facades/runtimeParallelDispatchManager";
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

type RuntimeSectionStatusPresentation = {
  label: "Ready" | "Blocked" | "Attention";
  tone: "success" | "danger" | "warning";
};

export function readBrowserReadinessPresentation(state: "ready" | "attention" | "blocked") {
  return {
    label: state === "ready" ? "Ready" : state === "blocked" ? "Blocked" : "Attention",
    tone:
      state === "ready"
        ? ("success" as const)
        : state === "blocked"
          ? ("danger" as const)
          : ("warning" as const),
  } satisfies RuntimeSectionStatusPresentation;
}

export function readLaunchReadinessPresentation(state: "ready" | "attention" | "blocked") {
  return {
    label: state === "ready" ? "Ready" : state === "blocked" ? "Blocked" : "Attention",
    tone:
      state === "ready"
        ? ("success" as const)
        : state === "blocked"
          ? ("danger" as const)
          : ("warning" as const),
  } satisfies RuntimeSectionStatusPresentation;
}

export function readPluginCatalogPresentation(input: {
  error: string | null;
  blockedCount: number;
  attentionCount: number;
  readyCount: number;
  total: number;
}) {
  if (input.error) {
    return {
      label: "Attention",
      tone: "warning" as const,
    };
  }
  if (input.blockedCount > 0) {
    return {
      label: "Blocked",
      tone: "danger" as const,
    };
  }
  if (input.attentionCount > 0) {
    return {
      label: "Attention",
      tone: "warning" as const,
    };
  }
  if (input.readyCount > 0) {
    return {
      label: "Ready",
      tone: "success" as const,
    };
  }
  if (input.total > 0) {
    return {
      label: "Cataloged",
      tone: "neutral" as const,
    };
  }
  return {
    label: "Empty",
    tone: "neutral" as const,
  };
}

function toNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
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

export function resolveRuntimeTaskErrorLabel(
  value: RuntimeAgentTaskInterruptResult | RuntimeAgentTaskResumeResult | unknown
): string | null {
  return resolveRuntimeErrorLabel(value);
}
