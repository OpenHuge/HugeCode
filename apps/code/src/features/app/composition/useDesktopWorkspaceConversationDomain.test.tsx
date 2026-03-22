// @vitest-environment jsdom

import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useDesktopWorkspaceConversationDomain } from "./useDesktopWorkspaceConversationDomain";
import { useMainAppConversationState } from "../hooks/useMainAppConversationState";
import { useMainAppHandlers } from "../hooks/useMainAppHandlers";
import { useRuntimeResyncRefresh } from "../hooks/useRuntimeResyncRefresh";

vi.mock("../hooks/useMainAppConversationState", () => ({
  useMainAppConversationState: vi.fn(),
}));

vi.mock("../hooks/useMainAppHandlers", () => ({
  useMainAppHandlers: vi.fn(),
}));

vi.mock("../hooks/useRuntimeResyncRefresh", () => ({
  useRuntimeResyncRefresh: vi.fn(),
}));

const conversationState = {
  homeState: {
    canInterrupt: true,
    showComposer: true,
  },
  fileListingState: {
    files: [],
  },
  processingState: {
    isProcessing: true,
    isPlanReadyAwaitingResponse: false,
  },
  composerState: {
    clearDraftForThread: vi.fn(),
    removeImagesForThread: vi.fn(),
    setPrefillDraft: vi.fn(),
    clearActiveImages: vi.fn(),
    handleSend: vi.fn(),
    queueMessage: vi.fn(),
  },
  canInsertComposerText: true,
  handleInsertComposerText: vi.fn(),
};

const mainAppHandlers = {
  showGitDetail: true,
  handleMoveWorkspace: vi.fn(),
};

function createInput() {
  return {
    workspaceState: {
      workspaces: [],
      groupedWorkspaces: [],
      getWorkspaceGroupName: vi.fn(),
      activeWorkspace: { id: "ws-1", connected: true },
      activeWorkspaceId: "ws-1",
      addWorkspace: vi.fn(),
      addWorkspaceFromPath: vi.fn(),
      addWorkspacesFromPaths: vi.fn(),
      connectWorkspace: vi.fn(),
      hasLoaded: true,
      refreshWorkspaces: vi.fn(),
      updateWorkspaceSettings: vi.fn(),
    },
    layoutState: {
      isCompact: false,
      isPhone: false,
      rightPanelCollapsed: false,
      handleDebugClick: vi.fn(),
      handleToggleTerminal: vi.fn(),
      sidebarCollapsed: false,
      expandSidebar: vi.fn(),
      collapseSidebar: vi.fn(),
      expandRightPanel: vi.fn(),
      collapseRightPanel: vi.fn(),
    },
    gitPanelState: {
      centerMode: "chat",
      filePanelMode: "files",
      selectedPullRequest: null,
      selectedDiffPath: null,
      activeWorkspaceIdRef: { current: "ws-1" },
      activeWorkspaceRef: { current: null },
      setSelectedPullRequest: vi.fn(),
      setDiffSource: vi.fn(),
      setSelectedDiffPath: vi.fn(),
      setCenterMode: vi.fn(),
      setGitPanelMode: vi.fn(),
    },
    gitHubPanelState: {
      gitPullRequestDiffs: [],
    },
    appSettings: {
      steerEnabled: true,
    },
    activeTab: "missions",
    setActiveTab: vi.fn(),
    workspacesById: new Map(),
    openSettings: vi.fn(),
    debugState: {
      addDebugEntry: vi.fn(),
    },
    alertError: vi.fn(),
    threadCodexState: {
      selectedCollaborationModeId: "mode-1",
      accessMode: "on-request",
      executionMode: "remote_sandbox",
      runWithDraftStart: vi.fn(),
      collaborationModes: [],
      resolvedModel: null,
      resolvedEffort: null,
      setSelectedCollaborationModeId: vi.fn(),
    },
    projectDomain: {
      exitDiffView: vi.fn(),
      selectWorkspace: vi.fn(),
      renameWorktreePrompt: null,
      renameWorktreeNotice: null,
      renameWorktreeUpstreamPrompt: null,
      confirmRenameWorktreeUpstream: vi.fn(),
      openRenameWorktreePrompt: vi.fn(),
      handleRenameWorktreeChange: vi.fn(),
      handleRenameWorktreeCancel: vi.fn(),
      handleRenameWorktreeConfirm: vi.fn(),
      worktreePromptState: { openPrompt: vi.fn() },
      clonePromptState: { openPrompt: vi.fn() },
    },
    threadDomain: {
      activeThreadId: "thread-1",
      approvals: [],
      userInputRequests: [],
      activeTurnIdByThread: {},
      tokenUsageByThread: {},
      rateLimitsByWorkspace: {},
      planByThread: {},
      lastAgentMessageByThread: {},
      threadsByWorkspace: {},
      threadStatusById: {},
      hasPendingDraftUserMessages: false,
      visibleActiveItems: [],
      listThreadsForWorkspace: vi.fn(),
      refreshThread: vi.fn(),
      refreshAccountInfo: vi.fn(),
      refreshAccountRateLimits: vi.fn(),
      getThreadRows: vi.fn(),
      threadListLoadingByWorkspace: {},
      threadLiveConnectionState: "idle",
      threadsState: {
        toolCallRequests: [],
        startThreadForWorkspace: vi.fn(),
        sendUserMessage: vi.fn(),
        sendUserMessageToThread: vi.fn(),
        startFork: vi.fn(),
        startReview: vi.fn(),
        startResume: vi.fn(),
        startCompact: vi.fn(),
        startMcp: vi.fn(),
        startStatus: vi.fn(),
      },
      draftState: {
        startingDraftThreadWorkspaceId: null,
        isDraftModeForActiveWorkspace: false,
        startNewAgentDraft: vi.fn(),
        runWithDraftStart: vi.fn(),
        clearDraftState: vi.fn(),
      },
    },
    promptsState: {
      createPrompt: vi.fn(),
      updatePrompt: vi.fn(),
      deletePrompt: vi.fn(),
      movePrompt: vi.fn(),
      getWorkspacePromptsDir: vi.fn(),
      getGlobalPromptsDir: vi.fn(),
    },
    composerInputRef: { current: null },
    activeThreadIdRef: { current: null },
    pendingNewThreadSeedRef: { current: null },
  } as Parameters<typeof useDesktopWorkspaceConversationDomain>[0];
}

describe("useDesktopWorkspaceConversationDomain", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("routes conversation, handlers, and resync refresh through the domain contract", () => {
    vi.mocked(useMainAppConversationState).mockReturnValue(
      conversationState as ReturnType<typeof useMainAppConversationState>
    );
    vi.mocked(useMainAppHandlers).mockReturnValue(
      mainAppHandlers as ReturnType<typeof useMainAppHandlers>
    );

    const input = createInput();
    const { result } = renderHook(() => useDesktopWorkspaceConversationDomain(input));

    expect(useMainAppConversationState).toHaveBeenCalledWith(
      expect.objectContaining({
        activeItems: input.threadDomain.visibleActiveItems,
        composerInputRef: input.composerInputRef,
      })
    );
    expect(useMainAppHandlers).toHaveBeenCalledWith(
      expect.objectContaining({
        canInterrupt: true,
        activeThreadIdRef: input.activeThreadIdRef,
        pendingNewThreadSeedRef: input.pendingNewThreadSeedRef,
      })
    );
    expect(useRuntimeResyncRefresh).toHaveBeenCalledWith({
      activeWorkspace: input.workspaceState.activeWorkspace,
      activeThreadId: "thread-1",
      refreshWorkspaces: input.workspaceState.refreshWorkspaces,
      listThreadsForWorkspace: input.threadDomain.listThreadsForWorkspace,
      refreshThread: input.threadDomain.refreshThread,
      refreshAccountInfo: input.threadDomain.refreshAccountInfo,
      refreshAccountRateLimits: input.threadDomain.refreshAccountRateLimits,
      onDebug: input.debugState.addDebugEntry,
    });
    expect(result.current).toEqual({
      conversationState,
      mainAppHandlers,
    });
  });
});
