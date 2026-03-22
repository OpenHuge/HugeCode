import type {
  GitChangesSnapshot,
  GitDiffContent,
  GitOperationResult,
} from "@ku0/code-runtime-host-contract";
import { describe, expect, it } from "vitest";
import {
  mapRuntimeGitDiffs,
  mapRuntimeGitSnapshot,
  resolveRuntimeChangeId,
  throwIfRuntimeGitOperationFailed,
} from "./runtimeGitAdapter";

function createSnapshot(): GitChangesSnapshot {
  return {
    staged: [
      { id: "staged-1", path: "src/a.ts", status: "M", summary: "modified" },
      { id: "staged-2", path: "src/shared.ts", status: "A", summary: "added" },
    ],
    unstaged: [
      { id: "unstaged-1", path: "src/shared.ts", status: "M", summary: "modified" },
      { id: "unstaged-2", path: "src/c.ts", status: "D", summary: "deleted" },
    ],
  };
}

describe("runtimeGitAdapter", () => {
  it("maps staged and unstaged runtime changes to UI git status", () => {
    const snapshot = createSnapshot();

    const mapped = mapRuntimeGitSnapshot(snapshot, "feature/runtime-git");

    expect(mapped.branchName).toBe("feature/runtime-git");
    expect(mapped.stagedFiles).toEqual([
      { path: "src/a.ts", status: "M", additions: 0, deletions: 0 },
      { path: "src/shared.ts", status: "A", additions: 0, deletions: 0 },
    ]);
    expect(mapped.unstagedFiles).toEqual([
      { path: "src/shared.ts", status: "M", additions: 0, deletions: 0 },
      { path: "src/c.ts", status: "D", additions: 0, deletions: 0 },
    ]);
    expect(mapped.files).toEqual([...mapped.stagedFiles, ...mapped.unstagedFiles]);
    expect(mapped.totalAdditions).toBe(0);
    expect(mapped.totalDeletions).toBe(0);
  });

  it("falls back to unknown branch name when branch is missing", () => {
    const snapshot = createSnapshot();

    expect(mapRuntimeGitSnapshot(snapshot).branchName).toBe("unknown");
    expect(mapRuntimeGitSnapshot(snapshot, "   ").branchName).toBe("unknown");
  });

  it("resolves change id by path with set preference", () => {
    const snapshot = createSnapshot();

    expect(resolveRuntimeChangeId(snapshot, "src/shared.ts", "staged")).toBe("staged-2");
    expect(resolveRuntimeChangeId(snapshot, "src/shared.ts", "unstaged")).toBe("unstaged-1");
    expect(resolveRuntimeChangeId(snapshot, "src/shared.ts")).toBe("staged-2");
    expect(resolveRuntimeChangeId(snapshot, "src/missing.ts", "any")).toBeNull();
  });

  it("maps runtime diffs preserving staged/unstaged ordering", () => {
    const snapshot = createSnapshot();
    const diffByChangeId: Record<string, GitDiffContent> = {
      "staged-1": { id: "staged-1", diff: "staged a" },
      "staged-2": { id: "staged-2", diff: "staged shared" },
      "unstaged-1": { id: "unstaged-1", diff: "unstaged shared" },
    };

    const diffs = mapRuntimeGitDiffs(snapshot, diffByChangeId);

    expect(diffs).toEqual([
      { path: "src/a.ts", diff: "staged a" },
      { path: "src/shared.ts", diff: "staged shared" },
      { path: "src/shared.ts", diff: "unstaged shared" },
      { path: "src/c.ts", diff: "" },
    ]);
  });

  it("throws operation error messages from runtime results", () => {
    const failedResult: GitOperationResult = { ok: false, error: "cannot stage file" };
    const fallbackError: GitOperationResult = { ok: false, error: null };
    const okResult: GitOperationResult = { ok: true, error: "ignored" };

    expect(() => throwIfRuntimeGitOperationFailed(okResult, "fallback")).not.toThrow();
    expect(() => throwIfRuntimeGitOperationFailed(failedResult, "fallback")).toThrowError(
      "cannot stage file"
    );
    expect(() => throwIfRuntimeGitOperationFailed(fallbackError, "fallback")).toThrowError(
      "fallback"
    );
  });
});
