import type { MutableRefObject } from "react";
import type { AppSettings } from "../../../types";
import type { AutoDriveControllerHookDraft } from "../../../application/runtime/types/autoDrive";
import type { useCustomPrompts } from "../../prompts/hooks/useCustomPrompts";
import type { PendingNewThreadSeed } from "../../threads/utils/threadCodexParamsSeed";
import { useDesktopWorkspaceProjectDomain } from "./useDesktopWorkspaceProjectDomain";
import { useDesktopWorkspaceThreadDomain } from "./useDesktopWorkspaceThreadDomain";
import { useMainAppConversationState } from "../hooks/useMainAppConversationState";
import { useMainAppHandlers } from "../hooks/useMainAppHandlers";
import { useMainAppShellBootstrap } from "../hooks/useMainAppShellBootstrap";
import { useRuntimeResyncRefresh } from "../hooks/useRuntimeResyncRefresh";
import { useThreadCodexControls } from "../hooks/useThreadCodexControls";

type MainAppBootstrapState = ReturnType<typeof useMainAppShellBootstrap>;
type ProjectDomainState = ReturnType<typeof useDesktopWorkspaceProjectDomain>;
type ThreadDomainState = ReturnType<typeof useDesktopWorkspaceThreadDomain>;
type ThreadCodexState = ReturnType<typeof useThreadCodexControls>;

export type DesktopWorkspaceConversationDomainInput = {
  workspaceState: MainAppBootstrapState["workspaceState"];
  layoutState: MainAppBootstrapState["layoutState"];
  gitPanelState: MainAppBootstrapState["gitPanelState"];
  gitHubPanelState: MainAppBootstrapState["gitHubPanelState"];
  appSettings: AppSettings;
  activeTab: MainAppBootstrapState["activeTab"];
  setActiveTab: MainAppBootstrapState["setActiveTab"];
  workspacesById: MainAppBootstrapState["workspacesById"];
  openSettings: MainAppBootstrapState["openSettings"];
  debugState: MainAppBootstrapState["debugState"];
  alertError: MainAppBootstrapState["gitBranchState"]["alertError"];
  threadCodexState: ThreadCodexState;
  projectDomain: ProjectDomainState;
  threadDomain: ThreadDomainState;
  promptsState: ReturnType<typeof useCustomPrompts>;
  composerInputRef: MutableRefObject<HTMLTextAreaElement | null>;
  activeThreadIdRef: MutableRefObject<string | null>;
  pendingNewThreadSeedRef: MutableRefObject<PendingNewThreadSeed | null>;
  pendingNewThreadAutoDriveDraftRef: MutableRefObject<AutoDriveControllerHookDraft | null>;
};

export type DesktopWorkspaceConversationDomainOutput = {
  conversationState: ReturnType<typeof useMainAppConversationState>;
  mainAppHandlers: ReturnType<typeof useMainAppHandlers>;
};

export function useDesktopWorkspaceConversationDomain({
  workspaceState,
  layoutState,
  gitPanelState,
  gitHubPanelState,
  appSettings,
  activeTab,
  setActiveTab,
  workspacesById,
  openSettings,
  debugState,
  alertError,
  threadCodexState,
  projectDomain,
  threadDomain,
  promptsState,
  composerInputRef,
  activeThreadIdRef,
  pendingNewThreadSeedRef,
  pendingNewThreadAutoDriveDraftRef,
}: DesktopWorkspaceConversationDomainInput): DesktopWorkspaceConversationDomainOutput {
  const {
    workspaces,
    groupedWorkspaces,
    getWorkspaceGroupName,
    activeWorkspace,
    activeWorkspaceId,
    hasWorkspaceRouteSelection,
    showMissionHomeRoute,
    addWorkspace,
    addWorkspaceFromPath,
    addWorkspacesFromPaths,
    connectWorkspace,
    hasLoaded,
    refreshWorkspaces,
    updateWorkspaceSettings,
  } = workspaceState;
  const {
    activeThreadId,
    approvals,
    userInputRequests,
    activeTurnIdByThread,
    tokenUsageByThread,
    rateLimitsByWorkspace,
    planByThread,
    lastAgentMessageByThread,
    threadsByWorkspace,
    threadStatusById,
    hasPendingDraftUserMessages,
    visibleActiveItems,
    listThreadsForWorkspace,
    refreshThread,
    refreshAccountInfo,
    refreshAccountRateLimits,
    getThreadRows,
    threadsState,
    draftState,
  } = threadDomain;
  const { startingDraftThreadWorkspaceId, isDraftModeForActiveWorkspace, startNewAgentDraft } =
    draftState;
  const { exitDiffView, selectWorkspace, worktreePromptState, clonePromptState } = projectDomain;

  const conversationState = useMainAppConversationState({
    homeStateParams: {
      activeWorkspace,
      activeWorkspaceId,
      hasWorkspaceRouteSelection,
      showMissionHomeRoute,
      activeThreadId,
      startingDraftThreadWorkspaceId,
      hasPendingDraftUserMessages,
      hasLoaded,
      isCompact: layoutState.isCompact,
      isNewAgentDraftMode: isDraftModeForActiveWorkspace,
      activeTab,
      centerMode: gitPanelState.centerMode,
      getWorkspaceGroupName,
      workspaces,
      workspacesById,
      threadsByWorkspace,
      threadListLoadingByWorkspace: threadDomain.threadListLoadingByWorkspace,
      lastAgentMessageByThread,
      threadStatusById,
      rateLimitsByWorkspace,
      tokenUsageByThread,
      planByThread,
    },
    fileListingParams: {
      activeWorkspace,
      activeWorkspaceId,
      filePanelMode: gitPanelState.filePanelMode,
      isCompact: layoutState.isCompact,
      activeTab,
      rightPanelCollapsed: layoutState.rightPanelCollapsed,
      onDebug: debugState.addDebugEntry,
    },
    activeItems: visibleActiveItems,
    approvals,
    userInputRequests,
    toolCallRequests: threadsState.toolCallRequests,
    activeTurnIdByThread,
    composerParams: {
      activeThreadId,
      activeWorkspaceId,
      activeWorkspace,
      steerEnabled: appSettings.steerEnabled,
      connectWorkspace,
      startThreadForWorkspace: threadsState.startThreadForWorkspace,
      sendUserMessage: threadsState.sendUserMessage,
      sendUserMessageToThread: threadsState.sendUserMessageToThread,
      startFork: threadsState.startFork,
      startReview: threadsState.startReview,
      startResume: threadsState.startResume,
      startCompact: threadsState.startCompact,
      startMcp: threadsState.startMcp,
      startStatus: threadsState.startStatus,
    },
    composerInputRef,
  });

  const mainAppHandlers = useMainAppHandlers({
    ...threadsState,
    activeWorkspace,
    activeWorkspaceId,
    activeThreadIsProcessing: conversationState.processingState.isProcessing,
    connectWorkspace,
    sendUserMessageToThread: threadsState.sendUserMessageToThread,
    createPrompt: promptsState.createPrompt,
    updatePrompt: promptsState.updatePrompt,
    deletePrompt: promptsState.deletePrompt,
    movePrompt: promptsState.movePrompt,
    getWorkspacePromptsDir: promptsState.getWorkspacePromptsDir,
    getGlobalPromptsDir: promptsState.getGlobalPromptsDir,
    alertError,
    workspacesById,
    renameWorktreePrompt: projectDomain.renameWorktreePrompt,
    renameWorktreeNotice: projectDomain.renameWorktreeNotice,
    renameWorktreeUpstreamPrompt: projectDomain.renameWorktreeUpstreamPrompt,
    confirmRenameWorktreeUpstream: projectDomain.confirmRenameWorktreeUpstream,
    handleOpenRenameWorktree: () => {
      if (activeWorkspace) {
        projectDomain.openRenameWorktreePrompt(activeWorkspace.id);
      }
    },
    handleRenameWorktreeChange: projectDomain.handleRenameWorktreeChange,
    handleRenameWorktreeCancel: projectDomain.handleRenameWorktreeCancel,
    handleRenameWorktreeConfirm: projectDomain.handleRenameWorktreeConfirm,
    isPhone: layoutState.isPhone,
    setActiveTab,
    workspaces,
    hasLoaded,
    refreshWorkspaces,
    appSettings,
    suspendRemoteThreadPolling:
      threadDomain.threadLiveConnectionState === "live" ||
      threadDomain.threadLiveConnectionState === "syncing",
    isCompact: layoutState.isCompact,
    addWorkspace,
    addWorkspaceFromPath,
    addWorkspacesFromPaths,
    exitDiffView,
    selectWorkspace,
    startNewAgentDraft,
    openWorktreePrompt: worktreePromptState.openPrompt,
    openClonePrompt: clonePromptState.openPrompt,
    composerInputRef,
    addDebugEntry: debugState.addDebugEntry,
    clearDraftForThread: conversationState.composerState.clearDraftForThread,
    removeImagesForThread: conversationState.composerState.removeImagesForThread,
    canInterrupt: conversationState.homeState.canInterrupt,
    selectedPullRequest: gitPanelState.selectedPullRequest,
    gitPullRequestDiffs: gitHubPanelState.gitPullRequestDiffs,
    filePanelMode: gitPanelState.filePanelMode,
    gitPanelMode: gitPanelState.gitPanelMode,
    centerMode: gitPanelState.centerMode,
    setSelectedPullRequest: gitPanelState.setSelectedPullRequest,
    setDiffSource: gitPanelState.setDiffSource,
    setSelectedDiffPath: gitPanelState.setSelectedDiffPath,
    setCenterMode: gitPanelState.setCenterMode,
    setGitPanelMode: gitPanelState.setGitPanelMode,
    setPrefillDraft: conversationState.composerState.setPrefillDraft,
    clearActiveImages: conversationState.composerState.clearActiveImages,
    handleSend: conversationState.composerState.handleSend,
    queueMessage: conversationState.composerState.queueMessage,
    pendingNewThreadSeedRef,
    pendingNewThreadAutoDriveDraftRef,
    selectionMode: threadCodexState.selectionMode,
    preferredProviderFamilyId: threadCodexState.preferredProviderFamilyId,
    selectedCollaborationModeId: threadCodexState.selectedCollaborationModeId,
    accessMode: threadCodexState.accessMode,
    executionMode: threadCodexState.executionMode,
    fastModeEnabled: threadCodexState.fastModeEnabled,
    runWithDraftStart: draftState.runWithDraftStart,
    clearDraftState: draftState.clearDraftState,
    collaborationModes: threadCodexState.collaborationModes,
    setSelectedCollaborationModeId: threadCodexState.setSelectedCollaborationModeId,
    showComposer: conversationState.homeState.showComposer,
    selectedDiffPath: gitPanelState.selectedDiffPath,
    groupedWorkspaces,
    getThreadRows,
    activeWorkspaceIdRef: gitPanelState.activeWorkspaceIdRef,
    activeThreadIdRef,
    activeWorkspaceRef: gitPanelState.activeWorkspaceRef,
    openSettings,
    handleDebugClick: layoutState.handleDebugClick,
    handleToggleTerminal: layoutState.handleToggleTerminal,
    sidebarCollapsed: layoutState.sidebarCollapsed,
    rightPanelCollapsed: layoutState.rightPanelCollapsed,
    expandSidebar: layoutState.expandSidebar,
    collapseSidebar: layoutState.collapseSidebar,
    expandRightPanel: layoutState.expandRightPanel,
    collapseRightPanel: layoutState.collapseRightPanel,
    updateWorkspaceSettings,
  });

  useRuntimeResyncRefresh({
    activeWorkspace,
    activeThreadId,
    refreshWorkspaces,
    listThreadsForWorkspace,
    refreshThread,
    refreshAccountInfo,
    refreshAccountRateLimits,
    onDebug: debugState.addDebugEntry,
  });

  return {
    conversationState,
    mainAppHandlers,
  };
}
