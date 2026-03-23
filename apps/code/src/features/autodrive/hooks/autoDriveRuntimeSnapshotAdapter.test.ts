import type {
  HugeCodeMissionControlSnapshot,
  HugeCodeRunSummary,
  HugeCodeTaskSummary,
} from "@ku0/code-runtime-host-contract";
import { describe, expect, it } from "vitest";
import {
  fromRuntimeRoutePreference,
  mapDraftToRuntimeAutoDriveState,
  selectAutoDriveSnapshot,
} from "./autoDriveRuntimeSnapshotAdapter";

function createTask(overrides: Partial<HugeCodeTaskSummary> = {}): HugeCodeTaskSummary {
  return {
    id: "thread-1",
    workspaceId: "workspace-1",
    title: "Task",
    objective: "Task objective",
    origin: {
      kind: "thread",
      threadId: "thread-1",
      runId: "run-1",
      requestId: null,
    },
    taskSource: null,
    mode: "delegate",
    modeSource: "execution_profile",
    status: "running",
    createdAt: 1,
    updatedAt: 2,
    currentRunId: "run-1",
    latestRunId: "run-1",
    latestRunState: "running",
    nextAction: null,
    ...overrides,
  };
}

function createRun(overrides: Partial<HugeCodeRunSummary> = {}): HugeCodeRunSummary {
  return {
    id: "run-1",
    taskId: "thread-1",
    workspaceId: "workspace-1",
    state: "running",
    title: "Run",
    summary: "Route in progress",
    startedAt: 1,
    finishedAt: null,
    updatedAt: 2,
    currentStepIndex: 0,
    pendingIntervention: null,
    autoDrive: {
      enabled: true,
      destination: {
        title: "Ship runtime migration",
        desiredEndState: ["Runtime truth"],
        doneDefinition: {
          arrivalCriteria: ["Controls wired"],
          requiredValidation: ["pnpm validate"],
          waypointIndicators: ["Waypoint"],
        },
        hardBoundaries: ["No local fallback"],
        routePreference: "balanced",
      },
      budget: {
        maxTokens: 2000,
        maxIterations: 3,
      },
      riskPolicy: {
        minimumConfidence: "medium",
      },
      navigation: {
        activeWaypoint: "Implement controller",
        completedWaypoints: ["Define destination"],
        pendingWaypoints: ["Validate"],
        rerouteCount: 1,
      },
      scenarioProfile: {
        authorityScope: "workspace_graph",
        scenarioKeys: ["validation-recovery"],
        representativeCommands: ["pnpm test"],
        safeBackground: false,
      },
      decisionTrace: {
        summary: "Launch uses workspace graph and representative eval lane.",
        selectedCandidateId: "launch_autodrive",
      },
      outcomeFeedback: {
        status: "launch_prepared",
        summary: "Runtime prepared AutoDrive launch context.",
      },
      autonomyState: {
        independentThread: true,
        highPriority: true,
        escalationPressure: "medium",
      },
      stop: null,
    },
    ...overrides,
  };
}

function createSnapshot(input?: {
  source?: HugeCodeMissionControlSnapshot["source"];
  tasks?: HugeCodeTaskSummary[];
  runs?: HugeCodeRunSummary[];
}): HugeCodeMissionControlSnapshot {
  return {
    source: input?.source ?? "runtime_snapshot_v1",
    generatedAt: 2,
    workspaces: [
      {
        id: "workspace-1",
        name: "Workspace",
        rootPath: "/repo",
        connected: true,
        defaultProfileId: null,
      },
    ],
    tasks: input?.tasks ?? [createTask()],
    runs: input?.runs ?? [createRun()],
    reviewPacks: [],
  };
}

describe("autoDriveRuntimeSnapshotAdapter", () => {
  it("selects active run by thread binding and latest updatedAt", () => {
    const snapshot = createSnapshot({
      tasks: [
        createTask({
          id: "thread-1",
          origin: { kind: "thread", threadId: "thread-1", runId: "run-2", requestId: null },
        }),
        createTask({
          id: "thread-2",
          origin: { kind: "thread", threadId: "thread-2", runId: "other-run", requestId: null },
        }),
      ],
      runs: [
        createRun({ id: "run-1", taskId: "thread-1", updatedAt: 5 }),
        createRun({ id: "run-2", taskId: "thread-1", updatedAt: 9 }),
        createRun({ id: "other-run", taskId: "thread-2", updatedAt: 99 }),
      ],
    });

    const selected = selectAutoDriveSnapshot({
      missionControlProjection: snapshot,
      workspaceId: "workspace-1",
      threadId: "thread-1",
    });

    expect(selected.run?.id).toBe("run-2");
    expect(selected.runtimeTaskId).toBe("run-2");
    expect(selected.adaptedRun?.runId).toBe("run-2");
  });

  it("maps navigation and stop fields with sensible defaults", () => {
    const snapshot = createSnapshot({
      runs: [
        createRun({
          state: "review_ready",
          updatedAt: 8,
          autoDrive: {
            enabled: true,
            destination: {
              title: "Ship runtime migration",
              desiredEndState: [],
              routePreference: "balanced",
            },
            budget: {},
            riskPolicy: {},
            navigation: {
              completedWaypoints: ["Define destination", "Implement controller"],
              pendingWaypoints: [],
            },
            stop: {
              reason: "completed",
              summary: "All waypoints reached.",
              at: 8,
            },
          },
        }),
      ],
    });

    const selected = selectAutoDriveSnapshot({
      missionControlProjection: snapshot,
      workspaceId: "workspace-1",
      threadId: "thread-1",
    });

    expect(selected.adaptedRun?.status).toBe("review_ready");
    expect(selected.adaptedRun?.navigation.destinationSummary).toBe("Ship runtime migration");
    expect(selected.adaptedRun?.navigation.currentWaypointTitle).toBeNull();
    expect(selected.adaptedRun?.navigation.remainingMilestones).toEqual([]);
    expect(selected.adaptedRun?.navigation.overallProgress).toBe(100);
    expect(selected.adaptedRun?.lastStopReason?.detail).toBe("All waypoints reached.");
  });

  it("prefers runtime-native decision and autonomy state when adapting runs", () => {
    const snapshot = createSnapshot();

    const selected = selectAutoDriveSnapshot({
      missionControlProjection: snapshot,
      workspaceId: "workspace-1",
      threadId: "thread-1",
    });

    expect(selected.adaptedRun?.navigation.lastDecision).toBe(
      "Launch uses workspace graph and representative eval lane."
    );
    expect(selected.adaptedRun?.currentBlocker).toBe("Runtime prepared AutoDrive launch context.");
    expect(selected.adaptedRun?.navigation.stopRisk).toBe("medium");
  });

  it("does not fall back to a standalone autodrive run when a thread is selected", () => {
    const snapshot = createSnapshot({
      tasks: [
        createTask({
          id: "autodrive-task-1",
          origin: {
            kind: "run",
            threadId: null,
            runId: "run-standalone",
            requestId: null,
          },
          taskSource: {
            kind: "autodrive",
            label: "AutoDrive Mission Control",
            shortLabel: "AutoDrive",
            externalId: "autodrive:workspace-1",
            workspaceId: "workspace-1",
            workspaceRoot: "/repo",
          },
          currentRunId: "run-standalone",
          latestRunId: "run-standalone",
          latestRunState: "running",
        }),
      ],
      runs: [
        createRun({
          id: "run-standalone",
          taskId: "autodrive-task-1",
          updatedAt: 7,
        }),
      ],
    });

    const selected = selectAutoDriveSnapshot({
      missionControlProjection: snapshot,
      workspaceId: "workspace-1",
      threadId: "thread-missing",
    });

    expect(selected.task).toBeNull();
    expect(selected.run).toBeNull();
    expect(selected.runtimeTaskId).toBeNull();
    expect(selected.adaptedRun).toBeNull();
  });

  it("falls back to the latest standalone autodrive run only when no thread is selected", () => {
    const snapshot = createSnapshot({
      tasks: [
        createTask({
          id: "autodrive-task-1",
          origin: {
            kind: "run",
            threadId: null,
            runId: "run-standalone",
            requestId: null,
          },
          taskSource: {
            kind: "autodrive",
            label: "AutoDrive Mission Control",
            shortLabel: "AutoDrive",
            externalId: "autodrive:workspace-1",
            workspaceId: "workspace-1",
            workspaceRoot: "/repo",
          },
          currentRunId: "run-standalone",
          latestRunId: "run-standalone",
          latestRunState: "running",
        }),
      ],
      runs: [
        createRun({
          id: "run-standalone",
          taskId: "autodrive-task-1",
          updatedAt: 7,
        }),
      ],
    });

    const selected = selectAutoDriveSnapshot({
      missionControlProjection: snapshot,
      workspaceId: "workspace-1",
      threadId: null,
    });

    expect(selected.task?.id).toBe("autodrive-task-1");
    expect(selected.run?.id).toBe("run-standalone");
    expect(selected.runtimeTaskId).toBe("run-standalone");
    expect(selected.adaptedRun?.threadId).toBeNull();
  });

  it("derives elapsed runtime fields from snapshot timestamps without inventing token usage", () => {
    const snapshot = createSnapshot({
      runs: [
        createRun({
          startedAt: 1_000,
          updatedAt: 6_000,
          autoDrive: {
            enabled: true,
            destination: {
              title: "Ship runtime migration",
              desiredEndState: ["Runtime truth"],
              doneDefinition: {
                arrivalCriteria: ["Review pack published"],
                requiredValidation: ["pnpm validate"],
                waypointIndicators: ["Waypoint"],
              },
              routePreference: "balanced",
            },
            budget: {
              maxTokens: 2000,
              maxIterations: 4,
              maxDurationMs: 10_000,
            },
            riskPolicy: {
              minimumConfidence: "medium",
            },
            navigation: {
              activeWaypoint: "Publish review pack",
              completedWaypoints: ["Collect evidence"],
              pendingWaypoints: ["Finalize handoff"],
              validationFailureCount: 2,
            },
            stop: null,
          },
        }),
      ],
    });

    const selected = selectAutoDriveSnapshot({
      missionControlProjection: snapshot,
      workspaceId: "workspace-1",
      threadId: "thread-1",
    });

    expect(selected.adaptedRun?.totals.elapsedMs).toBe(5_000);
    expect(selected.adaptedRun?.navigation.remainingDurationMs).toBe(5_000);
    expect(selected.adaptedRun?.navigation.remainingTokens).toBeNull();
    expect(selected.adaptedRun?.navigation.currentWaypointObjective).toBe(
      "Advance waypoint: Publish review pack."
    );
    expect(selected.adaptedRun?.navigation.currentWaypointArrivalCriteria).toEqual([
      "Review pack published",
    ]);
    expect(selected.adaptedRun?.totals.validationFailureCount).toBe(2);
  });

  it("surfaces runtime recovery markers without reconstructing local recovery state", () => {
    const snapshot = createSnapshot({
      runs: [
        createRun({
          state: "paused",
          autoDrive: {
            enabled: true,
            destination: {
              title: "Ship runtime migration",
              desiredEndState: ["Runtime truth"],
              routePreference: "balanced",
            },
            recovery: {
              recovered: true,
              resumeReady: true,
              checkpointId: "checkpoint-1",
              traceId: "trace-1",
              recoveredAt: 9,
              summary: "Runtime recovered AutoDrive from a checkpoint. Resume to continue.",
            },
            navigation: {
              activeWaypoint: "Resume route",
              completedWaypoints: ["Collect evidence"],
              pendingWaypoints: ["Finish review pack"],
              lastProgressAt: 8,
            },
            stop: {
              reason: "paused",
              summary: "Runtime recovered AutoDrive from a checkpoint. Resume to continue.",
              at: 9,
            },
          },
          ledger: {
            traceId: "trace-1",
            checkpointId: "checkpoint-1",
            recovered: true,
            stepCount: 2,
            completedStepCount: 1,
            warningCount: 0,
            validationCount: 0,
            artifactCount: 0,
            evidenceState: "incomplete",
            backendId: null,
            routeLabel: null,
            completionReason: null,
            lastProgressAt: 8,
          },
        }),
      ],
    });

    const selected = selectAutoDriveSnapshot({
      missionControlProjection: snapshot,
      workspaceId: "workspace-1",
      threadId: "thread-1",
    });

    expect(selected.recovering).toBe(true);
    expect(selected.recoverySummary).toBe(
      "Runtime recovered AutoDrive from a checkpoint. Resume to continue."
    );
    expect(selected.adaptedRun?.lastStopReason?.detail).toBe(
      "Runtime recovered AutoDrive from a checkpoint. Resume to continue."
    );
  });

  it("normalizes balanced route preference to UI-safe semantics", () => {
    expect(fromRuntimeRoutePreference("balanced")).toBe("validation_first");
  });

  it("maps draft route preference to runtime balanced/speed/stability", () => {
    const payload = mapDraftToRuntimeAutoDriveState({
      enabled: true,
      scenarioProfile: "browser_repro_fix_verify",
      destination: {
        title: "Ship runtime migration",
        endState: "Runtime truth",
        doneDefinition: "Controls are runtime-backed",
        avoid: "No fallback",
        routePreference: "docs_first",
      },
      budget: {
        maxTokens: 1200,
        maxIterations: 2,
        maxDurationMinutes: 5,
        maxFilesPerIteration: 3,
        maxNoProgressIterations: 1,
        maxValidationFailures: 1,
        maxReroutes: 1,
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
    });

    expect(payload.destination.routePreference).toBe("balanced");
    expect(payload.scenarioProfile).toEqual(
      expect.objectContaining({
        authorityScope: "workspace_graph",
        scenarioKeys: expect.arrayContaining(["browser_repro_fix_verify"]),
        safeBackground: false,
      })
    );
    expect(payload.riskPolicy).toEqual({
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
    });
  });
});
