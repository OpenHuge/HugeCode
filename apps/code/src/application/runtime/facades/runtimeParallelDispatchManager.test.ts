import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RuntimeRunStartRequest, RuntimeRunStartV2Response } from "../ports/runtimeClient";
import type { RuntimeAgentTaskSummary } from "../types/webMcpBridge";
import {
  createRuntimeParallelDispatchManager,
  parseRuntimeParallelDispatchPlan,
  readRuntimeParallelDispatchPlanLaunchError,
} from "./runtimeParallelDispatchManager";

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return {
    promise,
    resolve,
    reject,
  };
}

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

async function waitForAssertion(assertion: () => void) {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      assertion();
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }
  throw lastError;
}

function createRuntimeRunRecord(
  taskId: string,
  overrides: Partial<RuntimeRunStartV2Response["run"]> = {}
): RuntimeRunStartV2Response {
  return {
    run: {
      taskId,
      workspaceId: "ws-1",
      threadId: null,
      requestId: null,
      title: taskId,
      status: "queued",
      accessMode: "on-request",
      provider: null,
      modelId: null,
      routedProvider: null,
      routedModelId: null,
      routedPool: null,
      routedSource: null,
      backendId: null,
      preferredBackendIds: null,
      currentStep: null,
      createdAt: 10,
      updatedAt: 10,
      startedAt: 10,
      completedAt: null,
      errorCode: null,
      errorMessage: null,
      pendingApprovalId: null,
      steps: [],
      ...overrides,
    },
    missionRun: {
      id: taskId,
      taskId,
      workspaceId: "ws-1",
      state: "queued",
      title: overrides.title ?? taskId,
      summary: null,
      taskSource: null,
      startedAt: 10,
      finishedAt: null,
      updatedAt: 10,
      currentStepIndex: null,
      pendingIntervention: null,
      executionProfile: null,
      reviewProfileId: null,
      profileReadiness: null,
      routing: null,
      approval: null,
      reviewDecision: null,
      intervention: null,
      operatorState: null,
      nextAction: null,
      warnings: [],
      validations: [],
      artifacts: [],
      changedPaths: [],
      autoDrive: null,
      takeoverBundle: null,
      publishHandoff: null,
      checkpoint: null,
      missionLinkage: null,
      actionability: null,
      completionReason: null,
    },
    reviewPack: null,
  };
}

function createRuntimeTaskSummary(
  taskId: string,
  status: RuntimeAgentTaskSummary["status"],
  overrides: Partial<RuntimeAgentTaskSummary> = {}
): RuntimeAgentTaskSummary {
  return {
    taskId,
    workspaceId: "ws-1",
    threadId: null,
    requestId: null,
    title: taskId,
    status,
    accessMode: "on-request",
    executionMode: "distributed",
    provider: null,
    modelId: null,
    reasonEffort: null,
    routedProvider: null,
    routedModelId: null,
    routedPool: null,
    routedSource: null,
    currentStep: null,
    createdAt: 10,
    updatedAt: 10,
    startedAt: 10,
    completedAt: status === "completed" ? 20 : null,
    errorCode: null,
    errorMessage: null,
    pendingApprovalId: null,
    backendId: null,
    preferredBackendIds: null,
    steps: [],
    ...overrides,
  };
}

function createLaunchRequest(): RuntimeRunStartRequest {
  return {
    workspaceId: "ws-1",
    title: "Parent objective",
    executionMode: "distributed",
    accessMode: "on-request",
    missionBrief: {
      objective: "Parent objective",
      preferredBackendIds: ["backend-default"],
      parallelismHint: "parallel_dispatch",
    },
    steps: [
      {
        kind: "read",
        input: "Parent objective",
      },
    ],
  };
}

function createInMemoryPersistence() {
  const snapshots = new Map<string, Uint8Array>();
  return {
    loadSnapshot(workspaceId: string) {
      const snapshot = snapshots.get(workspaceId);
      return snapshot ? snapshot.slice() : null;
    },
    saveSnapshot(workspaceId: string, snapshot: Uint8Array) {
      snapshots.set(workspaceId, snapshot.slice());
    },
    clearSnapshot(workspaceId: string) {
      snapshots.delete(workspaceId);
    },
  };
}

describe("parseRuntimeParallelDispatchPlan", () => {
  it("normalizes chunk instructions and backend preferences for dispatchable plans", () => {
    const plan = parseRuntimeParallelDispatchPlan(
      JSON.stringify(
        {
          enabled: true,
          maxParallel: 3,
          tasks: [
            {
              taskKey: "inspect",
              title: "Inspect runtime boundary",
              instruction:
                "Inspect runtime composition routing and summarize the abstraction seam.",
              preferredBackendIds: ["backend-inspect", "backend-inspect", "backend-fallback"],
              dependsOn: [],
              maxRetries: 1,
              onFailure: "halt",
            },
            {
              taskKey: "ux",
              title: "Stream concurrent progress",
              instruction: "Render mission-control progress for multiple child runs.",
              preferredBackendIds: ["backend-ui"],
              dependsOn: ["inspect"],
              maxRetries: 2,
              onFailure: "continue",
            },
          ],
        },
        null,
        2
      )
    );

    expect(plan.enabled).toBe(true);
    expect(plan.maxParallel).toBe(3);
    expect(plan.parseError).toBeNull();
    expect(plan.tasks).toEqual([
      expect.objectContaining({
        taskKey: "inspect",
        title: "Inspect runtime boundary",
        instruction: "Inspect runtime composition routing and summarize the abstraction seam.",
        preferredBackendIds: ["backend-inspect", "backend-fallback"],
      }),
      expect.objectContaining({
        taskKey: "ux",
        title: "Stream concurrent progress",
        instruction: "Render mission-control progress for multiple child runs.",
        preferredBackendIds: ["backend-ui"],
        dependsOn: ["inspect"],
      }),
    ]);
  });

  it("surfaces a launch error for enabled plans with invalid dependency graphs", () => {
    const plan = parseRuntimeParallelDispatchPlan(
      JSON.stringify({
        enabled: true,
        maxParallel: 2,
        tasks: [
          {
            taskKey: "review",
            dependsOn: ["missing"],
          },
        ],
      })
    );

    expect(readRuntimeParallelDispatchPlanLaunchError(plan)).toBe(
      'Dependency hint: "review" depends on missing task "missing".'
    );
  });
});

describe("runtimeParallelDispatchManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("launches ready chunks concurrently and unlocks dependent chunks from runtime-owned completion truth", async () => {
    const inspectLaunch = createDeferred<RuntimeRunStartV2Response>();
    const implementLaunch = createDeferred<RuntimeRunStartV2Response>();
    const fusionLaunch = createDeferred<RuntimeRunStartV2Response>();
    const launchRun = vi.fn((request: RuntimeRunStartRequest) => {
      switch (request.title) {
        case "Inspect runtime boundary":
          return inspectLaunch.promise;
        case "Implement dispatcher":
          return implementLaunch.promise;
        case "Fuse concurrent progress":
          return fusionLaunch.promise;
        default:
          throw new Error(`Unexpected launch title: ${request.title ?? "unknown"}`);
      }
    });
    const manager = createRuntimeParallelDispatchManager({
      launchRun,
      now: (() => {
        let tick = 100;
        return () => tick++;
      })(),
    });

    const session = await manager.startDispatch({
      workspaceId: "ws-1",
      objective: "Parent objective",
      launchRequest: createLaunchRequest(),
      plan: parseRuntimeParallelDispatchPlan(
        JSON.stringify({
          enabled: true,
          maxParallel: 2,
          tasks: [
            {
              taskKey: "inspect",
              title: "Inspect runtime boundary",
              instruction: "Inspect runtime composition routing.",
              preferredBackendIds: ["backend-inspect"],
              dependsOn: [],
              maxRetries: 1,
              onFailure: "halt",
            },
            {
              taskKey: "implement",
              title: "Implement dispatcher",
              instruction: "Implement the runtime dispatcher manager.",
              preferredBackendIds: ["backend-implement"],
              dependsOn: [],
              maxRetries: 1,
              onFailure: "continue",
            },
            {
              taskKey: "fuse",
              title: "Fuse concurrent progress",
              instruction: "Fuse child-run progress with Loro-backed state.",
              preferredBackendIds: ["backend-fusion"],
              dependsOn: ["inspect", "implement"],
              maxRetries: 1,
              onFailure: "halt",
            },
          ],
        })
      ),
    });

    expect(session.sessionId).toBeTruthy();
    expect(launchRun).toHaveBeenCalledTimes(2);
    expect(launchRun.mock.calls.map((entry) => entry[0].preferredBackendIds)).toEqual([
      ["backend-inspect"],
      ["backend-implement"],
    ]);

    let snapshot = manager.getWorkspaceSnapshot("ws-1");
    expect(snapshot.activeSessionCount).toBe(1);
    expect(snapshot.sessions[0]?.tasks.map((task) => [task.taskKey, task.status])).toEqual([
      ["inspect", "launching"],
      ["implement", "launching"],
      ["fuse", "pending"],
    ]);

    inspectLaunch.resolve(
      createRuntimeRunRecord("run-inspect", {
        title: "Inspect runtime boundary",
        backendId: "backend-inspect",
        preferredBackendIds: ["backend-inspect"],
        status: "running",
      })
    );
    implementLaunch.resolve(
      createRuntimeRunRecord("run-implement", {
        title: "Implement dispatcher",
        backendId: "backend-implement",
        preferredBackendIds: ["backend-implement"],
        status: "running",
      })
    );
    await flushMicrotasks();

    snapshot = manager.getWorkspaceSnapshot("ws-1");
    expect(snapshot.sessions[0]?.tasks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          taskKey: "inspect",
          runId: "run-inspect",
          taskId: "run-inspect",
          resolvedBackendId: "backend-inspect",
          status: "running",
        }),
        expect.objectContaining({
          taskKey: "implement",
          runId: "run-implement",
          taskId: "run-implement",
          resolvedBackendId: "backend-implement",
          status: "running",
        }),
      ])
    );

    manager.reconcileRuntimeTasks("ws-1", [
      createRuntimeTaskSummary("run-inspect", "completed", {
        title: "Inspect runtime boundary",
        backendId: "backend-inspect",
        preferredBackendIds: ["backend-inspect"],
      }),
      createRuntimeTaskSummary("run-implement", "completed", {
        title: "Implement dispatcher",
        backendId: "backend-implement",
        preferredBackendIds: ["backend-implement"],
      }),
    ]);
    await flushMicrotasks();

    expect(launchRun).toHaveBeenCalledTimes(3);
    expect(launchRun.mock.calls[2]?.[0]).toMatchObject({
      title: "Fuse concurrent progress",
      executionMode: "distributed",
      preferredBackendIds: ["backend-fusion"],
      missionBrief: expect.objectContaining({
        objective: "Fuse concurrent progress",
        preferredBackendIds: ["backend-fusion"],
      }),
    });

    fusionLaunch.resolve(
      createRuntimeRunRecord("run-fuse", {
        title: "Fuse concurrent progress",
        backendId: "backend-fusion",
        preferredBackendIds: ["backend-fusion"],
        status: "queued",
      })
    );
    await flushMicrotasks();

    manager.reconcileRuntimeTasks("ws-1", [
      createRuntimeTaskSummary("run-inspect", "completed", {
        title: "Inspect runtime boundary",
        backendId: "backend-inspect",
        preferredBackendIds: ["backend-inspect"],
      }),
      createRuntimeTaskSummary("run-implement", "completed", {
        title: "Implement dispatcher",
        backendId: "backend-implement",
        preferredBackendIds: ["backend-implement"],
      }),
      createRuntimeTaskSummary("run-fuse", "completed", {
        title: "Fuse concurrent progress",
        backendId: "backend-fusion",
        preferredBackendIds: ["backend-fusion"],
      }),
    ]);
    await flushMicrotasks();

    snapshot = manager.getWorkspaceSnapshot("ws-1");
    expect(snapshot.sessions[0]).toMatchObject({
      state: "completed",
      counts: {
        total: 3,
        completed: 3,
        running: 0,
        failed: 0,
      },
    });
    expect(snapshot.sessions[0]?.tasks.map((task) => [task.taskKey, task.status])).toEqual([
      ["inspect", "completed"],
      ["implement", "completed"],
      ["fuse", "completed"],
    ]);
  });

  it("retries launch failures up to maxRetries before marking the chunk failed", async () => {
    let attempts = 0;
    const launchRun = vi.fn(async (request: RuntimeRunStartRequest) => {
      attempts += 1;
      if (request.title === "Retry launcher" && attempts === 1) {
        throw new Error("transient launch failure");
      }
      return createRuntimeRunRecord("run-retry", {
        title: request.title ?? "Retry launcher",
        backendId: "backend-retry",
        preferredBackendIds: ["backend-retry"],
        status: "queued",
      });
    });
    const manager = createRuntimeParallelDispatchManager({
      launchRun,
      now: (() => {
        let tick = 200;
        return () => tick++;
      })(),
    });

    await manager.startDispatch({
      workspaceId: "ws-1",
      objective: "Retry objective",
      launchRequest: createLaunchRequest(),
      plan: parseRuntimeParallelDispatchPlan(
        JSON.stringify({
          enabled: true,
          maxParallel: 1,
          tasks: [
            {
              taskKey: "retry",
              title: "Retry launcher",
              instruction: "Retry launch failures before giving up.",
              preferredBackendIds: ["backend-retry"],
              dependsOn: [],
              maxRetries: 1,
              onFailure: "continue",
            },
          ],
        })
      ),
    });
    await flushMicrotasks();

    expect(launchRun).toHaveBeenCalledTimes(2);
    const snapshot = manager.getWorkspaceSnapshot("ws-1");
    expect(snapshot.sessions[0]?.tasks).toEqual([
      expect.objectContaining({
        taskKey: "retry",
        status: "running",
        attemptCount: 2,
        taskId: "run-retry",
      }),
    ]);
  });

  it("treats skip-policy failures as skipped and skips dependent chunks without halting unrelated work", async () => {
    const launchRun = vi.fn(async (request: RuntimeRunStartRequest) => {
      switch (request.title) {
        case "Optional discovery":
          return createRuntimeRunRecord("run-optional", {
            title: "Optional discovery",
            backendId: "backend-optional",
            preferredBackendIds: ["backend-optional"],
            status: "queued",
          });
        case "Independent follow-up":
          return createRuntimeRunRecord("run-follow-up", {
            title: "Independent follow-up",
            backendId: "backend-follow-up",
            preferredBackendIds: ["backend-follow-up"],
            status: "queued",
          });
        default:
          throw new Error(`Unexpected launch title: ${request.title ?? "unknown"}`);
      }
    });
    const manager = createRuntimeParallelDispatchManager({
      launchRun,
      now: (() => {
        let tick = 300;
        return () => tick++;
      })(),
    });

    await manager.startDispatch({
      workspaceId: "ws-1",
      objective: "Skip objective",
      launchRequest: createLaunchRequest(),
      plan: parseRuntimeParallelDispatchPlan(
        JSON.stringify({
          enabled: true,
          maxParallel: 1,
          tasks: [
            {
              taskKey: "optional",
              title: "Optional discovery",
              instruction: "Optional discovery can be skipped.",
              preferredBackendIds: ["backend-optional"],
              dependsOn: [],
              maxRetries: 0,
              onFailure: "skip",
            },
            {
              taskKey: "dependent",
              title: "Dependent summary",
              instruction: "This chunk depends on optional discovery.",
              preferredBackendIds: ["backend-dependent"],
              dependsOn: ["optional"],
              maxRetries: 0,
              onFailure: "continue",
            },
            {
              taskKey: "follow-up",
              title: "Independent follow-up",
              instruction: "This chunk should continue after skip-policy failures.",
              preferredBackendIds: ["backend-follow-up"],
              dependsOn: [],
              maxRetries: 0,
              onFailure: "continue",
            },
          ],
        })
      ),
    });

    manager.reconcileRuntimeTasks("ws-1", [
      createRuntimeTaskSummary("run-optional", "failed", {
        title: "Optional discovery",
        backendId: "backend-optional",
        preferredBackendIds: ["backend-optional"],
        errorMessage: "optional failed",
      }),
    ]);
    await flushMicrotasks();

    expect(launchRun).toHaveBeenCalledTimes(2);
    const snapshot = manager.getWorkspaceSnapshot("ws-1");
    expect(snapshot.sessions[0]?.tasks.map((task) => [task.taskKey, task.status])).toEqual([
      ["optional", "skipped"],
      ["dependent", "skipped"],
      ["follow-up", "running"],
    ]);
  });

  it("rejects enabled dispatch plans that still contain validation errors", async () => {
    const manager = createRuntimeParallelDispatchManager({
      launchRun: vi.fn(),
      now: () => 400,
    });

    await expect(
      manager.startDispatch({
        workspaceId: "ws-1",
        objective: "Invalid objective",
        launchRequest: createLaunchRequest(),
        plan: parseRuntimeParallelDispatchPlan(
          JSON.stringify({
            enabled: true,
            maxParallel: 1,
            tasks: [
              {
                taskKey: "a",
                dependsOn: ["b"],
              },
              {
                taskKey: "b",
                dependsOn: ["a"],
              },
            ],
          })
        ),
      })
    ).rejects.toThrow("Cycle hint: a -> b -> a.");
  });

  it("restores persisted sessions and resumes dependency launches after hydration", async () => {
    const persistence = createInMemoryPersistence();
    const initialLaunchRun = vi.fn(async (request: RuntimeRunStartRequest) => {
      if (request.title !== "Inspect runtime boundary") {
        throw new Error(`Unexpected launch title: ${request.title ?? "unknown"}`);
      }
      return createRuntimeRunRecord("run-inspect", {
        title: "Inspect runtime boundary",
        backendId: "backend-inspect",
        preferredBackendIds: ["backend-inspect"],
        status: "queued",
      });
    });
    const firstManager = createRuntimeParallelDispatchManager({
      launchRun: initialLaunchRun,
      persistence,
      now: (() => {
        let tick = 500;
        return () => tick++;
      })(),
    });

    await firstManager.startDispatch({
      workspaceId: "ws-1",
      objective: "Persisted objective",
      launchRequest: createLaunchRequest(),
      plan: parseRuntimeParallelDispatchPlan(
        JSON.stringify({
          enabled: true,
          maxParallel: 1,
          tasks: [
            {
              taskKey: "inspect",
              title: "Inspect runtime boundary",
              instruction: "Inspect runtime composition routing.",
              preferredBackendIds: ["backend-inspect"],
              dependsOn: [],
              maxRetries: 0,
              onFailure: "halt",
            },
            {
              taskKey: "summary",
              title: "Dependent summary",
              instruction: "Summarize the restored runtime state.",
              preferredBackendIds: ["backend-summary"],
              dependsOn: ["inspect"],
              maxRetries: 0,
              onFailure: "continue",
            },
          ],
        })
      ),
    });
    await flushMicrotasks();

    expect(
      firstManager.getWorkspaceSnapshot("ws-1").sessions[0]?.tasks.map((task) => task.status)
    ).toEqual(["running", "pending"]);

    const resumedLaunch = createDeferred<RuntimeRunStartV2Response>();
    const resumedLaunchRun = vi.fn((request: RuntimeRunStartRequest) => {
      if (request.title !== "Dependent summary") {
        throw new Error(`Unexpected restored launch title: ${request.title ?? "unknown"}`);
      }
      return resumedLaunch.promise;
    });
    const restoredManager = createRuntimeParallelDispatchManager({
      launchRun: resumedLaunchRun,
      persistence,
      now: (() => {
        let tick = 600;
        return () => tick++;
      })(),
    });

    restoredManager.reconcileRuntimeTasks("ws-1", [
      createRuntimeTaskSummary("run-inspect", "completed", {
        title: "Inspect runtime boundary",
        backendId: "backend-inspect",
        preferredBackendIds: ["backend-inspect"],
      }),
    ]);

    await waitForAssertion(() => {
      expect(
        restoredManager.getWorkspaceSnapshot("ws-1").sessions[0]?.tasks.map((task) => task.status)
      ).toEqual(["completed", "launching"]);
    });
    expect(resumedLaunchRun).toHaveBeenCalledTimes(1);
    expect(resumedLaunchRun.mock.calls[0]?.[0]).toMatchObject({
      title: "Dependent summary",
      preferredBackendIds: ["backend-summary"],
      missionBrief: expect.objectContaining({
        objective: "Dependent summary",
        preferredBackendIds: ["backend-summary"],
      }),
    });

    resumedLaunch.resolve(
      createRuntimeRunRecord("run-summary", {
        title: "Dependent summary",
        backendId: "backend-summary",
        preferredBackendIds: ["backend-summary"],
        status: "queued",
      })
    );
    await flushMicrotasks();

    restoredManager.reconcileRuntimeTasks("ws-1", [
      createRuntimeTaskSummary("run-inspect", "completed", {
        title: "Inspect runtime boundary",
        backendId: "backend-inspect",
        preferredBackendIds: ["backend-inspect"],
      }),
      createRuntimeTaskSummary("run-summary", "completed", {
        title: "Dependent summary",
        backendId: "backend-summary",
        preferredBackendIds: ["backend-summary"],
      }),
    ]);
    await flushMicrotasks();

    expect(restoredManager.getWorkspaceSnapshot("ws-1").sessions[0]).toMatchObject({
      state: "completed",
      counts: {
        total: 2,
        completed: 2,
      },
    });
  });
});
