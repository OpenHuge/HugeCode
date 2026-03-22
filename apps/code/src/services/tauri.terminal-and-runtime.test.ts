import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  detectRuntimeMode,
  getRuntimeClient,
  readRuntimeCapabilitiesSummary,
} from "./runtimeClient";
import {
  __resetLocalUsageSnapshotCacheForTests,
  __resetWebRuntimeOauthFallbackStateForTests,
  actionRequiredGetV2,
  actionRequiredSubmitV2,
  closeRuntimeTerminalSession,
  closeTerminalSession,
  distributedTaskGraph,
  getOpenAppIcon,
  getProvidersCatalog,
  getRuntimeCapabilitiesSummary,
  getWorkspaceFiles,
  interruptRuntimeTerminalSession,
  interruptTerminalSession,
  interruptTurn,
  installRuntimeExtension,
  openTerminalSession,
  openRuntimeTerminalSession,
  openWorkspaceIn,
  orbitConnectTest,
  orbitRunnerStart,
  orbitRunnerStatus,
  orbitRunnerStop,
  orbitSignInPoll,
  orbitSignInStart,
  orbitSignOut,
  netbirdDaemonCommandPreview,
  netbirdStatus,
  readAgentMd,
  readGlobalAgentsMd,
  readGlobalCodexConfigToml,
  readRuntimeTerminalSession,
  readTerminalSession,
  readWorkspaceFile,
  resizeRuntimeTerminalSession,
  resizeTerminalSession,
  removeRuntimeExtension,
  runtimeBackendRemove,
  runtimeBackendSetState,
  runtimeBackendsList,
  runtimeBackendUpsert,
  runtimeDiagnosticsExportV1,
  runtimeSecurityPreflightV1,
  runtimeSessionDeleteV1,
  runtimeSessionExportV1,
  runtimeSessionImportV1,
  runtimeToolGuardrailEvaluate,
  runtimeToolGuardrailRead,
  runtimeToolGuardrailRecordOutcome,
  runtimeToolMetricsRead,
  runtimeToolMetricsRecord,
  runtimeToolMetricsReset,
  sendUserMessage,
  startTerminalSessionStream,
  stopTerminalSessionStream,
  tailscaleDaemonCommandPreview,
  tailscaleDaemonStart,
  tailscaleDaemonStatus,
  tailscaleDaemonStop,
  tailscaleStatus,
  writeAgentMd,
  writeGlobalAgentsMd,
  writeGlobalCodexConfigToml,
  writeRuntimeTerminalSession,
  writeTerminalSession,
  writeTerminalSessionRaw,
} from "./tauri";
import {
  cancelRuntimeJob,
  submitRuntimeJobApprovalDecision,
  listRuntimeJobs,
  startRuntimeJob,
  subscribeRuntimeJob,
} from "./tauriRuntimeJobsBridge";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
  isTauri: vi.fn(() => true),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-notification", () => ({
  isPermissionGranted: vi.fn(),
  requestPermission: vi.fn(),
  sendNotification: vi.fn(),
}));

vi.mock("./runtimeClient", () => ({
  detectRuntimeMode: vi.fn(() => "tauri"),
  getRuntimeClient: vi.fn(),
  readRuntimeCapabilitiesSummary: vi.fn(),
}));

describe("tauri invoke wrappers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    __resetWebRuntimeOauthFallbackStateForTests();
    __resetLocalUsageSnapshotCacheForTests();
    localStorage.clear();
    const invokeMock = vi.mocked(invoke);
    vi.mocked(listen).mockResolvedValue(async () => undefined);
    vi.mocked(isTauri).mockReturnValue(true);
    invokeMock.mockImplementation(async (command: string) => {
      if (command === "is_macos_debug_build") {
        return false;
      }
      return undefined;
    });
    vi.mocked(getRuntimeClient).mockImplementation(() => {
      throw new Error("runtime unavailable");
    });
    vi.mocked(detectRuntimeMode).mockReturnValue("tauri");
    vi.mocked(readRuntimeCapabilitiesSummary).mockResolvedValue({
      mode: "tauri",
      methods: [],
      features: [],
      wsEndpointPath: null,
      error: null,
    });
  });

  it("does not fall back to invoke when runtime providers catalog fails", async () => {
    const invokeMock = vi.mocked(invoke);
    const runtimeProvidersCatalogMock = vi
      .fn()
      .mockRejectedValue(new Error("runtime providers catalog failed"));
    vi.mocked(getRuntimeClient).mockReturnValue({
      providersCatalog: runtimeProvidersCatalogMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(getProvidersCatalog()).rejects.toThrow("runtime providers catalog failed");
    expect(invokeMock).not.toHaveBeenCalledWith("code_providers_catalog", expect.anything());
  });

  it("returns an empty providers catalog when web runtime providers call hangs", async () => {
    vi.mocked(isTauri).mockReturnValue(false);
    const runtimeProvidersCatalogMock = vi.fn(
      () =>
        new Promise<unknown>(() => undefined) as Promise<
          Awaited<ReturnType<typeof getProvidersCatalog>>
        >
    );
    vi.mocked(getRuntimeClient).mockReturnValue({
      providersCatalog: runtimeProvidersCatalogMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    vi.useFakeTimers();
    try {
      const providersPromise = getProvidersCatalog();
      await vi.advanceTimersByTimeAsync(2_100);
      await expect(providersPromise).resolves.toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("skips repeated runtime providers catalog calls during cooldown after timeout", async () => {
    vi.mocked(isTauri).mockReturnValue(false);
    const runtimeProvidersCatalogMock = vi.fn(
      () =>
        new Promise<unknown>(() => undefined) as Promise<
          Awaited<ReturnType<typeof getProvidersCatalog>>
        >
    );
    vi.mocked(getRuntimeClient).mockReturnValue({
      providersCatalog: runtimeProvidersCatalogMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    vi.useFakeTimers();
    try {
      const firstPromise = getProvidersCatalog();
      await vi.advanceTimersByTimeAsync(2_100);
      await expect(firstPromise).resolves.toEqual([]);
      await expect(getProvidersCatalog()).resolves.toEqual([]);
      expect(runtimeProvidersCatalogMock).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("dedupes concurrent web providers catalog calls", async () => {
    vi.mocked(isTauri).mockReturnValue(false);
    const sharedProviders = [
      {
        oauthProviderId: "codex",
        displayName: "OpenAI",
        available: true,
        supportsNative: true,
        supportsOpenaiCompat: true,
        registryVersion: "2026-02-17",
      },
    ] as Awaited<ReturnType<typeof getProvidersCatalog>>;
    let resolveProviders!: (value: Awaited<ReturnType<typeof getProvidersCatalog>>) => void;
    const pendingProvidersPromise = new Promise<Awaited<ReturnType<typeof getProvidersCatalog>>>(
      (resolve) => {
        resolveProviders = resolve;
      }
    );
    const runtimeProvidersCatalogMock = vi.fn(() => pendingProvidersPromise);
    vi.mocked(getRuntimeClient).mockReturnValue({
      providersCatalog: runtimeProvidersCatalogMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    const firstPromise = getProvidersCatalog();
    const secondPromise = getProvidersCatalog();

    expect(runtimeProvidersCatalogMock).toHaveBeenCalledTimes(1);
    resolveProviders(sharedProviders);
    await expect(Promise.all([firstPromise, secondPromise])).resolves.toEqual([
      sharedProviders,
      sharedProviders,
    ]);
  });

  it("routes workspace file APIs through runtime file endpoints", async () => {
    const invokeMock = vi.mocked(invoke);
    const runtimeWorkspaceFilesMock = vi.fn().mockResolvedValue([
      { id: "file-1", path: "src/main.ts", summary: "Main entry" },
      { id: "file-2", path: "README.md", summary: "Readme" },
    ]);
    const runtimeWorkspaceFileReadMock = vi.fn().mockResolvedValue({
      id: "file-1",
      path: "src/main.ts",
      summary: "Main entry",
      content: "console.log('hi');",
    });
    vi.mocked(getRuntimeClient).mockReturnValue({
      workspaceFiles: runtimeWorkspaceFilesMock,
      workspaceFileRead: runtimeWorkspaceFileReadMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(getWorkspaceFiles("ws-files-1")).resolves.toEqual(["src/main.ts", "README.md"]);
    await expect(readWorkspaceFile("ws-files-1", "src/main.ts")).resolves.toEqual({
      content: "console.log('hi');",
      truncated: false,
    });

    expect(runtimeWorkspaceFilesMock).toHaveBeenCalledTimes(1);
    expect(runtimeWorkspaceFilesMock).toHaveBeenCalledWith("ws-files-1");
    expect(runtimeWorkspaceFileReadMock).toHaveBeenCalledWith("ws-files-1", "file-1");
    expect(invokeMock).not.toHaveBeenCalledWith("list_workspace_files", expect.anything());
    expect(invokeMock).not.toHaveBeenCalledWith("read_workspace_file", expect.anything());
  });

  it("does not fall back to legacy workspace file invoke when runtime file APIs fail", async () => {
    const invokeMock = vi.mocked(invoke);
    const runtimeWorkspaceFilesMock = vi
      .fn()
      .mockRejectedValue(new Error("runtime workspace files failed"));
    vi.mocked(getRuntimeClient).mockReturnValue({
      workspaceFiles: runtimeWorkspaceFilesMock,
      workspaceFileRead: vi.fn(),
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(getWorkspaceFiles("ws-files-2")).rejects.toThrow("runtime workspace files failed");
    await expect(readWorkspaceFile("ws-files-2", "src/main.ts")).rejects.toThrow(
      "runtime workspace files failed"
    );
    expect(invokeMock).not.toHaveBeenCalledWith("list_workspace_files", expect.anything());
    expect(invokeMock).not.toHaveBeenCalledWith("read_workspace_file", expect.anything());
  });

  it("opens terminal via runtime and keeps legacy terminal id", async () => {
    const invokeMock = vi.mocked(invoke);
    const runtimeTerminalOpenMock = vi.fn().mockResolvedValue({
      id: "runtime-session-1",
      workspaceId: "ws-terminal-1",
      state: "created",
      createdAt: 1,
      updatedAt: 2,
      lines: [],
    });
    const runtimeTerminalResizeMock = vi.fn().mockResolvedValue(true);
    vi.mocked(getRuntimeClient).mockReturnValue({
      terminalOpen: runtimeTerminalOpenMock,
      terminalResize: runtimeTerminalResizeMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(
      openTerminalSession("ws-terminal-1", "legacy-terminal-1", 120, 40)
    ).resolves.toEqual({
      id: "legacy-terminal-1",
      initialLines: [],
      state: "created",
    });

    expect(runtimeTerminalOpenMock).toHaveBeenCalledWith("ws-terminal-1");
    expect(runtimeTerminalResizeMock).toHaveBeenCalledWith("runtime-session-1", 40, 120);
    expect(invokeMock).not.toHaveBeenCalledWith("terminal_open", expect.anything());
  });

  it("does not fall back to invoke when runtime terminal open fails", async () => {
    const invokeMock = vi.mocked(invoke);
    const runtimeTerminalOpenMock = vi.fn().mockRejectedValue(new Error("runtime failed"));
    vi.mocked(getRuntimeClient).mockReturnValue({
      terminalOpen: runtimeTerminalOpenMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(openTerminalSession("ws-terminal-2", "legacy-terminal-2", 80, 24)).rejects.toThrow(
      "runtime failed"
    );
    expect(invokeMock).not.toHaveBeenCalledWith("terminal_open", expect.anything());
  });

  it("routes terminal write/resize/close through mapped runtime session id", async () => {
    const invokeMock = vi.mocked(invoke);
    const runtimeTerminalOpenMock = vi.fn().mockResolvedValue({
      id: "runtime-session-3",
      workspaceId: "ws-terminal-3",
      state: "created",
      createdAt: 1,
      updatedAt: 2,
      lines: [],
    });
    const runtimeTerminalResizeMock = vi.fn().mockResolvedValue(true);
    const runtimeTerminalWriteMock = vi.fn().mockResolvedValue({ id: "runtime-session-3" });
    const runtimeTerminalCloseMock = vi.fn().mockResolvedValue(true);
    vi.mocked(getRuntimeClient).mockReturnValue({
      terminalOpen: runtimeTerminalOpenMock,
      terminalResize: runtimeTerminalResizeMock,
      terminalWrite: runtimeTerminalWriteMock,
      terminalClose: runtimeTerminalCloseMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await openTerminalSession("ws-terminal-3", "legacy-terminal-3", 100, 30);
    await writeTerminalSession("ws-terminal-3", "legacy-terminal-3", "echo hi\n");
    await resizeTerminalSession("ws-terminal-3", "legacy-terminal-3", 140, 50);
    await closeTerminalSession("ws-terminal-3", "legacy-terminal-3");

    expect(runtimeTerminalWriteMock).toHaveBeenCalledWith("runtime-session-3", "echo hi\n");
    expect(runtimeTerminalResizeMock).toHaveBeenNthCalledWith(2, "runtime-session-3", 50, 140);
    expect(runtimeTerminalCloseMock).toHaveBeenCalledWith("runtime-session-3");
    expect(invokeMock).not.toHaveBeenCalledWith("terminal_write", expect.anything());
    expect(invokeMock).not.toHaveBeenCalledWith("terminal_resize", expect.anything());
    expect(invokeMock).not.toHaveBeenCalledWith("terminal_close", expect.anything());
  });

  it("routes terminal raw/read/stream/interrupt through mapped runtime session id", async () => {
    const runtimeTerminalOpenMock = vi.fn().mockResolvedValue({
      id: "runtime-session-raw-1",
      workspaceId: "ws-terminal-raw-1",
      state: "created",
      createdAt: 1,
      updatedAt: 2,
      lines: [],
    });
    const runtimeTerminalResizeMock = vi.fn().mockResolvedValue(true);
    const runtimeTerminalInputRawMock = vi.fn().mockResolvedValue(true);
    const runtimeTerminalReadMock = vi.fn().mockResolvedValue({
      id: "runtime-session-raw-1",
      workspaceId: "ws-terminal-raw-1",
      state: "created",
      createdAt: 1,
      updatedAt: 2,
      lines: ["$ pwd", "/tmp/project"],
    });
    const runtimeTerminalStreamStartMock = vi.fn().mockResolvedValue(true);
    const runtimeTerminalStreamStopMock = vi.fn().mockResolvedValue(true);
    const runtimeTerminalInterruptMock = vi.fn().mockResolvedValue(true);
    const runtimeTerminalCloseMock = vi.fn().mockResolvedValue(true);
    vi.mocked(getRuntimeClient).mockReturnValue({
      terminalOpen: runtimeTerminalOpenMock,
      terminalResize: runtimeTerminalResizeMock,
      terminalInputRaw: runtimeTerminalInputRawMock,
      terminalRead: runtimeTerminalReadMock,
      terminalStreamStart: runtimeTerminalStreamStartMock,
      terminalStreamStop: runtimeTerminalStreamStopMock,
      terminalInterrupt: runtimeTerminalInterruptMock,
      terminalClose: runtimeTerminalCloseMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await openTerminalSession("ws-terminal-raw-1", "legacy-terminal-raw-1", 120, 40);
    await writeTerminalSessionRaw("ws-terminal-raw-1", "legacy-terminal-raw-1", "\u0003");
    await readTerminalSession("ws-terminal-raw-1", "legacy-terminal-raw-1");
    await startTerminalSessionStream("ws-terminal-raw-1", "legacy-terminal-raw-1");
    await stopTerminalSessionStream("ws-terminal-raw-1", "legacy-terminal-raw-1");
    await interruptTerminalSession("ws-terminal-raw-1", "legacy-terminal-raw-1");
    await closeTerminalSession("ws-terminal-raw-1", "legacy-terminal-raw-1");

    expect(runtimeTerminalStreamStartMock).toHaveBeenCalledWith("runtime-session-raw-1");
    expect(runtimeTerminalInputRawMock).toHaveBeenCalledWith("runtime-session-raw-1", "\u0003");
    expect(runtimeTerminalReadMock).toHaveBeenCalledWith("runtime-session-raw-1");
    expect(runtimeTerminalStreamStopMock).toHaveBeenCalledWith("runtime-session-raw-1");
    expect(runtimeTerminalInterruptMock).toHaveBeenCalledWith("runtime-session-raw-1");
    expect(runtimeTerminalCloseMock).toHaveBeenCalledWith("runtime-session-raw-1");
  });

  it("does not fall back to invoke for write/resize/close when runtime session commands fail", async () => {
    const invokeMock = vi.mocked(invoke);
    const runtimeTerminalOpenMock = vi.fn().mockResolvedValue({
      id: "runtime-session-4",
      workspaceId: "ws-terminal-4",
      state: "created",
      createdAt: 1,
      updatedAt: 2,
      lines: [],
    });
    const runtimeTerminalResizeMock = vi
      .fn()
      .mockResolvedValueOnce(true)
      .mockRejectedValueOnce(new Error("resize failed"));
    const runtimeTerminalWriteMock = vi.fn().mockRejectedValue(new Error("write failed"));
    const runtimeTerminalCloseMock = vi.fn().mockRejectedValue(new Error("close failed"));
    vi.mocked(getRuntimeClient).mockReturnValue({
      terminalOpen: runtimeTerminalOpenMock,
      terminalResize: runtimeTerminalResizeMock,
      terminalWrite: runtimeTerminalWriteMock,
      terminalClose: runtimeTerminalCloseMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await openTerminalSession("ws-terminal-4", "legacy-terminal-4", 100, 30);
    await expect(
      writeTerminalSession("ws-terminal-4", "legacy-terminal-4", "pwd\n")
    ).rejects.toThrow("write failed");
    await expect(
      resizeTerminalSession("ws-terminal-4", "legacy-terminal-4", 150, 60)
    ).rejects.toThrow("resize failed");
    await expect(closeTerminalSession("ws-terminal-4", "legacy-terminal-4")).rejects.toThrow(
      "close failed"
    );

    expect(invokeMock).not.toHaveBeenCalledWith("terminal_write", expect.anything());
    expect(invokeMock).not.toHaveBeenCalledWith("terminal_resize", expect.anything());
    expect(invokeMock).not.toHaveBeenCalledWith("terminal_close", expect.anything());
  });

  it("routes direct runtime terminal session wrappers through runtime client without legacy ids", async () => {
    const invokeMock = vi.mocked(invoke);
    const runtimeTerminalOpenMock = vi.fn().mockResolvedValue({
      id: "runtime-session-direct-1",
      workspaceId: "ws-runtime-terminal-1",
      state: "created",
      createdAt: 1,
      updatedAt: 2,
      lines: ["$"],
    });
    const runtimeTerminalReadMock = vi.fn().mockResolvedValue({
      id: "runtime-session-direct-1",
      workspaceId: "ws-runtime-terminal-1",
      state: "created",
      createdAt: 1,
      updatedAt: 3,
      lines: ["$ pwd", "/tmp/project"],
    });
    const runtimeTerminalWriteMock = vi.fn().mockResolvedValue({
      id: "runtime-session-direct-1",
      workspaceId: "ws-runtime-terminal-1",
      state: "created",
      createdAt: 1,
      updatedAt: 4,
      lines: ["$ pwd", "/tmp/project"],
    });
    const runtimeTerminalInterruptMock = vi.fn().mockResolvedValue(true);
    const runtimeTerminalResizeMock = vi.fn().mockResolvedValue(true);
    const runtimeTerminalCloseMock = vi.fn().mockResolvedValue(true);
    vi.mocked(getRuntimeClient).mockReturnValue({
      terminalOpen: runtimeTerminalOpenMock,
      terminalRead: runtimeTerminalReadMock,
      terminalWrite: runtimeTerminalWriteMock,
      terminalInterrupt: runtimeTerminalInterruptMock,
      terminalResize: runtimeTerminalResizeMock,
      terminalClose: runtimeTerminalCloseMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(openRuntimeTerminalSession("ws-runtime-terminal-1")).resolves.toMatchObject({
      id: "runtime-session-direct-1",
    });
    await expect(readRuntimeTerminalSession("runtime-session-direct-1")).resolves.toMatchObject({
      id: "runtime-session-direct-1",
    });
    await expect(
      writeRuntimeTerminalSession({
        sessionId: "runtime-session-direct-1",
        input: "pwd\n",
      })
    ).resolves.toMatchObject({
      id: "runtime-session-direct-1",
    });
    await expect(interruptRuntimeTerminalSession("runtime-session-direct-1")).resolves.toBe(true);
    await expect(
      resizeRuntimeTerminalSession({
        sessionId: "runtime-session-direct-1",
        rows: 40,
        cols: 120,
      })
    ).resolves.toBe(true);
    await expect(closeRuntimeTerminalSession("runtime-session-direct-1")).resolves.toBe(true);

    expect(runtimeTerminalOpenMock).toHaveBeenCalledWith("ws-runtime-terminal-1");
    expect(runtimeTerminalReadMock).toHaveBeenCalledWith("runtime-session-direct-1");
    expect(runtimeTerminalWriteMock).toHaveBeenCalledWith("runtime-session-direct-1", "pwd\n");
    expect(runtimeTerminalInterruptMock).toHaveBeenCalledWith("runtime-session-direct-1");
    expect(runtimeTerminalResizeMock).toHaveBeenCalledWith("runtime-session-direct-1", 40, 120);
    expect(runtimeTerminalCloseMock).toHaveBeenCalledWith("runtime-session-direct-1");
    expect(invokeMock).not.toHaveBeenCalledWith("terminal_open", expect.anything());
    expect(invokeMock).not.toHaveBeenCalledWith("terminal_write", expect.anything());
    expect(invokeMock).not.toHaveBeenCalledWith("terminal_close", expect.anything());
  });

  it("does not fall back to invoke when direct runtime terminal session wrappers fail", async () => {
    const invokeMock = vi.mocked(invoke);
    const runtimeTerminalOpenMock = vi.fn().mockRejectedValue(new Error("open direct failed"));
    const runtimeTerminalWriteMock = vi.fn().mockRejectedValue(new Error("write direct failed"));
    vi.mocked(getRuntimeClient).mockReturnValue({
      terminalOpen: runtimeTerminalOpenMock,
      terminalWrite: runtimeTerminalWriteMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(openRuntimeTerminalSession("ws-runtime-terminal-2")).rejects.toThrow(
      "open direct failed"
    );
    await expect(
      writeRuntimeTerminalSession({
        sessionId: "runtime-session-direct-2",
        input: "ls\n",
      })
    ).rejects.toThrow("write direct failed");
    expect(invokeMock).not.toHaveBeenCalledWith("terminal_open", expect.anything());
    expect(invokeMock).not.toHaveBeenCalledWith("terminal_write", expect.anything());
  });

  it("maps openWorkspaceIn options", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValueOnce({});

    await openWorkspaceIn("/tmp/project", {
      appName: "Xcode",
      args: ["--reuse-window"],
    });

    expect(invokeMock).toHaveBeenCalledWith("open_workspace_in", {
      path: "/tmp/project",
      app: "Xcode",
      command: null,
      args: ["--reuse-window"],
    });
  });

  it("invokes get_open_app_icon", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValueOnce("data:image/png;base64,abc");

    await getOpenAppIcon("Xcode");

    expect(invokeMock).toHaveBeenCalledWith("get_open_app_icon", {
      appName: "Xcode",
    });
  });

  it("invokes orbit remote auth/runner wrappers", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValue(undefined);

    await orbitConnectTest();
    await orbitSignInStart();
    await orbitSignInPoll("device-code");
    await orbitSignOut();
    await orbitRunnerStart();
    await orbitRunnerStop();
    await orbitRunnerStatus();

    expect(invokeMock).toHaveBeenCalledWith("orbit_connect_test");
    expect(invokeMock).toHaveBeenCalledWith("orbit_sign_in_start");
    expect(invokeMock).toHaveBeenCalledWith("orbit_sign_in_poll", {
      deviceCode: "device-code",
    });
    expect(invokeMock).toHaveBeenCalledWith("orbit_sign_out");
    expect(invokeMock).toHaveBeenCalledWith("orbit_runner_start");
    expect(invokeMock).toHaveBeenCalledWith("orbit_runner_stop");
    expect(invokeMock).toHaveBeenCalledWith("orbit_runner_status");
  });

  it("invokes tailscale wrappers", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValue(undefined);

    await tailscaleStatus();
    await tailscaleDaemonCommandPreview();
    await tailscaleDaemonStart();
    await tailscaleDaemonStop();
    await tailscaleDaemonStatus();

    expect(invokeMock).toHaveBeenCalledWith("tailscale_status");
    expect(invokeMock).toHaveBeenCalledWith("tailscale_daemon_command_preview");
    expect(invokeMock).toHaveBeenCalledWith("tailscale_daemon_start");
    expect(invokeMock).toHaveBeenCalledWith("tailscale_daemon_stop");
    expect(invokeMock).toHaveBeenCalledWith("tailscale_daemon_status");
  });

  it("invokes netbird wrappers", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValue(undefined);

    await netbirdStatus();
    await netbirdDaemonCommandPreview();

    expect(invokeMock).toHaveBeenCalledWith("netbird_status");
    expect(invokeMock).toHaveBeenCalledWith("netbird_daemon_command_preview");
  });

  it("reads agent.md for a workspace", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValueOnce({ exists: true, content: "# Agent", truncated: false });

    await readAgentMd("ws-agent");

    expect(invokeMock).toHaveBeenCalledWith("file_read", {
      scope: "workspace",
      kind: "agents",
      workspaceId: "ws-agent",
    });
  });

  it("writes agent.md for a workspace", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValueOnce({});

    await writeAgentMd("ws-agent", "# Agent");

    expect(invokeMock).toHaveBeenCalledWith("file_write", {
      scope: "workspace",
      kind: "agents",
      workspaceId: "ws-agent",
      content: "# Agent",
    });
  });

  it("reads global AGENTS.md", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValueOnce({ exists: true, content: "# Global", truncated: false });

    await readGlobalAgentsMd();

    expect(invokeMock).toHaveBeenCalledWith("file_read", {
      scope: "global",
      kind: "agents",
      workspaceId: undefined,
    });
  });

  it("writes global AGENTS.md", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValueOnce({});

    await writeGlobalAgentsMd("# Global");

    expect(invokeMock).toHaveBeenCalledWith("file_write", {
      scope: "global",
      kind: "agents",
      workspaceId: undefined,
      content: "# Global",
    });
  });

  it("reads global config.toml", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValueOnce({
      exists: true,
      content: 'model = "gpt-5"',
      truncated: false,
    });

    await readGlobalCodexConfigToml();

    expect(invokeMock).toHaveBeenCalledWith("file_read", {
      scope: "global",
      kind: "config",
      workspaceId: undefined,
    });
  });

  it("writes global config.toml", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValueOnce({});

    await writeGlobalCodexConfigToml('model = "gpt-5"');

    expect(invokeMock).toHaveBeenCalledWith("file_write", {
      scope: "global",
      kind: "config",
      workspaceId: undefined,
      content: 'model = "gpt-5"',
    });
  });

  it("uses local text-file fallback in runtime-gateway-web mode", async () => {
    vi.mocked(isTauri).mockReturnValue(false);
    vi.mocked(detectRuntimeMode).mockReturnValue("runtime-gateway-web");
    const invokeMock = vi.mocked(invoke);

    await expect(readGlobalAgentsMd()).resolves.toEqual({
      exists: false,
      content: "",
      truncated: false,
    });
    await writeGlobalAgentsMd("# Global");
    await expect(readGlobalAgentsMd()).resolves.toEqual({
      exists: true,
      content: "# Global",
      truncated: false,
    });

    await expect(readAgentMd("ws-runtime-gateway-web")).resolves.toEqual({
      exists: false,
      content: "",
      truncated: false,
    });
    await writeAgentMd("ws-runtime-gateway-web", "# Workspace Agent");
    await expect(readAgentMd("ws-runtime-gateway-web")).resolves.toEqual({
      exists: true,
      content: "# Workspace Agent",
      truncated: false,
    });
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("falls back to local text-file storage when invoke bridge is missing", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockRejectedValue(
      new TypeError("Cannot read properties of undefined (reading 'invoke')")
    );

    await expect(readGlobalAgentsMd()).resolves.toEqual({
      exists: false,
      content: "",
      truncated: false,
    });
    await writeGlobalAgentsMd("# Global");
    await expect(readGlobalAgentsMd()).resolves.toEqual({
      exists: true,
      content: "# Global",
      truncated: false,
    });

    await expect(readAgentMd("ws-bridge-missing")).resolves.toEqual({
      exists: false,
      content: "",
      truncated: false,
    });
    await writeAgentMd("ws-bridge-missing", "# Workspace Agent");
    await expect(readAgentMd("ws-bridge-missing")).resolves.toEqual({
      exists: true,
      content: "# Workspace Agent",
      truncated: false,
    });

    expect(invokeMock).toHaveBeenCalled();
  });

  it("falls back to local text-file storage when invoke exists but is not callable", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockRejectedValue(
      new TypeError("window.__TAURI_INTERNALS__.invoke is not a function")
    );

    await expect(readGlobalAgentsMd()).resolves.toEqual({
      exists: false,
      content: "",
      truncated: false,
    });
    await writeGlobalAgentsMd("# Global");
    await expect(readGlobalAgentsMd()).resolves.toEqual({
      exists: true,
      content: "# Global",
      truncated: false,
    });

    expect(invokeMock).toHaveBeenCalled();
  });

  it("treats missing text files as empty read responses", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockRejectedValueOnce(new Error("No such file or directory (os error 2)"));

    await expect(readGlobalAgentsMd()).resolves.toEqual({
      exists: false,
      content: "",
      truncated: false,
    });
  });

  it("falls back to local text-file storage when file_read/file_write commands are unavailable", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockImplementation(async (command: string) => {
      if (command === "file_read") {
        throw new Error("unknown command `file_read`");
      }
      if (command === "file_write") {
        throw new Error("unknown command `file_write`");
      }
      return undefined;
    });

    await expect(readGlobalAgentsMd()).resolves.toEqual({
      exists: false,
      content: "",
      truncated: false,
    });
    await writeGlobalAgentsMd("# Global");
    await expect(readGlobalAgentsMd()).resolves.toEqual({
      exists: true,
      content: "# Global",
      truncated: false,
    });
  });

  it("handles localStorage read/write failures in runtime-gateway-web fallback mode", async () => {
    vi.mocked(isTauri).mockReturnValue(false);
    vi.mocked(detectRuntimeMode).mockReturnValue("runtime-gateway-web");
    const getItemSpy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("localStorage blocked");
    });
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("localStorage blocked");
    });

    try {
      await expect(readGlobalAgentsMd()).resolves.toEqual({
        exists: false,
        content: "",
        truncated: false,
      });
      await expect(writeGlobalAgentsMd("# Global")).resolves.toBeUndefined();
      await expect(readAgentMd("ws-storage-blocked")).resolves.toEqual({
        exists: false,
        content: "",
        truncated: false,
      });
      await expect(writeAgentMd("ws-storage-blocked", "# Agent")).resolves.toBeUndefined();
    } finally {
      getItemSpy.mockRestore();
      setItemSpy.mockRestore();
    }
  });

  it("routes sendUserMessage through runtime turn API with normalized payload", async () => {
    const invokeMock = vi.mocked(invoke);
    const runtimeSendTurnMock = vi.fn().mockResolvedValue({
      accepted: true,
      turnId: "turn-1",
      threadId: "thread-1",
      routedProvider: null,
      routedModelId: null,
      routedPool: null,
      routedSource: null,
      message: "ok",
    });
    vi.mocked(getRuntimeClient).mockReturnValue({
      sendTurn: runtimeSendTurnMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(
      sendUserMessage("ws-4", "thread-1", "hello", {
        model: "gpt-5.3-codex",
        effort: "high",
        accessMode: "full-access",
        missionMode: "delegate",
        executionProfileId: "balanced-delegate",
        preferredBackendIds: ["backend-a", "backend-b"],
        contextPrefix: "[ATLAS_CONTEXT v1]\n1. plan: noop\n[/ATLAS_CONTEXT]",
        images: ["/tmp/image.png"],
      })
    ).resolves.toEqual({
      result: {
        accepted: true,
        threadId: "thread-1",
        thread_id: "thread-1",
        routedProvider: null,
        routed_provider: null,
        routedModelId: null,
        routed_model_id: null,
        routedPool: null,
        routed_pool: null,
        routedSource: null,
        routed_source: null,
        turn: {
          id: "turn-1",
          threadId: "thread-1",
          thread_id: "thread-1",
          routedProvider: null,
          routed_provider: null,
          routedModelId: null,
          routed_model_id: null,
          routedPool: null,
          routed_pool: null,
          routedSource: null,
          routed_source: null,
        },
      },
    });

    expect(runtimeSendTurnMock).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "ws-4",
        threadId: "thread-1",
        requestId: expect.any(String),
        content: "hello",
        contextPrefix: "[ATLAS_CONTEXT v1]\n1. plan: noop\n[/ATLAS_CONTEXT]",
        provider: null,
        modelId: "gpt-5.3-codex",
        reasonEffort: "high",
        accessMode: "full-access",
        missionMode: "delegate",
        executionProfileId: "balanced-delegate",
        preferredBackendIds: ["backend-a", "backend-b"],
        executionMode: "hybrid",
        queue: false,
        attachments: [
          {
            id: "1",
            name: "image.png",
            mimeType: "application/octet-stream",
            size: 0,
          },
        ],
      })
    );
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("maps execution mode to runtime executionMode field", async () => {
    const runtimeSendTurnMock = vi.fn().mockResolvedValue({
      accepted: true,
      turnId: "turn-2",
      threadId: "thread-1",
      routedProvider: null,
      routedModelId: null,
      routedPool: null,
      routedSource: null,
      message: "ok",
    });
    vi.mocked(getRuntimeClient).mockReturnValue({
      sendTurn: runtimeSendTurnMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await sendUserMessage("ws-4", "thread-1", "hello", {
      executionMode: "local-cli",
    });

    expect(runtimeSendTurnMock).toHaveBeenCalledWith(
      expect.objectContaining({
        executionMode: "local-cli",
      })
    );

    await sendUserMessage("ws-4", "thread-1", "hello", {
      executionMode: "runtime",
    });

    expect(runtimeSendTurnMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        executionMode: "runtime",
      })
    );
  });

  it("forwards collaborationMode only when explicitly provided", async () => {
    const runtimeSendTurnMock = vi.fn().mockResolvedValue({
      accepted: true,
      turnId: "turn-3",
      threadId: "thread-1",
      routedProvider: null,
      routedModelId: null,
      routedPool: null,
      routedSource: null,
      message: "ok",
    });
    vi.mocked(getRuntimeClient).mockReturnValue({
      sendTurn: runtimeSendTurnMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    const collaborationMode = {
      modeId: "pair-programming",
      agentCount: 2,
    };

    await sendUserMessage("ws-4", "thread-1", "hello", {
      collaborationMode,
    });

    expect(runtimeSendTurnMock).toHaveBeenCalledWith(
      expect.objectContaining({
        collaborationMode,
      })
    );
    const payload = runtimeSendTurnMock.mock.calls[0]?.[0] as {
      collaborationMode?: Record<string, unknown> | null;
    };
    expect(Object.hasOwn(payload, "collaborationMode")).toBe(true);
  });

  it("does not forward collaborationMode when explicitly set to null", async () => {
    const runtimeSendTurnMock = vi.fn().mockResolvedValue({
      accepted: true,
      turnId: "turn-3-null",
      threadId: "thread-1",
      routedProvider: null,
      routedModelId: null,
      routedPool: null,
      routedSource: null,
      message: "ok",
    });
    vi.mocked(getRuntimeClient).mockReturnValue({
      sendTurn: runtimeSendTurnMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await sendUserMessage("ws-4", "thread-1", "hello", {
      collaborationMode: null,
    });

    const payload = runtimeSendTurnMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(Object.hasOwn(payload, "collaborationMode")).toBe(false);
  });

  it("does not fall back to legacy send_user_message invoke when runtime send fails", async () => {
    const invokeMock = vi.mocked(invoke);
    const runtimeSendTurnMock = vi.fn().mockRejectedValue(new Error("runtime send failed"));
    vi.mocked(getRuntimeClient).mockReturnValue({
      sendTurn: runtimeSendTurnMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(sendUserMessage("ws-4", "thread-1", "hello")).rejects.toThrow(
      "runtime send failed"
    );
    expect(invokeMock).not.toHaveBeenCalledWith("send_user_message", expect.anything());
  });

  it("routes interruptTurn through runtime interrupt API", async () => {
    const invokeMock = vi.mocked(invoke);
    const runtimeInterruptTurnMock = vi.fn().mockResolvedValue(true);
    vi.mocked(getRuntimeClient).mockReturnValue({
      interruptTurn: runtimeInterruptTurnMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(interruptTurn("ws-4", "thread-1", "pending")).resolves.toEqual({
      result: { interrupted: true },
    });

    expect(runtimeInterruptTurnMock).toHaveBeenCalledWith({
      turnId: null,
      reason: null,
    });
    expect(invokeMock).not.toHaveBeenCalledWith("turn_interrupt", expect.anything());
  });

  it("does not fall back to legacy turn_interrupt invoke when runtime interrupt fails", async () => {
    const invokeMock = vi.mocked(invoke);
    const runtimeInterruptTurnMock = vi
      .fn()
      .mockRejectedValue(new Error("runtime interrupt failed"));
    vi.mocked(getRuntimeClient).mockReturnValue({
      interruptTurn: runtimeInterruptTurnMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(interruptTurn("ws-4", "thread-1", "turn-1")).rejects.toThrow(
      "runtime interrupt failed"
    );
    expect(invokeMock).not.toHaveBeenCalledWith("turn_interrupt", expect.anything());
  });

  it("routes runtime job and approval wrappers through runtime client", async () => {
    const invokeMock = vi.mocked(invoke);
    const taskSummary = {
      id: "task-1",
      workspaceId: "ws-4",
      threadId: "thread-1",
      title: "Task",
      status: "running",
      provider: "openai",
      modelId: "gpt-5.3-codex",
      backendId: "backend-a",
      preferredBackendIds: ["backend-a"],
      executionProfile: {
        placement: "remote",
        interactivity: "background",
        isolation: "container_sandbox",
        network: "default",
        authority: "service",
      },
      createdAt: 100,
      updatedAt: 100,
      startedAt: 100,
      completedAt: null,
      continuation: {
        checkpointId: "checkpoint-1",
        resumeSupported: true,
        recovered: false,
        summary: "Ready",
      },
      metadata: null,
    } as const;
    const kernelJobStartV3Mock = vi.fn().mockResolvedValue(taskSummary);
    const kernelJobCancelV3Mock = vi.fn().mockResolvedValue({
      accepted: true,
      runId: "task-1",
      status: "interrupted",
      message: "Interrupted",
    });
    const kernelJobSubscribeV3Mock = vi.fn().mockResolvedValue(taskSummary);
    const kernelJobsListV2Mock = vi.fn().mockResolvedValue([taskSummary]);
    const runtimeRunCheckpointApprovalMock = vi.fn().mockResolvedValue({
      recorded: true,
      approvalId: "approval-1",
      runId: "task-1",
      status: "running",
      message: "Recorded",
    });
    vi.mocked(getRuntimeClient).mockReturnValue({
      kernelJobStartV3: kernelJobStartV3Mock,
      kernelJobCancelV3: kernelJobCancelV3Mock,
      kernelJobSubscribeV3: kernelJobSubscribeV3Mock,
      kernelJobsListV2: kernelJobsListV2Mock,
      runtimeRunCheckpointApproval: runtimeRunCheckpointApprovalMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    const startRequest: Parameters<typeof startRuntimeJob>[0] = {
      workspaceId: "ws-4",
      threadId: "thread-1",
      requestId: "request-1",
      steps: [{ kind: "read", path: "README.md" }],
      delivery: {
        mode: "poll",
      },
    };
    const cancelRequest = { runId: "task-1", reason: "user-stop" } as const;
    const subscribeRequest = { runId: "task-1" } as const;
    const listRequest = { workspaceId: "ws-4", status: "running", limit: 10 } as const;
    const approvalRequest = {
      approvalId: "approval-1",
      decision: "approved",
      reason: "looks good",
    } as const;

    await expect(startRuntimeJob(startRequest)).resolves.toEqual(taskSummary);
    await expect(cancelRuntimeJob(cancelRequest)).resolves.toEqual({
      accepted: true,
      runId: "task-1",
      status: "interrupted",
      message: "Interrupted",
    });
    await expect(subscribeRuntimeJob(subscribeRequest)).resolves.toEqual(taskSummary);
    await expect(listRuntimeJobs(listRequest)).resolves.toEqual([taskSummary]);
    await expect(submitRuntimeJobApprovalDecision(approvalRequest)).resolves.toEqual({
      recorded: true,
      approvalId: "approval-1",
      runId: "task-1",
      status: "running",
      message: "Recorded",
    });

    expect(kernelJobStartV3Mock).toHaveBeenCalledWith(startRequest);
    expect(kernelJobCancelV3Mock).toHaveBeenCalledWith(cancelRequest);
    expect(kernelJobSubscribeV3Mock).toHaveBeenCalledWith(subscribeRequest);
    expect(kernelJobsListV2Mock).toHaveBeenCalledWith(listRequest);
    expect(runtimeRunCheckpointApprovalMock).toHaveBeenCalledWith(approvalRequest);
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("routes distributed backend wrappers through runtime client", async () => {
    const invokeMock = vi.mocked(invoke);
    const runtimeBackendsListMock = vi
      .fn()
      .mockResolvedValue([{ backendId: "backend-a", status: "active" }]);
    const runtimeBackendSetStateMock = vi.fn().mockResolvedValue({ ok: true });
    const runtimeDistributedTaskGraphMock = vi.fn().mockResolvedValue({
      nodes: [{ id: "node-1", status: "running" }],
      edges: [],
    });
    vi.mocked(getRuntimeClient).mockReturnValue({
      runtimeBackendsList: runtimeBackendsListMock,
      runtimeBackendSetState: runtimeBackendSetStateMock,
      distributedTaskGraph: runtimeDistributedTaskGraphMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(runtimeBackendsList("ws-4")).resolves.toEqual([
      { backendId: "backend-a", status: "active" },
    ]);
    await expect(
      runtimeBackendSetState({ backendId: "backend-a", state: "draining", workspaceId: "ws-4" })
    ).resolves.toEqual({ ok: true });
    await expect(
      distributedTaskGraph({ taskId: "task-1", limit: 64, includeDiagnostics: false })
    ).resolves.toEqual({
      nodes: [{ id: "node-1", status: "running" }],
      edges: [],
    });

    expect(runtimeBackendsListMock).toHaveBeenCalledWith();
    expect(runtimeBackendSetStateMock).toHaveBeenCalledWith({
      backendId: "backend-a",
      status: "draining",
      rolloutState: undefined,
      force: undefined,
      reason: null,
    });
    expect(runtimeDistributedTaskGraphMock).toHaveBeenCalledWith({
      taskId: "task-1",
      limit: 64,
      includeDiagnostics: false,
    });
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("routes action-required wrappers through runtime client", async () => {
    const invokeMock = vi.mocked(invoke);
    const actionRequiredGetV2Mock = vi.fn(async () => ({
      requestId: "review-1",
      kind: "review_decision" as const,
      status: "submitted" as const,
      action: "approve runtime task",
      reason: null,
      input: null,
      createdAt: 1,
      decidedAt: null,
      decisionReason: null,
    }));
    const actionRequiredSubmitV2Mock = vi.fn(async () => "approved" as const);
    vi.mocked(getRuntimeClient).mockReturnValue({
      actionRequiredGetV2: actionRequiredGetV2Mock,
      actionRequiredSubmitV2: actionRequiredSubmitV2Mock,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(actionRequiredGetV2("review-1")).resolves.toMatchObject({
      requestId: "review-1",
      kind: "review_decision",
      status: "submitted",
    });
    await expect(
      actionRequiredSubmitV2({
        requestId: "review-1",
        kind: "review_decision",
        status: "approved",
        reason: null,
      })
    ).resolves.toBe("approved");

    expect(actionRequiredGetV2Mock).toHaveBeenCalledWith("review-1");
    expect(actionRequiredSubmitV2Mock).toHaveBeenCalledWith({
      requestId: "review-1",
      kind: "review_decision",
      status: "approved",
      reason: null,
    });
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("returns null when distributed wrappers hit unsupported runtime methods", async () => {
    const unsupportedError = {
      name: "RuntimeRpcMethodUnsupportedError",
      code: "method_not_found",
      message: "method not found",
    };
    vi.mocked(getRuntimeClient).mockReturnValue({
      runtimeBackendsList: vi.fn().mockRejectedValue(unsupportedError),
      runtimeBackendSetState: vi.fn().mockRejectedValue(unsupportedError),
      distributedTaskGraph: vi.fn().mockRejectedValue(unsupportedError),
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(runtimeBackendsList("ws-4")).resolves.toBeNull();
    await expect(
      runtimeBackendSetState({ backendId: "backend-a", state: "draining", workspaceId: "ws-4" })
    ).resolves.toBeNull();
    await expect(distributedTaskGraph({ taskId: "task-1" })).resolves.toBeNull();
  });

  it("routes backend upsert and remove wrappers through runtime client", async () => {
    const runtimeBackendUpsertMock = vi.fn().mockResolvedValue({
      backendId: "backend-z",
      displayName: "Backend Z",
      status: "active",
    });
    const runtimeBackendRemoveMock = vi.fn().mockResolvedValue(true);
    vi.mocked(getRuntimeClient).mockReturnValue({
      runtimeBackendUpsert: runtimeBackendUpsertMock,
      runtimeBackendRemove: runtimeBackendRemoveMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(
      runtimeBackendUpsert({
        backendId: "backend-z",
        displayName: "Backend Z",
        capabilities: ["general"],
        maxConcurrency: 2,
        costTier: "standard",
        latencyClass: "regional",
        rolloutState: "current",
        status: "active",
      })
    ).resolves.toMatchObject({
      backendId: "backend-z",
      status: "active",
    });
    await expect(runtimeBackendRemove({ backendId: "backend-z" })).resolves.toBe(true);

    expect(runtimeBackendUpsertMock).toHaveBeenCalledWith({
      backendId: "backend-z",
      displayName: "Backend Z",
      capabilities: ["general"],
      maxConcurrency: 2,
      costTier: "standard",
      latencyClass: "regional",
      rolloutState: "current",
      status: "active",
    });
    expect(runtimeBackendRemoveMock).toHaveBeenCalledWith("backend-z");
  });

  it("returns graceful unsupported fallbacks for backend upsert and remove wrappers", async () => {
    const unsupportedError = {
      name: "RuntimeRpcMethodUnsupportedError",
      code: "method_not_found",
      message: "method not found",
    };
    vi.mocked(getRuntimeClient).mockReturnValue({
      runtimeBackendUpsert: vi.fn().mockRejectedValue(unsupportedError),
      runtimeBackendRemove: vi.fn().mockRejectedValue(unsupportedError),
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(
      runtimeBackendUpsert({
        backendId: "backend-z",
        displayName: "Backend Z",
        capabilities: ["general"],
        maxConcurrency: 2,
        costTier: "standard",
        latencyClass: "regional",
        rolloutState: "current",
        status: "active",
      })
    ).resolves.toBeNull();
    await expect(runtimeBackendRemove({ backendId: "backend-z" })).resolves.toBeNull();
  });

  it("rethrows backend mutation connection errors in web runtime mode", async () => {
    vi.mocked(detectRuntimeMode).mockReturnValue("runtime-gateway-web");
    const connectionError = new Error("Failed to fetch (127.0.0.1:8788)");
    vi.mocked(getRuntimeClient).mockReturnValue({
      runtimeBackendUpsert: vi.fn().mockRejectedValue(connectionError),
      runtimeBackendRemove: vi.fn().mockRejectedValue(connectionError),
      runtimeBackendSetState: vi.fn().mockRejectedValue(connectionError),
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(
      runtimeBackendUpsert({
        backendId: "backend-z",
        displayName: "Backend Z",
        capabilities: ["general"],
        maxConcurrency: 2,
        costTier: "standard",
        latencyClass: "regional",
        rolloutState: "current",
        status: "active",
      })
    ).rejects.toThrow("Failed to fetch");
    await expect(runtimeBackendRemove({ backendId: "backend-z" })).rejects.toThrow(
      "Failed to fetch"
    );
    await expect(
      runtimeBackendSetState({ backendId: "backend-z", state: "draining" })
    ).rejects.toThrow("Failed to fetch");
  });

  it("routes runtime extension install and remove wrappers through runtime client", async () => {
    const installRuntimeExtensionMock = vi.fn().mockResolvedValue({
      extensionId: "ext-z",
      name: "Extension Z",
      transport: "builtin",
      enabled: true,
      workspaceId: "ws-4",
      config: { profile: "default" },
      installedAt: 1,
      updatedAt: 2,
    });
    const removeRuntimeExtensionMock = vi.fn().mockResolvedValue(true);
    vi.mocked(getRuntimeClient).mockReturnValue({
      extensionInstallV1: installRuntimeExtensionMock,
      extensionRemoveV1: removeRuntimeExtensionMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(
      installRuntimeExtension({
        workspaceId: "ws-4",
        extensionId: "ext-z",
        name: "Extension Z",
        transport: "builtin",
        enabled: true,
        config: { profile: "default" },
      })
    ).resolves.toMatchObject({
      extensionId: "ext-z",
      transport: "builtin",
    });
    await expect(
      removeRuntimeExtension({ workspaceId: "ws-4", extensionId: "ext-z" })
    ).resolves.toBe(true);

    expect(installRuntimeExtensionMock).toHaveBeenCalledWith({
      workspaceId: "ws-4",
      extensionId: "ext-z",
      name: "Extension Z",
      transport: "builtin",
      enabled: true,
      config: { profile: "default" },
    });
    expect(removeRuntimeExtensionMock).toHaveBeenCalledWith({
      workspaceId: "ws-4",
      extensionId: "ext-z",
    });
  });

  it("returns helper fallbacks for unsupported runtime extension wrappers", async () => {
    const unsupportedError = {
      name: "RuntimeRpcMethodUnsupportedError",
      code: "method_not_found",
      message: "method not found",
    };
    vi.mocked(getRuntimeClient).mockReturnValue({
      extensionInstallV1: vi.fn().mockRejectedValue(unsupportedError),
      extensionRemoveV1: vi.fn().mockRejectedValue(unsupportedError),
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(
      installRuntimeExtension({
        workspaceId: "ws-4",
        extensionId: "ext-z",
        name: "Extension Z",
        transport: "builtin",
      })
    ).resolves.toBeNull();
    await expect(
      removeRuntimeExtension({ workspaceId: "ws-4", extensionId: "ext-z" })
    ).resolves.toBe(false);
  });

  it("rethrows runtime extension mutation connection errors in web runtime mode", async () => {
    vi.mocked(detectRuntimeMode).mockReturnValue("runtime-gateway-web");
    const connectionError = new Error("Failed to fetch (127.0.0.1:8788)");
    vi.mocked(getRuntimeClient).mockReturnValue({
      extensionInstallV1: vi.fn().mockRejectedValue(connectionError),
      extensionRemoveV1: vi.fn().mockRejectedValue(connectionError),
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(
      installRuntimeExtension({
        workspaceId: "ws-4",
        extensionId: "ext-z",
        name: "Extension Z",
        transport: "builtin",
      })
    ).rejects.toThrow("Failed to fetch");
    await expect(
      removeRuntimeExtension({ workspaceId: "ws-4", extensionId: "ext-z" })
    ).rejects.toThrow("Failed to fetch");
  });

  it("returns null for read-only distributed wrappers on web runtime connection errors", async () => {
    vi.mocked(detectRuntimeMode).mockReturnValue("runtime-gateway-web");
    const connectionError = new Error("Failed to fetch (127.0.0.1:8788)");
    vi.mocked(getRuntimeClient).mockReturnValue({
      runtimeBackendsList: vi.fn().mockRejectedValue(connectionError),
      distributedTaskGraph: vi.fn().mockRejectedValue(connectionError),
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(runtimeBackendsList("ws-web")).resolves.toBeNull();
    await expect(distributedTaskGraph({ taskId: "task-web" })).resolves.toBeNull();
  });

  it("rethrows distributed wrapper connection errors outside web runtime mode", async () => {
    vi.mocked(detectRuntimeMode).mockReturnValue("tauri");
    const connectionError = new Error("Failed to fetch (127.0.0.1:8788)");
    vi.mocked(getRuntimeClient).mockReturnValue({
      runtimeBackendsList: vi.fn().mockRejectedValue(connectionError),
      distributedTaskGraph: vi.fn().mockRejectedValue(connectionError),
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(runtimeBackendsList("ws-tauri")).rejects.toThrow("Failed to fetch");
    await expect(distributedTaskGraph({ taskId: "task-tauri" })).rejects.toThrow("Failed to fetch");
  });

  it("routes diagnostics export wrapper through runtime client", async () => {
    const diagnosticsExportResponse = {
      schemaVersion: "runtime-diagnostics-export/v1",
      exportedAt: 1_770_000_000_000,
      source: "runtime-service",
      redactionLevel: "strict",
      filename: "runtime-diagnostics.zip",
      mimeType: "application/zip",
      sizeBytes: 123,
      zipBase64: "UEsDBAoAAAAAA",
      sections: ["manifest.json", "runtime/health.json"],
      warnings: [],
      redactionStats: {
        redactedKeys: 1,
        redactedValues: 2,
        hashedPaths: 3,
        hashedEmails: 4,
        hashedSecrets: 5,
      },
    } as const;
    const runtimeDiagnosticsExportMock = vi.fn().mockResolvedValue(diagnosticsExportResponse);
    vi.mocked(getRuntimeClient).mockReturnValue({
      runtimeDiagnosticsExportV1: runtimeDiagnosticsExportMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(
      runtimeDiagnosticsExportV1({
        workspaceId: "ws-export",
        redactionLevel: "strict",
        includeTaskSummaries: false,
        includeEventTail: true,
      })
    ).resolves.toEqual(diagnosticsExportResponse);

    expect(runtimeDiagnosticsExportMock).toHaveBeenCalledWith({
      workspaceId: "ws-export",
      redactionLevel: "strict",
      includeTaskSummaries: false,
      includeEventTail: true,
      includeZipBase64: true,
    });
  });

  it("returns null when diagnostics export method is unsupported", async () => {
    const unsupportedError = {
      name: "RuntimeRpcMethodUnsupportedError",
      code: "METHOD_NOT_FOUND",
      message: "Unsupported RPC method: code_runtime_diagnostics_export_v1",
    };
    vi.mocked(getRuntimeClient).mockReturnValue({
      runtimeDiagnosticsExportV1: vi.fn().mockRejectedValue(unsupportedError),
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(runtimeDiagnosticsExportV1({ workspaceId: "ws-unsupported" })).resolves.toBeNull();
  });

  it("routes runtime session portability wrappers through runtime client", async () => {
    const sessionExportResponse = {
      schemaVersion: "runtime-session-export/v1",
      exportedAt: 1_770_000_000_000,
      threadId: "thread-1",
      snapshot: { version: 1 },
      warnings: [],
    } as const;
    const sessionImportResponse = {
      schemaVersion: "runtime-session-import/v1",
      importedAt: 1_770_000_000_001,
      workspaceId: "ws-import",
      threadId: "thread-1",
      warnings: [],
    } as const;
    const sessionExportV1 = vi.fn().mockResolvedValue(sessionExportResponse);
    const sessionImportV1 = vi.fn().mockResolvedValue(sessionImportResponse);
    const sessionDeleteV1 = vi.fn().mockResolvedValue(true);
    vi.mocked(getRuntimeClient).mockReturnValue({
      sessionExportV1,
      sessionImportV1,
      sessionDeleteV1,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(
      runtimeSessionExportV1({
        workspaceId: "ws-export",
        threadId: "thread-1",
        includeAgentTasks: true,
      })
    ).resolves.toEqual(sessionExportResponse);
    await expect(
      runtimeSessionImportV1({
        workspaceId: "ws-import",
        threadId: "thread-1",
        snapshot: { version: 1 },
      })
    ).resolves.toEqual(sessionImportResponse);
    await expect(
      runtimeSessionDeleteV1({
        workspaceId: "ws-delete",
        threadId: "thread-1",
      })
    ).resolves.toBe(true);

    expect(sessionExportV1).toHaveBeenCalledWith({
      workspaceId: "ws-export",
      threadId: "thread-1",
      includeAgentTasks: true,
    });
    expect(sessionImportV1).toHaveBeenCalledWith({
      workspaceId: "ws-import",
      threadId: "thread-1",
      snapshot: { version: 1 },
    });
    expect(sessionDeleteV1).toHaveBeenCalledWith({
      workspaceId: "ws-delete",
      threadId: "thread-1",
    });
  });

  it("returns graceful fallbacks when runtime session portability methods are unsupported", async () => {
    const unsupportedError = {
      code: "METHOD_NOT_FOUND",
      message: "Unsupported RPC method",
    };
    vi.mocked(getRuntimeClient).mockReturnValue({
      sessionExportV1: vi.fn().mockRejectedValue(unsupportedError),
      sessionImportV1: vi.fn().mockRejectedValue(unsupportedError),
      sessionDeleteV1: vi.fn().mockRejectedValue(unsupportedError),
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(
      runtimeSessionExportV1({ workspaceId: "ws-export", threadId: "thread-1" })
    ).resolves.toBeNull();
    await expect(
      runtimeSessionImportV1({
        workspaceId: "ws-import",
        snapshot: { version: 1 },
      })
    ).resolves.toBeNull();
    await expect(
      runtimeSessionDeleteV1({ workspaceId: "ws-delete", threadId: "thread-1" })
    ).resolves.toBe(false);
  });

  it("returns web runtime fallbacks when runtime session portability calls lose connectivity", async () => {
    vi.mocked(detectRuntimeMode).mockReturnValue("runtime-gateway-web");
    const connectionError = new Error("Failed to fetch (127.0.0.1:8788)");
    vi.mocked(getRuntimeClient).mockReturnValue({
      sessionExportV1: vi.fn().mockRejectedValue(connectionError),
      sessionImportV1: vi.fn().mockRejectedValue(connectionError),
      sessionDeleteV1: vi.fn().mockRejectedValue(connectionError),
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(
      runtimeSessionExportV1({ workspaceId: "ws-export", threadId: "thread-1" })
    ).resolves.toBeNull();
    await expect(
      runtimeSessionImportV1({
        workspaceId: "ws-import",
        snapshot: { version: 1 },
      })
    ).resolves.toBeNull();
    await expect(
      runtimeSessionDeleteV1({ workspaceId: "ws-delete", threadId: "thread-1" })
    ).resolves.toBe(false);
  });

  it("routes runtime security preflight wrapper through runtime client", async () => {
    const securityPreflightV1 = vi.fn().mockResolvedValue({
      action: "allow",
      reason: null,
      advisories: [],
    });
    vi.mocked(getRuntimeClient).mockReturnValue({
      securityPreflightV1,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(
      runtimeSecurityPreflightV1({
        workspaceId: "ws-security",
        toolName: "execute-workspace-command",
        command: "pnpm validate:fast",
      })
    ).resolves.toEqual({
      action: "allow",
      reason: null,
      advisories: [],
    });
    expect(securityPreflightV1).toHaveBeenCalledWith({
      workspaceId: "ws-security",
      toolName: "execute-workspace-command",
      command: "pnpm validate:fast",
    });
  });

  it("returns security preflight fallback decisions for unsupported and web runtime failures", async () => {
    const unsupportedError = {
      code: "METHOD_NOT_FOUND",
      message: "Unsupported RPC method",
    };
    vi.mocked(getRuntimeClient).mockReturnValue({
      securityPreflightV1: vi.fn().mockRejectedValue(unsupportedError),
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(
      runtimeSecurityPreflightV1({
        workspaceId: "ws-security",
        toolName: "execute-workspace-command",
      })
    ).resolves.toMatchObject({
      action: "review",
      reason: "Runtime does not support security preflight v1; applied client fallback policy.",
      advisories: [],
    });

    vi.mocked(detectRuntimeMode).mockReturnValue("runtime-gateway-web");
    vi.mocked(getRuntimeClient).mockReturnValue({
      securityPreflightV1: vi.fn().mockRejectedValue(new Error("Failed to fetch (127.0.0.1:8788)")),
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(
      runtimeSecurityPreflightV1({
        workspaceId: "ws-security",
        toolName: "execute-workspace-command",
      })
    ).resolves.toMatchObject({
      action: "review",
      reason: "Web runtime security preflight is unavailable; review required by fallback.",
      advisories: [],
    });
  });

  it("routes runtime tool metrics wrappers through runtime client", async () => {
    const metricsSnapshot = {
      totals: {
        completed: 2,
        success: 2,
        validationFailed: 0,
        runtimeFailed: 0,
        timeout: 0,
        blocked: 0,
      },
      byTool: {},
      recent: [],
      updatedAt: 1_770_000_000_000,
      windowSize: 500,
      channelHealth: {
        status: "healthy",
        reason: null,
        lastErrorCode: null,
        updatedAt: 1_770_000_000_000,
      },
      circuitBreakers: [
        { scope: "write", state: "closed", openedAt: null, updatedAt: 1_770_000_000_000 },
        { scope: "runtime", state: "closed", openedAt: null, updatedAt: 1_770_000_000_000 },
        {
          scope: "computer_observe",
          state: "closed",
          openedAt: null,
          updatedAt: 1_770_000_000_000,
        },
      ],
    };
    const guardrailSnapshot = {
      windowSize: 500,
      payloadLimitBytes: 65_536,
      computerObserveRateLimitPerMinute: 12,
      circuitWindowSize: 50,
      circuitMinCompleted: 20,
      circuitOpenMs: 600_000,
      halfOpenMaxProbes: 3,
      halfOpenRequiredSuccesses: 2,
      channelHealth: metricsSnapshot.channelHealth,
      circuitBreakers: metricsSnapshot.circuitBreakers,
      updatedAt: 1_770_000_000_000,
    };
    const runtimeToolMetricsRecordMock = vi.fn().mockResolvedValue(metricsSnapshot);
    const runtimeToolMetricsReadMock = vi.fn().mockResolvedValue(metricsSnapshot);
    const runtimeToolMetricsResetMock = vi.fn().mockResolvedValue(metricsSnapshot);
    const runtimeToolGuardrailEvaluateMock = vi.fn().mockResolvedValue({
      allowed: true,
      blockReason: null,
      errorCode: null,
      message: null,
      channelHealth: metricsSnapshot.channelHealth,
      circuitBreaker: metricsSnapshot.circuitBreakers[1],
      updatedAt: 1_770_000_000_100,
    });
    const runtimeToolGuardrailRecordOutcomeMock = vi.fn().mockResolvedValue(guardrailSnapshot);
    const runtimeToolGuardrailReadMock = vi.fn().mockResolvedValue(guardrailSnapshot);
    vi.mocked(getRuntimeClient).mockReturnValue({
      runtimeToolMetricsRecord: runtimeToolMetricsRecordMock,
      runtimeToolMetricsRead: runtimeToolMetricsReadMock,
      runtimeToolMetricsReset: runtimeToolMetricsResetMock,
      runtimeToolGuardrailEvaluate: runtimeToolGuardrailEvaluateMock,
      runtimeToolGuardrailRecordOutcome: runtimeToolGuardrailRecordOutcomeMock,
      runtimeToolGuardrailRead: runtimeToolGuardrailReadMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    const events = [
      {
        toolName: "run-runtime-live-skill",
        scope: "runtime",
        phase: "completed",
        status: "success",
        at: 1_770_000_000_000,
      },
    ] as const;

    await expect(runtimeToolMetricsRecord([...events])).resolves.toEqual(metricsSnapshot);
    await expect(runtimeToolMetricsRead()).resolves.toEqual(metricsSnapshot);
    await expect(runtimeToolMetricsRead({ scope: "runtime", limit: 10 })).resolves.toEqual(
      metricsSnapshot
    );
    await expect(runtimeToolMetricsReset()).resolves.toEqual(metricsSnapshot);
    await expect(
      runtimeToolGuardrailEvaluate({
        toolName: "execute-workspace-command",
        scope: "runtime",
        payloadBytes: 120,
      })
    ).resolves.toMatchObject({
      allowed: true,
    });
    await expect(
      runtimeToolGuardrailRecordOutcome({
        toolName: "execute-workspace-command",
        scope: "runtime",
        status: "success",
        at: 1_770_000_000_120,
      })
    ).resolves.toEqual(guardrailSnapshot);
    await expect(runtimeToolGuardrailRead()).resolves.toEqual(guardrailSnapshot);

    expect(runtimeToolMetricsRecordMock).toHaveBeenCalledWith(events);
    expect(runtimeToolMetricsReadMock).toHaveBeenCalledWith(undefined);
    expect(runtimeToolMetricsReadMock).toHaveBeenCalledWith({ scope: "runtime", limit: 10 });
    expect(runtimeToolMetricsResetMock).toHaveBeenCalledWith();
    expect(runtimeToolGuardrailEvaluateMock).toHaveBeenCalledWith({
      toolName: "execute-workspace-command",
      scope: "runtime",
      payloadBytes: 120,
    });
    expect(runtimeToolGuardrailRecordOutcomeMock).toHaveBeenCalledWith({
      toolName: "execute-workspace-command",
      scope: "runtime",
      status: "success",
      at: 1_770_000_000_120,
    });
    expect(runtimeToolGuardrailReadMock).toHaveBeenCalledWith();
  });

  it("rethrows runtime tool metrics unsupported errors without optional fallback", async () => {
    vi.mocked(detectRuntimeMode).mockReturnValue("runtime-gateway-web");
    const unsupportedError = {
      name: "RuntimeRpcMethodUnsupportedError",
      code: "method_not_found",
      message: "Method not found: code_runtime_tool_metrics_read",
    };
    vi.mocked(getRuntimeClient).mockReturnValue({
      runtimeToolMetricsRead: vi.fn().mockRejectedValue(unsupportedError),
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(runtimeToolMetricsRead()).rejects.toMatchObject({
      code: "method_not_found",
    });
  });

  it("normalizes canonical and legacy backend state input for runtime backend set state", async () => {
    const runtimeBackendSetStateMock = vi.fn().mockResolvedValue({ ok: true });
    vi.mocked(getRuntimeClient).mockReturnValue({
      runtimeBackendSetState: runtimeBackendSetStateMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(
      runtimeBackendSetState({
        backendId: "backend-a",
        status: "draining",
        rolloutState: "draining",
        force: true,
        reason: "agent:rebalance",
      })
    ).resolves.toEqual({
      ok: true,
    });
    await expect(
      runtimeBackendSetState({ backendId: "backend-a", state: "enable" })
    ).resolves.toEqual({
      ok: true,
    });
    await expect(
      runtimeBackendSetState({ backendId: "backend-a", state: "disable" })
    ).resolves.toEqual({
      ok: true,
    });
    await expect(
      runtimeBackendSetState({ backendId: "backend-a", state: "drain" })
    ).resolves.toEqual({
      ok: true,
    });

    expect(runtimeBackendSetStateMock).toHaveBeenNthCalledWith(1, {
      backendId: "backend-a",
      status: "draining",
      rolloutState: "draining",
      force: true,
      reason: "agent:rebalance",
    });
    expect(runtimeBackendSetStateMock).toHaveBeenNthCalledWith(2, {
      backendId: "backend-a",
      status: "active",
      rolloutState: undefined,
      force: undefined,
      reason: null,
    });
    expect(runtimeBackendSetStateMock).toHaveBeenNthCalledWith(3, {
      backendId: "backend-a",
      status: "disabled",
      rolloutState: undefined,
      force: undefined,
      reason: null,
    });
    expect(runtimeBackendSetStateMock).toHaveBeenNthCalledWith(4, {
      backendId: "backend-a",
      status: "draining",
      rolloutState: undefined,
      force: undefined,
      reason: null,
    });
  });

  it("reads runtime capability summary through runtime client helper", async () => {
    vi.mocked(readRuntimeCapabilitiesSummary).mockResolvedValue({
      mode: "tauri",
      methods: ["code_runtime_backends_list"],
      features: ["multi_backend_pool_v1"],
      wsEndpointPath: null,
      error: null,
    });

    await expect(getRuntimeCapabilitiesSummary()).resolves.toEqual({
      mode: "tauri",
      methods: ["code_runtime_backends_list"],
      features: ["multi_backend_pool_v1"],
      wsEndpointPath: null,
      error: null,
    });
    expect(readRuntimeCapabilitiesSummary).toHaveBeenCalledTimes(1);
  });
});
