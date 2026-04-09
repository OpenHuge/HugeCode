import { describe, expect, it } from "vitest";
import { resolveMissionOperatorAction } from "./runtime-control-plane/runtimeMissionControlOperatorAction";

describe("runtimeMissionControlOperatorAction", () => {
  it("keeps mission context when canonical continuation points at the mission thread", () => {
    const missionTarget = {
      kind: "mission",
      workspaceId: "workspace-1",
      taskId: "task-1",
      runId: "run-1",
      reviewPackId: "review-pack-1",
      threadId: "thread-1",
      limitation: null,
    } as const;
    const reviewTarget = {
      kind: "review",
      workspaceId: "workspace-1",
      taskId: "task-1",
      runId: "run-1",
      reviewPackId: "review-pack-1",
      limitation: null,
    } as const;

    const action = resolveMissionOperatorAction({
      task: {
        workspaceId: "workspace-1",
        id: "task-1",
        origin: {
          threadId: "thread-1",
        },
      } as never,
      reviewPack: {
        id: "review-pack-1",
        reviewStatus: "ready",
        reviewDecision: null,
        recommendedNextAction: "Legacy follow-up",
        governance: null,
        checkpoint: null,
        missionLinkage: null,
        actionability: null,
        publishHandoff: null,
        takeoverBundle: null,
        continuation: null,
      } as never,
      run: {
        id: "run-1",
        reviewPackId: "review-pack-1",
        takeoverBundle: {
          state: "ready",
          pathKind: "handoff",
          primaryAction: "open_handoff",
          summary: "Continue from the mission thread on another control device.",
          recommendedAction: "Open the handoff target on the mission thread.",
          target: {
            kind: "thread",
            workspaceId: "workspace-1",
            threadId: "thread-1",
          },
        },
      } as never,
      missionTarget,
      reviewTarget,
      defaultActiveLabel: "Monitor mission",
    });

    expect(action.label).toBe("Open handoff");
    expect(action.detail).toBe("Continue from the mission thread on another control device.");
    expect(action.target).toEqual(reviewTarget);
  });

  it("keeps cross-thread handoff targets when runtime points at a different thread", () => {
    const missionTarget = {
      kind: "mission",
      workspaceId: "workspace-1",
      taskId: "task-1",
      runId: "run-1",
      reviewPackId: "review-pack-1",
      threadId: "thread-1",
      limitation: null,
    } as const;
    const reviewTarget = {
      kind: "review",
      workspaceId: "workspace-1",
      taskId: "task-1",
      runId: "run-1",
      reviewPackId: "review-pack-1",
      limitation: null,
    } as const;

    const action = resolveMissionOperatorAction({
      task: {
        workspaceId: "workspace-1",
        id: "task-1",
        origin: {
          threadId: "thread-1",
        },
      } as never,
      reviewPack: {
        id: "review-pack-1",
        reviewStatus: "ready",
        reviewDecision: null,
        recommendedNextAction: "Legacy follow-up",
        governance: null,
        checkpoint: null,
        missionLinkage: null,
        actionability: null,
        publishHandoff: null,
        takeoverBundle: null,
        continuation: null,
      } as never,
      run: {
        id: "run-1",
        reviewPackId: "review-pack-1",
        takeoverBundle: {
          state: "ready",
          pathKind: "handoff",
          primaryAction: "open_handoff",
          summary: "Continue in the delegated thread on another control device.",
          recommendedAction: "Open the delegated thread handoff target.",
          target: {
            kind: "thread",
            workspaceId: "workspace-1",
            threadId: "thread-handoff",
          },
        },
      } as never,
      missionTarget,
      reviewTarget,
      defaultActiveLabel: "Monitor mission",
    });

    expect(action.label).toBe("Open handoff");
    expect(action.detail).toBe("Continue in the delegated thread on another control device.");
    expect(action.target).toEqual(reviewTarget);
  });

  it("routes non-review canonical review-pack actions back to the mission target", () => {
    const missionTarget = {
      kind: "thread",
      workspaceId: "workspace-1",
      threadId: "thread-1",
    } as const;
    const reviewTarget = {
      kind: "review",
      workspaceId: "workspace-1",
      taskId: "task-1",
      runId: "run-1",
      reviewPackId: "review-pack-1",
      limitation: null,
    } as const;

    const action = resolveMissionOperatorAction({
      task: {
        origin: {
          threadId: "thread-1",
        },
      } as never,
      reviewPack: {
        id: "review-pack-1",
        reviewStatus: "ready",
        reviewDecision: null,
        recommendedNextAction: "Resume mission",
        governance: null,
        checkpoint: null,
        missionLinkage: null,
        actionability: null,
        publishHandoff: null,
        takeoverBundle: {
          state: "ready",
          pathKind: "resume",
          primaryAction: "resume",
          summary: "Resume from checkpoint-1.",
          recommendedAction: "Resume mission",
          target: null,
        },
        continuation: null,
      } as never,
      run: null,
      missionTarget,
      reviewTarget,
      defaultActiveLabel: "Monitor mission",
    });

    expect(action.label).toBe("Resume mission");
    expect(action.target).toEqual(missionTarget);
  });

  it("preserves runtime-published review continuation targets in continuation-only flows", () => {
    const missionTarget = {
      kind: "mission",
      workspaceId: "workspace-1",
      taskId: "task-1",
      runId: "run-1",
      reviewPackId: "review-pack-1",
      threadId: "thread-1",
      limitation: null,
    } as const;
    const reviewTarget = {
      kind: "review",
      workspaceId: "workspace-1",
      taskId: "task-1",
      runId: "run-1",
      reviewPackId: "review-pack-1",
      limitation: null,
    } as const;

    const action = resolveMissionOperatorAction({
      task: {
        workspaceId: "workspace-1",
        id: "task-1",
        origin: {
          threadId: "thread-1",
        },
      } as never,
      reviewPack: null,
      run: {
        id: "run-1",
        reviewPackId: "review-pack-1",
        state: "review_ready",
        takeoverBundle: {
          state: "ready",
          pathKind: "review",
          summary: "Review continuation should start from the delegated thread.",
          primaryAction: "open_review_pack",
          recommendedAction: "Open review from the delegated thread first.",
          target: {
            kind: "thread",
            workspaceId: "workspace-1",
            threadId: "thread-review-handoff",
          },
        },
      } as never,
      missionTarget,
      reviewTarget,
      defaultActiveLabel: "Monitor mission",
    });

    expect(action.label).toBe("Open review");
    expect(action.detail).toBe("Review continuation should start from the delegated thread.");
    expect(action.target).toEqual({
      kind: "review",
      workspaceId: "workspace-1",
      taskId: "task-1",
      runId: "run-1",
      reviewPackId: "review-pack-1",
      limitation: null,
    });
  });

  it("does not let legacy nextAction detail override canonical review continuation detail", () => {
    const missionTarget = {
      kind: "mission",
      workspaceId: "workspace-1",
      taskId: "task-1",
      runId: "run-1",
      reviewPackId: "review-pack-1",
      threadId: "thread-1",
      limitation: null,
    } as const;
    const reviewTarget = {
      kind: "review",
      workspaceId: "workspace-1",
      taskId: "task-1",
      runId: "run-1",
      reviewPackId: "review-pack-1",
      limitation: null,
    } as const;

    const action = resolveMissionOperatorAction({
      task: {
        workspaceId: "workspace-1",
        id: "task-1",
        origin: {
          threadId: "thread-1",
        },
      } as never,
      reviewPack: {
        id: "review-pack-1",
        workspaceId: "workspace-1",
        taskId: "task-1",
        runId: "run-1",
        reviewStatus: "action_required",
        reviewDecision: null,
        recommendedNextAction: "Legacy review follow-up",
        governance: null,
        checkpoint: null,
        missionLinkage: null,
        actionability: null,
        publishHandoff: null,
        takeoverBundle: null,
        continuation: {
          state: "ready",
          pathKind: "review",
          source: "review_actionability",
          summary: "Canonical review follow-up is ready.",
          detail: "Open the canonical review path before continuing.",
          recommendedAction: "Use the canonical review continuation.",
          target: {
            kind: "review_pack",
            workspaceId: "workspace-1",
            taskId: "task-1",
            runId: "run-1",
            reviewPackId: "review-pack-1",
            checkpointId: null,
            traceId: null,
          },
          reviewPackId: "review-pack-1",
          reviewActionability: null,
          sessionBoundary: {
            workspaceId: "workspace-1",
            taskId: "task-1",
            runId: "run-1",
            missionTaskId: "task-1",
            sessionKind: "run",
            threadId: null,
            requestId: null,
            reviewPackId: "review-pack-1",
            checkpointId: null,
            traceId: null,
            navigationTarget: {
              kind: "run",
              workspaceId: "workspace-1",
              taskId: "task-1",
              runId: "run-1",
              reviewPackId: "review-pack-1",
              checkpointId: null,
              traceId: null,
            },
          },
        },
      } as never,
      run: {
        id: "run-1",
        taskId: "task-1",
        workspaceId: "workspace-1",
        reviewPackId: "review-pack-1",
        state: "review_ready",
        nextAction: {
          label: "Legacy next action",
          action: "review",
          detail: "Legacy next action detail",
        },
      } as never,
      missionTarget,
      reviewTarget,
      defaultActiveLabel: "Monitor mission",
    });

    expect(action.label).toBe("Open review");
    expect(action.detail).toBe("Open the canonical review path before continuing.");
    expect(action.target).toEqual(reviewTarget);
  });
});
