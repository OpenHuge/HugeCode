import type {
  HugeCodeTakeoverBundle,
  HugeCodeTakeoverTarget,
  HugeCodeTaskSummary,
} from "@ku0/code-runtime-host-contract";
import type { MissionNavigationTarget } from "./runtimeMissionControlNavigationTarget";

function mapTakeoverTargetToMissionNavigationTarget(input: {
  task: HugeCodeTaskSummary;
  takeoverTarget: HugeCodeTakeoverTarget | null | undefined;
  fallbackMissionTarget: MissionNavigationTarget;
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
      limitation: input.task.origin.threadId ? null : "thread_unavailable",
    };
  }
  if (takeoverTarget.kind === "run") {
    return {
      kind: "mission",
      workspaceId: takeoverTarget.workspaceId,
      taskId: takeoverTarget.taskId,
      runId: takeoverTarget.runId,
      reviewPackId: takeoverTarget.reviewPackId ?? null,
      threadId: input.task.origin.threadId ?? null,
      limitation: input.task.origin.threadId ? null : "thread_unavailable",
    };
  }
  return input.fallbackMissionTarget;
}

export function resolveMissionTakeoverOperatorAction(input: {
  task: HugeCodeTaskSummary;
  takeoverBundle: HugeCodeTakeoverBundle | null | undefined;
  missionTarget: MissionNavigationTarget;
  reviewTarget: MissionNavigationTarget;
}): {
  label: string;
  detail: string | null;
  target: MissionNavigationTarget;
} | null {
  const takeoverBundle = input.takeoverBundle;
  if (!takeoverBundle) {
    return null;
  }

  const takeoverTarget = mapTakeoverTargetToMissionNavigationTarget({
    task: input.task,
    takeoverTarget: takeoverBundle.target ?? null,
    fallbackMissionTarget: input.missionTarget,
  });

  if (takeoverBundle.pathKind === "approval") {
    return {
      label: "Open approval",
      detail:
        takeoverBundle.recommendedAction ||
        takeoverBundle.blockingReason?.trim() ||
        takeoverBundle.summary.trim() ||
        null,
      target: takeoverTarget,
    };
  }
  if (takeoverBundle.pathKind === "review") {
    return {
      label: "Open review",
      detail: takeoverBundle.recommendedAction || takeoverBundle.summary.trim() || null,
      target:
        takeoverTarget.kind === "mission" || takeoverTarget.kind === "thread"
          ? input.reviewTarget
          : takeoverTarget,
    };
  }
  if (takeoverBundle.pathKind === "resume") {
    return {
      label: "Resume mission",
      detail: takeoverBundle.recommendedAction || takeoverBundle.summary.trim() || null,
      target: takeoverTarget,
    };
  }
  if (takeoverBundle.pathKind === "handoff") {
    return {
      label: "Open handoff",
      detail: takeoverBundle.recommendedAction || takeoverBundle.summary.trim() || null,
      target: takeoverTarget,
    };
  }

  return null;
}
