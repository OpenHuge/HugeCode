import { describe, expect, it } from "vitest";
import { resolveMissionOperatorAction } from "./runtimeMissionControlOperatorAction";

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

    expect(action.label).toBe("Continue in mission thread");
    expect(action.detail).toBe("Open the handoff target on the mission thread.");
    expect(action.target).toEqual(missionTarget);
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

    expect(action.label).toBe("Continue in mission thread");
    expect(action.detail).toBe("Open the delegated thread handoff target.");
    expect(action.target).toEqual({
      kind: "thread",
      workspaceId: "workspace-1",
      threadId: "thread-handoff",
    });
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
      } as never,
      run: null,
      missionTarget,
      reviewTarget,
      defaultActiveLabel: "Monitor mission",
    });

    expect(action.label).toBe("Resume mission");
    expect(action.target).toEqual(missionTarget);
  });
});
