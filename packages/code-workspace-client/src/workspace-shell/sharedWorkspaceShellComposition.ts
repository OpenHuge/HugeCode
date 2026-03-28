import type {
  SharedWorkspaceShellState,
  SharedWorkspaceShellStateCompositionInput,
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
}) {
  return (
    input.activationRequested ||
    input.activeSection === "missions" ||
    input.activeSection === "review" ||
    input.activationDeferred
  );
}

export const SHARED_WORKSPACE_SHELL_HOME_OPTION_VALUE = "__home__";

export type SharedWorkspaceShellSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

export type SharedWorkspaceShellError = {
  id: string;
  title: string;
  message: string;
};

export type SharedWorkspaceShellFrameState = {
  workspaceSelectOptions: SharedWorkspaceShellSelectOption[];
  workspaceSelectValue: string;
  shellErrors: SharedWorkspaceShellError[];
  refreshLabel: string | null;
  shellRefreshing: boolean;
};

export type SharedWorkspaceShellResolvedFocusState = {
  resolvedFocusTargetItemId: string | null;
  focusedMissionId: string | null;
  focusedReviewId: string | null;
};

export function deriveSharedWorkspaceShellFrameState(
  state: SharedWorkspaceShellState
): SharedWorkspaceShellFrameState {
  const workspaceSelectOptions: SharedWorkspaceShellSelectOption[] = [
    {
      value: SHARED_WORKSPACE_SHELL_HOME_OPTION_VALUE,
      label: "Home overview",
    },
    ...(state.hasPendingWorkspaceSelection && state.activeWorkspaceId
      ? [
          {
            value: state.activeWorkspaceId,
            label:
              state.workspaceLoadState === "refreshing"
                ? "Refreshing selected workspace..."
                : "Loading selected workspace...",
            disabled: true,
          },
        ]
      : []),
    ...state.workspaces.map((workspace) => ({
      value: workspace.id,
      label: workspace.name,
    })),
  ];
  const workspaceSelectValue = state.activeWorkspaceId ?? SHARED_WORKSPACE_SHELL_HOME_OPTION_VALUE;
  const shellErrors = [
    state.workspaceError
      ? {
          id: `workspace:${state.workspaceError}`,
          title: "Workspace roster unavailable",
          message: state.workspaceError,
        }
      : null,
    state.missionError
      ? {
          id: `mission:${state.missionError}`,
          title: "Mission summary unavailable",
          message: state.missionError,
        }
      : null,
    state.hostStartupError
      ? {
          id: `host:${state.hostStartupError}`,
          title: "Desktop host status unavailable",
          message: state.hostStartupError,
        }
      : null,
  ].filter((error): error is SharedWorkspaceShellError => error !== null);
  const shellHydrating =
    state.workspaceLoadState === "idle" ||
    state.workspaceLoadState === "loading" ||
    state.missionLoadState === "idle" ||
    state.missionLoadState === "loading" ||
    state.hostStartupLoadState === "idle" ||
    state.hostStartupLoadState === "loading";
  const shellRefreshing =
    state.workspaceLoadState === "refreshing" ||
    state.missionLoadState === "refreshing" ||
    state.hostStartupLoadState === "refreshing";
  const refreshLabel = shellRefreshing
    ? "Refreshing shell"
    : shellHydrating
      ? "Hydrating shell"
      : null;

  return {
    workspaceSelectOptions,
    workspaceSelectValue,
    shellErrors,
    refreshLabel,
    shellRefreshing,
  };
}

export function deriveSharedWorkspaceShellResolvedFocusState(input: {
  state: SharedWorkspaceShellState;
  focusTarget: {
    section: "missions" | "review";
    itemId: string | null;
  } | null;
}): SharedWorkspaceShellResolvedFocusState {
  const { focusTarget, state } = input;
  const missionItems = state.missionSummary.missionItems;
  const reviewItems = state.missionSummary.reviewItems;
  const missionHydrating =
    state.missionLoadState === "idle" || state.missionLoadState === "loading";
  const resolvedFocusTargetItemId =
    !focusTarget || focusTarget.itemId !== null || missionHydrating
      ? null
      : focusTarget.section === "missions"
        ? (missionItems[0]?.id ?? null)
        : (reviewItems[0]?.id ?? null);
  const focusedMissionId =
    focusTarget?.section === "missions"
      ? (focusTarget.itemId ?? resolvedFocusTargetItemId ?? missionItems[0]?.id ?? null)
      : null;
  const focusedReviewId =
    focusTarget?.section === "review"
      ? (focusTarget.itemId ?? resolvedFocusTargetItemId ?? reviewItems[0]?.id ?? null)
      : null;

  return {
    resolvedFocusTargetItemId,
    focusedMissionId,
    focusedReviewId,
  };
}

export function composeSharedWorkspaceShellState(
  input: SharedWorkspaceShellStateCompositionInput
): SharedWorkspaceShellState {
  return {
    runtimeMode: input.runtimeMode,
    platformHint: input.platformHint,
    routeSelection: input.routeSelection,
    activeSection: input.activeSection,
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
    accountHref: input.accountHref,
    settingsFraming: input.settingsFraming,
  };
}
