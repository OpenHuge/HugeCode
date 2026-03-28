import type {
  AgentTaskRelaunchContext,
  AgentTaskSourceSummary,
  HugeCodeTakeoverBundle,
} from "@ku0/code-runtime-host-contract";
import { describe, expect, it } from "vitest";
import { parseRepositoryExecutionContract } from "./runtimeRepositoryExecutionContract";
import {
  prepareReviewContinuationDraft,
  resolveReviewContinuationDefaults,
  summarizeReviewContinuationActionability,
} from "./runtimeReviewContinuationFacade";

const githubIssueSource: AgentTaskSourceSummary = {
  kind: "github_issue",
  label: "GitHub issue #42 · ku0/hugecode",
  shortLabel: "Issue #42",
  title: "Fix review continuation defaults",
  reference: "#42",
  url: "https://github.com/ku0/hugecode/issues/42",
};

const githubPrFollowUpSource: AgentTaskSourceSummary = {
  kind: "github_pr_followup",
  label: "GitHub PR follow-up #77 · ku0/hugecode",
  shortLabel: "PR #77 follow-up",
  title: "Tighten continuation follow-up",
  reference: "#77",
  url: "https://github.com/ku0/hugecode/pull/77",
};

const relaunchContext: AgentTaskRelaunchContext = {
  sourceTaskId: "runtime-task:42",
  sourceRunId: "run-42",
  sourceReviewPackId: "review-pack:run-42",
  summary: "Retry from runtime-owned relaunch context.",
  failureClass: "validation_failed",
  recommendedActions: ["retry"],
};

function createContract() {
  return parseRepositoryExecutionContract(
    JSON.stringify({
      version: 1,
      defaults: {
        executionProfileId: "balanced-delegate",
        preferredBackendIds: ["backend-default"],
        accessMode: "on-request",
        reviewProfileId: "default-review",
        validationPresetId: "standard",
      },
      defaultReviewProfileId: "default-review",
      sourceMappings: {
        github_issue: {
          executionProfileId: "autonomous-delegate",
          preferredBackendIds: ["backend-issue"],
          accessMode: "full-access",
          reviewProfileId: "issue-review",
          validationPresetId: "fast-lane",
        },
        github_pr_followup: {
          executionProfileId: "operator-review",
          preferredBackendIds: ["backend-pr"],
          accessMode: "read-only",
          reviewProfileId: "pr-review",
          validationPresetId: "review-first",
        },
      },
      validationPresets: [
        { id: "standard", commands: ["pnpm validate"] },
        { id: "fast-lane", commands: ["pnpm validate:fast"] },
        { id: "review-first", commands: ["pnpm test:component"] },
      ],
      reviewProfiles: [
        {
          id: "default-review",
          label: "Default Review",
          allowedSkillIds: ["review-agent"],
          validationPresetId: "standard",
          autofixPolicy: "bounded",
          githubMirrorPolicy: "summary",
        },
        {
          id: "issue-review",
          label: "Issue Review",
          allowedSkillIds: ["review-agent", "repo-policy-check"],
          validationPresetId: "fast-lane",
          autofixPolicy: "manual",
          githubMirrorPolicy: "summary",
        },
        {
          id: "pr-review",
          label: "PR Review",
          allowedSkillIds: ["review-agent"],
          validationPresetId: "review-first",
          autofixPolicy: "bounded",
          githubMirrorPolicy: "check_output",
        },
      ],
    })
  );
}

describe("runtimeReviewContinuationFacade", () => {
  it("lets explicit operator overrides win over runtime and repository defaults", () => {
    const resolved = resolveReviewContinuationDefaults({
      contract: createContract(),
      taskSource: githubIssueSource,
      runtimeDefaults: {
        sourceTaskId: "runtime-task:42",
        sourceRunId: "run-42",
        sourceReviewPackId: "review-pack:run-42",
        taskSource: githubIssueSource,
        executionProfileId: "balanced-delegate",
        preferredBackendIds: ["backend-runtime"],
        accessMode: "on-request",
        reviewProfileId: "default-review",
        validationPresetId: "standard",
        relaunchContext,
      },
      explicitLaunchInput: {
        executionProfileId: "operator-review",
        preferredBackendIds: ["backend-explicit"],
        accessMode: "read-only",
        reviewProfileId: "pr-review",
        validationPresetId: "review-first",
      },
      fallbackProfileId: "balanced-delegate",
    });

    expect(resolved).not.toBeNull();
    if (!resolved) {
      throw new Error("Expected resolved continuation defaults.");
    }
    expect(resolved.executionProfileId).toBe("operator-review");
    expect(resolved.preferredBackendIds).toEqual(["backend-explicit"]);
    expect(resolved.accessMode).toBe("read-only");
    expect(resolved.reviewProfileId).toBe("pr-review");
    expect(resolved.validationPresetId).toBe("review-first");
    expect(resolved.fieldOrigins).toEqual({
      executionProfileId: "explicit_override",
      preferredBackendIds: "explicit_override",
      accessMode: "explicit_override",
      reviewProfileId: "explicit_override",
      validationPresetId: "explicit_override",
    });
  });

  it("prefers runtime-recorded continuation defaults over repository mappings", () => {
    const resolved = resolveReviewContinuationDefaults({
      contract: createContract(),
      taskSource: githubIssueSource,
      runtimeDefaults: {
        sourceTaskId: "runtime-task:42",
        sourceRunId: "run-42",
        sourceReviewPackId: "review-pack:run-42",
        taskSource: githubIssueSource,
        executionProfileId: "balanced-delegate",
        preferredBackendIds: ["backend-runtime"],
        accessMode: "on-request",
        reviewProfileId: "default-review",
        validationPresetId: "standard",
        relaunchContext,
      },
      fallbackProfileId: "operator-review",
    });

    expect(resolved).not.toBeNull();
    if (!resolved) {
      throw new Error("Expected resolved continuation defaults.");
    }
    expect(resolved.executionProfileId).toBe("balanced-delegate");
    expect(resolved.preferredBackendIds).toEqual(["backend-runtime"]);
    expect(resolved.accessMode).toBe("on-request");
    expect(resolved.reviewProfileId).toBe("default-review");
    expect(resolved.validationPresetId).toBe("standard");
    expect(resolved.validationPresetLabel).toBe("standard");
    expect(resolved.validationCommands).toEqual(["pnpm validate"]);
    expect(resolved.fieldOrigins).toEqual({
      executionProfileId: "runtime_recorded",
      preferredBackendIds: "runtime_recorded",
      accessMode: "runtime_recorded",
      reviewProfileId: "runtime_recorded",
      validationPresetId: "runtime_recorded",
    });
  });

  it("does not reapply repository source mappings when runtime only published the execution profile", () => {
    const resolved = resolveReviewContinuationDefaults({
      contract: createContract(),
      taskSource: githubIssueSource,
      runtimeDefaults: {
        sourceTaskId: "runtime-task:42",
        sourceRunId: "run-42",
        sourceReviewPackId: "review-pack:run-42",
        taskSource: githubIssueSource,
        executionProfileId: "balanced-delegate",
        relaunchContext,
      },
      fallbackProfileId: "operator-review",
    });

    expect(resolved).not.toBeNull();
    if (!resolved) {
      throw new Error("Expected resolved continuation defaults.");
    }
    expect(resolved.executionProfileId).toBe("balanced-delegate");
    expect(resolved.preferredBackendIds).toBeUndefined();
    expect(resolved.accessMode).toBeNull();
    expect(resolved.reviewProfileId).toBeNull();
    expect(resolved.validationPresetId).toBeNull();
    expect(resolved.fieldOrigins).toEqual({
      executionProfileId: "runtime_recorded",
      preferredBackendIds: "runtime_relaunch_context",
      accessMode: "runtime_relaunch_context",
      reviewProfileId: "runtime_relaunch_context",
      validationPresetId: "runtime_relaunch_context",
    });
  });

  it("does not synthesize repository-derived defaults when runtime did not publish them", () => {
    const draft = prepareReviewContinuationDraft({
      contract: createContract(),
      taskSource: githubPrFollowUpSource,
      runtimeDefaults: {
        sourceTaskId: "runtime-task:77",
        sourceRunId: "run-77",
        sourceReviewPackId: "review-pack:run-77",
        taskSource: githubPrFollowUpSource,
        relaunchContext: {
          ...relaunchContext,
          sourceTaskId: "runtime-task:77",
          sourceRunId: "run-77",
          sourceReviewPackId: "review-pack:run-77",
        },
      },
      intent: "retry",
      title: "Tighten continuation follow-up",
      instruction: "Retry the PR follow-up with stricter validation.",
      fallbackProfileId: "balanced-delegate",
    });

    expect(draft).toMatchObject({
      intent: "retry",
      title: "Tighten continuation follow-up",
      instruction: "Retry the PR follow-up with stricter validation.",
      profileId: "balanced-delegate",
      reviewProfileId: null,
      validationPresetId: null,
      accessMode: null,
      sourceTaskId: "runtime-task:77",
      sourceRunId: "run-77",
      sourceReviewPackId: "review-pack:run-77",
      taskSource: {
        kind: "github_pr_followup",
      },
      fieldOrigins: {
        executionProfileId: "runtime_recorded",
        preferredBackendIds: "runtime_relaunch_context",
        accessMode: "runtime_relaunch_context",
        reviewProfileId: "runtime_relaunch_context",
        validationPresetId: "runtime_relaunch_context",
      },
    });
    expect(draft?.preferredBackendIds).toBeUndefined();
  });

  it("summarizes blocked continuation actionability with the canonical continue path", () => {
    const summary = summarizeReviewContinuationActionability({
      actionability: {
        state: "blocked",
        summary: "Runtime blocked follow-up until validation evidence is repaired.",
        degradedReasons: ["runtime_evidence_incomplete"],
        actions: [],
      },
      missionLinkage: {
        workspaceId: "workspace-1",
        taskId: "runtime-task:42",
        runId: "run-42",
        reviewPackId: "review-pack:run-42",
        missionTaskId: "runtime-task:42",
        taskEntityKind: "thread",
        recoveryPath: "thread",
        navigationTarget: {
          kind: "thread",
          workspaceId: "workspace-1",
          threadId: "thread-42",
        },
        summary: "Resume from thread-42 on another control device.",
      },
      publishHandoff: {
        jsonPath: ".hugecode/runs/run-42/publish/handoff.json",
        markdownPath: ".hugecode/runs/run-42/publish/handoff.md",
        summary: "Publish handoff is ready.",
        branchName: "main",
        reviewTitle: "Retry continuation",
        details: [],
      },
    });

    expect(summary).toMatchObject({
      state: "blocked",
      summary: "Runtime blocked follow-up until validation evidence is repaired.",
      blockingReason: "Runtime blocked follow-up until validation evidence is repaired.",
      continuePathLabel: "Mission thread",
      recommendedAction:
        "Open the mission thread and resolve the runtime-blocked follow-up before continuing.",
      truthSource: "review_actionability",
      truthSourceLabel: "Runtime review actionability",
    });
    expect(summary.details).toContain("Canonical continue path: Mission thread.");
    expect(summary.details).toContain("Follow-up source: Runtime review actionability.");
    expect(summary.details).toContain("Publish handoff is ready.");
  });

  it("prefers the review pack continue path when runtime publishes a review pack id", () => {
    const summary = summarizeReviewContinuationActionability({
      actionability: {
        state: "blocked",
        summary: "Runtime blocked follow-up until validation evidence is repaired.",
        degradedReasons: ["runtime_evidence_incomplete"],
        actions: [],
      },
      reviewPackId: "review-pack:run-42",
      missionLinkage: {
        workspaceId: "workspace-1",
        taskId: "runtime-task:42",
        runId: "run-42",
        reviewPackId: "review-pack:run-42",
        missionTaskId: "runtime-task:42",
        taskEntityKind: "run",
        recoveryPath: "run",
        navigationTarget: {
          kind: "run",
          workspaceId: "workspace-1",
          taskId: "runtime-task:42",
          runId: "run-42",
          reviewPackId: "review-pack:run-42",
        },
        summary: "Resume from the runtime-published mission detail.",
      },
      publishHandoff: {
        jsonPath: ".hugecode/runs/run-42/publish/handoff.json",
        markdownPath: ".hugecode/runs/run-42/publish/handoff.md",
        summary: "Publish handoff is ready.",
        branchName: "main",
        reviewTitle: "Retry continuation",
        details: [],
      },
    });

    expect(summary).toMatchObject({
      continuePathLabel: "Review Pack",
      recommendedAction:
        "Open Review Pack and resolve the runtime-blocked follow-up before continuing.",
    });
    expect(summary.details).toContain("Canonical continue path: Review Pack.");
  });

  it("prefers takeover-bundle review guidance over mission linkage and publish handoff fragments", () => {
    const takeoverBundle: HugeCodeTakeoverBundle = {
      state: "ready",
      pathKind: "review",
      primaryAction: "open_review_pack",
      summary: "Takeover bundle published the canonical review continuation.",
      recommendedAction: "Continue from Review Pack using takeover guidance.",
      reviewPackId: "review-pack:run-42",
      reviewActionability: {
        state: "ready",
        summary: "Takeover bundle says review can continue now.",
        degradedReasons: [],
        actions: [],
      },
    };

    const summary = summarizeReviewContinuationActionability({
      actionability: {
        state: "blocked",
        summary: "Top-level actionability is stale.",
        degradedReasons: ["runtime_evidence_incomplete"],
        actions: [],
      },
      missionLinkage: {
        workspaceId: "workspace-1",
        taskId: "runtime-task:42",
        runId: "run-42",
        reviewPackId: "review-pack:run-42",
        missionTaskId: "runtime-task:42",
        taskEntityKind: "thread",
        recoveryPath: "thread",
        navigationTarget: {
          kind: "thread",
          workspaceId: "workspace-1",
          threadId: "thread-42",
        },
        summary: "Resume from thread-42 on another control device.",
      },
      publishHandoff: {
        jsonPath: ".hugecode/runs/run-42/publish/handoff.json",
        markdownPath: ".hugecode/runs/run-42/publish/handoff.md",
        summary: "Publish handoff is ready.",
        branchName: "main",
        reviewTitle: "Retry continuation",
        details: [],
      },
      takeoverBundle,
    });

    expect(summary).toMatchObject({
      state: "ready",
      summary: "Takeover bundle says review can continue now.",
      blockingReason: null,
      continuePathLabel: "Review Pack",
      recommendedAction: "Continue from Review Pack using takeover guidance.",
      truthSource: "takeover_bundle",
      truthSourceLabel: "Runtime takeover bundle",
    });
  });
});
