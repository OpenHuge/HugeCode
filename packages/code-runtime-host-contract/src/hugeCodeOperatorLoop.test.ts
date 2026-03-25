import { describe, expect, it } from "vitest";
import {
  getHugeCodeReviewActionAvailability,
  resolveHugeCodeOperatorAction,
  summarizeHugeCodeOperatorContinuation,
} from "./hugeCodeOperatorLoop";

describe("hugeCodeOperatorLoop", () => {
  it("prefers takeover bundle review truth over stale standalone actionability", () => {
    const continuation = summarizeHugeCodeOperatorContinuation({
      runState: "review_ready",
      takeoverBundle: {
        state: "ready",
        pathKind: "review",
        primaryAction: "open_review_pack",
        summary: "Open Review Pack from takeover.",
        recommendedAction: "Open Review Pack and continue from runtime takeover.",
        reviewPackId: "review-pack:run-1",
        target: {
          kind: "review_pack",
          workspaceId: "workspace-1",
          taskId: "task-1",
          runId: "run-1",
          reviewPackId: "review-pack:run-1",
        },
        reviewActionability: {
          state: "ready",
          summary: "Follow-up is ready from takeover truth.",
          degradedReasons: [],
          actions: [
            {
              action: "accept_result",
              enabled: true,
              supported: true,
              reason: null,
            },
          ],
        },
      },
      reviewActionability: {
        state: "blocked",
        summary: "Stale blocked actionability should not win.",
        degradedReasons: ["stale"],
        actions: [],
      },
    });

    expect(continuation).toMatchObject({
      state: "ready",
      pathKind: "review",
      summary: "Follow-up is ready from takeover truth.",
      recommendedAction: "Open Review Pack and continue from runtime takeover.",
      truthSource: "takeover_bundle",
      continuePathLabel: "Review Pack",
      targetKind: "review_pack",
    });
  });

  it("keeps takeover bundle as the continuation source even when standalone actionability is stale", () => {
    const continuation = summarizeHugeCodeOperatorContinuation({
      runState: "review_ready",
      takeoverBundle: {
        state: "ready",
        pathKind: "review",
        primaryAction: "open_review_pack",
        summary: "Review pack is ready from takeover.",
        recommendedAction: "Open the review pack from takeover truth.",
        reviewPackId: "review-pack:run-1",
        target: {
          kind: "review_pack",
          workspaceId: "workspace-1",
          taskId: "task-1",
          runId: "run-1",
          reviewPackId: "review-pack:run-1",
        },
      },
      reviewActionability: {
        state: "blocked",
        summary: "Stale blocked actionability should not replace takeover truth.",
        degradedReasons: ["stale"],
        actions: [],
      },
    });

    expect(continuation).toMatchObject({
      state: "ready",
      pathKind: "review",
      summary: "Review pack is ready from takeover.",
      recommendedAction: "Open the review pack from takeover truth.",
      truthSource: "takeover_bundle",
      continuePathLabel: "Review Pack",
      targetKind: "review_pack",
    });
  });

  it("derives a resumable operator action from takeover-first truth", () => {
    const action = resolveHugeCodeOperatorAction({
      runState: "interrupted",
      checkpoint: {
        state: "persisted",
        lifecycleState: "persisted",
        checkpointId: "checkpoint-old",
        traceId: "trace-old",
        recovered: false,
        updatedAt: 1,
        resumeReady: false,
        summary: "Old checkpoint should not win.",
      },
      takeoverBundle: {
        state: "ready",
        pathKind: "resume",
        primaryAction: "resume_run",
        summary: "Resume from takeover bundle.",
        recommendedAction: "Resume this run from the runtime takeover bundle.",
        checkpointId: "checkpoint-new",
        traceId: "trace-new",
        target: {
          kind: "run",
          workspaceId: "workspace-1",
          taskId: "task-1",
          runId: "run-1",
          checkpointId: "checkpoint-new",
          traceId: "trace-new",
        },
      },
    });

    expect(action).toMatchObject({
      actionId: "resume_run",
      label: "Resume run",
      detail: "Resume from takeover bundle.",
      recommendedAction: "Resume this run from the runtime takeover bundle.",
      targetKind: "run",
      truthSource: "takeover_bundle",
    });
  });

  it("routes blocked review follow-up to the canonical mission target", () => {
    const action = resolveHugeCodeOperatorAction({
      runState: "review_ready",
      reviewStatus: "action_required",
      missionLinkage: {
        workspaceId: "workspace-1",
        taskId: "task-1",
        runId: "run-1",
        reviewPackId: "review-pack:run-1",
        missionTaskId: "runtime-task:task-1",
        taskEntityKind: "run",
        recoveryPath: "run",
        navigationTarget: {
          kind: "run",
          workspaceId: "workspace-1",
          taskId: "task-1",
          runId: "run-1",
          reviewPackId: "review-pack:run-1",
        },
        summary: "Continue from mission detail.",
      },
      reviewActionability: {
        state: "blocked",
        summary: "Runtime blocked follow-up until validation evidence is repaired.",
        degradedReasons: ["validation_outcome_unknown"],
        actions: [
          {
            action: "accept_result",
            enabled: false,
            supported: true,
            reason: "Validation evidence is incomplete.",
          },
          {
            action: "retry",
            enabled: true,
            supported: true,
            reason: null,
          },
        ],
      },
    });

    expect(action).toMatchObject({
      actionId: "continue_follow_up",
      label: "Open action center",
      detail: "Runtime blocked follow-up until validation evidence is repaired.",
      targetKind: "run",
      truthSource: "review_actionability",
      continuationState: "blocked",
    });
  });

  it("makes approval the next operator action when runtime is waiting on a decision", () => {
    const action = resolveHugeCodeOperatorAction({
      runState: "needs_input",
      approvalStatus: "pending_decision",
      approvalSummary: "Runtime is waiting for approval before the run can continue.",
      missionLinkage: {
        workspaceId: "workspace-1",
        taskId: "task-1",
        runId: "run-1",
        reviewPackId: null,
        missionTaskId: "runtime-task:task-1",
        taskEntityKind: "run",
        recoveryPath: "run",
        navigationTarget: {
          kind: "run",
          workspaceId: "workspace-1",
          taskId: "task-1",
          runId: "run-1",
        },
        summary: "Approval is waiting in mission detail.",
      },
    });

    expect(action).toMatchObject({
      actionId: "open_approval",
      label: "Open approval",
      detail: "Runtime is waiting for approval before the run can continue.",
      targetKind: "run",
    });
  });

  it("keeps one controlled legacy fallback for follow-up availability when actionability actions are absent", () => {
    const availability = getHugeCodeReviewActionAvailability({
      reviewActionability: {
        state: "degraded",
        summary: "Runtime published summary but not action entries yet.",
        degradedReasons: ["legacy_bridge"],
        actions: [],
      },
      legacyFallbackActions: [
        {
          action: "retry",
          enabled: true,
          supported: true,
          reason: null,
        },
      ],
      actionIds: ["retry"],
    });

    expect(availability?.action).toBe("retry");
    expect(availability?.enabled).toBe(true);
    expect(availability?.supported).toBe(true);
  });
});
