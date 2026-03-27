import type { HugeCodeTaskSummary } from "@ku0/code-runtime-host-contract";
import type { MissionNavigationTarget } from "./runtimeMissionNavigationTypes";

export type { MissionNavigationTarget } from "./runtimeMissionNavigationTypes";

export function buildMissionNavigationTarget(
  task: HugeCodeTaskSummary,
  options?: {
    runId?: string | null;
    reviewPackId?: string | null;
  }
): MissionNavigationTarget {
  return {
    kind: "mission",
    workspaceId: task.workspaceId,
    taskId: task.id,
    runId: options?.runId ?? task.latestRunId ?? null,
    reviewPackId: options?.reviewPackId ?? null,
    threadId: task.origin.threadId ?? null,
    limitation: task.origin.threadId ? null : "thread_unavailable",
  };
}

export function buildReviewNavigationTarget(
  task: HugeCodeTaskSummary,
  options?: {
    runId?: string | null;
    reviewPackId?: string | null;
  }
): MissionNavigationTarget {
  return {
    kind: "review",
    workspaceId: task.workspaceId,
    taskId: task.id,
    runId: options?.runId ?? task.latestRunId ?? null,
    reviewPackId: options?.reviewPackId ?? null,
    limitation: task.origin.threadId ? null : "thread_unavailable",
  };
}
