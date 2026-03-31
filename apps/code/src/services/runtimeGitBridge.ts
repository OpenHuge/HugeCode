import type { GitFileDiff, GitFileStatus, GitLogResponse } from "../types";
import { getRuntimeClient, readRuntimeCapabilitiesSummary } from "./runtimeClient";
import {
  mapRuntimeGitSnapshot,
  resolveRuntimeChangeId,
  throwIfRuntimeGitOperationFailed,
} from "./runtimeGitAdapter";
import type { LooseResultEnvelope } from "./runtimeTransport";

const GIT_DIFF_PAGING_FEATURE = "git_diff_paging_v1";
const GIT_DIFF_PAGE_MAX_BYTES = 256 * 1024;
const GIT_DIFF_PAGE_MAX_REQUESTS = 256;

async function readGitDiffWithPaging(
  runtimeClient: ReturnType<typeof getRuntimeClient>,
  workspaceId: string,
  changeId: string
): Promise<string> {
  let offset = 0;
  let requestCount = 0;
  let combinedDiff = "";

  while (requestCount < GIT_DIFF_PAGE_MAX_REQUESTS) {
    requestCount += 1;
    const page = await runtimeClient.gitDiffRead(workspaceId, changeId, {
      offset,
      maxBytes: GIT_DIFF_PAGE_MAX_BYTES,
    });
    if (!page) {
      return combinedDiff;
    }
    combinedDiff += page.diff ?? "";
    if (page.hasMore !== true) {
      return combinedDiff;
    }
    const nextOffset = page.nextOffset;
    if (typeof nextOffset !== "number" || !Number.isFinite(nextOffset) || nextOffset <= offset) {
      throw new Error(`Invalid git diff paging cursor returned for change: ${changeId}`);
    }
    offset = nextOffset;
  }

  throw new Error(`Git diff paging exceeded ${GIT_DIFF_PAGE_MAX_REQUESTS} pages: ${changeId}`);
}

export async function getGitStatus(workspace_id: string): Promise<{
  branchName: string;
  files: GitFileStatus[];
  stagedFiles: GitFileStatus[];
  unstagedFiles: GitFileStatus[];
  totalAdditions: number;
  totalDeletions: number;
}> {
  const runtimeClient = getRuntimeClient();
  const [changes, branches] = await Promise.all([
    runtimeClient.gitChanges(workspace_id),
    runtimeClient.gitBranches(workspace_id),
  ]);
  return mapRuntimeGitSnapshot(changes, branches.currentBranch);
}

export async function getGitDiffs(workspace_id: string): Promise<GitFileDiff[]> {
  const runtimeClient = getRuntimeClient();
  const capabilitySummary = await readRuntimeCapabilitiesSummary();
  const supportsGitDiffPaging = capabilitySummary.features.includes(GIT_DIFF_PAGING_FEATURE);
  const snapshot = await runtimeClient.gitChanges(workspace_id);
  const changes = [
    ...snapshot.staged.map((change) => ({ ...change, scope: "staged" as const })),
    ...snapshot.unstaged.map((change) => ({ ...change, scope: "unstaged" as const })),
  ];
  const concurrency = Math.min(6, Math.max(1, changes.length));
  const results = new Array<GitFileDiff>(changes.length);
  let cursor = 0;

  const worker = async () => {
    while (cursor < changes.length) {
      const index = cursor;
      cursor += 1;
      const change = changes[index];
      const diffText = supportsGitDiffPaging
        ? await readGitDiffWithPaging(runtimeClient, workspace_id, change.id)
        : ((await runtimeClient.gitDiffRead(workspace_id, change.id))?.diff ?? "");
      results[index] = {
        path: change.path,
        diff: diffText,
        scope: change.scope,
      };
    }
  };

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return results.filter((result): result is GitFileDiff => Boolean(result));
}

export async function getGitLog(workspace_id: string, limit = 40): Promise<GitLogResponse> {
  const client = getRuntimeClient();
  return client.gitLog(workspace_id, limit);
}

async function resolveRuntimeGitChangeIdByPath(
  workspaceId: string,
  path: string,
  preferredScope: "staged" | "unstaged"
): Promise<string | null> {
  const normalizedPath = path.trim();
  if (!normalizedPath) {
    return null;
  }
  const snapshot = await getRuntimeClient().gitChanges(workspaceId);
  return resolveRuntimeChangeId(snapshot, normalizedPath, preferredScope);
}

export async function stageGitFile(workspaceId: string, path: string) {
  const changeId = await resolveRuntimeGitChangeIdByPath(workspaceId, path, "unstaged");
  if (!changeId) {
    throw new Error(`Git change not found for path: ${path}`);
  }
  const result = await getRuntimeClient().gitStageChange(workspaceId, changeId);
  throwIfRuntimeGitOperationFailed(result, "Failed to stage git file.");
}

export async function stageGitAll(workspaceId: string): Promise<void> {
  const result = await getRuntimeClient().gitStageAll(workspaceId);
  throwIfRuntimeGitOperationFailed(result, "Failed to stage all git changes.");
}

export async function unstageGitFile(workspaceId: string, path: string) {
  const changeId = await resolveRuntimeGitChangeIdByPath(workspaceId, path, "staged");
  if (!changeId) {
    throw new Error(`Git change not found for path: ${path}`);
  }
  const result = await getRuntimeClient().gitUnstageChange(workspaceId, changeId);
  throwIfRuntimeGitOperationFailed(result, "Failed to unstage git file.");
}

export async function revertGitFile(workspaceId: string, path: string) {
  const changeId = await resolveRuntimeGitChangeIdByPath(workspaceId, path, "unstaged");
  if (!changeId) {
    throw new Error(`Git change not found for path: ${path}`);
  }
  const result = await getRuntimeClient().gitRevertChange(workspaceId, changeId);
  throwIfRuntimeGitOperationFailed(result, "Failed to revert git file.");
}

export async function commitGit(workspaceId: string, message: string): Promise<void> {
  const result = await getRuntimeClient().gitCommit(workspaceId, message);
  if (result.error?.trim()) {
    throw new Error(result.error);
  }
}

export async function listGitBranches(workspaceId: string): Promise<LooseResultEnvelope> {
  const snapshot = await getRuntimeClient().gitBranches(workspaceId);
  const branches = snapshot.branches.map((branch) => ({
    name: branch.name,
    lastCommit: branch.lastUsedAt,
    last_commit: branch.lastUsedAt,
  }));
  return {
    result: {
      currentBranch: snapshot.currentBranch,
      current_branch: snapshot.currentBranch,
      branches,
    },
    currentBranch: snapshot.currentBranch,
    current_branch: snapshot.currentBranch,
    branches,
  };
}

export async function checkoutGitBranch(workspaceId: string, name: string) {
  const result = await getRuntimeClient().gitBranchCheckout(workspaceId, name);
  throwIfRuntimeGitOperationFailed(result, "Failed to checkout git branch.");
}

export async function createGitBranch(workspaceId: string, name: string) {
  const result = await getRuntimeClient().gitBranchCreate(workspaceId, name);
  throwIfRuntimeGitOperationFailed(result, "Failed to create git branch.");
}
