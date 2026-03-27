import { useEffect, useMemo, useRef, type ComponentProps } from "react";
import type { ComposerEditorSettings } from "../../../types";
import type { AutoDriveControllerHookDraft } from "../../../application/runtime/types/autoDrive";
import { useComposerEditorState } from "../../composer/hooks/useComposerEditorState";
import { useAutoExitEmptyDiff } from "../../git/hooks/useAutoExitEmptyDiff";
import { useGitActions } from "../../git/hooks/useGitActions";
import { useCustomPrompts } from "../../prompts/hooks/useCustomPrompts";
import { useSkills } from "../../skills/hooks/useSkills";
import { useThreadAtlasParams } from "../../threads/hooks/useThreadAtlasParams";
import { useThreadCodexParams } from "../../threads/hooks/useThreadCodexParams";
import type { PendingNewThreadSeed } from "../../threads/utils/threadCodexParamsSeed";
import { WorkspaceDesktopAppHost } from "../components/WorkspaceDesktopAppHost";
import { useDesktopWorkspaceChromeDomain } from "./useDesktopWorkspaceChromeDomain";
import { useDesktopWorkspaceConversationDomain } from "./useDesktopWorkspaceConversationDomain";
import { useDesktopWorkspaceMissionDomain } from "./useDesktopWorkspaceMissionDomain";
import { useDesktopWorkspaceProjectDomain } from "./useDesktopWorkspaceProjectDomain";
import { useDesktopWorkspaceThreadDomain } from "./useDesktopWorkspaceThreadDomain";
import { useMainAppShellBootstrap } from "../hooks/useMainAppShellBootstrap";
import { useSyncSelectedDiffPath } from "../hooks/useSyncSelectedDiffPath";
import { useThreadCodexControls } from "../hooks/useThreadCodexControls";
import { useThreadListSortKey } from "../hooks/useThreadListSortKey";
import { useGitRootSelection } from "../hooks/useGitRootSelection";

export function useDesktopWorkspaceFeatureComposition(): ComponentProps<
  typeof WorkspaceDesktopAppHost
> {
  const {
    version: threadCodexParamsVersion,
    getThreadCodexParams,
    patchThreadCodexParams,
  } = useThreadCodexParams();
  const {
    getThreadAtlasParams,
    getThreadAtlasMemoryDigest,
    patchThreadAtlasParams,
    upsertThreadAtlasMemoryDigest,
  } = useThreadAtlasParams();
  const { threadListSortKey, setThreadListSortKey } = useThreadListSortKey();
  const activeWorkspaceIdForParamsRef = useRef<string | null>(null);
  const visibleActiveThreadIdRef = useRef<string | null>(null);
  const activeThreadIdRef = useRef<string | null>(null);
  const pendingNewThreadSeedRef = useRef<PendingNewThreadSeed | null>(null);
  const pendingNewThreadAutoDriveDraftRef = useRef<AutoDriveControllerHookDraft | null>(null);
  const composerInputRef = useRef<HTMLTextAreaElement | null>(null);
  const recordPendingThreadLinkRef = useRef<(workspaceId: string, threadId: string) => void>(
    () => undefined
  );

  const bootstrap = useMainAppShellBootstrap({
    recordPendingThreadLinkRef,
  });
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
  } = bootstrap;
  const {
    workspaces,
    activeWorkspace,
    activeWorkspaceId,
    markWorkspaceConnected,
    updateWorkspaceSettings,
  } = workspaceState;
  const { showMobileSetupWizard, mobileSetupWizardProps } = mobileState;

  useEffect(() => {
    activeWorkspaceIdForParamsRef.current = activeWorkspaceId ?? null;
  }, [activeWorkspaceId]);

  const {
    repos: gitRootCandidates,
    isLoading: gitRootScanLoading,
    error: gitRootScanError,
    depth: gitRootScanDepth,
    hasScanned: gitRootScanHasScanned,
    scan: scanGitRoots,
    setDepth: setGitRootScanDepth,
    clear: clearGitRootCandidates,
  } = gitRootState;

  const threadCodexState = useThreadCodexControls({
    activeWorkspace: threadCodexWorkspaceContext,
    appSettings,
    appSettingsLoading,
    setAppSettings,
    queueSaveSettings,
    addDebugEntry: debugState.addDebugEntry,
    composerInputRef,
    activeWorkspaceIdForParamsRef,
    activeThreadIdRef,
    visibleActiveThreadIdRef,
    getThreadCodexParams,
    patchThreadCodexParams,
  });

  const skillsState = useSkills({ activeWorkspace, onDebug: debugState.addDebugEntry });
  const promptsState = useCustomPrompts({ activeWorkspace, onDebug: debugState.addDebugEntry });
  const {
    applyWorktreeChanges: handleApplyWorktreeChanges,
    revertAllGitChanges: handleRevertAllGitChanges,
    revertGitFile: handleRevertGitFile,
    stageGitAll: handleStageGitAll,
    stageGitFile: handleStageGitFile,
    unstageGitFile: handleUnstageGitFile,
    worktreeApplyError,
    worktreeApplyLoading,
    worktreeApplySuccess,
  } = useGitActions({
    activeWorkspace,
    onRefreshGitStatus: gitPanelState.refreshGitStatus,
    onRefreshGitDiffs: gitPanelState.refreshGitDiffs,
    onError: gitBranchState.alertError,
  });
  const { activeGitRoot, handleSetGitRoot, handlePickGitRoot } = useGitRootSelection({
    activeWorkspace,
    updateWorkspaceSettings,
    clearGitRootCandidates,
    refreshGitStatus: gitPanelState.refreshGitStatus,
  });
  const { isExpanded: composerEditorExpanded, toggleExpanded: toggleComposerEditorExpanded } =
    useComposerEditorState();
  const composerEditorSettings = useMemo<ComposerEditorSettings>(
    () => ({
      preset: appSettings.composerEditorPreset,
      expandFenceOnSpace: appSettings.composerFenceExpandOnSpace,
      expandFenceOnEnter: appSettings.composerFenceExpandOnEnter,
      fenceLanguageTags: appSettings.composerFenceLanguageTags,
      fenceWrapSelection: appSettings.composerFenceWrapSelection,
      autoWrapPasteMultiline: appSettings.composerFenceAutoWrapPasteMultiline,
      autoWrapPasteCodeLike: appSettings.composerFenceAutoWrapPasteCodeLike,
      continueListOnShiftEnter: appSettings.composerListContinuation,
    }),
    [
      appSettings.composerEditorPreset,
      appSettings.composerFenceExpandOnSpace,
      appSettings.composerFenceExpandOnEnter,
      appSettings.composerFenceLanguageTags,
      appSettings.composerFenceWrapSelection,
      appSettings.composerFenceAutoWrapPasteMultiline,
      appSettings.composerFenceAutoWrapPasteCodeLike,
      appSettings.composerListContinuation,
    ]
  );

  useSyncSelectedDiffPath({
    diffSource: gitPanelState.diffSource,
    centerMode: gitPanelState.centerMode,
    gitPullRequestDiffs: gitHubPanelState.gitPullRequestDiffs,
    gitCommitDiffs: gitPanelState.gitCommitDiffs,
    selectedDiffPath: gitPanelState.selectedDiffPath,
    setSelectedDiffPath: gitPanelState.setSelectedDiffPath,
  });

  const threadDomain = useDesktopWorkspaceThreadDomain({
    activeWorkspace,
    activeWorkspaceId,
    workspaces,
    hasLoaded: workspaceState.hasLoaded,
    markWorkspaceConnected,
    appSettings,
    debugState,
    getWorkspaceName,
    threadCodexWorkspaceContext,
    queueGitStatusRefresh: gitPanelState.queueGitStatusRefresh,
    alertError: gitBranchState.alertError,
    threadCodexState,
    threadCodexParamsVersion,
    getThreadCodexParams,
    patchThreadCodexParams,
    getThreadAtlasParams,
    getThreadAtlasMemoryDigest,
    patchThreadAtlasParams,
    upsertThreadAtlasMemoryDigest,
    threadListSortKey,
    setThreadListSortKey,
    prompts: promptsState.prompts,
    activeThreadIdRef,
    pendingNewThreadSeedRef,
  });
  visibleActiveThreadIdRef.current = threadDomain.activeThreadId;

  useAutoExitEmptyDiff({
    centerMode: gitPanelState.centerMode,
    autoExitEnabled: gitPanelState.diffSource === "local",
    activeDiffCount: gitPanelState.activeDiffs.length,
    activeDiffLoading: gitPanelState.activeDiffLoading,
    activeDiffError: gitPanelState.activeDiffError,
    activeThreadId: threadDomain.activeThreadId,
    isCompact: layoutState.isCompact,
    setCenterMode: gitPanelState.setCenterMode,
    setSelectedDiffPath: gitPanelState.setSelectedDiffPath,
    setActiveTab,
  });

  const projectDomain = useDesktopWorkspaceProjectDomain({
    workspaceState,
    layoutState,
    activeTab,
    setActiveTab,
    gitBranchState,
    debugState,
    appSettings,
    queueSaveSettings,
    setAppSettings,
    setCenterMode: gitPanelState.setCenterMode,
    setSelectedDiffPath: gitPanelState.setSelectedDiffPath,
    activeThreadId: threadDomain.activeThreadId,
    resetWorkspaceThreads: threadDomain.resetWorkspaceThreads,
    listThreadsForWorkspace: threadDomain.listThreadsForWorkspace,
    refreshThread: threadDomain.refreshThread,
  });

  const conversationDomain = useDesktopWorkspaceConversationDomain({
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
    alertError: gitBranchState.alertError,
    threadCodexState,
    projectDomain,
    threadDomain,
    promptsState,
    composerInputRef,
    activeThreadIdRef,
    pendingNewThreadSeedRef,
    pendingNewThreadAutoDriveDraftRef,
  });

  const missionDomain = useDesktopWorkspaceMissionDomain({
    workspaceState,
    gitPanelState,
    gitRemoteUrl,
    appSettings,
    debugState,
    workspacesById,
    getWorkspaceName,
    setActiveTab,
    threadCodexState,
    threadCodexParamsVersion,
    getThreadCodexParams,
    patchThreadCodexParams,
    threadDomain,
    conversationState: conversationDomain.conversationState,
    recordPendingThreadLinkRef,
  });
  pendingNewThreadAutoDriveDraftRef.current =
    missionDomain.missionControlState.autoDriveState.draft;

  const chromeDomain = useDesktopWorkspaceChromeDomain({
    bootstrap: {
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
    },
    domains: {
      project: projectDomain,
      thread: threadDomain,
      conversation: conversationDomain,
      mission: missionDomain,
    },
    shell: {
      threadCodexState,
      threadListSortKey,
      composerEditorExpanded,
      toggleComposerEditorExpanded,
      composerEditorSettings,
      skills: skillsState.skills,
      prompts: promptsState.prompts,
      composerInputRef,
      gitActions: {
        handleStageGitAll,
        handleStageGitFile,
        handleUnstageGitFile,
        handleRevertGitFile,
        handleRevertAllGitChanges,
      },
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
    },
  });

  return {
    activeWorkspaceId,
    activeThreadId: threadDomain.activeThreadId,
    activeWorkspace,
    gitPanelMode: gitPanelState.gitPanelMode,
    shouldLoadDiffs: gitPanelState.shouldLoadDiffs,
    diffSource: gitPanelState.diffSource,
    selectedPullRequestNumber: gitPanelState.selectedPullRequest?.number ?? null,
    onIssuesChange: gitHubPanelState.handleGitIssuesChange,
    onPullRequestsChange: gitHubPanelState.handleGitPullRequestsChange,
    onPullRequestDiffsChange: gitHubPanelState.handleGitPullRequestDiffsChange,
    onPullRequestCommentsChange: gitHubPanelState.handleGitPullRequestCommentsChange,
    appClassName: chromeDomain.appClassName,
    appStyle: chromeDomain.appStyle,
    shouldLoadGitHubPanelData,
    appLayoutProps: chromeDomain.appLayoutProps,
    appModalsProps: chromeDomain.appModalsProps,
    titlebarControlsNode: chromeDomain.titlebarControlsNode,
    showMobileSetupWizard,
    mobileSetupWizardProps,
  };
}
