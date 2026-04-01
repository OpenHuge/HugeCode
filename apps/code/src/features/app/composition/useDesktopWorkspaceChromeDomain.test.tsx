// @vitest-environment jsdom

import { renderHook, waitFor } from "@testing-library/react";
import type { InvocationDescriptor } from "@ku0/code-runtime-host-contract";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useRuntimeInvocationCatalogResolver } from "../../../application/runtime/facades/runtimeInvocationCatalogFacadeHooks";
import { useDesktopWorkspaceChromeDomain } from "./useDesktopWorkspaceChromeDomain";
import { useMainAppLayoutNodesState } from "../hooks/useMainAppLayoutNodesState";
import { useMainAppShellSurfaceProps } from "../hooks/useMainAppShellSurfaceProps";
import { useMainAppSurfaceStyles } from "../hooks/useMainAppSurfaceStyles";
import { resolveCompactCodexUiState } from "../utils/compactCodexUiState";

vi.mock("../hooks/useMainAppSurfaceStyles", () => ({
  useMainAppSurfaceStyles: vi.fn(),
}));

vi.mock("../utils/compactCodexUiState", () => ({
  resolveCompactCodexUiState: vi.fn(),
}));

vi.mock("../hooks/useMainAppLayoutNodesState", () => ({
  useMainAppLayoutNodesState: vi.fn(),
}));

vi.mock("../hooks/useMainAppShellSurfaceProps", () => ({
  useMainAppShellSurfaceProps: vi.fn(),
}));

vi.mock("../../../application/runtime/facades/runtimeInvocationCatalogFacadeHooks", () => ({
  useRuntimeInvocationCatalogResolver: vi.fn(),
}));

const appStyle = { opacity: 1 };
const layoutNodes = {
  desktopTopbarLeftNode: <div>Left</div>,
  desktopTopbarRightNode: <div>Right</div>,
  messagesNode: <div>Messages</div>,
};
const mainAppLayoutProps = { id: "layout" };
const mainAppModalsProps = { id: "modals" };
const titlebarControlsNode = <div>titlebar-controls</div>;
const emptyCatalogItems: InvocationDescriptor[] = [];

function createInput() {
  const handleStartTaskFromGitHubPullRequestReviewCommentCommand = vi.fn();
  const handleStartTaskFromGitHubPullRequestReviewFollowUp = vi.fn(
    async (
      pullRequest: { number: number },
      comment: { id: number; body: string; url?: string; author?: { login?: string | null } | null }
    ) => {
      handleStartTaskFromGitHubPullRequestReviewCommentCommand({
        pullRequest,
        event: {
          eventName: "pull_request_review_comment",
          action: "created",
        },
        command: {
          triggerMode: "pull_request_review_comment_command",
          comment: {
            commentId: comment.id,
            body: comment.body,
            url: comment.url,
            author: comment.author,
          },
        },
      });
    }
  );

  return {
    bootstrap: {
      workspaceState: {
        workspaceGroups: [],
        groupedWorkspaces: [],
        ungroupedLabel: "Ungrouped",
        activeWorkspace: { id: "ws-1", connected: true },
        activeWorkspaceId: "ws-1",
        updateWorkspaceSettings: vi.fn(),
        updateWorkspaceCodexBin: vi.fn(),
        createWorkspaceGroup: vi.fn(),
        renameWorkspaceGroup: vi.fn(),
        moveWorkspaceGroup: vi.fn(),
        deleteWorkspaceGroup: vi.fn(),
        assignWorkspaceGroup: vi.fn(),
        renameWorkspace: vi.fn(),
        removeWorkspace: vi.fn(),
        removeWorktree: vi.fn(),
        deletingWorktreeIds: [],
        hasLoaded: true,
        workspaceLoadError: null,
        workspaces: [],
        connectWorkspace: vi.fn(),
        setActiveWorkspaceId: vi.fn(),
      },
      mobileState: {
        handleMobileConnectSuccess: vi.fn(),
      },
      layoutState: {
        isCompact: false,
        isPhone: false,
        sidebarCollapsed: false,
        rightPanelCollapsed: false,
        sidebarWidth: 320,
        rightPanelWidth: 380,
        planPanelHeight: 260,
        terminalPanelHeight: 220,
        debugPanelHeight: 180,
        expandRightPanel: vi.fn(),
        onSidebarResizeStart: vi.fn(),
        onRightPanelResizeStart: vi.fn(),
        onPlanPanelResizeStart: vi.fn(),
      },
      sidebarToggleProps: { expanded: true },
      activeTab: "missions",
      settingsOpen: false,
      settingsSection: "general",
      openSettings: vi.fn(),
      closeSettings: vi.fn(),
      updaterController: {
        handleTestNotificationSound: vi.fn(),
        handleTestSystemNotification: vi.fn(),
      },
      errorToasts: [],
      dismissErrorToast: vi.fn(),
      handleConnectLocalRuntimePort: vi.fn(),
      workspacesById: new Map(),
      setActiveTab: vi.fn(),
      debugState: { addDebugEntry: vi.fn() },
      gitRemoteUrl: "https://github.com/example/repo",
      gitBranchState: {
        currentBranch: "main",
        fileStatus: [],
      },
      gitPanelState: {
        gitPanelMode: "status",
        centerMode: "chat",
        refreshGitStatus: vi.fn(),
        selectedPullRequest: null,
      },
      gitHubPanelState: {},
      appSettings: {
        preloadGitDiffs: true,
        splitChatDiffView: false,
      },
      setAppSettings: vi.fn(),
      queueSaveSettings: vi.fn(),
      doctor: null,
      codexUpdate: null,
      reduceTransparency: false,
      setReduceTransparency: vi.fn(),
      scaleShortcutTitle: "Scale",
      scaleShortcutText: "Scale shortcut",
      shouldReduceTransparency: false,
    },
    domains: {
      project: {
        terminalTabs: [],
        activeTerminalId: null,
        onSelectTerminal: vi.fn(),
        onNewTerminal: vi.fn(),
        onCloseTerminal: vi.fn(),
        terminalState: null,
        canControlActiveTerminal: false,
        handleClearActiveTerminal: vi.fn(),
        handleRestartActiveTerminal: vi.fn(),
        handleInterruptActiveTerminal: vi.fn(),
        launchScriptState: null,
        launchScriptsState: null,
        openAppIconById: new Map(),
        openBranchSwitcher: vi.fn(),
        handleBranchSelection: vi.fn(),
        selectHome: vi.fn(),
        selectWorkspace: vi.fn(),
        exitDiffView: vi.fn(),
        handleSelectOpenAppId: vi.fn(),
        worktreePromptState: {},
        clonePromptState: {},
        branchSwitcher: null,
        branchSwitcherWorkspace: null,
        closeBranchSwitcher: vi.fn(),
      },
      thread: {
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
        threadsState: {
          example: true,
        },
        visibleActiveItems: [{ id: "item-1" }],
        draftState: {
          newAgentDraftWorkspaceId: null,
          startingDraftThreadWorkspaceId: null,
          clearDraftState: vi.fn(),
          clearDraftStateIfDifferentWorkspace: vi.fn(),
        },
        renamePromptState: {
          openRenamePrompt: vi.fn(),
        },
        atlasControls: {
          activeAtlasDriverOrder: null,
          activeAtlasEnabled: false,
          activeAtlasDetailLevel: "balanced",
          activeAtlasLongTermMemoryDigest: null,
          onActiveAtlasDriverOrderChange: vi.fn(),
          onActiveAtlasEnabledChange: vi.fn(),
          onActiveAtlasDetailLevelChange: vi.fn(),
        },
        handleSetThreadListSortKey: vi.fn(),
        handleRefreshAllWorkspaceThreads: vi.fn(),
        handleCopyThread: vi.fn(),
        threadLiveConnectionState: "idle",
        activeThreadId: "thread-1",
      },
      conversation: {
        conversationState: {
          homeState: {
            showHome: false,
            hasActivePlan: true,
          },
          fileListingState: {},
          processingState: {
            isProcessing: true,
            isPlanReadyAwaitingResponse: false,
          },
          composerState: {},
          canInsertComposerText: true,
          handleInsertComposerText: vi.fn(),
        },
        mainAppHandlers: {
          handleMoveWorkspace: vi.fn(),
          showGitDetail: true,
        },
      },
      mission: {
        gitCommitState: { busy: false },
        missionControlState: {
          autoDriveState: {},
          onReviewPackControllerReady: vi.fn(),
        },
        handleStartTaskFromGitHubIssue: vi.fn(),
        handleStartTaskFromGitHubIssueCommentCommand: vi.fn(),
        handleStartTaskFromGitHubPullRequest: vi.fn(),
        handleStartTaskFromGitHubPullRequestReviewFollowUp,
        handleStartTaskFromGitHubPullRequestReviewCommentCommand,
      },
    },
    shell: {
      threadCodexState: {
        selectedModelId: "gpt-5",
      },
      threadListSortKey: "updated_at",
      composerEditorExpanded: false,
      toggleComposerEditorExpanded: vi.fn(),
      composerEditorSettings: { preset: "plain" },
      skills: [],
      prompts: [],
      composerInputRef: { current: null },
      gitActions: {
        handleStageGitAll: vi.fn(),
        handleStageGitFile: vi.fn(),
        handleUnstageGitFile: vi.fn(),
        handleRevertGitFile: vi.fn(),
        handleRevertAllGitChanges: vi.fn(),
      },
      activeGitRoot: null,
      handleSetGitRoot: vi.fn(),
      handlePickGitRoot: vi.fn(),
      handleApplyWorktreeChanges: vi.fn(),
      worktreeApplyLoading: false,
      worktreeApplyError: null,
      worktreeApplySuccess: false,
      gitRootScanDepth: 2,
      gitRootScanLoading: false,
      gitRootScanError: null,
      gitRootScanHasScanned: true,
      gitRootCandidates: [],
      setGitRootScanDepth: vi.fn(),
      scanGitRoots: vi.fn(),
    },
  } as unknown as Parameters<typeof useDesktopWorkspaceChromeDomain>[0];
}

describe("useDesktopWorkspaceChromeDomain", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  function mockInvocationCatalogResolver(items: InvocationDescriptor[] = emptyCatalogItems) {
    vi.mocked(useRuntimeInvocationCatalogResolver).mockReturnValue(
      () =>
        ({
          publishActiveCatalog: vi.fn(async () => ({
            catalogId: "workspace:ws-1",
            workspaceId: "ws-1",
            revision: 1,
            generatedAt: 1,
            items,
            sources: [],
          })),
        }) as never
    );
  }

  it("assembles chrome, layout, and modal surfaces from domain contracts", () => {
    mockInvocationCatalogResolver();
    vi.mocked(useMainAppSurfaceStyles).mockReturnValue({
      appClassName: "desktop-shell",
      appStyle,
    });
    vi.mocked(resolveCompactCodexUiState).mockReturnValue({
      showCompactCodexThreadActions: true,
      showMobilePollingFetchStatus: false,
    });
    vi.mocked(useMainAppLayoutNodesState).mockReturnValue(
      layoutNodes as ReturnType<typeof useMainAppLayoutNodesState>
    );
    vi.mocked(useMainAppShellSurfaceProps).mockReturnValue({
      mainAppLayoutProps: mainAppLayoutProps as never,
      mainAppModalsProps: mainAppModalsProps as never,
      titlebarControlsNode,
    });

    const input = createInput();
    const { result } = renderHook(() => useDesktopWorkspaceChromeDomain(input));

    expect(useMainAppLayoutNodesState).toHaveBeenCalledWith(
      expect.objectContaining({
        shell: expect.objectContaining({
          state: expect.objectContaining({
            threadsState: expect.objectContaining({
              activeItems: input.domains.thread.visibleActiveItems,
            }),
          }),
        }),
        runtime: expect.objectContaining({
          actions: expect.objectContaining({
            onConnectLocalRuntimePort: input.bootstrap.handleConnectLocalRuntimePort,
          }),
        }),
      })
    );
    expect(useMainAppShellSurfaceProps).toHaveBeenCalledWith(
      expect.objectContaining({
        chromeInput: expect.objectContaining({
          showCompactCodexThreadActions: true,
        }),
        settingsInput: expect.objectContaining({
          onMoveWorkspace: input.domains.conversation.mainAppHandlers.handleMoveWorkspace,
        }),
      })
    );
    expect(result.current).toEqual({
      appClassName: "desktop-shell",
      appStyle,
      appLayoutProps: mainAppLayoutProps,
      appModalsProps: mainAppModalsProps,
      titlebarControlsNode,
      showCompactCodexThreadActions: true,
      showMobilePollingFetchStatus: false,
    });
  });

  it("routes issue follow-up launches through the governed GitHub issue path", async () => {
    mockInvocationCatalogResolver();
    vi.mocked(useMainAppSurfaceStyles).mockReturnValue({
      appClassName: "desktop-shell",
      appStyle,
    });
    vi.mocked(resolveCompactCodexUiState).mockReturnValue({
      showCompactCodexThreadActions: true,
      showMobilePollingFetchStatus: false,
    });
    vi.mocked(useMainAppLayoutNodesState).mockReturnValue(
      layoutNodes as ReturnType<typeof useMainAppLayoutNodesState>
    );
    vi.mocked(useMainAppShellSurfaceProps).mockReturnValue({
      mainAppLayoutProps: mainAppLayoutProps as never,
      mainAppModalsProps: mainAppModalsProps as never,
      titlebarControlsNode,
    });

    const input = createInput();
    renderHook(() => useDesktopWorkspaceChromeDomain(input));

    const layoutCall = vi.mocked(useMainAppLayoutNodesState).mock.calls[0]?.[0];
    expect(layoutCall).toBeDefined();

    const issue = {
      number: 42,
      title: "Carry governed issue context",
      url: "https://github.com/example/repo/issues/42",
      updatedAt: "2026-03-30T00:00:00.000Z",
    };

    await layoutCall?.gitReview.actions.onStartTaskFromGitHubIssueFollowUp?.(issue as never);

    expect(input.domains.mission.handleStartTaskFromGitHubIssue).toHaveBeenCalledWith(issue);
    expect(
      input.domains.mission.handleStartTaskFromGitHubIssueCommentCommand
    ).not.toHaveBeenCalled();
  });

  it("routes review follow-up launches through the governed GitHub review-comment path", async () => {
    mockInvocationCatalogResolver();
    vi.mocked(useMainAppSurfaceStyles).mockReturnValue({
      appClassName: "desktop-shell",
      appStyle,
    });
    vi.mocked(resolveCompactCodexUiState).mockReturnValue({
      showCompactCodexThreadActions: true,
      showMobilePollingFetchStatus: false,
    });
    vi.mocked(useMainAppLayoutNodesState).mockReturnValue(
      layoutNodes as ReturnType<typeof useMainAppLayoutNodesState>
    );
    vi.mocked(useMainAppShellSurfaceProps).mockReturnValue({
      mainAppLayoutProps: mainAppLayoutProps as never,
      mainAppModalsProps: mainAppModalsProps as never,
      titlebarControlsNode,
    });

    const input = createInput();
    renderHook(() => useDesktopWorkspaceChromeDomain(input));

    const layoutCall = vi.mocked(useMainAppLayoutNodesState).mock.calls[0]?.[0];
    expect(layoutCall).toBeDefined();

    const pullRequest = {
      number: 17,
      title: "Preserve PR follow-up semantics",
      url: "https://github.com/example/repo/pull/17",
      createdAt: "2026-03-30T00:00:00.000Z",
      updatedAt: "2026-03-30T00:00:00.000Z",
      body: "",
      headRefName: "feature/review-follow-up",
      baseRefName: "main",
      isDraft: false,
      author: null,
    };
    const comment = {
      id: 1701,
      body: "Please tighten the runtime boundary.",
      createdAt: "2026-03-30T00:00:00.000Z",
      url: "https://github.com/example/repo/pull/17#discussion_r1701",
      author: { login: "reviewer" },
    };

    await layoutCall?.gitReview.actions.onStartTaskFromGitHubPullRequestReviewFollowUp?.(
      pullRequest as never,
      comment as never
    );

    expect(
      input.domains.mission.handleStartTaskFromGitHubPullRequestReviewCommentCommand
    ).toHaveBeenCalledWith({
      pullRequest,
      event: {
        eventName: "pull_request_review_comment",
        action: "created",
      },
      command: {
        triggerMode: "pull_request_review_comment_command",
        comment: {
          commentId: 1701,
          body: "Please tighten the runtime boundary.",
          url: "https://github.com/example/repo/pull/17#discussion_r1701",
          author: { login: "reviewer" },
        },
      },
    });
    expect(input.domains.mission.handleStartTaskFromGitHubPullRequest).not.toHaveBeenCalled();
  });

  it("forwards catalog-backed slash invocation items into the conversation bridge state", async () => {
    const slashItems: InvocationDescriptor[] = [
      {
        id: "session:prompt:prompt.summarize",
        title: "summarize",
        summary: "Summarize a target",
        description: "Summarize a target",
        kind: "session_command",
        source: {
          kind: "session_command",
          contributionType: "session_scoped",
          authority: "workspace",
          label: "Runtime prompt library",
          sourceId: "prompt.summarize",
          workspaceId: "ws-1",
          provenance: null,
        },
        runtimeTool: null,
        argumentSchema: null,
        aliases: [],
        tags: ["prompt_overlay"],
        safety: {
          level: "read",
          readOnly: true,
          destructive: false,
          openWorld: false,
          idempotent: true,
        },
        exposure: {
          operatorVisible: true,
          modelVisible: false,
          requiresReadiness: false,
          hiddenReason: "Prompt-library overlays stay operator-facing in the invocation plane.",
        },
        readiness: {
          state: "ready",
          available: true,
          reason: null,
          warnings: [],
          checkedAt: null,
        },
        metadata: {
          slashCommand: {
            primaryTrigger: "/summarize",
            insertText: 'summarize TARGET=""',
            shadowedByBuiltin: false,
          },
        },
      },
    ];
    mockInvocationCatalogResolver(slashItems);
    vi.mocked(useMainAppSurfaceStyles).mockReturnValue({
      appClassName: "desktop-shell",
      appStyle,
    });
    vi.mocked(resolveCompactCodexUiState).mockReturnValue({
      showCompactCodexThreadActions: true,
      showMobilePollingFetchStatus: false,
    });
    vi.mocked(useMainAppLayoutNodesState).mockReturnValue(
      layoutNodes as ReturnType<typeof useMainAppLayoutNodesState>
    );
    vi.mocked(useMainAppShellSurfaceProps).mockReturnValue({
      mainAppLayoutProps: mainAppLayoutProps as never,
      mainAppModalsProps: mainAppModalsProps as never,
      titlebarControlsNode,
    });

    const input = createInput();
    renderHook(() => useDesktopWorkspaceChromeDomain(input));

    await waitFor(() => {
      expect(useMainAppLayoutNodesState).toHaveBeenLastCalledWith(
        expect.objectContaining({
          conversation: expect.objectContaining({
            state: expect.objectContaining({
              slashInvocationItems: slashItems,
            }),
          }),
        })
      );
    });
  });
});
