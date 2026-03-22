import { describe, expect, it } from "vitest";
import {
  buildAgentTaskMissionBrief,
  buildMissionDraftFromThreadState,
  inferMissionDraftMode,
  normalizePreferredBackendIds,
  toTurnSendMissionMetadata,
} from "./runtimeMissionDraftFacade";

describe("runtimeMissionDraftFacade", () => {
  it("derives delegate mode from autodrive state and normalizes backend ids", () => {
    const draft = buildMissionDraftFromThreadState({
      objective: "Close the runtime mission loop",
      accessMode: "read-only",
      collaborationModeId: "plan",
      executionProfileId: " balanced-delegate ",
      preferredBackendIds: ["backend-a", "backend-a", " ", "backend-b"],
      autoDriveDraft: {
        enabled: true,
        destination: {
          title: "Mission",
          endState: "Review-ready",
          doneDefinition: "All validations pass",
          avoid: "Do not widen scope",
          routePreference: "stability_first",
        },
        budget: {
          maxTokens: 6000,
          maxIterations: 3,
          maxDurationMinutes: 10,
          maxFilesPerIteration: 6,
          maxNoProgressIterations: 2,
          maxValidationFailures: 2,
          maxReroutes: 2,
        },
        riskPolicy: {
          pauseOnDestructiveChange: true,
          pauseOnDependencyChange: true,
          pauseOnLowConfidence: true,
          pauseOnHumanCheckpoint: true,
          allowNetworkAnalysis: false,
          allowValidationCommands: true,
          minimumConfidence: "medium",
        },
      },
    });

    expect(draft.mode).toBe("delegate");
    expect(draft.preferredBackendIds).toEqual(["backend-a", "backend-b"]);
    expect(draft.avoid).toEqual(["Do not widen scope"]);
    expect(toTurnSendMissionMetadata(draft)).toEqual({
      missionMode: "delegate",
      executionProfileId: "balanced-delegate",
      preferredBackendIds: ["backend-a", "backend-b"],
    });
  });

  it("infers pair mode from collaboration or on-request access", () => {
    expect(inferMissionDraftMode({ accessMode: "on-request" })).toBe("pair");
    expect(
      inferMissionDraftMode({
        accessMode: "read-only",
        collaborationModeId: "plan",
      })
    ).toBe("pair");
  });

  it("returns null when backend preference is absent after normalization", () => {
    expect(normalizePreferredBackendIds(null)).toBeNull();
    expect(normalizePreferredBackendIds(["", "  "])).toBeNull();
  });

  it("builds a structured mission brief from autodrive and permission context", () => {
    expect(
      buildAgentTaskMissionBrief({
        objective: "Ship runtime truth",
        accessMode: "on-request",
        preferredBackendIds: ["backend-a", "backend-a", "backend-b"],
        requiredCapabilities: ["review", "review", "plan"],
        maxSubtasks: 3,
        writableRoots: ["/repo/apps/code", "/repo/apps/code"],
        toolNames: ["git", "pnpm", "git"],
        autoDriveDraft: {
          enabled: true,
          destination: {
            title: "Ship runtime truth",
            endState: "Review-ready",
            doneDefinition: "All validations pass",
            avoid: "Do not widen scope",
            routePreference: "stability_first",
          },
          budget: {
            maxTokens: 6000,
            maxIterations: 3,
            maxDurationMinutes: 10,
            maxFilesPerIteration: 6,
            maxNoProgressIterations: 2,
            maxValidationFailures: 2,
            maxReroutes: 2,
          },
          riskPolicy: {
            pauseOnDestructiveChange: true,
            pauseOnDependencyChange: true,
            pauseOnLowConfidence: true,
            pauseOnHumanCheckpoint: true,
            allowNetworkAnalysis: false,
            allowValidationCommands: true,
            minimumConfidence: "medium",
          },
        },
      })
    ).toEqual({
      objective: "Ship runtime truth",
      doneDefinition: ["All validations pass"],
      constraints: ["Do not widen scope"],
      riskLevel: "medium",
      requiredCapabilities: ["review", "plan"],
      maxSubtasks: 3,
      preferredBackendIds: ["backend-a", "backend-b"],
      permissionSummary: {
        accessMode: "on-request",
        allowNetwork: false,
        writableRoots: ["/repo/apps/code"],
        toolNames: ["git", "pnpm"],
      },
    });
  });

  it("infers stronger launch capabilities and bounded subtasks for autodrive when not supplied", () => {
    expect(
      buildAgentTaskMissionBrief({
        objective: "Ship runtime truth",
        accessMode: "on-request",
        autoDriveDraft: {
          enabled: true,
          destination: {
            title: "Ship runtime truth",
            endState: "Runtime-backed controls",
            doneDefinition: "All validations pass",
            avoid: "Do not widen scope",
            routePreference: "validation_first",
          },
          budget: {
            maxTokens: 2800,
            maxIterations: 3,
            maxDurationMinutes: 10,
            maxFilesPerIteration: 5,
            maxNoProgressIterations: 2,
            maxValidationFailures: 2,
            maxReroutes: 2,
          },
          riskPolicy: {
            pauseOnDestructiveChange: true,
            pauseOnDependencyChange: true,
            pauseOnLowConfidence: true,
            pauseOnHumanCheckpoint: true,
            allowNetworkAnalysis: false,
            allowValidationCommands: true,
            minimumConfidence: "medium",
          },
        },
      })
    ).toEqual({
      objective: "Ship runtime truth",
      doneDefinition: ["All validations pass"],
      constraints: ["Do not widen scope"],
      riskLevel: "medium",
      requiredCapabilities: ["code", "validation", "review"],
      maxSubtasks: 2,
      preferredBackendIds: null,
      permissionSummary: {
        accessMode: "on-request",
        allowNetwork: false,
        writableRoots: null,
        toolNames: null,
      },
    });
  });
});
