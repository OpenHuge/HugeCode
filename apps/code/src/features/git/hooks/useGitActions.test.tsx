/** @vitest-environment jsdom */
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  revertGitFile,
  stageGitFile,
  unstageGitFile,
} from "../../../application/runtime/ports/tauriGit";
import type { WorkspaceInfo } from "../../../types";
import { useGitActions } from "./useGitActions";

vi.mock("../../../application/runtime/ports/tauriGit", () => ({
  applyWorktreeChanges: vi.fn(),
  revertGitAll: vi.fn(),
  revertGitFile: vi.fn(),
  stageGitAll: vi.fn(),
  stageGitFile: vi.fn(),
  unstageGitFile: vi.fn(),
}));

function makeWorkspace(): WorkspaceInfo {
  return {
    id: "ws-1",
    name: "Workspace",
    path: "/tmp/workspace",
    connected: true,
    kind: "main",
    parentId: null,
    worktree: null,
    settings: {
      sidebarCollapsed: false,
    },
  };
}

describe("useGitActions runtime stale change retry", () => {
  it("retries stageGitFile once when runtime reports stale change path", async () => {
    const stageGitFileMock = vi.mocked(stageGitFile);
    stageGitFileMock
      .mockRejectedValueOnce(new Error("Git change not found for path: src/file.ts"))
      .mockResolvedValueOnce(undefined);
    const onRefreshGitStatus = vi.fn();
    const onRefreshGitDiffs = vi.fn();
    const onError = vi.fn();

    const { result } = renderHook(() =>
      useGitActions({
        activeWorkspace: makeWorkspace(),
        onRefreshGitStatus,
        onRefreshGitDiffs,
        onError,
      })
    );

    await act(async () => {
      await result.current.stageGitFile("src/file.ts");
    });

    expect(stageGitFileMock).toHaveBeenCalledTimes(2);
    expect(onError).not.toHaveBeenCalled();
    expect(onRefreshGitStatus).toHaveBeenCalledTimes(2);
    expect(onRefreshGitDiffs).toHaveBeenCalledTimes(2);
  });

  it("retries unstageGitFile once when runtime reports stale change path", async () => {
    const unstageGitFileMock = vi.mocked(unstageGitFile);
    unstageGitFileMock
      .mockRejectedValueOnce(new Error("Git change not found for path: src/staged.ts"))
      .mockResolvedValueOnce(undefined);
    const onRefreshGitStatus = vi.fn();
    const onRefreshGitDiffs = vi.fn();
    const onError = vi.fn();

    const { result } = renderHook(() =>
      useGitActions({
        activeWorkspace: makeWorkspace(),
        onRefreshGitStatus,
        onRefreshGitDiffs,
        onError,
      })
    );

    await act(async () => {
      await result.current.unstageGitFile("src/staged.ts");
    });

    expect(unstageGitFileMock).toHaveBeenCalledTimes(2);
    expect(onError).not.toHaveBeenCalled();
    expect(onRefreshGitStatus).toHaveBeenCalledTimes(2);
    expect(onRefreshGitDiffs).toHaveBeenCalledTimes(2);
  });

  it("surfaces retry failure for revertGitFile", async () => {
    const revertGitFileMock = vi.mocked(revertGitFile);
    const retryError = new Error("revert denied");
    revertGitFileMock
      .mockRejectedValueOnce(new Error("Git change not found for path: src/revert.ts"))
      .mockRejectedValueOnce(retryError);
    const onRefreshGitStatus = vi.fn();
    const onRefreshGitDiffs = vi.fn();
    const onError = vi.fn();

    const { result } = renderHook(() =>
      useGitActions({
        activeWorkspace: makeWorkspace(),
        onRefreshGitStatus,
        onRefreshGitDiffs,
        onError,
      })
    );

    await act(async () => {
      await result.current.revertGitFile("src/revert.ts");
    });

    expect(revertGitFileMock).toHaveBeenCalledTimes(2);
    expect(onError).toHaveBeenCalledWith(retryError);
    expect(onRefreshGitStatus).toHaveBeenCalledTimes(2);
    expect(onRefreshGitDiffs).toHaveBeenCalledTimes(2);
  });
});
