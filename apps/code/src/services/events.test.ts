import { isTauri } from "@tauri-apps/api/core";
import type { EventCallback, Event as TauriEvent, UnlistenFn } from "@tauri-apps/api/event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppServerEvent } from "../types";
import { listen } from "../application/runtime/ports/desktopHostEvent";
import {
  __resetEventSubscriptionsForTests,
  __resetRuntimeTurnContextForTests,
  registerRuntimeTurnRequestContext,
  subscribeAppServerEvents,
  subscribeMenuCycleCollaborationMode,
  subscribeMenuCycleModel,
  subscribeMenuNewAgent,
} from "./events";

const PROCESS_ENV = (
  globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }
).process?.env;

const WEB_EVENTS_ENDPOINT_ENV = "VITE_CODE_RUNTIME_GATEWAY_WEB_EVENTS_ENDPOINT";
const WEB_ENDPOINT_ENV = "VITE_CODE_RUNTIME_GATEWAY_WEB_ENDPOINT";
const WEB_WS_ENDPOINT_ENV = "VITE_CODE_RUNTIME_GATEWAY_WEB_WS_ENDPOINT";

const ORIGINAL_EVENT_SOURCE = globalThis.EventSource;
const ORIGINAL_WEB_SOCKET = globalThis.WebSocket;

vi.mock("../application/runtime/ports/desktopHostEvent", () => ({
  listen: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  isTauri: vi.fn(() => true),
}));

class MockEventSource {
  static instances: MockEventSource[] = [];
  onmessage: ((event: MessageEvent<string>) => void) | null = null;
  onerror: ((event: globalThis.Event) => void) | null = null;
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
  onerror: ((event: globalThis.Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onopen: ((event: globalThis.Event) => void) | null = null;
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
    this.onopen?.({} as globalThis.Event);
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

describe("events subscriptions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(isTauri).mockReturnValue(true);
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
    __resetEventSubscriptionsForTests();
    globalThis.EventSource = ORIGINAL_EVENT_SOURCE;
    globalThis.WebSocket = ORIGINAL_WEB_SOCKET;
    (
      window as Window & {
        __TAURI_INTERNALS__?: unknown;
      }
    ).__TAURI_INTERNALS__ = {
      invoke: vi.fn(),
    };
  });

  it("delivers payloads and unsubscribes on cleanup", async () => {
    vi.mocked(isTauri).mockReturnValue(true);
    let listener: EventCallback<unknown> = () => undefined;
    const unlistenRuntime = vi.fn();

    vi.mocked(listen).mockImplementation((eventName, handler) => {
      if (eventName === "fastcode://runtime/event") {
        listener = handler as EventCallback<unknown>;
        return Promise.resolve(unlistenRuntime);
      }
      return Promise.resolve(vi.fn());
    });

    const onEvent = vi.fn();
    const cleanup = subscribeAppServerEvents(onEvent);
    await Promise.resolve();
    expect(listen).toHaveBeenCalledWith("fastcode://runtime/event", expect.any(Function));

    const event: TauriEvent<unknown> = {
      event: "fastcode://runtime/event",
      id: 1,
      payload: {
        workspace_id: "ws-1",
        message: { method: "ping" },
      } satisfies AppServerEvent,
    };
    listener(event);
    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        workspace_id: "ws-1",
        message: expect.objectContaining({ method: "ping" }),
      })
    );

    cleanup();
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
    expect(unlistenRuntime).toHaveBeenCalledTimes(1);
  });

  it("cleans up listeners that resolve after unsubscribe", async () => {
    let resolveListener: (handler: UnlistenFn) => void = () => undefined;
    const unlisten = vi.fn();

    vi.mocked(listen).mockImplementation(
      () =>
        new Promise<UnlistenFn>((resolve) => {
          resolveListener = resolve;
        })
    );

    const cleanup = subscribeMenuNewAgent(() => undefined);
    cleanup();

    resolveListener(unlisten);
    await Promise.resolve();
    expect(unlisten).toHaveBeenCalledTimes(1);
  });

  it("delivers menu events to subscribers", async () => {
    let listener: EventCallback<void> = () => undefined;
    const unlisten = vi.fn();

    vi.mocked(listen).mockImplementation((_event, handler) => {
      listener = handler as EventCallback<void>;
      return Promise.resolve(unlisten);
    });

    const onEvent = vi.fn();
    const cleanup = subscribeMenuCycleModel(onEvent);

    const event: TauriEvent<void> = {
      event: "menu-composer-cycle-model",
      id: 1,
      payload: undefined,
    };
    listener(event);
    expect(onEvent).toHaveBeenCalledTimes(1);

    cleanup();
  });

  it("delivers collaboration cycle menu events to subscribers", async () => {
    let listener: EventCallback<void> = () => undefined;
    const unlisten = vi.fn();

    vi.mocked(listen).mockImplementation((_event, handler) => {
      listener = handler as EventCallback<void>;
      return Promise.resolve(unlisten);
    });

    const onEvent = vi.fn();
    const cleanup = subscribeMenuCycleCollaborationMode(onEvent);

    const event: TauriEvent<void> = {
      event: "menu-composer-cycle-collaboration",
      id: 1,
      payload: undefined,
    };
    listener(event);
    expect(onEvent).toHaveBeenCalledTimes(1);

    cleanup();
  });

  it("reports app-server listener startup failure through options", async () => {
    vi.useFakeTimers();

    try {
      vi.mocked(isTauri).mockReturnValue(true);
      vi.mocked(listen).mockRejectedValueOnce(new Error("listen startup failure"));

      const onEvent = vi.fn();
      const onError = vi.fn();
      const cleanup = subscribeAppServerEvents(onEvent, { onError });

      await vi.advanceTimersByTimeAsync(0);
      await Promise.resolve();
      await Promise.resolve();
      expect(onError).toHaveBeenCalledTimes(1);
      expect(listen).toHaveBeenCalledTimes(1);

      cleanup();
    } finally {
      vi.useRealTimers();
    }
  });

  it("adapts runtime-host turn events into app-server payloads", async () => {
    let runtimeListener: EventCallback<unknown> = () => undefined;

    vi.mocked(listen).mockImplementation((eventName, handler) => {
      if (eventName === "fastcode://runtime/event") {
        runtimeListener = handler as EventCallback<unknown>;
      }
      return Promise.resolve(vi.fn());
    });

    const onEvent = vi.fn();
    const cleanup = subscribeAppServerEvents(onEvent);
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    runtimeListener({
      event: "fastcode://runtime/event",
      id: 1,
      payload: {
        kind: "item.agentMessage.delta",
        requestId: "req-7",
        payload: {
          turnId: "thread-7",
          stepIndex: 2,
          transient: true,
          delta: "hello runtime",
        },
      },
    } as TauriEvent<unknown>);

    runtimeListener({
      event: "fastcode://runtime/event",
      id: 2,
      payload: {
        kind: "turn.completed",
        payload: {
          turnId: "thread-7",
        },
      },
    } as TauriEvent<unknown>);

    runtimeListener({
      event: "fastcode://runtime/event",
      id: 3,
      payload: {
        kind: "turn.failed",
        payload: {
          turnId: "thread-7",
          error: {
            code: "TURN_EXECUTION_FAILED",
            message: "boom",
          },
        },
      },
    } as TauriEvent<unknown>);

    expect(onEvent).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        workspace_id: "workspace-local",
        message: expect.objectContaining({
          id: "req-7",
          method: "item/agentMessage/delta",
          params: expect.objectContaining({
            threadId: "thread-7",
            turnId: "thread-7",
            itemId: "thread-7",
            stepIndex: 2,
            transient: true,
            delta: "hello runtime",
          }),
        }),
      })
    );
    expect(onEvent).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        workspace_id: "workspace-local",
        message: expect.objectContaining({
          method: "turn/completed",
          params: expect.objectContaining({
            threadId: "thread-7",
            turnId: "thread-7",
          }),
        }),
      })
    );
    expect(onEvent).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        workspace_id: "workspace-local",
        message: expect.objectContaining({
          method: "error",
          params: expect.objectContaining({
            threadId: "thread-7",
            turnId: "thread-7",
            error: expect.objectContaining({
              code: "TURN_EXECUTION_FAILED",
              message: "boom",
            }),
            willRetry: false,
          }),
        }),
      })
    );

    cleanup();
  });

  it("resolves runtime-host turn context from registered request mappings", async () => {
    let runtimeListener: EventCallback<unknown> = () => undefined;

    vi.mocked(listen).mockImplementation((eventName, handler) => {
      if (eventName === "fastcode://runtime/event") {
        runtimeListener = handler as EventCallback<unknown>;
      }
      return Promise.resolve(vi.fn());
    });

    const onEvent = vi.fn();
    const cleanup = subscribeAppServerEvents(onEvent);
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    registerRuntimeTurnRequestContext("req-map-1", "workspace-web", "thread-web-1");

    runtimeListener({
      event: "fastcode://runtime/event",
      id: 1,
      payload: {
        kind: "turn.started",
        requestId: "req-map-1",
        payload: {
          turnId: "turn-map-1",
        },
      },
    } as TauriEvent<unknown>);

    runtimeListener({
      event: "fastcode://runtime/event",
      id: 2,
      payload: {
        kind: "turn.completed",
        requestId: "req-map-1",
        payload: {
          turnId: "turn-map-1",
        },
      },
    } as TauriEvent<unknown>);

    expect(onEvent).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        workspace_id: "workspace-web",
        message: expect.objectContaining({
          id: "req-map-1",
          method: "turn/started",
          params: expect.objectContaining({
            threadId: "thread-web-1",
            turnId: "turn-map-1",
          }),
        }),
      })
    );

    expect(onEvent).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        workspace_id: "workspace-web",
        message: expect.objectContaining({
          id: "req-map-1",
          method: "turn/completed",
          params: expect.objectContaining({
            threadId: "thread-web-1",
            turnId: "turn-map-1",
          }),
        }),
      })
    );

    cleanup();
  });

  it("adapts runtime-host tool and approval events into app-server payloads", async () => {
    let runtimeListener: EventCallback<unknown> = () => undefined;

    vi.mocked(listen).mockImplementation((eventName, handler) => {
      if (eventName === "fastcode://runtime/event") {
        runtimeListener = handler as EventCallback<unknown>;
      }
      return Promise.resolve(vi.fn());
    });

    const onEvent = vi.fn();
    const cleanup = subscribeAppServerEvents(onEvent);
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
    registerRuntimeTurnRequestContext("req-tool-1", "workspace-local", "thread-tool-1");
    registerRuntimeTurnRequestContext("req-approval-legacy", "workspace-local", "thread-tool-1");

    runtimeListener({
      event: "fastcode://runtime/event",
      id: 1,
      payload: {
        kind: "item.started",
        requestId: "req-tool-1",
        payload: {
          turnId: "turn-tool-1",
          toolCallId: "tool-call-1",
          toolName: "bash",
          input: {
            command: "echo runtime",
          },
        },
      },
    } as TauriEvent<unknown>);

    runtimeListener({
      event: "fastcode://runtime/event",
      id: 2,
      payload: {
        kind: "item.completed",
        requestId: "req-tool-1",
        payload: {
          turnId: "turn-tool-1",
          toolCallId: "tool-call-1",
          toolName: "bash",
          ok: true,
          output: {
            stdout: "runtime",
          },
        },
      },
    } as TauriEvent<unknown>);

    runtimeListener({
      event: "fastcode://runtime/event",
      id: 3,
      payload: {
        kind: "approval.required",
        requestId: "req-approval-legacy",
        payload: {
          approvalId: "approval-42",
          turnId: "turn-tool-1",
          reason: "Need approval",
          action: "bash",
          input: {
            command: "rm -rf tmp",
          },
        },
      },
    } as TauriEvent<unknown>);

    runtimeListener({
      event: "fastcode://runtime/event",
      id: 4,
      payload: {
        kind: "approval.resolved",
        requestId: "req-approval-legacy",
        payload: {
          approvalId: "approval-42",
          turnId: "turn-tool-1",
          status: "approved",
          reason: "auto-allow rule",
        },
      },
    } as TauriEvent<unknown>);

    runtimeListener({
      event: "fastcode://runtime/event",
      id: 5,
      payload: {
        kind: "native_state_fabric_updated",
        payload: {
          revision: "17",
          scope: ["oauth", "workspaces"],
          reason: "code_oauth_pool_upsert",
          streamLaggedDroppedEvents: 3,
        },
      },
    } as TauriEvent<unknown>);

    expect(onEvent).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        workspace_id: "workspace-local",
        message: expect.objectContaining({
          id: "req-tool-1",
          method: "item/started",
          params: expect.objectContaining({
            threadId: "thread-tool-1",
            turnId: "turn-tool-1",
            itemId: "tool-call-1",
            item: expect.objectContaining({
              id: "tool-call-1",
              type: "mcpToolCall",
              tool: "bash",
              status: "inProgress",
              arguments: expect.objectContaining({
                command: "echo runtime",
              }),
            }),
          }),
        }),
      })
    );
    expect(onEvent).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        workspace_id: "workspace-local",
        message: expect.objectContaining({
          id: "req-tool-1",
          method: "item/completed",
          params: expect.objectContaining({
            threadId: "thread-tool-1",
            turnId: "turn-tool-1",
            item: expect.objectContaining({
              id: "tool-call-1",
              type: "mcpToolCall",
              tool: "bash",
              status: "completed",
            }),
          }),
        }),
      })
    );
    expect(onEvent).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        workspace_id: "workspace-local",
        message: expect.objectContaining({
          id: "approval-42",
          method: "runtime/requestApproval",
          params: expect.objectContaining({
            threadId: "thread-tool-1",
            turnId: "turn-tool-1",
            approvalId: "approval-42",
            command: "rm -rf tmp",
          }),
        }),
      })
    );
    expect(onEvent).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({
        workspace_id: "workspace-local",
        message: expect.objectContaining({
          id: "approval-42",
          method: "runtime/approvalResolved",
          params: expect.objectContaining({
            threadId: "thread-tool-1",
            turnId: "turn-tool-1",
            approvalId: "approval-42",
            status: "approved",
          }),
        }),
      })
    );
    expect(onEvent).toHaveBeenNthCalledWith(
      5,
      expect.objectContaining({
        workspace_id: "workspace-local",
        message: expect.objectContaining({
          method: "native_state_fabric_updated",
          params: expect.objectContaining({
            revision: "17",
            scope: ["oauth", "workspaces"],
            reason: "code_oauth_pool_upsert",
            streamLaggedDroppedEvents: 3,
          }),
        }),
      })
    );

    cleanup();
  });

  it("adapts runtime-host item.updated and item.mcpToolCall.progress events", async () => {
    let runtimeListener: EventCallback<unknown> = () => undefined;

    vi.mocked(listen).mockImplementation((eventName, handler) => {
      if (eventName === "fastcode://runtime/event") {
        runtimeListener = handler as EventCallback<unknown>;
      }
      return Promise.resolve(vi.fn());
    });

    const onEvent = vi.fn();
    const cleanup = subscribeAppServerEvents(onEvent);
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
    registerRuntimeTurnRequestContext("req-progress-1", "workspace-local", "thread-progress-1");

    runtimeListener({
      event: "fastcode://runtime/event",
      id: 1,
      payload: {
        kind: "item.updated",
        requestId: "req-progress-1",
        payload: {
          turnId: "turn-progress-1",
          itemId: "item-progress-1",
          item: {
            id: "item-progress-1",
            type: "mcpToolCall",
            status: "in_progress",
          },
        },
      },
    } as TauriEvent<unknown>);

    runtimeListener({
      event: "fastcode://runtime/event",
      id: 2,
      payload: {
        kind: "item.mcpToolCall.progress",
        requestId: "req-progress-1",
        payload: {
          turnId: "turn-progress-1",
          itemId: "item-progress-1",
          message: "step still running",
        },
      },
    } as TauriEvent<unknown>);

    expect(onEvent).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        workspace_id: "workspace-local",
        message: expect.objectContaining({
          method: "item/updated",
          params: expect.objectContaining({
            threadId: "thread-progress-1",
            turnId: "turn-progress-1",
            itemId: "item-progress-1",
            item: expect.objectContaining({
              id: "item-progress-1",
              type: "mcpToolCall",
              status: "inProgress",
            }),
          }),
        }),
      })
    );
    expect(onEvent).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        workspace_id: "workspace-local",
        message: expect.objectContaining({
          method: "item/mcpToolCall/progress",
          params: expect.objectContaining({
            threadId: "thread-progress-1",
            turnId: "turn-progress-1",
            itemId: "item-progress-1",
            message: "step still running",
          }),
        }),
      })
    );

    cleanup();
  });
});
