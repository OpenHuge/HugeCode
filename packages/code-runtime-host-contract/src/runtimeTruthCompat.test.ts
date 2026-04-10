import { describe, expect, it } from "vitest";
import {
  buildRuntimeTruthCompatInputFromRunReviewPair,
  resolveCanonicalRuntimeTruth,
  resolveCanonicalRuntimeTruthFromRunReviewPair,
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

  it("keeps canonical review continuation detail ahead of legacy next-action fallback copy", () => {
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
      detail: "Review pack is ready.",
    });
  });

  it("resolves the frozen boundary, continuation, and next-action bundle from one helper", () => {
    const truth = resolveCanonicalRuntimeTruth({
      workspaceId: "ws-1",
      taskId: "task-1",
      runId: "run-1",
      reviewPackId: "review-pack:run-1",
      state: "review_ready",
      continuation: {
        state: "ready",
        pathKind: "review",
        source: "review_actionability",
        summary: "Canonical review continuation is ready.",
        detail: "Open the published review continuation.",
        recommendedAction: "Use the runtime-published review continuation.",
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

    expect(truth.sessionBoundary).toEqual({
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
    });
    expect(truth.continuation?.detail).toBe("Open the published review continuation.");
    expect(truth.nextOperatorAction).toMatchObject({
      action: "open_review_pack",
      detail: "Open the published review continuation.",
    });
  });

  it("builds canonical compat input from a review-pack-first run pair", () => {
    const compatInput = buildRuntimeTruthCompatInputFromRunReviewPair({
      run: {
        id: "run-1",
        workspaceId: "ws-1",
        taskId: "task-1",
        state: "review_ready",
        reviewPackId: "review-pack:run-1",
        approval: null,
        reviewDecision: null,
        nextAction: {
          action: "review",
          label: "Open review",
          detail: "Legacy next action should not win.",
        },
        checkpoint: {
          state: "paused",
          lifecycleState: "paused",
          checkpointId: "checkpoint-run",
          traceId: "trace-run",
          recovered: true,
          updatedAt: 1,
          resumeReady: false,
          recoveredAt: 1,
          summary: "Run checkpoint summary.",
        },
        missionLinkage: {
          workspaceId: "ws-1",
          taskId: "task-1",
          runId: "run-1",
          reviewPackId: "review-pack:run-1",
          checkpointId: "checkpoint-run",
          traceId: "trace-run",
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
          summary: "Run mission linkage.",
        },
        actionability: {
          state: "blocked",
          summary: "Run actionability should not win.",
          degradedReasons: [],
          actions: [],
        },
        publishHandoff: {
          jsonPath: ".hugecode/runs/run-1/publish/handoff.json",
          markdownPath: ".hugecode/runs/run-1/publish/handoff.md",
          summary: "Run publish handoff.",
          branchName: "main",
          reviewTitle: "Review handoff",
          details: [],
        },
        takeoverBundle: null,
        sessionBoundary: null,
        continuation: null,
        nextOperatorAction: null,
      },
      reviewPack: {
        id: "review-pack:run-1",
        workspaceId: "ws-1",
        taskId: "task-1",
        runId: "run-1",
        reviewStatus: "action_required",
        reviewDecision: {
          status: "pending",
          reviewPackId: "review-pack:run-1",
          label: "Decision pending",
          summary: "Awaiting review decision.",
          decidedAt: null,
        },
        checkpoint: {
          state: "completed",
          lifecycleState: "completed",
          checkpointId: "checkpoint-review",
          traceId: "trace-review",
          recovered: false,
          updatedAt: 2,
          resumeReady: false,
          recoveredAt: null,
          summary: "Review-pack checkpoint summary.",
        },
        missionLinkage: {
          workspaceId: "ws-1",
          taskId: "task-1",
          runId: "run-1",
          reviewPackId: "review-pack:run-1",
          checkpointId: "checkpoint-review",
          traceId: "trace-review",
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
          summary: "Review mission linkage.",
        },
        actionability: {
          state: "blocked",
          summary: "Review actionability wins.",
          degradedReasons: [],
          actions: [],
        },
        publishHandoff: {
          jsonPath: ".hugecode/runs/run-1/publish/review-handoff.json",
          markdownPath: ".hugecode/runs/run-1/publish/review-handoff.md",
          summary: "Review publish handoff wins.",
          branchName: "main",
          reviewTitle: "Review handoff",
          details: [],
        },
        takeoverBundle: {
          state: "ready",
          pathKind: "review",
          primaryAction: "open_review_pack",
          summary: "Review takeover bundle wins.",
          recommendedAction: "Open the review pack from the takeover bundle.",
          reviewPackId: "review-pack:run-1",
        },
        sessionBoundary: null,
        continuation: null,
        nextOperatorAction: null,
      },
    });

    expect(compatInput.reviewPackId).toBe("review-pack:run-1");
    expect(compatInput.reviewStatus).toBe("action_required");
    expect(compatInput.checkpoint?.checkpointId).toBe("checkpoint-review");
    expect(compatInput.actionability?.summary).toBe("Review actionability wins.");
    expect(compatInput.publishHandoff?.summary).toBe("Review publish handoff wins.");
    expect(compatInput.takeoverBundle?.summary).toBe("Review takeover bundle wins.");
    expect(compatInput.state).toBe("review_ready");
  });

  it("resolves canonical truth from a run/review pair with review-pack precedence", () => {
    const truth = resolveCanonicalRuntimeTruthFromRunReviewPair({
      run: {
        id: "run-1",
        workspaceId: "ws-1",
        taskId: "task-1",
        state: "review_ready",
        reviewPackId: "review-pack:run-1",
        approval: null,
        reviewDecision: null,
        nextAction: null,
        checkpoint: null,
        missionLinkage: null,
        actionability: {
          state: "blocked",
          summary: "Run actionability should not win.",
          degradedReasons: [],
          actions: [],
        },
        publishHandoff: null,
        takeoverBundle: null,
        sessionBoundary: null,
        continuation: null,
        nextOperatorAction: null,
      },
      reviewPack: {
        id: "review-pack:run-1",
        workspaceId: "ws-1",
        taskId: "task-1",
        runId: "run-1",
        reviewStatus: "action_required",
        reviewDecision: {
          status: "pending",
          reviewPackId: "review-pack:run-1",
          label: "Decision pending",
          summary: "Awaiting review decision.",
          decidedAt: null,
        },
        checkpoint: null,
        missionLinkage: {
          workspaceId: "ws-1",
          taskId: "task-1",
          runId: "run-1",
          reviewPackId: "review-pack:run-1",
          checkpointId: null,
          traceId: null,
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
          summary: "Review mission linkage.",
        },
        actionability: {
          state: "blocked",
          summary: "Review actionability wins.",
          degradedReasons: [],
          actions: [],
        },
        publishHandoff: null,
        takeoverBundle: {
          state: "ready",
          pathKind: "review",
          primaryAction: "open_review_pack",
          summary: "Review takeover bundle wins.",
          recommendedAction: "Open the review pack from the takeover bundle.",
          reviewPackId: "review-pack:run-1",
        },
        sessionBoundary: null,
        continuation: null,
        nextOperatorAction: null,
      },
    });

    expect(truth.continuation).toMatchObject({
      source: "takeover_bundle",
      summary: "Review takeover bundle wins.",
      recommendedAction: "Open the review pack from the takeover bundle.",
    });
    expect(truth.nextOperatorAction).toMatchObject({
      action: "open_review_pack",
      source: "review_pack",
    });
  });
});
