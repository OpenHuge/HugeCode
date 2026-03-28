// @vitest-environment jsdom

import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RuntimeToolLifecycleSnapshot } from "../../../application/runtime/ports/runtimeToolLifecycle";
import { useWorkspaceRuntimeSessionCheckpoint } from "./useWorkspaceRuntimeSessionCheckpoint";

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

describe("useWorkspaceRuntimeSessionCheckpoint", () => {
  let api: RuntimeToolLifecycleTestApi;

  beforeEach(async () => {
    api =
      (await import("../../../application/runtime/ports/runtimeToolLifecycle")) as unknown as RuntimeToolLifecycleTestApi;
    api.getWorkspaceRuntimeToolLifecycleSnapshot.mockReturnValue({
      revision: 5,
      lastEvent: {
        id: "tool-completed-1",
        correlationKey: "thread-1:tool-call-1",
        kind: "tool",
        phase: "completed",
        source: "app-event",
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
          correlationKey: "thread-1:tool-call-1",
          kind: "tool",
          phase: "completed",
          source: "app-event",
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
        source: "app-event",
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
          source: "app-event",
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

  it("projects a shared structured session baseline from the workspace-scoped lifecycle hook", () => {
    const { result } = renderHook(() =>
      useWorkspaceRuntimeSessionCheckpoint({
        workspaceId: "workspace-1",
        enabled: true,
      })
    );

    expect(result.current.lifecycle.revision).toBe(5);
    expect(result.current.lifecycle.summary).toMatchObject({
      totalEvents: 1,
      totalHookCheckpoints: 1,
      latestEventKey: "tool/completed",
    });
    expect(result.current.sessionCheckpointBaseline).toMatchObject({
      schemaVersion: "runtime-session-checkpoint-baseline/v1",
      lifecycleRevision: 5,
      sessions: [
        expect.objectContaining({
          sessionKey: "thread:thread-1",
          branchKey: "thread:thread-1/turn:turn-1",
        }),
      ],
    });
    expect(result.current.sessionCheckpointSummary).toMatchObject({
      hasSessions: true,
      latestSessionLabel: "thread:thread-1/turn:turn-1",
      totalSessions: 1,
      totalCheckpointPayloads: 1,
    });
  });

  it("returns an empty structured baseline when disabled", () => {
    const { result } = renderHook(() =>
      useWorkspaceRuntimeSessionCheckpoint({
        workspaceId: "workspace-1",
        enabled: false,
      })
    );

    expect(result.current.lifecycle).toEqual({
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
    expect(result.current.sessionCheckpointBaseline).toEqual({
      schemaVersion: "runtime-session-checkpoint-baseline/v1",
      workspaceId: "workspace-1",
      lifecycleRevision: 0,
      projectionSource: "runtime_tool_lifecycle",
      sessions: [],
    });
    expect(result.current.sessionCheckpointSummary).toMatchObject({
      hasSessions: false,
      latestSession: null,
      latestSessionLabel: null,
      totalSessions: 0,
    });
  });
});
