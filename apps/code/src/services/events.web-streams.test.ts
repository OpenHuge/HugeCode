import { isDesktopHostRuntime } from "@desktop-host/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { __resetRuntimeTurnContextForTests, subscribeAppServerEvents } from "./events";

const PROCESS_ENV = (
  globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }
).process?.env;

const WEB_EVENTS_ENDPOINT_ENV = "VITE_CODE_RUNTIME_GATEWAY_WEB_EVENTS_ENDPOINT";
const WEB_ENDPOINT_ENV = "VITE_CODE_RUNTIME_GATEWAY_WEB_ENDPOINT";
const WEB_WS_ENDPOINT_ENV = "VITE_CODE_RUNTIME_GATEWAY_WEB_WS_ENDPOINT";

const ORIGINAL_EVENT_SOURCE = globalThis.EventSource;
const ORIGINAL_WEB_SOCKET = globalThis.WebSocket;

vi.mock("@desktop-host/event", () => ({
  listen: vi.fn(),
}));

vi.mock("@desktop-host/core", () => ({
  isDesktopHostRuntime: vi.fn(() => true),
}));

class MockEventSource {
  static instances: MockEventSource[] = [];
  onmessage: ((event: MessageEvent<string>) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  closed = false;

  constructor(public readonly url: string | URL) {
    MockEventSource.instances.push(this);
  }

  close() {
    this.closed = true;
  }

  emitMessage(data: string, options?: { lastEventId?: string }) {
    this.onmessage?.({
      data,
      lastEventId: options?.lastEventId ?? "",
    } as MessageEvent<string>);
  }

  reset() {
    this.closed = false;
    this.onmessage = null;
    this.onerror = null;
  }
}

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  onmessage: ((event: MessageEvent<unknown>) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onopen: ((event: Event) => void) | null = null;
  closed = false;

  constructor(public readonly url: string | URL) {
    MockWebSocket.instances.push(this);
  }

  close() {
    this.closed = true;
  }

  emitMessage(data: unknown) {
    this.onmessage?.({ data } as MessageEvent<unknown>);
  }

  emitOpen() {
    this.onopen?.({} as Event);
  }

  emitClose() {
    this.onclose?.({} as CloseEvent);
  }

  reset() {
    this.closed = false;
    this.onmessage = null;
    this.onerror = null;
    this.onclose = null;
    this.onopen = null;
  }
}

function setProcessEnv(key: string, value?: string) {
  if (!PROCESS_ENV) {
    return;
  }
  if (value === undefined) {
    delete PROCESS_ENV[key];
    return;
  }
  PROCESS_ENV[key] = value;
}

async function flushAsyncWork() {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

describe("events subscriptions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(isDesktopHostRuntime).mockReturnValue(true);
    setProcessEnv(WEB_EVENTS_ENDPOINT_ENV, undefined);
    setProcessEnv(WEB_ENDPOINT_ENV, undefined);
    setProcessEnv(WEB_WS_ENDPOINT_ENV, undefined);
    MockEventSource.instances.forEach((source) => {
      source.reset();
    });
    MockEventSource.instances = [];
    MockWebSocket.instances.forEach((socket) => {
      socket.reset();
    });
    MockWebSocket.instances = [];
    __resetRuntimeTurnContextForTests();
    globalThis.EventSource = ORIGINAL_EVENT_SOURCE;
    globalThis.WebSocket = ORIGINAL_WEB_SOCKET;
  });

  it("uses explicit web events endpoint for SSE and adapts runtime-host payloads", async () => {
    vi.mocked(isDesktopHostRuntime).mockReturnValue(false);
    setProcessEnv(WEB_EVENTS_ENDPOINT_ENV, "http://127.0.0.1:8788/events");
    globalThis.EventSource = MockEventSource as unknown as typeof EventSource;

    const onEvent = vi.fn();
    const cleanup = subscribeAppServerEvents(onEvent);
    await flushAsyncWork();
    expect(MockEventSource.instances).toHaveLength(1);
    expect(String(MockEventSource.instances[0]?.url)).toBe("http://127.0.0.1:8788/events");

    MockEventSource.instances[0]?.emitMessage(
      JSON.stringify({
        kind: "turn.started",
        payload: {
          turnId: "thread-web-1",
        },
      })
    );

    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.objectContaining({
          method: "turn/started",
          params: expect.objectContaining({
            threadId: "thread-web-1",
            turnId: "thread-web-1",
          }),
        }),
      })
    );

    cleanup();
    await flushAsyncWork();
    expect(MockEventSource.instances[0]?.closed).toBe(true);
  });

  it("dedupes sse events by last-event-id", async () => {
    vi.mocked(isDesktopHostRuntime).mockReturnValue(false);
    setProcessEnv(WEB_EVENTS_ENDPOINT_ENV, "http://127.0.0.1:8788/events");
    globalThis.EventSource = MockEventSource as unknown as typeof EventSource;

    const onEvent = vi.fn();
    const cleanup = subscribeAppServerEvents(onEvent);
    await flushAsyncWork();
    expect(MockEventSource.instances).toHaveLength(1);

    const payload = JSON.stringify({
      kind: "turn.started",
      payload: {
        turnId: "thread-sse-dedupe-1",
      },
    });
    MockEventSource.instances[0]?.emitMessage(payload, { lastEventId: "evt-1" });
    MockEventSource.instances[0]?.emitMessage(payload, { lastEventId: "evt-1" });

    expect(onEvent).toHaveBeenCalledTimes(1);

    cleanup();
  });

  it("dedupes sse events by payload eventId when last-event-id is absent", async () => {
    vi.mocked(isDesktopHostRuntime).mockReturnValue(false);
    setProcessEnv(WEB_EVENTS_ENDPOINT_ENV, "http://127.0.0.1:8788/events");
    globalThis.EventSource = MockEventSource as unknown as typeof EventSource;

    const onEvent = vi.fn();
    const cleanup = subscribeAppServerEvents(onEvent);
    await flushAsyncWork();
    expect(MockEventSource.instances).toHaveLength(1);

    const payload = JSON.stringify({
      eventId: "evt-payload-9",
      kind: "turn.started",
      payload: {
        turnId: "thread-sse-dedupe-2",
      },
    });
    MockEventSource.instances[0]?.emitMessage(payload);
    MockEventSource.instances[0]?.emitMessage(payload);

    expect(onEvent).toHaveBeenCalledTimes(1);

    cleanup();
  });

  it("preserves native state fabric resync diagnostics from web runtime events", async () => {
    vi.mocked(isDesktopHostRuntime).mockReturnValue(false);
    setProcessEnv(WEB_EVENTS_ENDPOINT_ENV, "http://127.0.0.1:8788/events");
    globalThis.EventSource = MockEventSource as unknown as typeof EventSource;

    const onEvent = vi.fn();
    const cleanup = subscribeAppServerEvents(onEvent);
    await flushAsyncWork();
    expect(MockEventSource.instances).toHaveLength(1);

    MockEventSource.instances[0]?.emitMessage(
      JSON.stringify({
        kind: "native_state_fabric_updated",
        payload: {
          revision: "99",
          scope: ["bootstrap", "threads"],
          reason: "event_replay_gap",
          replayGapLastEventId: "11",
          replay_gap_oldest_event_id: 25,
          stream_lagged_dropped_events: 4,
          backends_total: 7,
          backends_healthy: 6,
          backends_draining: 1,
          placement_failures_total: 2,
          queue_depth: 13,
          access_mode: "on-request",
          routed_provider: "openai",
          execution_mode: "runtime",
          diagnosticReason: "local_access_rejected",
        },
      })
    );

    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.objectContaining({
          method: "native_state_fabric_updated",
          params: expect.objectContaining({
            revision: "99",
            scope: ["bootstrap", "threads"],
            reason: "event_replay_gap",
            replayGapLastEventId: 11,
            replayGapOldestEventId: 25,
            streamLaggedDroppedEvents: 4,
            backendsTotal: 7,
            backendsHealthy: 6,
            backendsDraining: 1,
            placementFailuresTotal: 2,
            queueDepth: 13,
            accessMode: "on-request",
            routedProvider: "openai",
            executionMode: "runtime",
            diagnosticReason: "local_access_rejected",
          }),
        }),
      })
    );

    cleanup();
  });

  it("preserves native state fabric oauth login diagnostics from runtime host events", async () => {
    vi.mocked(isDesktopHostRuntime).mockReturnValue(false);
    setProcessEnv(WEB_EVENTS_ENDPOINT_ENV, "http://127.0.0.1:8788/events");
    globalThis.EventSource = MockEventSource as unknown as typeof EventSource;

    const onEvent = vi.fn();
    const cleanup = subscribeAppServerEvents(onEvent);
    await flushAsyncWork();
    expect(MockEventSource.instances).toHaveLength(1);

    MockEventSource.instances[0]?.emitMessage(
      JSON.stringify({
        kind: "native_state_fabric_updated",
        payload: {
          revision: "100",
          scope: ["oauth", "bootstrap"],
          reason: "oauth_codex_login_failed",
          oauthLoginSuccess: false,
          oauth_login_id: "login-100",
          oauth_login_error: "OAuth token exchange failed.",
        },
      })
    );

    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.objectContaining({
          method: "native_state_fabric_updated",
          params: expect.objectContaining({
            revision: "100",
            scope: ["oauth", "bootstrap"],
            reason: "oauth_codex_login_failed",
            oauthLoginSuccess: false,
            oauthLoginId: "login-100",
            oauthLoginError: "OAuth token exchange failed.",
          }),
        }),
      })
    );

    cleanup();
  });

  it("preserves native state fabric durability degraded diagnostics from runtime host events", async () => {
    vi.mocked(isDesktopHostRuntime).mockReturnValue(false);
    setProcessEnv(WEB_EVENTS_ENDPOINT_ENV, "http://127.0.0.1:8788/events");
    globalThis.EventSource = MockEventSource as unknown as typeof EventSource;

    const onEvent = vi.fn();
    const cleanup = subscribeAppServerEvents(onEvent);
    await flushAsyncWork();
    expect(MockEventSource.instances).toHaveLength(1);

    MockEventSource.instances[0]?.emitMessage(
      JSON.stringify({
        kind: "native_state_fabric_updated",
        emittedAt: "2026-02-17T12:34:56.000Z",
        payload: {
          revision: "101",
          scope: ["agents"],
          reason: "agent_task_durability_degraded",
          workspace_id: "ws-durability-101",
          mode: "active",
          degraded: true,
          checkpoint_write_total: 42,
          checkpoint_write_failed_total: 6,
          agent_task_checkpoint_recover_total: 4,
          subagentCheckpointRecoverTotal: 2,
          runtimeRecoveryInterruptTotal: 1,
          agentTaskResumeTotal: 9,
          agent_task_resume_failed_total: 3,
        },
      })
    );

    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.objectContaining({
          method: "native_state_fabric_updated",
          params: expect.objectContaining({
            revision: "101",
            scope: ["agents"],
            reason: "agent_task_durability_degraded",
            workspaceId: "ws-durability-101",
            updatedAt: 1771331696000,
            mode: "active",
            degraded: true,
            checkpointWriteTotal: 42,
            checkpointWriteFailedTotal: 6,
            agentTaskCheckpointRecoverTotal: 4,
            subagentCheckpointRecoverTotal: 2,
            runtimeRecoveryInterruptTotal: 1,
            agentTaskResumeTotal: 9,
            agentTaskResumeFailedTotal: 3,
          }),
        }),
      })
    );

    cleanup();
  });

  it("preserves remote execution diagnostics from turn terminal events", async () => {
    vi.mocked(isDesktopHostRuntime).mockReturnValue(false);
    setProcessEnv(WEB_EVENTS_ENDPOINT_ENV, "http://127.0.0.1:8788/events");
    globalThis.EventSource = MockEventSource as unknown as typeof EventSource;

    const onEvent = vi.fn();
    const cleanup = subscribeAppServerEvents(onEvent);
    await flushAsyncWork();
    expect(MockEventSource.instances).toHaveLength(1);

    MockEventSource.instances[0]?.emitMessage(
      JSON.stringify({
        kind: "turn.failed",
        payload: {
          turnId: "turn-remote-1",
          error: {
            code: "TURN_EXECUTION_FAILED",
            message: "Provider rejected local host access",
          },
          accessMode: "full-access",
          routedProvider: "openai",
          executionMode: "runtime",
        },
      })
    );

    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.objectContaining({
          method: "error",
          params: expect.objectContaining({
            turnId: "turn-remote-1",
            accessMode: "full-access",
            routedProvider: "openai",
            executionMode: "runtime",
          }),
        }),
      })
    );

    cleanup();
  });

  it("prefers web runtime websocket stream when capabilities expose ws transport", async () => {
    vi.mocked(isDesktopHostRuntime).mockReturnValue(false);
    setProcessEnv(WEB_ENDPOINT_ENV, "http://127.0.0.1:8788/rpc");
    globalThis.EventSource = MockEventSource as unknown as typeof EventSource;
    globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          ok: true,
          result: {
            methods: ["code_workspaces_list"],
            transports: {
              events: { endpointPath: "/events" },
              ws: { endpointPath: "/ws" },
            },
          },
        }),
      } as Response)
    );

    const onEvent = vi.fn();
    const cleanup = subscribeAppServerEvents(onEvent);
    await flushAsyncWork();

    expect(MockWebSocket.instances).toHaveLength(1);
    expect(String(MockWebSocket.instances[0]?.url)).toBe("ws://127.0.0.1:8788/ws");
    expect(MockEventSource.instances).toHaveLength(0);

    MockWebSocket.instances[0]?.emitMessage(
      JSON.stringify({
        type: "runtime.event",
        event: {
          kind: "turn.started",
          payload: {
            turnId: "thread-ws-1",
          },
        },
      })
    );

    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.objectContaining({
          method: "turn/started",
          params: expect.objectContaining({
            turnId: "thread-ws-1",
            threadId: "thread-ws-1",
          }),
        }),
      })
    );

    cleanup();
    expect(MockWebSocket.instances[0]?.closed).toBe(true);
  });

  it("resolves relative websocket events endpoint against current origin for worker deployments", async () => {
    vi.mocked(isDesktopHostRuntime).mockReturnValue(false);
    setProcessEnv(WEB_ENDPOINT_ENV, "/__code_runtime_rpc?token=test#anchor");
    globalThis.EventSource = MockEventSource as unknown as typeof EventSource;
    globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          ok: true,
          result: {
            methods: ["code_workspaces_list"],
            transports: {
              events: { endpointPath: "/events" },
              ws: { endpointPath: "/ws" },
            },
          },
        }),
      } as Response)
    );

    const cleanup = subscribeAppServerEvents(() => undefined);
    await flushAsyncWork();

    const expected = new URL("/ws", window.location.origin);
    expected.protocol = expected.protocol === "https:" ? "wss:" : "ws:";
    expected.searchParams.set("token", "test");
    expect(MockWebSocket.instances).toHaveLength(1);
    expect(String(MockWebSocket.instances[0]?.url)).toBe(expected.toString());
    expect(MockEventSource.instances).toHaveLength(0);

    cleanup();
  });

  it("reconnects websocket app event stream with lastEventId replay query", async () => {
    vi.useFakeTimers();
    try {
      vi.mocked(isDesktopHostRuntime).mockReturnValue(false);
      setProcessEnv(WEB_ENDPOINT_ENV, "http://127.0.0.1:8788/rpc");
      globalThis.EventSource = MockEventSource as unknown as typeof EventSource;
      globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket;
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({
            ok: true,
            result: {
              methods: ["code_workspaces_list"],
              transports: {
                events: { endpointPath: "/events" },
                ws: { endpointPath: "/ws" },
              },
            },
          }),
        } as Response)
      );

      const onEvent = vi.fn();
      const cleanup = subscribeAppServerEvents(onEvent);
      for (let index = 0; index < 6; index += 1) {
        await Promise.resolve();
      }

      expect(MockWebSocket.instances).toHaveLength(1);
      expect(String(MockWebSocket.instances[0]?.url)).toBe("ws://127.0.0.1:8788/ws");

      MockWebSocket.instances[0]?.emitOpen();
      MockWebSocket.instances[0]?.emitMessage(
        JSON.stringify({
          type: "runtime.event",
          eventId: 42,
          event: {
            kind: "turn.started",
            payload: {
              turnId: "thread-replay-42",
            },
          },
        })
      );
      expect(onEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.objectContaining({
            method: "turn/started",
            params: expect.objectContaining({
              turnId: "thread-replay-42",
            }),
          }),
        })
      );

      MockWebSocket.instances[0]?.emitClose();
      await vi.advanceTimersByTimeAsync(400);

      expect(MockWebSocket.instances).toHaveLength(2);
      expect(String(MockWebSocket.instances[1]?.url)).toBe("ws://127.0.0.1:8788/ws?lastEventId=42");

      cleanup();
    } finally {
      vi.useRealTimers();
    }
  });

  it("dedupes websocket replay events by event id across reconnect", async () => {
    vi.useFakeTimers();
    try {
      vi.mocked(isDesktopHostRuntime).mockReturnValue(false);
      setProcessEnv(WEB_ENDPOINT_ENV, "http://127.0.0.1:8788/rpc");
      globalThis.EventSource = MockEventSource as unknown as typeof EventSource;
      globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket;
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({
            ok: true,
            result: {
              methods: ["code_workspaces_list"],
              transports: {
                events: { endpointPath: "/events" },
                ws: { endpointPath: "/ws" },
              },
            },
          }),
        } as Response)
      );

      const onEvent = vi.fn();
      const cleanup = subscribeAppServerEvents(onEvent);
      for (let index = 0; index < 6; index += 1) {
        await Promise.resolve();
      }

      MockWebSocket.instances[0]?.emitOpen();

      const dedupePayload = JSON.stringify({
        type: "runtime.event",
        eventId: 77,
        event: {
          kind: "turn.started",
          payload: {
            turnId: "thread-ws-dedupe-1",
          },
        },
      });

      MockWebSocket.instances[0]?.emitMessage(dedupePayload);
      MockWebSocket.instances[0]?.emitMessage(dedupePayload);

      expect(onEvent).toHaveBeenCalledTimes(1);

      MockWebSocket.instances[0]?.emitClose();
      await vi.advanceTimersByTimeAsync(400);
      expect(MockWebSocket.instances).toHaveLength(2);

      MockWebSocket.instances[1]?.emitOpen();
      MockWebSocket.instances[1]?.emitMessage(dedupePayload);
      expect(onEvent).toHaveBeenCalledTimes(2); // +1 reconnect native state fabric only

      MockWebSocket.instances[1]?.emitMessage(
        JSON.stringify({
          type: "runtime.event",
          eventId: 78,
          event: {
            kind: "turn.started",
            payload: {
              turnId: "thread-ws-dedupe-2",
            },
          },
        })
      );
      expect(onEvent).toHaveBeenCalledTimes(3);

      cleanup();
    } finally {
      vi.useRealTimers();
    }
  });

  it("emits native state fabric after websocket app event stream reconnects", async () => {
    vi.useFakeTimers();
    try {
      vi.mocked(isDesktopHostRuntime).mockReturnValue(false);
      setProcessEnv(WEB_ENDPOINT_ENV, "http://127.0.0.1:8788/rpc");
      globalThis.EventSource = MockEventSource as unknown as typeof EventSource;
      globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket;
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({
            ok: true,
            result: {
              methods: ["code_workspaces_list"],
              transports: {
                events: { endpointPath: "/events" },
                ws: { endpointPath: "/ws" },
              },
            },
          }),
        } as Response)
      );

      const onEvent = vi.fn();
      const cleanup = subscribeAppServerEvents(onEvent);
      for (let index = 0; index < 6; index += 1) {
        await Promise.resolve();
      }

      expect(MockWebSocket.instances).toHaveLength(1);
      MockWebSocket.instances[0]?.emitOpen();
      expect(onEvent).not.toHaveBeenCalled();

      MockWebSocket.instances[0]?.emitClose();
      await vi.advanceTimersByTimeAsync(400);
      expect(MockWebSocket.instances).toHaveLength(2);

      MockWebSocket.instances[1]?.emitOpen();
      expect(onEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          workspace_id: "workspace-local",
          message: expect.objectContaining({
            method: "native_state_fabric_updated",
            params: expect.objectContaining({
              reason: "stream_reconnected",
              scope: ["bootstrap", "workspaces", "threads", "agents", "models", "oauth", "prompts"],
            }),
          }),
        })
      );

      cleanup();
    } finally {
      vi.useRealTimers();
    }
  });

  it("falls back to sse when websocket connection setup fails", async () => {
    vi.mocked(isDesktopHostRuntime).mockReturnValue(false);
    setProcessEnv(WEB_ENDPOINT_ENV, "http://127.0.0.1:8788/rpc");
    globalThis.EventSource = MockEventSource as unknown as typeof EventSource;
    class ThrowingWebSocket {
      constructor() {
        throw new Error("ws unavailable");
      }
    }
    globalThis.WebSocket = ThrowingWebSocket as unknown as typeof WebSocket;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          ok: true,
          result: {
            methods: ["code_workspaces_list"],
            transports: {
              events: { endpointPath: "/events" },
              ws: { endpointPath: "/ws" },
            },
          },
        }),
      } as Response)
    );

    const onEvent = vi.fn();
    const onError = vi.fn();
    const cleanup = subscribeAppServerEvents(onEvent, { onError });
    await flushAsyncWork();

    expect(onError).toHaveBeenCalled();
    expect(MockEventSource.instances).toHaveLength(1);
    expect(String(MockEventSource.instances[0]?.url)).toBe("http://127.0.0.1:8788/events");

    MockEventSource.instances[0]?.emitMessage(
      JSON.stringify({
        kind: "turn.started",
        payload: {
          turnId: "thread-sse-fallback-1",
        },
      })
    );
    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.objectContaining({
          method: "turn/started",
        }),
      })
    );

    cleanup();
    expect(MockEventSource.instances[0]?.closed).toBe(true);
  });

  it("retries websocket after temporary sse fallback", async () => {
    vi.useFakeTimers();
    let cleanup: (() => void) | null = null;
    try {
      vi.mocked(isDesktopHostRuntime).mockReturnValue(false);
      setProcessEnv(WEB_ENDPOINT_ENV, "http://127.0.0.1:8788/rpc");
      globalThis.EventSource = MockEventSource as unknown as typeof EventSource;
      class FlakyWebSocket extends MockWebSocket {
        static shouldThrow = true;

        constructor(url: string | URL) {
          if (FlakyWebSocket.shouldThrow) {
            FlakyWebSocket.shouldThrow = false;
            throw new Error("ws unavailable");
          }
          super(url);
        }
      }
      globalThis.WebSocket = FlakyWebSocket as unknown as typeof WebSocket;
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({
            ok: true,
            result: {
              methods: ["code_workspaces_list"],
              transports: {
                events: { endpointPath: "/events" },
                ws: { endpointPath: "/ws" },
              },
            },
          }),
        } as Response)
      );

      const onEvent = vi.fn();
      cleanup = subscribeAppServerEvents(onEvent);
      await vi.advanceTimersByTimeAsync(0);

      expect(MockEventSource.instances).toHaveLength(1);
      const fallbackSource = MockEventSource.instances[0];
      expect(fallbackSource?.closed).toBe(false);
      expect(MockWebSocket.instances).toHaveLength(0);

      await vi.advanceTimersByTimeAsync(10_000);

      expect(fallbackSource?.closed).toBe(true);
      expect(MockWebSocket.instances).toHaveLength(1);
      expect(String(MockWebSocket.instances[0]?.url)).toBe("ws://127.0.0.1:8788/ws");
    } finally {
      cleanup?.();
      vi.useRealTimers();
    }
  });

  it("reopens sse fallback with lastEventId replay query after websocket probe failure", async () => {
    vi.useFakeTimers();
    let cleanup: (() => void) | null = null;
    try {
      vi.mocked(isDesktopHostRuntime).mockReturnValue(false);
      setProcessEnv(WEB_ENDPOINT_ENV, "http://127.0.0.1:8788/rpc");
      globalThis.EventSource = MockEventSource as unknown as typeof EventSource;
      class TwiceThrowingWebSocket extends MockWebSocket {
        static failuresRemaining = 2;

        constructor(url: string | URL) {
          if (TwiceThrowingWebSocket.failuresRemaining > 0) {
            TwiceThrowingWebSocket.failuresRemaining -= 1;
            throw new Error("ws unavailable");
          }
          super(url);
        }
      }
      globalThis.WebSocket = TwiceThrowingWebSocket as unknown as typeof WebSocket;
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({
            ok: true,
            result: {
              methods: ["code_workspaces_list"],
              transports: {
                events: { endpointPath: "/events" },
                ws: { endpointPath: "/ws" },
              },
            },
          }),
        } as Response)
      );

      cleanup = subscribeAppServerEvents(vi.fn());
      await vi.advanceTimersByTimeAsync(0);

      expect(MockEventSource.instances).toHaveLength(1);
      MockEventSource.instances[0]?.emitMessage(
        JSON.stringify({
          kind: "turn.started",
          payload: {
            turnId: "thread-sse-replay-query-v1",
          },
        }),
        { lastEventId: "88" }
      );

      await vi.advanceTimersByTimeAsync(10_000);

      expect(MockEventSource.instances[0]?.closed).toBe(true);
      expect(MockEventSource.instances).toHaveLength(2);
      expect(String(MockEventSource.instances[1]?.url)).toBe(
        "http://127.0.0.1:8788/events?lastEventId=88"
      );
      expect(MockWebSocket.instances).toHaveLength(0);
    } finally {
      cleanup?.();
      vi.useRealTimers();
    }
  });

  it("retries app-server bridge startup after initial stream setup failure", async () => {
    vi.useFakeTimers();
    let cleanup: (() => void) | null = null;
    let eventSourceReadCount = 0;
    try {
      vi.mocked(isDesktopHostRuntime).mockReturnValue(false);
      setProcessEnv(WEB_EVENTS_ENDPOINT_ENV, "http://127.0.0.1:8788/events");
      setProcessEnv(WEB_ENDPOINT_ENV, undefined);
      setProcessEnv(WEB_WS_ENDPOINT_ENV, undefined);
      globalThis.WebSocket = undefined as unknown as typeof WebSocket;
      Object.defineProperty(globalThis, "EventSource", {
        configurable: true,
        get() {
          eventSourceReadCount += 1;
          if (eventSourceReadCount === 1) {
            throw new Error("eventsource unavailable");
          }
          return MockEventSource;
        },
      });

      const onEvent = vi.fn();
      const onError = vi.fn();
      cleanup = subscribeAppServerEvents(onEvent, { onError });
      await vi.advanceTimersByTimeAsync(0);

      expect(onError).toHaveBeenCalledTimes(1);
      expect(MockEventSource.instances).toHaveLength(0);

      await vi.advanceTimersByTimeAsync(400);
      expect(MockEventSource.instances).toHaveLength(1);

      MockEventSource.instances[0]?.emitMessage(
        JSON.stringify({
          kind: "turn.started",
          payload: {
            turnId: "thread-retry-startup-1",
          },
        })
      );

      expect(onEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.objectContaining({
            method: "turn/started",
            params: expect.objectContaining({
              turnId: "thread-retry-startup-1",
            }),
          }),
        })
      );
    } finally {
      cleanup?.();
      Object.defineProperty(globalThis, "EventSource", {
        configurable: true,
        writable: true,
        value: ORIGINAL_EVENT_SOURCE,
      });
      vi.useRealTimers();
    }
  });

  it("keeps bridge startup retry active when onError callback throws", async () => {
    vi.useFakeTimers();
    let cleanup: (() => void) | null = null;
    let eventSourceReadCount = 0;
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      vi.mocked(isDesktopHostRuntime).mockReturnValue(false);
      setProcessEnv(WEB_EVENTS_ENDPOINT_ENV, "http://127.0.0.1:8788/events");
      setProcessEnv(WEB_ENDPOINT_ENV, undefined);
      setProcessEnv(WEB_WS_ENDPOINT_ENV, undefined);
      globalThis.WebSocket = undefined as unknown as typeof WebSocket;
      Object.defineProperty(globalThis, "EventSource", {
        configurable: true,
        get() {
          eventSourceReadCount += 1;
          if (eventSourceReadCount === 1) {
            throw new Error("eventsource unavailable");
          }
          return MockEventSource;
        },
      });

      const onEvent = vi.fn();
      const onError = vi.fn(() => {
        throw new Error("onError handler crashed");
      });
      cleanup = subscribeAppServerEvents(onEvent, { onError });
      await vi.advanceTimersByTimeAsync(0);

      expect(onError).toHaveBeenCalledTimes(1);
      expect(MockEventSource.instances).toHaveLength(0);

      await vi.advanceTimersByTimeAsync(400);
      expect(MockEventSource.instances).toHaveLength(1);

      MockEventSource.instances[0]?.emitMessage(
        JSON.stringify({
          kind: "turn.started",
          payload: {
            turnId: "thread-retry-onerror-1",
          },
        })
      );

      expect(onEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.objectContaining({
            method: "turn/started",
            params: expect.objectContaining({
              turnId: "thread-retry-onerror-1",
            }),
          }),
        })
      );
    } finally {
      errorSpy.mockRestore();
      cleanup?.();
      Object.defineProperty(globalThis, "EventSource", {
        configurable: true,
        writable: true,
        value: ORIGINAL_EVENT_SOURCE,
      });
      vi.useRealTimers();
    }
  });

  it("derives web events endpoint from web rpc endpoint", async () => {
    vi.mocked(isDesktopHostRuntime).mockReturnValue(false);
    setProcessEnv(WEB_ENDPOINT_ENV, "http://127.0.0.1:8788/rpc");
    globalThis.EventSource = MockEventSource as unknown as typeof EventSource;
    globalThis.WebSocket = undefined as unknown as typeof WebSocket;
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("capabilities probe unavailable")));

    const cleanup = subscribeAppServerEvents(() => undefined);
    await flushAsyncWork();

    expect(MockEventSource.instances).toHaveLength(1);
    expect(String(MockEventSource.instances[0]?.url)).toBe("http://127.0.0.1:8788/events");

    cleanup();
  });

  it("derives web events endpoint from underscore rpc endpoint alias", async () => {
    vi.mocked(isDesktopHostRuntime).mockReturnValue(false);
    setProcessEnv(WEB_ENDPOINT_ENV, "/__code_runtime_rpc");
    globalThis.EventSource = MockEventSource as unknown as typeof EventSource;
    globalThis.WebSocket = undefined as unknown as typeof WebSocket;
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("capabilities probe unavailable")));

    const cleanup = subscribeAppServerEvents(() => undefined);
    await flushAsyncWork();

    expect(MockEventSource.instances).toHaveLength(1);
    expect(String(MockEventSource.instances[0]?.url)).toBe("/__code_runtime_events");

    cleanup();
  });

  it("gracefully no-ops in non-desktop-host mode when no web endpoint is configured", () => {
    vi.mocked(isDesktopHostRuntime).mockReturnValue(false);

    const onEvent = vi.fn();
    const onError = vi.fn();
    const cleanup = subscribeAppServerEvents(onEvent, { onError });

    expect(onEvent).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
    expect(MockEventSource.instances).toHaveLength(0);
    cleanup();
  });
});
