import { invoke, isTauri } from "@tauri-apps/api/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyWorktreeChanges,
  getOpenAppIcon,
  getWorktreeSetupStatus,
  markWorktreeSetupRan,
  openWorkspaceIn,
  renameWorktreeUpstream,
} from "./tauriDesktopWorkspace";

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

describe("tauriDesktopWorkspace", () => {
  it("maps invoke payloads for workspace desktop wrappers", async () => {
    invokeMock.mockResolvedValueOnce({ shouldRun: true, script: "./setup.sh" });
    invokeMock.mockResolvedValueOnce(undefined);
    invokeMock.mockResolvedValueOnce(undefined);
    invokeMock.mockResolvedValueOnce(undefined);
    invokeMock.mockResolvedValueOnce("data:image/png;base64,abc");

    await expect(getWorktreeSetupStatus("ws-1")).resolves.toEqual({
      shouldRun: true,
      script: "./setup.sh",
    });
    await expect(markWorktreeSetupRan("ws-1")).resolves.toBeUndefined();
    await expect(applyWorktreeChanges("ws-1")).resolves.toBeUndefined();
    await expect(
      openWorkspaceIn("/tmp/project", {
        command: "zed",
        args: ["--new-window"],
      })
    ).resolves.toBeUndefined();
    await expect(getOpenAppIcon("Zed")).resolves.toBe("data:image/png;base64,abc");

    expect(invokeMock).toHaveBeenNthCalledWith(1, "worktree_setup_status", { workspaceId: "ws-1" });
    expect(invokeMock).toHaveBeenNthCalledWith(2, "worktree_setup_mark_ran", {
      workspaceId: "ws-1",
    });
    expect(invokeMock).toHaveBeenNthCalledWith(3, "apply_worktree_changes", {
      workspaceId: "ws-1",
    });
    expect(invokeMock).toHaveBeenNthCalledWith(4, "open_workspace_in", {
      path: "/tmp/project",
      app: null,
      command: "zed",
      args: ["--new-window"],
    });
    expect(invokeMock).toHaveBeenNthCalledWith(5, "get_open_app_icon", { appName: "Zed" });
  });

  it("normalizes open_workspace_in defaults", async () => {
    invokeMock.mockResolvedValueOnce(undefined);

    await expect(openWorkspaceIn("/tmp/defaults", {})).resolves.toBeUndefined();

    expect(invokeMock).toHaveBeenCalledWith("open_workspace_in", {
      path: "/tmp/defaults",
      app: null,
      command: null,
      args: [],
    });
  });

  it("throws for open_workspace_in outside tauri runtime", async () => {
    isTauriMock.mockReturnValue(false);

    await expect(openWorkspaceIn("/tmp/defaults", {})).rejects.toThrow(
      "Open in is unavailable outside Tauri desktop runtime."
    );

    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("passes mac-style app launch targets through to the legacy open_workspace_in invoke", async () => {
    invokeMock.mockResolvedValueOnce(undefined);

    await expect(
      openWorkspaceIn("/tmp/antigravity", {
        appName: "Antigravity",
        args: ["--new-window"],
      })
    ).resolves.toBeUndefined();

    expect(invokeMock).toHaveBeenCalledWith("open_workspace_in", {
      path: "/tmp/antigravity",
      app: "Antigravity",
      command: null,
      args: ["--new-window"],
    });
  });

  it("throws for upstream worktree rename outside tauri runtime", async () => {
    isTauriMock.mockReturnValue(false);

    await expect(
      renameWorktreeUpstream("wt-upstream", "feature/old", "feature/new")
    ).rejects.toThrow("Upstream worktree rename is unavailable outside Tauri runtime.");

    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("invokes upstream worktree rename in tauri mode", async () => {
    invokeMock.mockResolvedValueOnce(undefined);

    await expect(
      renameWorktreeUpstream("wt-upstream", "feature/old", "feature/new")
    ).resolves.toBeUndefined();

    expect(invokeMock).toHaveBeenCalledWith("rename_worktree_upstream", {
      id: "wt-upstream",
      oldBranch: "feature/old",
      newBranch: "feature/new",
    });
  });
});
