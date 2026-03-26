import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { useDeferredActivation } from "@ku0/shared";
import {
  useWorkspaceClientBindings,
  useWorkspaceClientRuntimeMode,
} from "../workspace/WorkspaceClientBindingsProvider";
import type { SharedWorkspaceShellSection } from "./workspaceNavigation";
import { useSharedHostStartupStatusState } from "./useSharedHostStartupStatusState";
import { useSharedMissionControlSummaryState } from "./useSharedMissionControlSummaryState";
import { useSharedWorkspaceCatalogState } from "./useSharedWorkspaceCatalogState";

export function useSharedWorkspaceShellState() {
  const bindings = useWorkspaceClientBindings();
  const catalogState = useSharedWorkspaceCatalogState();
  const runtimeMode = useWorkspaceClientRuntimeMode();
  const routeSelection = useSyncExternalStore(
    bindings.navigation.subscribeRouteSelection,
    bindings.navigation.readRouteSelection,
    bindings.navigation.readRouteSelection
  );
  const accountHref = useMemo(
    () => bindings.navigation.getAccountCenterHref?.() ?? null,
    [bindings.navigation]
  );
  const activeSection: SharedWorkspaceShellSection =
    routeSelection.kind === "none"
      ? "home"
      : routeSelection.kind === "workspace"
        ? "workspaces"
        : routeSelection.kind;
  const [shellBackgroundActivationRequested, setShellBackgroundActivationRequested] = useState(
    () => activeSection === "missions" || activeSection === "review"
  );
  const shellBackgroundActivated = useDeferredActivation({
    enabled: !shellBackgroundActivationRequested,
    idleTimeoutMs: 250,
    fallbackDelayMs: 250,
  });
  const shellBackgroundEnabled =
    shellBackgroundActivationRequested ||
    activeSection === "missions" ||
    activeSection === "review" ||
    shellBackgroundActivated;
  const missionControlState = useSharedMissionControlSummaryState(catalogState.activeWorkspaceId, {
    enabled: shellBackgroundEnabled,
  });
  const hostStartupState = useSharedHostStartupStatusState(bindings.host, {
    enabled: shellBackgroundEnabled,
  });
  const navigateToSection = useCallback(
    (section: SharedWorkspaceShellSection) => {
      if (section === "home") {
        void bindings.navigation.navigateHome();
        return;
      }
      void bindings.navigation.navigateToSection(section);
    },
    [bindings.navigation]
  );
  const refreshMissionSummary = useCallback(() => {
    setShellBackgroundActivationRequested(true);
    return missionControlState.refresh();
  }, [missionControlState.refresh]);
  const refreshHostStartupStatus = useCallback(() => {
    setShellBackgroundActivationRequested(true);
    return hostStartupState.refresh();
  }, [hostStartupState.refresh]);

  return {
    runtimeMode,
    platformHint: bindings.host.shell.platformHint ?? bindings.host.platform,
    routeSelection,
    activeSection,
    workspaces: catalogState.workspaces,
    activeWorkspaceId: catalogState.activeWorkspaceId,
    activeWorkspace: catalogState.activeWorkspace,
    workspaceLoadState: catalogState.loadState,
    workspaceError: catalogState.error,
    refreshWorkspaces: catalogState.refresh,
    selectWorkspace: catalogState.selectWorkspace,
    navigateToSection,
    missionSummary: missionControlState.summary,
    missionSnapshot: missionControlState.snapshot,
    missionLoadState: missionControlState.loadState,
    missionError: missionControlState.error,
    refreshMissionSummary,
    hostStartupStatus: hostStartupState.status,
    hostStartupLoadState: hostStartupState.loadState,
    hostStartupError: hostStartupState.error,
    refreshHostStartupStatus,
    accountHref,
    settingsFraming: bindings.platformUi.settingsShellFraming,
  };
}
