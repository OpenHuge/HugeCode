// @vitest-environment jsdom

import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDebugRuntimeToolLifecycle } from "./useDebugRuntimeToolLifecycle";
import type { RuntimeToolLifecycleSnapshot } from "../../../application/runtime/ports/runtimeToolLifecycle";

type RuntimeToolLifecycleTestApi = {
  getWorkspaceRuntimeToolLifecycleSnapshot: ReturnType<typeof vi.fn>;
  subscribeWorkspaceRuntimeToolLifecycleSnapshot: ReturnType<typeof vi.fn>;
};

vi.mock("../../../application/runtime/ports/runtimeToolLifecycle", async () => {
  const actual = await vi.importActual<
    typeof import("../../../application/runtime/ports/runtimeToolLifecycle")
  >("../../../application/runtime/ports/runtimeToolLifecycle");
  return {
    ...actual,
    getWorkspaceRuntimeToolLifecycleSnapshot: vi.fn(),
    subscribeWorkspaceRuntimeToolLifecycleSnapshot: vi.fn(() => () => undefined),
  };
});

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
    api.getWorkspaceRuntimeToolLifecycleSnapshot.mockReturnValue({
      revision: 2,
      lastEvent: lifecycleEvent,
      lastHookCheckpoint: hookCheckpoint,
      recentEvents: [lifecycleEvent],
      recentHookCheckpoints: [hookCheckpoint],
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

    expect(api.subscribeWorkspaceRuntimeToolLifecycleSnapshot).toHaveBeenCalledTimes(1);
    expect(api.subscribeWorkspaceRuntimeToolLifecycleSnapshot).toHaveBeenCalledWith(
      "workspace-1",
      expect.any(Function)
    );
    expect(result.current.lifecycleEvents).toEqual([lifecycleEvent]);
    expect(result.current.lastEvent).toEqual(lifecycleEvent);
    expect(result.current.hookCheckpoints).toEqual([hookCheckpoint]);
    expect(result.current.lastHookCheckpoint).toEqual(hookCheckpoint);
    expect(result.current.summary).toMatchObject({
      totalEvents: 1,
      totalHookCheckpoints: 1,
      latestEventKey: "tool/started",
      latestHookCheckpointKey: "post_execution_pre_publication/ready",
    });
    expect(result.current.sessionCheckpointBaseline.sessions).toHaveLength(1);
    expect(result.current.sessionCheckpointSummary).toMatchObject({
      hasSessions: true,
      latestSessionLabel: "thread:thread-1/turn:turn-1",
    });
  });

  it("preserves a matching lastEvent even when it is not present in recentEvents", () => {
    api.getWorkspaceRuntimeToolLifecycleSnapshot.mockReturnValue({
      revision: 3,
      lastEvent: lifecycleEvent,
      lastHookCheckpoint: hookCheckpoint,
      recentEvents: [],
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
    expect(result.current.summary).toMatchObject({
      totalEvents: 0,
      totalHookCheckpoints: 0,
      hasActivity: false,
    });
    expect(result.current.sessionCheckpointBaseline.sessions).toHaveLength(1);
  });

  it("returns an empty snapshot when disabled", () => {
    const { result } = renderHook(() =>
      useDebugRuntimeToolLifecycle({
        workspaceId: "workspace-1",
        enabled: false,
      })
    );

    expect(api.subscribeWorkspaceRuntimeToolLifecycleSnapshot).not.toHaveBeenCalled();
    expect(result.current).toEqual({
      summary: {
        approvalEventCount: 0,
        hasActivity: false,
        latestEvent: null,
        latestEventKey: null,
        latestHookCheckpoint: null,
        latestHookCheckpointKey: null,
        toolEventCount: 0,
        totalEvents: 0,
        totalHookCheckpoints: 0,
      },
      hookCheckpoints: [],
      lastHookCheckpoint: null,
      lifecycleEvents: [],
      lastEvent: null,
      revision: 0,
      sessionCheckpointBaseline: {
        schemaVersion: "runtime-session-checkpoint-baseline/v1",
        workspaceId: "workspace-1",
        lifecycleRevision: 0,
        projectionSource: "runtime_tool_lifecycle",
        sessions: [],
      },
      sessionCheckpointSummary: expect.objectContaining({
        hasSessions: false,
        latestSession: null,
        latestSessionLabel: null,
        totalSessions: 0,
      }),
    });
  });
});
