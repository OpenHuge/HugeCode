import { describe, expect, it } from "vitest";
import { resolveMissionOperatorAction } from "./runtimeMissionControlOperatorAction";

describe("runtimeMissionControlOperatorAction", () => {
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
