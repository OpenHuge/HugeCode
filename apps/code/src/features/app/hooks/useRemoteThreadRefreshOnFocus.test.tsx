// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  REMOTE_THREAD_POLL_INTERVAL_MS,
  useRemoteThreadRefreshOnFocus,
} from "./useRemoteThreadRefreshOnFocus";

const windowListeners = new Map<string, Set<() => void>>();
const listenMock = vi.fn<(eventName: string, handler: () => void) => Promise<() => void>>();

function registerWindowListener(eventName: string, handler: () => void) {
  const handlers = windowListeners.get(eventName) ?? new Set<() => void>();
  handlers.add(handler);
  windowListeners.set(eventName, handlers);
  return () => {
    handlers.delete(handler);
  };
}

vi.mock("@desktop-host/window", () => ({
  getCurrentWindow: () => ({
    listen: listenMock,
  }),
}));

describe("useRemoteThreadRefreshOnFocus", () => {
  let visibilityState: DocumentVisibilityState;

  beforeEach(() => {
    vi.useFakeTimers();
    windowListeners.clear();
    listenMock.mockReset();
    listenMock.mockImplementation(async (eventName: string, handler: () => void) =>
      registerWindowListener(eventName, handler)
    );
    visibilityState = "visible";
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => visibilityState,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("refreshes the active remote thread on focus with debounce", () => {
    const refreshThread = vi.fn().mockResolvedValue(undefined);

    renderHook(() =>
      useRemoteThreadRefreshOnFocus({
        backendMode: "remote",
        activeWorkspace: {
          id: "ws-1",
          name: "Workspace",
          path: "/tmp/ws-1",
          connected: true,
          settings: { sidebarCollapsed: false },
        },
        activeThreadId: "thread-1",
        refreshThread,
      })
    );

    act(() => {
      window.dispatchEvent(new Event("focus"));
      vi.advanceTimersByTime(499);
    });
    expect(refreshThread).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(refreshThread).toHaveBeenCalledWith("ws-1", "thread-1");
  });

  it("attempts reconnect before refresh when workspace is disconnected", async () => {
    const reconnectWorkspace = vi.fn().mockResolvedValue(undefined);
    const refreshThread = vi.fn().mockResolvedValue(undefined);

    renderHook(() =>
      useRemoteThreadRefreshOnFocus({
        backendMode: "remote",
        activeWorkspace: {
          id: "ws-1",
          name: "Workspace",
          path: "/tmp/ws-1",
          connected: false,
          settings: { sidebarCollapsed: false },
        },
        activeThreadId: "thread-1",
        reconnectWorkspace,
        refreshThread,
      })
    );

    await act(async () => {
      window.dispatchEvent(new Event("focus"));
      vi.advanceTimersByTime(500);
      await Promise.resolve();
    });

    expect(reconnectWorkspace).toHaveBeenCalledTimes(1);
    expect(refreshThread).toHaveBeenCalledTimes(1);
    expect(reconnectWorkspace.mock.invocationCallOrder[0]).toBeLessThan(
      refreshThread.mock.invocationCallOrder[0] ?? Number.MAX_SAFE_INTEGER
    );
  });

  it("keeps a low-frequency poll for active remote threads when not processing", async () => {
    const refreshThread = vi.fn().mockResolvedValue(undefined);

    renderHook(() =>
      useRemoteThreadRefreshOnFocus({
        backendMode: "remote",
        activeWorkspace: {
          id: "ws-1",
          name: "Workspace",
          path: "/tmp/ws-1",
          connected: true,
          settings: { sidebarCollapsed: false },
        },
        activeThreadId: "thread-1",
        activeThreadIsProcessing: false,
        refreshThread,
      })
    );

    await act(async () => {
      vi.advanceTimersByTime(REMOTE_THREAD_POLL_INTERVAL_MS - 1);
      await Promise.resolve();
    });
    expect(refreshThread).toHaveBeenCalledTimes(0);

    await act(async () => {
      vi.advanceTimersByTime(1);
      await Promise.resolve();
    });
    expect(refreshThread).toHaveBeenCalledTimes(1);
  });

  it("does not poll while processing and refreshes once visibility returns", async () => {
    const refreshThread = vi.fn().mockResolvedValue(undefined);

    renderHook(() =>
      useRemoteThreadRefreshOnFocus({
        backendMode: "remote",
        activeWorkspace: {
          id: "ws-1",
          name: "Workspace",
          path: "/tmp/ws-1",
          connected: true,
          settings: { sidebarCollapsed: false },
        },
        activeThreadId: "thread-1",
        activeThreadIsProcessing: true,
        refreshThread,
      })
    );

    await act(async () => {
      vi.advanceTimersByTime(REMOTE_THREAD_POLL_INTERVAL_MS * 2);
      await Promise.resolve();
    });
    expect(refreshThread).toHaveBeenCalledTimes(0);

    await act(async () => {
      visibilityState = "visible";
      document.dispatchEvent(new Event("visibilitychange"));
      vi.advanceTimersByTime(500);
      await Promise.resolve();
    });
    expect(refreshThread).toHaveBeenCalledTimes(1);
  });
});
