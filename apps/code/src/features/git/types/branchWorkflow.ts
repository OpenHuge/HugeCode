import type { WorkspaceInfo } from "../../../types";

export type BranchSwitcherSelection =
  | {
      kind: "branch";
      mode: "local" | "worktree";
      branch: string;
      worktreeWorkspace: WorkspaceInfo | null;
    }
  | {
      kind: "pull-request";
      mode: "local" | "worktree";
      reference: string;
    };
