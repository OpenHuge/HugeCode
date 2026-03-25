import type {
  RuntimeRunPrepareV2Response,
  RuntimeRunStartV2Response,
} from "@ku0/code-runtime-host-contract";
import { describe, expect, it, vi } from "vitest";
import type { GitHubIssue, GitHubPullRequest } from "../../../types";
import * as runtimeJobsPort from "../ports/tauriRuntimeJobs";
import { parseRepositoryExecutionContract } from "./runtimeRepositoryExecutionContract";
import {
  assertGovernedGitHubLaunchReady,
  buildGovernedGitHubIssueLaunchRequest,
  buildGovernedGitHubPullRequestLaunchRequest,
  evaluateGovernedGitHubLaunchPreflight,
  launchGovernedGitHubRun,
} from "./githubSourceGovernedLaunch";

function createContract() {
  return parseRepositoryExecutionContract(
    JSON.stringify({
      version: 1,
      defaults: {
        executionProfileId: "balanced-delegate",
        preferredBackendIds: ["backend-default"],
        reviewProfileId: "default-review",
        validationPresetId: "standard",
      },
      defaultReviewProfileId: "default-review",
      sourceMappings: {
        github_issue: {
          executionProfileId: "autonomous-delegate",
          preferredBackendIds: ["backend-issue"],
          reviewProfileId: "issue-review",
          validationPresetId: "fast-lane",
          accessMode: "full-access",
        },
        github_pr_followup: {
          executionProfileId: "operator-review",
          preferredBackendIds: ["backend-pr"],
          reviewProfileId: "pr-review",
          validationPresetId: "review-first",
          accessMode: "read-only",
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
          allowedSkillIds: ["review-agent"],
          validationPresetId: "fast-lane",
          autofixPolicy: "manual",
          githubMirrorPolicy: "check_output",
        },
        {
          id: "pr-review",
          label: "PR Review",
          allowedSkillIds: ["review-agent"],
          validationPresetId: "review-first",
          autofixPolicy: "bounded",
          githubMirrorPolicy: "summary",
        },
      ],
    })
  );
}

describe("githubSourceGovernedLaunch", () => {
  it("blocks launch preflight while repository execution defaults are still loading", () => {
    expect(
      evaluateGovernedGitHubLaunchPreflight({
        policyStatus: "loading",
      })
    ).toEqual({
      state: "blocked",
      reason:
        "GitHub source launch is waiting for repository execution defaults to finish loading.",
    });
  });

  it("blocks launch preflight when repository execution policy failed to load", () => {
    expect(
      evaluateGovernedGitHubLaunchPreflight({
        policyStatus: "error",
        policyError: "contract parse failed",
      })
    ).toEqual({
      state: "blocked",
      reason:
        "GitHub source launch is blocked until repository execution policy loads cleanly. contract parse failed",
    });
    expect(() =>
      assertGovernedGitHubLaunchReady({
        policyStatus: "error",
        policyError: "contract parse failed",
      })
    ).toThrow(
      "GitHub source launch is blocked until repository execution policy loads cleanly. contract parse failed"
    );
  });

  it("builds a governed GitHub issue launch request with repo defaults and canonical task source", () => {
    const issue: GitHubIssue = {
      number: 42,
      title: "Unify GitHub source launches",
      url: "https://github.com/openai/hugecode/issues/42",
      updatedAt: "2026-03-24T00:00:00.000Z",
      body: "Route this through the governed launch path.",
      author: { login: "octocat" },
      labels: ["beta", "runtime"],
    };

    const { launch, request } = buildGovernedGitHubIssueLaunchRequest({
      issue,
      workspace: {
        workspaceId: "ws-1",
        workspaceRoot: "/workspace/hugecode",
        gitRemoteUrl: "https://github.com/openai/hugecode.git",
      },
      options: {
        repositoryExecutionContract: createContract(),
      },
    });

    expect(launch.taskSource).toEqual(
      expect.objectContaining({
        kind: "github_issue",
        label: "GitHub issue #42",
        shortLabel: "Issue #42",
        reference: "#42",
        url: issue.url,
        issueNumber: 42,
        workspaceId: "ws-1",
        workspaceRoot: "/workspace/hugecode",
        repo: expect.objectContaining({
          fullName: "openai/hugecode",
          remoteUrl: "https://github.com/openai/hugecode.git",
        }),
      })
    );
    expect(request).toEqual(
      expect.objectContaining({
        workspaceId: "ws-1",
        title: "Unify GitHub source launches",
        executionProfileId: "autonomous-delegate",
        reviewProfileId: "issue-review",
        validationPresetId: "fast-lane",
        accessMode: "full-access",
        executionMode: "distributed",
        preferredBackendIds: ["backend-issue"],
        taskSource: expect.objectContaining({
          kind: "github_issue",
          workspaceId: "ws-1",
        }),
        missionBrief: expect.objectContaining({
          constraints: expect.arrayContaining([
            "Stay within the linked workspace and repository context for GitHub issue #42 · #42 · openai/hugecode unless an operator explicitly expands scope.",
            "Keep continuation operator-supervised and do not auto-continue past review, approval, or validation gates.",
            "Cite repository evidence for findings, recommendations, and follow-up actions instead of relying on broad network research.",
          ]),
        }),
        autonomyRequest: expect.objectContaining({
          sourceScope: "workspace_graph",
          researchPolicy: expect.objectContaining({
            mode: "repository_only",
            allowNetworkAnalysis: false,
            requireCitations: true,
          }),
        }),
      })
    );
  });

  it("lets explicit backend preference override repo source defaults for GitHub issue launches", () => {
    const { request } = buildGovernedGitHubIssueLaunchRequest({
      issue: {
        number: 7,
        title: "Prefer a specific backend",
        url: "https://github.com/openai/hugecode/issues/7",
      },
      workspace: {
        workspaceId: "ws-1",
      },
      options: {
        repositoryExecutionContract: createContract(),
        preferredBackendIds: ["backend-explicit", "backend-explicit"],
      },
    });

    expect(request.preferredBackendIds).toEqual(["backend-explicit"]);
    expect(request.executionProfileId).toBe("autonomous-delegate");
  });

  it("builds a governed GitHub PR follow-up request with source-linked review defaults", () => {
    const pullRequest: GitHubPullRequest = {
      number: 17,
      title: "Preserve review linkage",
      url: "https://github.com/openai/hugecode/pull/17",
      updatedAt: "2026-03-24T00:00:00.000Z",
      createdAt: "2026-03-23T00:00:00.000Z",
      body: "Keep PR follow-up on the same governed path.",
      headRefName: "feature/review-linkage",
      baseRefName: "main",
      isDraft: false,
      author: { login: "maintainer" },
    };

    const { request } = buildGovernedGitHubPullRequestLaunchRequest({
      pullRequest,
      diffs: [{ path: "apps/code/src/foo.ts", status: "modified", diff: "@@" }],
      comments: [],
      workspace: {
        workspaceId: "ws-1",
        workspaceRoot: "/workspace/hugecode",
      },
      options: {
        repositoryExecutionContract: createContract(),
      },
    });

    expect(request).toEqual(
      expect.objectContaining({
        executionProfileId: "operator-review",
        reviewProfileId: "pr-review",
        validationPresetId: "review-first",
        accessMode: "read-only",
        executionMode: "single",
        preferredBackendIds: ["backend-pr"],
        taskSource: expect.objectContaining({
          kind: "github_pr_followup",
          pullRequestNumber: 17,
          workspaceId: "ws-1",
        }),
        missionBrief: expect.objectContaining({
          constraints: expect.arrayContaining([
            "Stay within the linked workspace and repository context for GitHub PR follow-up #17 · #17 · openai/hugecode unless an operator explicitly expands scope.",
            "Keep continuation operator-supervised and do not auto-continue past review, approval, or validation gates.",
            "Cite repository evidence for findings, recommendations, and follow-up actions instead of relying on broad network research.",
          ]),
        }),
      })
    );
    expect(request.steps[0]?.input).toContain("Changed files (1):");
  });

  it("prepares, starts, and refreshes a governed GitHub launch in order", async () => {
    const preparation: RuntimeRunPrepareV2Response = {
      preparedAt: 1,
      runIntent: {
        title: "Issue 42",
        objective: "Issue 42",
        summary: "summary",
        taskSource: { kind: "github_issue" },
        accessMode: "read-only",
        executionMode: "single",
        executionProfileId: "operator-review",
        reviewProfileId: null,
        validationPresetId: null,
        preferredBackendIds: [],
        requiredCapabilities: [],
        riskLevel: "low",
        clarified: true,
        missingContext: [],
      },
      contextWorkingSet: {
        summary: "summary",
        workspaceRoot: null,
        layers: [],
      },
      executionGraph: {
        graphId: "graph-1",
        summary: "graph",
        nodes: [],
      },
      approvalBatches: [],
      validationPlan: {
        required: false,
        summary: "none",
        commands: [],
      },
      reviewFocus: [],
      autonomyProfile: "supervised",
      wakePolicy: {
        mode: "hold",
        safeFollowUp: true,
        allowAutomaticContinuation: false,
        allowedActions: ["hold"],
        stopGates: [],
      },
      intentSnapshot: {
        summary: "intent",
        primaryGoal: null,
        dominantDirection: null,
        confidence: "medium",
        signals: [],
      },
      opportunityQueue: {
        selectedOpportunityId: null,
        selectionSummary: null,
        candidates: [],
      },
      researchTrace: {
        mode: "repository_only",
        stage: "repository",
        summary: "research",
        citations: [],
        sensitiveContextMixed: false,
      },
      executionEligibility: {
        eligible: true,
        summary: "eligible",
        wakeState: "ready",
        nextEligibleAction: "hold",
        blockingReasons: [],
      },
      wakePolicySummary: {
        summary: "hold",
        safeFollowUp: true,
        allowedActions: ["hold"],
      },
    };
    const response: RuntimeRunStartV2Response = {
      run: {
        taskId: "runtime-task:42",
        workspaceId: "ws-1",
        threadId: null,
        requestId: null,
        title: "Issue 42",
        taskSource: { kind: "github_issue" },
        status: "queued",
        accessMode: "read-only",
        executionProfileId: "operator-review",
        executionMode: "single",
        provider: null,
        modelId: null,
        routedProvider: null,
        routedModelId: null,
        routedPool: null,
        routedSource: null,
        currentStep: null,
        createdAt: 1,
        updatedAt: 1,
        startedAt: null,
        completedAt: null,
        errorCode: null,
        errorMessage: null,
        pendingApprovalId: null,
        preferredBackendIds: ["backend-issue"],
        steps: [],
      },
      missionRun: {
        id: "run-42",
        taskId: "runtime-task:42",
        workspaceId: "ws-1",
        state: "queued",
        title: "Issue 42",
        summary: null,
        updatedAt: 1,
        startedAt: null,
        finishedAt: null,
        currentStepIndex: null,
      },
      reviewPack: null,
    };
    const prepareSpy = vi
      .spyOn(runtimeJobsPort, "prepareRuntimeRunV2")
      .mockResolvedValue(preparation);
    const startSpy = vi.spyOn(runtimeJobsPort, "startRuntimeRunV2").mockResolvedValue(response);
    const onRefresh = vi.fn();

    const request = {
      workspaceId: "ws-1",
      accessMode: "read-only" as const,
      executionMode: "single" as const,
      taskSource: { kind: "github_issue" as const },
      steps: [{ kind: "read" as const, input: "Inspect GitHub issue #42." }],
    };

    const result = await launchGovernedGitHubRun({
      request,
      launch: {
        title: "Issue 42",
        instruction: "Inspect GitHub issue #42.",
        missionBrief: { objective: "Issue 42" },
        taskSource: { kind: "github_issue" },
      },
      onRefresh,
    });

    expect(prepareSpy).toHaveBeenCalledWith(request);
    expect(startSpy).toHaveBeenCalledWith(request);
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(result).toEqual(
      expect.objectContaining({
        preparation,
        response,
        request,
      })
    );
  });
});
