import type {
  GitBranchesSnapshot,
  GitResolvePullRequestResult,
  GitResolvedPullRequest,
  GitWorkflowBranch,
  GitWorkflowStatusResult,
} from "@ku0/code-runtime-host-contract";
import { checkoutGitBranch, createGitBranch, getGitHubPullRequests } from "../ports/tauriGit";
import type { BranchInfo, GitHubPullRequest, WorkspaceInfo } from "../../../types";

function trimToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function parseGitWorkflowPullRequestReference(reference: string): number | null {
  const trimmed = reference.trim();
  if (!trimmed) {
    return null;
  }

  const issueNumberMatch = /^#?(\d+)$/.exec(trimmed);
  if (issueNumberMatch) {
    return Number(issueNumberMatch[1]);
  }

  try {
    const parsedUrl = new URL(trimmed);
    const pullMatch = /\/pull\/(\d+)(?:\/|$)/.exec(parsedUrl.pathname);
    if (!pullMatch) {
      return null;
    }
    return Number(pullMatch[1]);
  } catch {
    return null;
  }
}

function toResolvedPullRequest(
  pullRequest: GitHubPullRequest
): GitResolvePullRequestResult["pullRequest"] {
  return {
    number: pullRequest.number,
    title: pullRequest.title,
    url: pullRequest.url,
    baseBranch: pullRequest.baseRefName,
    headBranch: pullRequest.headRefName,
  };
}

export function resolveGitWorkflowPullRequestFromList(
  pullRequests: GitHubPullRequest[],
  reference: string
): GitResolvePullRequestResult | null {
  const pullRequestNumber = parseGitWorkflowPullRequestReference(reference);
  if (pullRequestNumber === null) {
    return null;
  }
  const resolved = pullRequests.find((pullRequest) => pullRequest.number === pullRequestNumber);
  return resolved ? { pullRequest: toResolvedPullRequest(resolved) } : null;
}

export async function resolveGitWorkflowPullRequestForWorkspace(
  workspaceId: string,
  reference: string
): Promise<GitResolvePullRequestResult | null> {
  const response = await getGitHubPullRequests(workspaceId);
  return resolveGitWorkflowPullRequestFromList(response.pullRequests, reference);
}

export function resolveGitWorkflowRepositoryWorkspace(
  activeWorkspace: WorkspaceInfo | null,
  workspaces: WorkspaceInfo[]
): WorkspaceInfo | null {
  if (!activeWorkspace) {
    return null;
  }
  if (activeWorkspace.kind !== "worktree") {
    return activeWorkspace;
  }
  if (!activeWorkspace.parentId) {
    return activeWorkspace;
  }
  return workspaces.find((workspace) => workspace.id === activeWorkspace.parentId) ?? null;
}

function getWorktreePathByBranch(workspaces: WorkspaceInfo[], branchName: string): string | null {
  return (
    workspaces.find(
      (workspace) => workspace.kind === "worktree" && workspace.worktree?.branch === branchName
    )?.path ?? null
  );
}

export function buildGitWorkflowBranchInfo(
  snapshot: GitBranchesSnapshot,
  workspaces: WorkspaceInfo[] = []
): BranchInfo[] {
  return snapshot.branches
    .map<BranchInfo>((branch) => ({
      name: branch.name,
      lastCommit: branch.lastUsedAt,
      current: branch.name === snapshot.currentBranch,
      isDefault: branch.name === "main" || branch.name === "master",
      isRemote: false,
      remoteName: null,
      worktreePath: getWorktreePathByBranch(workspaces, branch.name),
    }))
    .sort((left, right) => {
      if (left.current !== right.current) {
        return left.current ? -1 : 1;
      }
      return right.lastCommit - left.lastCommit;
    });
}

export function buildGitWorkflowStatus(input: {
  branch: string | null;
  fileCount: number;
  aheadCount: number;
  behindCount: number;
  activeWorktreePath: string | null;
  upstream: string | null;
}): GitWorkflowStatusResult {
  return {
    branch: trimToNull(input.branch),
    hasWorkingTreeChanges: input.fileCount > 0,
    hasUpstream: trimToNull(input.upstream) !== null,
    aheadCount: input.aheadCount,
    behindCount: input.behindCount,
    activeWorktreePath: trimToNull(input.activeWorktreePath),
  };
}

export async function ensureGitWorkflowLocalBranch(
  workspaceId: string,
  branchName: string,
  options?: { createIfMissing?: boolean }
): Promise<void> {
  if (options?.createIfMissing) {
    try {
      await createGitBranch(workspaceId, branchName);
    } catch (error) {
      const message = error instanceof Error ? error.message.toLowerCase() : String(error);
      if (!message.includes("already exists")) {
        throw error;
      }
    }
  }
  await checkoutGitBranch(workspaceId, branchName);
}

export function buildGitWorkflowPreparePullRequestResult(input: {
  pullRequest: GitResolvedPullRequest;
  mode: "local" | "worktree";
  worktreePath?: string | null;
}) {
  return {
    branch: input.pullRequest.headBranch,
    worktreePath: input.mode === "worktree" ? trimToNull(input.worktreePath) : null,
  };
}

export function isGitWorkflowWorktreeBranch(
  branch: Pick<GitWorkflowBranch, "worktreePath"> | null | undefined
): boolean {
  return trimToNull(branch?.worktreePath) !== null;
}
