import {
  getRuntimeClient,
  type GitBranchesSnapshot,
  type GitChangesSnapshot,
  type GitCommitResult,
  type GitDiffContent,
  type GitLogResponse,
  type GitOperationResult,
} from "./runtimeClient";

/**
 * Canonical git runtime port for kernel/workspace-client assembly.
 *
 * These helpers return raw runtime contract shapes instead of legacy UI
 * envelopes so the kernel can assemble shared bindings without inline RPC.
 */
export async function listRuntimeGitChanges(workspaceId: string): Promise<GitChangesSnapshot> {
  return getRuntimeClient().gitChanges(workspaceId);
}

export async function readRuntimeGitDiff(
  workspaceId: string,
  changeId: string,
  options?: { offset?: number; maxBytes?: number }
): Promise<GitDiffContent | null> {
  return getRuntimeClient().gitDiffRead(workspaceId, changeId, options);
}

export async function listRuntimeGitBranches(workspaceId: string): Promise<GitBranchesSnapshot> {
  return getRuntimeClient().gitBranches(workspaceId);
}

export async function createRuntimeGitBranch(
  workspaceId: string,
  branchName: string
): Promise<GitOperationResult> {
  return getRuntimeClient().gitBranchCreate(workspaceId, branchName);
}

export async function checkoutRuntimeGitBranch(
  workspaceId: string,
  branchName: string
): Promise<GitOperationResult> {
  return getRuntimeClient().gitBranchCheckout(workspaceId, branchName);
}

export async function readRuntimeGitLog(
  workspaceId: string,
  limit?: number
): Promise<GitLogResponse> {
  return getRuntimeClient().gitLog(workspaceId, limit);
}

export async function stageRuntimeGitChange(
  workspaceId: string,
  changeId: string
): Promise<GitOperationResult> {
  return getRuntimeClient().gitStageChange(workspaceId, changeId);
}

export async function stageAllRuntimeGitChanges(workspaceId: string): Promise<GitOperationResult> {
  return getRuntimeClient().gitStageAll(workspaceId);
}

export async function unstageRuntimeGitChange(
  workspaceId: string,
  changeId: string
): Promise<GitOperationResult> {
  return getRuntimeClient().gitUnstageChange(workspaceId, changeId);
}

export async function revertRuntimeGitChange(
  workspaceId: string,
  changeId: string
): Promise<GitOperationResult> {
  return getRuntimeClient().gitRevertChange(workspaceId, changeId);
}

export async function commitRuntimeGit(
  workspaceId: string,
  message: string
): Promise<GitCommitResult> {
  return getRuntimeClient().gitCommit(workspaceId, message);
}
