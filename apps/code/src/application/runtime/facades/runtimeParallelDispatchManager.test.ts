import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RuntimeRunStartRequest, RuntimeRunStartV2Response } from "../ports/runtimeClient";
import type { RuntimeAgentTaskSummary } from "../types/webMcpBridge";
import {
  createRuntimeParallelDispatchManager,
  parseRuntimeParallelDispatchPlan,
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
});
