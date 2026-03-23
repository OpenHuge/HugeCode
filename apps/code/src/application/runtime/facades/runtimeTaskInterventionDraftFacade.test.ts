import { describe, expect, it } from "vitest";
import type { AgentTaskSummary } from "@ku0/code-runtime-host-contract";
import { parseRepositoryExecutionContract } from "./runtimeRepositoryExecutionContract";
import {
  buildRuntimeTaskReplayBrief,
  prepareRuntimeTaskLauncherDraft,
} from "./runtimeTaskInterventionDraftFacade";

function createTask(overrides: Partial<AgentTaskSummary> = {}): AgentTaskSummary {
  return {
    taskId: "task-1",
    workspaceId: "ws-1",
    threadId: null,
    requestId: null,
    title: "Investigate runtime issue",
    status: "failed",
    accessMode: "on-request",
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
    startedAt: 1,
    completedAt: 1,
    errorCode: null,
    errorMessage: null,
    pendingApprovalId: null,
    executionProfileId: "balanced-delegate",
    steps: [
      {
        index: 0,
        kind: "read",
        role: "planner",
        status: "completed",
        message: "Inspect runtime orchestration state.",
        runId: null,
        output: "Inspect runtime orchestration state.",
        metadata: {},
        startedAt: 1,
        updatedAt: 1,
        completedAt: 1,
        errorCode: null,
        errorMessage: null,
        approvalId: null,
      },
    ],
    ...overrides,
  };
}

function createRepositoryExecutionContract() {
  return parseRepositoryExecutionContract(
    JSON.stringify({
      version: 1,
      defaults: {
        executionProfileId: "operator-review",
        preferredBackendIds: ["backend-default"],
        accessMode: "read-only",
        reviewProfileId: "default-review",
        validationPresetId: "review-first",
      },
      sourceMappings: {
        github_issue: {
          executionProfileId: "operator-review",
          preferredBackendIds: ["backend-issue"],
          accessMode: "read-only",
          reviewProfileId: "issue-review",
          validationPresetId: "review-first",
        },
      },
      validationPresets: [
        {
          id: "review-first",
          commands: ["pnpm test:component"],
        },
      ],
      reviewProfiles: [
        {
          id: "default-review",
          label: "Default Review",
          allowedSkillIds: ["review-agent"],
          validationPresetId: "review-first",
          autofixPolicy: "bounded",
          githubMirrorPolicy: "summary",
        },
        {
          id: "issue-review",
          label: "Issue Review",
          allowedSkillIds: ["review-agent"],
          validationPresetId: "review-first",
          autofixPolicy: "manual",
          githubMirrorPolicy: "summary",
        },
      ],
    })
  );
}

describe("runtimeTaskInterventionDraftFacade", () => {
  it("builds a replay brief from the task title and latest step output", () => {
    expect(buildRuntimeTaskReplayBrief(createTask())).toBe(
      "Investigate runtime issue\n\nInspect runtime orchestration state."
    );
  });

  it("prepares retry launcher drafts without changing the mission brief", () => {
    const result = prepareRuntimeTaskLauncherDraft({
      task: createTask(),
      intent: "retry",
      preferredBackendIds: ["backend-review-a"],
      sourceRunId: "run-1",
      sourceReviewPackId: "review-pack:run-1",
    });

    expect(result).toEqual({
      ok: true,
      draft: {
        intent: "retry",
        title: "Investigate runtime issue",
        instruction: "Investigate runtime issue\n\nInspect runtime orchestration state.",
        profileId: "balanced-delegate",
        preferredBackendIds: ["backend-review-a"],
        validationPresetId: "standard",
        reviewProfileId: null,
        accessMode: "on-request",
        taskSource: null,
        sourceMappingKind: null,
        fieldOrigins: {
          executionProfileId: "runtime_recorded",
          preferredBackendIds: "runtime_recorded",
          accessMode: "runtime_recorded",
          validationPresetId: "runtime_fallback",
          reviewProfileId: "runtime_fallback",
        },
        sourceTaskId: "task-1",
        sourceRunId: "run-1",
        sourceReviewPackId: "review-pack:run-1",
        sourceDraft: {
          taskId: "task-1",
          title: "Investigate runtime issue",
          instruction: "Investigate runtime issue\n\nInspect runtime orchestration state.",
          intent: "retry",
          profileId: "balanced-delegate",
          preferredBackendIds: ["backend-review-a"],
          reviewProfileId: null,
          taskSource: null,
          sourceMappingKind: null,
          validationPresetId: "standard",
          accessMode: "on-request",
          fieldOrigins: {
            executionProfileId: "runtime_recorded",
            preferredBackendIds: "runtime_recorded",
            accessMode: "runtime_recorded",
            validationPresetId: "runtime_fallback",
            reviewProfileId: "runtime_fallback",
          },
        },
        infoMessage: "Run task-1 loaded into the launcher for retry.",
      },
    });
  });

  it("prepares clarify drafts with the existing clarification appendix", () => {
    const result = prepareRuntimeTaskLauncherDraft({
      task: createTask(),
      intent: "clarify",
      executionProfileId: "operator-review",
      sourceRunId: "run-1",
    });

    expect(result).toEqual({
      ok: true,
      draft: {
        intent: "clarify",
        title: "Investigate runtime issue",
        instruction:
          "Investigate runtime issue\n\nInspect runtime orchestration state.\n\nClarify before continuing:\n- What changed?\n- What should stay in bounds?\n- What outcome is required now?",
        profileId: "operator-review",
        validationPresetId: "review-first",
        reviewProfileId: null,
        accessMode: "on-request",
        taskSource: null,
        sourceMappingKind: null,
        fieldOrigins: {
          executionProfileId: "runtime_recorded",
          preferredBackendIds: "runtime_fallback",
          accessMode: "runtime_recorded",
          validationPresetId: "runtime_fallback",
          reviewProfileId: "runtime_fallback",
        },
        sourceTaskId: "task-1",
        sourceRunId: "run-1",
        sourceReviewPackId: null,
        sourceDraft: {
          taskId: "task-1",
          title: "Investigate runtime issue",
          instruction:
            "Investigate runtime issue\n\nInspect runtime orchestration state.\n\nClarify before continuing:\n- What changed?\n- What should stay in bounds?\n- What outcome is required now?",
          intent: "clarify",
          profileId: "operator-review",
          reviewProfileId: null,
          taskSource: null,
          sourceMappingKind: null,
          validationPresetId: "review-first",
          accessMode: "on-request",
          fieldOrigins: {
            executionProfileId: "runtime_recorded",
            preferredBackendIds: "runtime_fallback",
            accessMode: "runtime_recorded",
            validationPresetId: "runtime_fallback",
            reviewProfileId: "runtime_fallback",
          },
        },
        infoMessage: "Run task-1 loaded into the launcher for clarify.",
      },
    });
  });

  it("returns a dedicated switch-profile message while keeping the original brief", () => {
    const result = prepareRuntimeTaskLauncherDraft({
      task: createTask(),
      intent: "switch_profile",
    });

    expect(result).toEqual({
      ok: true,
      draft: expect.objectContaining({
        profileId: "balanced-delegate",
        infoMessage:
          "Run task-1 loaded into the launcher. Choose a new execution profile, then relaunch.",
      }),
    });
  });

  it("keeps relaunch defaults runtime-owned even when a repository mapping exists", () => {
    const result = prepareRuntimeTaskLauncherDraft({
      task: createTask({
        taskSource: {
          kind: "github_issue",
          label: "GitHub issue #1",
          shortLabel: "Issue #1",
          title: "Investigate runtime issue",
          reference: "#1",
          url: "https://github.com/ku0/hugecode/issues/1",
        },
      }),
      intent: "retry",
      repositoryExecutionContract: createRepositoryExecutionContract(),
    });

    expect(result).toEqual({
      ok: true,
      draft: expect.objectContaining({
        profileId: "balanced-delegate",
        reviewProfileId: null,
        validationPresetId: "standard",
        accessMode: "on-request",
        sourceMappingKind: null,
        fieldOrigins: {
          executionProfileId: "runtime_recorded",
          preferredBackendIds: "runtime_fallback",
          accessMode: "runtime_recorded",
          validationPresetId: "runtime_fallback",
          reviewProfileId: "runtime_fallback",
        },
      }),
    });
  });

  it("prepares pair-mode drafts with the existing mission brief", () => {
    const result = prepareRuntimeTaskLauncherDraft({
      task: createTask(),
      intent: "pair_mode",
      sourceRunId: "run-1",
      sourceReviewPackId: "review-pack:run-1",
    });

    expect(result).toEqual({
      ok: true,
      draft: expect.objectContaining({
        intent: "pair_mode",
        instruction: "Investigate runtime issue\n\nInspect runtime orchestration state.",
        profileId: "balanced-delegate",
        infoMessage: "Run task-1 loaded into the launcher for pair-mode escalation.",
        sourceRunId: "run-1",
        sourceReviewPackId: "review-pack:run-1",
      }),
    });
  });

  it("prefers structured relaunch context over replaying the first step output", () => {
    const result = prepareRuntimeTaskLauncherDraft({
      task: createTask({
        relaunchContext: {
          sourceTaskId: "task-1",
          sourceRunId: "run-1",
          sourceReviewPackId: "review-pack:run-1",
          summary: "Retry from runtime-owned relaunch context with validation focus.",
          failureClass: "validation_failed",
          recommendedActions: ["retry", "switch_profile_and_retry"],
        },
      }),
      intent: "retry",
    });

    expect(result).toEqual({
      ok: true,
      draft: expect.objectContaining({
        instruction: "Retry from runtime-owned relaunch context with validation focus.",
        sourceRunId: "run-1",
        sourceReviewPackId: "review-pack:run-1",
      }),
    });
  });

  it("surfaces the existing relaunch error when no reusable brief exists", () => {
    const result = prepareRuntimeTaskLauncherDraft({
      task: createTask({
        title: null,
        steps: [],
        errorMessage: null,
      }),
      intent: "retry",
    });

    expect(result).toEqual({
      ok: false,
      error: "Run task-1 does not have enough context to relaunch from Mission Control.",
    });
  });
});
