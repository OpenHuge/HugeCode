import { describe, expect, it } from "vitest";
import { buildAutoDrivePublishHandoff } from "./runtimeAutoDrivePublishHandoff";
import type { AutoDriveIterationSummary, AutoDriveRunRecord } from "../types/autoDrive";

function createRun(): AutoDriveRunRecord {
  return {
    schemaVersion: "autodrive-run/v2",
    runId: "run-123",
    workspaceId: "workspace-1",
    workspacePath: "/repo",
    threadId: "thread-1",
    status: "completed",
    stage: "completed",
    destination: {
      title: "Ship AutoDrive publish flow",
      desiredEndState: ["Route reaches push candidate", "Operator receives review handoff"],
      doneDefinition: {
        arrivalCriteria: ["Push candidate succeeds"],
        requiredValidation: ["pnpm validate:fast"],
        waypointIndicators: ["publish outcome"],
      },
      hardBoundaries: ["No direct merge automation"],
      routePreference: "validation_first",
    },
    budget: {
      maxTokens: 10000,
      maxIterations: 3,
      maxDurationMs: 600000,
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
    iteration: 1,
    totals: {
      consumedTokensEstimate: 1000,
      elapsedMs: 1000,
      validationFailureCount: 0,
      noProgressCount: 0,
      repeatedFailureCount: 0,
      rerouteCount: 0,
    },
    blockers: [],
    completedSubgoals: [],
    summaries: [],
    navigation: {
      destinationSummary: "Ship AutoDrive publish flow",
      startStateSummary: null,
      routeSummary: null,
      currentWaypointTitle: null,
      currentWaypointObjective: null,
      currentWaypointArrivalCriteria: [],
      remainingMilestones: [],
      currentMilestone: null,
      overallProgress: 100,
      waypointCompletion: 100,
      offRoute: false,
      rerouting: false,
      rerouteReason: null,
      remainingBlockers: [],
      arrivalConfidence: "high",
      stopRisk: "low",
      remainingTokens: 9000,
      remainingIterations: 2,
      remainingDurationMs: 500000,
      lastDecision: "goal_reached",
    },
    createdAt: 1,
    updatedAt: 2,
    startedAt: 1,
    completedAt: 2,
    lastStopReason: { code: "goal_reached", detail: "Destination reached." },
    sessionId: "session-1",
    lastValidationSummary: "validate:fast passed",
    latestPublishOutcome: {
      mode: "push_candidate",
      status: "completed",
      summary: "Pushed isolated publish candidate branch autodrive/ship-flow-202603151010-run123.",
      commitMessage: "feat(autodrive): ship publish flow",
      branchName: "autodrive/ship-flow-202603151010-run123",
      pushed: true,
      createdAt: 2,
    },
  };
}

function createSummary(): AutoDriveIterationSummary {
  return {
    schemaVersion: "autodrive-summary/v2",
    runId: "run-123",
    iteration: 1,
    status: "success",
    taskTitle: "Ship publish candidate",
    summaryText: "Pushed isolated publish candidate branch and validated route.",
    changedFiles: ["apps/code/src/application/runtime/facades/runtimeAutoDriveController.ts"],
    blockers: [],
    completedSubgoals: ["publish_candidate_created"],
    unresolvedItems: [],
    suggestedNextAreas: [],
    validation: {
      ran: true,
      commands: ["pnpm validate:fast"],
      success: true,
      failures: [],
      summary: "All validation commands completed successfully.",
    },
    progress: {
      currentMilestone: "ship",
      currentWaypointTitle: "Ship publish candidate",
      completedWaypoints: 1,
      totalWaypoints: 1,
      waypointCompletion: 100,
      overallProgress: 100,
      remainingMilestones: [],
      remainingBlockers: [],
      remainingDistance: "Destination reached.",
      arrivalConfidence: "high",
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
      id: "ship",
      title: "Ship publish candidate",
      status: "arrived",
      arrivalCriteriaMet: ["Push candidate succeeds"],
      arrivalCriteriaMissed: [],
    },
    goalReached: true,
    task: {
      taskId: "task-1",
      status: "completed",
      outputExcerpt: "Publish candidate pushed.",
    },
    reroute: null,
    createdAt: 2,
  };
}

describe("runtimeAutoDrivePublishHandoff", () => {
  it("builds publish handoff artifacts for successful push candidates", () => {
    const artifact = buildAutoDrivePublishHandoff({
      run: createRun(),
      latestSummary: createSummary(),
    });

    expect(artifact).not.toBeNull();
    expect(artifact?.handoff.publish.branchName).toBe("autodrive/ship-flow-202603151010-run123");
    expect(artifact?.handoff.reviewDraft.title).toContain("Ship AutoDrive publish flow");
    expect(artifact?.handoff.operatorCommands[0]).toContain("gh pr create");
    expect(artifact?.handoff.operatorCommands[0]).toContain("publish/pr-body.md");
    expect(artifact?.markdown).toContain("# AutoDrive Publish Handoff");
    expect(artifact?.markdown).toContain("autodrive/ship-flow-202603151010-run123");
    expect(artifact?.markdown).toContain("## Operator Commands");
  });

  it("skips handoff artifacts when the publish outcome is not a successful push candidate", () => {
    const run = createRun();
    run.latestPublishOutcome = {
      mode: "branch_only",
      status: "completed",
      summary: "Created local commit candidate.",
      commitMessage: "feat(autodrive): local candidate",
      branchName: null,
      pushed: false,
      createdAt: 2,
    };

    const artifact = buildAutoDrivePublishHandoff({
      run,
      latestSummary: createSummary(),
    });

    expect(artifact).toBeNull();
  });
});
