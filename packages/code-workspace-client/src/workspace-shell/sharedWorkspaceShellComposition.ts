import type {
  SharedWorkspaceShellFrameState,
  SharedWorkspaceShellFrameStateCompositionInput,
  SharedWorkspaceShellFocusTarget,
  SharedWorkspaceShellError,
  SharedWorkspaceShellState,
  SharedWorkspaceShellStateCompositionInput,
  SharedWorkspaceShellUiState,
  SharedWorkspaceShellWorkspaceOption,
} from "./sharedWorkspaceShellContracts";
import type {
  SharedWorkspaceRouteSelection,
  SharedWorkspaceShellSection,
} from "./workspaceNavigation";

export function deriveSharedWorkspaceShellActiveSection(
  routeSelection: SharedWorkspaceRouteSelection
): SharedWorkspaceShellSection {
  return routeSelection.kind === "none"
    ? "home"
    : routeSelection.kind === "workspace"
      ? "workspaces"
      : routeSelection.kind;
}

export function deriveSharedWorkspaceShellBackgroundEnabled(input: {
  activeSection: SharedWorkspaceShellSection;
  activationRequested: boolean;
  activationDeferred: boolean;
}): boolean {
  return (
    input.activationRequested ||
    input.activeSection === "missions" ||
    input.activeSection === "review" ||
    input.activationDeferred
  );
}

export function deriveSharedWorkspaceShellFrameState(
  input: SharedWorkspaceShellFrameStateCompositionInput
): SharedWorkspaceShellFrameState {
  const activeSection = deriveSharedWorkspaceShellActiveSection(input.routeSelection);

  return {
    runtimeMode: input.runtimeMode,
    platformHint: input.platformHint,
    routeSelection: input.routeSelection,
    activeSection,
    backgroundEnabled: deriveSharedWorkspaceShellBackgroundEnabled({
      activeSection,
      activationRequested: input.activationRequested,
      activationDeferred: input.activationDeferred,
    }),
    accountHref: input.accountHref,
    settingsFraming: input.settingsFraming,
  };
}

export function composeSharedWorkspaceShellState(
  input: SharedWorkspaceShellStateCompositionInput
): SharedWorkspaceShellState {
  return {
    runtimeMode: input.frameState.runtimeMode,
    platformHint: input.frameState.platformHint,
    routeSelection: input.frameState.routeSelection,
    activeSection: input.frameState.activeSection,
    workspaces: input.catalogState.workspaces,
    activeWorkspaceId: input.catalogState.activeWorkspaceId,
    activeWorkspace: input.catalogState.activeWorkspace,
    hasPendingWorkspaceSelection: input.catalogState.hasPendingWorkspaceSelection,
    workspaceLoadState: input.catalogState.loadState,
    workspaceError: input.catalogState.error,
    refreshWorkspaces: input.catalogState.refresh,
    selectWorkspace: input.catalogState.selectWorkspace,
    navigateToSection: input.navigateToSection,
    missionSummary: input.missionControlState.summary,
    missionSnapshot: input.missionControlState.snapshot,
    missionLoadState: input.missionControlState.loadState,
    missionError: input.missionControlState.error,
    refreshMissionSummary: input.missionControlState.refresh,
    hostStartupStatus: input.hostStartupState.status,
    hostStartupLoadState: input.hostStartupState.loadState,
    hostStartupError: input.hostStartupState.error,
    refreshHostStartupStatus: input.hostStartupState.refresh,
    accountHref: input.frameState.accountHref,
    settingsFraming: input.frameState.settingsFraming,
  };
}

export function deriveSharedWorkspaceShellWorkspaceSelectOptions(input: {
  activeWorkspaceId: string | null;
  hasPendingWorkspaceSelection: boolean;
  workspaceLoadState: SharedWorkspaceShellState["workspaceLoadState"];
  workspaces: SharedWorkspaceShellState["workspaces"];
}): SharedWorkspaceShellWorkspaceOption[] {
  return [
    {
      value: "__home__",
      label: "Home overview",
    },
    ...(input.hasPendingWorkspaceSelection && input.activeWorkspaceId
      ? [
          {
            value: input.activeWorkspaceId,
            label:
              input.workspaceLoadState === "refreshing"
                ? "Refreshing selected workspace..."
                : "Loading selected workspace...",
            disabled: true,
          },
        ]
      : []),
    ...input.workspaces.map((workspace) => ({
      value: workspace.id,
      label: workspace.name,
    })),
  ];
}

export function deriveSharedWorkspaceShellErrors(input: {
  workspaceError: string | null;
  missionError: string | null;
  hostStartupError: string | null;
}): SharedWorkspaceShellError[] {
  return [
    input.workspaceError
      ? {
          id: `workspace:${input.workspaceError}`,
          title: "Workspace roster unavailable",
          message: input.workspaceError,
        }
      : null,
    input.missionError
      ? {
          id: `mission:${input.missionError}`,
          title: "Mission summary unavailable",
          message: input.missionError,
        }
      : null,
    input.hostStartupError
      ? {
          id: `host:${input.hostStartupError}`,
          title: "Desktop host status unavailable",
          message: input.hostStartupError,
        }
      : null,
  ].filter((error): error is SharedWorkspaceShellError => error !== null);
}

export function reconcileSharedWorkspaceShellDismissedErrors(
  dismissedErrors: string[],
  shellErrors: SharedWorkspaceShellError[]
) {
  return dismissedErrors.filter((id) => shellErrors.some((error) => error.id === id));
}

export function deriveSharedWorkspaceShellVisibleErrors(
  shellErrors: SharedWorkspaceShellError[],
  dismissedErrors: string[]
) {
  return shellErrors.filter((error) => !dismissedErrors.includes(error.id));
}

export function resolveSharedWorkspaceShellFocusTarget(input: {
  focusTarget: SharedWorkspaceShellFocusTarget | null;
  missionLoadState: SharedWorkspaceShellState["missionLoadState"];
  missionItemIds: string[];
  reviewItemIds: string[];
}): SharedWorkspaceShellFocusTarget | null {
  if (!input.focusTarget || input.focusTarget.itemId) {
    return input.focusTarget;
  }
  if (input.missionLoadState === "idle" || input.missionLoadState === "loading") {
    return input.focusTarget;
  }

  const resolvedItemId =
    input.focusTarget.section === "missions"
      ? (input.missionItemIds[0] ?? null)
      : (input.reviewItemIds[0] ?? null);

  if (!resolvedItemId) {
    return input.focusTarget;
  }

  return {
    ...input.focusTarget,
    itemId: resolvedItemId,
  };
}

export function deriveSharedWorkspaceShellFocusedItemIds(input: {
  focusTarget: SharedWorkspaceShellFocusTarget | null;
  missionItemIds: string[];
  reviewItemIds: string[];
}) {
  return {
    focusedMissionId:
      input.focusTarget?.section === "missions"
        ? (input.focusTarget.itemId ?? input.missionItemIds[0] ?? null)
        : null,
    focusedReviewId:
      input.focusTarget?.section === "review"
        ? (input.focusTarget.itemId ?? input.reviewItemIds[0] ?? null)
        : null,
  };
}

export function deriveSharedWorkspaceShellRefreshLabel(input: {
  workspaceLoadState: SharedWorkspaceShellState["workspaceLoadState"];
  missionLoadState: SharedWorkspaceShellState["missionLoadState"];
  hostStartupLoadState: SharedWorkspaceShellState["hostStartupLoadState"];
}) {
  const shellHydrating =
    input.workspaceLoadState === "idle" ||
    input.workspaceLoadState === "loading" ||
    input.missionLoadState === "idle" ||
    input.missionLoadState === "loading" ||
    input.hostStartupLoadState === "idle" ||
    input.hostStartupLoadState === "loading";
  const shellRefreshing =
    input.workspaceLoadState === "refreshing" ||
    input.missionLoadState === "refreshing" ||
    input.hostStartupLoadState === "refreshing";

  return {
    shellHydrating,
    shellRefreshing,
    refreshLabel: shellRefreshing ? "Refreshing shell" : shellHydrating ? "Hydrating shell" : null,
  };
}

export function deriveSharedWorkspaceShellUiState(input: {
  shellState: SharedWorkspaceShellState;
  focusTarget: SharedWorkspaceShellFocusTarget | null;
  dismissedErrors: string[];
}): SharedWorkspaceShellUiState {
  const workspaceSelectOptions = deriveSharedWorkspaceShellWorkspaceSelectOptions({
    activeWorkspaceId: input.shellState.activeWorkspaceId,
    hasPendingWorkspaceSelection: input.shellState.hasPendingWorkspaceSelection,
    workspaceLoadState: input.shellState.workspaceLoadState,
    workspaces: input.shellState.workspaces,
  });
  const shellErrors = deriveSharedWorkspaceShellErrors({
    workspaceError: input.shellState.workspaceError,
    missionError: input.shellState.missionError,
    hostStartupError: input.shellState.hostStartupError,
  });
  const visibleErrors = deriveSharedWorkspaceShellVisibleErrors(shellErrors, input.dismissedErrors);
  const { focusedMissionId, focusedReviewId } = deriveSharedWorkspaceShellFocusedItemIds({
    focusTarget: input.focusTarget,
    missionItemIds: input.shellState.missionSummary.missionItems.map((item) => item.id),
    reviewItemIds: input.shellState.missionSummary.reviewItems.map((item) => item.id),
  });
  const { shellHydrating, shellRefreshing, refreshLabel } = deriveSharedWorkspaceShellRefreshLabel({
    workspaceLoadState: input.shellState.workspaceLoadState,
    missionLoadState: input.shellState.missionLoadState,
    hostStartupLoadState: input.shellState.hostStartupLoadState,
  });

  return {
    workspaceSelectOptions,
    workspaceSelectValue: input.shellState.activeWorkspaceId ?? "__home__",
    shellErrors,
    visibleErrors,
    focusedMissionId,
    focusedReviewId,
    shellHydrating,
    shellRefreshing,
    refreshLabel,
  };
}
