import { invokeDesktopCommand } from "../application/runtime/ports/desktopHostCore";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getRuntimeClient } from "./runtimeClient";
import {
  getCodexConfigPathWithFallback,
  listCollaborationModesWithFallback,
  listMcpServerStatusWithFallback,
} from "./runtimeClientCodex";
import {
  compactThread,
  forkThread,
  generateRunMetadata,
  getRuntimeMiniProgramStatus,
  getCodexConfigPath,
  getCollaborationModes,
  getConfigModel,
  getGlobalPromptsDir,
  runRuntimeMiniProgramAction,
  getWorkspacePromptsDir,
  listMcpServerStatus,
  setThreadName,
} from "./desktopHostRpc";

vi.mock("../application/runtime/ports/desktopHostCore", () => ({
  invokeDesktopCommand: vi.fn(),
}));

vi.mock("./runtimeClient", () => ({
  getRuntimeClient: vi.fn(),
}));

vi.mock("./runtimeClientCodex", () => ({
  getCodexConfigPathWithFallback: vi.fn(),
  listCollaborationModesWithFallback: vi.fn(),
  listMcpServerStatusWithFallback: vi.fn(),
}));

const invokeMock = vi.mocked(invokeDesktopCommand);
const getRuntimeClientMock = vi.mocked(getRuntimeClient);
const getCodexConfigPathWithFallbackMock = vi.mocked(getCodexConfigPathWithFallback);
const listCollaborationModesWithFallbackMock = vi.mocked(listCollaborationModesWithFallback);
const listMcpServerStatusWithFallbackMock = vi.mocked(listMcpServerStatusWithFallback);
const runtimeClientMockInstance = {} as ReturnType<typeof getRuntimeClient>;

beforeEach(() => {
  vi.clearAllMocks();
  getRuntimeClientMock.mockReturnValue(runtimeClientMockInstance);
});

describe("desktopHostRpc", () => {
  it("routes codex config path through runtime client", async () => {
    invokeMock.mockResolvedValueOnce({ model: " gpt-5 " });
    getCodexConfigPathWithFallbackMock.mockResolvedValueOnce("/tmp/codex.toml");

    await expect(getCodexConfigPath()).resolves.toBe("/tmp/codex.toml");
    await expect(getConfigModel("ws-1")).resolves.toBe("gpt-5");

    expect(getCodexConfigPathWithFallbackMock).toHaveBeenCalledWith(runtimeClientMockInstance);
    expect(invokeMock).toHaveBeenCalledWith("get_config_model", {
      workspaceId: "ws-1",
    });
  });

  it("returns null when the desktop host invoke bridge is unavailable", async () => {
    invokeMock.mockRejectedValueOnce(
      new TypeError("Cannot read properties of undefined (reading 'invoke')")
    );

    await expect(getConfigModel("ws-bridge-missing")).resolves.toBeNull();
  });

  it("returns null when get_config_model is unavailable in the current runtime", async () => {
    invokeMock.mockRejectedValueOnce(new Error("unknown command `get_config_model`"));

    await expect(getConfigModel("ws-command-missing")).resolves.toBeNull();
  });

  it("maps thread bridge commands", async () => {
    invokeMock.mockResolvedValue({});

    await forkThread("ws-2", "thread-2");
    await compactThread("ws-2", "thread-2");
    await setThreadName("ws-2", "thread-2", "renamed");

    expect(invokeMock).toHaveBeenCalledWith("fork_thread", {
      workspaceId: "ws-2",
      threadId: "thread-2",
    });
    expect(invokeMock).toHaveBeenCalledWith("compact_thread", {
      workspaceId: "ws-2",
      threadId: "thread-2",
    });
    expect(invokeMock).toHaveBeenCalledWith("set_thread_name", {
      workspaceId: "ws-2",
      threadId: "thread-2",
      name: "renamed",
    });
  });

  it("maps metadata and prompts commands while routing collaboration through runtime client", async () => {
    invokeMock.mockResolvedValue({});
    listCollaborationModesWithFallbackMock.mockResolvedValue({ data: [], warnings: [] });

    await generateRunMetadata("ws-3", "implement parser");
    await getCollaborationModes("ws-3");
    await getWorkspacePromptsDir("ws-3");
    await getGlobalPromptsDir("ws-3");

    expect(invokeMock).toHaveBeenCalledWith("generate_run_metadata", {
      workspaceId: "ws-3",
      prompt: "implement parser",
    });
    expect(listCollaborationModesWithFallbackMock).toHaveBeenCalledWith(
      runtimeClientMockInstance,
      "ws-3"
    );
    expect(invokeMock).toHaveBeenCalledWith("prompts_workspace_dir", {
      workspaceId: "ws-3",
    });
    expect(invokeMock).toHaveBeenCalledWith("prompts_global_dir", {
      workspaceId: "ws-3",
    });
  });

  it("falls back to local metadata derivation when the desktop host invoke bridge is unavailable", async () => {
    invokeMock.mockRejectedValueOnce(
      new TypeError("Cannot read properties of undefined (reading 'invoke')")
    );

    await expect(
      generateRunMetadata("ws-web", "  Inspect nested app root from package.json  ")
    ).resolves.toEqual({
      title: "Inspect nested app root from package.json",
      worktreeName: "inspect-nested-app-root-from-package-json",
    });
  });

  it("routes mcp status through runtime client", async () => {
    listMcpServerStatusWithFallbackMock.mockResolvedValue({
      data: [],
      nextCursor: null,
      warnings: [],
    });

    await listMcpServerStatus("ws-4", "cursor-2", 50);

    expect(listMcpServerStatusWithFallbackMock).toHaveBeenCalledWith(runtimeClientMockInstance, {
      workspaceId: "ws-4",
      cursor: "cursor-2",
      limit: 50,
    });
  });

  it("routes mini program status and actions through runtime client", async () => {
    const miniProgramStatusV1 = vi.fn(async () => ({
      workspaceId: "ws-mini",
      available: true,
      status: "ready" as const,
      hostOs: "macos",
      devtoolsInstalled: true,
      cliPath: "/Applications/wechatwebdevtools.app/Contents/MacOS/cli",
      httpPort: 9421,
      serviceStatus: "running" as const,
      loginStatus: "logged_in" as const,
      project: {
        valid: true,
        projectConfigPath: "/tmp/project.config.json",
        appId: "wx123",
        projectName: "demo",
        miniprogramRoot: "src",
        pluginRoot: null,
        compileType: "miniprogram" as const,
      },
      miniprogramCi: {
        available: true,
        declared: true,
        packageRoot: "/tmp",
        version: "2.1.31",
      },
      supportedActions: ["open_project", "preview"],
      warnings: [],
    }));
    const miniProgramRunV1 = vi.fn(async () => ({
      workspaceId: "ws-mini",
      available: true,
      action: "preview" as const,
      status: "completed" as const,
      message: "Mini program action `preview` completed.",
      command: ["cli", "preview"],
      exitCode: 0,
      stdout: "preview ok",
      stderr: "",
      qrCode: null,
      info: null,
      warnings: [],
    }));

    getRuntimeClientMock.mockReturnValue({
      ...runtimeClientMockInstance,
      miniProgramStatusV1,
      miniProgramRunV1,
    });

    await expect(getRuntimeMiniProgramStatus("ws-mini")).resolves.toMatchObject({
      workspaceId: "ws-mini",
      status: "ready",
    });
    await expect(
      runRuntimeMiniProgramAction({
        workspaceId: "ws-mini",
        action: "preview",
        qrOutputMode: "base64",
      })
    ).resolves.toMatchObject({
      workspaceId: "ws-mini",
      action: "preview",
      status: "completed",
    });

    expect(miniProgramStatusV1).toHaveBeenCalledWith({ workspaceId: "ws-mini" });
    expect(miniProgramRunV1).toHaveBeenCalledWith({
      workspaceId: "ws-mini",
      action: "preview",
      qrOutputMode: "base64",
    });
  });
});
