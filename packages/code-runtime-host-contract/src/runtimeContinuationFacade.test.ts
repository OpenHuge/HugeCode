import { describe, expect, it } from "vitest";
import {
  buildRuntimeContinuationAggregate,
  buildRuntimeContinuationDescriptor,
  buildRuntimeContinuationReadinessSummary,
} from "./runtimeContinuationFacade";

describe("runtimeContinuationFacade", () => {
  it("gives takeover bundle precedence over fragmented review truth and fallback next action", () => {
    const descriptor = buildRuntimeContinuationDescriptor({
      runState: "review_ready",
      actionability: {
        state: "blocked",
        summary: "Top-level review actionability is stale.",
        degradedReasons: ["runtime_evidence_incomplete"],
        actions: [],
      },
      missionLinkage: {
        workspaceId: "workspace-1",
        taskId: "task-1",
        runId: "run-1",
        reviewPackId: "review-pack:1",
        missionTaskId: "task-1",
        taskEntityKind: "thread",
        recoveryPath: "thread",
        navigationTarget: {
          kind: "thread",
          workspaceId: "workspace-1",
          threadId: "thread-1",
        },
        summary: "Legacy thread continuation",
      },
      nextAction: {
        label: "Inspect stale runtime action",
        action: "review",
        detail: "This fallback next action must not win.",
      },
      takeoverBundle: {
        state: "ready",
        pathKind: "review",
        primaryAction: "open_review_pack",
        summary: "Takeover bundle published the canonical review continuation.",
        recommendedAction: "Open Review Pack from the takeover bundle.",
        reviewPackId: "review-pack:1",
        reviewActionability: {
          state: "ready",
          summary: "Takeover bundle says review can continue now.",
          degradedReasons: [],
          actions: [],
        },
        target: {
          kind: "review_pack",
          workspaceId: "workspace-1",
          taskId: "task-1",
          runId: "run-1",
          reviewPackId: "review-pack:1",
        },
      },
    });

    expect(descriptor).toMatchObject({
      state: "ready",
      pathKind: "review",
      summary: "Takeover bundle says review can continue now.",
      recommendedAction: "Open Review Pack from the takeover bundle.",
      truthSource: "takeover_bundle",
      continuePathLabel: "Review Pack",
      canonicalNextAction: {
        kind: "review",
        label: "Open review",
        detail: "Open Review Pack from the takeover bundle.",
      },
    });
  });

  it("keeps resumable, handoff, blocked, and review-ready runs distinct in the aggregate", () => {
    const aggregate = buildRuntimeContinuationAggregate({
      candidates: [
        {
          runId: "run-resume",
          taskId: "task-resume",
          runState: "paused",
          checkpoint: {
            state: "paused",
            lifecycleState: "paused",
            checkpointId: "checkpoint-1",
            traceId: "trace-1",
            recovered: true,
            updatedAt: 1,
            resumeReady: true,
            recoveredAt: 1,
            summary: "Resume ready from checkpoint-1.",
          },
        },
        {
          runId: "run-review",
          taskId: "task-review",
          runState: "review_ready",
          actionability: {
            state: "ready",
            summary: "Review follow-up is ready.",
            degradedReasons: [],
            actions: [],
          },
          reviewPackId: "review-pack:2",
        },
        {
          runId: "run-handoff",
          taskId: "task-handoff",
          runState: "running",
          missionLinkage: {
            workspaceId: "workspace-1",
            taskId: "task-handoff",
            runId: "run-handoff",
            missionTaskId: "task-handoff",
            taskEntityKind: "thread",
            recoveryPath: "thread",
            navigationTarget: {
              kind: "thread",
              workspaceId: "workspace-1",
              threadId: "thread-handoff",
            },
            summary: "Continue from thread-handoff.",
          },
        },
        {
          runId: "run-blocked",
          taskId: "task-blocked",
          runState: "paused",
          checkpoint: {
            state: "paused",
            lifecycleState: "paused",
            checkpointId: "checkpoint-2",
            traceId: "trace-2",
            recovered: true,
            updatedAt: 2,
            resumeReady: false,
            recoveredAt: 2,
            summary: "Recoverable run is missing a canonical continue path.",
          },
        },
      ],
    });

    expect(aggregate).toMatchObject({
      state: "blocked",
      recoverableRunCount: 1,
      handoffReadyCount: 1,
      reviewReadyCount: 1,
      reviewBlockedCount: 0,
      missingPathCount: 1,
      attentionCount: 1,
      blockedCount: 1,
      blockingReason: "Recoverable run is missing a canonical continue path.",
    });
    expect(aggregate.items.map((item) => [item.runId, item.canonicalNextAction.kind])).toEqual(
      expect.arrayContaining([
        ["run-resume", "resume"],
        ["run-review", "review"],
        ["run-handoff", "continue"],
        ["run-blocked", "blocked"],
      ])
    );
  });

  it("builds a shared continuity readiness summary from runtime continuation truth", () => {
    const summary = buildRuntimeContinuationReadinessSummary({
      candidates: [
        {
          runId: "run-resume",
          taskId: "task-resume",
          runState: "paused",
          checkpoint: {
            state: "paused",
            lifecycleState: "paused",
            checkpointId: "checkpoint-1",
            traceId: "trace-1",
            recovered: true,
            updatedAt: 1,
            resumeReady: true,
            recoveredAt: 1,
            summary: "Resume ready from checkpoint-1.",
          },
        },
        {
          runId: "run-review-blocked",
          taskId: "task-review-blocked",
          runState: "review_ready",
          actionability: {
            state: "blocked",
            summary: "Review follow-up is blocked.",
            degradedReasons: [],
            actions: [],
          },
          reviewPackId: "review-pack:2",
        },
        {
          runId: "run-handoff",
          taskId: "task-handoff",
          runState: "running",
          missionLinkage: {
            workspaceId: "workspace-1",
            taskId: "task-handoff",
            runId: "run-handoff",
            missionTaskId: "task-handoff",
            taskEntityKind: "thread",
            recoveryPath: "thread",
            navigationTarget: {
              kind: "thread",
              workspaceId: "workspace-1",
              threadId: "thread-handoff",
            },
            summary: "Continue from thread-handoff.",
          },
        },
      ],
      durabilityDegraded: true,
    });

    expect(summary).toMatchObject({
      state: "blocked",
      headline: "Continuity readiness blocked",
      recoverableRunCount: 1,
      handoffReadyCount: 1,
      reviewReadyCount: 0,
      reviewBlockedCount: 1,
      durabilityDegraded: true,
      blockingReason: "Review follow-up is blocked.",
    });
    expect(summary.detail).toContain("1 run can safely continue");
    expect(summary.detail).toContain("1 handoff path ready");
    expect(summary.detail).toContain("1 review follow-up blocked");
    expect(summary.detail).toContain("Checkpoint durability warning published");
    expect(summary.recommendedAction).toBe(
      "Open Review Pack and resolve the runtime-blocked follow-up before continuing."
    );
  });

  it("keeps continuity readiness at attention when no canonical runtime truth is published yet", () => {
    const summary = buildRuntimeContinuationReadinessSummary({
      candidates: [
        {
          runId: "run-1",
          taskId: "task-1",
          runState: "running",
          reviewPackId: "review-pack:1",
        },
      ],
    });

    expect(summary).toMatchObject({
      state: "attention",
      headline: "Continuity readiness needs attention",
      blockingReason: null,
      recoverableRunCount: 0,
      handoffReadyCount: 0,
      reviewReadyCount: 0,
      reviewBlockedCount: 0,
    });
    expect(summary.detail).toBe(
      "No runtime-published checkpoint, handoff, or review follow-up truth is available yet."
    );
  });

  it("marks takeover review follow-up as blocked when review actionability is blocked", () => {
    const descriptor = buildRuntimeContinuationDescriptor({
      runState: "review_ready",
      takeoverBundle: {
        state: "ready",
        pathKind: "review",
        primaryAction: "open_review_pack",
        summary: "Takeover bundle published the canonical review continuation.",
        recommendedAction: "Open Review Pack from the takeover bundle.",
        reviewPackId: "review-pack:1",
        reviewActionability: {
          state: "blocked",
          summary: "Follow-up is blocked on fresh review evidence.",
          degradedReasons: [],
          actions: [],
        },
        target: {
          kind: "review_pack",
          workspaceId: "workspace-1",
          taskId: "task-1",
          runId: "run-1",
          reviewPackId: "review-pack:1",
        },
      },
    });

    expect(descriptor.state).toBe("blocked");
    expect(descriptor.canonicalNextAction.kind).toBe("blocked");
    expect(descriptor.canonicalNextAction.blockedReason).toBe(
      "Follow-up is blocked on fresh review evidence."
    );
  });

  it("uses runtime-published continuation truth when no fragmented continuation fields are present", () => {
    const descriptor = buildRuntimeContinuationDescriptor({
      runState: "review_ready",
      continuation: {
        state: "ready",
        pathKind: "review",
        source: "mission_linkage",
        summary: "Runtime published canonical review continuation.",
        detail: "Open the canonical review pack continuation.",
        recommendedAction: "Open Review Pack from runtime continuation.",
        target: {
          kind: "review_pack",
          workspaceId: "workspace-1",
          taskId: "task-1",
          runId: "run-1",
          reviewPackId: "review-pack:1",
          checkpointId: null,
          traceId: null,
        },
        reviewPackId: "review-pack:1",
        reviewActionability: {
          state: "ready",
          summary: "Review follow-up is ready from runtime continuation.",
          degradedReasons: [],
          actions: [],
        },
        sessionBoundary: {
          workspaceId: "workspace-1",
          taskId: "task-1",
          runId: "run-1",
          missionTaskId: "task-1",
          sessionKind: "run",
          threadId: null,
          requestId: null,
          reviewPackId: "review-pack:1",
          checkpointId: null,
          traceId: null,
          navigationTarget: {
            kind: "review_pack",
            workspaceId: "workspace-1",
            taskId: "task-1",
            runId: "run-1",
            reviewPackId: "review-pack:1",
            checkpointId: null,
            traceId: null,
          },
        },
      },
      reviewPackId: "review-pack:1",
    });

    expect(descriptor).toMatchObject({
      state: "ready",
      pathKind: "review",
      summary: "Runtime published canonical review continuation.",
      recommendedAction: "Open Review Pack from runtime continuation.",
      truthSource: "mission_linkage",
      continuePathLabel: "Review Pack",
      canonicalNextAction: {
        kind: "review",
        label: "Open review",
        detail: "Open Review Pack from runtime continuation.",
      },
    });
  });
});
