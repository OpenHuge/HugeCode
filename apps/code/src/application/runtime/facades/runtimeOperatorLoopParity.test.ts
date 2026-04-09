import type { HugeCodeMissionControlSnapshot } from "@ku0/code-runtime-host-contract";
import { describe, expect, it } from "vitest";
import {
  buildLatestMissionRunsFromProjection,
  buildMissionReviewEntriesFromProjection,
} from "@ku0/code-application/runtimeMissionControlSurfaceModel";
import {
  buildReviewPackDetailModel,
  resolveReviewPackSelection,
} from "@ku0/code-application/runtimeReviewPackSurfaceModel";

function asProjection(value: unknown): HugeCodeMissionControlSnapshot {
  return value as HugeCodeMissionControlSnapshot;
}

describe("runtimeOperatorLoopParity", () => {
  it("keeps Mission Control and Review Pack aligned for blocked follow-up on the same run", () => {
    const projection = asProjection({
      source: "runtime_snapshot_v1" as const,
      generatedAt: 100,
      workspaces: [
        {
          id: "workspace-1",
          name: "Workspace One",
          rootPath: "/tmp/workspace-one",
          connected: true,
          defaultProfileId: null,
        },
      ],
      tasks: [
        {
          id: "runtime-task:run-9",
          workspaceId: "workspace-1",
          title: "Recover a blocked follow-up",
          objective: "Recover a blocked follow-up",
          origin: {
            kind: "thread" as const,
            threadId: "thread-legacy",
            runId: "run-9",
            requestId: null,
          },
          mode: "delegate" as const,
          modeSource: "execution_profile" as const,
          status: "review_ready" as const,
          createdAt: 1,
          updatedAt: 100,
          currentRunId: null,
          latestRunId: "run-9",
          latestRunState: "review_ready" as const,
          nextAction: null,
        },
      ],
      runs: [
        {
          id: "run-9",
          taskId: "runtime-task:run-9",
          workspaceId: "workspace-1",
          state: "review_ready" as const,
          title: "Recover a blocked follow-up",
          summary: "Review pack ready.",
          startedAt: 2,
          finishedAt: 90,
          updatedAt: 100,
          currentStepIndex: 0,
          warnings: [],
          validations: [],
          artifacts: [],
          reviewPackId: "review-pack:run-9",
          missionLinkage: {
            workspaceId: "workspace-1",
            taskId: "runtime-task:run-9",
            runId: "run-9",
            reviewPackId: "review-pack:run-9",
            missionTaskId: "runtime-task:run-9",
            taskEntityKind: "run" as const,
            recoveryPath: "run" as const,
            navigationTarget: {
              kind: "run" as const,
              workspaceId: "workspace-1",
              taskId: "runtime-task:run-9",
              runId: "run-9",
              reviewPackId: "review-pack:run-9",
            },
            summary: "Resume from the runtime-published mission detail.",
          },
          actionability: {
            state: "blocked" as const,
            summary: "Runtime blocked follow-up until validation evidence is repaired.",
            degradedReasons: ["Validation evidence is missing."],
            actions: [],
          },
          publishHandoff: {
            summary: "Publish handoff is ready for another control device.",
          },
        },
      ],
      reviewPacks: [
        {
          id: "review-pack:run-9",
          runId: "run-9",
          taskId: "runtime-task:run-9",
          workspaceId: "workspace-1",
          summary: "Review pack ready.",
          reviewStatus: "ready" as const,
          evidenceState: "confirmed" as const,
          validationOutcome: "passed" as const,
          warningCount: 0,
          warnings: [],
          validations: [],
          artifacts: [],
          checksPerformed: [],
          recommendedNextAction: "Local fallback next action.",
          createdAt: 100,
        },
      ],
    });

    const [reviewEntry] = buildMissionReviewEntriesFromProjection(projection, {
      workspaceId: "workspace-1",
    });
    const [latestRun] = buildLatestMissionRunsFromProjection(projection, {
      getWorkspaceGroupName: () => null,
      limit: 1,
    });
    const reviewDetail = buildReviewPackDetailModel({
      projection,
      selection: resolveReviewPackSelection({
        projection,
        workspaceId: "workspace-1",
        request: {
          workspaceId: "workspace-1",
          reviewPackId: "review-pack:run-9",
          source: "review_surface",
        },
      }),
    });

    expect(reviewEntry?.recommendedNextAction).toBe(
      "Open Review Pack and resolve the runtime-blocked follow-up before continuing."
    );
    expect(reviewEntry?.operatorActionLabel).toBe("Open review");
    expect(reviewEntry?.operatorActionTarget).toEqual({
      kind: "review",
      workspaceId: "workspace-1",
      taskId: "runtime-task:run-9",
      runId: "run-9",
      reviewPackId: "review-pack:run-9",
      limitation: null,
    });
    expect(latestRun?.operatorActionLabel).toBe(reviewEntry?.operatorActionLabel);
    expect(latestRun?.operatorActionDetail).toBe(reviewEntry?.operatorActionDetail);
    expect(latestRun?.operatorActionTarget).toEqual(reviewEntry?.operatorActionTarget);

    expect(reviewDetail?.kind).toBe("review_pack");
    if (!reviewDetail || reviewDetail.kind !== "review_pack") {
      throw new Error("Expected review pack detail");
    }
    expect(reviewDetail.recommendedNextAction).toBe(reviewEntry?.recommendedNextAction);
    expect(reviewDetail.navigationTarget).toEqual(reviewEntry?.operatorActionTarget);
    expect(reviewDetail.continuity?.recommendedAction).toBe(reviewEntry?.recommendedNextAction);
  });

  it("keeps takeover-first review actions aligned between Mission Control and Review Pack", () => {
    const projection = asProjection({
      source: "runtime_snapshot_v1" as const,
      generatedAt: 10,
      workspaces: [
        {
          id: "workspace-1",
          name: "Workspace One",
          rootPath: "/tmp/workspace-one",
          connected: true,
          defaultProfileId: null,
        },
      ],
      tasks: [
        {
          id: "task-1",
          workspaceId: "workspace-1",
          title: "Review continuation",
          objective: "Review continuation",
          origin: {
            kind: "thread" as const,
            threadId: "thread-1",
            runId: "run-1",
            requestId: null,
          },
          mode: "pair" as const,
          modeSource: "execution_profile" as const,
          status: "review_ready" as const,
          createdAt: 1,
          updatedAt: 10,
          currentRunId: null,
          latestRunId: "run-1",
          latestRunState: "review_ready" as const,
          nextAction: null,
        },
      ],
      runs: [
        {
          id: "run-1",
          taskId: "task-1",
          workspaceId: "workspace-1",
          state: "review_ready" as const,
          title: "Review continuation",
          summary: "Ready for review.",
          startedAt: 2,
          finishedAt: 9,
          updatedAt: 10,
          currentStepIndex: 0,
          warnings: [],
          validations: [],
          artifacts: [],
          reviewPackId: "review-pack:1",
          takeoverBundle: {
            pathKind: "review",
            primaryAction: "open_review_pack",
            state: "ready",
            summary: "Continue from Review Pack.",
            recommendedAction: "Open Review Pack",
            reviewPackId: "review-pack:1",
            target: {
              kind: "review_pack",
              workspaceId: "workspace-1",
              taskId: "task-1",
              runId: "run-1",
              reviewPackId: "review-pack:1",
            },
          },
        },
      ],
      reviewPacks: [
        {
          id: "review-pack:1",
          runId: "run-1",
          taskId: "task-1",
          workspaceId: "workspace-1",
          summary: "Ready for review.",
          reviewStatus: "ready" as const,
          evidenceState: "confirmed" as const,
          validationOutcome: "passed" as const,
          warningCount: 0,
          warnings: [],
          validations: [],
          artifacts: [],
          checksPerformed: [],
          recommendedNextAction: "Legacy follow-up",
          createdAt: 10,
        },
      ],
    });

    const [reviewEntry] = buildMissionReviewEntriesFromProjection(projection, {
      workspaceId: "workspace-1",
    });
    const [latestRun] = buildLatestMissionRunsFromProjection(projection, {
      getWorkspaceGroupName: () => null,
      limit: 1,
    });
    const reviewDetail = buildReviewPackDetailModel({
      projection,
      selection: resolveReviewPackSelection({
        projection,
        workspaceId: "workspace-1",
        request: {
          workspaceId: "workspace-1",
          reviewPackId: "review-pack:1",
          source: "review_surface",
        },
      }),
    });

    expect(reviewEntry?.recommendedNextAction).toBe("Open Review Pack");
    expect(reviewEntry?.operatorActionLabel).toBe("Open review");
    expect(reviewEntry?.operatorActionTarget).toEqual({
      kind: "review",
      workspaceId: "workspace-1",
      taskId: "task-1",
      runId: "run-1",
      reviewPackId: "review-pack:1",
      limitation: null,
    });
    expect(latestRun?.operatorActionLabel).toBe(reviewEntry?.operatorActionLabel);
    expect(latestRun?.operatorActionDetail).toBe(reviewEntry?.operatorActionDetail);
    expect(latestRun?.operatorActionTarget).toEqual(reviewEntry?.operatorActionTarget);

    expect(reviewDetail?.kind).toBe("review_pack");
    if (!reviewDetail || reviewDetail.kind !== "review_pack") {
      throw new Error("Expected review pack detail");
    }
    expect(reviewDetail.recommendedNextAction).toBe(reviewEntry?.recommendedNextAction);
    expect(reviewDetail.continuity?.recommendedAction).toBe(reviewEntry?.recommendedNextAction);
  });

  it("keeps approval CTA label, detail, and target aligned across Mission Control and Review Pack", () => {
    const projection = asProjection({
      source: "runtime_snapshot_v1" as const,
      generatedAt: 20,
      workspaces: [
        {
          id: "workspace-1",
          name: "Workspace One",
          rootPath: "/tmp/workspace-one",
          connected: true,
          defaultProfileId: null,
        },
      ],
      tasks: [
        {
          id: "task-approval",
          workspaceId: "workspace-1",
          title: "Approve runtime handoff",
          objective: "Approve runtime handoff",
          origin: {
            kind: "thread" as const,
            threadId: "thread-approval",
            runId: "run-approval",
            requestId: null,
          },
          mode: "pair" as const,
          modeSource: "execution_profile" as const,
          status: "review_ready" as const,
          createdAt: 1,
          updatedAt: 20,
          currentRunId: null,
          latestRunId: "run-approval",
          latestRunState: "review_ready" as const,
          nextAction: null,
        },
      ],
      runs: [
        {
          id: "run-approval",
          taskId: "task-approval",
          workspaceId: "workspace-1",
          state: "review_ready" as const,
          title: "Approve runtime handoff",
          summary: "Approval is pending before the review can continue.",
          startedAt: 2,
          finishedAt: 19,
          updatedAt: 20,
          currentStepIndex: 0,
          warnings: [],
          validations: [],
          artifacts: [],
          reviewPackId: "review-pack:approval",
          approval: {
            status: "pending_decision" as const,
            approvalId: "approval-1",
            label: "Approval pending",
            summary: "Operator approval is required before the follow-up can proceed.",
          },
          takeoverBundle: {
            pathKind: "approval",
            primaryAction: "approve",
            state: "ready",
            summary: "Operator approval is required before the follow-up can proceed.",
            recommendedAction: "Open the approval decision before continuing this follow-up.",
            target: {
              kind: "run",
              workspaceId: "workspace-1",
              taskId: "task-approval",
              runId: "run-approval",
              reviewPackId: "review-pack:approval",
            },
            reviewPackId: "review-pack:approval",
          },
        },
      ],
      reviewPacks: [
        {
          id: "review-pack:approval",
          runId: "run-approval",
          taskId: "task-approval",
          workspaceId: "workspace-1",
          summary: "Approval is pending before the review can continue.",
          reviewStatus: "ready" as const,
          evidenceState: "confirmed" as const,
          validationOutcome: "passed" as const,
          warningCount: 0,
          warnings: [],
          validations: [],
          artifacts: [],
          checksPerformed: [],
          recommendedNextAction: "Legacy review text.",
          createdAt: 20,
        },
      ],
    });

    const [reviewEntry] = buildMissionReviewEntriesFromProjection(projection, {
      workspaceId: "workspace-1",
    });
    const [latestRun] = buildLatestMissionRunsFromProjection(projection, {
      getWorkspaceGroupName: () => null,
      limit: 1,
    });
    const reviewDetail = buildReviewPackDetailModel({
      projection,
      selection: resolveReviewPackSelection({
        projection,
        workspaceId: "workspace-1",
        request: {
          workspaceId: "workspace-1",
          reviewPackId: "review-pack:approval",
          source: "review_surface",
        },
      }),
    });

    expect(reviewEntry?.operatorActionLabel).toBe("Open approval");
    expect(reviewEntry?.operatorActionDetail).toBe(
      "Operator approval is required before the follow-up can proceed."
    );
    expect(latestRun?.operatorActionLabel).toBe(reviewEntry?.operatorActionLabel);
    expect(latestRun?.operatorActionDetail).toBe(reviewEntry?.operatorActionDetail);
    expect(latestRun?.operatorActionTarget).toEqual(reviewEntry?.operatorActionTarget);

    expect(reviewDetail?.kind).toBe("review_pack");
    if (!reviewDetail || reviewDetail.kind !== "review_pack") {
      throw new Error("Expected review pack detail");
    }
    expect(reviewDetail.nextActionLabel).toBe(reviewEntry?.operatorActionLabel);
    expect(reviewDetail.nextActionDetail).toBe(reviewEntry?.operatorActionDetail);
    expect(reviewDetail.navigationTarget).toEqual(reviewEntry?.operatorActionTarget);
  });

  it("keeps review takeover target aligned between Mission Control and Review Pack", () => {
    const projection = asProjection({
      source: "runtime_snapshot_v1" as const,
      generatedAt: 30,
      workspaces: [
        {
          id: "workspace-1",
          name: "Workspace One",
          rootPath: "/tmp/workspace-one",
          connected: true,
          defaultProfileId: null,
        },
      ],
      tasks: [
        {
          id: "task-review",
          workspaceId: "workspace-1",
          title: "Review takeover target",
          objective: "Review takeover target",
          origin: {
            kind: "thread" as const,
            threadId: "thread-review",
            runId: "run-review",
            requestId: null,
          },
          mode: "pair" as const,
          modeSource: "execution_profile" as const,
          status: "review_ready" as const,
          createdAt: 1,
          updatedAt: 30,
          currentRunId: null,
          latestRunId: "run-review",
          latestRunState: "review_ready" as const,
          nextAction: null,
        },
      ],
      runs: [
        {
          id: "run-review",
          taskId: "task-review",
          workspaceId: "workspace-1",
          state: "review_ready" as const,
          title: "Review takeover target",
          summary: "Runtime published a review takeover path.",
          startedAt: 2,
          finishedAt: 29,
          updatedAt: 30,
          currentStepIndex: 0,
          warnings: [],
          validations: [],
          artifacts: [],
          reviewPackId: "review-pack:review",
          takeoverBundle: {
            pathKind: "review",
            primaryAction: "open_review_pack",
            state: "ready",
            summary: "Continue from Review Pack on this device.",
            recommendedAction: "Open Review Pack on this device.",
            target: {
              kind: "review_pack",
              workspaceId: "workspace-1",
              taskId: "task-review",
              runId: "run-review",
              reviewPackId: "review-pack:review",
            },
            reviewPackId: "review-pack:review",
          },
        },
      ],
      reviewPacks: [
        {
          id: "review-pack:review",
          runId: "run-review",
          taskId: "task-review",
          workspaceId: "workspace-1",
          summary: "Runtime published a review takeover path.",
          reviewStatus: "ready" as const,
          evidenceState: "confirmed" as const,
          validationOutcome: "passed" as const,
          warningCount: 0,
          warnings: [],
          validations: [],
          artifacts: [],
          checksPerformed: [],
          recommendedNextAction: "Legacy follow-up.",
          createdAt: 30,
        },
      ],
    });

    const [reviewEntry] = buildMissionReviewEntriesFromProjection(projection, {
      workspaceId: "workspace-1",
    });
    const [latestRun] = buildLatestMissionRunsFromProjection(projection, {
      getWorkspaceGroupName: () => null,
      limit: 1,
    });
    const reviewDetail = buildReviewPackDetailModel({
      projection,
      selection: resolveReviewPackSelection({
        projection,
        workspaceId: "workspace-1",
        request: {
          workspaceId: "workspace-1",
          reviewPackId: "review-pack:review",
          source: "review_surface",
        },
      }),
    });

    expect(reviewEntry?.operatorActionTarget).toEqual({
      kind: "review",
      workspaceId: "workspace-1",
      taskId: "task-review",
      runId: "run-review",
      reviewPackId: "review-pack:review",
      limitation: null,
    });
    expect(latestRun?.operatorActionLabel).toBe(reviewEntry?.operatorActionLabel);
    expect(latestRun?.operatorActionDetail).toBe(reviewEntry?.operatorActionDetail);
    expect(latestRun?.operatorActionTarget).toEqual(reviewEntry?.operatorActionTarget);

    expect(reviewDetail?.kind).toBe("review_pack");
    if (!reviewDetail || reviewDetail.kind !== "review_pack") {
      throw new Error("Expected review pack detail");
    }
    expect(reviewDetail.nextActionLabel).toBe(reviewEntry?.operatorActionLabel);
    expect(reviewDetail.nextActionDetail).toBe(reviewEntry?.operatorActionDetail);
    expect(reviewDetail.navigationTarget).toEqual(reviewEntry?.operatorActionTarget);
  });
});
