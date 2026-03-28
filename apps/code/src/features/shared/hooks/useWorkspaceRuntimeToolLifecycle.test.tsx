// @vitest-environment jsdom

import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWorkspaceRuntimeToolLifecycle } from "./useWorkspaceRuntimeToolLifecycle";
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

describe("useWorkspaceRuntimeToolLifecycle", () => {
  let api: RuntimeToolLifecycleTestApi;

  beforeEach(async () => {
    api =
      (await import("../../../application/runtime/ports/runtimeToolLifecycle")) as unknown as RuntimeToolLifecycleTestApi;
    api.getWorkspaceRuntimeToolLifecycleSnapshot.mockReturnValue({
      revision: 7,
      lastEvent: {
        id: "tool-completed-1",
        kind: "tool",
        phase: "completed",
        source: "telemetry",
        workspaceId: "workspace-1",
        threadId: "thread-1",
        turnId: "turn-1",
        toolCallId: "tool-call-1",
        toolName: "bash",
        scope: "write",
        status: "success",
        at: 1_770_000_000_100,
        errorCode: null,
      },
      recentEvents: [
        {
          id: "tool-completed-1",
          kind: "tool",
          phase: "completed",
          source: "telemetry",
          workspaceId: "workspace-1",
          threadId: "thread-1",
          turnId: "turn-1",
          toolCallId: "tool-call-1",
          toolName: "bash",
          scope: "write",
          status: "success",
          at: 1_770_000_000_100,
          errorCode: null,
        },
      ],
      lastHookCheckpoint: {
        key: "workspace-1:post_execution_pre_publication",
        point: "post_execution_pre_publication",
        status: "ready",
        source: "telemetry",
        workspaceId: "workspace-1",
        threadId: "thread-1",
        turnId: "turn-1",
        toolCallId: "tool-call-1",
        toolName: "bash",
        scope: "write",
        lifecycleEventId: "tool-completed-1",
        at: 1_770_000_000_100,
        reason: null,
      },
      recentHookCheckpoints: [
        {
          key: "workspace-1:post_execution_pre_publication",
          point: "post_execution_pre_publication",
          status: "ready",
          source: "telemetry",
          workspaceId: "workspace-1",
          threadId: "thread-1",
          turnId: "turn-1",
          toolCallId: "tool-call-1",
          toolName: "bash",
          scope: "write",
          lifecycleEventId: "tool-completed-1",
          at: 1_770_000_000_100,
          reason: null,
        },
      ],
    } satisfies RuntimeToolLifecycleSnapshot);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("reads and subscribes through the workspace-scoped runtime lifecycle boundary", () => {
    const { result } = renderHook(() =>
      useWorkspaceRuntimeToolLifecycle({
        workspaceId: "workspace-1",
        enabled: true,
      })
    );

    expect(api.subscribeWorkspaceRuntimeToolLifecycleSnapshot).toHaveBeenCalledTimes(1);
    expect(api.subscribeWorkspaceRuntimeToolLifecycleSnapshot).toHaveBeenCalledWith(
      "workspace-1",
      expect.any(Function)
    );
    expect(api.getWorkspaceRuntimeToolLifecycleSnapshot).toHaveBeenCalledWith("workspace-1");
    expect(result.current).toEqual({
      summary: expect.objectContaining({
        totalEvents: 1,
        totalHookCheckpoints: 1,
        toolEventCount: 1,
        latestEventKey: "tool/completed",
        latestHookCheckpointKey: "post_execution_pre_publication/ready",
      }),
      revision: 7,
      lastEvent: expect.objectContaining({
        workspaceId: "workspace-1",
        toolName: "bash",
      }),
      lastHookCheckpoint: expect.objectContaining({
        workspaceId: "workspace-1",
        point: "post_execution_pre_publication",
      }),
      hookCheckpoints: [
        expect.objectContaining({
          workspaceId: "workspace-1",
          point: "post_execution_pre_publication",
        }),
      ],
      lifecycleEvents: [
        expect.objectContaining({
          workspaceId: "workspace-1",
          toolName: "bash",
        }),
      ],
    });
  });

  it("returns presentation-ready lifecycle state with recency-sorted collections", () => {
    api.getWorkspaceRuntimeToolLifecycleSnapshot.mockReturnValue({
      revision: 8,
      lastEvent: {
        id: "tool-completed-2",
        kind: "tool",
        phase: "completed",
        source: "telemetry",
        workspaceId: "workspace-1",
        threadId: "thread-1",
        turnId: "turn-1",
        toolCallId: "tool-call-2",
        toolName: "grep",
        scope: "read",
        status: "success",
        at: 1_770_000_000_200,
        errorCode: null,
      },
      recentEvents: [
        {
          id: "tool-started-1",
          kind: "tool",
          phase: "started",
          source: "telemetry",
          workspaceId: "workspace-1",
          threadId: "thread-1",
          turnId: "turn-1",
          toolCallId: "tool-call-1",
          toolName: "bash",
          scope: "write",
          status: "in_progress",
          at: 1_770_000_000_100,
          errorCode: null,
        },
        {
          id: "tool-completed-2",
          kind: "tool",
          phase: "completed",
          source: "telemetry",
          workspaceId: "workspace-1",
          threadId: "thread-1",
          turnId: "turn-1",
          toolCallId: "tool-call-2",
          toolName: "grep",
          scope: "read",
          status: "success",
          at: 1_770_000_000_200,
          errorCode: null,
        },
      ],
      lastHookCheckpoint: {
        key: "workspace-1:post_execution_pre_publication",
        point: "post_execution_pre_publication",
        status: "ready",
        source: "telemetry",
        workspaceId: "workspace-1",
        threadId: "thread-1",
        turnId: "turn-1",
        toolCallId: "tool-call-2",
        toolName: "grep",
        scope: "read",
        lifecycleEventId: "tool-completed-2",
        at: 1_770_000_000_200,
        reason: null,
      },
      recentHookCheckpoints: [
        {
          key: "workspace-1:post_validation_pre_execution",
          point: "post_validation_pre_execution",
          status: "ready",
          source: "telemetry",
          workspaceId: "workspace-1",
          threadId: "thread-1",
          turnId: "turn-1",
          toolCallId: "tool-call-1",
          toolName: "bash",
          scope: "write",
          lifecycleEventId: "tool-started-1",
          at: 1_770_000_000_100,
          reason: null,
        },
        {
          key: "workspace-1:post_execution_pre_publication",
          point: "post_execution_pre_publication",
          status: "ready",
          source: "telemetry",
          workspaceId: "workspace-1",
          threadId: "thread-1",
          turnId: "turn-1",
          toolCallId: "tool-call-2",
          toolName: "grep",
          scope: "read",
          lifecycleEventId: "tool-completed-2",
          at: 1_770_000_000_200,
          reason: null,
        },
      ],
    } satisfies RuntimeToolLifecycleSnapshot);

    const { result } = renderHook(() =>
      useWorkspaceRuntimeToolLifecycle({
        workspaceId: "workspace-1",
        enabled: true,
      })
    );

    expect(result.current.lifecycleEvents.map((event) => event.id)).toEqual([
      "tool-completed-2",
      "tool-started-1",
    ]);
    expect(result.current.hookCheckpoints.map((checkpoint) => checkpoint.key)).toEqual([
      "workspace-1:post_execution_pre_publication",
      "workspace-1:post_validation_pre_execution",
    ]);
    expect(result.current.summary).toMatchObject({
      totalEvents: 2,
      totalHookCheckpoints: 2,
      latestEventKey: "tool/completed",
      latestHookCheckpointKey: "post_execution_pre_publication/ready",
    });
  });

  it("returns an empty snapshot and skips runtime subscriptions when disabled", () => {
    const { result } = renderHook(() =>
      useWorkspaceRuntimeToolLifecycle({
        workspaceId: "workspace-1",
        enabled: false,
      })
    );

    expect(api.subscribeWorkspaceRuntimeToolLifecycleSnapshot).not.toHaveBeenCalled();
    expect(api.getWorkspaceRuntimeToolLifecycleSnapshot).not.toHaveBeenCalled();
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
      revision: 0,
      lastHookCheckpoint: null,
      lastEvent: null,
      hookCheckpoints: [],
      lifecycleEvents: [],
    });
  });
});
