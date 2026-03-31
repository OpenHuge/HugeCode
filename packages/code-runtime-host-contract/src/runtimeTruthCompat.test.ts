import { describe, expect, it } from "vitest";
import {
  resolveRuntimeContinuation,
  resolveRuntimeNextOperatorAction,
  resolveRuntimeSessionBoundary,
} from "./runtimeTruthCompat";

describe("runtimeTruthCompat", () => {
  it("builds a runtime session boundary from mission linkage", () => {
    const boundary = resolveRuntimeSessionBoundary({
      reviewPackId: "review-pack:run-1",
      missionLinkage: {
        workspaceId: "ws-1",
        taskId: "task-1",
        runId: "run-1",
        reviewPackId: "review-pack:run-1",
        checkpointId: "checkpoint-1",
        traceId: "trace-1",
        threadId: "thread-1",
        requestId: "request-1",
        missionTaskId: "task-1",
        taskEntityKind: "thread",
        recoveryPath: "thread",
        navigationTarget: {
          kind: "thread",
          workspaceId: "ws-1",
          threadId: "thread-1",
        },
        summary: "Thread linkage ready.",
      },
    });

    expect(boundary).toEqual({
      workspaceId: "ws-1",
      taskId: "task-1",
      runId: "run-1",
      missionTaskId: "task-1",
      sessionKind: "thread",
      threadId: "thread-1",
      requestId: "request-1",
      reviewPackId: "review-pack:run-1",
      checkpointId: "checkpoint-1",
      traceId: "trace-1",
      navigationTarget: {
        kind: "thread",
        workspaceId: "ws-1",
        threadId: "thread-1",
      },
    });
  });

  it("derives canonical continuation from the takeover bundle before older fields", () => {
    const continuation = resolveRuntimeContinuation({
      workspaceId: "ws-1",
      taskId: "task-1",
      runId: "run-1",
      reviewPackId: "review-pack:run-1",
      checkpoint: {
        state: "completed",
        lifecycleState: "completed",
        checkpointId: "checkpoint-1",
        traceId: "trace-1",
        recovered: false,
        updatedAt: 1,
        resumeReady: false,
        recoveredAt: null,
        summary: "Checkpoint ready.",
      },
      missionLinkage: {
        workspaceId: "ws-1",
        taskId: "task-1",
        runId: "run-1",
        reviewPackId: "review-pack:run-1",
        checkpointId: "checkpoint-1",
        traceId: "trace-1",
        threadId: "thread-1",
        requestId: null,
        missionTaskId: "task-1",
        taskEntityKind: "thread",
        recoveryPath: "thread",
        navigationTarget: {
          kind: "thread",
          workspaceId: "ws-1",
          threadId: "thread-1",
        },
        summary: "Thread linkage ready.",
      },
      takeoverBundle: {
        state: "ready",
        pathKind: "review",
        primaryAction: "open_review_pack",
        summary: "Open review pack.",
        blockingReason: null,
        recommendedAction: "Continue from Review Pack.",
        target: {
          kind: "review_pack",
          workspaceId: "ws-1",
          taskId: "task-1",
          runId: "run-1",
          reviewPackId: "review-pack:run-1",
          checkpointId: "checkpoint-1",
          traceId: "trace-1",
        },
        checkpointId: "checkpoint-1",
        traceId: "trace-1",
        reviewPackId: "review-pack:run-1",
        publishHandoff: null,
        reviewActionability: {
          state: "ready",
          summary: "Review ready.",
          degradedReasons: [],
          actions: [],
        },
      },
      actionability: {
        state: "blocked",
        summary: "Legacy actionability should not win.",
        degradedReasons: [],
        actions: [],
      },
    });

    expect(continuation?.source).toBe("takeover_bundle");
    expect(continuation?.pathKind).toBe("review");
    expect(continuation?.detail).toBe("Review ready.");
    expect(continuation?.target).toEqual({
      kind: "review_pack",
      workspaceId: "ws-1",
      taskId: "task-1",
      runId: "run-1",
      reviewPackId: "review-pack:run-1",
      checkpointId: "checkpoint-1",
      traceId: "trace-1",
    });
  });

  it("derives a review-first next operator action from canonical continuation", () => {
    const action = resolveRuntimeNextOperatorAction({
      workspaceId: "ws-1",
      taskId: "task-1",
      runId: "run-1",
      reviewPackId: "review-pack:run-1",
      state: "review_ready",
      reviewStatus: "action_required",
      continuation: {
        state: "blocked",
        pathKind: "review",
        source: "takeover_bundle",
        summary: "Review follow-up blocked.",
        detail: "Resolve the blocked review follow-up.",
        recommendedAction: "Open Review Pack and resolve the blocked review.",
        target: {
          kind: "review_pack",
          workspaceId: "ws-1",
          taskId: "task-1",
          runId: "run-1",
          reviewPackId: "review-pack:run-1",
          checkpointId: null,
          traceId: null,
        },
        reviewPackId: "review-pack:run-1",
        reviewActionability: null,
        sessionBoundary: {
          workspaceId: "ws-1",
          taskId: "task-1",
          runId: "run-1",
          missionTaskId: "task-1",
          sessionKind: "run",
          threadId: null,
          requestId: null,
          reviewPackId: "review-pack:run-1",
          checkpointId: null,
          traceId: null,
          navigationTarget: {
            kind: "run",
            workspaceId: "ws-1",
            taskId: "task-1",
            runId: "run-1",
            reviewPackId: "review-pack:run-1",
            checkpointId: null,
            traceId: null,
          },
        },
      },
    });

    expect(action).toEqual({
      action: "open_review_pack",
      label: "Resolve review",
      detail: "Resolve the blocked review follow-up.",
      source: "review_pack",
      target: {
        kind: "review_pack",
        workspaceId: "ws-1",
        taskId: "task-1",
        runId: "run-1",
        reviewPackId: "review-pack:run-1",
        checkpointId: null,
        traceId: null,
      },
      sessionBoundary: {
        workspaceId: "ws-1",
        taskId: "task-1",
        runId: "run-1",
        missionTaskId: "task-1",
        sessionKind: "run",
        threadId: null,
        requestId: null,
        reviewPackId: "review-pack:run-1",
        checkpointId: null,
        traceId: null,
        navigationTarget: {
          kind: "run",
          workspaceId: "ws-1",
          taskId: "task-1",
          runId: "run-1",
          reviewPackId: "review-pack:run-1",
          checkpointId: null,
          traceId: null,
        },
      },
    });
  });

  it("keeps explicit runtime next-action detail ahead of fallback continuation copy", () => {
    const action = resolveRuntimeNextOperatorAction({
      workspaceId: "ws-1",
      taskId: "task-1",
      runId: "run-1",
      reviewPackId: "review-pack:run-1",
      state: "review_ready",
      nextAction: {
        action: "review",
        label: "Open review pack",
        detail: "Inspect the review pack and accept or retry.",
      },
      takeoverBundle: {
        state: "ready",
        pathKind: "review",
        primaryAction: "open_review_pack",
        summary: "Review pack is ready.",
        recommendedAction: "Open the published review pack.",
        reviewPackId: "review-pack:run-1",
      },
    });

    expect(action).toMatchObject({
      action: "open_review_pack",
      detail: "Inspect the review pack and accept or retry.",
    });
  });
});
