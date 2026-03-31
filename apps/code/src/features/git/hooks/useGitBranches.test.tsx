// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { listGitBranches } from "../../../application/runtime/ports/git";
import type { WorkspaceInfo } from "../../../types";
import { useGitBranches } from "./useGitBranches";

vi.mock("../../../application/runtime/ports/git", () => ({
  checkoutGitBranch: vi.fn(),
  createGitBranch: vi.fn(),
  listGitBranches: vi.fn(),
}));

const workspaceOne: WorkspaceInfo = {
  id: "workspace-1",
  name: "Workspace One",
  path: "/tmp/workspace-one",
  connected: true,
  settings: { sidebarCollapsed: false },
};

const workspaceTwo: WorkspaceInfo = {
  id: "workspace-2",
  name: "Workspace Two",
  path: "/tmp/workspace-two",
  connected: true,
  settings: { sidebarCollapsed: false },
};

describe("useGitBranches", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("ignores stale branch results after switching workspaces during fetch", async () => {
    let resolveFirst: (value: {
      result: { branches: Array<{ name: string; lastCommit: number }> };
    }) => void;
    let resolveSecond: (value: {
      result: { branches: Array<{ name: string; lastCommit: number }> };
    }) => void;
    const firstPromise = new Promise<{
      result: { branches: Array<{ name: string; lastCommit: number }> };
    }>((resolve) => {
      resolveFirst = resolve;
    });
    const secondPromise = new Promise<{
      result: { branches: Array<{ name: string; lastCommit: number }> };
    }>((resolve) => {
      resolveSecond = resolve;
    });
    vi.mocked(listGitBranches).mockReturnValueOnce(firstPromise).mockReturnValueOnce(secondPromise);

    const { result, rerender } = renderHook(
      ({ activeWorkspace }: { activeWorkspace: WorkspaceInfo | null }) =>
        useGitBranches({ activeWorkspace }),
      { initialProps: { activeWorkspace: workspaceOne } }
    );

    rerender({ activeWorkspace: workspaceTwo });

    await waitFor(() => {
      expect(listGitBranches).toHaveBeenCalledWith("workspace-1");
    });

    await act(async () => {
      resolveFirst({
        result: {
          branches: [{ name: "old-branch", lastCommit: 1 }],
        },
      });
      await Promise.resolve();
    });

    expect(result.current.branches).toEqual([]);

    await waitFor(() => {
      expect(listGitBranches).toHaveBeenCalledWith("workspace-2");
    });

    await act(async () => {
      resolveSecond({
        result: {
          branches: [{ name: "new-branch", lastCommit: 2 }],
        },
      });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.branches.map((branch) => branch.name)).toEqual(["new-branch"]);
    });
  });
});
