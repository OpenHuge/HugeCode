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

describe("useDebugRuntimeToolLifecycle", () => {
  let api: RuntimeToolLifecycleTestApi;

  beforeEach(async () => {
    api =
      (await import("../../../application/runtime/ports/runtimeToolLifecycle")) as unknown as RuntimeToolLifecycleTestApi;
    api.getRuntimeToolLifecycleSnapshot.mockReturnValue({
      revision: 2,
      lastEvent: lifecycleEvent,
      recentEvents: [
        lifecycleEvent,
        {
          ...lifecycleEvent,
          id: "tool-started-2",
          workspaceId: "workspace-2",
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
  });

  it("preserves a matching lastEvent even when it is not present in recentEvents", () => {
    api.getRuntimeToolLifecycleSnapshot.mockReturnValue({
      revision: 3,
      lastEvent: lifecycleEvent,
      recentEvents: [
        {
          ...lifecycleEvent,
          id: "tool-started-2",
          workspaceId: "workspace-2",
          turnId: "turn-2",
        },
      ],
    } satisfies RuntimeToolLifecycleSnapshot);

    const { result } = renderHook(() =>
      useDebugRuntimeToolLifecycle({
        workspaceId: "workspace-1",
        enabled: true,
      })
    );

    expect(result.current.lifecycleEvents).toEqual([]);
    expect(result.current.lastEvent).toEqual(lifecycleEvent);
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
      lifecycleEvents: [],
      lastEvent: null,
      revision: 0,
    });
  });
});
