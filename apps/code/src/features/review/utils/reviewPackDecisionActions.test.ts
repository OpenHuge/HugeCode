import { describe, expect, it } from "vitest";
import { buildReviewPackInterventionDecisionActions } from "./reviewPackDecisionActions";

describe("reviewPackDecisionActions", () => {
  it("builds registry-driven intervention actions with clarify-specific instructions", () => {
    const actions = buildReviewPackInterventionDecisionActions({
      navigationTarget: {
        kind: "review",
        workspaceId: "workspace-1",
        taskId: "task-1",
        runId: "run-1",
        reviewPackId: "review-pack-1",
      },
      readOnlyReason: null,
      runtimeInterventionsSupported: true,
      nextActionDetail: "Retry the run with the recorded context.",
      title: "Retry run",
      instruction: "Investigate the failure and continue.",
      executionProfileId: "balanced-delegate",
      preferredBackendIds: ["backend-1"],
      sourceTaskId: "task-1",
      sourceRunId: "run-1",
      sourceReviewPackId: "review-pack-1",
      actions: [
        {
          action: "retry",
          enabled: true,
          supported: true,
          reason: null,
        },
        {
          action: "continue_with_clarification",
          enabled: true,
          supported: true,
          reason: null,
        },
        {
          action: "switch_profile_and_retry",
          enabled: false,
          supported: true,
          reason: "Choose another execution profile first.",
        },
        {
          action: "escalate_to_pair_mode",
          enabled: true,
          supported: true,
          reason: null,
        },
      ],
    });

    expect(actions.map((action) => action.id)).toEqual([
      "retry",
      "clarify",
      "switch_profile_and_retry",
      "continue_in_pair",
    ]);
    expect(actions[0]?.enabled).toBe(true);
    expect(actions[0]?.interventionDraft?.intent).toBe("retry");
    expect(actions[1]?.interventionDraft?.instruction).toContain("Clarify before continuing");
    expect(actions[2]?.enabled).toBe(false);
    expect(actions[2]?.disabledReason).toBe("Choose another execution profile first.");
    expect(actions[3]?.interventionDraft?.intent).toBe("pair_mode");
  });
});
