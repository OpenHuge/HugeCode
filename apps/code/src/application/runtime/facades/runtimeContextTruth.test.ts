import { describe, expect, it } from "vitest";
import {
  buildRuntimeContextTruth,
  buildRuntimeDelegationContract,
  buildRuntimeGuidanceStack,
  buildRuntimeTriageSummary,
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
          owner: null,
          triagePriority: null,
          triageRiskLevel: null,
          triageTags: [],
          repoInstructions: [],
          repoSkillIds: [],
          sourceInstructions: [],
          sourceSkillIds: [],
          reviewProfile: null,
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
          owner: null,
          triagePriority: null,
          triageRiskLevel: null,
          triageTags: [],
          repoInstructions: [],
          repoSkillIds: [],
          sourceInstructions: [],
          sourceSkillIds: [],
          reviewProfile: null,
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
        owner: "Issue Desk",
        triagePriority: "high",
        triageRiskLevel: "high",
        triageTags: ["customer-facing"],
        repoInstructions: ["Prefer repo-owned context truth."],
        repoSkillIds: ["repo-baseline"],
        sourceInstructions: ["Treat discussions as governed triage intake."],
        sourceSkillIds: ["discussion-triage"],
        reviewProfile: {
          id: "issue-review",
          label: "Issue Review",
          description: null,
          allowedSkillIds: ["review-agent"],
          validationPresetId: "review-first",
          autofixPolicy: "manual",
          githubMirrorPolicy: "summary",
        },
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
        owner: "Issue Desk",
        triagePriority: "high",
        triageRiskLevel: "high",
        triageTags: ["customer-facing"],
        repoInstructions: ["Prefer repo-owned context truth."],
        repoSkillIds: ["repo-baseline"],
        sourceInstructions: ["Treat discussions as governed triage intake."],
        sourceSkillIds: ["discussion-triage"],
        reviewProfile: {
          id: "issue-review",
          label: "Issue Review",
          description: null,
          allowedSkillIds: ["review-agent"],
          validationPresetId: "review-first",
          autofixPolicy: "manual",
          githubMirrorPolicy: "summary",
        },
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
    expect(contextTruth.ownerSummary).toContain("Issue Desk");
    expect(guidanceStack.precedence[0]).toBe("launch");
    expect(guidanceStack.layers.map((layer) => layer.scope)).toEqual(
      expect.arrayContaining(["repo", "review_profile", "source", "launch"])
    );
    expect(guidanceStack.layers.find((layer) => layer.scope === "repo")?.instructions).toEqual([
      "Prefer repo-owned context truth.",
    ]);
    expect(guidanceStack.layers.find((layer) => layer.scope === "source")?.skillIds).toEqual([
      "discussion-triage",
    ]);
  });

  it("builds triage and delegation summaries with a single next operator action", () => {
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
        owner: "Core Runtime",
        triagePriority: "urgent",
        triageRiskLevel: "high",
        triageTags: ["hotfix", "customer"],
        repoInstructions: [],
        repoSkillIds: [],
        sourceInstructions: [],
        sourceSkillIds: [],
        reviewProfile: null,
      },
    });
    const triageSummary = buildRuntimeTriageSummary({
      taskSource: {
        kind: "github_issue",
        label: "GitHub issue #42",
        title: "Fix follow-up semantics",
        reference: "#42",
        canonicalUrl: "https://github.com/acme/hugecode/issues/42",
      },
      repositoryDefaults: {
        executionProfileId: "autonomous-delegate",
        reviewProfileId: null,
        validationPresetId: "standard",
        owner: "Core Runtime",
        triagePriority: "urgent",
        triageRiskLevel: "high",
        triageTags: ["hotfix", "customer"],
        repoInstructions: [],
        repoSkillIds: [],
        sourceInstructions: [],
        sourceSkillIds: [],
        reviewProfile: null,
      },
    });

    const contract = buildRuntimeDelegationContract({
      contextTruth,
      triageSummary,
      missingContext: ["objective"],
      approvalBatchCount: 2,
      continuePathLabel: "Review Pack",
    });

    expect(triageSummary.summary).toContain("Owner Core Runtime");
    expect(triageSummary.priority).toBe("urgent");
    expect(triageSummary.dedupeKey).toContain("github_issue");
    expect(contract.state).toBe("needs_clarification");
    expect(contract.humanOwner).toBe("Core Runtime");
    expect(contract.agentExecutor).toBe("Runtime agent");
    expect(contract.accountability).toContain("Core Runtime stays accountable");
    expect(contract.nextOperatorAction).toContain("objective");
  });
});
