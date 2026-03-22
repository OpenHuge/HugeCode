import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { KernelProjectionDelta } from "@ku0/code-runtime-host-contract";

type RuntimeUpdatedListener = () => void;

const {
  getRuntimeClientMock,
  resolveWebTransportEndpointHintsMock,
  runtimeUpdatedListeners,
  subscribeScopedRuntimeUpdatedEventsMock,
} = vi.hoisted(() => {
  const listeners = new Set<RuntimeUpdatedListener>();
  return {
    getRuntimeClientMock: vi.fn(() => ({
      kernelProjectionBootstrapV3: vi.fn(),
    })),
    resolveWebTransportEndpointHintsMock: vi.fn(),
    runtimeUpdatedListeners: listeners,
    subscribeScopedRuntimeUpdatedEventsMock: vi.fn(
      (_options: unknown, listener: RuntimeUpdatedListener) => {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      }
    ),
  };
});

vi.mock("./eventsWebTransportHelpers", () => ({
  resolveWebTransportEndpointHints: resolveWebTransportEndpointHintsMock,
  safeParseJson: (payload: string) => JSON.parse(payload) as unknown,
}));

vi.mock("./runtimeClient", () => ({
  getRuntimeClient: getRuntimeClientMock,
}));

vi.mock("./runtimeUpdatedEvents", () => ({
  subscribeScopedRuntimeUpdatedEvents: subscribeScopedRuntimeUpdatedEventsMock,
}));

async function importTransportModule() {
  vi.resetModules();
  return import("./runtimeKernelProjectionTransport");
}

class MockWebSocket {
  static instances: MockWebSocket[] = [];

  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  readonly sentPayloads: string[] = [];
  closed = false;

  constructor(readonly url: string) {
    MockWebSocket.instances.push(this);
  }

  send(payload: string) {
    this.sentPayloads.push(payload);
  }

  close() {
    this.closed = true;
  }

  emitOpen() {
    this.onopen?.();
  }

  emitMessage(payload: unknown) {
    this.onmessage?.({
      data: JSON.stringify(payload),
    });
  }
}

describe("runtimeKernelProjectionTransport", () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
    runtimeUpdatedListeners.clear();
    getRuntimeClientMock.mockReset();
    resolveWebTransportEndpointHintsMock.mockReset();
    subscribeScopedRuntimeUpdatedEventsMock.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("streams typed kernel projection deltas over websocket when ws transport is available", async () => {
    resolveWebTransportEndpointHintsMock.mockResolvedValue({
      wsEndpoint: "ws://127.0.0.1:8788/ws",
    });
    vi.stubGlobal("WebSocket", MockWebSocket as unknown as typeof WebSocket);

    const listener = vi.fn<(delta: KernelProjectionDelta) => void>();
    const { subscribeRuntimeKernelProjection } = await importTransportModule();

    const unsubscribe = subscribeRuntimeKernelProjection(
      {
        scopes: ["jobs"],
        lastRevision: 3,
      },
      listener
    );

    await vi.waitFor(() => {
      expect(MockWebSocket.instances).toHaveLength(1);
    });

    const socket = MockWebSocket.instances[0];
    socket?.emitOpen();

    expect(JSON.parse(socket?.sentPayloads[0] ?? "{}")).toMatchObject({
      type: "kernel.projection.subscribe",
      params: {
        scopes: ["jobs"],
        lastRevision: 3,
      },
    });

    socket?.emitMessage({
      type: "kernel.projection.delta",
      delta: {
        revision: 4,
        scopes: ["jobs"],
        ops: [
          {
            type: "replace",
            scope: "jobs",
            value: [{ id: "task-1", status: "running" }],
            revision: 4,
          },
        ],
      },
    });

    expect(listener).toHaveBeenCalledWith({
      revision: 4,
      scopes: ["jobs"],
      ops: [
        {
          type: "replace",
          scope: "jobs",
          key: null,
          value: [{ id: "task-1", status: "running" }],
          patch: null,
          revision: 4,
          reason: null,
        },
      ],
    });

    unsubscribe();
    expect(socket?.closed).toBe(true);
  });

  it("falls back to runtime.updated resync notifications when websocket transport is unavailable", async () => {
    resolveWebTransportEndpointHintsMock.mockResolvedValue({
      wsEndpoint: null,
    });
    vi.stubGlobal("WebSocket", undefined);

    const listener = vi.fn<(delta: KernelProjectionDelta) => void>();
    const { subscribeRuntimeKernelProjection } = await importTransportModule();

    const unsubscribe = subscribeRuntimeKernelProjection(
      {
        scopes: ["mission_control", "continuity", "jobs"],
      },
      listener
    );

    await vi.waitFor(() => {
      expect(listener).toHaveBeenCalledTimes(1);
    });

    expect(listener).toHaveBeenNthCalledWith(1, {
      revision: 0,
      scopes: ["mission_control", "continuity", "jobs"],
      ops: [
        {
          type: "resync_required",
          scope: "mission_control",
          reason: "projection_ws_unavailable",
        },
        {
          type: "resync_required",
          scope: "continuity",
          reason: "projection_ws_unavailable",
        },
        {
          type: "resync_required",
          scope: "jobs",
          reason: "projection_ws_unavailable",
        },
      ],
    });
    expect(subscribeScopedRuntimeUpdatedEventsMock).toHaveBeenCalledWith(
      {
        scopes: ["bootstrap", "workspaces", "agents", "providers", "oauth", "server"],
      },
      expect.any(Function)
    );

    for (const runtimeUpdatedListener of runtimeUpdatedListeners) {
      runtimeUpdatedListener();
    }

    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenNthCalledWith(2, {
      revision: 0,
      scopes: ["mission_control", "continuity", "jobs"],
      ops: [
        {
          type: "resync_required",
          scope: "mission_control",
          reason: "projection_ws_unavailable",
        },
        {
          type: "resync_required",
          scope: "continuity",
          reason: "projection_ws_unavailable",
        },
        {
          type: "resync_required",
          scope: "jobs",
          reason: "projection_ws_unavailable",
        },
      ],
    });

    unsubscribe();
  });
});
