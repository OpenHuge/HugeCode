// @vitest-environment jsdom

import type {
  HugeCodeMissionControlSnapshot,
  HugeCodeRunSummary,
  HugeCodeTaskSummary,
} from "@ku0/code-runtime-host-contract";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RuntimeAgentControl } from "../../../application/runtime/types/webMcpBridge";
import { trackProductAnalyticsEvent } from "../../shared/productAnalytics";
import type { WorkspaceInfo } from "../../../types";
import { launchAutoDriveThread } from "../../../application/runtime/facades/runtimeAutoDriveThreadLaunch";
import { useAutoDriveController } from "./useAutoDriveController";

vi.mock("../../shared/productAnalytics", () => ({
  trackProductAnalyticsEvent: vi.fn(async () => undefined),
}));

vi.mock("../../../application/runtime/facades/runtimeAutoDriveThreadLaunch", () => ({
  launchAutoDriveThread: vi.fn(async () => ({ result: { turn: { id: "turn-1" } } })),
}));

const WORKSPACE: WorkspaceInfo = {
  id: "workspace-1",
  name: "Workspace",
  path: "/repo",
  connected: true,
  settings: {
    sidebarCollapsed: false,
  },
};

function createTask(taskId = "thread-1"): HugeCodeTaskSummary {
  return {
    id: taskId,
    workspaceId: "workspace-1",
    title: "AutoDrive task",
    objective: "Ship runtime truth",
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
  };
}

function createRun(overrides: Partial<HugeCodeRunSummary> = {}): HugeCodeRunSummary {
  return {
    id: "run-1",
    taskId: "thread-1",
    workspaceId: "workspace-1",
    state: "running",
    title: "AutoDrive run",
    summary: "Route in progress",
    startedAt: 1,
    finishedAt: null,
    updatedAt: 2,
    currentStepIndex: 0,
    pendingIntervention: null,
    autoDrive: {
      enabled: true,
      destination: {
        title: "Ship runtime truth",
        desiredEndState: ["Runtime-backed controls"],
        doneDefinition: {
          arrivalCriteria: ["Controls work"],
          requiredValidation: ["pnpm validate"],
          waypointIndicators: ["Waypoint status"],
        },
        hardBoundaries: ["No local fallback"],
        routePreference: "balanced",
      },
      budget: {
        maxTokens: 3200,
        maxIterations: 3,
      },
      riskPolicy: {
        minimumConfidence: "medium",
      },
      navigation: {
        activeWaypoint: "Implement runtime facade",
        completedWaypoints: ["Define destination"],
        pendingWaypoints: ["Validate behavior"],
        rerouteCount: 0,
      },
      stop: null,
    },
    ...overrides,
  };
}

function createSnapshot(input: {
  source?: string;
  task?: HugeCodeTaskSummary;
  run?: HugeCodeRunSummary;
}): HugeCodeMissionControlSnapshot {
  return {
    source: input.source ?? "runtime_snapshot_v1",
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
    tasks: [input.task ?? createTask()],
    runs: [input.run ?? createRun()],
    reviewPacks: [],
  } as HugeCodeMissionControlSnapshot;
}

function renderAutoDriveHook(input?: {
  missionControlProjection?: HugeCodeMissionControlSnapshot | null;
  startTask?: RuntimeAgentControl["startTask"];
  interveneTask?: NonNullable<RuntimeAgentControl["interveneTask"]>;
  selectedEffort?: string | null;
  activeThreadId?: string | null;
}) {
  const startTask =
    input?.startTask ??
    (vi.fn().mockResolvedValue({ taskId: "run-2" }) as unknown as RuntimeAgentControl["startTask"]);
  const interveneTask =
    input?.interveneTask ??
    (vi.fn().mockResolvedValue({
      accepted: true,
      outcome: "submitted",
    }) as unknown as NonNullable<RuntimeAgentControl["interveneTask"]>);
  const patchThreadCodexParams = vi.fn();
  const getThreadCodexParams = vi.fn(() => ({
    autoDriveDraft: {
      enabled: true,
      destination: {
        title: "Ship runtime truth",
        endState: "Mission snapshot drives run state",
        doneDefinition: "Start/Pause/Resume/Stop work",
        avoid: "No local .hugecode/runs truth",
        routePreference: "validation_first" as const,
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
        allowNetworkAnalysis: true,
        allowValidationCommands: true,
        minimumConfidence: "medium" as const,
      },
    },
  }));

  const result = renderHook(() =>
    useAutoDriveController({
      activeWorkspace: WORKSPACE,
      activeThreadId:
        input && "activeThreadId" in input ? (input.activeThreadId ?? null) : "thread-1",
      accessMode: "on-request",
      selectedModelId: "gpt-5",
      selectedEffort: input?.selectedEffort ?? "medium",
      missionControlProjection:
        input?.missionControlProjection ?? createSnapshot({ run: createRun() }),
      runtimeControl: {
        startTask,
        interveneTask,
      },
      threadCodexParamsVersion: 1,
      getThreadCodexParams,
      patchThreadCodexParams,
    })
  );

  return {
    ...result,
    startTask,
    interveneTask,
    patchThreadCodexParams,
  };
}

describe("useAutoDriveController", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("launches AutoDrive through the active thread turn with runtime autoDrive payload", async () => {
    const { result, startTask } = renderAutoDriveHook({
      missionControlProjection: createSnapshot({
        run: createRun({
          state: "review_ready",
          updatedAt: 3,
        }),
      }),
    });

    await waitFor(() => {
      expect(result.current.draft.enabled).toBe(true);
    });
    expect(result.current.controls.canStart).toBe(true);

    await act(async () => {
      await result.current.controls.onStart();
    });

    expect(startTask).not.toHaveBeenCalled();
    expect(launchAutoDriveThread).toHaveBeenCalledTimes(1);
    expect(launchAutoDriveThread).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "workspace-1",
        threadId: "thread-1",
        instruction: expect.stringMatching(
          /AutoDrive launch capsule[\s\S]*independent AutoDrive mission[\s\S]*Continuation policy/
        ),
        modelId: "gpt-5",
        reasonEffort: "medium",
        autoDrive: expect.objectContaining({
          destination: expect.objectContaining({
            title: "Ship runtime truth",
            routePreference: "balanced",
          }),
          continuationPolicy: expect.objectContaining({
            enabled: true,
            maxAutomaticFollowUps: 2,
            requireValidationSuccessToStop: true,
            minimumConfidenceToStop: "high",
          }),
          contextPolicy: expect.objectContaining({
            scope: "workspace_graph",
            authoritySources: ["repo_authority", "workspace_graph"],
          }),
          decisionPolicy: expect.objectContaining({
            independentThread: true,
            autonomyPriority: "operator",
            promptStrategy: "workspace_graph_first",
            researchMode: "live_when_allowed",
          }),
        }),
        autonomyRequest: expect.objectContaining({
          autonomyProfile: "night_operator",
          sourceScope: "workspace_graph_and_public_web",
          wakePolicy: expect.objectContaining({
            mode: "auto_queue",
            allowedActions: ["continue", "approve", "clarify", "reroute", "pair", "hold"],
          }),
          researchPolicy: expect.objectContaining({
            mode: "staged",
            requireCitations: true,
          }),
        }),
      })
    );
    expect(trackProductAnalyticsEvent).toHaveBeenCalledWith(
      "delegate_started",
      expect.objectContaining({
        workspaceId: "workspace-1",
        threadId: "thread-1",
        eventSource: "auto_drive",
      })
    );
  });

  it("does not start AutoDrive when no active thread is bound", async () => {
    const { result, startTask } = renderAutoDriveHook({
      activeThreadId: null,
      missionControlProjection: createSnapshot({
        run: createRun({
          state: "review_ready",
          updatedAt: 3,
        }),
      }),
    });

    await act(async () => {
      result.current.setEnabled(true);
      result.current.setDestinationValue("title", "Ship runtime truth");
      result.current.setDestinationValue("endState", "Mission snapshot drives run state");
      result.current.setDestinationValue("doneDefinition", "Start/Pause/Resume/Stop work");
      result.current.setDestinationValue("avoid", "No local .hugecode/runs truth");
    });

    await act(async () => {
      await result.current.controls.onStart();
    });

    expect(result.current.controls.canStart).toBe(false);
    expect(startTask).not.toHaveBeenCalled();
    expect(launchAutoDriveThread).not.toHaveBeenCalled();
  });

  it("routes pause/resume/stop to interveneTask actions", async () => {
    const pauseCase = renderAutoDriveHook({
      missionControlProjection: createSnapshot({ run: createRun({ state: "running" }) }),
    });

    expect(pauseCase.result.current.controls.canPause).toBe(true);
    await act(async () => {
      await pauseCase.result.current.controls.onPause();
    });
    expect(pauseCase.interveneTask).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: "run-1",
        action: "pause",
      })
    );

    const resumeCase = renderAutoDriveHook({
      missionControlProjection: createSnapshot({ run: createRun({ state: "paused" }) }),
    });

    expect(resumeCase.result.current.controls.canResume).toBe(true);
    await act(async () => {
      await resumeCase.result.current.controls.onResume();
    });
    expect(resumeCase.interveneTask).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: "run-1",
        action: "resume",
      })
    );

    await act(async () => {
      await resumeCase.result.current.controls.onStop();
    });
    expect(resumeCase.interveneTask).toHaveBeenLastCalledWith(
      expect.objectContaining({
        taskId: "run-1",
        action: "cancel",
      })
    );
    expect(trackProductAnalyticsEvent).toHaveBeenCalledWith(
      "manual_rescue_invoked",
      expect.objectContaining({
        workspaceId: "workspace-1",
        runId: "run-1",
        interventionKind: "pause",
        eventSource: "auto_drive",
      })
    );
    expect(trackProductAnalyticsEvent).toHaveBeenCalledWith(
      "manual_rescue_invoked",
      expect.objectContaining({
        workspaceId: "workspace-1",
        runId: "run-1",
        interventionKind: "resume",
        eventSource: "auto_drive",
      })
    );
    expect(trackProductAnalyticsEvent).toHaveBeenCalledWith(
      "manual_rescue_invoked",
      expect.objectContaining({
        workspaceId: "workspace-1",
        runId: "run-1",
        interventionKind: "cancel",
        eventSource: "auto_drive",
      })
    );
  });

  it("surfaces runtime recovery state from mission-control snapshot", async () => {
    const { result } = renderAutoDriveHook({
      missionControlProjection: createSnapshot({
        run: createRun({
          state: "paused",
          autoDrive: {
            enabled: true,
            destination: {
              title: "Ship runtime truth",
              desiredEndState: ["Runtime-backed controls"],
              routePreference: "balanced",
            },
            recovery: {
              recovered: true,
              resumeReady: true,
              checkpointId: "checkpoint-1",
              traceId: "trace-1",
              recoveredAt: 20,
              summary: "Runtime recovered AutoDrive from a checkpoint. Resume to continue.",
            },
            navigation: {
              activeWaypoint: "Resume route",
              completedWaypoints: ["Define destination"],
              pendingWaypoints: ["Finish validation"],
              lastProgressAt: 18,
            },
            stop: {
              reason: "paused",
              summary: "Runtime recovered AutoDrive from a checkpoint. Resume to continue.",
              at: 20,
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
            lastProgressAt: 18,
          },
        }),
      }),
    });

    await waitFor(() => {
      expect(result.current.recovering).toBe(true);
      expect(result.current.recoverySummary).toBe(
        "Runtime recovered AutoDrive from a checkpoint. Resume to continue."
      );
    });
  });

  it("warns when network analysis is manually disabled for autodrive", async () => {
    const startTask = vi.fn().mockResolvedValue({ taskId: "run-2" });
    const interveneTask = vi.fn().mockResolvedValue({ accepted: true, outcome: "submitted" });
    const getThreadCodexParams = vi.fn(() => ({
      autoDriveDraft: {
        enabled: true,
        destination: {
          title: "Ship runtime truth",
          endState: "Mission snapshot drives run state",
          doneDefinition: "Start/Pause/Resume/Stop work",
          avoid: "No local .hugecode/runs truth",
          routePreference: "validation_first" as const,
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
          minimumConfidence: "medium" as const,
        },
      },
    }));
    const patchThreadCodexParams = vi.fn();

    const { result } = renderHook(() =>
      useAutoDriveController({
        activeWorkspace: WORKSPACE,
        activeThreadId: "thread-1",
        accessMode: "on-request",
        selectedModelId: "gpt-5",
        selectedEffort: "medium",
        missionControlProjection: createSnapshot({ run: createRun() }),
        runtimeControl: {
          startTask,
          interveneTask,
        },
        threadCodexParamsVersion: 1,
        getThreadCodexParams,
        patchThreadCodexParams,
      })
    );

    await waitFor(() => {
      expect(result.current.draft.enabled).toBe(true);
    });

    expect(result.current.readiness.warnings).toContain(
      "Network analysis is disabled, so AutoDrive cannot benchmark against current external guidance and ecosystem changes."
    );
  });

  it("preserves xhigh reasoning effort when dispatching runtime AutoDrive", async () => {
    const startTask = vi.fn().mockResolvedValue({ taskId: "run-2" });
    const interveneTask = vi.fn().mockResolvedValue({ accepted: true, outcome: "submitted" });
    const { result } = renderAutoDriveHook({
      selectedEffort: "xhigh",
      startTask,
      interveneTask,
      missionControlProjection: createSnapshot({
        run: createRun({
          state: "review_ready",
          updatedAt: 3,
        }),
      }),
    });

    await waitFor(() => {
      expect(result.current.controls.canStart).toBe(true);
    });

    await act(async () => {
      await result.current.controls.onStart();
    });

    expect(launchAutoDriveThread).toHaveBeenCalledWith(
      expect.objectContaining({
        reasonEffort: "xhigh",
      })
    );
  });

  it("keeps runtime controls active when the runtime snapshot contains an active run", async () => {
    const { result, startTask, interveneTask } = renderAutoDriveHook({
      missionControlProjection: createSnapshot({
        run: createRun({ state: "running" }),
      }),
    });

    expect(result.current.controls.canStart).toBe(false);
    expect(result.current.controls.canPause).toBe(true);
    expect(result.current.controls.canResume).toBe(false);
    expect(result.current.controls.canStop).toBe(true);

    await act(async () => {
      await result.current.controls.onPause();
      await result.current.controls.onResume();
      await result.current.controls.onStop();
    });

    expect(startTask).not.toHaveBeenCalled();
    expect(interveneTask).toHaveBeenCalledTimes(3);
    expect(interveneTask).toHaveBeenNthCalledWith(1, expect.objectContaining({ action: "pause" }));
    expect(interveneTask).toHaveBeenNthCalledWith(2, expect.objectContaining({ action: "resume" }));
    expect(interveneTask).toHaveBeenNthCalledWith(3, expect.objectContaining({ action: "cancel" }));
  });

  it("maps runtime run states to view status", () => {
    const cases: Array<[HugeCodeRunSummary["state"], string]> = [
      ["running", "running"],
      ["paused", "paused"],
      ["review_ready", "review_ready"],
      ["failed", "failed"],
      ["cancelled", "cancelled"],
    ];

    for (const [state, expected] of cases) {
      const { result } = renderAutoDriveHook({
        missionControlProjection: createSnapshot({
          run: createRun({ state }),
        }),
      });
      expect(result.current.run?.status).toBe(expected);
    }
  });

  it("surfaces degraded fallback guidance when runtime snapshot mode is unavailable", async () => {
    const { result } = renderAutoDriveHook({
      missionControlProjection: createSnapshot({
        source: "legacy_thread_projection",
        run: createRun({ state: "review_ready" }),
      }),
    });

    await waitFor(() => {
      expect(result.current.controls.canStart).toBe(false);
    });

    expect(result.current.readiness.warnings).toContain(
      "Runtime-managed AutoDrive is unavailable right now. Controls stay blocked until the mission-control snapshot returns."
    );
  });
});
