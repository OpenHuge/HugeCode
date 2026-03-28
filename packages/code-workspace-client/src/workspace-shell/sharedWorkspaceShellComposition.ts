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
