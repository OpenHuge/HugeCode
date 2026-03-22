import { useCallback, useEffect, useMemo, type MutableRefObject } from "react";
import errorSoundUrl from "../../../assets/error-notification.mp3";
import successSoundUrl from "../../../assets/success-notification.mp3";
import { connectManualRuntimeGateway } from "../../../application/runtime/facades/connectManualRuntimeGateway";
import { isMobilePlatform } from "../../../utils/platformPaths";
import { useAppSettingsController } from "./useAppSettingsController";
import { useCodeCssVars } from "./useCodeCssVars";
import { useGitBranchActions } from "./useGitBranchActions";
import { useGitHubPanelController } from "./useGitHubPanelController";
import { useGitPanelController } from "./useGitPanelController";
import { useLiquidGlassEffect } from "./useLiquidGlassEffect";
import { useSidebarToggleProps } from "./useSidebarToggleProps";
import { useSettingsModalState } from "./useSettingsModalState";
import { useUpdaterController } from "./useUpdaterController";
import { useWorkspaceController } from "./useWorkspaceController";
import { useDebugLog } from "../../debug/hooks/useDebugLog";
import { useGitRemote } from "../../git/hooks/useGitRemote";
import { useGitRepoScan } from "../../git/hooks/useGitRepoScan";
import { useLayoutMode } from "../../layout/hooks/useLayoutMode";
import { useMobileServerSetup } from "../../mobile/hooks/useMobileServerSetup";
import { useErrorToasts } from "../../notifications/hooks/useErrorToasts";
import { useShellNavigation } from "../../shell/hooks/useShellNavigation";
import { useLayoutController } from "./useLayoutController";

type UseMainAppShellBootstrapParams = {
  recordPendingThreadLinkRef: MutableRefObject<(workspaceId: string, threadId: string) => void>;
};

export function useMainAppShellBootstrap({
  recordPendingThreadLinkRef,
}: UseMainAppShellBootstrapParams) {
  const {
    appSettings,
    setAppSettings,
    doctor,
    codexUpdate,
    appSettingsLoading,
    reduceTransparency,
    setReduceTransparency,
    scaleShortcutTitle,
    scaleShortcutText,
    queueSaveSettings,
  } = useAppSettingsController();

  useCodeCssVars(appSettings);

  const debugState = useDebugLog();
  const shouldReduceTransparency = reduceTransparency || isMobilePlatform();
  useLiquidGlassEffect({
    reduceTransparency: shouldReduceTransparency,
    onDebug: debugState.addDebugEntry,
  });

  const workspaceState = useWorkspaceController({
    appSettings,
    appSettingsLoading,
    addDebugEntry: debugState.addDebugEntry,
    queueSaveSettings,
  });

  const { workspaces, activeWorkspace, activeWorkspaceId, refreshWorkspaces } = workspaceState;

  const threadCodexWorkspaceContext = useMemo(
    () => activeWorkspace ?? workspaces.find((workspace) => workspace.connected) ?? null,
    [activeWorkspace, workspaces]
  );

  const mobileState = useMobileServerSetup({
    appSettings,
    appSettingsLoading,
    queueSaveSettings,
    refreshWorkspaces,
  });

  const handleConnectLocalRuntimePort = useCallback(
    ({ host, port }: { host: string | null; port: number }) =>
      connectManualRuntimeGateway({
        host,
        port,
        refreshWorkspaces,
      }),
    [refreshWorkspaces]
  );

  const workspacesById = useMemo(
    () => new Map(workspaces.map((workspace) => [workspace.id, workspace])),
    [workspaces]
  );

  const layoutMode = useLayoutMode();
  const { activeTab, setActiveTab } = useShellNavigation({
    activeWorkspace,
    layoutMode,
  });

  const layoutState = useLayoutController({
    activeWorkspaceId,
    layoutMode,
    activeTab,
    setActiveTab,
    setDebugOpen: debugState.setDebugOpen,
    toggleDebugPanelShortcut: appSettings.toggleDebugPanelShortcut,
    toggleTerminalShortcut: appSettings.toggleTerminalShortcut,
  });

  const sidebarToggleProps = useSidebarToggleProps({
    isCompact: layoutState.isCompact,
    sidebarCollapsed: layoutState.sidebarCollapsed,
    rightPanelCollapsed: layoutState.rightPanelCollapsed,
    onCollapseSidebar: layoutState.collapseSidebar,
    onExpandSidebar: layoutState.expandSidebar,
    onCollapseRightPanel: layoutState.collapseRightPanel,
    onExpandRightPanel: layoutState.expandRightPanel,
  });

  const settingsModalState = useSettingsModalState();
  const { settingsOpen, settingsSection, openSettings, closeSettings } = settingsModalState;

  const getWorkspaceName = useCallback(
    (workspaceId: string) => workspacesById.get(workspaceId)?.name,
    [workspacesById]
  );

  const updaterController = useUpdaterController({
    enabled: !mobileState.isMobileRuntime,
    notificationSoundsEnabled: appSettings.notificationSoundsEnabled,
    systemNotificationsEnabled: appSettings.systemNotificationsEnabled,
    getWorkspaceName,
    onThreadNotificationSent: (workspaceId, threadId) =>
      recordPendingThreadLinkRef.current(workspaceId, threadId),
    onDebug: debugState.addDebugEntry,
    successSoundUrl,
    errorSoundUrl,
  });

  const { errorToasts, dismissErrorToast } = useErrorToasts();
  const gitHubPanelState = useGitHubPanelController();
  const gitPanelState = useGitPanelController({
    activeWorkspace,
    gitDiffPreloadEnabled: appSettings.preloadGitDiffs,
    gitDiffIgnoreWhitespaceChanges: appSettings.gitDiffIgnoreWhitespaceChanges,
    splitChatDiffView: appSettings.splitChatDiffView,
    isCompact: layoutState.isCompact,
    activeTab,
    setActiveTab,
    prDiffs: gitHubPanelState.gitPullRequestDiffs,
    prDiffsLoading: gitHubPanelState.gitPullRequestDiffsLoading,
    prDiffsError: gitHubPanelState.gitPullRequestDiffsError,
  });

  const shouldLoadGitHubPanelData =
    gitPanelState.gitPanelMode === "issues" ||
    gitPanelState.gitPanelMode === "prs" ||
    (gitPanelState.shouldLoadDiffs && gitPanelState.diffSource === "pr");

  useEffect(() => {
    gitHubPanelState.resetGitHubPanelState();
  }, [gitHubPanelState.resetGitHubPanelState]);

  const { remote: gitRemoteUrl } = useGitRemote(activeWorkspace);
  const gitRootState = useGitRepoScan(activeWorkspace);

  const gitBranchState = useGitBranchActions({
    workspaceId: activeWorkspace?.id ?? null,
    gitStatus: gitPanelState.gitStatus,
    refreshGitStatus: gitPanelState.refreshGitStatus,
  });

  return {
    appSettings,
    setAppSettings,
    doctor,
    codexUpdate,
    appSettingsLoading,
    reduceTransparency,
    setReduceTransparency,
    scaleShortcutTitle,
    scaleShortcutText,
    queueSaveSettings,
    debugState,
    shouldReduceTransparency,
    workspaceState,
    threadCodexWorkspaceContext,
    mobileState,
    handleConnectLocalRuntimePort,
    workspacesById,
    activeTab,
    setActiveTab,
    layoutState,
    sidebarToggleProps,
    settingsOpen,
    settingsSection,
    openSettings,
    closeSettings,
    getWorkspaceName,
    updaterController,
    errorToasts,
    dismissErrorToast,
    gitHubPanelState,
    gitPanelState,
    shouldLoadGitHubPanelData,
    gitRemoteUrl,
    gitRootState,
    gitBranchState,
  };
}
