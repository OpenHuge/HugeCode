import { useCallback } from "react";
import { ensureGitWorkflowLocalBranch } from "../../../application/runtime/facades/gitWorkflowFacade";
import { resolveCurrentBranchName } from "../../git/utils/branchLabels";

type GitStatusSummary = {
  branchName: string | null;
  error: string | null;
  files: ReadonlyArray<unknown>;
};

type UseGitBranchActionsParams = {
  workspaceId: string | null;
  gitStatus: GitStatusSummary;
  refreshGitStatus: () => void;
};

type UseGitBranchActionsResult = {
  handleCheckoutBranch: (name: string) => Promise<void>;
  checkoutBranchInWorkspace: (
    targetWorkspaceId: string,
    name: string,
    options?: { createIfMissing?: boolean }
  ) => Promise<void>;
  alertError: (error: unknown) => void;
  currentBranch: string | null;
  fileStatus: string;
};

export function useGitBranchActions({
  workspaceId,
  gitStatus,
  refreshGitStatus,
}: UseGitBranchActionsParams): UseGitBranchActionsResult {
  const checkoutBranchInWorkspace = useCallback(
    async (targetWorkspaceId: string, name: string, options?: { createIfMissing?: boolean }) => {
      if (!targetWorkspaceId || !name) {
        return;
      }
      await ensureGitWorkflowLocalBranch(targetWorkspaceId, name, options);
      refreshGitStatus();
    },
    [refreshGitStatus]
  );

  const handleCheckoutBranch = useCallback(
    async (name: string) => {
      if (!workspaceId || !name) {
        return;
      }
      await checkoutBranchInWorkspace(workspaceId, name);
    },
    [checkoutBranchInWorkspace, workspaceId]
  );

  const alertError = useCallback((error: unknown) => {
    alert(error instanceof Error ? error.message : String(error));
  }, []);

  const currentBranch = resolveCurrentBranchName(gitStatus.branchName);
  const fileStatus = gitStatus.error
    ? "Git status unavailable"
    : gitStatus.files.length > 0
      ? `${gitStatus.files.length} file${gitStatus.files.length === 1 ? "" : "s"} changed`
      : "Working tree clean";

  return {
    handleCheckoutBranch,
    checkoutBranchInWorkspace,
    alertError,
    currentBranch,
    fileStatus,
  };
}
