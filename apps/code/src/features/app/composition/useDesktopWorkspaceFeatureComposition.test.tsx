// @vitest-environment jsdom

import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useDesktopWorkspaceFeatureComposition } from "./useDesktopWorkspaceFeatureComposition";
import { useMainAppShellBootstrap } from "../hooks/useMainAppShellBootstrap";
import { useDesktopWorkspaceChromeDomain } from "./useDesktopWorkspaceChromeDomain";

vi.mock("../../threads/hooks/useThreadCodexParams", () => ({
  useThreadCodexParams: vi.fn(() => ({
    version: 1,
    getThreadCodexParams: vi.fn(),
    patchThreadCodexParams: vi.fn(),
  })),
}));

vi.mock("../../threads/hooks/useThreadAtlasParams", () => ({
  useThreadAtlasParams: vi.fn(() => ({
    getThreadAtlasParams: vi.fn(),
    getThreadAtlasMemoryDigest: vi.fn(),
    patchThreadAtlasParams: vi.fn(),
    upsertThreadAtlasMemoryDigest: vi.fn(),
  })),
}));

vi.mock("../hooks/useThreadListSortKey", () => ({
  useThreadListSortKey: vi.fn(() => ({
    threadListSortKey: "updated_at",
    setThreadListSortKey: vi.fn(),
  })),
}));

vi.mock("../hooks/useMainAppShellBootstrap", () => ({
  useMainAppShellBootstrap: vi.fn(),
}));

vi.mock("../hooks/useThreadCodexControls", () => ({
  useThreadCodexControls: vi.fn(() => ({ selectedModelId: "gpt-5" })),
}));

vi.mock("../../skills/hooks/useSkills", () => ({
  useSkills: vi.fn(() => ({ skills: [] })),
}));

vi.mock("../../prompts/hooks/useCustomPrompts", () => ({
  useCustomPrompts: vi.fn(() => ({ prompts: [] })),
}));

vi.mock("../../git/hooks/useGitActions", () => ({
  useGitActions: vi.fn(() => ({
    applyWorktreeChanges: vi.fn(),
    revertAllGitChanges: vi.fn(),
    revertGitFile: vi.fn(),
    stageGitAll: vi.fn(),
    stageGitFile: vi.fn(),
    unstageGitFile: vi.fn(),
    worktreeApplyError: null,
    worktreeApplyLoading: false,
    worktreeApplySuccess: false,
  })),
}));

vi.mock("../hooks/useGitRootSelection", () => ({
  useGitRootSelection: vi.fn(() => ({
    activeGitRoot: null,
    handleSetGitRoot: vi.fn(),
    handlePickGitRoot: vi.fn(),
  })),
}));

vi.mock("../../composer/hooks/useComposerEditorState", () => ({
  useComposerEditorState: vi.fn(() => ({
    isExpanded: false,
    toggleExpanded: vi.fn(),
  })),
}));

vi.mock("../hooks/useSyncSelectedDiffPath", () => ({
  useSyncSelectedDiffPath: vi.fn(),
}));

vi.mock("../../git/hooks/useAutoExitEmptyDiff", () => ({
  useAutoExitEmptyDiff: vi.fn(),
}));

vi.mock("./useDesktopWorkspaceThreadDomain", () => ({
  useDesktopWorkspaceThreadDomain: vi.fn(() => ({
    activeThreadId: "thread-1",
    visibleActiveItems: [],
    resetWorkspaceThreads: vi.fn(),
    listThreadsForWorkspace: vi.fn(),
    refreshThread: vi.fn(),
    prompts: [],
    accountControls: {
      activeAccount: null,
      accountSwitching: false,
      accountSwitchError: null,
      accountCenter: null,
      handleSwitchAccount: vi.fn(),
      handleSelectLoggedInCodexAccount: vi.fn(),
      handleCancelSwitchAccount: vi.fn(),
    },
    usageRefresh: {
      canRefreshCurrentUsage: true,
      canRefreshAllUsage: true,
      currentUsageRefreshLoading: false,
      allUsageRefreshLoading: false,
      handleRefreshCurrentUsage: vi.fn(),
      handleRefreshAllUsage: vi.fn(),
    },
    threadsState: {},
    draftState: {
      newAgentDraftWorkspaceId: null,
      startingDraftThreadWorkspaceId: null,
    },
    renamePromptState: null,
    atlasControls: {
      activeAtlasDriverOrder: null,
      activeAtlasEnabled: false,
      activeAtlasDetailLevel: "balanced",
      activeAtlasLongTermMemoryDigest: null,
    },
    handleSetThreadListSortKey: vi.fn(),
    handleRefreshAllWorkspaceThreads: vi.fn(),
    threadLiveConnectionState: "idle",
  })),
}));

vi.mock("./useDesktopWorkspaceProjectDomain", () => ({
  useDesktopWorkspaceProjectDomain: vi.fn(() => ({
    openAppIconById: {},
    openBranchSwitcher: vi.fn(),
    handleBranchSelection: vi.fn(),
    launchScriptState: null,
    launchScriptsState: null,
    worktreePromptState: null,
    clonePromptState: null,
    branchSwitcher: null,
    branchSwitcherWorkspace: null,
    closeBranchSwitcher: vi.fn(),
    handleSelectOpenAppId: vi.fn(),
  })),
}));

vi.mock("./useDesktopWorkspaceConversationDomain", () => ({
  useDesktopWorkspaceConversationDomain: vi.fn(() => ({
    conversationState: {
      homeState: {
        showHome: false,
        hasActivePlan: false,
      },
      processingState: {
        isProcessing: false,
        isPlanReadyAwaitingResponse: false,
      },
    },
    mainAppHandlers: {
      handleMoveWorkspace: vi.fn(),
      showGitDetail: false,
    },
  })),
}));

vi.mock("./useDesktopWorkspaceMissionDomain", () => ({
  useDesktopWorkspaceMissionDomain: vi.fn(() => ({
    gitCommitState: { busy: false },
    missionControlState: {
      autoDriveState: {},
      onReviewPackControllerReady: vi.fn(),
    },
    handleStartTaskFromGitHubIssue: vi.fn(),
    handleStartTaskFromGitHubPullRequest: vi.fn(),
  })),
}));

vi.mock("./useDesktopWorkspaceChromeDomain", () => ({
  useDesktopWorkspaceChromeDomain: vi.fn(),
}));

const titlebarControlsNode = <div data-testid="titlebar-controls" />;

function createBootstrapMock() {
  return {
    appSettings: {
      composerEditorPreset: "default",
      composerFenceExpandOnSpace: false,
      composerFenceExpandOnEnter: false,
      composerFenceLanguageTags: false,
      composerFenceWrapSelection: false,
      composerFenceAutoWrapPasteMultiline: false,
      composerFenceAutoWrapPasteCodeLike: false,
      composerListContinuation: false,
    },
    setAppSettings: vi.fn(),
    doctor: null,
    codexUpdate: null,
    appSettingsLoading: false,
    reduceTransparency: false,
    setReduceTransparency: vi.fn(),
    scaleShortcutTitle: "Scale",
    scaleShortcutText: "Scale text",
    queueSaveSettings: vi.fn(),
    debugState: { addDebugEntry: vi.fn() },
    shouldReduceTransparency: false,
    workspaceState: {
      workspaces: [],
      activeWorkspace: null,
      activeWorkspaceId: "ws-1",
      hasLoaded: true,
      updateWorkspaceSettings: vi.fn(),
      markWorkspaceConnected: vi.fn(),
    },
    threadCodexWorkspaceContext: null,
    mobileState: {
      showMobileSetupWizard: false,
      mobileSetupWizardProps: {},
      handleMobileConnectSuccess: vi.fn(),
    },
    handleConnectLocalRuntimePort: vi.fn(),
    workspacesById: new Map(),
    activeTab: "missions",
    setActiveTab: vi.fn(),
    layoutState: {
      isCompact: false,
      isPhone: false,
      sidebarCollapsed: false,
      rightPanelCollapsed: false,
    },
    sidebarToggleProps: {},
    settingsOpen: false,
    settingsSection: null,
    openSettings: vi.fn(),
    closeSettings: vi.fn(),
    getWorkspaceName: vi.fn(),
    updaterController: {
      handleTestNotificationSound: vi.fn(),
      handleTestSystemNotification: vi.fn(),
    },
    errorToasts: [],
    dismissErrorToast: vi.fn(),
    gitHubPanelState: {
      handleGitIssuesChange: vi.fn(),
      handleGitPullRequestsChange: vi.fn(),
      handleGitPullRequestDiffsChange: vi.fn(),
      handleGitPullRequestCommentsChange: vi.fn(),
    },
    gitPanelState: {
      refreshGitStatus: vi.fn(),
      refreshGitDiffs: vi.fn(),
      queueGitStatusRefresh: vi.fn(),
      setCenterMode: vi.fn(),
      setSelectedDiffPath: vi.fn(),
      diffSource: "local",
      centerMode: "chat",
      activeDiffs: [],
      activeDiffLoading: false,
      activeDiffError: null,
      gitPanelMode: "diff",
      shouldLoadDiffs: false,
      selectedPullRequest: null,
      gitCommitDiffs: [],
      selectedDiffPath: null,
    },
    shouldLoadGitHubPanelData: false,
    gitRemoteUrl: null,
    gitRootState: {
      repos: [],
      isLoading: false,
      error: null,
      depth: 2,
      hasScanned: false,
      scan: vi.fn(),
      setDepth: vi.fn(),
      clear: vi.fn(),
    },
    gitBranchState: {
      alertError: vi.fn(),
      currentBranch: "main",
      fileStatus: [],
    },
  };
}

describe("useDesktopWorkspaceFeatureComposition", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns titlebar controls from the chrome domain for the desktop host", () => {
    vi.mocked(useMainAppShellBootstrap).mockReturnValue(createBootstrapMock() as never);
    vi.mocked(useDesktopWorkspaceChromeDomain).mockReturnValue({
      appClassName: "app-shell",
      appStyle: {},
      appLayoutProps: { mainHeaderNode: null },
      appModalsProps: {},
      titlebarControlsNode,
      showCompactCodexThreadActions: false,
      showMobilePollingFetchStatus: false,
    } as never);

    const { result } = renderHook(() => useDesktopWorkspaceFeatureComposition());

    expect(result.current.titlebarControlsNode).toBe(titlebarControlsNode);
    expect(useDesktopWorkspaceChromeDomain).toHaveBeenCalled();
  });
});
