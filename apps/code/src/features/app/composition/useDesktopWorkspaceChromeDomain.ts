import type { ComponentProps } from "react";
import type { WorkspaceDesktopAppHost } from "../components/WorkspaceDesktopAppHost";
import { useMainAppLayoutNodesState } from "../hooks/useMainAppLayoutNodesState";
import { useMainAppShellSurfaceProps } from "../hooks/useMainAppShellSurfaceProps";
import { useMainAppSurfaceStyles } from "../hooks/useMainAppSurfaceStyles";
import { REMOTE_THREAD_POLL_INTERVAL_MS } from "../hooks/useRemoteThreadRefreshOnFocus";
import { resolveCompactCodexUiState } from "../utils/compactCodexUiState";
import type { DesktopWorkspaceChromeDomainContracts } from "./desktopWorkspaceContracts";

export type DesktopWorkspaceChromeDomainInput = DesktopWorkspaceChromeDomainContracts;

export type DesktopWorkspaceChromeDomainOutput = Pick<
  ComponentProps<typeof WorkspaceDesktopAppHost>,
  "appClassName" | "appStyle" | "appLayoutProps" | "appModalsProps" | "titlebarControlsNode"
> & {
  showCompactCodexThreadActions: boolean;
  showMobilePollingFetchStatus: boolean;
};

export function useDesktopWorkspaceChromeDomain({
  bootstrap,
  domains,
  shell,
}: DesktopWorkspaceChromeDomainInput): DesktopWorkspaceChromeDomainOutput {
  const {
    workspaceState,
    mobileState,
    layoutState,
    sidebarToggleProps,
    activeTab,
    settingsOpen,
    settingsSection,
    openSettings,
    closeSettings,
    updaterController,
    errorToasts,
    dismissErrorToast,
    handleConnectLocalRuntimePort,
    workspacesById,
    setActiveTab,
    debugState,
    gitRemoteUrl,
    gitBranchState,
    gitPanelState,
    gitHubPanelState,
    appSettings,
    setAppSettings,
    queueSaveSettings,
    doctor,
    codexUpdate,
    reduceTransparency,
    setReduceTransparency,
    scaleShortcutTitle,
    scaleShortcutText,
    shouldReduceTransparency,
  } = bootstrap;
  const {
    project: projectDomain,
    thread: threadDomain,
    conversation: conversationDomain,
    mission: missionDomain,
  } = domains;
  const {
    threadCodexState,
    threadListSortKey,
    composerEditorExpanded,
    toggleComposerEditorExpanded,
    composerEditorSettings,
    skills,
    prompts,
    composerInputRef,
    gitActions,
    activeGitRoot,
    handleSetGitRoot,
    handlePickGitRoot,
    handleApplyWorktreeChanges,
    worktreeApplyLoading,
    worktreeApplyError,
    worktreeApplySuccess,
    gitRootScanDepth,
    gitRootScanLoading,
    gitRootScanError,
    gitRootScanHasScanned,
    gitRootCandidates,
    setGitRootScanDepth,
    scanGitRoots,
  } = shell;
  const {
    workspaceGroups,
    groupedWorkspaces,
    ungroupedLabel,
    activeWorkspace,
    activeWorkspaceId,
    updateWorkspaceSettings,
    updateWorkspaceCodexBin,
    createWorkspaceGroup,
    renameWorkspaceGroup,
    moveWorkspaceGroup,
    deleteWorkspaceGroup,
    assignWorkspaceGroup,
    renameWorkspace,
    removeWorkspace,
    removeWorktree,
    deletingWorktreeIds,
    hasLoaded,
    workspaceLoadError,
    workspaces,
  } = workspaceState;
  const { handleMobileConnectSuccess } = mobileState;
  const { currentBranch, fileStatus } = gitBranchState;
  const handleStartTaskFromGitHubIssueCommentCommand = (
    issue: Parameters<
      NonNullable<
        Parameters<
          typeof useMainAppLayoutNodesState
        >[0]["gitReview"]["actions"]["onStartTaskFromGitHubIssueCommentCommand"]
      >
    >[0]
  ) =>
    missionDomain.handleStartTaskFromGitHubIssueCommentCommand({
      issue,
      event: {
        eventName: "issue_comment",
        action: "created",
      },
      command: {
        triggerMode: "issue_comment_command",
        commandKind: "continue",
      },
    });
  const handleStartTaskFromGitHubPullRequestReviewCommentCommand = (
    pullRequest: Parameters<
      NonNullable<
        Parameters<
          typeof useMainAppLayoutNodesState
        >[0]["gitReview"]["actions"]["onStartTaskFromGitHubPullRequestReviewCommentCommand"]
      >
    >[0],
    comment: Parameters<
      NonNullable<
        Parameters<
          typeof useMainAppLayoutNodesState
        >[0]["gitReview"]["actions"]["onStartTaskFromGitHubPullRequestReviewCommentCommand"]
      >
    >[1]
  ) =>
    missionDomain.handleStartTaskFromGitHubPullRequestReviewCommentCommand({
      pullRequest,
      comments: gitHubPanelState.gitPullRequestComments,
      event: {
        eventName: "pull_request_review_comment",
        action: "created",
      },
      command: {
        triggerMode: "pull_request_review_comment_command",
        commandKind: "continue",
        comment,
      },
    });

  const { appClassName, appStyle } = useMainAppSurfaceStyles({
    appSettings,
    isCompact: layoutState.isCompact,
    isPhone: layoutState.isPhone,
    shouldReduceTransparency,
    sidebarCollapsed: layoutState.sidebarCollapsed,
    rightPanelCollapsed: layoutState.rightPanelCollapsed,
    sidebarWidth: layoutState.sidebarWidth,
    rightPanelWidth: layoutState.rightPanelWidth,
    planPanelHeight: layoutState.planPanelHeight,
    terminalPanelHeight: layoutState.terminalPanelHeight,
    debugPanelHeight: layoutState.debugPanelHeight,
  });

  const { showCompactCodexThreadActions, showMobilePollingFetchStatus } =
    resolveCompactCodexUiState({
      hasActiveWorkspace: Boolean(activeWorkspace),
      isCompact: layoutState.isCompact,
      isPhone: layoutState.isPhone,
      activeTab,
      isActiveWorkspaceConnected: Boolean(activeWorkspace?.connected),
      threadLiveConnectionState: threadDomain.threadLiveConnectionState,
      hasActiveThread: Boolean(threadDomain.activeThreadId),
      isProcessing: conversationDomain.conversationState.processingState.isProcessing,
    });

  const layoutNodes = useMainAppLayoutNodesState({
    shell: {
      state: {
        workspaceGroupsCount: workspaceGroups.length,
        sidebarToggleProps,
        activeTab,
        showPollingFetchStatus: showMobilePollingFetchStatus,
        pollingIntervalMs: REMOTE_THREAD_POLL_INTERVAL_MS,
        mainAppHandlers: conversationDomain.mainAppHandlers,
        appSettings,
        workspacesById,
        launchScriptState: projectDomain.launchScriptState,
        activeGitRoot,
        worktreeApplyLoading,
        worktreeApplyError,
        worktreeApplySuccess,
        threadsState: {
          ...threadDomain.threadsState,
          activeItems: threadDomain.visibleActiveItems,
        },
        workspaces,
        groupedWorkspaces,
        hasLoadedWorkspaces: hasLoaded,
        workspaceLoadError,
        deletingWorktreeIds,
        newAgentDraftWorkspaceId: threadDomain.draftState.newAgentDraftWorkspaceId,
        startingDraftThreadWorkspaceId: threadDomain.draftState.startingDraftThreadWorkspaceId,
        threadListSortKey,
        activeWorkspaceId,
        openAppIconById: projectDomain.openAppIconById,
        activeWorkspace,
        onOpenBranchSwitcher: projectDomain.openBranchSwitcher,
        handleBranchSelection: projectDomain.handleBranchSelection,
        launchScriptsState: projectDomain.launchScriptsState,
        activeAtlasDriverOrder: threadDomain.atlasControls.activeAtlasDriverOrder,
        activeAtlasEnabled: threadDomain.atlasControls.activeAtlasEnabled,
        activeAtlasDetailLevel: threadDomain.atlasControls.activeAtlasDetailLevel,
        activeAtlasLongTermMemoryDigest: threadDomain.atlasControls.activeAtlasLongTermMemoryDigest,
        fileStatus,
        gitRemoteUrl,
        gitRootCandidates,
        gitRootScanDepth,
        gitRootScanLoading,
        gitRootScanError,
        gitRootScanHasScanned,
        conversationState: conversationDomain.conversationState,
        gitPanelState,
        gitHubPanelState,
        layoutState,
      },
      actions: {
        handleSetThreadListSortKey: threadDomain.handleSetThreadListSortKey,
        handleRefreshAllWorkspaceThreads: threadDomain.handleRefreshAllWorkspaceThreads,
        onOpenSettings: (section) => openSettings(section),
        clearDraftState: threadDomain.draftState.clearDraftState,
        clearDraftStateIfDifferentWorkspace:
          threadDomain.draftState.clearDraftStateIfDifferentWorkspace,
        selectHome: projectDomain.selectHome,
        selectWorkspace: projectDomain.selectWorkspace,
        connectWorkspace: workspaceState.connectWorkspace,
        setActiveWorkspaceId: workspaceState.setActiveWorkspaceId,
        setActiveTab,
        updateWorkspaceSettings,
        handleRenameThread: threadDomain.renamePromptState.openRenamePrompt,
        removeWorkspace,
        removeWorktree,
        exitDiffView: projectDomain.exitDiffView,
        refreshGitStatus: gitPanelState.refreshGitStatus,
        handleCopyThread: threadDomain.handleCopyThread,
        onActiveAtlasDriverOrderChange: threadDomain.atlasControls.onActiveAtlasDriverOrderChange,
        onActiveAtlasEnabledChange: threadDomain.atlasControls.onActiveAtlasEnabledChange,
        onActiveAtlasDetailLevelChange: threadDomain.atlasControls.onActiveAtlasDetailLevelChange,
        setGitRootScanDepth,
        scanGitRoots,
        handlePickGitRoot,
        handleSetGitRoot: async (path) => {
          handleSetGitRoot(path);
        },
        handleApplyWorktreeChanges,
        handleStageGitAll: async () => {
          await Promise.resolve(gitActions.handleStageGitAll());
        },
        handleStageGitFile: async (path) => {
          await Promise.resolve(gitActions.handleStageGitFile(path));
        },
        handleUnstageGitFile: async (path) => {
          await Promise.resolve(gitActions.handleUnstageGitFile(path));
        },
        handleRevertGitFile: async (path) => {
          await Promise.resolve(gitActions.handleRevertGitFile(path));
        },
        handleRevertAllGitChanges: async () => {
          await Promise.resolve(gitActions.handleRevertAllGitChanges());
        },
      },
    },
    conversation: {
      state: {
        threadsState: {
          ...threadDomain.threadsState,
          activeItems: threadDomain.visibleActiveItems,
        },
        skills,
        prompts,
        composerInputRef,
        composerEditorSettings,
        composerEditorExpanded,
        threadCodexState,
        autoDriveState: missionDomain.missionControlState.autoDriveState,
        conversationState: conversationDomain.conversationState,
        activeWorkspace,
      },
      actions: {
        toggleComposerEditorExpanded,
      },
    },
    gitReview: {
      state: {
        gitPanelState,
        gitHubPanelState,
        gitCommitState: missionDomain.gitCommitState,
        activeGitRoot,
        gitRemoteUrl,
        defaultRemoteExecutionBackendId: appSettings.defaultRemoteExecutionBackendId,
        worktreeApplyLoading,
        worktreeApplyError,
        worktreeApplySuccess,
        activeWorkspaceId,
        activeWorkspace,
        setActiveWorkspaceId: workspaceState.setActiveWorkspaceId,
        setActiveTab,
        conversationState: conversationDomain.conversationState,
      },
      actions: {
        onStartTaskFromGitHubIssue: missionDomain.handleStartTaskFromGitHubIssue,
        onStartTaskFromGitHubIssueCommentCommand: handleStartTaskFromGitHubIssueCommentCommand,
        onStartTaskFromGitHubPullRequest: missionDomain.handleStartTaskFromGitHubPullRequest,
        onStartTaskFromGitHubPullRequestReviewCommentCommand:
          handleStartTaskFromGitHubPullRequestReviewCommentCommand,
      },
      reviewPackControllerReady: missionDomain.missionControlState.onReviewPackControllerReady,
    },
    runtime: {
      state: {
        updaterController,
        terminalControls: {
          terminalTabs: projectDomain.terminalTabs,
          activeTerminalId: projectDomain.activeTerminalId,
          onSelectTerminal: projectDomain.onSelectTerminal,
          onNewTerminal: projectDomain.onNewTerminal,
          onCloseTerminal: projectDomain.onCloseTerminal,
          terminalState: projectDomain.terminalState,
          canControlActiveTerminal: projectDomain.canControlActiveTerminal,
          handleClearActiveTerminal: projectDomain.handleClearActiveTerminal,
          handleRestartActiveTerminal: projectDomain.handleRestartActiveTerminal,
          handleInterruptActiveTerminal: projectDomain.handleInterruptActiveTerminal,
        },
        activeAccount: threadDomain.accountControls.activeAccount,
        accountSwitchError: threadDomain.accountControls.accountSwitchError,
        accountCenter: threadDomain.accountControls.accountCenter,
        accountSwitching: threadDomain.accountControls.accountSwitching,
        canRefreshCurrentUsage: threadDomain.usageRefresh.canRefreshCurrentUsage,
        canRefreshAllUsage: threadDomain.usageRefresh.canRefreshAllUsage,
        currentUsageRefreshLoading: threadDomain.usageRefresh.currentUsageRefreshLoading,
        allUsageRefreshLoading: threadDomain.usageRefresh.allUsageRefreshLoading,
        errorToasts,
        debugState,
        layoutState,
      },
      actions: {
        handleSwitchAccount: threadDomain.accountControls.handleSwitchAccount,
        handleSelectLoggedInCodexAccount:
          threadDomain.accountControls.handleSelectLoggedInCodexAccount,
        handleCancelSwitchAccount: threadDomain.accountControls.handleCancelSwitchAccount,
        onConnectLocalRuntimePort: handleConnectLocalRuntimePort,
        onRefreshCurrentUsage: threadDomain.usageRefresh.handleRefreshCurrentUsage,
        onRefreshAllUsage: threadDomain.usageRefresh.handleRefreshAllUsage,
        handleSelectOpenAppId: projectDomain.handleSelectOpenAppId,
        dismissErrorToast,
      },
    },
  });

  const { mainAppLayoutProps, mainAppModalsProps, titlebarControlsNode } =
    useMainAppShellSurfaceProps({
      chromeInput: {
        isCompact: layoutState.isCompact,
        sidebarToggleProps,
        desktopTopbarLeftNode: layoutNodes.desktopTopbarLeftNode,
        desktopTopbarRightNode: layoutNodes.desktopTopbarRightNode,
        showCompactCodexThreadActions,
        hasActiveThread: Boolean(threadDomain.activeThreadId),
        isActiveWorkspaceConnected: Boolean(activeWorkspace?.connected),
        threadLiveConnectionState: threadDomain.threadLiveConnectionState,
      },
      settingsInput: {
        workspaceGroups,
        groupedWorkspaces,
        ungroupedLabel,
        onMoveWorkspace: conversationDomain.mainAppHandlers.handleMoveWorkspace,
        removeWorkspace,
        renameWorkspace,
        createWorkspaceGroup,
        renameWorkspaceGroup,
        moveWorkspaceGroup,
        deleteWorkspaceGroup,
        assignWorkspaceGroup,
        reduceTransparency,
        setReduceTransparency,
        appSettings,
        openAppIconById: projectDomain.openAppIconById,
        setAppSettings,
        queueSaveSettings,
        doctor,
        codexUpdate,
        updateWorkspaceCodexBin,
        updateWorkspaceSettings,
        scaleShortcutTitle,
        scaleShortcutText,
        onTestNotificationSound: updaterController.handleTestNotificationSound,
        onTestSystemNotification: updaterController.handleTestSystemNotification,
        handleMobileConnectSuccess,
        onOpenMissionTarget: missionDomain.missionControlState.openMissionTarget,
      },
      layoutInput: {
        isPhone: layoutState.isPhone,
        showHome: conversationDomain.conversationState.homeState.showHome,
        showGitDetail: conversationDomain.mainAppHandlers.showGitDetail,
        activeTab,
        activeThreadId: threadDomain.activeThreadId,
        centerMode: gitPanelState.centerMode,
        preloadGitDiffs: appSettings.preloadGitDiffs,
        splitChatDiffView: appSettings.splitChatDiffView,
        hasActivePlan:
          conversationDomain.conversationState.homeState.hasActivePlan ||
          conversationDomain.conversationState.processingState.isPlanReadyAwaitingResponse,
        sidebarCollapsed: layoutState.sidebarCollapsed,
        onExpandSidebar: layoutState.expandSidebar,
        rightPanelCollapsed: layoutState.rightPanelCollapsed,
        onCollapseRightPanel: layoutState.collapseRightPanel,
        onExpandRightPanel: layoutState.expandRightPanel,
        hasActiveWorkspace:
          Boolean(activeWorkspace) ||
          (!layoutState.isPhone && !conversationDomain.conversationState.homeState.showHome),
        layoutNodes,
        messagesNode: layoutNodes.messagesNode,
        onSidebarResizeStart: layoutState.onSidebarResizeStart,
        onRightPanelResizeStart: layoutState.onRightPanelResizeStart,
        onPlanPanelResizeStart: layoutState.onPlanPanelResizeStart,
      },
      modalsInput: {
        renamePromptState: threadDomain.renamePromptState,
        worktreePromptState: projectDomain.worktreePromptState,
        clonePromptState: projectDomain.clonePromptState,
        branchSwitcher: projectDomain.branchSwitcher,
        workspaces,
        activeWorkspace,
        branchSwitcherWorkspace: projectDomain.branchSwitcherWorkspace,
        currentBranch,
        onBranchSwitcherSubmit: projectDomain.handleBranchSelection,
        onBranchSwitcherCancel: projectDomain.closeBranchSwitcher,
        settingsOpen,
        settingsSection,
        onCloseSettings: closeSettings,
      },
    });

  return {
    appClassName,
    appStyle,
    appLayoutProps: mainAppLayoutProps,
    appModalsProps: mainAppModalsProps,
    titlebarControlsNode,
    showCompactCodexThreadActions,
    showMobilePollingFetchStatus,
  };
}
