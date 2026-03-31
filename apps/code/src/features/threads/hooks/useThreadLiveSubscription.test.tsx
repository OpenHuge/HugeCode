// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppServerEvent, WorkspaceInfo } from "../../../types";
import { useThreadLiveSubscription } from "./useThreadLiveSubscription";

const appServerListeners = new Set<(event: AppServerEvent) => void>();
const subscribeAppServerEventsMock = vi.fn((onEvent: (event: AppServerEvent) => void) => {
  appServerListeners.add(onEvent);
  return () => {
    appServerListeners.delete(onEvent);
  };
});
const updateRuntimeEventChannelDiagnosticsMock = vi.fn();
const subscribeThreadLiveMock = vi.fn();
const unsubscribeThreadLiveMock = vi.fn();
const stateChannelListeners = new Set<
  (transition: { previous: { status: string } | null; current: { status: string } }) => void
>();

vi.mock("../../../application/runtime/ports/events", () => ({
  subscribeAppServerEvents: (onEvent: (event: AppServerEvent) => void) =>
    subscribeAppServerEventsMock(onEvent),
}));

vi.mock("../../../application/runtime/ports/runtimeEventChannelDiagnostics", () => ({
  normalizeRuntimeEventChannelError: (error: unknown) =>
    error instanceof Error ? error.message : String(error),
  updateRuntimeEventChannelDiagnostics: (id: string, patch: Record<string, unknown>) =>
    updateRuntimeEventChannelDiagnosticsMock(id, patch),
}));

vi.mock("../../../application/runtime/ports/runtimeEventStabilityMetrics", () => ({
  recordRuntimeEventFallbackEntered: vi.fn(),
  recordRuntimeEventFallbackRecovered: vi.fn(),
  recordRuntimeEventReconnectAttempt: vi.fn(),
  recordRuntimeEventReconnectSuccess: vi.fn(),
}));

vi.mock("../../../application/runtime/ports/runtimeEventStateMachine", () => ({
  subscribeRuntimeEventStateChannel: (
    _id: string,
    onTransition: (transition: {
      previous: { status: string } | null;
      current: { status: string };
    }) => void
  ) => {
    stateChannelListeners.add(onTransition);
    return () => {
      stateChannelListeners.delete(onTransition);
    };
  },
}));

vi.mock("../../../application/runtime/ports/threads", () => ({
  subscribeThreadLive: (workspaceId: string, threadId: string) =>
    subscribeThreadLiveMock(workspaceId, threadId),
  unsubscribeThreadLive: (subscriptionId: string) => unsubscribeThreadLiveMock(subscriptionId),
}));

const WORKSPACE: WorkspaceInfo = {
  id: "ws-1",
  name: "Workspace",
  path: "/tmp/ws-1",
  connected: true,
  settings: { sidebarCollapsed: false },
};

function emitAppServerEvent(event: AppServerEvent) {
  for (const listener of appServerListeners) {
    listener(event);
  }
}

function emitStateChannel(status: string, previous: string | null = null) {
  for (const listener of stateChannelListeners) {
    listener({
      previous: previous ? { status: previous } : null,
      current: { status },
    });
  }
}

async function flushTimers() {
  await act(async () => {
    vi.advanceTimersByTime(200);
    await Promise.resolve();
  });
}

async function flushMicrotasks() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe("useThreadLiveSubscription", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    appServerListeners.clear();
    stateChannelListeners.clear();
    subscribeAppServerEventsMock.mockClear();
    updateRuntimeEventChannelDiagnosticsMock.mockReset();
    subscribeThreadLiveMock.mockReset();
    unsubscribeThreadLiveMock.mockReset();
    subscribeThreadLiveMock.mockResolvedValue({ subscriptionId: "sub-1" });
    unsubscribeThreadLiveMock.mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("waits for thread-live registration before reporting live on an open event channel", async () => {
    const refreshThread = vi.fn().mockResolvedValue(undefined);
    const listThreadsForWorkspace = vi.fn().mockResolvedValue(undefined);
    let resolveSubscription: ((value: { subscriptionId: string }) => void) | null = null;
    subscribeThreadLiveMock.mockImplementation(
      () =>
        new Promise<{ subscriptionId: string }>((resolve) => {
          resolveSubscription = resolve;
        })
    );

    const { result } = renderHook(() =>
      useThreadLiveSubscription({
        activeWorkspace: WORKSPACE,
        activeThreadId: "thread-1",
        refreshThread,
        listThreadsForWorkspace,
      })
    );

    expect(result.current).toBe("syncing");

    act(() => {
      emitStateChannel("open");
    });

    expect(result.current).toBe("syncing");

    await act(async () => {
      resolveSubscription?.({ subscriptionId: "sub-1" });
      await Promise.resolve();
    });

    expect(result.current).toBe("live");
    expect(subscribeThreadLiveMock).toHaveBeenCalledWith("ws-1", "thread-1");
    expect(updateRuntimeEventChannelDiagnosticsMock).toHaveBeenCalledWith(
      "thread-live-subscription",
      expect.objectContaining({
        transport: "bridge",
        status: "open",
      })
    );
  });

  it("refreshes the active thread from native fabric thread patches", async () => {
    const refreshThread = vi.fn().mockResolvedValue(undefined);
    const listThreadsForWorkspace = vi.fn().mockResolvedValue(undefined);

    const { result } = renderHook(() =>
      useThreadLiveSubscription({
        activeWorkspace: WORKSPACE,
        activeThreadId: "thread-1",
        refreshThread,
        listThreadsForWorkspace,
      })
    );

    await flushMicrotasks();

    act(() => {
      emitStateChannel("open");
      emitAppServerEvent({
        workspace_id: "ws-1",
        message: {
          method: "native_state_fabric_updated",
          params: {
            scopeKind: "thread",
            changeKind: "threadLiveStatePatched",
            workspaceId: "ws-1",
            threadId: "thread-1",
          },
        },
      });
    });

    await flushTimers();

    expect(result.current).toBe("live");
    expect(listThreadsForWorkspace).toHaveBeenCalledWith(WORKSPACE, { preserveState: true });
    expect(refreshThread).toHaveBeenCalledWith("ws-1", "thread-1", { replaceLocal: false });
  });

  it("falls back and refreshes when the active thread detaches", async () => {
    const refreshThread = vi.fn().mockResolvedValue(undefined);
    const listThreadsForWorkspace = vi.fn().mockResolvedValue(undefined);

    const { result } = renderHook(() =>
      useThreadLiveSubscription({
        activeWorkspace: WORKSPACE,
        activeThreadId: "thread-1",
        refreshThread,
        listThreadsForWorkspace,
      })
    );

    await flushMicrotasks();

    act(() => {
      emitStateChannel("open");
      emitAppServerEvent({
        workspace_id: "ws-1",
        message: {
          method: "native_state_fabric_updated",
          params: {
            scopeKind: "thread",
            changeKind: "threadLiveDetached",
            workspaceId: "ws-1",
            threadId: "thread-1",
          },
        },
      });
    });

    await flushTimers();

    expect(result.current).toBe("fallback");
    expect(listThreadsForWorkspace).toHaveBeenCalledWith(WORKSPACE, { preserveState: true });
    expect(refreshThread).toHaveBeenCalledWith("ws-1", "thread-1", undefined);
  });

  it("ignores legacy code_thread_live events", async () => {
    const refreshThread = vi.fn().mockResolvedValue(undefined);
    const listThreadsForWorkspace = vi.fn().mockResolvedValue(undefined);

    const { result } = renderHook(() =>
      useThreadLiveSubscription({
        activeWorkspace: WORKSPACE,
        activeThreadId: "thread-1",
        refreshThread,
        listThreadsForWorkspace,
      })
    );

    await flushMicrotasks();

    act(() => {
      emitStateChannel("open");
      emitAppServerEvent({
        workspace_id: "ws-1",
        message: {
          method: "thread/liveUpdate",
          params: {
            threadId: "thread-1",
          },
        },
      });
    });

    await flushTimers();

    expect(result.current).toBe("live");
    expect(refreshThread).not.toHaveBeenCalled();
    expect(listThreadsForWorkspace).not.toHaveBeenCalled();
  });

  it("falls back when the runtime event channel reconnects and recovers on open", async () => {
    const refreshThread = vi.fn().mockResolvedValue(undefined);
    const listThreadsForWorkspace = vi.fn().mockResolvedValue(undefined);

    const { result } = renderHook(() =>
      useThreadLiveSubscription({
        activeWorkspace: WORKSPACE,
        activeThreadId: "thread-1",
        refreshThread,
        listThreadsForWorkspace,
      })
    );

    await flushMicrotasks();

    act(() => {
      emitStateChannel("open");
    });
    expect(result.current).toBe("live");

    act(() => {
      emitStateChannel("reconnecting", "open");
    });
    expect(result.current).toBe("fallback");

    act(() => {
      emitStateChannel("open", "reconnecting");
    });
    expect(result.current).toBe("live");
  });
});
