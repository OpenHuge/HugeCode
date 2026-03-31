// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getGitDiffs } from "../../../application/runtime/ports/git";
import type { WorkspaceInfo } from "../../../types";
import { useGitDiffs } from "./useGitDiffs";

vi.mock("../../../application/runtime/ports/git", () => ({
  getGitDiffs: vi.fn(),
}));

const workspace: WorkspaceInfo = {
  id: "workspace-1",
  name: "CodexMonitor",
  path: "/tmp/codex",
  connected: true,
  settings: { sidebarCollapsed: false },
};

describe("useGitDiffs", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("suppresses console error noise for non-git workspaces while surfacing the diff error state", async () => {
    vi.mocked(getGitDiffs).mockRejectedValueOnce(new Error("fatal: not a git repository"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const { result } = renderHook(() =>
      useGitDiffs(
        workspace,
        [],
        [{ path: "README.md", status: "M", additions: 1, deletions: 0 }],
        true,
        false
      )
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.error).toBe("fatal: not a git repository");
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("still logs unexpected git diff failures", async () => {
    vi.mocked(getGitDiffs).mockRejectedValueOnce(new Error("rpc unavailable"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const { result } = renderHook(() =>
      useGitDiffs(
        workspace,
        [],
        [{ path: "README.md", status: "M", additions: 1, deletions: 0 }],
        true,
        false
      )
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.error).toBe("rpc unavailable");
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("suppresses runtime contract noise while surfacing the diff error state", async () => {
    const runtimeError = new Error("Runtime RPC compatFieldAliases mismatch from frozen contract.");
    runtimeError.name = "RuntimeRpcContractCompatFieldAliasesMismatchError";
    vi.mocked(getGitDiffs).mockRejectedValueOnce(runtimeError);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const { result } = renderHook(() =>
      useGitDiffs(
        workspace,
        [],
        [{ path: "README.md", status: "M", additions: 1, deletions: 0 }],
        true,
        false
      )
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.error).toBe(
      "Runtime RPC compatFieldAliases mismatch from frozen contract."
    );
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("preserves staged and unstaged diff entries for the same path", async () => {
    vi.mocked(getGitDiffs).mockResolvedValueOnce([
      { path: "src/shared.ts", diff: "staged diff", scope: "staged" },
      { path: "src/shared.ts", diff: "unstaged diff", scope: "unstaged" },
    ]);

    const { result } = renderHook(() =>
      useGitDiffs(
        workspace,
        [{ path: "src/shared.ts", status: "M", additions: 1, deletions: 0 }],
        [{ path: "src/shared.ts", status: "M", additions: 2, deletions: 1 }],
        true,
        false
      )
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.diffs).toEqual([
      { path: "src/shared.ts", status: "M", diff: "staged diff", scope: "staged" },
      { path: "src/shared.ts", status: "M", diff: "unstaged diff", scope: "unstaged" },
    ]);
  });
});
