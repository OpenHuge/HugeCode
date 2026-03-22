// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { recordRuntimeEventDedupeHit } from "../../../application/runtime/ports/runtimeEventStabilityMetrics";
import { subscribeScopedRuntimeUpdatedEvents } from "../../../application/runtime/ports/runtimeUpdatedEvents";
import { pushErrorToast } from "../../../application/runtime/ports/toasts";
import type { RuntimeUpdatedEvent } from "../../../application/runtime/ports/runtimeUpdatedEvents";
import type { WorkspaceInfo } from "../../../types";
import { useRuntimeResyncRefresh } from "./useRuntimeResyncRefresh";

vi.mock("../../../application/runtime/ports/runtimeUpdatedEvents", () => ({
  subscribeScopedRuntimeUpdatedEvents: vi.fn(),
}));

vi.mock("../../../application/runtime/ports/toasts", () => ({
  pushErrorToast: vi.fn(),
}));

vi.mock("../../../application/runtime/ports/runtimeEventStabilityMetrics", () => ({
  recordRuntimeEventDedupeHit: vi.fn(),
}));

const stateChannelListeners = new Set<
  (transition: { previous: { status: string } | null; current: { status: string } }) => void
>();

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
      unlistenStateChannel();
    };
  },
}));

type HookOptions = Parameters<typeof useRuntimeResyncRefresh>[0];

function Harness(props: HookOptions) {
  useRuntimeResyncRefresh(props);
  return null;
}

let runtimeUpdatedListener: ((event: RuntimeUpdatedEvent) => void) | null = null;
const unlistenRuntimeUpdated = vi.fn();
const unlistenStateChannel = vi.fn();

beforeEach(() => {
  runtimeUpdatedListener = null;
  stateChannelListeners.clear();
  unlistenRuntimeUpdated.mockReset();
  unlistenStateChannel.mockReset();
  vi.mocked(subscribeScopedRuntimeUpdatedEvents).mockImplementation((_options, cb) => {
    runtimeUpdatedListener = cb;
    return unlistenRuntimeUpdated;
  });
  vi.mocked(recordRuntimeEventDedupeHit).mockReset();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

async function mount(options: HookOptions) {
  const container = document.createElement("div");
  const root = createRoot(container);
  await act(async () => {
    root.render(<Harness {...options} />);
  });
  return { root };
}

function makeWorkspace(id = "ws-1"): WorkspaceInfo {
  return {
    id,
    name: `Workspace ${id}`,
    path: `/tmp/${id}`,
    connected: true,
    settings: {
      sidebarCollapsed: false,
    },
  };
}

function emitRuntimeUpdated(params: Record<string, unknown>) {
  const scope = Array.isArray(params.scope)
    ? params.scope.filter((entry): entry is string => typeof entry === "string")
    : [];
  const workspaceId =
    typeof params.workspaceId === "string"
      ? params.workspaceId
      : typeof params.workspace_id === "string"
        ? params.workspace_id
        : null;
  const reason = typeof params.reason === "string" ? params.reason : "";
  runtimeUpdatedListener?.({
    event: {
      workspace_id: workspaceId ?? "local",
      message: {
        method: "native_state_fabric_updated",
        params,
      },
    },
    params,
    reason,
    scope,
    eventWorkspaceId: workspaceId ?? "local",
    paramsWorkspaceId: workspaceId,
    isWorkspaceLocalEvent: true,
  });
}

describe("useRuntimeResyncRefresh", () => {
  it("refreshes visible runtime state when stream lag resync arrives", async () => {
    const refreshWorkspaces = vi.fn().mockResolvedValue(undefined);
    const listThreadsForWorkspace = vi.fn().mockResolvedValue(undefined);
    const refreshThread = vi.fn().mockResolvedValue(undefined);
    const refreshAccountInfo = vi.fn().mockResolvedValue(undefined);
    const refreshAccountRateLimits = vi.fn().mockResolvedValue(undefined);
    const workspace = makeWorkspace();

    const { root } = await mount({
      activeWorkspace: workspace,
      activeThreadId: "thread-1",
      refreshWorkspaces,
      listThreadsForWorkspace,
      refreshThread,
      refreshAccountInfo,
      refreshAccountRateLimits,
    });

    act(() => {
      emitRuntimeUpdated({
        revision: "42",
        scope: ["bootstrap", "workspaces", "threads", "oauth"],
        reason: "event_stream_lagged",
      });
    });

    await vi.advanceTimersByTimeAsync(400);

    expect(refreshWorkspaces).toHaveBeenCalledTimes(1);
    expect(listThreadsForWorkspace).toHaveBeenCalledWith(workspace, { preserveState: true });
    expect(refreshThread).toHaveBeenCalledWith("ws-1", "thread-1");
    expect(refreshAccountInfo).toHaveBeenCalledWith("ws-1");
    expect(refreshAccountRateLimits).toHaveBeenCalledWith("ws-1");
    expect(pushErrorToast).toHaveBeenCalledWith({
      title: "Runtime stream lag detected",
      message: "Resynced after stream lag.",
    });

    await act(async () => {
      root.unmount();
    });
    expect(unlistenRuntimeUpdated).toHaveBeenCalledTimes(1);
    expect(unlistenStateChannel).toHaveBeenCalledTimes(1);
  });

  it("ignores non-resync native state fabric reasons", async () => {
    const refreshWorkspaces = vi.fn().mockResolvedValue(undefined);
    const listThreadsForWorkspace = vi.fn().mockResolvedValue(undefined);
    const refreshThread = vi.fn().mockResolvedValue(undefined);
    const refreshAccountInfo = vi.fn().mockResolvedValue(undefined);
    const refreshAccountRateLimits = vi.fn().mockResolvedValue(undefined);

    const { root } = await mount({
      activeWorkspace: makeWorkspace(),
      activeThreadId: "thread-1",
      refreshWorkspaces,
      listThreadsForWorkspace,
      refreshThread,
      refreshAccountInfo,
      refreshAccountRateLimits,
    });

    act(() => {
      emitRuntimeUpdated({
        revision: "7",
        scope: ["bootstrap", "threads"],
        reason: "code_thread_create",
      });
    });

    await vi.advanceTimersByTimeAsync(400);

    expect(refreshWorkspaces).not.toHaveBeenCalled();
    expect(listThreadsForWorkspace).not.toHaveBeenCalled();
    expect(refreshThread).not.toHaveBeenCalled();
    expect(refreshAccountInfo).not.toHaveBeenCalled();
    expect(refreshAccountRateLimits).not.toHaveBeenCalled();

    await act(async () => {
      root.unmount();
    });
  });

  it("records durability degraded warning diagnostics without triggering resync refresh actions", async () => {
    const refreshWorkspaces = vi.fn().mockResolvedValue(undefined);
    const listThreadsForWorkspace = vi.fn().mockResolvedValue(undefined);
    const refreshThread = vi.fn().mockResolvedValue(undefined);
    const refreshAccountInfo = vi.fn().mockResolvedValue(undefined);
    const refreshAccountRateLimits = vi.fn().mockResolvedValue(undefined);
    const onDebug = vi.fn();

    const { root } = await mount({
      activeWorkspace: makeWorkspace(),
      activeThreadId: "thread-1",
      refreshWorkspaces,
      listThreadsForWorkspace,
      refreshThread,
      refreshAccountInfo,
      refreshAccountRateLimits,
      onDebug,
    });

    act(() => {
      emitRuntimeUpdated({
        revision: "123",
        workspaceId: "ws-1",
        scope: ["agents"],
        reason: "agent_task_durability_degraded",
        mode: "active",
        degraded: true,
        checkpointWriteTotal: 42,
        checkpointWriteFailedTotal: 7,
        updatedAt: 1_737_000_000_000,
      });
    });

    await vi.advanceTimersByTimeAsync(400);

    expect(onDebug).toHaveBeenCalledWith(
      expect.objectContaining({
        label: "native state fabric warning durability degraded",
        payload: expect.objectContaining({
          reason: "agent_task_durability_degraded",
          revision: "123",
          workspaceId: "ws-1",
          scope: ["agents"],
          updatedAt: 1_737_000_000_000,
          mode: "active",
          degraded: true,
          checkpointWriteTotal: 42,
          checkpointWriteFailedTotal: 7,
        }),
      })
    );
    expect(refreshWorkspaces).not.toHaveBeenCalled();
    expect(listThreadsForWorkspace).not.toHaveBeenCalled();
    expect(refreshThread).not.toHaveBeenCalled();
    expect(refreshAccountInfo).not.toHaveBeenCalled();
    expect(refreshAccountRateLimits).not.toHaveBeenCalled();
    expect(pushErrorToast).not.toHaveBeenCalled();

    await act(async () => {
      root.unmount();
    });
  });

  it("deduplicates durability warnings for the same revision within the 30s window", async () => {
    const onDebug = vi.fn();

    const { root } = await mount({
      activeWorkspace: makeWorkspace(),
      activeThreadId: "thread-1",
      refreshWorkspaces: vi.fn().mockResolvedValue(undefined),
      listThreadsForWorkspace: vi.fn().mockResolvedValue(undefined),
      refreshThread: vi.fn().mockResolvedValue(undefined),
      refreshAccountInfo: vi.fn().mockResolvedValue(undefined),
      refreshAccountRateLimits: vi.fn().mockResolvedValue(undefined),
      onDebug,
    });

    act(() => {
      emitRuntimeUpdated({
        revision: "same-revision",
        scope: ["agents"],
        reason: "agent_task_durability_degraded",
      });
      emitRuntimeUpdated({
        revision: "same-revision",
        scope: ["agents"],
        reason: "agent_task_durability_degraded",
      });
    });

    expect(onDebug).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(31_000);
    act(() => {
      emitRuntimeUpdated({
        revision: "same-revision",
        scope: ["agents"],
        reason: "agent_task_durability_degraded",
      });
    });
    expect(onDebug).toHaveBeenCalledTimes(2);

    act(() => {
      emitRuntimeUpdated({
        revision: "next-revision",
        scope: ["agents"],
        reason: "agent_task_durability_degraded",
      });
    });
    expect(onDebug).toHaveBeenCalledTimes(3);

    await act(async () => {
      root.unmount();
    });
  });

  it("coalesces rapid replay-gap/runtime reconnect events into one refresh pass", async () => {
    const refreshWorkspaces = vi.fn().mockResolvedValue(undefined);
    const listThreadsForWorkspace = vi.fn().mockResolvedValue(undefined);
    const refreshThread = vi.fn().mockResolvedValue(undefined);
    const refreshAccountInfo = vi.fn().mockResolvedValue(undefined);
    const refreshAccountRateLimits = vi.fn().mockResolvedValue(undefined);
    const workspace = makeWorkspace();

    const { root } = await mount({
      activeWorkspace: workspace,
      activeThreadId: "thread-2",
      refreshWorkspaces,
      listThreadsForWorkspace,
      refreshThread,
      refreshAccountInfo,
      refreshAccountRateLimits,
    });

    act(() => {
      emitRuntimeUpdated({
        revision: "11",
        scope: ["threads"],
        reason: "event_replay_gap",
      });
      emitRuntimeUpdated({
        revision: "12",
        scope: ["workspaces", "oauth"],
        reason: "stream_reconnected",
      });
    });

    await vi.advanceTimersByTimeAsync(400);

    expect(refreshWorkspaces).toHaveBeenCalledTimes(1);
    expect(listThreadsForWorkspace).toHaveBeenCalledTimes(1);
    expect(refreshThread).toHaveBeenCalledTimes(1);
    expect(refreshAccountInfo).toHaveBeenCalledTimes(1);
    expect(refreshAccountRateLimits).toHaveBeenCalledTimes(1);
    expect(pushErrorToast).toHaveBeenCalledWith({
      title: "Runtime replay gap detected",
      message: "Replay gap detected; runtime state was resynced.",
    });

    await act(async () => {
      root.unmount();
    });
  });

  it("triggers a bootstrap resync after stream recovery transition", async () => {
    const refreshWorkspaces = vi.fn().mockResolvedValue(undefined);
    const listThreadsForWorkspace = vi.fn().mockResolvedValue(undefined);
    const refreshThread = vi.fn().mockResolvedValue(undefined);
    const refreshAccountInfo = vi.fn().mockResolvedValue(undefined);
    const refreshAccountRateLimits = vi.fn().mockResolvedValue(undefined);
    const workspace = makeWorkspace();

    const { root } = await mount({
      activeWorkspace: workspace,
      activeThreadId: "thread-2",
      refreshWorkspaces,
      listThreadsForWorkspace,
      refreshThread,
      refreshAccountInfo,
      refreshAccountRateLimits,
    });

    act(() => {
      stateChannelListeners.forEach((handler) => {
        handler({
          previous: { status: "fallback" },
          current: { status: "open" },
        });
      });
    });

    await vi.advanceTimersByTimeAsync(400);

    expect(refreshWorkspaces).toHaveBeenCalledTimes(1);
    expect(listThreadsForWorkspace).toHaveBeenCalledWith(workspace, { preserveState: true });
    expect(refreshThread).toHaveBeenCalledWith("ws-1", "thread-2");
    expect(refreshAccountInfo).toHaveBeenCalledWith("ws-1");
    expect(refreshAccountRateLimits).toHaveBeenCalledWith("ws-1");

    await act(async () => {
      root.unmount();
    });
  });

  it("includes replay/lag diagnostics in debug payload and notice copy", async () => {
    const refreshWorkspaces = vi.fn().mockResolvedValue(undefined);
    const listThreadsForWorkspace = vi.fn().mockResolvedValue(undefined);
    const refreshThread = vi.fn().mockResolvedValue(undefined);
    const refreshAccountInfo = vi.fn().mockResolvedValue(undefined);
    const refreshAccountRateLimits = vi.fn().mockResolvedValue(undefined);
    const onDebug = vi.fn();

    const { root } = await mount({
      activeWorkspace: makeWorkspace(),
      activeThreadId: "thread-3",
      refreshWorkspaces,
      listThreadsForWorkspace,
      refreshThread,
      refreshAccountInfo,
      refreshAccountRateLimits,
      onDebug,
    });

    act(() => {
      emitRuntimeUpdated({
        revision: "91",
        scope: ["threads", "oauth"],
        reason: "event_stream_lagged",
        streamLaggedDroppedEvents: 7,
      });
    });

    await vi.advanceTimersByTimeAsync(400);

    expect(onDebug).toHaveBeenCalledWith(
      expect.objectContaining({
        label: "native state fabric resync refresh",
        payload: expect.objectContaining({
          reason: "event_stream_lagged",
          scope: ["threads", "oauth"],
          streamLaggedDroppedEvents: 7,
        }),
      })
    );
    expect(pushErrorToast).toHaveBeenCalledWith({
      title: "Runtime stream lag detected",
      message: "Resynced after dropping 7 event(s).",
    });

    await act(async () => {
      root.unmount();
    });
  });
});
