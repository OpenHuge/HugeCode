import { useCallback, useMemo, useState } from "react";
import {
  resolveGitWorkflowPullRequestForWorkspace,
  resolveGitWorkflowRepositoryWorkspace,
} from "../../../application/runtime/facades/gitWorkflowFacade";
import type { WorkspaceInfo } from "../../../types";
import type { BranchSwitcherSelection } from "../types/branchWorkflow";

type UseBranchSwitcherOptions = {
  activeWorkspace: WorkspaceInfo | null;
  workspaces: WorkspaceInfo[];
  checkoutBranch: (
    workspaceId: string,
    name: string,
    options?: { createIfMissing?: boolean }
  ) => Promise<void>;
  openWorktreePrompt: (
    workspace: WorkspaceInfo,
    options?: {
      initialName?: string | null;
      initialBranch?: string | null;
      branchWasEdited?: boolean;
      copyAgentsMd?: boolean;
    }
  ) => void;
  setActiveWorkspaceId: (id: string) => void;
  onError?: (error: unknown) => void;
};

export type BranchSwitcherState = {
  isOpen: boolean;
} | null;

export function useBranchSwitcher({
  activeWorkspace,
  workspaces,
  checkoutBranch,
  openWorktreePrompt,
  setActiveWorkspaceId,
  onError,
}: UseBranchSwitcherOptions) {
  const [branchSwitcher, setBranchSwitcher] = useState<BranchSwitcherState>(null);
  const branchSwitcherWorkspace = useMemo(
    () => resolveGitWorkflowRepositoryWorkspace(activeWorkspace, workspaces),
    [activeWorkspace, workspaces]
  );

  const openBranchSwitcher = useCallback(() => {
    if (!activeWorkspace || !activeWorkspace.connected || !branchSwitcherWorkspace) {
      return;
    }
    setBranchSwitcher({ isOpen: true });
  }, [activeWorkspace, branchSwitcherWorkspace]);

  const closeBranchSwitcher = useCallback(() => {
    setBranchSwitcher(null);
  }, []);

  const handleBranchSelection = useCallback(
    async (selection: BranchSwitcherSelection) => {
      closeBranchSwitcher();
      if (!branchSwitcherWorkspace) {
        return;
      }
      try {
        if (selection.kind === "pull-request") {
          const resolved = await resolveGitWorkflowPullRequestForWorkspace(
            branchSwitcherWorkspace.id,
            selection.reference
          );
          if (!resolved) {
            throw new Error("Pull request not found in the current repository.");
          }
          if (selection.mode === "worktree") {
            openWorktreePrompt(branchSwitcherWorkspace, {
              initialName: `PR #${resolved.pullRequest.number}`,
              initialBranch: resolved.pullRequest.headBranch,
              branchWasEdited: true,
            });
            return;
          }
          setActiveWorkspaceId(branchSwitcherWorkspace.id);
          await checkoutBranch(branchSwitcherWorkspace.id, resolved.pullRequest.headBranch, {
            createIfMissing: false,
          });
          return;
        }

        if (selection.mode === "worktree") {
          if (selection.worktreeWorkspace) {
            setActiveWorkspaceId(selection.worktreeWorkspace.id);
            return;
          }
          openWorktreePrompt(branchSwitcherWorkspace, {
            initialBranch: selection.branch,
            branchWasEdited: true,
          });
          return;
        }

        setActiveWorkspaceId(branchSwitcherWorkspace.id);
        await checkoutBranch(branchSwitcherWorkspace.id, selection.branch, {
          createIfMissing: false,
        });
      } catch (error) {
        onError?.(error);
      }
    },
    [
      branchSwitcherWorkspace,
      checkoutBranch,
      closeBranchSwitcher,
      onError,
      openWorktreePrompt,
      setActiveWorkspaceId,
    ]
  );

  return {
    branchSwitcher,
    branchSwitcherWorkspace,
    openBranchSwitcher,
    closeBranchSwitcher,
    handleBranchSelection,
  };
}
