import { describe, expect, it } from "vitest";
import type { RuntimeToolLifecycleSnapshot } from "../types/runtimeToolLifecycle";
import { buildRuntimeSessionCheckpointBaseline } from "./runtimeSessionCheckpointFacade";

function createLifecycleSnapshot(): RuntimeToolLifecycleSnapshot {
  return {
    revision: 7,
    lastEvent: {
      id: "tool-completed-1",
      correlationKey: "thread-1:tool-call-1",
      kind: "tool",
      phase: "completed",
      source: "app-event",
      workspaceId: "workspace-a",
      threadId: "thread-1",
      turnId: "turn-1",
      toolCallId: "tool-call-1",
      toolName: "bash",
      scope: "write",
      status: "success",
      at: 300,
      errorCode: null,
    },
    recentEvents: [
      {
        id: "tool-started-1",
        correlationKey: "thread-1:tool-call-1",
        kind: "tool",
        phase: "started",
        source: "app-event",
        workspaceId: "workspace-a",
        threadId: "thread-1",
        turnId: "turn-1",
        toolCallId: "tool-call-1",
        toolName: "bash",
        scope: "write",
        status: "in_progress",
        at: 200,
        errorCode: null,
      },
      {
        id: "tool-completed-1",
        correlationKey: "thread-1:tool-call-1",
        kind: "tool",
        phase: "completed",
        source: "app-event",
        workspaceId: "workspace-a",
        threadId: "thread-1",
        turnId: "turn-1",
        toolCallId: "tool-call-1",
        toolName: "bash",
        scope: "write",
        status: "success",
        at: 300,
        errorCode: null,
      },
    ],
    lastHookCheckpoint: {
      key: "workspace-a:post_execution_pre_publication",
      point: "post_execution_pre_publication",
      status: "ready",
      source: "app-event",
      workspaceId: "workspace-a",
      threadId: "thread-1",
      turnId: "turn-1",
      toolCallId: "tool-call-1",
      toolName: "bash",
      scope: "write",
      lifecycleEventId: "tool-completed-1",
      at: 300,
      reason: null,
    },
    recentHookCheckpoints: [
      {
        key: "workspace-a:post_execution_pre_publication",
        point: "post_execution_pre_publication",
        status: "ready",
        source: "app-event",
        workspaceId: "workspace-a",
        threadId: "thread-1",
        turnId: "turn-1",
        toolCallId: "tool-call-1",
        toolName: "bash",
        scope: "write",
        lifecycleEventId: "tool-completed-1",
        at: 300,
        reason: null,
      },
    ],
  };
}

describe("buildRuntimeSessionCheckpointBaseline", () => {
  it("builds a structured session timeline that references lifecycle event ids and hook checkpoints", () => {
    const baseline = buildRuntimeSessionCheckpointBaseline({
      workspaceId: "workspace-a",
      lifecycleSnapshot: createLifecycleSnapshot(),
    });

    expect(baseline.schemaVersion).toBe("runtime-session-checkpoint-baseline/v1");
    expect(baseline.lifecycleRevision).toBe(7);
    expect(baseline.sessions).toHaveLength(1);
    expect(baseline.sessions[0]).toMatchObject({
      sessionKey: "thread:thread-1",
      branchKey: "thread:thread-1/turn:turn-1",
      replay: {
        ordering: "chronological",
        compaction: "latest_record_per_identity",
        lastLifecycleEventId: "tool-completed-1",
        lastHookCheckpointKey: "workspace-a:post_execution_pre_publication",
      },
    });
    expect(
      baseline.sessions[0]?.records.map((record) =>
        record.recordKind === "lifecycle_event"
          ? `${record.recordKind}:${record.lifecycleEventId}`
          : `${record.recordKind}:${record.hookCheckpointKey}`
      )
    ).toEqual([
      "lifecycle_event:tool-started-1",
      "lifecycle_event:tool-completed-1",
      "hook_checkpoint:workspace-a:post_execution_pre_publication",
    ]);
    expect(baseline.sessions[0]?.checkpoints).toEqual([
      expect.objectContaining({
        checkpointKey: "workspace-a:post_execution_pre_publication",
        lifecycleEventId: "tool-completed-1",
      }),
    ]);
  });

  it("dedupes repeated snapshot entries and keeps session replay ordering deterministic", () => {
    const baseline = buildRuntimeSessionCheckpointBaseline({
      workspaceId: "workspace-a",
      lifecycleSnapshot: {
        revision: 9,
        lastEvent: {
          id: "approval-resolved-2",
          correlationKey: "thread-2:approval-2",
          kind: "approval",
          phase: "resolved",
          source: "app-event",
          workspaceId: "workspace-a",
          threadId: "thread-2",
          turnId: "turn-2",
          toolCallId: null,
          toolName: null,
          scope: null,
          status: "approved",
          at: 500,
          errorCode: null,
          approvalDecision: "approved",
        },
        recentEvents: [
          {
            id: "tool-started-1",
            correlationKey: "thread-1:tool-call-1",
            kind: "tool",
            phase: "started",
            source: "app-event",
            workspaceId: "workspace-a",
            threadId: "thread-1",
            turnId: "turn-1",
            toolCallId: "tool-call-1",
            toolName: "bash",
            scope: "write",
            status: "in_progress",
            at: 200,
            errorCode: null,
          },
          {
            id: "approval-resolved-2",
            correlationKey: "thread-2:approval-2",
            kind: "approval",
            phase: "resolved",
            source: "app-event",
            workspaceId: "workspace-a",
            threadId: "thread-2",
            turnId: "turn-2",
            toolCallId: null,
            toolName: null,
            scope: null,
            status: "approved",
            at: 500,
            errorCode: null,
            approvalDecision: "approved",
          },
          {
            id: "approval-resolved-2",
            correlationKey: "thread-2:approval-2",
            kind: "approval",
            phase: "resolved",
            source: "app-event",
            workspaceId: "workspace-a",
            threadId: "thread-2",
            turnId: "turn-2",
            toolCallId: null,
            toolName: null,
            scope: null,
            status: "approved",
            at: 500,
            errorCode: null,
            approvalDecision: "approved",
          },
        ],
        lastHookCheckpoint: {
          key: "workspace-a:post_validation_pre_execution",
          point: "post_validation_pre_execution",
          status: "completed",
          source: "app-event",
          workspaceId: "workspace-a",
          threadId: "thread-2",
          turnId: "turn-2",
          toolCallId: null,
          toolName: null,
          scope: null,
          lifecycleEventId: "approval-resolved-2",
          at: 500,
          reason: null,
        },
        recentHookCheckpoints: [
          {
            key: "workspace-a:post_validation_pre_execution",
            point: "post_validation_pre_execution",
            status: "completed",
            source: "app-event",
            workspaceId: "workspace-a",
            threadId: "thread-2",
            turnId: "turn-2",
            toolCallId: null,
            toolName: null,
            scope: null,
            lifecycleEventId: "approval-resolved-2",
            at: 500,
            reason: null,
          },
          {
            key: "workspace-a:post_execution_pre_publication",
            point: "post_execution_pre_publication",
            status: "ready",
            source: "app-event",
            workspaceId: "workspace-a",
            threadId: "thread-1",
            turnId: "turn-1",
            toolCallId: "tool-call-1",
            toolName: "bash",
            scope: "write",
            lifecycleEventId: "tool-started-1",
            at: 200,
            reason: null,
          },
        ],
      },
    });

    expect(baseline.sessions.map((session) => session.sessionKey)).toEqual([
      "thread:thread-2",
      "thread:thread-1",
    ]);
    expect(baseline.sessions[0]?.records).toHaveLength(2);
    expect(baseline.sessions[0]?.records.map((record) => record.recordId)).toEqual([
      "event:approval-resolved-2",
      "checkpoint:workspace-a:post_validation_pre_execution",
    ]);
    expect(baseline.sessions[1]?.records.map((record) => record.recordId)).toEqual([
      "event:tool-started-1",
      "checkpoint:workspace-a:post_execution_pre_publication",
    ]);
  });
});
