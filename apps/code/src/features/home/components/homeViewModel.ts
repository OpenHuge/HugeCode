import type { MissionControlProjection } from "../../../application/runtime/facades/runtimeMissionControlFacade";
import { type SelectOption, type StatusBadgeTone } from "../../../design-system";
import { normalizePathForDisplay } from "../../../utils/platformPaths";
import type { ApprovalRequest, RequestUserInputRequest } from "../../../types";
import {
  formatMissionControlFreshnessLabel,
  summarizeMissionControlSignals,
  type MissionControlFreshnessState,
} from "@ku0/code-application/runtimeMissionControlSurfaceModel";

export type HomeLatestAgentRun = {
  statusKind: "active" | "review_ready" | "needs_input" | "attention" | "recent_activity";
  warningCount: number;
};

export type HomeMissionControlStatus = {
  label: string;
  tone: StatusBadgeTone;
};

export type HomeWorkspaceOption = {
  id: string;
  name: string;
  path?: string;
  connected?: boolean;
};

export function isReviewReadyHomeMission(run: HomeLatestAgentRun): boolean {
  return run.statusKind === "review_ready";
}

export function isActionRequiredHomeMission(run: HomeLatestAgentRun): boolean {
  return run.statusKind === "needs_input" || run.statusKind === "attention";
}

export function isActiveHomeMission(run: HomeLatestAgentRun): boolean {
  return run.statusKind === "active" || run.statusKind === "needs_input";
}

function resolveHomeMissionControlStatus(
  freshness: MissionControlFreshnessState | null
): HomeMissionControlStatus | null {
  if (!freshness) {
    return null;
  }
  if (freshness.status === "loading") {
    return { label: "Syncing", tone: "progress" };
  }
  if (freshness.status === "refreshing") {
    return { label: "Refreshing", tone: "progress" };
  }
  if (freshness.status === "error") {
    return { label: "Degraded", tone: "error" };
  }
  if (freshness.isStale) {
    return { label: "Stale", tone: "warning" };
  }
  return { label: "Live", tone: "success" };
}

export function buildHomeMissionSignalsViewModel(input: {
  latestAgentRuns: HomeLatestAgentRun[];
  missionControlProjection: MissionControlProjection | null;
  missionControlFreshness: MissionControlFreshnessState | null;
  approvals: ApprovalRequest[];
  userInputRequests: RequestUserInputRequest[];
}) {
  const missionControlSignals = input.missionControlProjection
    ? summarizeMissionControlSignals(input.missionControlProjection)
    : null;
  const missionControlStatus = resolveHomeMissionControlStatus(input.missionControlFreshness);

  return {
    missionSignals: {
      reviewReadyCount: missionControlSignals
        ? missionControlSignals.reviewReadyCount
        : input.latestAgentRuns.filter(isReviewReadyHomeMission).length,
      awaitingActionCount: missionControlSignals
        ? Math.max(
            input.approvals.length + input.userInputRequests.length,
            missionControlSignals.needsActionCount
          )
        : input.approvals.length + input.userInputRequests.length,
    },
    missionControlStatus,
    missionControlStatusLabel: input.missionControlFreshness
      ? formatMissionControlFreshnessLabel(input.missionControlFreshness)
      : null,
    missionControlSignals,
  };
}

export function buildHomeWorkspaceRoutingViewModel(input: {
  workspaces: HomeWorkspaceOption[];
  activeWorkspaceId: string | null;
  pendingWorkspaceSelectionId: string | null;
  workspaceLoadError: string | null;
  canConnectLocalRuntime: boolean;
}) {
  const workspaceSelectOptions: SelectOption[] = input.workspaces.map((workspace) => ({
    value: workspace.id,
    label: workspace.name || workspace.id,
  }));
  const activeWorkspace = input.activeWorkspaceId
    ? (input.workspaces.find((workspace) => workspace.id === input.activeWorkspaceId) ?? null)
    : null;
  const defaultWorkspaceId =
    input.workspaces.find((workspace) => workspace.connected)?.id ??
    input.workspaces[0]?.id ??
    null;
  const displayedWorkspaceId =
    input.pendingWorkspaceSelectionId ?? input.activeWorkspaceId ?? defaultWorkspaceId;
  const displayedWorkspace = displayedWorkspaceId
    ? (input.workspaces.find((workspace) => workspace.id === displayedWorkspaceId) ?? null)
    : null;
  const workspaceSummaryScope = input.pendingWorkspaceSelectionId
    ? "pending"
    : activeWorkspace
      ? "active"
      : displayedWorkspace
        ? "default"
        : "unconfigured";
  const runtimeUnavailable =
    input.workspaceLoadError !== null &&
    /runtime unavailable|code runtime is unavailable/i.test(input.workspaceLoadError);
  const showLocalRuntimeEntry = input.workspaces.length === 0 && input.canConnectLocalRuntime;
  const workspacePlaceholder = runtimeUnavailable
    ? "Runtime required"
    : input.workspaceLoadError
      ? "Projects unavailable"
      : input.workspaces.length > 0
        ? "Select workspace"
        : "Connect a workspace";
  const settingsButtonLabel = activeWorkspace
    ? "Open agent command center"
    : "Open runtime settings";
  const workspaceSummaryTitle = displayedWorkspace
    ? displayedWorkspace.name
    : "Connect a workspace";
  const workspaceSummaryMeta =
    workspaceSummaryScope === "pending"
      ? "Switching"
      : workspaceSummaryScope === "active"
        ? "Active"
        : workspaceSummaryScope === "default"
          ? "Default"
          : null;
  const workspaceSummaryPath =
    displayedWorkspace?.path && displayedWorkspace.path.trim().length > 0
      ? normalizePathForDisplay(displayedWorkspace.path)
      : null;
  const workspaceSummaryDetail = displayedWorkspace ? workspaceSummaryPath : null;

  return {
    workspaceSelectOptions,
    activeWorkspace,
    defaultWorkspaceId,
    displayedWorkspaceId,
    displayedWorkspace,
    workspaceSummaryScope,
    runtimeUnavailable,
    showLocalRuntimeEntry,
    setupActionKind:
      input.workspaces.length === 0 && input.workspaceLoadError ? "settings" : "project",
    workspacePlaceholder,
    settingsButtonLabel,
    workspaceSummaryTitle,
    workspaceSummaryMeta,
    workspaceSummaryPath,
    workspaceSummaryDetail,
  };
}

export function buildHomeRuntimeNoticeViewModel(input: {
  workspaces: HomeWorkspaceOption[];
  workspaceLoadError: string | null;
  runtimeUnavailable: boolean;
  showLocalRuntimeEntry: boolean;
}) {
  const runtimeNoticeState = input.runtimeUnavailable
    ? ("runtime" as const)
    : input.workspaceLoadError
      ? ("error" as const)
      : ("manual" as const);
  const runtimeNoticeTone: StatusBadgeTone = input.runtimeUnavailable
    ? "warning"
    : input.workspaceLoadError
      ? "error"
      : "default";

  return {
    showRuntimeNotice:
      input.workspaces.length === 0 &&
      (input.workspaceLoadError !== null || input.showLocalRuntimeEntry),
    runtimeNoticeState,
    runtimeNoticeTitle: input.runtimeUnavailable
      ? "Runtime unavailable"
      : input.workspaceLoadError
        ? "Load failed"
        : "Runtime",
    runtimeNoticeTone,
    runtimeNoticeBody: input.runtimeUnavailable
      ? "Connect to continue."
      : input.workspaceLoadError
        ? input.workspaceLoadError
        : "",
  };
}
