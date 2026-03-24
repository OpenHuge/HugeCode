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
