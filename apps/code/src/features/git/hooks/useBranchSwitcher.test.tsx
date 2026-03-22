import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { WorkspaceInfo } from "../../../types";
import { useBranchSwitcher } from "./useBranchSwitcher";

vi.mock("../../../application/runtime/facades/gitWorkflowFacade", () => ({
  resolveGitWorkflowPullRequestForWorkspace: vi.fn(),
  resolveGitWorkflowRepositoryWorkspace: vi.fn(),
}));

import {
  resolveGitWorkflowPullRequestForWorkspace,
  resolveGitWorkflowRepositoryWorkspace,
} from "../../../application/runtime/facades/gitWorkflowFacade";

function makeWorkspace(overrides: Partial<WorkspaceInfo> = {}): WorkspaceInfo {
  return {
    id: "ws-1",
    path: "/tmp/ws-1",
    name: "Workspace",
    connected: true,
    kind: "main",
    parentId: null,
    worktree: null,
    settings: {
      sidebarCollapsed: false,
    },
    ...overrides,
  };
}

describe("useBranchSwitcher", () => {
  it("opens for connected repo contexts and exposes the repository workspace", () => {
    const checkoutBranch = vi.fn().mockResolvedValue(undefined);
    const setActiveWorkspaceId = vi.fn();
    const openWorktreePrompt = vi.fn();

    vi.mocked(resolveGitWorkflowRepositoryWorkspace).mockReturnValue(makeWorkspace());

    const { result, rerender } = renderHook(
      ({ activeWorkspace, workspaces }) =>
        useBranchSwitcher({
          activeWorkspace,
          workspaces,
          checkoutBranch,
          openWorktreePrompt,
          setActiveWorkspaceId,
        }),
      {
        initialProps: {
          activeWorkspace: makeWorkspace({ connected: false }),
          workspaces: [makeWorkspace()],
        },
      }
    );

    act(() => {
      result.current.openBranchSwitcher();
    });
    expect(result.current.branchSwitcher).toBeNull();

    rerender({
      activeWorkspace: makeWorkspace({ kind: "worktree", parentId: "parent-1" }),
      workspaces: [
        makeWorkspace({ id: "parent-1" }),
        makeWorkspace({ kind: "worktree", parentId: "parent-1" }),
      ],
    });
    act(() => {
      result.current.openBranchSwitcher();
    });
    expect(result.current.branchSwitcher).toEqual({ isOpen: true });
    expect(result.current.branchSwitcherWorkspace?.id).toBe("ws-1");

    rerender({
      activeWorkspace: makeWorkspace({ connected: true, kind: "main" }),
      workspaces: [makeWorkspace({ connected: true, kind: "main" })],
    });
    act(() => {
      result.current.openBranchSwitcher();
    });
    expect(result.current.branchSwitcher).toEqual({ isOpen: true });
  });

  it("selects existing worktrees directly without checkout", async () => {
    const checkoutBranch = vi.fn().mockResolvedValue(undefined);
    const setActiveWorkspaceId = vi.fn();
    const openWorktreePrompt = vi.fn();
    vi.mocked(resolveGitWorkflowRepositoryWorkspace).mockReturnValue(makeWorkspace());

    const { result } = renderHook(() =>
      useBranchSwitcher({
        activeWorkspace: makeWorkspace(),
        workspaces: [makeWorkspace()],
        checkoutBranch,
        openWorktreePrompt,
        setActiveWorkspaceId,
      })
    );

    await act(async () => {
      await result.current.handleBranchSelection({
        kind: "branch",
        mode: "worktree",
        branch: "feature/a",
        worktreeWorkspace: makeWorkspace({ id: "ws-worktree", kind: "worktree", parentId: "ws-1" }),
      });
    });

    expect(setActiveWorkspaceId).toHaveBeenCalledWith("ws-worktree");
    expect(checkoutBranch).not.toHaveBeenCalled();
    expect(openWorktreePrompt).not.toHaveBeenCalled();
  });

  it("opens a prefilled worktree prompt when selecting a new worktree branch", async () => {
    const repoWorkspace = makeWorkspace({ id: "repo-main" });
    const checkoutBranch = vi.fn().mockResolvedValue(undefined);
    const setActiveWorkspaceId = vi.fn();
    const openWorktreePrompt = vi.fn();
    vi.mocked(resolveGitWorkflowRepositoryWorkspace).mockReturnValue(repoWorkspace);

    const { result } = renderHook(() =>
      useBranchSwitcher({
        activeWorkspace: makeWorkspace({ id: "repo-main" }),
        workspaces: [repoWorkspace],
        checkoutBranch,
        openWorktreePrompt,
        setActiveWorkspaceId,
      })
    );

    await act(async () => {
      await result.current.handleBranchSelection({
        kind: "branch",
        mode: "worktree",
        branch: "feature/a",
        worktreeWorkspace: null,
      });
    });

    expect(openWorktreePrompt).toHaveBeenCalledWith(repoWorkspace, {
      initialBranch: "feature/a",
      branchWasEdited: true,
    });
    expect(checkoutBranch).not.toHaveBeenCalled();
  });

  it("resolves pull requests before opening a worktree prompt", async () => {
    const repoWorkspace = makeWorkspace({ id: "repo-main" });
    const checkoutBranch = vi.fn().mockResolvedValue(undefined);
    const setActiveWorkspaceId = vi.fn();
    const openWorktreePrompt = vi.fn();
    vi.mocked(resolveGitWorkflowRepositoryWorkspace).mockReturnValue(repoWorkspace);
    vi.mocked(resolveGitWorkflowPullRequestForWorkspace).mockResolvedValue({
      pullRequest: {
        number: 42,
        title: "Ship login",
        url: "https://github.com/acme/repo/pull/42",
        baseBranch: "main",
        headBranch: "feature/login",
      },
    });

    const { result } = renderHook(() =>
      useBranchSwitcher({
        activeWorkspace: repoWorkspace,
        workspaces: [repoWorkspace],
        checkoutBranch,
        openWorktreePrompt,
        setActiveWorkspaceId,
      })
    );

    await act(async () => {
      await result.current.handleBranchSelection({
        kind: "pull-request",
        mode: "worktree",
        reference: "#42",
      });
    });

    expect(resolveGitWorkflowPullRequestForWorkspace).toHaveBeenCalledWith("repo-main", "#42");
    expect(openWorktreePrompt).toHaveBeenCalledWith(repoWorkspace, {
      initialName: "PR #42",
      initialBranch: "feature/login",
      branchWasEdited: true,
    });
  });

  it("checks out local branches in the repository workspace", async () => {
    const repoWorkspace = makeWorkspace({ id: "repo-main" });
    const checkoutBranch = vi.fn().mockResolvedValue(undefined);
    const setActiveWorkspaceId = vi.fn();
    const openWorktreePrompt = vi.fn();
    vi.mocked(resolveGitWorkflowRepositoryWorkspace).mockReturnValue(repoWorkspace);

    const { result } = renderHook(() =>
      useBranchSwitcher({
        activeWorkspace: makeWorkspace({
          id: "repo-worktree",
          kind: "worktree",
          parentId: "repo-main",
        }),
        workspaces: [repoWorkspace],
        checkoutBranch,
        openWorktreePrompt,
        setActiveWorkspaceId,
      })
    );

    await act(async () => {
      await result.current.handleBranchSelection({
        kind: "branch",
        mode: "local",
        branch: "feature/a",
        worktreeWorkspace: null,
      });
    });

    expect(checkoutBranch).toHaveBeenCalledWith("repo-main", "feature/a", {
      createIfMissing: false,
    });
    expect(setActiveWorkspaceId).toHaveBeenCalledWith("repo-main");
  });

  it("surfaces checkout errors through onError and avoids unhandled rejections", async () => {
    const checkoutError = new Error("checkout denied");
    const checkoutBranch = vi.fn().mockRejectedValue(checkoutError);
    const setActiveWorkspaceId = vi.fn();
    const onError = vi.fn();
    const openWorktreePrompt = vi.fn();
    vi.mocked(resolveGitWorkflowRepositoryWorkspace).mockReturnValue(makeWorkspace());

    const { result } = renderHook(() =>
      useBranchSwitcher({
        activeWorkspace: makeWorkspace(),
        workspaces: [makeWorkspace()],
        checkoutBranch,
        openWorktreePrompt,
        setActiveWorkspaceId,
        onError,
      })
    );

    await act(async () => {
      await result.current.handleBranchSelection({
        kind: "branch",
        mode: "local",
        branch: "feature/a",
        worktreeWorkspace: null,
      });
    });

    expect(checkoutBranch).toHaveBeenCalledWith("ws-1", "feature/a", { createIfMissing: false });
    expect(onError).toHaveBeenCalledWith(checkoutError);
    expect(setActiveWorkspaceId).not.toHaveBeenCalledWith("ws-worktree");
  });
});
