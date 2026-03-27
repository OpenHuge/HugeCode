import type { HugeCodeTaskSummary } from "@ku0/code-runtime-host-contract";
import type { MissionNavigationTarget } from "./runtimeMissionNavigationTypes";

export type { MissionNavigationTarget } from "./runtimeMissionNavigationTypes";

type MissionNavigationContext = {
  runId: string | null;
  reviewPackId: string | null;
};

export function buildMissionNavigationTarget(
  task: Pick<HugeCodeTaskSummary, "workspaceId" | "id" | "origin">,
  context: MissionNavigationContext
): MissionNavigationTarget {
  return {
    kind: "mission",
    workspaceId: task.workspaceId,
    taskId: task.id,
    runId: context.runId,
    reviewPackId: context.reviewPackId,
    threadId: task.origin.threadId ?? null,
    limitation: task.origin.threadId ? null : "thread_unavailable",
  };
}

export function buildReviewNavigationTarget(
  task: Pick<HugeCodeTaskSummary, "workspaceId" | "id" | "origin">,
  context: MissionNavigationContext
): MissionNavigationTarget {
  return {
    kind: "review",
    workspaceId: task.workspaceId,
    taskId: task.id,
    runId: context.runId,
    reviewPackId: context.reviewPackId,
    limitation: task.origin.threadId ? null : "thread_unavailable",
  };
}
