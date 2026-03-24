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
          scenarioProfile: "browser_repro_fix_verify",
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
      scenarioProfile: expect.objectContaining({
        authorityScope: "workspace_graph",
        scenarioKeys: expect.arrayContaining(["browser_repro_fix_verify"]),
        safeBackground: false,
      }),
    });
  });

  it("preserves the research_route_decide scenario profile in mission drafts and launch briefs", () => {
    const draft = buildMissionDraftFromThreadState({
      objective: "Plan the React 19 migration lane",
      accessMode: "on-request",
      autoDriveDraft: {
        enabled: true,
        scenarioProfile: "research_route_decide",
        destination: {
          title: "Plan the React 19 migration lane",
          endState: "Choose the safest migration route",
          doneDefinition: "Review-ready research memo",
          avoid: "Do not mutate the code yet",
          routePreference: "validation_first",
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
          allowNetworkAnalysis: true,
          allowValidationCommands: true,
          minimumConfidence: "medium",
        },
      },
    });

    expect(draft.autoDrive?.scenarioProfile).toBe("research_route_decide");

    expect(
      buildAgentTaskMissionBrief({
        objective: "Plan the React 19 migration lane",
        accessMode: "on-request",
        autoDriveDraft: draft.autoDrive,
      })
    ).toEqual(
      expect.objectContaining({
        scenarioProfile: expect.objectContaining({
          scenarioKeys: expect.arrayContaining([
            "research_route_decide",
            "source_backed",
            "research_sources_required",
          ]),
          sourceSignals: expect.arrayContaining(["chatgpt_research_route_lab"]),
        }),
      })
    );
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
