import type {
  ReviewPackSelectionRequest,
  ReviewPackSelectionSource,
} from "../../review/utils/reviewPackSurfaceModel";
import type { MissionNavigationTarget } from "./missionControlPresentation";

export type DesktopMissionReviewSource = Exclude<ReviewPackSelectionSource, "system">;

type MissionEntryActionLike = {
  operatorActionLabel?: string | null;
  operatorActionTarget?: MissionNavigationTarget | null;
  navigationTarget?: MissionNavigationTarget | null;
};

type OpenMissionTargetFromDesktopShellParams = {
  target: MissionNavigationTarget;
  source: DesktopMissionReviewSource;
  onOpenReviewPack: (selection: ReviewPackSelectionRequest) => void;
  onSelectWorkspace: (workspaceId: string) => void;
  onSelectThread: (workspaceId: string, threadId: string) => void;
  onSelectReviewTab: () => void;
  onSelectThreadTab?: (() => void) | null;
};

export function resolveMissionEntryActionTarget(
  input: MissionEntryActionLike
): MissionNavigationTarget | null {
  return input.operatorActionTarget ?? input.navigationTarget ?? null;
}

export function resolveMissionEntryActionLabel(input: MissionEntryActionLike): string {
  const explicitLabel = input.operatorActionLabel?.trim();
  if (explicitLabel) {
    return explicitLabel;
  }

  const target = resolveMissionEntryActionTarget(input);
  if (!target || target.kind === "thread") {
    return "Open mission";
  }
  if (target.kind === "review") {
    return "Open review";
  }
  return "Open action center";
}

export function resolveMissionEntryFallbackSummary(target: MissionNavigationTarget): string {
  if (target.kind === "thread") {
    return "Open this mission to review the latest activity.";
  }
  if (target.kind === "review") {
    return target.limitation === "thread_unavailable"
      ? "Thread detail is unavailable. Open the review surface to inspect runtime evidence, validation, and the next decision."
      : "Open the review surface to inspect runtime evidence, validation, and the next decision.";
  }
  return target.limitation === "thread_unavailable"
    ? "Thread detail is unavailable. Open the action center to supervise runtime evidence, handoff, and recovery."
    : "Open the action center to inspect runtime route, evidence, and controls.";
}

export function buildReviewPackSelectionRequestFromMissionTarget(input: {
  target: MissionNavigationTarget;
  source: DesktopMissionReviewSource;
}): ReviewPackSelectionRequest | null {
  if (input.target.kind === "thread") {
    return null;
  }

  return {
    workspaceId: input.target.workspaceId,
    taskId: input.target.taskId,
    runId: input.target.runId,
    reviewPackId: input.target.reviewPackId,
    source: input.source,
  };
}

export function openMissionTargetFromDesktopShell({
  target,
  source,
  onOpenReviewPack,
  onSelectWorkspace,
  onSelectThread,
  onSelectReviewTab,
  onSelectThreadTab = null,
}: OpenMissionTargetFromDesktopShellParams) {
  onSelectWorkspace(target.workspaceId);

  if (target.kind === "thread") {
    onSelectThread(target.workspaceId, target.threadId);
    onSelectThreadTab?.();
    return;
  }

  const selection = buildReviewPackSelectionRequestFromMissionTarget({
    target,
    source,
  });
  if (!selection) {
    return;
  }

  onOpenReviewPack(selection);
  onSelectReviewTab();
}
