import {
  normalizeRuntimeProviderCatalogEntry,
  normalizeRuntimeTaskForProjection,
} from "../../../application/runtime/facades/runtimeMissionControlProjectionNormalization";
export {
  normalizeRuntimeProviderCatalogEntry,
  normalizeRuntimeTaskForProjection,
} from "../../../application/runtime/facades/runtimeMissionControlProjectionNormalization";
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
  maxParallel: 2,
  tasks: [
    {
      taskKey: "inspect",
      dependsOn: [],
      maxRetries: 1,
      onFailure: "halt",
    },
    {
      taskKey: "summarize",
      dependsOn: ["inspect"],
      maxRetries: 1,
      onFailure: "continue",
    },
  ],
};

type PreviewTaskFailurePolicy = "halt" | "continue" | "skip";

type PreviewTask = {
  taskKey: string;
  dependsOn: string[];
  maxRetries: number;
  onFailure: PreviewTaskFailurePolicy;
};

export type RuntimeBatchPreviewState = {
  maxParallel: number;
  tasks: PreviewTask[];
  duplicateTaskKeyHints: string[];
  dependencyHints: string[];
  cycleHint: string | null;
  parseError: string | null;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter((entry) => entry.length > 0);
}

function toNonNegativeInteger(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(0, Math.trunc(value));
}

function toPositiveInteger(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(1, Math.trunc(value));
}

function normalizePreviewTask(value: unknown, index: number): PreviewTask {
  const record = isRecord(value) ? value : {};
  const taskKey = toNonEmptyString(record.taskKey) ?? `task-${index + 1}`;
  const dependsOn = Array.from(new Set(toStringArray(record.dependsOn)));
  const onFailure =
    record.onFailure === "continue" || record.onFailure === "skip" ? record.onFailure : "halt";
  return {
    taskKey,
    dependsOn,
    maxRetries: toNonNegativeInteger(record.maxRetries, 0),
    onFailure,
  };
}

function findCycleHint(tasks: PreviewTask[]): string | null {
  const knownTaskKeys = new Set(tasks.map((task) => task.taskKey));
  const dependencies = new Map(
    tasks.map((task) => [
      task.taskKey,
      task.dependsOn.filter((dependency) => knownTaskKeys.has(dependency)),
    ])
  );
  const visited = new Set<string>();
  const activePath: string[] = [];
  const activeSet = new Set<string>();

  const walk = (taskKey: string): string[] | null => {
    visited.add(taskKey);
    activePath.push(taskKey);
    activeSet.add(taskKey);

    for (const dependency of dependencies.get(taskKey) ?? []) {
      if (!visited.has(dependency)) {
        const nestedCycle = walk(dependency);
        if (nestedCycle) {
          return nestedCycle;
        }
        continue;
      }
      if (activeSet.has(dependency)) {
        const cycleStart = activePath.indexOf(dependency);
        return [...activePath.slice(cycleStart), dependency];
      }
    }

    activePath.pop();
    activeSet.delete(taskKey);
    return null;
  };

  for (const task of tasks) {
    if (visited.has(task.taskKey)) {
      continue;
    }
    const cycle = walk(task.taskKey);
    if (cycle) {
      return cycle.join(" -> ");
    }
  }
  return null;
}

export function parseRuntimeBatchPreviewState(rawConfig: string): RuntimeBatchPreviewState {
  const trimmed = rawConfig.trim();
  if (trimmed.length === 0) {
    return {
      maxParallel: 1,
      tasks: [],
      duplicateTaskKeyHints: [],
      dependencyHints: [],
      cycleHint: null,
      parseError: null,
    };
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (!isRecord(parsed)) {
      return {
        maxParallel: 1,
        tasks: [],
        duplicateTaskKeyHints: [],
        dependencyHints: [],
        cycleHint: null,
        parseError: "Batch preview must be a JSON object with maxParallel and tasks.",
      };
    }

    const tasks = Array.isArray(parsed.tasks)
      ? parsed.tasks.map((task, index) => normalizePreviewTask(task, index))
      : [];
    const keyCounts = new Map<string, number>();
    for (const task of tasks) {
      keyCounts.set(task.taskKey, (keyCounts.get(task.taskKey) ?? 0) + 1);
    }
    const duplicateTaskKeyHints = Array.from(keyCounts.entries())
      .filter(([, count]) => count > 1)
      .map(([taskKey, count]) => `Duplicate task key hint: "${taskKey}" appears ${count} times.`);
    const knownTaskKeys = new Set(tasks.map((task) => task.taskKey));
    const dependencyHints: string[] = [];
    for (const task of tasks) {
      for (const dependency of task.dependsOn) {
        if (!knownTaskKeys.has(dependency)) {
          dependencyHints.push(
            `Dependency hint: "${task.taskKey}" depends on missing task "${dependency}".`
          );
        }
      }
    }
    return {
      maxParallel: toPositiveInteger(parsed.maxParallel, 1),
      tasks,
      duplicateTaskKeyHints,
      dependencyHints,
      cycleHint: findCycleHint(tasks),
      parseError: null,
    };
  } catch {
    return {
      maxParallel: 1,
      tasks: [],
      duplicateTaskKeyHints: [],
      dependencyHints: [],
      cycleHint: null,
      parseError: "Batch preview must be valid JSON.",
    };
  }
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
