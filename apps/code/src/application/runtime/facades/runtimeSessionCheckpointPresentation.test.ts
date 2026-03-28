import { describe, expect, it } from "vitest";
import type { RuntimeSessionCheckpointBaseline } from "../types/runtimeSessionCheckpoint";
import {
  buildRuntimeSessionCheckpointPresentationSummary,
  formatRuntimeSessionCheckpointRecordKey,
  formatRuntimeSessionCheckpointSessionLabel,
  sortRuntimeSessionCheckpointSessionsByRecency,
} from "./runtimeSessionCheckpointPresentation";

function createRuntimeSessionCheckpointBaseline(): RuntimeSessionCheckpointBaseline {
  return {
    schemaVersion: "runtime-session-checkpoint-baseline/v1",
    workspaceId: "workspace-1",
    lifecycleRevision: 4,
    projectionSource: "runtime_tool_lifecycle",
    sessions: [
      {
        sessionKey: "thread:thread-1",
        branchKey: "thread:thread-1/turn:turn-1",
        workspaceId: "workspace-1",
        threadId: "thread-1",
        turnId: "turn-1",
        toolCallId: "tool-call-1",
        latestActivityAt: 200,
        replay: {
          ordering: "chronological",
          compaction: "latest_record_per_identity",
          lastLifecycleEventId: "tool-completed-1",
          lastHookCheckpointKey: "hook-1",
        },
        records: [
          {
            recordKind: "lifecycle_event",
            recordId: "event:tool-completed-1",
            lifecycleEventId: "tool-completed-1",
            lifecycleKind: "tool",
            lifecyclePhase: "completed",
            source: "app-event",
            status: "success",
            at: 200,
            correlationKey: "tool-call-1",
            toolName: "bash",
            scope: "write",
            errorCode: null,
          },
          {
            recordKind: "hook_checkpoint",
            recordId: "checkpoint:hook-1",
            hookCheckpointKey: "hook-1",
            hookPoint: "post_execution_pre_publication",
            source: "app-event",
            status: "ready",
            at: 200,
            lifecycleEventId: "tool-completed-1",
            toolName: "bash",
            scope: "write",
            reason: null,
          },
        ],
        checkpoints: [
          {
            checkpointKey: "hook-1",
            hookPoint: "post_execution_pre_publication",
            status: "ready",
            lifecycleEventId: "tool-completed-1",
            source: "app-event",
            at: 200,
            toolName: "bash",
            scope: "write",
            reason: null,
          },
        ],
      },
      {
        sessionKey: "thread:thread-2",
        branchKey: null,
        workspaceId: "workspace-1",
        threadId: "thread-2",
        turnId: null,
        toolCallId: null,
        latestActivityAt: 300,
        replay: {
          ordering: "chronological",
          compaction: "latest_record_per_identity",
          lastLifecycleEventId: "approval-requested-1",
          lastHookCheckpointKey: null,
        },
        records: [
          {
            recordKind: "lifecycle_event",
            recordId: "event:approval-requested-1",
            lifecycleEventId: "approval-requested-1",
            lifecycleKind: "approval",
            lifecyclePhase: "requested",
            source: "telemetry",
            status: "pending",
            at: 300,
            correlationKey: "approval-1",
            toolName: null,
            scope: null,
            errorCode: null,
          },
        ],
        checkpoints: [],
      },
    ],
  };
}

describe("runtimeSessionCheckpointPresentation", () => {
  it("formats session labels, record keys, and recency ordering", () => {
    const baseline = createRuntimeSessionCheckpointBaseline();
    const sessions = sortRuntimeSessionCheckpointSessionsByRecency(baseline.sessions);

    expect(sessions.map((session) => session.sessionKey)).toEqual([
      "thread:thread-2",
      "thread:thread-1",
    ]);
    expect(formatRuntimeSessionCheckpointSessionLabel(baseline.sessions[0]!)).toBe(
      "thread:thread-1/turn:turn-1"
    );
    expect(formatRuntimeSessionCheckpointSessionLabel(baseline.sessions[1]!)).toBe(
      "thread:thread-2"
    );
    expect(formatRuntimeSessionCheckpointRecordKey(baseline.sessions[0]!.records[0]!)).toBe(
      "tool/completed"
    );
    expect(formatRuntimeSessionCheckpointRecordKey(baseline.sessions[0]!.records[1]!)).toBe(
      "post_execution_pre_publication/ready"
    );
  });

  it("builds a structured session presentation summary", () => {
    const summary = buildRuntimeSessionCheckpointPresentationSummary(
      createRuntimeSessionCheckpointBaseline()
    );

    expect(summary).toMatchObject({
      hasSessions: true,
      totalSessions: 2,
      totalCheckpointPayloads: 1,
      totalRecords: 3,
      latestSessionLabel: "thread:thread-2",
      latestLifecycleEventId: "approval-requested-1",
      latestHookCheckpointKey: null,
    });
  });
});
