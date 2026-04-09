import { describe, expect, it } from "vitest";
import { buildMissionBriefDetail } from "./runtime-control-plane/runtimeReviewPackDetailPresentation";

describe("runtimeReviewPackDetailPresentation", () => {
  it("surfaces mission brief constraints for governed GitHub source reviews", () => {
    const detail = buildMissionBriefDetail({
      objective: "Fix GitHub issue #42",
      doneDefinition: null,
      constraints: [
        "Stay within the linked workspace and repository context for GitHub issue #42 · #42 · ku0/hugecode unless an operator explicitly expands scope.",
        "Keep continuation operator-supervised and do not auto-continue past review, approval, or validation gates.",
        "Cite repository evidence for findings, recommendations, and follow-up actions instead of relying on broad network research.",
      ],
      riskLevel: "medium",
      requiredCapabilities: ["code", "review"],
      maxSubtasks: 2,
      preferredBackendIds: ["backend-a"],
      permissionSummary: {
        accessMode: "read-only",
        allowNetwork: false,
        writableRoots: null,
        toolNames: null,
      },
    });

    expect(detail).toEqual(
      expect.objectContaining({
        summary: "Structured mission brief persisted for relaunch, supervision, and review.",
        details: expect.arrayContaining([
          "Objective: Fix GitHub issue #42",
          "Constraints: Stay within the linked workspace and repository context for GitHub issue #42 · #42 · ku0/hugecode unless an operator explicitly expands scope.; Keep continuation operator-supervised and do not auto-continue past review, approval, or validation gates.; Cite repository evidence for findings, recommendations, and follow-up actions instead of relying on broad network research.",
          "Access mode: read-only",
          "Network access disabled.",
        ]),
      })
    );
  });
});
