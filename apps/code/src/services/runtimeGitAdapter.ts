import type {
  GitChangeSummary,
  GitChangesSnapshot,
  GitDiffContent,
  GitOperationResult,
} from "@ku0/code-runtime-host-contract";
import type { GitFileDiff, GitFileStatus } from "../types";

const DEFAULT_BRANCH_NAME = "unknown";

type RuntimeGitChangeWithCounts = GitChangeSummary & {
  additions?: number | null;
  deletions?: number | null;
};

export type RuntimeChangeSet = "staged" | "unstaged" | "any";

export type RuntimeGitDiffLookup = Readonly<Record<string, GitDiffContent | null | undefined>>;

export type RuntimeGitSnapshotView = {
  branchName: string;
  files: GitFileStatus[];
  stagedFiles: GitFileStatus[];
  unstagedFiles: GitFileStatus[];
  totalAdditions: number;
  totalDeletions: number;
};

function toCount(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function normalizeBranchName(branchName?: string | null): string {
  const normalized = branchName?.trim();
  return normalized && normalized.length > 0 ? normalized : DEFAULT_BRANCH_NAME;
}

function toGitFileStatus(change: RuntimeGitChangeWithCounts): GitFileStatus {
  return {
    path: change.path,
    status: change.status,
    additions: toCount(change.additions),
    deletions: toCount(change.deletions),
  };
}

function orderedChanges(snapshot: GitChangesSnapshot): RuntimeGitChangeWithCounts[] {
  return [...snapshot.staged, ...snapshot.unstaged];
}

export function mapRuntimeGitSnapshot(
  snapshot: GitChangesSnapshot,
  branchName?: string | null
): RuntimeGitSnapshotView {
  const stagedFiles = snapshot.staged.map(toGitFileStatus);
  const unstagedFiles = snapshot.unstaged.map(toGitFileStatus);
  const files = [...stagedFiles, ...unstagedFiles];

  return {
    branchName: normalizeBranchName(branchName),
    files,
    stagedFiles,
    unstagedFiles,
    totalAdditions: files.reduce((sum, file) => sum + file.additions, 0),
    totalDeletions: files.reduce((sum, file) => sum + file.deletions, 0),
  };
}

export function mapRuntimeGitDiffs(
  snapshot: GitChangesSnapshot,
  diffByChangeId: RuntimeGitDiffLookup
): GitFileDiff[] {
  return orderedChanges(snapshot).map((change) => ({
    path: change.path,
    diff: diffByChangeId[change.id]?.diff ?? "",
  }));
}

export function resolveRuntimeChangeId(
  snapshot: GitChangesSnapshot,
  path: string,
  preferredSet: RuntimeChangeSet = "any"
): string | null {
  if (!path) {
    return null;
  }

  const findInSet = (changes: readonly GitChangeSummary[]) =>
    changes.find((change) => change.path === path)?.id ?? null;

  if (preferredSet === "staged") {
    return findInSet(snapshot.staged);
  }

  if (preferredSet === "unstaged") {
    return findInSet(snapshot.unstaged);
  }

  return findInSet(snapshot.staged) ?? findInSet(snapshot.unstaged);
}

export function throwIfRuntimeGitOperationFailed(
  result: GitOperationResult,
  fallbackMessage = "Git operation failed."
): void {
  if (result.ok) {
    return;
  }

  const message = result.error?.trim();
  throw new Error(message && message.length > 0 ? message : fallbackMessage);
}
