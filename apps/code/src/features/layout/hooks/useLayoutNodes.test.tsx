import { fireEvent, render, renderHook, screen, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { isValidElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { ComposerSurface } from "../../composer/components/ComposerSurface";
import {
  createLayoutNodesOptions,
  type LayoutNodesFieldRegistry,
  type LayoutNodesOptions,
} from "./layoutNodes/types";
import { useLayoutNodes } from "./useLayoutNodes";

vi.mock("../../home/components/Home", () => ({
  Home: ({
    onOpenSettings,
    fastModeEnabled,
    onToggleFastMode,
  }: {
    onOpenSettings?: () => void;
    fastModeEnabled?: boolean;
    onToggleFastMode?: (enabled: boolean) => void;
  }) => (
    <button
      type="button"
      data-testid="home-mission-signal-routing"
      data-fast-mode-enabled={String(Boolean(fastModeEnabled))}
      data-can-toggle-fast-mode={String(typeof onToggleFastMode === "function")}
      onClick={onOpenSettings}
    >
      Routing signal
    </button>
  ),
}));

vi.mock("../../messages/components/Messages", () => ({
  Messages: ({
    isThinking,
    isPlanModeActive,
  }: {
    isThinking: boolean;
    isPlanModeActive: boolean;
  }) => (
    <div
      data-testid="messages-node"
      data-is-thinking={String(isThinking)}
      data-is-plan-mode-active={String(isPlanModeActive)}
    />
  ),
}));

vi.mock("../../composer/components/Composer", () => ({
  Composer: ({
    variant,
    isProcessing,
    sendLabel,
    fastModeEnabled,
    onToggleFastMode,
  }: {
    variant: string;
    isProcessing?: boolean;
    sendLabel?: string;
    fastModeEnabled?: boolean;
    onToggleFastMode?: (enabled: boolean) => void;
  }) => (
    <div
      data-testid="composer-node"
      data-variant={variant}
      data-is-processing={String(Boolean(isProcessing))}
      data-send-label={sendLabel ?? ""}
      data-fast-mode-enabled={String(Boolean(fastModeEnabled))}
      data-can-toggle-fast-mode={String(typeof onToggleFastMode === "function")}
    />
  ),
}));

vi.mock("../../app/components/MainHeader", () => ({
  MainHeader: ({ renderHeaderActions = true }: { renderHeaderActions?: boolean }) => (
    <div data-testid="main-header-node" data-render-header-actions={String(renderHeaderActions)} />
  ),
}));

vi.mock("./layoutNodes/SidebarNode", () => ({
  SidebarNode: () => <div data-testid="sidebar-node" />,
}));

vi.mock("./layoutNodes/buildGitNodes", () => ({
  buildGitNodes: () => ({
    gitDiffPanelNode: null,
    gitDiffViewerNode: null,
    rightPanelGitNode: null,
    rightPanelFilesNode: null,
    rightPanelPromptsNode: null,
  }),
}));

vi.mock("./layoutNodes/buildSecondaryNodes", () => ({
  buildSecondaryNodes: () => ({
    planPanelNode: null,
    debugPanelNode: null,
    terminalDockNode: null,
    compactEmptyCodexNode: null,
    compactEmptyGitNode: null,
    compactGitBackNode: null,
  }),
}));

function createLayoutFields(
  overrides: Partial<LayoutNodesFieldRegistry> = {}
): LayoutNodesFieldRegistry {
  const workspace = {
    id: "workspace-1",
    name: "Workspace 1",
    path: "/tmp/workspace-1",
    connected: true,
    kind: "main",
    settings: {
      groupId: null,
      sidebarCollapsed: false,
    },
  };
  const thread = {
    id: "thread-1",
    name: "Thread 1",
    updatedAt: 1,
  };

  return {
    activeWorkspace: workspace,
    activeWorkspaceId: workspace.id,
    activeThreadId: thread.id,
    activeItems: [],
    itemsByThread: { [thread.id]: [] },
    activeImages: [],
    activeQueue: [],
    activeRateLimits: null,
    activeTokenUsage: null,
    activeParentWorkspace: null,
    activeTab: "missions",
    approvals: [],
    collaborationModes: [],
    composerAccountOptions: [],
    composerEditorExpanded: false,
    composerEditorSettings: {
      preset: "default",
      expandFenceOnSpace: false,
      expandFenceOnEnter: false,
      fenceLanguageTags: false,
      fenceWrapSelection: false,
      autoWrapPasteMultiline: false,
      autoWrapPasteCodeLike: false,
      continueListOnShiftEnter: false,
    },
    currentUsageRefreshLoading: false,
    deletingWorktreeIds: new Set<string>(),
    draftText: "",
    errorToasts: [],
    executionOptions: [],
    files: [],
    groupedWorkspaces: [{ id: null, name: "All", workspaces: [workspace] }],
    gitStatus: {
      branchName: "main",
      files: [],
      stagedFiles: [],
      unstagedFiles: [],
      totalAdditions: 0,
      totalDeletions: 0,
      error: null,
    },
    handleApprovalDecision: () => undefined,
    handleApprovalRemember: () => undefined,
    handleToolCallSubmit: async () => undefined,
    handleUserInputSubmit: async () => undefined,
    hasLoadedWorkspaces: true,
    hasWorkspaceGroups: false,
    isLoadingLatestAgents: false,
    isLoadingLocalUsage: false,
    isProcessing: false,
    isReviewing: false,
    latestAgentRuns: [],
    localUsageError: null,
    localUsageSnapshot: null,
    mainHeaderActionsNode: null,
    models: [],
    onAddAgent: () => undefined,
    onAddCloneAgent: () => undefined,
    onAddWorkspace: () => undefined,
    onAddWorktreeAgent: () => undefined,
    onAttachImages: () => undefined,
    onCancelSwitchAccount: () => undefined,
    accountSwitchError: null,
    accountCenter: {
      loading: false,
      error: null,
      codex: {
        defaultPoolName: null,
        defaultRouteAccountId: null,
        defaultRouteAccountLabel: "No default route account",
        connectedAccounts: [],
        defaultRouteBusyAccountId: null,
        reauthenticatingAccountId: null,
      },
      providers: [],
      setCodexDefaultRouteAccount: async () => undefined,
      reauthenticateCodexAccount: async () => undefined,
    },
    onCollapseSidebar: () => undefined,
    onConnectWorkspace: async () => undefined,
    onCopyThread: () => undefined,
    onDeleteQueued: () => undefined,
    onDeleteThread: () => undefined,
    onDeleteWorkspace: () => undefined,
    onDeleteWorktree: () => undefined,
    onDismissErrorToast: () => undefined,
    onDismissPostUpdateNotice: () => undefined,
    onDismissUpdate: () => undefined,
    onDraftChange: () => undefined,
    onEditMessage: () => undefined,
    onEditQueued: () => undefined,
    onFileAutocompleteActiveChange: () => undefined,
    onLoadOlderThreads: () => undefined,
    onOpenDebug: () => undefined,
    onOpenProject: () => undefined,
    onOpenBranchSwitcher: () => undefined,
    onSelectBranchWorkflowSelection: () => undefined,
    onRefreshGitStatus: () => undefined,
    onOpenSettings: () => undefined,
    onOpenThreadLink: () => undefined,
    onPickImages: () => undefined,
    onPlanAccept: () => undefined,
    onPlanSubmitChanges: () => undefined,
    onPrefillHandled: () => undefined,
    onQueue: () => undefined,
    onRefreshAllThreads: () => undefined,
    onRefreshAllUsage: () => undefined,
    onRefreshCurrentUsage: () => undefined,
    onRefreshLocalUsage: () => undefined,
    onReloadWorkspaceThreads: () => undefined,
    onRemoveImage: () => undefined,
    onRenameThread: () => undefined,
    onReviewPromptChoosePreset: () => undefined,
    onReviewPromptClose: () => undefined,
    onReviewPromptConfirmBranch: async () => undefined,
    onReviewPromptConfirmCommit: async () => undefined,
    onReviewPromptConfirmCustom: async () => undefined,
    onReviewPromptHighlightBranch: () => undefined,
    onReviewPromptHighlightCommit: () => undefined,
    onReviewPromptHighlightPreset: () => undefined,
    onReviewPromptKeyDown: () => false,
    onReviewPromptSelectBranch: () => undefined,
    onReviewPromptSelectBranchAtIndex: () => undefined,
    onReviewPromptSelectCommit: () => undefined,
    onReviewPromptSelectCommitAtIndex: () => undefined,
    onReviewPromptShowPreset: () => undefined,
    onReviewPromptUpdateCustomInstructions: () => undefined,
    onSelectAccessMode: () => undefined,
    onSelectAccountIds: () => undefined,
    onSelectCollaborationMode: () => undefined,
    onSelectEffort: () => undefined,
    onToggleFastMode: () => undefined,
    onSelectExecutionMode: () => undefined,
    onSelectHomeThread: () => undefined,
    onSelectModel: () => undefined,
    onSelectOpenAppId: () => undefined,
    onSelectTab: () => undefined,
    onSelectThread: () => undefined,
    onSelectWorkspace: () => undefined,
    onSend: () => undefined,
    onSetThreadListSortKey: () => undefined,
    onStop: () => undefined,
    onSwitchAccount: () => undefined,
    onSelectLoggedInCodexAccount: async () => undefined,
    onSyncThread: () => undefined,
    onToggleComposerEditorExpanded: () => undefined,
    onToggleWorkspaceCollapse: () => undefined,
    onReorderWorkspace: () => undefined,
    onUpdate: () => undefined,
    onUsageMetricChange: () => undefined,
    onUsageWorkspaceChange: () => undefined,
    onWorkspaceDragEnter: () => undefined,
    onWorkspaceDragLeave: () => undefined,
    onWorkspaceDragOver: () => undefined,
    onWorkspaceDrop: () => undefined,
    openAppTargets: [],
    pinThread: () => true,
    pollingIntervalMs: 0,
    postUpdateNotice: null,
    prefillDraft: null,
    prompts: [],
    queuePausedReason: null,
    reasoningOptions: [],
    fastModeEnabled: false,
    reasoningSupported: false,
    reviewPrompt: undefined,
    selectedAccountIds: [],
    selectedCollaborationModeId: null,
    selectedEffort: null,
    selectedExecutionMode: "default",
    selectedModelId: null,
    selectedOpenAppId: null,
    showComposer: true,
    showDebugButton: false,
    showMessageFilePath: false,
    showPollingFetchStatus: false,
    showTerminalButton: false,
    showWorkspaceTools: false,
    sidebarCollapsed: false,
    skills: [],
    steerEnabled: false,
    terminalOpen: false,
    textareaRef: { current: null },
    threadListCursorByWorkspace: { [workspace.id]: null },
    threadListLoadingByWorkspace: { [workspace.id]: false },
    threadListPagingByWorkspace: { [workspace.id]: false },
    threadListSortKey: "updatedAt-desc",
    threadParentById: {},
    threadResumeLoadingById: {},
    threadStatusById: {},
    threadsByWorkspace: { [workspace.id]: [thread] },
    toolCallRequests: [],
    unpinThread: () => undefined,
    updaterState: { state: "idle" },
    usageMetric: "tokens",
    usageShowRemaining: false,
    usageWorkspaceId: null,
    usageWorkspaceOptions: [],
    userInputRequests: [],
    workspaceDropTargetRef: { current: null },
    workspaceDropText: "Drop Project Here",
    workspaces: [workspace],
    ...overrides,
  } as unknown as LayoutNodesFieldRegistry;
}

function createLayoutOptions(
  overrides: Partial<LayoutNodesFieldRegistry> = {}
): LayoutNodesOptions {
  return createLayoutNodesOptions(createLayoutFields(overrides));
}

type ComposerSurfaceProps = {
  surface: string;
  children: ReactElement;
};

describe("useLayoutNodes", () => {
  it("builds the main composer with the workspace variant", async () => {
    const { result } = renderHook(() =>
      useLayoutNodes(
        createLayoutOptions({
          fastModeEnabled: true,
          onToggleFastMode: () => undefined,
        })
      )
    );

    expect(isValidElement(result.current.composerNode)).toBe(true);
    if (!isValidElement(result.current.composerNode)) {
      throw new Error("Expected composer node to be a valid React element");
    }
    const composerNode = result.current.composerNode as ReactElement<ComposerSurfaceProps>;

    expect(composerNode.type).toBe(ComposerSurface);
    expect(composerNode.props.surface).toBe("workspace");

    render(result.current.composerNode);

    const composer = await screen.findByTestId("composer-node");
    expect(composer.getAttribute("data-variant")).toBe("workspace");
    expect(composer.getAttribute("data-fast-mode-enabled")).toBe("true");
    expect(composer.getAttribute("data-can-toggle-fast-mode")).toBe("true");
  });

  it("keeps sidebar, messages, and header nodes stable when only draft text changes", () => {
    const baseFields = createLayoutFields();
    const { result, rerender } = renderHook(
      ({ draftText }) =>
        useLayoutNodes(
          createLayoutNodesOptions({
            ...baseFields,
            draftText,
          })
        ),
      { initialProps: { draftText: "" } }
    );

    const initialSidebarNode = result.current.sidebarNode;
    const initialMessagesNode = result.current.messagesNode;
    const initialMainHeaderNode = result.current.mainHeaderNode;
    const initialHomeNode = result.current.homeNode;
    const initialComposerNode = result.current.composerNode;

    rerender({ draftText: "new draft value" });

    expect(result.current.sidebarNode).toBe(initialSidebarNode);
    expect(result.current.messagesNode).toBe(initialMessagesNode);
    expect(result.current.mainHeaderNode).toBe(initialMainHeaderNode);
    expect(result.current.homeNode).toBe(initialHomeNode);
    expect(result.current.composerNode).not.toBe(initialComposerNode);
  });

  it("builds the sidebar through the lazy sidebar boundary", async () => {
    const { result } = renderHook(() => useLayoutNodes(createLayoutOptions()));

    render(result.current.sidebarNode);

    expect(await screen.findByTestId("sidebar-node")).toBeTruthy();
  });

  it("keeps desktop main header identity-only while titlebar owns right-side controls", async () => {
    const { result } = renderHook(() =>
      useLayoutNodes(
        createLayoutOptions({
          isPhone: false,
        })
      )
    );

    const view = render(result.current.mainHeaderNode);

    const header = await within(view.container).findByTestId("main-header-node");
    expect(header.getAttribute("data-render-header-actions")).toBe("false");
  });

  it("keeps compact main header actions inside the header surface on phone layouts", async () => {
    const { result } = renderHook(() =>
      useLayoutNodes(
        createLayoutOptions({
          isPhone: true,
        })
      )
    );

    const view = render(result.current.mainHeaderNode);

    const header = await within(view.container).findByTestId("main-header-node");
    expect(header.getAttribute("data-render-header-actions")).toBe("true");
  });

  it("prefers the active thread processing state for messages while keeping composer in draft-start protection", async () => {
    const options = createLayoutOptions({
      activeThreadId: "thread-1",
      isProcessing: true,
      threadStatusById: {
        "thread-1": {
          isProcessing: false,
          hasUnread: false,
          isReviewing: false,
          executionState: "idle",
          processingStartedAt: null,
          lastDurationMs: 0,
        },
      },
    });

    const { result } = renderHook(() => useLayoutNodes(options));

    if (!isValidElement(result.current.messagesNode)) {
      throw new Error("Expected messages node to be a valid React element");
    }
    if (!isValidElement(result.current.composerNode)) {
      throw new Error("Expected composer node to be a valid React element");
    }
    const composerNode = result.current.composerNode as ReactElement<ComposerSurfaceProps>;

    render(
      <>
        {result.current.messagesNode}
        {composerNode}
      </>
    );

    const messages = await screen.findByTestId("messages-node");
    const composer = (await screen.findAllByTestId("composer-node")).at(-1);

    expect(messages.getAttribute("data-is-thinking")).toBe("false");
    expect(composer?.getAttribute("data-is-processing")).toBe("true");
    expect(composer?.getAttribute("data-send-label")).toBe("Queue");
  });

  it("wires the home routing signal to the shared settings handler", async () => {
    const onOpenSettings = vi.fn();
    const { result } = renderHook(() =>
      useLayoutNodes(
        createLayoutOptions({
          workspaces: [],
          groupedWorkspaces: [],
          activeWorkspace: null,
          activeWorkspaceId: null,
          onOpenSettings,
        })
      )
    );

    render(result.current.homeNode);

    fireEvent.click(await screen.findByTestId("home-mission-signal-routing"));

    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  }, 20_000);

  it("passes fast mode controls through the home node", () => {
    const { result } = renderHook(() =>
      useLayoutNodes(
        createLayoutOptions({
          fastModeEnabled: true,
          onToggleFastMode: () => undefined,
        })
      )
    );

    render(result.current.homeNode);

    const homeNode = screen.getAllByTestId("home-mission-signal-routing").at(-1);
    if (!homeNode) {
      throw new Error("Expected home node");
    }
    expect(homeNode.getAttribute("data-fast-mode-enabled")).toBe("true");
    expect(homeNode.getAttribute("data-can-toggle-fast-mode")).toBe("true");
  });
});
