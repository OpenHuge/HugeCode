import { invoke, isTauri } from "@tauri-apps/api/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { listen } from "../application/runtime/ports/tauriEvent";
import {
  detectRuntimeMode,
  getRuntimeClient,
  readRuntimeCapabilitiesSummary,
} from "./runtimeClient";
import {
  __resetLocalUsageSnapshotCacheForTests,
  __resetWebRuntimeOauthFallbackStateForTests,
  getRuntimeBootstrapSnapshot,
  getRuntimeHealth,
  getRuntimeRemoteStatus,
  getRuntimeSettings,
  getRuntimeTerminalStatus,
  respondToServerRequest,
  respondToUserInputRequest,
  runRuntimeLiveSkill,
  sendNotification,
  startReview,
  steerTurn,
} from "./tauri";
import { respondToServerRequestResult, respondToToolCallRequest } from "./tauriDesktopReview";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
  isTauri: vi.fn(() => true),
}));

vi.mock("../application/runtime/ports/tauriEvent", () => ({
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

function installNotificationApiMock(config: {
  permission: NotificationPermission;
  requestPermissionResult?: NotificationPermission;
}) {
  const instances: Array<{ close: ReturnType<typeof vi.fn>; onshow: (() => void) | null }> = [];
  const requestPermission = vi.fn(async () => config.requestPermissionResult ?? config.permission);

  class MockNotification {
    static permission = config.permission;
    static requestPermission = requestPermission;
    onshow: (() => void) | null = null;
    close = vi.fn();

    constructor(
      public readonly title: string,
      public readonly options?: NotificationOptions
    ) {
      instances.push(this);
    }
  }

  vi.stubGlobal("Notification", MockNotification as unknown as typeof Notification);
  return { instances, requestPermission };
}

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

  it("routes runtime health/remote/terminal/bootstrap/live-skill helpers through runtime client", async () => {
    const runtimeHealthMock = vi.fn().mockResolvedValue({
      app: "code-runtime",
      version: "1.2.3",
      status: "ok",
    });
    const runtimeRemoteStatusMock = vi.fn().mockResolvedValue({
      connected: true,
      mode: "local",
      endpoint: null,
      latencyMs: 9,
    });
    const runtimeTerminalStatusMock = vi.fn().mockResolvedValue({
      state: "ready",
      message: "ready",
    });
    const runtimeSettingsMock = vi.fn().mockResolvedValue({
      defaultModelStrategy: "unified-auto-routing",
      remoteEnabled: false,
      defaultReasonEffort: "medium",
      defaultAccessMode: "on-request",
    });
    const runtimeBootstrapMock = vi.fn().mockResolvedValue({ health: { status: "ok" } });
    const runtimeRunLiveSkillMock = vi.fn().mockResolvedValue({
      runId: "run-42",
      skillId: "core-bash",
      status: "completed",
      message: "ok",
      output: "pwd",
      network: null,
      metadata: {},
    });

    vi.mocked(getRuntimeClient).mockReturnValue({
      health: runtimeHealthMock,
      remoteStatus: runtimeRemoteStatusMock,
      terminalStatus: runtimeTerminalStatusMock,
      settings: runtimeSettingsMock,
      bootstrap: runtimeBootstrapMock,
      runLiveSkill: runtimeRunLiveSkillMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(getRuntimeHealth()).resolves.toEqual({
      app: "code-runtime",
      version: "1.2.3",
      status: "ok",
    });
    await expect(getRuntimeRemoteStatus()).resolves.toEqual({
      connected: true,
      mode: "local",
      endpoint: null,
      latencyMs: 9,
    });
    await expect(getRuntimeTerminalStatus()).resolves.toEqual({
      state: "ready",
      message: "ready",
    });
    await expect(getRuntimeSettings()).resolves.toEqual({
      defaultModelStrategy: "unified-auto-routing",
      remoteEnabled: false,
      defaultReasonEffort: "medium",
      defaultAccessMode: "on-request",
    });
    await expect(getRuntimeBootstrapSnapshot()).resolves.toEqual({ health: { status: "ok" } });
    await expect(runRuntimeLiveSkill({ skillId: "core-bash", input: "pwd" })).resolves.toEqual({
      runId: "run-42",
      skillId: "core-bash",
      status: "completed",
      message: "ok",
      output: "pwd",
      network: null,
      metadata: {},
    });

    expect(runtimeHealthMock).toHaveBeenCalledTimes(1);
    expect(runtimeRemoteStatusMock).toHaveBeenCalledTimes(1);
    expect(runtimeTerminalStatusMock).toHaveBeenCalledTimes(1);
    expect(runtimeSettingsMock).toHaveBeenCalledTimes(1);
    expect(runtimeBootstrapMock).toHaveBeenCalledTimes(1);
    expect(runtimeRunLiveSkillMock).toHaveBeenCalledWith({ skillId: "core-bash", input: "pwd" });
  });

  it("routes steerTurn through canonical runtime send with queue mode", async () => {
    const invokeMock = vi.mocked(invoke);
    const runtimeSendTurnMock = vi.fn().mockResolvedValue({
      accepted: true,
      turnId: "turn-queued-2",
      threadId: "thread-1",
      routedProvider: "openai",
      routedModelId: "gpt-5.3-codex",
      routedPool: "codex",
      routedSource: "catalog-default",
      message: "queued",
    });
    vi.mocked(getRuntimeClient).mockReturnValue({
      sendTurn: runtimeSendTurnMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(
      steerTurn("ws-4", "thread-1", "turn-2", "continue", ["image.png"])
    ).resolves.toMatchObject({
      result: {
        accepted: true,
        turnId: "turn-queued-2",
        threadId: "thread-1",
        routedProvider: "openai",
        routedModelId: "gpt-5.3-codex",
        routedPool: "codex",
        routedSource: "catalog-default",
      },
    });

    expect(runtimeSendTurnMock).toHaveBeenCalledWith({
      workspaceId: "ws-4",
      threadId: "thread-1",
      content: "continue",
      contextPrefix: null,
      executionMode: "runtime",
      missionMode: null,
      executionProfileId: null,
      preferredBackendIds: null,
      provider: null,
      modelId: null,
      reasonEffort: null,
      serviceTier: null,
      accessMode: "on-request",
      codexBin: null,
      codexArgs: null,
      queue: true,
      attachments: [
        {
          id: "1",
          name: "image.png",
          mimeType: "application/octet-stream",
          size: 0,
        },
      ],
    });
    expect(invokeMock).not.toHaveBeenCalledWith("turn_steer", expect.anything());
  });

  it("forwards contextPrefix when steering through runtime send", async () => {
    const runtimeSendTurnMock = vi.fn().mockResolvedValue({
      accepted: true,
      turnId: "turn-queued-3",
      threadId: "thread-1",
      routedProvider: null,
      routedModelId: null,
      routedPool: null,
      routedSource: null,
      message: "queued",
    });
    vi.mocked(getRuntimeClient).mockReturnValue({
      sendTurn: runtimeSendTurnMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await steerTurn(
      "ws-4",
      "thread-1",
      "turn-2",
      "continue",
      [],
      "[ATLAS_CONTEXT v1]\n1. plan: noop\n[/ATLAS_CONTEXT]"
    );

    expect(runtimeSendTurnMock).toHaveBeenCalledWith(
      expect.objectContaining({
        contextPrefix: "[ATLAS_CONTEXT v1]\n1. plan: noop\n[/ATLAS_CONTEXT]",
      })
    );
  });

  it("forwards composer options when steering through runtime send", async () => {
    const runtimeSendTurnMock = vi.fn().mockResolvedValue({
      accepted: true,
      turnId: "turn-queued-4",
      threadId: "thread-1",
      routedProvider: "openai",
      routedModelId: "gpt-5.3-codex",
      routedPool: "codex",
      routedSource: "catalog-default",
      message: "queued",
    });
    vi.mocked(getRuntimeClient).mockReturnValue({
      sendTurn: runtimeSendTurnMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await steerTurn("ws-4", "thread-1", "turn-2", "continue", ["image.png"], null, {
      model: "gpt-5.3-codex",
      effort: "high",
      accessMode: "full-access",
      executionMode: "hybrid",
      codexBin: "/opt/codex",
      codexArgs: ["--profile", "fast"],
      collaborationMode: {
        mode: "plan",
        settings: {
          id: "plan",
          developer_instructions: "Stay in planning mode.",
        },
      },
    });

    expect(runtimeSendTurnMock).toHaveBeenCalledWith({
      workspaceId: "ws-4",
      threadId: "thread-1",
      content: "continue",
      contextPrefix: null,
      executionMode: "hybrid",
      missionMode: null,
      executionProfileId: null,
      preferredBackendIds: null,
      provider: null,
      modelId: "gpt-5.3-codex",
      reasonEffort: "high",
      serviceTier: null,
      accessMode: "full-access",
      codexBin: "/opt/codex",
      codexArgs: ["--profile", "fast"],
      queue: true,
      attachments: [
        {
          id: "1",
          name: "image.png",
          mimeType: "application/octet-stream",
          size: 0,
        },
      ],
      collaborationMode: {
        mode: "plan",
        settings: {
          id: "plan",
          developer_instructions: "Stay in planning mode.",
        },
      },
    });
  });

  it("omits delivery when starting reviews without override", async () => {
    await expect(startReview("ws-5", "thread-2", { type: "uncommittedChanges" })).rejects.toThrow(
      "Review start is only available in the desktop app."
    );
  });

  it("rejects review start outside tauri mode", async () => {
    const invokeMock = vi.mocked(invoke);
    vi.mocked(isTauri).mockReturnValue(false);

    await expect(startReview("ws-5", "thread-2", { type: "uncommittedChanges" })).rejects.toThrow(
      "Review start is only available in the desktop app."
    );
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("nests decisions for server request responses", async () => {
    await expect(respondToServerRequest("ws-6", 101, "accept")).rejects.toThrow(
      "Numeric approval requests are unavailable in the Electron desktop host."
    );
  });

  it("routes runtime approval responses through code_runtime_run_checkpoint_approval", async () => {
    const invokeMock = vi.mocked(invoke);
    const runtimeApprovalDecisionMock = vi.fn().mockResolvedValue({
      recorded: true,
      approvalId: "approval-42",
      taskId: "task-1",
      status: "running",
      message: "Recorded",
    });
    vi.mocked(getRuntimeClient).mockReturnValue({
      runtimeRunCheckpointApproval: runtimeApprovalDecisionMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await respondToServerRequest("ws-6", "approval-42", "decline");

    expect(runtimeApprovalDecisionMock).toHaveBeenCalledWith({
      approvalId: "approval-42",
      decision: "rejected",
      reason: null,
    });
    expect(invokeMock).not.toHaveBeenCalledWith("respond_to_server_request", expect.anything());
  });

  it("routes non-prefixed string approvals through code_runtime_run_checkpoint_approval", async () => {
    const invokeMock = vi.mocked(invoke);
    const runtimeApprovalDecisionMock = vi.fn().mockResolvedValue({
      recorded: true,
      approvalId: "runtime-approval-99",
      taskId: "task-1",
      status: "running",
      message: "Recorded",
    });
    vi.mocked(getRuntimeClient).mockReturnValue({
      runtimeRunCheckpointApproval: runtimeApprovalDecisionMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await respondToServerRequest("ws-6", "runtime-approval-99", "accept");

    expect(runtimeApprovalDecisionMock).toHaveBeenCalledWith({
      approvalId: "runtime-approval-99",
      decision: "approved",
      reason: null,
    });
    expect(invokeMock).not.toHaveBeenCalledWith("respond_to_server_request", expect.anything());
  });

  it("nests answers for user input responses", async () => {
    await expect(
      respondToUserInputRequest("ws-7", 202, {
        confirm_path: { answers: ["Yes"] },
      })
    ).rejects.toThrow("User-input request responses are unavailable in the Electron desktop host.");
  });

  it("passes through multiple user input answers", async () => {
    const answers = {
      confirm_path: { answers: ["Yes"] },
      notes: { answers: ["First line", "Second line"] },
    };

    await expect(respondToUserInputRequest("ws-8", 303, answers)).rejects.toThrow(
      "User-input request responses are unavailable in the Electron desktop host."
    );
  });

  it("sends dynamic tool-call responses to respond_to_server_request", async () => {
    await expect(
      respondToToolCallRequest("ws-9", 404, {
        contentItems: [{ type: "inputText", text: "Ticket resolved." }],
        success: true,
      })
    ).rejects.toThrow("Tool-call request responses are unavailable in the Electron desktop host.");
  });

  it("sends arbitrary server-request payloads through respond_to_server_request", async () => {
    await expect(
      respondToServerRequestResult("ws-10", "refresh-77", {
        accessToken: "token-abc",
        chatgptAccountId: "workspace-1",
        chatgptPlanType: "pro",
      })
    ).rejects.toThrow(
      "Server request result replies are unavailable in the Electron desktop host."
    );
  });

  it("sends a notification without re-requesting permission when already granted", async () => {
    const { instances, requestPermission } = installNotificationApiMock({
      permission: "granted",
    });

    await sendNotification("Hello", "World");

    expect(requestPermission).not.toHaveBeenCalled();
    expect(instances).toHaveLength(1);
    expect(instances[0]?.title).toBe("Hello");
    expect(instances[0]?.options).toMatchObject({ body: "World", tag: undefined });
  });

  it("passes extra metadata when provided", async () => {
    const { instances } = installNotificationApiMock({
      permission: "granted",
    });

    await sendNotification("Hello", "World", {
      extra: { kind: "thread", workspaceId: "ws-1", threadId: "t-1" },
    });

    expect(instances).toHaveLength(1);
    expect(instances[0]?.title).toBe("Hello");
    expect(instances[0]?.options).toMatchObject({ body: "World", tag: undefined });
  });

  it("requests permission once when needed and sends on grant", async () => {
    const { instances, requestPermission } = installNotificationApiMock({
      permission: "default",
      requestPermissionResult: "granted",
    });

    await sendNotification("Grant", "Please");

    expect(requestPermission).toHaveBeenCalledTimes(1);
    expect(instances).toHaveLength(1);
    expect(instances[0]?.title).toBe("Grant");
    expect(instances[0]?.options).toMatchObject({ body: "Please", tag: undefined });
  });

  it("prefers websocket runtime turn stream when ws transport is advertised", async () => {
    vi.mocked(listen).mockRejectedValue(new Error("tauri event bridge unavailable"));
    vi.stubEnv("VITE_CODE_RUNTIME_GATEWAY_WEB_ENDPOINT", "http://127.0.0.1:8788/rpc");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            ok: true,
            result: {
              methods: ["code_workspaces_list"],
              transports: {
                rpc: {
                  channel: "rpc",
                  endpointPath: "/rpc",
                  protocol: "json-rpc-over-http-v1",
                  replay: { mode: "none", key: null },
                },
                events: {
                  channel: "events",
                  endpointPath: "/events",
                  protocol: "sse-v1",
                  replay: { mode: "header", key: "Last-Event-ID" },
                },
                ws: {
                  channel: "duplex",
                  endpointPath: "/ws",
                  protocol: "runtime-ws-v1",
                  replay: { mode: "query", key: "lastEventId" },
                },
              },
            },
          }),
          { status: 200 }
        )
      )
    );

    type MessageListener = ((event: { data: unknown }) => void) | null;
    class FakeWebSocket {
      static instance: FakeWebSocket | null = null;
      readonly url: string;
      onmessage: MessageListener = null;
      onopen: ((event: Event) => void) | null = null;
      onclose: ((event: CloseEvent) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;
      closed = false;

      constructor(url: string) {
        this.url = url;
        FakeWebSocket.instance = this;
      }

      close(): void {
        this.closed = true;
      }

      emit(type: "message" | "open", data: unknown): void {
        if (type === "open") {
          this.onopen?.({} as Event);
          return;
        }
        this.onmessage?.({ data });
      }
    }

    class FakeEventSource {
      static instances: FakeEventSource[] = [];
      constructor(public readonly url: string) {
        FakeEventSource.instances.push(this);
      }
      addEventListener(): void {
        // noop
      }
      removeEventListener(): void {
        // noop
      }
      close(): void {
        // noop
      }
    }

    vi.stubGlobal("WebSocket", FakeWebSocket as unknown as typeof WebSocket);
    vi.stubGlobal("EventSource", FakeEventSource as unknown as typeof EventSource);

    const tauri = await import("./tauri");
    const callback = vi.fn();
    const unlisten = await tauri.listenRuntimeTurnEvents(callback);

    expect(FakeWebSocket.instance?.url).toBe("ws://127.0.0.1:8788/ws");
    expect(FakeEventSource.instances).toHaveLength(0);

    FakeWebSocket.instance?.emit(
      "message",
      JSON.stringify({
        type: "runtime.event",
        event: {
          kind: "turn.started",
          payload: {
            turnId: "turn-ws-1",
          },
        },
      })
    );

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "turn.started",
      })
    );

    unlisten();
    expect(FakeWebSocket.instance?.closed).toBe(true);
  });

  it("resolves relative websocket turn stream endpoint against current origin for worker deployments", async () => {
    vi.mocked(listen).mockRejectedValue(new Error("tauri event bridge unavailable"));
    vi.stubEnv("VITE_CODE_RUNTIME_GATEWAY_WEB_ENDPOINT", "/__code_runtime_rpc?token=test#anchor");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            ok: true,
            result: {
              methods: ["code_workspaces_list"],
              transports: {
                ws: {
                  channel: "duplex",
                  endpointPath: "/ws",
                  protocol: "runtime-ws-v1",
                  replay: { mode: "query", key: "lastEventId" },
                },
              },
            },
          }),
          { status: 200 }
        )
      )
    );

    type MessageListener = ((event: { data: unknown }) => void) | null;
    class FakeWebSocket {
      static instance: FakeWebSocket | null = null;
      readonly url: string;
      onmessage: MessageListener = null;
      onopen: ((event: Event) => void) | null = null;
      onclose: ((event: CloseEvent) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;

      constructor(url: string) {
        this.url = url;
        FakeWebSocket.instance = this;
      }

      close(): void {
        // noop
      }
    }

    vi.stubGlobal("WebSocket", FakeWebSocket as unknown as typeof WebSocket);
    vi.stubGlobal("EventSource", undefined);

    const tauri = await import("./tauri");
    const unlisten = await tauri.listenRuntimeTurnEvents(() => undefined);

    const expected = new URL("/ws", window.location.origin);
    expected.protocol = expected.protocol === "https:" ? "wss:" : "ws:";
    expected.searchParams.set("token", "test");
    expect(FakeWebSocket.instance?.url).toBe(expected.toString());

    unlisten();
  });

  it("reconnects websocket runtime turn stream with lastEventId replay query", async () => {
    vi.useFakeTimers();
    try {
      vi.mocked(listen).mockRejectedValue(new Error("tauri event bridge unavailable"));
      vi.stubEnv("VITE_CODE_RUNTIME_GATEWAY_WEB_ENDPOINT", "http://127.0.0.1:8788/rpc");
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          new Response(
            JSON.stringify({
              ok: true,
              result: {
                methods: ["code_workspaces_list"],
                transports: {
                  ws: {
                    channel: "duplex",
                    endpointPath: "/ws",
                    protocol: "runtime-ws-v1",
                    replay: { mode: "query", key: "lastEventId" },
                  },
                },
              },
            }),
            { status: 200 }
          )
        )
      );

      type MessageListener = ((event: { data: unknown }) => void) | null;
      type BasicListener = ((event: Event) => void) | null;
      class FakeWebSocket {
        static instances: FakeWebSocket[] = [];
        readonly url: string;
        onmessage: MessageListener = null;
        onopen: BasicListener = null;
        onclose: ((event: CloseEvent) => void) | null = null;
        onerror: BasicListener = null;
        closed = false;

        constructor(url: string) {
          this.url = url;
          FakeWebSocket.instances.push(this);
        }

        close(): void {
          this.closed = true;
        }

        emit(type: "open" | "close" | "message", data?: unknown): void {
          if (type === "open") {
            this.onopen?.({} as Event);
            return;
          }
          if (type === "close") {
            this.onclose?.({} as CloseEvent);
            return;
          }
          this.onmessage?.({ data });
        }
      }

      vi.stubGlobal("WebSocket", FakeWebSocket as unknown as typeof WebSocket);
      vi.stubGlobal("EventSource", undefined);

      const tauri = await import("./tauri");
      const callback = vi.fn();
      const unlisten = await tauri.listenRuntimeTurnEvents(callback);

      expect(FakeWebSocket.instances).toHaveLength(1);
      const first = FakeWebSocket.instances[0];
      expect(first?.url).toBe("ws://127.0.0.1:8788/ws");
      first?.emit("open");
      first?.emit(
        "message",
        JSON.stringify({
          type: "runtime.event",
          eventId: 42,
          event: {
            kind: "turn.started",
            payload: {
              turnId: "turn-replay-42",
            },
          },
        })
      );
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: "turn.started",
        })
      );

      first?.emit("close");
      await vi.advanceTimersByTimeAsync(400);

      expect(FakeWebSocket.instances).toHaveLength(2);
      const second = FakeWebSocket.instances[1];
      expect(second?.url).toBe("ws://127.0.0.1:8788/ws?lastEventId=42");

      unlisten();
    } finally {
      vi.useRealTimers();
    }
  });

  it("retries web event stream connection when EventSource constructor initially fails", async () => {
    vi.useFakeTimers();
    try {
      vi.mocked(listen).mockRejectedValue(new Error("tauri event bridge unavailable"));
      vi.stubEnv("VITE_CODE_RUNTIME_GATEWAY_WEB_EVENTS_ENDPOINT", "/runtime/events");
      vi.stubGlobal("WebSocket", undefined);

      type EventListenerMap = Record<string, Array<(event: { data: unknown }) => void>>;

      class FakeEventSource {
        static instance: FakeEventSource | null = null;
        static constructorCalls = 0;
        url!: string;
        readonly listeners: EventListenerMap = {};
        closed = false;
        readyState = 0;
        static readonly CLOSED = 2;

        constructor(url: string) {
          FakeEventSource.constructorCalls += 1;
          if (FakeEventSource.constructorCalls === 1) {
            throw new Error("connect failed");
          }
          this.url = url;
          FakeEventSource.instance = this;
        }

        addEventListener(type: string, listener: (event: { data: unknown }) => void): void {
          this.listeners[type] = [...(this.listeners[type] ?? []), listener];
        }

        removeEventListener(type: string, listener: (event: { data: unknown }) => void): void {
          this.listeners[type] = (this.listeners[type] ?? []).filter((entry) => entry !== listener);
        }

        close(): void {
          this.closed = true;
          this.readyState = FakeEventSource.CLOSED;
        }

        emit(type: string, data: unknown): void {
          for (const listener of this.listeners[type] ?? []) {
            listener({ data });
          }
        }
      }

      vi.stubGlobal("EventSource", FakeEventSource as unknown as typeof EventSource);

      const tauri = await import("./tauri");
      const callback = vi.fn();
      const unlisten = await tauri.listenRuntimeTurnEvents(callback);

      await vi.advanceTimersByTimeAsync(400);
      expect(FakeEventSource.constructorCalls).toBeGreaterThanOrEqual(2);
      const eventSource = FakeEventSource.instance;
      expect(eventSource?.url).toBe("/runtime/events");

      eventSource?.emit(
        "message",
        JSON.stringify({
          kind: "turn.started",
          payload: {
            turnId: "turn-reconnect-1",
          },
        })
      );
      expect(callback).toHaveBeenCalledTimes(1);

      unlisten();
      expect(eventSource?.closed).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("retries websocket runtime turn stream after temporary sse fallback", async () => {
    vi.useFakeTimers();
    try {
      vi.mocked(listen).mockRejectedValue(new Error("tauri event bridge unavailable"));
      vi.stubEnv("VITE_CODE_RUNTIME_GATEWAY_WEB_ENDPOINT", "http://127.0.0.1:8788/rpc");
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          new Response(
            JSON.stringify({
              ok: true,
              result: {
                methods: ["code_workspaces_list"],
                transports: {
                  events: { endpointPath: "/events" },
                  ws: { endpointPath: "/ws" },
                },
              },
            }),
            { status: 200 }
          )
        )
      );

      type EventListenerMap = Record<string, Array<(event: { data: unknown }) => void>>;
      class FakeEventSource {
        static readonly CLOSED = 2;
        static instances: FakeEventSource[] = [];
        readonly url: string;
        readonly listeners: EventListenerMap = {};
        readyState = 0;
        closed = false;

        constructor(url: string) {
          this.url = url;
          FakeEventSource.instances.push(this);
        }

        addEventListener(type: string, listener: (event: { data: unknown }) => void): void {
          this.listeners[type] = [...(this.listeners[type] ?? []), listener];
        }

        removeEventListener(type: string, listener: (event: { data: unknown }) => void): void {
          this.listeners[type] = (this.listeners[type] ?? []).filter((entry) => entry !== listener);
        }

        close(): void {
          this.closed = true;
          this.readyState = FakeEventSource.CLOSED;
        }
      }

      type MessageListener = ((event: { data: unknown }) => void) | null;
      type BasicListener = ((event: Event) => void) | null;
      class FlakyWebSocket {
        static instances: FlakyWebSocket[] = [];
        static shouldThrow = true;
        readonly url: string;
        onmessage: MessageListener = null;
        onopen: BasicListener = null;
        onclose: ((event: CloseEvent) => void) | null = null;
        onerror: BasicListener = null;
        closed = false;

        constructor(url: string) {
          if (FlakyWebSocket.shouldThrow) {
            FlakyWebSocket.shouldThrow = false;
            throw new Error("ws unavailable");
          }
          this.url = url;
          FlakyWebSocket.instances.push(this);
        }

        close(): void {
          this.closed = true;
        }
      }

      vi.stubGlobal("EventSource", FakeEventSource as unknown as typeof EventSource);
      vi.stubGlobal("WebSocket", FlakyWebSocket as unknown as typeof WebSocket);

      const tauri = await import("./tauri");
      const callback = vi.fn();
      const unlisten = await tauri.listenRuntimeTurnEvents(callback);

      expect(FakeEventSource.instances).toHaveLength(1);
      const fallbackSource = FakeEventSource.instances[0];
      expect(fallbackSource?.url).toBe("http://127.0.0.1:8788/events");
      expect(fallbackSource?.closed).toBe(false);
      expect(FlakyWebSocket.instances).toHaveLength(0);

      await vi.advanceTimersByTimeAsync(10_000);

      expect(fallbackSource?.closed).toBe(true);
      expect(FlakyWebSocket.instances).toHaveLength(1);
      expect(FlakyWebSocket.instances[0]?.url).toBe("ws://127.0.0.1:8788/ws");

      unlisten();
      expect(FlakyWebSocket.instances[0]?.closed).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
