// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getGitLog } from "../../../application/runtime/ports/tauriGit";
import type { WorkspaceInfo } from "../../../types";
import { useGitLog } from "./useGitLog";

vi.mock("../../../application/runtime/ports/tauriGit", () => ({
  getGitLog: vi.fn(),
}));

const workspace: WorkspaceInfo = {
  id: "workspace-1",
  name: "CodexMonitor",
  path: "/tmp/codex",
  connected: true,
  settings: { sidebarCollapsed: false },
};

describe("useGitLog", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("suppresses console error noise for non-git workspaces while surfacing the state error", async () => {
    vi.mocked(getGitLog).mockRejectedValueOnce(new Error("fatal: not a git repository"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const { result } = renderHook(() => useGitLog(workspace, true));

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.error).toBe("fatal: not a git repository");
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("still logs unexpected git log failures", async () => {
    vi.mocked(getGitLog).mockRejectedValueOnce(new Error("transport offline"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const { result } = renderHook(() => useGitLog(workspace, true));

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.error).toBe("transport offline");
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("suppresses runtime availability noise while keeping the git log error state", async () => {
    vi.mocked(getGitLog).mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const { result } = renderHook(() => useGitLog(workspace, true));

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.error).toBe("Failed to fetch");
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
