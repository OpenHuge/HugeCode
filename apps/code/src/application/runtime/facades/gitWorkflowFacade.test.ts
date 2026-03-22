import { describe, expect, it } from "vitest";
import type { WorkspaceInfo } from "../../../types";
import {
  buildGitWorkflowBranchInfo,
  parseGitWorkflowPullRequestReference,
  resolveGitWorkflowPullRequestFromList,
  resolveGitWorkflowRepositoryWorkspace,
} from "./gitWorkflowFacade";

const mainWorkspace: WorkspaceInfo = {
  id: "ws-main",
  name: "Main",
  path: "/tmp/main",
  connected: true,
  kind: "main",
  settings: { sidebarCollapsed: false },
};

const worktreeWorkspace: WorkspaceInfo = {
  id: "ws-worktree",
  name: "Feature",
  path: "/tmp/feature",
  connected: true,
  kind: "worktree",
  parentId: "ws-main",
  worktree: { branch: "feature/login" },
  settings: { sidebarCollapsed: false },
};

describe("gitWorkflowFacade", () => {
  it("parses pull request references from issue numbers and github URLs", () => {
    expect(parseGitWorkflowPullRequestReference("#42")).toBe(42);
    expect(parseGitWorkflowPullRequestReference("42")).toBe(42);
    expect(
      parseGitWorkflowPullRequestReference("https://github.com/acme/repo/pull/108/files")
    ).toBe(108);
    expect(parseGitWorkflowPullRequestReference("feature/login")).toBeNull();
  });

  it("resolves pull requests from a fetched list", () => {
    const resolved = resolveGitWorkflowPullRequestFromList(
      [
        {
          number: 42,
          title: "Ship login flow",
          url: "https://github.com/acme/repo/pull/42",
          updatedAt: "2026-03-13T00:00:00.000Z",
          createdAt: "2026-03-12T00:00:00.000Z",
          body: "",
          headRefName: "feature/login",
          baseRefName: "main",
          isDraft: false,
          author: null,
        },
      ],
      "#42"
    );

    expect(resolved).toEqual({
      pullRequest: expect.objectContaining({
        number: 42,
        headBranch: "feature/login",
        baseBranch: "main",
      }),
    });
  });

  it("resolves the repository workspace for main and worktree contexts", () => {
    expect(
      resolveGitWorkflowRepositoryWorkspace(mainWorkspace, [mainWorkspace, worktreeWorkspace])
    ).toEqual(mainWorkspace);
    expect(
      resolveGitWorkflowRepositoryWorkspace(worktreeWorkspace, [mainWorkspace, worktreeWorkspace])
    ).toEqual(mainWorkspace);
  });

  it("annotates git branches with current/default/worktree metadata", () => {
    const branches = buildGitWorkflowBranchInfo(
      {
        currentBranch: "main",
        branches: [
          { name: "main", lastUsedAt: 10 },
          { name: "feature/login", lastUsedAt: 20 },
        ],
      },
      [mainWorkspace, worktreeWorkspace]
    );

    expect(branches).toEqual([
      expect.objectContaining({
        name: "main",
        current: true,
        worktreePath: null,
        isDefault: true,
        isRemote: false,
        remoteName: null,
      }),
      expect.objectContaining({
        name: "feature/login",
        current: false,
        worktreePath: "/tmp/feature",
        isDefault: false,
        isRemote: false,
        remoteName: null,
      }),
    ]);
  });
});
