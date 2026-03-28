import type {
  SharedWorkspaceShellFrameState,
  SharedWorkspaceShellFrameStateCompositionInput,
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
