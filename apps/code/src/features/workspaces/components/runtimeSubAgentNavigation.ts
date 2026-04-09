import type {
  HugeCodeRunSummary,
  HugeCodeTakeoverBundle,
  HugeCodeTakeoverTarget,
} from "@ku0/code-runtime-host-contract";
import type { RuntimeAgentTaskSummary } from "../../../application/runtime/types/webMcpBridge";
import type { MissionNavigationTarget } from "@ku0/code-application/runtimeMissionControlSurfaceModel";

function buildFallbackMissionTarget(
  task: RuntimeAgentTaskSummary,
  run: HugeCodeRunSummary | null
): Extract<MissionNavigationTarget, { kind: "mission" }> {
  return {
    kind: "mission",
    workspaceId: task.workspaceId,
    taskId: run?.taskId ?? task.taskId,
    runId: run?.id ?? task.runSummary?.id ?? null,
    reviewPackId: run?.reviewPackId ?? task.reviewPackId ?? null,
    threadId: task.threadId ?? null,
    limitation: task.threadId ? null : "thread_unavailable",
  };
}

function buildFallbackReviewTarget(
  task: RuntimeAgentTaskSummary,
  run: HugeCodeRunSummary | null
): Extract<MissionNavigationTarget, { kind: "review" }> {
  return {
    kind: "review",
    workspaceId: task.workspaceId,
    taskId: run?.taskId ?? task.taskId,
    runId: run?.id ?? task.runSummary?.id ?? null,
    reviewPackId: run?.reviewPackId ?? task.reviewPackId ?? null,
    limitation: task.threadId ? null : "thread_unavailable",
  };
}

function mapTakeoverTargetToMissionNavigationTarget(input: {
  takeoverTarget: HugeCodeTakeoverTarget | null | undefined;
  fallbackMissionTarget: Extract<MissionNavigationTarget, { kind: "mission" }>;
}): MissionNavigationTarget {
  const takeoverTarget = input.takeoverTarget;
  if (!takeoverTarget) {
    return input.fallbackMissionTarget;
  }
  if (takeoverTarget.kind === "thread") {
    return {
      kind: "thread",
      workspaceId: takeoverTarget.workspaceId,
      threadId: takeoverTarget.threadId,
    };
  }
  if (takeoverTarget.kind === "review_pack") {
    return {
      kind: "review",
      workspaceId: takeoverTarget.workspaceId,
      taskId: takeoverTarget.taskId,
      runId: takeoverTarget.runId,
      reviewPackId: takeoverTarget.reviewPackId,
      limitation: null,
    };
  }
  if (takeoverTarget.kind === "sub_agent_session") {
    if (takeoverTarget.threadId) {
      return {
        kind: "thread",
        workspaceId: takeoverTarget.workspaceId,
        threadId: takeoverTarget.threadId,
      };
    }
    return {
      ...input.fallbackMissionTarget,
      workspaceId: takeoverTarget.workspaceId,
      runId: takeoverTarget.parentRunId ?? input.fallbackMissionTarget.runId,
    };
  }
  return {
    kind: "mission",
    workspaceId: takeoverTarget.workspaceId,
    taskId: takeoverTarget.taskId,
    runId: takeoverTarget.runId,
    reviewPackId: takeoverTarget.reviewPackId ?? null,
    threadId: input.fallbackMissionTarget.threadId,
    limitation: input.fallbackMissionTarget.threadId ? null : "thread_unavailable",
  };
}

export function resolveSubAgentContinuationLabel(
  pathKind: HugeCodeTakeoverBundle["pathKind"]
): string {
  switch (pathKind) {
    case "approval":
      return "Open approval";
    case "review":
      return "Open review";
    case "resume":
      return "Resume mission";
    case "handoff":
      return "Open handoff";
    default:
      return "Open continuation";
  }
}

export function resolveSubAgentContinuationTarget(input: {
  task: RuntimeAgentTaskSummary;
  run: HugeCodeRunSummary | null;
  takeoverBundle: HugeCodeTakeoverBundle | null | undefined;
}): MissionNavigationTarget | null {
  const takeoverBundle = input.takeoverBundle;
  if (!takeoverBundle) {
    return null;
  }
  const fallbackMissionTarget = buildFallbackMissionTarget(input.task, input.run);
  const fallbackReviewTarget = buildFallbackReviewTarget(input.task, input.run);
  const takeoverTarget = mapTakeoverTargetToMissionNavigationTarget({
    takeoverTarget: takeoverBundle.target ?? null,
    fallbackMissionTarget,
  });
  return takeoverBundle.pathKind === "review" && takeoverTarget.kind !== "review"
    ? fallbackReviewTarget
    : takeoverTarget;
}
