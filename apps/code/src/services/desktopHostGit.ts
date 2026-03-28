import {
  invokeDesktopCommand,
  isDesktopHostRuntime,
} from "../application/runtime/ports/desktopHostCore";
import type {
  GitCommitDiff,
  GitHubIssue,
  GitHubIssuesResponse,
  GitHubPullRequestComment,
  GitHubPullRequestDiff,
  GitHubPullRequestsResponse,
} from "../types";

async function invokeDesktopRequired<Result>(
  command: string,
  payload: Record<string, unknown>,
  unavailableMessage: string
): Promise<Result> {
  if (!isDesktopHostRuntime()) {
    throw new Error(unavailableMessage);
  }
  return invokeDesktopCommand<Result>(command, payload);
}

async function invokeDesktopOrFallback<Result>(
  command: string,
  payload: Record<string, unknown>,
  fallback: Result
): Promise<Result> {
  if (!isDesktopHostRuntime()) {
    return fallback;
  }
  return invokeDesktopCommand<Result>(command, payload);
}

export async function listGitRoots(workspaceId: string, depth: number): Promise<string[]> {
  return invokeDesktopOrFallback("list_git_roots", { workspaceId, depth }, []);
}

export async function getGitCommitDiff(workspaceId: string, sha: string): Promise<GitCommitDiff[]> {
  return invokeDesktopOrFallback("get_git_commit_diff", { workspaceId, sha }, []);
}

export async function getGitRemote(workspaceId: string): Promise<string | null> {
  return invokeDesktopOrFallback("get_git_remote", { workspaceId }, null);
}

export async function revertGitAll(workspaceId: string): Promise<void> {
  await invokeDesktopRequired(
    "revert_git_all",
    { workspaceId },
    "Revert all is not available outside the desktop app."
  );
}

export async function pushGit(workspaceId: string): Promise<void> {
  await invokeDesktopRequired(
    "push_git",
    { workspaceId },
    "Git push is not available outside the desktop app."
  );
}

export async function pullGit(workspaceId: string): Promise<void> {
  await invokeDesktopRequired(
    "pull_git",
    { workspaceId },
    "Git pull is not available outside the desktop app."
  );
}

export async function fetchGit(workspaceId: string): Promise<void> {
  await invokeDesktopRequired(
    "fetch_git",
    { workspaceId },
    "Git fetch is not available outside the desktop app."
  );
}

export async function syncGit(workspaceId: string): Promise<void> {
  await invokeDesktopRequired(
    "sync_git",
    { workspaceId },
    "Git sync is not available outside the desktop app."
  );
}

export async function getGitHubIssues(workspaceId: string): Promise<GitHubIssuesResponse> {
  return invokeDesktopOrFallback("get_github_issues", { workspaceId }, { issues: [], total: 0 });
}

// Safe fallback: reuse the issue list until the desktop bridge exposes a richer detail command.
export async function getGitHubIssueDetails(
  workspaceId: string,
  issueNumber: number
): Promise<GitHubIssue | null> {
  const response = await getGitHubIssues(workspaceId);
  return response.issues.find((issue) => issue.number === issueNumber) ?? null;
}

export async function getGitHubPullRequests(
  workspaceId: string
): Promise<GitHubPullRequestsResponse> {
  return invokeDesktopOrFallback(
    "get_github_pull_requests",
    { workspaceId },
    { pullRequests: [], total: 0 }
  );
}

export async function getGitHubPullRequestDiff(
  workspaceId: string,
  prNumber: number
): Promise<GitHubPullRequestDiff[]> {
  return invokeDesktopOrFallback("get_github_pull_request_diff", { workspaceId, prNumber }, []);
}

export async function getGitHubPullRequestComments(
  workspaceId: string,
  prNumber: number
): Promise<GitHubPullRequestComment[]> {
  return invokeDesktopOrFallback("get_github_pull_request_comments", { workspaceId, prNumber }, []);
}
