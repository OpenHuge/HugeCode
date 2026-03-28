import { describe, expect, it } from "vitest";
import { resolveMissionControlReviewPresentation } from "./missionControlReviewPresentationPolicy";

describe("missionControlReviewPresentationPolicy", () => {
  it("treats failed validation as the highest-priority blocked review state", () => {
    expect(
      resolveMissionControlReviewPresentation({
        reviewPack: {
          id: "review-1",
          runId: "run-1",
          taskId: "task-1",
          workspaceId: "workspace-1",
          summary: "Failed validation",
          reviewStatus: "ready",
          evidenceState: "confirmed",
          validationOutcome: "failed",
          warningCount: 0,
          warnings: [],
          validations: [],
          artifacts: [],
          checksPerformed: [],
          recommendedNextAction: null,
          createdAt: 0,
        },
        run: null,
      })
    ).toEqual({
      triagePriority: 4,
      tone: "blocked",
      reviewStatusLabel: "Validation failed",
    });
  });

  it("maps blocked follow-up paths into a dedicated blocked review lane", () => {
    expect(
      resolveMissionControlReviewPresentation({
        reviewPack: {
          id: "review-1",
          runId: "run-1",
          taskId: "task-1",
          workspaceId: "workspace-1",
          summary: "Blocked follow-up",
          reviewStatus: "ready",
          evidenceState: "confirmed",
          validationOutcome: "passed",
          warningCount: 0,
          warnings: [],
          validations: [],
          artifacts: [],
          checksPerformed: [],
          recommendedNextAction: null,
          createdAt: 0,
        },
        run: null,
        continuationState: "blocked",
      })
    ).toEqual({
      triagePriority: 3,
      tone: "blocked",
      reviewStatusLabel: "Blocked follow-up",
    });
  });

  it("keeps autofix-ready reviews ahead of incomplete evidence while preserving attention tone", () => {
    const autofixReady = resolveMissionControlReviewPresentation({
      reviewPack: {
        id: "review-1",
        runId: "run-1",
        taskId: "task-1",
        workspaceId: "workspace-1",
        summary: "Autofix ready",
        reviewStatus: "ready",
        evidenceState: "confirmed",
        validationOutcome: "passed",
        warningCount: 1,
        warnings: [],
        validations: [],
        artifacts: [],
        checksPerformed: [],
        recommendedNextAction: null,
        autofixCandidate: {
          id: "autofix-1",
          summary: "Apply the bounded autofix.",
          status: "available",
        },
        createdAt: 0,
      },
      run: null,
    });
    const incompleteEvidence = resolveMissionControlReviewPresentation({
      reviewPack: {
        id: "review-2",
        runId: "run-2",
        taskId: "task-2",
        workspaceId: "workspace-1",
        summary: "Evidence incomplete",
        reviewStatus: "incomplete_evidence",
        evidenceState: "partial",
        validationOutcome: "warning",
        warningCount: 2,
        warnings: [],
        validations: [],
        artifacts: [],
        checksPerformed: [],
        recommendedNextAction: null,
        reviewGate: {
          state: "warn",
          summary: "Evidence is incomplete.",
          highestSeverity: "warning",
          findingCount: 1,
        },
        createdAt: 0,
      },
      run: null,
    });

    expect(autofixReady).toEqual({
      triagePriority: 2,
      tone: "attention",
      reviewStatusLabel: "Autofix ready",
    });
    expect(incompleteEvidence).toEqual({
      triagePriority: 1,
      tone: "attention",
      reviewStatusLabel: "Evidence incomplete",
    });
  });
});
