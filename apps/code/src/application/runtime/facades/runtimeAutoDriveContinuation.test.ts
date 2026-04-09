import { describe, expect, it } from "vitest";
import {
  buildContinuationReason,
  resolveStoppedContinuationState,
} from "./runtimeAutoDriveContinuation";
import type { AutoDriveIterationSummary, AutoDriveRunRecord } from "../types/autoDrive";

function createRun(): AutoDriveRunRecord {
  return {
    schemaVersion: "autodrive-run/v2",
    runId: "run-1",
    workspaceId: "workspace-1",
    workspacePath: "/tmp/workspace-1",
    threadId: "thread-1",
    status: "running",
    stage: "validating_result",
    destination: {
      title: "Ship runtime truth",
      desiredEndState: [],
      doneDefinition: {
        arrivalCriteria: ["Controls work"],
        requiredValidation: [],
        waypointIndicators: [],
      },
      hardBoundaries: [],
      routePreference: "stability_first",
    },
    budget: {
      maxTokens: 4000,
      maxIterations: 3,
      maxDurationMs: 300000,
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
      allowNetworkAnalysis: true,
      allowValidationCommands: true,
      allowChatgptDecisionLab: true,
      autoRunChatgptDecisionLab: true,
      chatgptDecisionLabMinConfidence: "medium",
      chatgptDecisionLabMaxScoreGap: 8,
      minimumConfidence: "medium",
    },
    continuationPolicy: {
      enabled: true,
      maxAutomaticFollowUps: 2,
      requireValidationSuccessToStop: true,
      minimumConfidenceToStop: "high",
    },
    continuationState: {
      automaticFollowUpCount: 1,
      status: "continuing",
      lastContinuationAt: 12,
      lastContinuationReason: "pending",
    },
    summaries: [],
    blockers: [],
    completedSubgoals: [],
    totals: {
      consumedTokensEstimate: 100,
      elapsedMs: 1000,
      validationFailureCount: 0,
      noProgressCount: 0,
      repeatedFailureCount: 0,
      rerouteCount: 0,
    },
    currentBlocker: null,
    sessionId: null,
    execution: null,
    iteration: 1,
    createdAt: 1,
    updatedAt: 20,
    startedAt: 1,
    completedAt: null,
    lastStopReason: null,
    latestReroute: null,
    navigation: {
      destinationSummary: "Ship runtime truth",
      startStateSummary: null,
      routeSummary: null,
      currentWaypointTitle: "Validate",
      currentWaypointObjective: null,
      currentWaypointArrivalCriteria: [],
      waypointStatus: "active",
      remainingMilestones: [],
      currentMilestone: "Validate",
      overallProgress: 50,
      waypointCompletion: 50,
      offRoute: false,
      rerouting: false,
      rerouteReason: null,
      remainingBlockers: [],
      arrivalConfidence: "medium",
      stopRisk: "low",
      remainingTokens: 3000,
      remainingIterations: 2,
      remainingDurationMs: 200000,
      lastDecision: null,
    },
    runtimeDecisionTrace: null,
    lastChatgptDecisionLab: null,
  };
}

function createSummary(): AutoDriveIterationSummary {
  return {
    schemaVersion: "autodrive-summary/v2",
    runId: "run-1",
    iteration: 1,
    status: "success",
    taskTitle: "Validate",
    summaryText: "Validation pending",
    changedFiles: [],
    blockers: [],
    completedSubgoals: [],
    unresolvedItems: [],
    suggestedNextAreas: [],
    validation: {
      ran: true,
      commands: ["pnpm validate:fast"],
      success: null,
      failures: [],
      summary: "Validation pending",
    },
    progress: {
      currentMilestone: "Validate",
      currentWaypointTitle: "Validate",
      completedWaypoints: 1,
      totalWaypoints: 2,
      waypointCompletion: 50,
      overallProgress: 50,
      remainingMilestones: ["Review"],
      remainingBlockers: [],
      remainingDistance: "One milestone left",
      arrivalConfidence: "medium",
      stopRisk: "medium",
    },
    routeHealth: {
      offRoute: false,
      noProgressLoop: false,
      rerouteRecommended: false,
      rerouteReason: null,
      triggerSignals: [],
    },
    waypoint: {
      id: "validate",
      title: "Validate",
      status: "arrived",
      arrivalCriteriaMet: [],
      arrivalCriteriaMissed: [],
    },
    goalReached: false,
    task: {
      taskId: "task-1",
      status: "running",
      outputExcerpt: "Validation pending",
    },
    reroute: null,
    createdAt: 20,
  };
}

describe("runtimeAutoDriveContinuation", () => {
  it("explains why continuation cannot stop when validation is still pending", () => {
    expect(buildContinuationReason(createRun(), createSummary())).toContain(
      "Validation is still pending"
    );
  });

  it("marks continuation as stopped while preserving prior metadata", () => {
    const continuationState = resolveStoppedContinuationState(createRun(), 50);

    expect(continuationState?.status).toBe("stopped");
    expect(continuationState?.automaticFollowUpCount).toBe(1);
    expect(continuationState?.lastContinuationReason).toBe("pending");
  });
});
