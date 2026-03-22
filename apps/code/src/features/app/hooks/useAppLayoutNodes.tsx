import type { ComponentProps } from "react";
import type { AppSettings, WorkspaceInfo } from "../../../types";
import type { CodexSection } from "../../settings/components/settingsTypes";
import { resolveBranchDisplayLabel } from "../../git/utils/branchLabels";
import {
  createLayoutNodesOptions,
  type LayoutNodesFieldRegistry,
  type LayoutNodesResult,
} from "../../layout/hooks/layoutNodes/types";
import { useLayoutNodes } from "../../layout/hooks/useLayoutNodes";
import { MainHeaderActions } from "../components/MainHeaderActions";

type MainHeaderActionsProps = ComponentProps<typeof MainHeaderActions>;

type DerivedLayoutNodeKeys =
  | "hasWorkspaceGroups"
  | "usageShowRemaining"
  | "accountInfo"
  | "onSwitchAccount"
  | "onSelectLoggedInCodexAccount"
  | "onCancelSwitchAccount"
  | "accountSwitchError"
  | "accountCenter"
  | "codeBlockCopyUseModifier"
  | "showMessageFilePath"
  | "showInternalRuntimeDiagnostics"
  | "openAppTargets"
  | "selectedOpenAppId"
  | "onSetThreadListSortKey"
  | "onRefreshAllThreads"
  | "onOpenSettings"
  | "onCollapseSidebar"
  | "onExpandSidebar"
  | "sidebarCollapsed"
  | "onOpenProject"
  | "onSelectHome"
  | "onSelectWorkspace"
  | "onConnectWorkspace"
  | "onToggleWorkspaceCollapse"
  | "onReorderWorkspace"
  | "onSelectThread"
  | "onEditMessage"
  | "onDeleteThread"
  | "onSyncThread"
  | "onRenameThread"
  | "onDeleteWorkspace"
  | "onDeleteWorktree"
  | "onLoadOlderThreads"
  | "onReloadWorkspaceThreads"
  | "onRefreshLocalUsage"
  | "onSelectHomeThread"
  | "worktreeRename"
  | "branchName"
  | "showTerminalButton"
  | "showWorkspaceTools"
  | "launchScript"
  | "launchScriptEditorOpen"
  | "launchScriptDraft"
  | "launchScriptSaving"
  | "launchScriptError"
  | "onRunLaunchScript"
  | "onOpenLaunchScriptEditor"
  | "onCloseLaunchScriptEditor"
  | "onLaunchScriptDraftChange"
  | "onSaveLaunchScript"
  | "mainHeaderActionsNode"
  | "onExitDiff"
  | "onSelectTab"
  | "gitDiffIgnoreWhitespaceChanges"
  | "worktreeApplyLabel"
  | "worktreeApplyTitle"
  | "worktreeApplyLoading"
  | "worktreeApplyError"
  | "worktreeApplySuccess"
  | "onApplyWorktreeChanges"
  | "selectedPullRequestNumber"
  | "selectedPullRequest"
  | "selectedPullRequestComments"
  | "onSelectPullRequest"
  | "onSelectCommit"
  | "gitRoot"
  | "onSelectGitRoot"
  | "onClearGitRoot"
  | "commitsAhead"
  | "canRevealGeneralPrompts"
  | "steerEnabled"
  | "insertText"
  | "onPrefillHandled"
  | "onInsertHandled"
  | "onBackFromDiff"
  | "onShowSelectedDiff"
  | "onGoProjects"
  | "isWorkspaceDropActive"
  | "workspaceDropText";

export type UseAppLayoutNodesParams = Omit<LayoutNodesFieldRegistry, DerivedLayoutNodeKeys> & {
  workspaceGroupsCount: number;
  appSettings: Pick<
    AppSettings,
    | "usageShowRemaining"
    | "composerCodeBlockCopyUseModifier"
    | "showMessageFilePath"
    | "showInternalRuntimeDiagnostics"
    | "openAppTargets"
    | "selectedOpenAppId"
    | "gitDiffIgnoreWhitespaceChanges"
    | "steerEnabled"
    | "defaultRemoteExecutionBackendId"
  >;
  activeAccount: LayoutNodesFieldRegistry["accountInfo"];
  handleSwitchAccount: LayoutNodesFieldRegistry["onSwitchAccount"];
  handleSelectLoggedInCodexAccount: LayoutNodesFieldRegistry["onSelectLoggedInCodexAccount"];
  handleCancelSwitchAccount: LayoutNodesFieldRegistry["onCancelSwitchAccount"];
  accountSwitchError: LayoutNodesFieldRegistry["accountSwitchError"];
  accountCenter: LayoutNodesFieldRegistry["accountCenter"];
  handleSetThreadListSortKey: LayoutNodesFieldRegistry["onSetThreadListSortKey"];
  handleRefreshAllWorkspaceThreads: LayoutNodesFieldRegistry["onRefreshAllThreads"];
  onOpenSettings: (section?: CodexSection) => void;
  handleOpenProject: () => Promise<void>;
  resetPullRequestSelection: () => void;
  clearDraftState: () => void;
  clearDraftStateIfDifferentWorkspace: (workspaceId: string) => void;
  selectHome: () => void;
  selectWorkspace: (workspaceId: string) => void;
  setActiveThreadId: (threadId: string | null, workspaceId?: string) => void;
  connectWorkspace: LayoutNodesFieldRegistry["onConnectWorkspace"];
  setActiveTab: LayoutNodesFieldRegistry["onSelectTab"];
  workspacesById: Map<string, WorkspaceInfo>;
  updateWorkspaceSettings: (
    workspaceId: string,
    settings: {
      sidebarCollapsed?: boolean;
      sortOrder?: number | null;
    }
  ) => Promise<unknown>;
  removeThread: (workspaceId: string, threadId: string) => void;
  clearDraftForThread: (threadId: string) => void;
  removeImagesForThread: (threadId: string) => void;
  refreshThread: (workspaceId: string, threadId: string) => Promise<unknown>;
  handleRenameThread: LayoutNodesFieldRegistry["onRenameThread"];
  removeWorkspace: (workspaceId: string) => Promise<void>;
  removeWorktree: (workspaceId: string) => Promise<void>;
  loadOlderThreadsForWorkspace: (workspace: WorkspaceInfo) => Promise<void> | void;
  listThreadsForWorkspace: (workspace: WorkspaceInfo) => Promise<void> | void;
  refreshLocalUsage: () => Promise<void> | null | undefined;
  worktreeRenameCandidate: LayoutNodesFieldRegistry["worktreeRename"] | null;
  launchScriptState: {
    launchScript: string | null;
    editorOpen: boolean;
    draftScript: string;
    isSaving: boolean;
    error: string | null;
    onRunLaunchScript: () => void;
    onOpenEditor: () => void;
    onCloseEditor: () => void;
    onDraftScriptChange: (value: string) => void;
    onSaveLaunchScript: () => void;
  };
  setGitDiffViewStyle: MainHeaderActionsProps["onSelectDiffViewStyle"];
  sidebarToggleProps: MainHeaderActionsProps["sidebarToggleProps"];
  rightPanelCollapsed: boolean;
  exitDiffView: () => void;
  setCenterMode: (mode: LayoutNodesFieldRegistry["centerMode"]) => void;
  setSelectedDiffPath: (path: string | null) => void;
  selectedPullRequestCandidate: LayoutNodesFieldRegistry["selectedPullRequest"];
  selectedPullRequestCommentsAll: LayoutNodesFieldRegistry["selectedPullRequestComments"];
  setSelectedCommitSha: (sha: string | null) => void;
  handleSelectPullRequest: LayoutNodesFieldRegistry["onSelectPullRequest"];
  handleSelectCommitSha: (sha: string) => void;
  activeGitRoot: string | null;
  handleSetGitRoot: (path: string | null) => Promise<void>;
  prefillDraft: LayoutNodesFieldRegistry["prefillDraft"];
  setPrefillDraft: (value: LayoutNodesFieldRegistry["prefillDraft"]) => void;
  composerInsert: LayoutNodesFieldRegistry["insertText"];
  setComposerInsert: (value: LayoutNodesFieldRegistry["insertText"]) => void;
  isCompact: boolean;
  isPhone: boolean;
  worktreeApplyLoadingState: boolean;
  worktreeApplyErrorState: string | null;
  worktreeApplySuccessState: boolean;
  handleApplyWorktreeChanges?: () => void | Promise<void>;
  isWorkspaceDropActive: boolean;
};

export function useAppLayoutNodes(params: UseAppLayoutNodesParams): LayoutNodesResult {
  const {
    workspaceGroupsCount,
    appSettings,
    activeAccount,
    handleSwitchAccount,
    handleSelectLoggedInCodexAccount,
    handleCancelSwitchAccount,
    accountSwitchError,
    accountCenter,
    handleSetThreadListSortKey,
    handleRefreshAllWorkspaceThreads,
    onOpenSettings,
    handleOpenProject,
    resetPullRequestSelection,
    clearDraftState,
    clearDraftStateIfDifferentWorkspace,
    selectHome,
    selectWorkspace,
    setActiveThreadId,
    connectWorkspace,
    setActiveTab,
    workspacesById,
    updateWorkspaceSettings,
    removeThread,
    clearDraftForThread,
    removeImagesForThread,
    refreshThread,
    handleRenameThread,
    removeWorkspace,
    removeWorktree,
    loadOlderThreadsForWorkspace,
    listThreadsForWorkspace,
    refreshLocalUsage,
    worktreeRenameCandidate,
    launchScriptState,
    setGitDiffViewStyle,
    sidebarToggleProps,
    exitDiffView,
    setCenterMode,
    setSelectedDiffPath,
    selectedPullRequestCandidate,
    selectedPullRequestCommentsAll,
    setSelectedCommitSha,
    handleSelectPullRequest,
    handleSelectCommitSha,
    activeGitRoot,
    handleSetGitRoot,
    prefillDraft,
    setPrefillDraft,
    composerInsert,
    setComposerInsert,
    isCompact,
    isPhone,
    worktreeApplyLoadingState,
    worktreeApplyErrorState,
    worktreeApplySuccessState,
    handleApplyWorktreeChanges,
    isWorkspaceDropActive,
    ...layoutOptions
  } = params;

  return useLayoutNodes(
    createLayoutNodesOptions({
      ...layoutOptions,
      hasWorkspaceGroups: workspaceGroupsCount > 0,
      onSetThreadListSortKey: handleSetThreadListSortKey,
      onRefreshAllThreads: handleRefreshAllWorkspaceThreads,
      usageShowRemaining: appSettings.usageShowRemaining,
      accountInfo: activeAccount,
      onSwitchAccount: handleSwitchAccount,
      onSelectLoggedInCodexAccount: handleSelectLoggedInCodexAccount,
      onCancelSwitchAccount: handleCancelSwitchAccount,
      accountSwitchError,
      accountCenter,
      codeBlockCopyUseModifier: appSettings.composerCodeBlockCopyUseModifier,
      showMessageFilePath: appSettings.showMessageFilePath,
      showInternalRuntimeDiagnostics: appSettings.showInternalRuntimeDiagnostics,
      openAppTargets: appSettings.openAppTargets,
      selectedOpenAppId: appSettings.selectedOpenAppId,
      onOpenSettings,
      onCollapseSidebar: isPhone ? undefined : sidebarToggleProps.onCollapseSidebar,
      onExpandSidebar: isPhone ? undefined : sidebarToggleProps.onExpandSidebar,
      sidebarCollapsed: !isPhone && sidebarToggleProps.sidebarCollapsed,
      onOpenProject: () => {
        void handleOpenProject();
      },
      onSelectHome: () => {
        resetPullRequestSelection();
        clearDraftState();
        selectHome();
      },
      onSelectWorkspace: (workspaceId) => {
        exitDiffView();
        resetPullRequestSelection();
        clearDraftStateIfDifferentWorkspace(workspaceId);
        selectWorkspace(workspaceId);
      },
      onConnectWorkspace: async (workspace) => {
        await connectWorkspace(workspace);
        if (isCompact) {
          setActiveTab("missions");
        }
      },
      onToggleWorkspaceCollapse: (workspaceId, collapsed) => {
        void updateWorkspaceSettings(workspaceId, {
          sidebarCollapsed: collapsed,
        }).catch(() => undefined);
      },
      onReorderWorkspace: (sourceWorkspaceId, targetWorkspaceId, position) => {
        const sourceWorkspace = workspacesById.get(sourceWorkspaceId);
        const targetWorkspace = workspacesById.get(targetWorkspaceId);
        if (!sourceWorkspace || !targetWorkspace) {
          return;
        }
        if ((sourceWorkspace.kind ?? "main") === "worktree") {
          return;
        }
        if ((targetWorkspace.kind ?? "main") === "worktree") {
          return;
        }
        const sourceGroupId = sourceWorkspace.settings.groupId ?? null;
        const targetGroupId = targetWorkspace.settings.groupId ?? null;
        if (sourceGroupId !== targetGroupId) {
          return;
        }

        const ordered = layoutOptions.workspaces
          .filter(
            (entry) =>
              (entry.kind ?? "main") !== "worktree" &&
              (entry.settings.groupId ?? null) === sourceGroupId
          )
          .slice()
          .sort((a, b) => {
            const orderA =
              typeof a.settings.sortOrder === "number"
                ? a.settings.sortOrder
                : Number.MAX_SAFE_INTEGER;
            const orderB =
              typeof b.settings.sortOrder === "number"
                ? b.settings.sortOrder
                : Number.MAX_SAFE_INTEGER;
            const orderDiff = orderA - orderB;
            if (orderDiff !== 0) {
              return orderDiff;
            }
            return a.name.localeCompare(b.name);
          });

        const sourceIndex = ordered.findIndex((entry) => entry.id === sourceWorkspaceId);
        const targetIndex = ordered.findIndex((entry) => entry.id === targetWorkspaceId);
        if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) {
          return;
        }

        const reordered = ordered.slice();
        const [movedWorkspace] = reordered.splice(sourceIndex, 1);
        if (!movedWorkspace) {
          return;
        }
        const nextTargetIndex = reordered.findIndex((entry) => entry.id === targetWorkspaceId);
        if (nextTargetIndex === -1) {
          return;
        }
        reordered.splice(
          position === "before" ? nextTargetIndex : nextTargetIndex + 1,
          0,
          movedWorkspace
        );

        void Promise.all(
          reordered.map((entry, index) =>
            updateWorkspaceSettings(entry.id, {
              sortOrder: index,
            })
          )
        ).catch(() => undefined);
      },
      onSelectThread: (workspaceId, threadId) => {
        exitDiffView();
        resetPullRequestSelection();
        clearDraftState();
        selectWorkspace(workspaceId);
        setActiveThreadId(threadId, workspaceId);
      },
      onDeleteThread: (workspaceId, threadId) => {
        removeThread(workspaceId, threadId);
        clearDraftForThread(threadId);
        removeImagesForThread(threadId);
      },
      onSyncThread: (workspaceId, threadId) => {
        void refreshThread(workspaceId, threadId);
      },
      onRenameThread: (workspaceId, threadId) => {
        handleRenameThread(workspaceId, threadId);
      },
      onDeleteWorkspace: (workspaceId) => {
        void removeWorkspace(workspaceId);
      },
      onDeleteWorktree: (workspaceId) => {
        void removeWorktree(workspaceId);
      },
      onLoadOlderThreads: (workspaceId) => {
        const workspace = workspacesById.get(workspaceId);
        if (!workspace) {
          return;
        }
        void loadOlderThreadsForWorkspace(workspace);
      },
      onReloadWorkspaceThreads: (workspaceId) => {
        const workspace = workspacesById.get(workspaceId);
        if (!workspace) {
          return;
        }
        void listThreadsForWorkspace(workspace);
      },
      onRefreshLocalUsage: () => {
        refreshLocalUsage()?.catch(() => undefined);
      },
      onSelectHomeThread: (workspaceId, threadId) => {
        exitDiffView();
        clearDraftState();
        selectWorkspace(workspaceId);
        setActiveThreadId(threadId, workspaceId);
        if (isCompact) {
          setActiveTab("missions");
        }
      },
      worktreeRename: worktreeRenameCandidate ?? undefined,
      branchName: resolveBranchDisplayLabel({
        branchName: layoutOptions.gitStatus.branchName,
        hasBranchContext:
          Boolean(layoutOptions.activeWorkspace?.connected) && !layoutOptions.gitStatus.error,
        context: "header",
      }),
      showTerminalButton: !isCompact,
      showWorkspaceTools: !isCompact,
      launchScript: launchScriptState.launchScript,
      launchScriptEditorOpen: launchScriptState.editorOpen,
      launchScriptDraft: launchScriptState.draftScript,
      launchScriptSaving: launchScriptState.isSaving,
      launchScriptError: launchScriptState.error,
      onRunLaunchScript: launchScriptState.onRunLaunchScript,
      onOpenLaunchScriptEditor: launchScriptState.onOpenEditor,
      onCloseLaunchScriptEditor: launchScriptState.onCloseEditor,
      onLaunchScriptDraftChange: launchScriptState.onDraftScriptChange,
      onSaveLaunchScript: launchScriptState.onSaveLaunchScript,
      mainHeaderActionsNode: (
        <MainHeaderActions
          centerMode={layoutOptions.centerMode}
          gitDiffViewStyle={layoutOptions.gitDiffViewStyle}
          onSelectDiffViewStyle={setGitDiffViewStyle}
          sidebarToggleProps={sidebarToggleProps}
        />
      ),
      onExitDiff: () => {
        setCenterMode("chat");
        setSelectedDiffPath(null);
      },
      onSelectTab: (tab) => {
        if (tab === "home") {
          resetPullRequestSelection();
          clearDraftState();
          selectHome();
          return;
        }
        if (tab === "settings") {
          onOpenSettings();
          return;
        }
        setActiveTab(tab);
      },
      gitDiffIgnoreWhitespaceChanges:
        appSettings.gitDiffIgnoreWhitespaceChanges && layoutOptions.diffSource !== "pr",
      worktreeApplyLabel: "apply",
      worktreeApplyTitle: layoutOptions.activeParentWorkspace?.name
        ? `Apply changes to ${layoutOptions.activeParentWorkspace.name}`
        : "Apply changes to parent workspace",
      worktreeApplyLoading: layoutOptions.isWorktreeWorkspace ? worktreeApplyLoadingState : false,
      worktreeApplyError: layoutOptions.isWorktreeWorkspace ? worktreeApplyErrorState : null,
      worktreeApplySuccess: layoutOptions.isWorktreeWorkspace ? worktreeApplySuccessState : false,
      onApplyWorktreeChanges: layoutOptions.isWorktreeWorkspace
        ? handleApplyWorktreeChanges
        : undefined,
      selectedPullRequestNumber: selectedPullRequestCandidate?.number ?? null,
      selectedPullRequest: layoutOptions.diffSource === "pr" ? selectedPullRequestCandidate : null,
      selectedPullRequestComments:
        layoutOptions.diffSource === "pr" ? selectedPullRequestCommentsAll : [],
      onSelectPullRequest: (pullRequest) => {
        setSelectedCommitSha(null);
        handleSelectPullRequest(pullRequest);
      },
      onSelectCommit: (entry) => {
        handleSelectCommitSha(entry.sha);
      },
      gitRoot: activeGitRoot,
      onSelectGitRoot: (path) => {
        void handleSetGitRoot(path);
      },
      onClearGitRoot: () => {
        void handleSetGitRoot(null);
      },
      commitsAhead: layoutOptions.gitLogAhead,
      canRevealGeneralPrompts: Boolean(layoutOptions.activeWorkspace),
      steerEnabled: appSettings.steerEnabled,
      onEditMessage: (item) => {
        if (!item.text.trim()) {
          return;
        }
        const now = Date.now();
        setComposerInsert({
          id: `edit-message-${item.id}-${now}`,
          text: item.text,
          createdAt: now,
        });
      },
      insertText: composerInsert,
      onPrefillHandled: (id) => {
        if (prefillDraft?.id === id) {
          setPrefillDraft(null);
        }
      },
      onInsertHandled: (id) => {
        if (composerInsert?.id === id) {
          setComposerInsert(null);
        }
      },
      onBackFromDiff: () => {
        setCenterMode("chat");
      },
      onShowSelectedDiff: () => {
        if (!layoutOptions.selectedDiffPath) {
          return;
        }
        setCenterMode("diff");
        if (isPhone) {
          setActiveTab("review");
        }
      },
      onGoProjects: () => setActiveTab("workspaces"),
      isPhone,
      prefillDraft,
      isWorkspaceDropActive,
      workspaceDropText: "Drop Project Here",
    })
  );
}
