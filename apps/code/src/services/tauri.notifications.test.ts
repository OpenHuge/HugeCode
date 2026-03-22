import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import * as notification from "@tauri-apps/plugin-notification";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  detectRuntimeMode,
  getRuntimeClient,
  readRuntimeCapabilitiesSummary,
} from "./runtimeClient";
import {
  __resetLocalUsageSnapshotCacheForTests,
  __resetWebRuntimeOauthFallbackStateForTests,
  sendNotification,
} from "./tauri";

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

  it("emits runtime.updated after web event stream reconnects", async () => {
    vi.useFakeTimers();
    try {
      vi.mocked(listen).mockRejectedValue(new Error("tauri event bridge unavailable"));
      vi.stubEnv("VITE_CODE_RUNTIME_GATEWAY_WEB_EVENTS_ENDPOINT", "/runtime/events");
      vi.stubGlobal("WebSocket", undefined);

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

      const first = FakeEventSource.instances[0];
      expect(first?.url).toBe("/runtime/events");
      first?.emit("open", "");
      expect(callback).toHaveBeenCalledTimes(0);

      if (first) {
        first.readyState = FakeEventSource.CLOSED;
        first.emit("error", "");
      }
      await vi.advanceTimersByTimeAsync(400);

      const second = FakeEventSource.instances[1];
      expect(second?.url).toBe("/runtime/events");
      second?.emit("open", "");
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: "native_state_fabric_updated",
          payload: expect.objectContaining({
            reason: "stream_reconnected",
            scope: ["bootstrap", "workspaces", "threads", "agents", "models", "oauth", "prompts"],
          }),
        })
      );

      unlisten();
      expect(second?.closed).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("throttles repeated runtime.updated reconnect signals", async () => {
    vi.useFakeTimers();
    try {
      vi.mocked(listen).mockRejectedValue(new Error("tauri event bridge unavailable"));
      vi.stubEnv("VITE_CODE_RUNTIME_GATEWAY_WEB_EVENTS_ENDPOINT", "/runtime/events");
      vi.stubGlobal("WebSocket", undefined);

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

      const first = FakeEventSource.instances[0];
      first?.emit("open", "");

      if (first) {
        first.readyState = FakeEventSource.CLOSED;
        first.emit("error", "");
      }
      await vi.advanceTimersByTimeAsync(400);
      const second = FakeEventSource.instances[1];
      second?.emit("open", "");
      expect(callback).toHaveBeenCalledTimes(1);

      if (second) {
        second.readyState = FakeEventSource.CLOSED;
        second.emit("error", "");
      }
      await vi.advanceTimersByTimeAsync(400);
      const third = FakeEventSource.instances[2];
      third?.emit("open", "");
      expect(callback).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(5_000);
      if (third) {
        third.readyState = FakeEventSource.CLOSED;
        third.emit("error", "");
      }
      await vi.advanceTimersByTimeAsync(400);
      const fourth = FakeEventSource.instances[3];
      fourth?.emit("open", "");
      expect(callback).toHaveBeenCalledTimes(2);

      unlisten();
      expect(fourth?.closed).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("derives web event endpoint from rpc endpoint with query/hash and supports nested event payload", async () => {
    vi.mocked(listen).mockRejectedValue(new Error("tauri event bridge unavailable"));
    vi.stubEnv("VITE_CODE_RUNTIME_GATEWAY_WEB_ENDPOINT", "/__code_runtime_rpc?token=test#anchor");
    vi.stubGlobal("WebSocket", undefined);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("capabilities probe unavailable")));

    type EventListenerMap = Record<string, Array<(event: { data: unknown }) => void>>;

    class FakeEventSource {
      static instance: FakeEventSource | null = null;
      readonly url: string;
      readonly listeners: EventListenerMap = {};

      constructor(url: string) {
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
        // noop for test
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
    await tauri.listenRuntimeTurnEvents(callback);

    const eventSource = FakeEventSource.instance;
    expect(eventSource?.url).toBe("/__code_runtime_events?token=test");

    eventSource?.emit(
      "message",
      JSON.stringify({
        type: "event",
        event: {
          kind: "turn.started",
          payload: {
            turnId: "turn-web-2",
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
  });

  it("returns noop unlisten when tauri listener fails and web events are unavailable", async () => {
    vi.mocked(listen).mockRejectedValue(new Error("tauri event bridge unavailable"));
    vi.stubGlobal("EventSource", undefined);

    const tauri = await import("./tauri");
    const callback = vi.fn();
    const unlisten = await tauri.listenRuntimeTurnEvents(callback);

    expect(typeof unlisten).toBe("function");
    expect(callback).not.toHaveBeenCalled();
    expect(() => unlisten()).not.toThrow();
  });

  it("does not send and warns when permission is denied", async () => {
    const isPermissionGrantedMock = vi.mocked(notification.isPermissionGranted);
    const requestPermissionMock = vi.mocked(notification.requestPermission);
    const sendNotificationMock = vi.mocked(notification.sendNotification);
    const invokeMock = vi.mocked(invoke);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {
      // noop
    });
    isPermissionGrantedMock.mockResolvedValueOnce(false);
    requestPermissionMock.mockResolvedValueOnce("denied");

    await sendNotification("Denied", "Nope");

    expect(isPermissionGrantedMock).toHaveBeenCalledTimes(1);
    expect(requestPermissionMock).toHaveBeenCalledTimes(1);
    expect(sendNotificationMock).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith("Notification permission not granted.", {
      permission: "denied",
    });
    expect(invokeMock).toHaveBeenCalledWith("send_notification_fallback", {
      title: "Denied",
      body: "Nope",
    });
    warnSpy.mockRestore();
  });

  it("falls back when the notification plugin throws", async () => {
    const isPermissionGrantedMock = vi.mocked(notification.isPermissionGranted);
    const invokeMock = vi.mocked(invoke);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {
      // noop
    });
    isPermissionGrantedMock.mockRejectedValueOnce(new Error("boom"));

    await sendNotification("Plugin", "Failed");

    expect(invokeMock).toHaveBeenCalledWith("send_notification_fallback", {
      title: "Plugin",
      body: "Failed",
    });
    warnSpy.mockRestore();
  });

  it("prefers the fallback on macOS debug builds", async () => {
    const isPermissionGrantedMock = vi.mocked(notification.isPermissionGranted);
    const invokeMock = vi.mocked(invoke);

    invokeMock.mockImplementation(async (command: string) => {
      if (command === "is_macos_debug_build") {
        return true;
      }
      if (command === "send_notification_fallback") {
        return undefined;
      }
      return undefined;
    });

    await sendNotification("Dev", "Fallback");

    expect(invokeMock).toHaveBeenCalledWith("is_macos_debug_build");
    expect(invokeMock).toHaveBeenCalledWith("send_notification_fallback", {
      title: "Dev",
      body: "Fallback",
    });
    expect(isPermissionGrantedMock).not.toHaveBeenCalled();
  });
});
