import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { useDeferredActivation } from "@ku0/shared";
import {
  useWorkspaceClientBindings,
  useWorkspaceClientRuntimeMode,
} from "../workspace/WorkspaceClientBindingsProvider";
import type { SharedWorkspaceShellState } from "./sharedWorkspaceShellContracts";
import {
  composeSharedWorkspaceShellState,
  deriveSharedWorkspaceShellFrameState,
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
  const [shellBackgroundActivationRequested, setShellBackgroundActivationRequested] = useState(
    () => routeSelection.kind === "missions" || routeSelection.kind === "review"
  );
  const shellBackgroundActivated = useDeferredActivation({
    enabled: !shellBackgroundActivationRequested,
    idleTimeoutMs: 250,
    fallbackDelayMs: 250,
  });
  const frameState = deriveSharedWorkspaceShellFrameState({
    runtimeMode,
    platformHint: bindings.host.shell.platformHint ?? bindings.host.platform,
    routeSelection,
    activationRequested: shellBackgroundActivationRequested,
    activationDeferred: shellBackgroundActivated,
    accountHref,
    settingsFraming: bindings.platformUi.settingsShellFraming,
  });
  const missionControlState = useSharedMissionControlSummaryState(catalogState.activeWorkspaceId, {
    enabled: frameState.backgroundEnabled,
  });
  const hostStartupState = useSharedHostStartupStatusState(bindings.host, {
    enabled: frameState.backgroundEnabled,
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
    frameState,
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
  });
}
