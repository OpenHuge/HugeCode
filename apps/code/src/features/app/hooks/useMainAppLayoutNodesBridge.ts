import { type UseAppLayoutNodesParams, useAppLayoutNodes } from "./useAppLayoutNodes";

type MainAppLayoutHandlers = {
  handleOpenProject: UseAppLayoutNodesParams["handleOpenProject"];
  resetPullRequestSelection: UseAppLayoutNodesParams["resetPullRequestSelection"];
  worktreeRename: UseAppLayoutNodesParams["worktreeRenameCandidate"];
  handleSelectPullRequest: UseAppLayoutNodesParams["handleSelectPullRequest"];
  isWorkspaceDropActive: UseAppLayoutNodesParams["isWorkspaceDropActive"];
  handlePlanAccept: UseAppLayoutNodesParams["onPlanAccept"];
  handlePlanSubmitChanges: UseAppLayoutNodesParams["onPlanSubmitChanges"];
  handleAddWorkspace: UseAppLayoutNodesParams["onAddWorkspace"];
  handleAddAgent: UseAppLayoutNodesParams["onAddAgent"];
  handleAddWorktreeAgent: UseAppLayoutNodesParams["onAddWorktreeAgent"];
  handleAddCloneAgent: UseAppLayoutNodesParams["onAddCloneAgent"];
  handleOpenThreadLink: UseAppLayoutNodesParams["onOpenThreadLink"];
  activeParentWorkspace: UseAppLayoutNodesParams["activeParentWorkspace"];
  worktreeLabel: UseAppLayoutNodesParams["worktreeLabel"];
  isWorktreeWorkspace: UseAppLayoutNodesParams["isWorktreeWorkspace"];
  handleSendPromptToNewAgent: UseAppLayoutNodesParams["onSendPromptToNewAgent"];
  handleCreatePrompt: UseAppLayoutNodesParams["onCreatePrompt"];
  handleUpdatePrompt: UseAppLayoutNodesParams["onUpdatePrompt"];
  handleDeletePrompt: UseAppLayoutNodesParams["onDeletePrompt"];
  handleMovePrompt: UseAppLayoutNodesParams["onMovePrompt"];
  handleRevealWorkspacePrompts: UseAppLayoutNodesParams["onRevealWorkspacePrompts"];
  handleRevealGeneralPrompts: UseAppLayoutNodesParams["onRevealGeneralPrompts"];
  handleComposerSendWithDraftStart: UseAppLayoutNodesParams["onSend"];
  handleComposerQueueWithDraftStart: UseAppLayoutNodesParams["onQueue"];
  handleComposerSendToWorkspace: NonNullable<UseAppLayoutNodesParams["onSendToWorkspace"]>;
  handleComposerQueueToWorkspace: NonNullable<UseAppLayoutNodesParams["onQueueToWorkspace"]>;
  composerSendLabel: UseAppLayoutNodesParams["composerSendLabel"];
  workspaceDropTargetRef: UseAppLayoutNodesParams["workspaceDropTargetRef"];
  handleWorkspaceDragOver: UseAppLayoutNodesParams["onWorkspaceDragOver"];
  handleWorkspaceDragEnter: UseAppLayoutNodesParams["onWorkspaceDragEnter"];
  handleWorkspaceDragLeave: UseAppLayoutNodesParams["onWorkspaceDragLeave"];
  handleWorkspaceDrop: UseAppLayoutNodesParams["onWorkspaceDrop"];
};

type MappedLayoutKeys =
  | "handleOpenProject"
  | "resetPullRequestSelection"
  | "worktreeRenameCandidate"
  | "handleSelectPullRequest"
  | "isWorkspaceDropActive"
  | "onPlanAccept"
  | "onPlanSubmitChanges"
  | "onAddWorkspace"
  | "onAddAgent"
  | "onAddWorktreeAgent"
  | "onAddCloneAgent"
  | "onOpenThreadLink"
  | "activeParentWorkspace"
  | "worktreeLabel"
  | "isWorktreeWorkspace"
  | "onSendPromptToNewAgent"
  | "onCreatePrompt"
  | "onUpdatePrompt"
  | "onDeletePrompt"
  | "onMovePrompt"
  | "onRevealWorkspacePrompts"
  | "onRevealGeneralPrompts"
  | "onSend"
  | "onQueue"
  | "onSendToWorkspace"
  | "onQueueToWorkspace"
  | "composerSendLabel"
  | "workspaceDropTargetRef"
  | "onWorkspaceDragOver"
  | "onWorkspaceDragEnter"
  | "onWorkspaceDragLeave"
  | "onWorkspaceDrop";

type UseMainAppLayoutNodesBridgeParams = Omit<UseAppLayoutNodesParams, MappedLayoutKeys> & {
  mainAppHandlers: MainAppLayoutHandlers;
};

export function useMainAppLayoutNodesBridge({
  mainAppHandlers,
  ...rest
}: UseMainAppLayoutNodesBridgeParams) {
  return useAppLayoutNodes({
    ...rest,
    handleOpenProject: mainAppHandlers.handleOpenProject,
    resetPullRequestSelection: mainAppHandlers.resetPullRequestSelection,
    worktreeRenameCandidate: mainAppHandlers.worktreeRename,
    handleSelectPullRequest: mainAppHandlers.handleSelectPullRequest,
    isWorkspaceDropActive: mainAppHandlers.isWorkspaceDropActive,
    onPlanAccept: mainAppHandlers.handlePlanAccept,
    onPlanSubmitChanges: mainAppHandlers.handlePlanSubmitChanges,
    onAddWorkspace: mainAppHandlers.handleAddWorkspace,
    onAddAgent: mainAppHandlers.handleAddAgent,
    onAddWorktreeAgent: mainAppHandlers.handleAddWorktreeAgent,
    onAddCloneAgent: mainAppHandlers.handleAddCloneAgent,
    onOpenThreadLink: mainAppHandlers.handleOpenThreadLink,
    activeParentWorkspace: mainAppHandlers.activeParentWorkspace,
    worktreeLabel: mainAppHandlers.worktreeLabel,
    isWorktreeWorkspace: mainAppHandlers.isWorktreeWorkspace,
    onSendPromptToNewAgent: mainAppHandlers.handleSendPromptToNewAgent,
    onCreatePrompt: mainAppHandlers.handleCreatePrompt,
    onUpdatePrompt: mainAppHandlers.handleUpdatePrompt,
    onDeletePrompt: mainAppHandlers.handleDeletePrompt,
    onMovePrompt: mainAppHandlers.handleMovePrompt,
    onRevealWorkspacePrompts: mainAppHandlers.handleRevealWorkspacePrompts,
    onRevealGeneralPrompts: mainAppHandlers.handleRevealGeneralPrompts,
    onSend: mainAppHandlers.handleComposerSendWithDraftStart,
    onQueue: mainAppHandlers.handleComposerQueueWithDraftStart,
    onSendToWorkspace: mainAppHandlers.handleComposerSendToWorkspace,
    onQueueToWorkspace: mainAppHandlers.handleComposerQueueToWorkspace,
    composerSendLabel: mainAppHandlers.composerSendLabel,
    workspaceDropTargetRef: mainAppHandlers.workspaceDropTargetRef,
    onWorkspaceDragOver: mainAppHandlers.handleWorkspaceDragOver,
    onWorkspaceDragEnter: mainAppHandlers.handleWorkspaceDragEnter,
    onWorkspaceDragLeave: mainAppHandlers.handleWorkspaceDragLeave,
    onWorkspaceDrop: mainAppHandlers.handleWorkspaceDrop,
  });
}
