import { invoke, isDesktopHostRuntime } from "@desktop-host/core";
import { listen } from "@desktop-host/event";
import { open } from "@desktop-host/dialogs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  detectRuntimeMode,
  getRuntimeClient,
  readRuntimeCapabilitiesSummary,
} from "./runtimeClient";
import {
  __resetLocalUsageSnapshotCacheForTests,
  __resetWebRuntimeOauthFallbackStateForTests,
  addClone,
  addWorkspace,
  addWorktree,
  connectWorkspace,
  isWorkspacePathDir,
  pickImageFiles,
  pickWorkspacePath,
  pickWorkspacePaths,
  removeWorkspace,
  removeWorktree,
  renameWorktree,
  renameWorktreeUpstream,
  updateWorkspaceCodexBin,
  updateWorkspaceSettings,
} from "../test/shims/desktopHostServices";

vi.mock("@desktop-host/core", () => ({
  invoke: vi.fn(),
  isDesktopHostRuntime: vi.fn(() => true),
}));

vi.mock("@desktop-host/event", () => ({
  listen: vi.fn(),
}));

vi.mock("@desktop-host/dialogs", () => ({
  open: vi.fn(),
}));

vi.mock("@desktop-host/notifications", () => ({
  isPermissionGranted: vi.fn(),
  requestPermission: vi.fn(),
  sendNotification: vi.fn(),
}));

vi.mock("./runtimeClient", () => ({
  detectRuntimeMode: vi.fn(() => "electron-bridge"),
  getRuntimeClient: vi.fn(),
  readRuntimeCapabilitiesSummary: vi.fn(),
}));

describe("desktop host invoke wrappers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    __resetWebRuntimeOauthFallbackStateForTests();
    __resetLocalUsageSnapshotCacheForTests();
    localStorage.clear();
    const invokeMock = vi.mocked(invoke);
    vi.mocked(listen).mockResolvedValue(async () => undefined);
    vi.mocked(isDesktopHostRuntime).mockReturnValue(true);
    invokeMock.mockImplementation(async (command: string) => {
      if (command === "is_macos_debug_build") {
        return false;
      }
      return undefined;
    });
    vi.mocked(getRuntimeClient).mockImplementation(() => {
      throw new Error("runtime unavailable");
    });
    vi.mocked(detectRuntimeMode).mockReturnValue("electron-bridge");
    vi.mocked(readRuntimeCapabilitiesSummary).mockResolvedValue({
      mode: "electron-bridge",
      methods: [],
      features: [],
      wsEndpointPath: null,
      error: null,
    });
  });

  it("routes addWorkspace through runtime workspaceCreate", async () => {
    const invokeMock = vi.mocked(invoke);
    const runtimeWorkspaceCreateMock = vi.fn().mockResolvedValue({
      id: "ws-1",
      path: "/tmp/project",
      displayName: "project",
      connected: true,
      defaultModelId: null,
    });
    vi.mocked(getRuntimeClient).mockReturnValue({
      workspaceCreate: runtimeWorkspaceCreateMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await addWorkspace("/tmp/project", null);

    expect(runtimeWorkspaceCreateMock).toHaveBeenCalledWith("/tmp/project", null);
    expect(invokeMock).not.toHaveBeenCalledWith("add_workspace", {
      path: "/tmp/project",
      codex_bin: null,
    });
  });

  it("does not fall back to legacy add_workspace invoke when runtime workspaceCreate fails", async () => {
    const invokeMock = vi.mocked(invoke);
    const runtimeWorkspaceCreateMock = vi
      .fn()
      .mockRejectedValue(new Error("runtime workspace create failed"));
    vi.mocked(getRuntimeClient).mockReturnValue({
      workspaceCreate: runtimeWorkspaceCreateMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(addWorkspace("/tmp/project", null)).rejects.toThrow(
      "runtime workspace create failed"
    );
    expect(invokeMock).not.toHaveBeenCalledWith("add_workspace", expect.anything());
  });

  it("uses runtime workspaceCreate in runtime-gateway-web mode", async () => {
    vi.mocked(isDesktopHostRuntime).mockReturnValue(false);
    vi.mocked(detectRuntimeMode).mockReturnValue("runtime-gateway-web");
    const runtimeWorkspaceCreateMock = vi.fn().mockResolvedValue({
      id: "ws-web-1",
      path: "/tmp/web-project",
      displayName: "web-project",
      connected: true,
      defaultModelId: null,
    });
    vi.mocked(getRuntimeClient).mockReturnValue({
      workspaceCreate: runtimeWorkspaceCreateMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(addWorkspace("/tmp/web-project", null)).resolves.toEqual(
      expect.objectContaining({
        id: "ws-web-1",
        path: "/tmp/web-project",
      })
    );
    expect(runtimeWorkspaceCreateMock).toHaveBeenCalledWith("/tmp/web-project", null);
  });

  it("falls back to direct web RPC workspaceCreate when runtime client create fails", async () => {
    vi.mocked(isDesktopHostRuntime).mockReturnValue(false);
    vi.mocked(detectRuntimeMode).mockReturnValue("runtime-gateway-web");
    vi.stubEnv("VITE_CODE_RUNTIME_GATEWAY_WEB_ENDPOINT", "http://127.0.0.1:8788/rpc");
    const runtimeWorkspaceCreateMock = vi
      .fn()
      .mockRejectedValue(new Error("Runtime RPC compatFieldAliases mismatch"));
    vi.mocked(getRuntimeClient).mockReturnValue({
      workspaceCreate: runtimeWorkspaceCreateMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        result: {
          id: "ws-web-fallback",
          path: "/tmp/web-fallback",
          displayName: "web-fallback",
          connected: true,
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const workspace = await addWorkspace("/tmp/web-fallback", null);

    expect(workspace).toEqual(
      expect.objectContaining({
        id: "ws-web-fallback",
        path: "/tmp/web-fallback",
      })
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not fall back to legacy remove_workspace invoke when runtime workspaceRemove fails", async () => {
    const invokeMock = vi.mocked(invoke);
    const runtimeWorkspaceRemoveMock = vi
      .fn()
      .mockRejectedValue(new Error("runtime workspace remove failed"));
    vi.mocked(getRuntimeClient).mockReturnValue({
      workspaceRemove: runtimeWorkspaceRemoveMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(removeWorkspace("ws-remove-1")).rejects.toThrow("runtime workspace remove failed");
    expect(runtimeWorkspaceRemoveMock).toHaveBeenCalledWith("ws-remove-1");
    expect(invokeMock).not.toHaveBeenCalledWith("remove_workspace", expect.anything());
  });

  it("uses runtime workspaceRemove in runtime-gateway-web mode", async () => {
    vi.mocked(isDesktopHostRuntime).mockReturnValue(false);
    vi.mocked(detectRuntimeMode).mockReturnValue("runtime-gateway-web");
    const runtimeWorkspaceRemoveMock = vi.fn().mockResolvedValue(true);
    vi.mocked(getRuntimeClient).mockReturnValue({
      workspaceRemove: runtimeWorkspaceRemoveMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(removeWorkspace("ws-remove-web")).resolves.toBeUndefined();
    expect(runtimeWorkspaceRemoveMock).toHaveBeenCalledWith("ws-remove-web");
  });

  it("does not fall back to legacy connect_workspace invoke when runtime workspaces lookup fails", async () => {
    const invokeMock = vi.mocked(invoke);
    const runtimeWorkspacesMock = vi.fn().mockRejectedValue(new Error("runtime workspaces failed"));
    vi.mocked(getRuntimeClient).mockReturnValue({
      workspaces: runtimeWorkspacesMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(connectWorkspace("ws-connect-1")).rejects.toThrow("runtime workspaces failed");
    expect(invokeMock).not.toHaveBeenCalledWith("connect_workspace", expect.anything());
  });

  it("does not fall back to mock connectWorkspace when runtime lookup fails in runtime-gateway-web mode", async () => {
    vi.mocked(isDesktopHostRuntime).mockReturnValue(false);
    vi.mocked(detectRuntimeMode).mockReturnValue("runtime-gateway-web");
    const runtimeWorkspacesMock = vi.fn().mockRejectedValue(new Error("runtime workspaces failed"));
    vi.mocked(getRuntimeClient).mockReturnValue({
      workspaces: runtimeWorkspacesMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(connectWorkspace("ws-connect-web")).rejects.toThrow("runtime workspaces failed");
  });

  it("does not use clone fallback in runtime-gateway-web mode", async () => {
    vi.mocked(isDesktopHostRuntime).mockReturnValue(false);
    vi.mocked(detectRuntimeMode).mockReturnValue("runtime-gateway-web");

    await expect(addClone("ws-source", "/tmp/copies", "copy-a")).rejects.toThrow(
      "Workspace cloning is only available in Desktop host runtime."
    );
  });

  it("does not use worktree creation fallback in runtime-gateway-web mode", async () => {
    vi.mocked(isDesktopHostRuntime).mockReturnValue(false);
    vi.mocked(detectRuntimeMode).mockReturnValue("runtime-gateway-web");

    await expect(addWorktree("ws-parent", "feature/new", null)).rejects.toThrow(
      "Worktree creation is only available in Desktop host runtime."
    );
  });

  it("does not use worktree removal fallback in runtime-gateway-web mode", async () => {
    vi.mocked(isDesktopHostRuntime).mockReturnValue(false);
    vi.mocked(detectRuntimeMode).mockReturnValue("runtime-gateway-web");

    await expect(removeWorktree("wt-remove")).rejects.toThrow(
      "Worktree removal is only available in Desktop host runtime."
    );
  });

  it("does not use worktree rename fallback in runtime-gateway-web mode", async () => {
    vi.mocked(isDesktopHostRuntime).mockReturnValue(false);
    vi.mocked(detectRuntimeMode).mockReturnValue("runtime-gateway-web");

    await expect(renameWorktree("wt-rename", "feature/new-name")).rejects.toThrow(
      "Worktree rename is only available in Desktop host runtime."
    );
  });

  it("does not silently skip upstream worktree rename in runtime-gateway-web mode", async () => {
    vi.mocked(isDesktopHostRuntime).mockReturnValue(false);
    vi.mocked(detectRuntimeMode).mockReturnValue("runtime-gateway-web");

    await expect(
      renameWorktreeUpstream("wt-upstream", "feature/old", "feature/new")
    ).rejects.toThrow("Upstream worktree rename is unavailable outside the desktop host.");
  });

  it("does not use workspace settings fallback in runtime-gateway-web mode", async () => {
    vi.mocked(isDesktopHostRuntime).mockReturnValue(false);
    vi.mocked(detectRuntimeMode).mockReturnValue("runtime-gateway-web");

    await expect(
      updateWorkspaceSettings("ws-settings-web", {
        sidebarCollapsed: false,
        sortOrder: null,
        groupId: null,
        gitRoot: null,
        codexHome: null,
        codexArgs: null,
        launchScript: null,
        launchScripts: null,
        worktreeSetupScript: null,
      })
    ).rejects.toThrow("Workspace settings update is only available in Desktop host runtime.");
  });

  it("does not use workspace codex bin fallback in runtime-gateway-web mode", async () => {
    vi.mocked(isDesktopHostRuntime).mockReturnValue(false);
    vi.mocked(detectRuntimeMode).mockReturnValue("runtime-gateway-web");

    await expect(updateWorkspaceCodexBin("ws-codex-web", "codex-cli")).rejects.toThrow(
      "Workspace codex bin update is only available in Desktop host runtime."
    );
  });

  it("does not use workspace path validation fallback in runtime-gateway-web mode", async () => {
    vi.mocked(isDesktopHostRuntime).mockReturnValue(false);
    vi.mocked(detectRuntimeMode).mockReturnValue("runtime-gateway-web");
    const invokeMock = vi.mocked(invoke);

    await expect(isWorkspacePathDir("/tmp/workspace")).rejects.toThrow(
      "Workspace path validation is only available in Desktop host runtime."
    );
    expect(invokeMock).not.toHaveBeenCalledWith("is_workspace_path_dir", expect.anything());
  });

  it("returns an empty list when workspace picker is cancelled", async () => {
    const openMock = vi.mocked(open);
    openMock.mockResolvedValueOnce(null);

    await expect(pickWorkspacePaths()).resolves.toEqual([]);
  });

  it("returns null when workspace picker bridge is unavailable", async () => {
    const openMock = vi.mocked(open);
    openMock.mockRejectedValueOnce(
      new TypeError("Cannot read properties of undefined (reading 'invoke')")
    );

    await expect(pickWorkspacePath()).resolves.toBeNull();
  });

  it("returns null when workspace picker command is unavailable", async () => {
    const openMock = vi.mocked(open);
    openMock.mockRejectedValueOnce(new Error("unknown command: plugin:dialog|open"));

    await expect(pickWorkspacePath()).resolves.toBeNull();
  });

  it("does not use browser directory picker fallback for single workspace selection in web mode", async () => {
    vi.mocked(isDesktopHostRuntime).mockReturnValue(false);
    vi.mocked(open).mockRejectedValueOnce(
      new TypeError("Cannot read properties of undefined (reading 'invoke')")
    );
    const showDirectoryPicker = vi.fn().mockResolvedValue({ name: "project-folder" });
    Object.defineProperty(window, "showDirectoryPicker", {
      value: showDirectoryPicker,
      configurable: true,
    });

    await expect(pickWorkspacePath()).resolves.toBeNull();
    expect(showDirectoryPicker).not.toHaveBeenCalled();
  });

  it("uses runtime workspace picker for single selection in runtime-gateway-web mode", async () => {
    vi.mocked(isDesktopHostRuntime).mockReturnValue(false);
    vi.mocked(detectRuntimeMode).mockReturnValue("runtime-gateway-web");
    const workspacePickDirectoryMock = vi.fn().mockResolvedValue("/tmp/runtime-workspace");
    vi.mocked(getRuntimeClient).mockReturnValue({
      workspacePickDirectory: workspacePickDirectoryMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);
    const openMock = vi.mocked(open);

    await expect(pickWorkspacePath()).resolves.toBe("/tmp/runtime-workspace");
    expect(workspacePickDirectoryMock).toHaveBeenCalledTimes(1);
    expect(openMock).not.toHaveBeenCalled();
  });

  it("returns null for single selection in runtime-gateway-web mode when runtime picker is cancelled", async () => {
    vi.mocked(isDesktopHostRuntime).mockReturnValue(false);
    vi.mocked(detectRuntimeMode).mockReturnValue("runtime-gateway-web");
    const workspacePickDirectoryMock = vi.fn().mockResolvedValue(null);
    vi.mocked(getRuntimeClient).mockReturnValue({
      workspacePickDirectory: workspacePickDirectoryMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);
    const openMock = vi.mocked(open);

    await expect(pickWorkspacePath()).resolves.toBeNull();
    expect(workspacePickDirectoryMock).toHaveBeenCalledTimes(1);
    expect(openMock).not.toHaveBeenCalled();
  });

  it("falls back to direct web RPC workspace picker when runtime client picker fails", async () => {
    vi.mocked(isDesktopHostRuntime).mockReturnValue(false);
    vi.mocked(detectRuntimeMode).mockReturnValue("runtime-gateway-web");
    vi.stubEnv("VITE_CODE_RUNTIME_GATEWAY_WEB_ENDPOINT", "http://127.0.0.1:8788/rpc");
    const workspacePickDirectoryMock = vi
      .fn()
      .mockRejectedValue(new Error("Runtime RPC compatFieldAliases mismatch"));
    vi.mocked(getRuntimeClient).mockReturnValue({
      workspacePickDirectory: workspacePickDirectoryMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, result: "/tmp/runtime-rpc-picked" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const openMock = vi.mocked(open);

    await expect(pickWorkspacePath()).resolves.toBe("/tmp/runtime-rpc-picked");
    expect(workspacePickDirectoryMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(openMock).not.toHaveBeenCalled();
  });

  it("surfaces upgrade guidance when runtime picker RPC is unsupported", async () => {
    vi.mocked(isDesktopHostRuntime).mockReturnValue(false);
    vi.mocked(detectRuntimeMode).mockReturnValue("runtime-gateway-web");
    vi.stubEnv("VITE_CODE_RUNTIME_GATEWAY_WEB_ENDPOINT", "http://127.0.0.1:8788/rpc");
    const workspacePickDirectoryMock = vi
      .fn()
      .mockRejectedValue(new Error("Runtime RPC compatFieldAliases mismatch"));
    vi.mocked(getRuntimeClient).mockReturnValue({
      workspacePickDirectory: workspacePickDirectoryMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: false,
        error: { message: "Unsupported RPC method: code_workspace_pick_directory" },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(pickWorkspacePath()).rejects.toThrow(
      "Runtime does not support workspace directory picker"
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("wraps a single workspace selection in an array", async () => {
    const openMock = vi.mocked(open);
    openMock.mockResolvedValueOnce("/tmp/project");

    await expect(pickWorkspacePaths()).resolves.toEqual(["/tmp/project"]);
  });

  it("returns multiple workspace selections as-is", async () => {
    const openMock = vi.mocked(open);
    openMock.mockResolvedValueOnce(["/tmp/one", "/tmp/two"]);

    await expect(pickWorkspacePaths()).resolves.toEqual(["/tmp/one", "/tmp/two"]);
  });

  it("returns empty workspace selections when picker bridge is unavailable", async () => {
    const openMock = vi.mocked(open);
    openMock.mockRejectedValueOnce(
      new TypeError("window.__HUGE_CODE_DESKTOP_HOST_INTERNALS__.invoke is not a function")
    );

    await expect(pickWorkspacePaths()).resolves.toEqual([]);
  });

  it("returns empty workspace selections when picker command is unavailable", async () => {
    const openMock = vi.mocked(open);
    openMock.mockRejectedValueOnce(new Error("unknown command: plugin:dialog|open"));

    await expect(pickWorkspacePaths()).resolves.toEqual([]);
  });

  it("uses runtime workspace picker for multi-selection in runtime-gateway-web mode", async () => {
    vi.mocked(isDesktopHostRuntime).mockReturnValue(false);
    vi.mocked(detectRuntimeMode).mockReturnValue("runtime-gateway-web");
    const workspacePickDirectoryMock = vi.fn().mockResolvedValue("/tmp/runtime-multi");
    vi.mocked(getRuntimeClient).mockReturnValue({
      workspacePickDirectory: workspacePickDirectoryMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);
    const openMock = vi.mocked(open);

    await expect(pickWorkspacePaths()).resolves.toEqual(["/tmp/runtime-multi"]);
    expect(workspacePickDirectoryMock).toHaveBeenCalledTimes(1);
    expect(openMock).not.toHaveBeenCalled();
  });

  it("returns empty multi-workspace selection in runtime-gateway-web mode when runtime picker is cancelled", async () => {
    vi.mocked(isDesktopHostRuntime).mockReturnValue(false);
    vi.mocked(detectRuntimeMode).mockReturnValue("runtime-gateway-web");
    const workspacePickDirectoryMock = vi.fn().mockResolvedValue(null);
    vi.mocked(getRuntimeClient).mockReturnValue({
      workspacePickDirectory: workspacePickDirectoryMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);
    const openMock = vi.mocked(open);

    await expect(pickWorkspacePaths()).resolves.toEqual([]);
    expect(workspacePickDirectoryMock).toHaveBeenCalledTimes(1);
    expect(openMock).not.toHaveBeenCalled();
  });

  it("does not use browser picker fallback for multi-selection in runtime-gateway-web mode", async () => {
    vi.mocked(isDesktopHostRuntime).mockReturnValue(false);
    vi.mocked(detectRuntimeMode).mockReturnValue("runtime-gateway-web");
    const workspacePickDirectoryMock = vi.fn().mockResolvedValue("/tmp/runtime-picked");
    vi.mocked(getRuntimeClient).mockReturnValue({
      workspacePickDirectory: workspacePickDirectoryMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);
    const showDirectoryPicker = vi.fn().mockResolvedValue({ name: "folder-only" });
    Object.defineProperty(window, "showDirectoryPicker", {
      value: showDirectoryPicker,
      configurable: true,
    });

    await expect(pickWorkspacePaths()).resolves.toEqual(["/tmp/runtime-picked"]);
    expect(workspacePickDirectoryMock).toHaveBeenCalledTimes(1);
    expect(showDirectoryPicker).not.toHaveBeenCalled();
  });

  it("does not use browser picker fallback for multi-selection in web mode", async () => {
    vi.mocked(isDesktopHostRuntime).mockReturnValue(false);
    vi.mocked(open).mockRejectedValueOnce(
      new TypeError("window.__HUGE_CODE_DESKTOP_HOST_INTERNALS__.invoke is not a function")
    );
    const showDirectoryPicker = vi.fn().mockResolvedValue({ name: "folder-only" });
    Object.defineProperty(window, "showDirectoryPicker", {
      value: showDirectoryPicker,
      configurable: true,
    });

    await expect(pickWorkspacePaths()).resolves.toEqual([]);
    expect(showDirectoryPicker).not.toHaveBeenCalled();
  });

  it("returns empty image selections when picker bridge is unavailable", async () => {
    const openMock = vi.mocked(open);
    openMock.mockRejectedValueOnce(
      new TypeError("window.__HUGE_CODE_DESKTOP_HOST_INTERNALS__.invoke is not a function")
    );

    await expect(pickImageFiles()).resolves.toEqual([]);
  });

  it("returns empty image selections when picker command is unavailable", async () => {
    const openMock = vi.mocked(open);
    openMock.mockRejectedValueOnce(new Error("unknown command: plugin:dialog|open"));

    await expect(pickImageFiles()).resolves.toEqual([]);
  });
});
