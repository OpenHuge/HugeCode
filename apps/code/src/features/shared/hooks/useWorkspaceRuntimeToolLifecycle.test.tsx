// @vitest-environment jsdom

import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWorkspaceRuntimeToolLifecycle } from "./useWorkspaceRuntimeToolLifecycle";
import type { RuntimeToolLifecycleSnapshot } from "../../../application/runtime/ports/runtimeToolLifecycle";

type RuntimeToolLifecycleTestApi = {
  getWorkspaceRuntimeToolLifecycleSnapshot: ReturnType<typeof vi.fn>;
  subscribeWorkspaceRuntimeToolLifecycleSnapshot: ReturnType<typeof vi.fn>;
};

vi.mock("../../../application/runtime/ports/runtimeToolLifecycle", () => ({
  getWorkspaceRuntimeToolLifecycleSnapshot: vi.fn(),
  subscribeWorkspaceRuntimeToolLifecycleSnapshot: vi.fn(() => () => undefined),
}));

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
      revision: 0,
      lastHookCheckpoint: null,
      lastEvent: null,
      hookCheckpoints: [],
      lifecycleEvents: [],
    });
  });
});
