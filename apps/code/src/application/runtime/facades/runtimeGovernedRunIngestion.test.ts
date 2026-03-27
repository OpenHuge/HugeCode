import { describe, expect, it } from "vitest";
import type { RuntimeAutonomyRequestV2 } from "@ku0/code-runtime-host-contract";
import { parseRepositoryExecutionContract } from "./runtimeRepositoryExecutionContract";
import { buildGovernedRuntimeRunRequest } from "./runtimeGovernedRunIngestion";
import { buildManualTaskSource, buildScheduleTaskSource } from "./runtimeTaskSourceFacade";

function createContract() {
  return parseRepositoryExecutionContract(
    JSON.stringify({
      version: 1,
      defaults: {
        executionProfileId: "balanced-delegate",
        preferredBackendIds: ["backend-default"],
        reviewProfileId: "default-review",
        validationPresetId: "standard",
        accessMode: "on-request",
      },
      defaultReviewProfileId: "default-review",
      sourceMappings: {
        schedule: {
          executionProfileId: "operator-review",
          preferredBackendIds: ["backend-schedule"],
          reviewProfileId: "schedule-review",
          validationPresetId: "review-first",
          accessMode: "read-only",
        },
      },
      validationPresets: [
        { id: "standard", commands: ["pnpm validate"] },
        { id: "review-first", commands: ["pnpm validate:fast"] },
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
          id: "schedule-review",
          label: "Schedule Review",
          allowedSkillIds: ["review-agent"],
          validationPresetId: "review-first",
          autofixPolicy: "manual",
          githubMirrorPolicy: "summary",
        },
      ],
    })
  );
}

describe("runtimeGovernedRunIngestion", () => {
  it("builds a manual governed request from shared defaults and explicit profile fallback", () => {
    const request = buildGovernedRuntimeRunRequest({
      workspaceId: "ws-1",
      source: {
        title: "Inspect runtime ingress",
        instruction: "Inspect runtime ingress",
        taskSource: buildManualTaskSource({
          workspaceId: "ws-1",
          title: "Inspect runtime ingress",
        }),
      },
      repositoryExecutionContract: createContract(),
      explicitLaunchInput: {
        executionProfileId: "balanced-delegate",
      },
      fallbackExecutionProfileId: "balanced-delegate",
      fallbackValidationPresetId: "standard",
      fallbackAccessMode: "on-request",
      provider: "provider-route",
    });

    expect(request).toEqual(
      expect.objectContaining({
        workspaceId: "ws-1",
        title: "Inspect runtime ingress",
        executionProfileId: "balanced-delegate",
        reviewProfileId: "default-review",
        validationPresetId: "standard",
        accessMode: "on-request",
        executionMode: "single",
        preferredBackendIds: ["backend-default"],
        provider: "provider-route",
        taskSource: expect.objectContaining({
          kind: "manual",
          workspaceId: "ws-1",
        }),
      })
    );
  });

  it("builds a schedule governed request with source mapping, provenance, and autonomy policy", () => {
    const autonomyRequest: RuntimeAutonomyRequestV2 = {
      autonomyProfile: "night_operator",
      sourceScope: "workspace_graph",
      queueBudget: {
        maxQueuedActions: 2,
        maxAutoContinuations: 2,
      },
      wakePolicy: {
        mode: "auto_queue",
        safeFollowUp: true,
        allowAutomaticContinuation: true,
        allowedActions: ["continue", "approve", "hold"],
        stopGates: ["validation_failure_requires_review"],
      },
      researchPolicy: {
        mode: "repository_only",
        allowNetworkAnalysis: false,
        requireCitations: true,
        allowPrivateContextStage: false,
      },
    };

    const request = buildGovernedRuntimeRunRequest({
      workspaceId: "ws-1",
      source: {
        title: "Nightly review",
        instruction: "Inspect repo drift",
        taskSource: buildScheduleTaskSource({
          scheduleId: "schedule-1",
          title: "Nightly review",
          workspaceId: "ws-1",
        }),
        autonomyRequest,
      },
      repositoryExecutionContract: createContract(),
      fallbackExecutionProfileId: "balanced-delegate",
    });

    expect(request).toEqual(
      expect.objectContaining({
        workspaceId: "ws-1",
        title: "Nightly review",
        executionProfileId: "operator-review",
        reviewProfileId: "schedule-review",
        validationPresetId: "review-first",
        accessMode: "read-only",
        executionMode: "single",
        preferredBackendIds: ["backend-schedule"],
        autonomyRequest,
        taskSource: expect.objectContaining({
          kind: "schedule",
          externalId: "schedule-1",
          canonicalUrl: "schedule://schedule-1",
          sourceTaskId: "schedule-1",
          sourceRunId: "schedule-1",
        }),
      })
    );
  });
});
