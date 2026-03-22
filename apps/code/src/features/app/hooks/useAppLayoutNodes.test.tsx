import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  flattenLayoutNodesOptions,
  type LayoutNodesOptions,
} from "../../layout/hooks/layoutNodes/types";
import type { UseAppLayoutNodesParams } from "./useAppLayoutNodes";
import { useAppLayoutNodes } from "./useAppLayoutNodes";

const useLayoutNodesMock = vi.hoisted(() => vi.fn());

vi.mock("../../layout/hooks/useLayoutNodes", () => ({
  useLayoutNodes: useLayoutNodesMock,
}));

function createParams(overrides: Partial<UseAppLayoutNodesParams> = {}): UseAppLayoutNodesParams {
  const workspace = {
    id: "workspace-1",
    name: "Workspace 1",
    path: "/tmp/workspace-1",
    connected: true,
    settings: { sidebarCollapsed: false },
  };

  return {
    workspaceGroupsCount: 0,
    appSettings: {
      usageShowRemaining: false,
      composerCodeBlockCopyUseModifier: false,
      showMessageFilePath: false,
      showInternalRuntimeDiagnostics: false,
      openAppTargets: [],
      selectedOpenAppId: null,
      gitDiffIgnoreWhitespaceChanges: false,
      steerEnabled: false,
      defaultRemoteExecutionBackendId: null,
    },
    activeAccount: null,
    handleSwitchAccount: () => undefined,
    handleSelectLoggedInCodexAccount: async () => undefined,
    handleCancelSwitchAccount: () => undefined,
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
    handleSetThreadListSortKey: () => undefined,
    handleRefreshAllWorkspaceThreads: () => undefined,
    onOpenSettings: () => undefined,
    handleOpenProject: async () => undefined,
    resetPullRequestSelection: () => undefined,
    clearDraftState: () => undefined,
    clearDraftStateIfDifferentWorkspace: () => undefined,
    selectHome: () => undefined,
    selectWorkspace: () => undefined,
    setActiveThreadId: () => undefined,
    connectWorkspace: async () => undefined,
    setActiveTab: () => undefined,
    workspacesById: new Map([[workspace.id, workspace]]),
    updateWorkspaceSettings: async () => undefined,
    removeThread: () => undefined,
    clearDraftForThread: () => undefined,
    removeImagesForThread: () => undefined,
    refreshThread: async () => undefined,
    handleRenameThread: () => undefined,
    removeWorkspace: async () => undefined,
    removeWorktree: async () => undefined,
    loadOlderThreadsForWorkspace: () => undefined,
    listThreadsForWorkspace: () => undefined,
    refreshLocalUsage: () => null,
    worktreeRenameCandidate: null,
    launchScriptState: {
      launchScript: null,
      editorOpen: false,
      draftScript: "",
      isSaving: false,
      error: null,
      onRunLaunchScript: () => undefined,
      onOpenEditor: () => undefined,
      onCloseEditor: () => undefined,
      onDraftScriptChange: () => undefined,
      onSaveLaunchScript: () => undefined,
    },
    setGitDiffViewStyle: () => undefined,
    sidebarToggleProps: {
      sidebarCollapsed: false,
      onCollapseSidebar: () => undefined,
      onExpandSidebar: () => undefined,
    },
    rightPanelCollapsed: false,
    exitDiffView: () => undefined,
    setCenterMode: () => undefined,
    setSelectedDiffPath: () => undefined,
    selectedPullRequestCandidate: null,
    selectedPullRequestCommentsAll: [],
    setSelectedCommitSha: () => undefined,
    handleSelectPullRequest: () => undefined,
    handleSelectCommitSha: () => undefined,
    activeGitRoot: null,
    handleSetGitRoot: async () => undefined,
    prefillDraft: null,
    setPrefillDraft: () => undefined,
    composerInsert: null,
    setComposerInsert: () => undefined,
    isCompact: false,
    isPhone: false,
    worktreeApplyLoadingState: false,
    worktreeApplyErrorState: null,
    worktreeApplySuccessState: false,
    handleApplyWorktreeChanges: undefined,
    isWorkspaceDropActive: false,
    activeWorkspace: workspace,
    activeParentWorkspace: null,
    gitStatus: {
      branchName: "unknown",
      files: [],
      stagedFiles: [],
      unstagedFiles: [],
      totalAdditions: 0,
      totalDeletions: 0,
      error: null,
    },
    onRefreshGitStatus: () => undefined,
    centerMode: "chat",
    gitDiffViewStyle: "split",
    isWorktreeWorkspace: false,
    diffSource: "local",
    gitLogAhead: 0,
    activeItems: [],
    ...overrides,
  } as unknown as UseAppLayoutNodesParams;
}

function getLatestLayoutOptions(): Record<string, unknown> {
  const latestCall = useLayoutNodesMock.mock.calls.at(-1)?.[0];
  if (!latestCall || typeof latestCall !== "object") {
    throw new Error("Expected useLayoutNodes to be called with options");
  }
  return flattenLayoutNodesOptions(latestCall as LayoutNodesOptions) as Record<string, unknown>;
}

describe("useAppLayoutNodes", () => {
  it("still toggles workspace collapse even when the sidebar map is temporarily stale", async () => {
    const updateWorkspaceSettings = vi.fn(async () => undefined);

    renderHook(() =>
      useAppLayoutNodes(
        createParams({
          workspacesById: new Map(),
          updateWorkspaceSettings,
        })
      )
    );

    const layoutOptions = getLatestLayoutOptions() as {
      onToggleWorkspaceCollapse: (workspaceId: string, collapsed: boolean) => void;
    };
    layoutOptions.onToggleWorkspaceCollapse("workspace-1", true);

    expect(updateWorkspaceSettings).toHaveBeenCalledWith("workspace-1", {
      sidebarCollapsed: true,
    });
  });

  it("maps missing branch context to a no-git header label", () => {
    renderHook(() =>
      useAppLayoutNodes(
        createParams({
          gitStatus: {
            branchName: "unknown",
            files: [],
            stagedFiles: [],
            unstagedFiles: [],
            totalAdditions: 0,
            totalDeletions: 0,
            error: "git unavailable",
          },
        })
      )
    );

    expect(useLayoutNodesMock).toHaveBeenCalled();
    expect(getLatestLayoutOptions().branchName).toBe("No git repo");
  });

  it("keeps the current workspace thread selection when switching workspaces", () => {
    const exitDiffView = vi.fn();
    const resetPullRequestSelection = vi.fn();
    const clearDraftStateIfDifferentWorkspace = vi.fn();
    const selectWorkspace = vi.fn();
    const setActiveThreadId = vi.fn();

    renderHook(() =>
      useAppLayoutNodes(
        createParams({
          exitDiffView,
          resetPullRequestSelection,
          clearDraftStateIfDifferentWorkspace,
          selectWorkspace,
          setActiveThreadId,
        })
      )
    );

    const onSelectWorkspace = getLatestLayoutOptions().onSelectWorkspace as
      | ((workspaceId: string) => void)
      | undefined;

    expect(onSelectWorkspace).toBeTypeOf("function");

    onSelectWorkspace?.("workspace-2");

    expect(exitDiffView).toHaveBeenCalledTimes(1);
    expect(resetPullRequestSelection).toHaveBeenCalledTimes(1);
    expect(clearDraftStateIfDifferentWorkspace).toHaveBeenCalledWith("workspace-2");
    expect(selectWorkspace).toHaveBeenCalledWith("workspace-2");
    expect(setActiveThreadId).not.toHaveBeenCalled();
  });

  it("preserves explicit settings sections when wiring the settings opener through layout nodes", () => {
    const onOpenSettings = vi.fn();

    renderHook(() =>
      useAppLayoutNodes(
        createParams({
          onOpenSettings,
        })
      )
    );

    const forwardedOnOpenSettings = getLatestLayoutOptions().onOpenSettings as
      | ((section?: string) => void)
      | undefined;

    expect(forwardedOnOpenSettings).toBeTypeOf("function");

    forwardedOnOpenSettings?.("codex");

    expect(onOpenSettings).toHaveBeenCalledWith("codex");
  });

  it("forwards the project-workspace Codex account selection handler into layout nodes", () => {
    const handleSelectLoggedInCodexAccount = vi.fn();

    renderHook(() =>
      useAppLayoutNodes(
        createParams({
          handleSelectLoggedInCodexAccount,
        })
      )
    );

    expect(useLayoutNodesMock).toHaveBeenCalled();
    expect(getLatestLayoutOptions().onSelectLoggedInCodexAccount).toBe(
      handleSelectLoggedInCodexAccount
    );
  });

  it("forwards the internal runtime diagnostics setting into layout nodes", () => {
    renderHook(() =>
      useAppLayoutNodes(
        createParams({
          appSettings: {
            ...createParams().appSettings,
            showInternalRuntimeDiagnostics: true,
          },
        })
      )
    );

    expect(useLayoutNodesMock).toHaveBeenCalled();
    expect(getLatestLayoutOptions().showInternalRuntimeDiagnostics).toBe(true);
  });
});
