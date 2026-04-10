import { describe, expect, it } from "vitest";
import type {
  HugeCodeReviewPackSummary,
  HugeCodeRunSummary,
} from "@ku0/code-runtime-host-contract";

import { resolveMissionContinuationActionability } from "./runtime-control-plane/runtimeMissionControlContinuation";
import { resolveMissionReviewContinuationData } from "./runtime-control-plane/runtimeMissionControlContinuationSummary";

describe("runtimeMissionControlContinuationSummary", () => {
  it("prefers review-pack continuation truth over stale run-level fragments", () => {
    const run = {
      id: "run-1",
      taskId: "task-1",
      workspaceId: "workspace-1",
      state: "review_ready" as const,
      title: "Run 1",
      summary: "Run summary",
      startedAt: 1,
      finishedAt: 2,
      updatedAt: 2,
      currentStepIndex: 0,
      reviewPackId: "review-pack:run-1",
      checkpoint: null,
      continuation: null,
      missionLinkage: {
        workspaceId: "workspace-1",
        taskId: "task-1",
        runId: "run-1",
        reviewPackId: "review-pack:run-1",
        checkpointId: null,
        traceId: null,
        threadId: "thread-1",
        requestId: null,
        missionTaskId: "task-1",
        taskEntityKind: "thread" as const,
        recoveryPath: "thread" as const,
        navigationTarget: {
          kind: "thread" as const,
          workspaceId: "workspace-1",
          threadId: "thread-1",
        },
        summary: "Run mission linkage.",
      },
      actionability: {
        state: "blocked" as const,
        summary: "Run actionability should not win.",
        degradedReasons: [],
        actions: [],
      },
      publishHandoff: null,
      takeoverBundle: null,
      nextAction: null,
      nextOperatorAction: null,
    } as HugeCodeRunSummary;

    const reviewPack = {
      id: "review-pack:run-1",
      taskId: "task-1",
      workspaceId: "workspace-1",
      runId: "run-1",
      summary: "Review summary",
      createdAt: 2,
      reviewStatus: "action_required" as const,
      warnings: [],
      validations: [],
      artifacts: [],
      warningCount: 0,
      validationOutcome: null,
      evidenceState: "complete" as const,
      fileChanges: [],
      assumptions: [],
      evidenceRefs: [],
      checkpoint: null,
      continuation: null,
      missionLinkage: run.missionLinkage,
      actionability: {
        state: "ready" as const,
        summary: "Review pack published canonical follow-up.",
        degradedReasons: [],
        actions: [],
      },
      publishHandoff: null,
      takeoverBundle: {
        state: "ready" as const,
        pathKind: "review" as const,
        primaryAction: "open_review_pack" as const,
        summary: "Review pack takeover bundle wins.",
        recommendedAction: "Open Review Pack from the canonical takeover bundle.",
        reviewPackId: "review-pack:run-1",
      },
      nextOperatorAction: null,
      reviewDecision: null,
      recommendedNextAction: "Legacy review-pack next action should not win.",
    } as unknown as HugeCodeReviewPackSummary;

    const { continuation, canonicalContinuation } = resolveMissionReviewContinuationData({
      reviewPack,
      run,
    });

    expect(continuation).toMatchObject({
      pathKind: "review",
      truthSource: "takeover_bundle",
      summary: "Review pack takeover bundle wins.",
      recommendedAction: "Open Review Pack from the canonical takeover bundle.",
    });
    expect(canonicalContinuation).toMatchObject({
      truthSource: "takeover_bundle",
    });
  });

  it("returns missing continuation when neither run nor review pack published canonical truth", () => {
    const summary = resolveMissionContinuationActionability({
      reviewPack: null,
      run: {
        id: "run-2",
        taskId: "task-2",
        workspaceId: "workspace-1",
        state: "running",
        title: "Run 2",
        summary: "Run 2 summary",
        startedAt: 1,
        finishedAt: null,
        updatedAt: 1,
        currentStepIndex: 0,
        reviewPackId: null,
        checkpoint: null,
        continuation: null,
        missionLinkage: null,
        actionability: null,
        publishHandoff: null,
        takeoverBundle: null,
        nextAction: null,
        nextOperatorAction: null,
      } as HugeCodeRunSummary,
    });

    expect(summary.state).toBe("missing");
    expect(summary.truthSourceLabel).toBe("Runtime truth unavailable");
  });
});
