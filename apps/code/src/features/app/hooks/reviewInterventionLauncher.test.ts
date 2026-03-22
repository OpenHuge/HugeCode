import { describe, expect, it, vi } from "vitest";
import type { MissionInterventionDraft } from "../../../application/runtime/facades/runtimeTaskInterventionDraftFacade";
import { launchReviewInterventionDraft } from "./reviewInterventionLauncher";

function createDraft(overrides: Partial<MissionInterventionDraft> = {}): MissionInterventionDraft {
  return {
    intent: "retry",
    title: "Retry review task",
    instruction: "Retry the review task with the recorded brief.",
    profileId: "balanced-delegate",
    preferredBackendIds: ["backend-a"],
    relaunchContext: {
      sourceTaskId: "task-1",
      sourceRunId: "run-1",
      sourceReviewPackId: "review-pack:run-1",
      summary: "Retry with runtime-owned relaunch context.",
      failureClass: "validation_failed",
      recommendedActions: ["retry"],
    },
    sourceTaskId: "task-1",
    sourceRunId: "run-1",
    sourceReviewPackId: "review-pack:run-1",
    ...overrides,
  };
}

describe("reviewInterventionLauncher", () => {
  it("submits pair-mode interventions through runtime interveneTask and refreshes mission control", async () => {
    const interveneTask = vi.fn().mockResolvedValue({
      accepted: true,
      action: "escalate_to_pair_mode",
      taskId: "task-1",
      status: "queued",
      outcome: "spawned",
      spawnedTaskId: "task-2",
    });
    const onRefresh = vi.fn().mockResolvedValue(undefined);

    const ack = await launchReviewInterventionDraft({
      draft: createDraft({
        intent: "pair_mode",
        instruction: "Continue in pair with the current review context.",
        preferredBackendIds: ["backend-pair"],
        relaunchContext: {
          sourceTaskId: "task-1",
          sourceRunId: "run-1",
          sourceReviewPackId: "review-pack:run-1",
          summary: "Continue in pair with runtime-owned relaunch context.",
          failureClass: "validation_failed",
          recommendedActions: ["escalate_to_pair_mode"],
        },
      }),
      runtimeControl: { interveneTask },
      onRefresh,
    });

    expect(interveneTask).toHaveBeenCalledWith({
      taskId: "task-1",
      action: "escalate_to_pair_mode",
      reason: "review_follow_up:pair_mode",
      instructionPatch: "Continue in pair with the current review context.",
      executionProfileId: "balanced-delegate",
      preferredBackendIds: ["backend-pair"],
      relaunchContext: {
        sourceTaskId: "task-1",
        sourceRunId: "run-1",
        sourceReviewPackId: "review-pack:run-1",
        summary: "Continue in pair with runtime-owned relaunch context.",
        failureClass: "validation_failed",
        recommendedActions: ["escalate_to_pair_mode"],
      },
    });
    expect(ack).toMatchObject({
      accepted: true,
      outcome: "spawned",
      spawnedTaskId: "task-2",
    });
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it("throws a blocked error when runtime rejects the intervention", async () => {
    const interveneTask = vi.fn().mockResolvedValue({
      accepted: false,
      action: "retry",
      taskId: "task-1",
      status: "review",
      outcome: "blocked",
    });

    await expect(
      launchReviewInterventionDraft({
        draft: createDraft(),
        runtimeControl: { interveneTask },
      })
    ).rejects.toThrow("Runtime blocked this intervention. Check run state and try again.");
  });

  it("throws an unsupported error when runtime control does not expose interveneTask", async () => {
    await expect(
      launchReviewInterventionDraft({
        draft: createDraft(),
        runtimeControl: {},
      })
    ).rejects.toThrow("Runtime does not support task interventions.");
  });
});
