import type { WorkspaceInfo } from "../../../types";
import type { BranchSwitcherSelection } from "../../git/types/branchWorkflow";

export type ComposerWorkspaceControls = {
  mode: "local" | "worktree";
  branchLabel: string | null;
  currentBranch: string | null;
  branchTriggerLabel: string;
  repositoryWorkspace: WorkspaceInfo | null;
  activeWorkspace: WorkspaceInfo | null;
  workspaces: WorkspaceInfo[];
  onSelectGitWorkflowSelection?: (selection: BranchSwitcherSelection) => void | Promise<void>;
};
