import { invoke, isTauri } from "@tauri-apps/api/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchGit,
  getGitCommitDiff,
  getGitHubIssueDetails,
  getGitHubIssues,
  getGitHubPullRequests,
  listGitRoots,
  pushGit,
  revertGitAll,
} from "./desktopHostGit";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
  isTauri: vi.fn(),
}));

const invokeMock = vi.mocked(invoke);
const isTauriMock = vi.mocked(isTauri);

beforeEach(() => {
  vi.clearAllMocks();
  isTauriMock.mockReturnValue(true);
});

describe("tauriDesktopGit", () => {
  it("returns fallback values for non-tauri list/read APIs", async () => {
    isTauriMock.mockReturnValue(false);

    await expect(listGitRoots("ws-1", 2)).resolves.toEqual([]);
    await expect(getGitHubIssues("ws-1")).resolves.toEqual({ issues: [], total: 0 });
    await expect(getGitHubIssueDetails("ws-1", 42)).resolves.toBeNull();
    await expect(getGitHubPullRequests("ws-1")).resolves.toEqual({ pullRequests: [], total: 0 });
    await expect(getGitCommitDiff("ws-1", "abc123")).resolves.toEqual([]);
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("throws for non-tauri mutating desktop commands", async () => {
    isTauriMock.mockReturnValue(false);

    await expect(pushGit("ws-1")).rejects.toThrow(
      "Git push is not available outside the desktop app."
    );
    await expect(revertGitAll("ws-1")).rejects.toThrow(
      "Revert all is not available outside the desktop app."
    );
    await expect(fetchGit("ws-1")).rejects.toThrow(
      "Git fetch is not available outside the desktop app."
    );
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("invokes desktop commands with normalized payloads in tauri mode", async () => {
    invokeMock.mockResolvedValueOnce(["/repo"]);
    invokeMock.mockResolvedValueOnce([{ path: "src/a.ts", diff: "@@" }]);
    invokeMock.mockResolvedValueOnce(undefined);

    await expect(listGitRoots("ws-2", 3)).resolves.toEqual(["/repo"]);
    await expect(getGitCommitDiff("ws-2", "sha-1")).resolves.toEqual([
      { path: "src/a.ts", diff: "@@" },
    ]);
    await expect(fetchGit("ws-2")).resolves.toBeUndefined();

    expect(invokeMock).toHaveBeenNthCalledWith(1, "list_git_roots", {
      workspaceId: "ws-2",
      depth: 3,
    });
    expect(invokeMock).toHaveBeenNthCalledWith(2, "get_git_commit_diff", {
      workspaceId: "ws-2",
      sha: "sha-1",
    });
    expect(invokeMock).toHaveBeenNthCalledWith(3, "fetch_git", {
      workspaceId: "ws-2",
    });
  });

  it("resolves GitHub issue details from the issue list as a safe fallback", async () => {
    invokeMock.mockResolvedValueOnce({
      total: 2,
      issues: [
        {
          number: 42,
          title: "Fix runtime source launch",
          url: "https://github.com/acme/hugecode/issues/42",
          updatedAt: "2026-03-18T00:00:00.000Z",
          body: "Capture the issue body for launch normalization.",
          author: { login: "octocat" },
          labels: ["bug", "launcher"],
        },
      ],
    });

    await expect(getGitHubIssueDetails("ws-2", 42)).resolves.toEqual(
      expect.objectContaining({
        number: 42,
        body: "Capture the issue body for launch normalization.",
        author: { login: "octocat" },
        labels: ["bug", "launcher"],
      })
    );
    expect(invokeMock).toHaveBeenCalledWith("get_github_issues", {
      workspaceId: "ws-2",
    });
  });
});
