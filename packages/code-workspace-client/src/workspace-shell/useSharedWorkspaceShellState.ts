import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  useWorkspaceClientBindings,
  useWorkspaceClientRuntimeMode,
} from "../workspace/WorkspaceClientBindingsProvider";
import type { SharedWorkspaceShellSection } from "./workspaceNavigation";
import { useSharedMissionControlSummaryState } from "./useSharedMissionControlSummaryState";
import { useSharedWorkspaceCatalogState } from "./useSharedWorkspaceCatalogState";

type IdleCallbackHandle = number;

type IdleCallbackOptions = {
  timeout?: number;
};

type IdleCallback = (deadline: { didTimeout: boolean; timeRemaining: () => number }) => void;

function scheduleMissionSummaryLoad(listener: () => void) {
  if (typeof window === "undefined") {
    listener();
    return () => undefined;
  }

  const idleWindow = window as Window & {
    requestIdleCallback?: (
      callback: IdleCallback,
      options?: IdleCallbackOptions
    ) => IdleCallbackHandle;
    cancelIdleCallback?: (handle: IdleCallbackHandle) => void;
  };

  if (
    typeof idleWindow.requestIdleCallback === "function" &&
    typeof idleWindow.cancelIdleCallback === "function"
  ) {
    const handle = idleWindow.requestIdleCallback(
      () => {
        listener();
      },
      { timeout: 250 }
    );
    return () => {
      idleWindow.cancelIdleCallback?.(handle);
    };
  }

  const handle = window.setTimeout(() => {
    listener();
  }, 250);
  return () => {
    window.clearTimeout(handle);
  };
}

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
  const [missionSummaryEnabled, setMissionSummaryEnabled] = useState(
    () => activeSection === "missions" || activeSection === "review"
  );
  const missionControlState = useSharedMissionControlSummaryState(catalogState.activeWorkspaceId, {
    enabled: missionSummaryEnabled,
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
    setMissionSummaryEnabled(true);
    return missionControlState.refresh();
  }, [missionControlState.refresh]);

  useEffect(() => {
    if (missionSummaryEnabled) {
      return;
    }
    if (activeSection === "missions" || activeSection === "review") {
      setMissionSummaryEnabled(true);
      return;
    }
    return scheduleMissionSummaryLoad(() => {
      setMissionSummaryEnabled(true);
    });
  }, [activeSection, missionSummaryEnabled]);

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
    accountHref,
    settingsFraming: bindings.platformUi.settingsShellFraming,
  };
}
