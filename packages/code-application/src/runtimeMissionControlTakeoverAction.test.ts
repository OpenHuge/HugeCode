import { describe, expect, it } from "vitest";
import { resolveMissionTakeoverOperatorAction } from "./runtime-control-plane/runtimeMissionControlTakeoverAction";

describe("runtimeMissionControlTakeoverAction", () => {
  it("routes review handoffs to the review target when runtime points back at mission context", () => {
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

    const action = resolveMissionTakeoverOperatorAction({
      task: {
        workspaceId: "workspace-1",
        id: "task-1",
        origin: {
          threadId: "thread-1",
        },
      } as never,
      takeoverBundle: {
        state: "ready",
        pathKind: "review",
        primaryAction: "open_review",
        summary: "Review is ready on another device.",
        recommendedAction: "Open the runtime review handoff.",
        target: {
          kind: "thread",
          workspaceId: "workspace-1",
          threadId: "thread-1",
        },
      } as never,
      missionTarget,
      reviewTarget,
    });

    expect(action).toEqual({
      label: "Open review",
      detail: "Open the runtime review handoff.",
      target: reviewTarget,
    });
  });

  it("preserves explicit cross-thread handoff targets for non-review paths", () => {
    const missionTarget = {
      kind: "mission",
      workspaceId: "workspace-1",
      taskId: "task-1",
      runId: "run-1",
      reviewPackId: "review-pack-1",
      threadId: "thread-1",
      limitation: null,
    } as const;

    const action = resolveMissionTakeoverOperatorAction({
      task: {
        workspaceId: "workspace-1",
        id: "task-1",
        origin: {
          threadId: "thread-1",
        },
      } as never,
      takeoverBundle: {
        state: "ready",
        pathKind: "handoff",
        primaryAction: "open_handoff",
        summary: "Continue in the delegated thread.",
        recommendedAction: "Open the delegated thread handoff target.",
        target: {
          kind: "thread",
          workspaceId: "workspace-1",
          threadId: "thread-handoff",
        },
      } as never,
      missionTarget,
      reviewTarget: {
        kind: "review",
        workspaceId: "workspace-1",
        taskId: "task-1",
        runId: "run-1",
        reviewPackId: "review-pack-1",
        limitation: null,
      },
    });

    expect(action).toEqual({
      label: "Open handoff",
      detail: "Open the delegated thread handoff target.",
      target: {
        kind: "thread",
        workspaceId: "workspace-1",
        threadId: "thread-handoff",
      },
    });
  });
});
