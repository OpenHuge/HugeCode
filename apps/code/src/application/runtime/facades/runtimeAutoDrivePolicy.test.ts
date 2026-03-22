import { describe, expect, it } from "vitest";
import { decideAutoDriveNextStep } from "./runtimeAutoDrivePolicy";
import type { AutoDriveIterationSummary, AutoDriveRunRecord } from "../types/autoDrive";

function createRun(overrides: Partial<AutoDriveRunRecord> = {}): AutoDriveRunRecord {
  return {
    schemaVersion: "autodrive-run/v2",
    runId: "run-1",
    workspaceId: "workspace-1",
    workspacePath: "/repo",
    threadId: "thread-1",
    status: "deciding_next_step",
    stage: "deciding_next_step",
    destination: {
      title: "Finish AutoDrive navigation",
      desiredEndState: ["UI shows route state"],
      doneDefinition: {
        arrivalCriteria: ["Render route summary"],
        requiredValidation: ["pnpm validate:fast"],
        waypointIndicators: ["Progress"],
      },
      hardBoundaries: [],
      routePreference: "validation_first",
    },
    budget: {
      maxTokens: 1000,
      maxIterations: 3,
      maxDurationMs: 10000,
      maxFilesPerIteration: 5,
      maxNoProgressIterations: 2,
      maxValidationFailures: 2,
      maxReroutes: 1,
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
    iteration: 2,
    totals: {
      consumedTokensEstimate: 1200,
      elapsedMs: 9000,
      validationFailureCount: 2,
      noProgressCount: 1,
      repeatedFailureCount: 0,
      rerouteCount: 0,
    },
    blockers: [],
    completedSubgoals: [],
    summaries: [],
    navigation: {
      destinationSummary: "Finish AutoDrive navigation",
      startStateSummary: "Branch feat/autodrive",
      routeSummary: "baseline -> implement -> validate",
      currentWaypointTitle: "Validate and close the shortest safe route",
      currentWaypointObjective: "Validate the current route.",
      currentWaypointArrivalCriteria: [],
      remainingMilestones: ["Validate the route"],
      currentMilestone: "Validate the route",
      overallProgress: 66,
      waypointCompletion: 100,
      offRoute: false,
      rerouting: false,
      rerouteReason: null,
      remainingBlockers: [],
      arrivalConfidence: "medium",
      stopRisk: "medium",
      remainingTokens: 0,
      remainingIterations: 1,
      remainingDurationMs: 1000,
      lastDecision: null,
    },
    createdAt: 1,
    updatedAt: 1,
    startedAt: 1,
    completedAt: null,
    lastStopReason: null,
    sessionId: "session-1",
    lastValidationSummary: null,
    currentBlocker: null,
    latestReroute: null,
    ...overrides,
  };
}

function createSummary(
  overrides: Partial<AutoDriveIterationSummary> = {}
): AutoDriveIterationSummary {
  return {
    schemaVersion: "autodrive-summary/v2",
    runId: "run-1",
    iteration: 2,
    status: "success",
    taskTitle: "Validate current route",
    summaryText: "Validation failed twice.",
    changedFiles: [],
    blockers: [],
    completedSubgoals: [],
    unresolvedItems: [],
    suggestedNextAreas: [],
    validation: {
      ran: true,
      commands: ["pnpm validate:fast"],
      success: false,
      failures: ["pnpm validate:fast"],
      summary: "validate:fast failed",
    },
    progress: {
      currentMilestone: "Validate the route",
      currentWaypointTitle: "Validate current route",
      completedWaypoints: 2,
      totalWaypoints: 3,
      waypointCompletion: 30,
      overallProgress: 66,
      remainingMilestones: ["Validate the route"],
      remainingBlockers: [],
      remainingDistance: "One milestone remains.",
      arrivalConfidence: "low",
      stopRisk: "high",
    },
    routeHealth: {
      offRoute: true,
      noProgressLoop: false,
      rerouteRecommended: true,
      rerouteReason: "Validation no longer matches the planned route.",
      triggerSignals: ["Validation failed"],
    },
    waypoint: {
      id: "waypoint-2",
      title: "Validate current route",
      status: "missed",
      arrivalCriteriaMet: [],
      arrivalCriteriaMissed: ["pnpm validate:fast"],
    },
    goalReached: false,
    task: {
      taskId: "task-2",
      status: "failed",
      outputExcerpt: "Validation failed",
    },
    reroute: null,
    createdAt: 2,
    ...overrides,
  };
}

describe("decideAutoDriveNextStep", () => {
  it("stops when token budget is exhausted", () => {
    const decision = decideAutoDriveNextStep({
      run: createRun(),
      latestSummary: createSummary({
        routeHealth: {
          offRoute: false,
          noProgressLoop: false,
          rerouteRecommended: false,
          rerouteReason: null,
          triggerSignals: [],
        },
        waypoint: {
          id: "waypoint-2",
          title: "Validate current route",
          status: "arrived",
          arrivalCriteriaMet: ["validate:fast"],
          arrivalCriteriaMissed: [],
        },
      }),
      criticConfidence: "medium",
      hasDestructiveChange: false,
      hasDependencyChange: false,
    });

    expect(decision.action).toBe("stop");
    expect(decision.reason?.code).toBe("token_budget_exhausted");
  });

  it("reroutes when the current waypoint drifted off-route before hard caps are exhausted", () => {
    const decision = decideAutoDriveNextStep({
      run: createRun({
        totals: {
          consumedTokensEstimate: 400,
          elapsedMs: 2000,
          validationFailureCount: 0,
          noProgressCount: 0,
          repeatedFailureCount: 0,
          rerouteCount: 0,
        },
        navigation: {
          ...createRun().navigation,
          stopRisk: "low",
          remainingTokens: 600,
          remainingIterations: 1,
        },
      }),
      latestSummary: createSummary({
        validation: {
          ran: true,
          commands: ["pnpm validate:fast"],
          success: true,
          failures: [],
          summary: "validate:fast passed",
        },
        progress: {
          ...createSummary().progress,
          arrivalConfidence: "medium",
          stopRisk: "medium",
        },
      }),
      criticConfidence: "high",
      hasDestructiveChange: false,
      hasDependencyChange: false,
    });

    expect(decision.action).toBe("reroute");
    expect(decision.reroute?.reason).toContain("Validation no longer matches");
  });

  it("pauses for review instead of rerouting when a historically failed publish corridor drifts again", () => {
    const decision = decideAutoDriveNextStep({
      run: createRun({
        totals: {
          consumedTokensEstimate: 400,
          elapsedMs: 2000,
          validationFailureCount: 0,
          noProgressCount: 0,
          repeatedFailureCount: 0,
          rerouteCount: 0,
        },
        navigation: {
          ...createRun().navigation,
          stopRisk: "medium",
          remainingTokens: 600,
          remainingIterations: 1,
        },
      }),
      latestSummary: createSummary({
        validation: {
          ran: true,
          commands: ["pnpm validate:fast"],
          success: true,
          failures: [],
          summary: "validate:fast passed",
        },
        progress: {
          ...createSummary().progress,
          arrivalConfidence: "medium",
          stopRisk: "medium",
        },
      }),
      criticConfidence: "high",
      hasDestructiveChange: false,
      hasDependencyChange: false,
      executionTuning: {
        summary: "Prior matching publish attempts failed and this corridor drifted again.",
        reasons: ["historical_publish_failure"],
        effectiveMaxFilesPerIteration: 3,
        validationCommandPreference: "fast",
        publishPriority: "prepare_branch",
        cautionLevel: "high",
      },
    });

    expect(decision.action).toBe("pause");
    expect(decision.reason?.code).toBe("unsafe_route_requires_review");
  });

  it("continues on a proven publish corridor when critic confidence is solid and validation is green", () => {
    const decision = decideAutoDriveNextStep({
      run: createRun({
        totals: {
          consumedTokensEstimate: 400,
          elapsedMs: 2000,
          validationFailureCount: 0,
          noProgressCount: 0,
          repeatedFailureCount: 0,
          rerouteCount: 0,
        },
        riskPolicy: {
          ...createRun().riskPolicy,
          minimumConfidence: "medium",
        },
        navigation: {
          ...createRun().navigation,
          stopRisk: "low",
          remainingTokens: 600,
          remainingIterations: 1,
        },
      }),
      latestSummary: createSummary({
        validation: {
          ran: true,
          commands: ["pnpm validate:fast"],
          success: true,
          failures: [],
          summary: "validate:fast passed",
        },
        progress: {
          ...createSummary().progress,
          arrivalConfidence: "low",
          stopRisk: "low",
        },
        routeHealth: {
          offRoute: false,
          noProgressLoop: false,
          rerouteRecommended: false,
          rerouteReason: null,
          triggerSignals: [],
        },
        waypoint: {
          id: "waypoint-2",
          title: "Validate current route",
          status: "arrived",
          arrivalCriteriaMet: ["pnpm validate:fast"],
          arrivalCriteriaMissed: [],
        },
      }),
      criticConfidence: "medium",
      hasDestructiveChange: false,
      hasDependencyChange: false,
      executionTuning: {
        summary: "A proven publish corridor is active.",
        reasons: ["historical_publish_corridor"],
        effectiveMaxFilesPerIteration: 3,
        validationCommandPreference: "fast",
        publishPriority: "push_candidate",
        cautionLevel: "elevated",
      },
    });

    expect(decision.action).toBe("continue");
    expect(decision.reason).toBeNull();
  });
});
