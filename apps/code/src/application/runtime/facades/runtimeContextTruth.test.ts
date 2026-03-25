import { describe, expect, it } from "vitest";
import {
  buildRuntimeContextTruth,
  buildRuntimeDelegationContract,
  buildRuntimeGuidanceStack,
  classifyRuntimeContextSourceFamily,
  inferRuntimeReviewIntent,
} from "./runtimeContextTruth";

describe("runtimeContextTruth", () => {
  it("classifies expanded source families and review intent", () => {
    expect(classifyRuntimeContextSourceFamily("github_discussion")).toBe("discussion");
    expect(classifyRuntimeContextSourceFamily("customer_feedback")).toBe("feedback");
    expect(classifyRuntimeContextSourceFamily("doc")).toBe("doc");
    expect(classifyRuntimeContextSourceFamily("call_summary")).toBe("call");
    expect(classifyRuntimeContextSourceFamily("external_ref")).toBe("external");

    expect(
      inferRuntimeReviewIntent({
        taskSource: { kind: "github_pr_followup", title: "Review changes" },
        repositoryDefaults: {
          executionProfileId: "autonomous-delegate",
          reviewProfileId: null,
          validationPresetId: "review-first",
        },
      })
    ).toBe("review");

    expect(
      inferRuntimeReviewIntent({
        taskSource: { kind: "customer_feedback", title: "Escalation" },
        repositoryDefaults: {
          executionProfileId: "balanced-delegate",
          reviewProfileId: null,
          validationPresetId: "standard",
        },
      })
    ).toBe("triage");
  });

  it("builds canonical context truth plus guidance stack from repo defaults", () => {
    const contextTruth = buildRuntimeContextTruth({
      taskSource: {
        kind: "github_discussion",
        label: "GitHub discussion #14",
        title: "Refine runtime triage semantics",
        reference: "#14",
        canonicalUrl: "https://github.com/acme/hugecode/discussions/14",
        repo: { fullName: "acme/hugecode" },
      },
      repositoryDefaults: {
        executionProfileId: "balanced-delegate",
        reviewProfileId: "issue-review",
        validationPresetId: "review-first",
      },
      contractLabel: "Workspace defaults",
      hasRepoInstructions: true,
      explicitInstruction: "Turn this into a governed run.",
    });
    const guidanceStack = buildRuntimeGuidanceStack({
      taskSource: contextTruth.canonicalTaskSource
        ? {
            kind: contextTruth.canonicalTaskSource.kind,
            title: contextTruth.canonicalTaskSource.summary,
          }
        : null,
      repositoryDefaults: {
        executionProfileId: "balanced-delegate",
        reviewProfileId: "issue-review",
        validationPresetId: "review-first",
      },
      contractLabel: "Workspace defaults",
      hasRepoInstructions: true,
      explicitInstruction: "Turn this into a governed run.",
    });

    expect(contextTruth).toMatchObject({
      reviewIntent: "review",
      executionProfileId: "balanced-delegate",
      reviewProfileId: "issue-review",
      validationPresetId: "review-first",
    });
    expect(contextTruth.summary).toContain("canonical governed run path");
    expect(contextTruth.canonicalTaskSource?.family).toBe("discussion");
    expect(guidanceStack.precedence[0]).toBe("launch");
    expect(guidanceStack.layers.map((layer) => layer.scope)).toEqual(
      expect.arrayContaining(["repo", "review_profile", "source", "launch"])
    );
  });

  it("builds a governed delegation contract with a single next operator action", () => {
    const contextTruth = buildRuntimeContextTruth({
      taskSource: {
        kind: "github_issue",
        label: "GitHub issue #42",
        title: "Fix follow-up semantics",
        reference: "#42",
      },
      repositoryDefaults: {
        executionProfileId: "autonomous-delegate",
        reviewProfileId: null,
        validationPresetId: "standard",
      },
    });

    const contract = buildRuntimeDelegationContract({
      contextTruth,
      missingContext: ["objective"],
      approvalBatchCount: 2,
      continuePathLabel: "Review Pack",
    });

    expect(contract.state).toBe("needs_clarification");
    expect(contract.humanOwner).toBe("Operator");
    expect(contract.agentExecutor).toBe("Runtime agent");
    expect(contract.accountability).toContain("Human owner stays accountable");
    expect(contract.nextOperatorAction).toContain("objective");
  });
});
