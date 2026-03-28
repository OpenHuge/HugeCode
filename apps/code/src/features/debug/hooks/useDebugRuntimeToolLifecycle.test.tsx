// @vitest-environment jsdom

import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDebugRuntimeToolLifecycle } from "./useDebugRuntimeToolLifecycle";
import type { RuntimeToolLifecycleSnapshot } from "../../../application/runtime/ports/runtimeToolLifecycle";

type RuntimeToolLifecycleTestApi = {
  getRuntimeToolLifecycleSnapshot: ReturnType<typeof vi.fn>;
  subscribeRuntimeToolLifecycleSnapshot: ReturnType<typeof vi.fn>;
};

vi.mock("../../../application/runtime/ports/runtimeToolLifecycle", () => ({
  filterRuntimeToolLifecycleSnapshot: vi.fn(
    (
      snapshot: {
        recentEvents: Array<{ workspaceId: string | null }>;
        lastEvent: { workspaceId: string | null } | null;
        revision: number;
      },
      workspaceId: string | null
    ) => {
      const lifecycleEvents = snapshot.recentEvents.filter(
        (event) => !workspaceId || event.workspaceId === workspaceId
      );
      const lastEvent =
        snapshot.lastEvent && (!workspaceId || snapshot.lastEvent.workspaceId === workspaceId)
          ? snapshot.lastEvent
          : (lifecycleEvents.at(-1) ?? null);
      return {
        revision: snapshot.revision,
        lastEvent,
        recentEvents: lifecycleEvents,
        lastHookCheckpoint:
          snapshot.lastHookCheckpoint &&
          (!workspaceId || snapshot.lastHookCheckpoint.workspaceId === workspaceId)
            ? snapshot.lastHookCheckpoint
            : (snapshot.recentHookCheckpoints?.at(-1) ?? null),
        recentHookCheckpoints: (snapshot.recentHookCheckpoints ?? []).filter(
          (checkpoint) => !workspaceId || checkpoint.workspaceId === workspaceId
        ),
      };
    }
  ),
  getRuntimeToolLifecycleSnapshot: vi.fn(),
  runtimeToolLifecycleEventMatchesWorkspace: vi.fn(
    (event: { workspaceId: string | null }, workspaceId: string | null) =>
      !workspaceId || event.workspaceId === workspaceId
  ),
  subscribeRuntimeToolLifecycleSnapshot: vi.fn(() => () => undefined),
}));

const lifecycleEvent = {
  id: "tool-started-1",
  kind: "tool",
  phase: "started",
  source: "app-event",
  workspaceId: "workspace-1",
  threadId: "thread-1",
  turnId: "turn-1",
  toolCallId: "tool-call-1",
  toolName: "bash",
  scope: "write",
  status: "in_progress",
  at: 100,
  errorCode: null,
};

const hookCheckpoint = {
  key: "tool:app-event:tool-call-1:write:workspace-1:post_execution_pre_publication",
  point: "post_execution_pre_publication" as const,
  status: "ready" as const,
  source: "telemetry" as const,
  workspaceId: "workspace-1",
  threadId: "thread-1",
  turnId: "turn-1",
  toolCallId: "tool-call-1",
  toolName: "bash",
  scope: "write" as const,
  lifecycleEventId: "tool-completed-1",
  at: 120,
  reason: null,
};

describe("useDebugRuntimeToolLifecycle", () => {
  let api: RuntimeToolLifecycleTestApi;

  beforeEach(async () => {
    api =
      (await import("../../../application/runtime/ports/runtimeToolLifecycle")) as unknown as RuntimeToolLifecycleTestApi;
    api.getRuntimeToolLifecycleSnapshot.mockReturnValue({
      revision: 2,
      lastEvent: lifecycleEvent,
      lastHookCheckpoint: hookCheckpoint,
      recentEvents: [
        lifecycleEvent,
        {
          ...lifecycleEvent,
          id: "tool-started-2",
          workspaceId: "workspace-2",
          turnId: "turn-2",
        },
      ],
      recentHookCheckpoints: [
        hookCheckpoint,
        {
          ...hookCheckpoint,
          key: "tool:app-event:tool-call-2:write:workspace-2:post_execution_pre_publication",
          workspaceId: "workspace-2",
          toolCallId: "tool-call-2",
          turnId: "turn-2",
        },
      ],
    } satisfies RuntimeToolLifecycleSnapshot);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("filters lifecycle events to the active workspace", () => {
    const { result } = renderHook(() =>
      useDebugRuntimeToolLifecycle({
        workspaceId: "workspace-1",
        enabled: true,
      })
    );

    expect(api.subscribeRuntimeToolLifecycleSnapshot).toHaveBeenCalledTimes(1);
    expect(result.current.lifecycleEvents).toEqual([lifecycleEvent]);
    expect(result.current.lastEvent).toEqual(lifecycleEvent);
    expect(result.current.hookCheckpoints).toEqual([hookCheckpoint]);
    expect(result.current.lastHookCheckpoint).toEqual(hookCheckpoint);
  });

  it("preserves a matching lastEvent even when it is not present in recentEvents", () => {
    api.getRuntimeToolLifecycleSnapshot.mockReturnValue({
      revision: 3,
      lastEvent: lifecycleEvent,
      lastHookCheckpoint: hookCheckpoint,
      recentEvents: [
        {
          ...lifecycleEvent,
          id: "tool-started-2",
          workspaceId: "workspace-2",
          turnId: "turn-2",
        },
      ],
      recentHookCheckpoints: [],
    } satisfies RuntimeToolLifecycleSnapshot);

    const { result } = renderHook(() =>
      useDebugRuntimeToolLifecycle({
        workspaceId: "workspace-1",
        enabled: true,
      })
    );

    expect(result.current.lifecycleEvents).toEqual([]);
    expect(result.current.lastEvent).toEqual(lifecycleEvent);
    expect(result.current.lastHookCheckpoint).toEqual(hookCheckpoint);
    expect(result.current.hookCheckpoints).toEqual([]);
    expect(result.current.revision).toBe(3);
  });

  it("returns an empty snapshot when disabled", () => {
    const { result } = renderHook(() =>
      useDebugRuntimeToolLifecycle({
        workspaceId: "workspace-1",
        enabled: false,
      })
    );

    expect(api.subscribeRuntimeToolLifecycleSnapshot).not.toHaveBeenCalled();
    expect(result.current).toEqual({
      hookCheckpoints: [],
      lastHookCheckpoint: null,
      lifecycleEvents: [],
      lastEvent: null,
      revision: 0,
    });
  });
});
