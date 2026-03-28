import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { useDeferredActivation } from "@ku0/shared";
import {
  useWorkspaceClientBindings,
  useWorkspaceClientRuntimeMode,
} from "../workspace/WorkspaceClientBindingsProvider";
import type { SharedWorkspaceShellState } from "./sharedWorkspaceShellContracts";
import {
  composeSharedWorkspaceShellState,
  deriveSharedWorkspaceShellActiveSection,
  deriveSharedWorkspaceShellBackgroundEnabled,
} from "./sharedWorkspaceShellComposition";
import type { SharedWorkspaceShellSection } from "./workspaceNavigation";
import { useSharedHostStartupStatusState } from "./useSharedHostStartupStatusState";
import { useSharedMissionControlSummaryState } from "./useSharedMissionControlSummaryState";
import { useSharedWorkspaceCatalogState } from "./useSharedWorkspaceCatalogState";

export function useSharedWorkspaceShellState(): SharedWorkspaceShellState {
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
    deriveSharedWorkspaceShellActiveSection(routeSelection);
  const [shellBackgroundActivationRequested, setShellBackgroundActivationRequested] = useState(
    () => activeSection === "missions" || activeSection === "review"
  );
  const shellBackgroundActivated = useDeferredActivation({
    enabled: !shellBackgroundActivationRequested,
    idleTimeoutMs: 250,
    fallbackDelayMs: 250,
  });
  const shellBackgroundEnabled = deriveSharedWorkspaceShellBackgroundEnabled({
    activeSection,
    activationRequested: shellBackgroundActivationRequested,
    activationDeferred: shellBackgroundActivated,
  });
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

  return composeSharedWorkspaceShellState({
    runtimeMode,
    platformHint: bindings.host.shell.platformHint ?? bindings.host.platform,
    routeSelection,
    activeSection,
    catalogState,
    missionControlState: {
      ...missionControlState,
      refresh: refreshMissionSummary,
    },
    hostStartupState: {
      ...hostStartupState,
      refresh: refreshHostStartupStatus,
    },
    navigateToSection,
    accountHref,
    settingsFraming: bindings.platformUi.settingsShellFraming,
  });
}
