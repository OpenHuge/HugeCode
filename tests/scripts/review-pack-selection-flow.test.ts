import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  AgentTaskSummary,
  AgentTaskStartRequest,
  RuntimeRunStartV2Response,
} from "../../apps/code/src/application/runtime/ports/runtimeClient";
import { buildMissionControlProjection } from "../../apps/code/src/application/runtime/facades/runtimeMissionControlFacade";
import { getAppSettings } from "../../apps/code/src/application/runtime/ports/desktopAppSettings";
import {
  prepareRuntimeRunV2,
  startRuntimeRunV2,
} from "../../apps/code/src/application/runtime/ports/tauriRuntimeJobs";
import {
  resolvePreferredBackendIdsForRuntimeRunLaunch,
  startRuntimeRunWithRemoteSelection,
} from "../../apps/code/src/application/runtime/facades/runtimeRemoteExecutionFacade";
import {
  buildReviewPackDetailModel,
  resolveReviewPackSelection,
} from "../../apps/code/src/features/review/utils/reviewPackSurfaceModel";

vi.mock("../../apps/code/src/application/runtime/ports/desktopAppSettings", () => ({
  getAppSettings: vi.fn(),
}));

vi.mock("../../apps/code/src/application/runtime/ports/tauriRuntimeJobs", () => ({
  prepareRuntimeRunV2: vi.fn(),
  startRuntimeRunV2: vi.fn(),
}));

const getAppSettingsMock = vi.mocked(getAppSettings);
const prepareRuntimeRunV2Mock = vi.mocked(prepareRuntimeRunV2);
const startRuntimeRunV2Mock = vi.mocked(startRuntimeRunV2);

function createStartRequest(): AgentTaskStartRequest {
  return {
    workspaceId: "ws-1",
    title: "Refactor review routing",
    executionMode: "distributed",
    steps: [
      {
        kind: "read",
        input: "inspect repo state",
      },
      {
        kind: "diagnostics",
        input: "pnpm validate:fast",
      },
    ],
  };
}

function createCompletedRuntimeTask(): AgentTaskSummary {
  return {
    taskId: "run-1",
    workspaceId: "ws-1",
    threadId: "thread-1",
    requestId: null,
    title: "Refactor review routing",
    status: "completed",
    accessMode: "on-request",
    provider: "openai",
    modelId: "gpt-5.3-codex",
    backendId: "backend-remote-a",
    preferredBackendIds: ["backend-remote-a"],
    routedProvider: "openai",
    routedModelId: "gpt-5.3-codex",
    routedPool: "pool-a",
    routedSource: "workspace-default",
    routing: {
      backendId: "backend-remote-a",
      provider: "openai",
      providerLabel: "OPENAI",
      pool: "pool-a",
      routeLabel: "Workspace default backend",
      routeHint: "Resolved through backend-remote-a.",
      health: "ready",
      enabledAccountCount: 1,
      readyAccountCount: 1,
      enabledPoolCount: 1,
    },
    currentStep: 1,
    createdAt: 1,
    updatedAt: 20,
    startedAt: 2,
    completedAt: 30,
    errorCode: null,
    errorMessage: null,
    pendingApprovalId: null,
    steps: [
      {
        index: 0,
        kind: "read",
        role: "planner",
        status: "completed",
        message: "Collected review evidence",
        runId: null,
        output: null,
        metadata: {},
        startedAt: 2,
        updatedAt: 10,
        completedAt: 12,
        errorCode: null,
        errorMessage: null,
        approvalId: null,
      },
      {
        index: 1,
        kind: "diagnostics",
        role: "operator",
        status: "completed",
        message: "pnpm validate:fast",
        runId: null,
        output: "validate:fast passed",
        metadata: {},
        startedAt: 12,
        updatedAt: 20,
        completedAt: 30,
        errorCode: null,
        errorMessage: null,
        approvalId: null,
      },
    ],
  };
}

function createStartedRuntimeRun(task: AgentTaskSummary): RuntimeRunStartV2Response {
  return {
    run: task,
    missionRun: {
      id: task.taskId,
      taskId: task.runSummary?.taskId ?? `runtime-task:${task.taskId}`,
      workspaceId: task.workspaceId,
      state: task.status === "completed" ? "review_ready" : "queued",
      title: task.title ?? null,
      summary: null,
      taskSource: task.taskSource ?? null,
      startedAt: task.startedAt,
      finishedAt: task.completedAt,
      updatedAt: task.updatedAt,
      currentStepIndex: task.currentStep ?? null,
      pendingIntervention: null,
      executionProfile: task.runSummary?.executionProfile ?? null,
      reviewProfileId: task.runSummary?.reviewProfileId ?? null,
      profileReadiness: task.runSummary?.profileReadiness ?? null,
      routing: task.routing ?? null,
      approval: null,
      reviewDecision: task.reviewDecision ?? null,
      intervention: task.intervention ?? null,
      operatorState: task.operatorState ?? null,
      nextAction: task.nextAction ?? null,
      warnings: [],
      validations: [],
      artifacts: [],
      changedPaths: [],
      autoDrive: task.autoDrive ?? null,
      checkpoints: [],
      takeoverBundle: task.takeoverBundle ?? null,
      publishHandoff: task.publishHandoff ?? null,
      checkpoint: task.checkpointState ?? null,
      missionLinkage: task.missionLinkage ?? null,
      reviewActionability: task.reviewActionability ?? null,
      completionReason: null,
    },
    reviewPack: task.reviewPackSummary ?? null,
  };
}

function createCompletedRuntimeTaskForBackend(
  backendId: string,
  routeLabel: string,
  provider: AgentTaskSummary["routedProvider"],
  pool: string,
  preferredBackendIds?: string[]
): AgentTaskSummary {
  return {
    ...createCompletedRuntimeTask(),
    backendId,
    preferredBackendIds,
    routedProvider: provider,
    routedPool: pool,
    routing: {
      backendId,
      provider,
      providerLabel: provider ? provider.toUpperCase() : null,
      pool,
      routeLabel,
      routeHint: `Resolved through ${backendId}.`,
      health: "ready",
      enabledAccountCount: 1,
      readyAccountCount: 1,
      enabledPoolCount: 1,
    },
  };
}

function resolveReviewPackDetail(input: {
  projection: ReturnType<typeof buildMissionControlProjection>;
  workspaceId: string;
  reviewPackId: string;
}) {
  const selection = resolveReviewPackSelection({
    projection: input.projection,
    workspaceId: input.workspaceId,
    request: {
      workspaceId: input.workspaceId,
      reviewPackId: input.reviewPackId,
      source: "review_surface",
    },
  });

  return buildReviewPackDetailModel({
    projection: input.projection,
    selection,
  });
}

describe("review-pack selection flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves backend precedence from explicit preference to launch default to global fallback", async () => {
    getAppSettingsMock.mockResolvedValue({
      defaultRemoteExecutionBackendId: "backend-global-fallback",
    } as Awaited<ReturnType<typeof getAppSettings>>);

    await expect(
      resolvePreferredBackendIdsForRuntimeRunLaunch(
        ["backend-explicit", "backend-explicit"],
        "backend-workspace-default"
      )
    ).resolves.toEqual(["backend-explicit"]);

    await expect(
      resolvePreferredBackendIdsForRuntimeRunLaunch(undefined, "backend-workspace-default")
    ).resolves.toEqual(["backend-workspace-default"]);

    await expect(resolvePreferredBackendIdsForRuntimeRunLaunch()).resolves.toEqual([
      "backend-global-fallback",
    ]);
  });

  it("covers launch, projection, and review-pack action wiring", async () => {
    const runtimeTask = createCompletedRuntimeTask();
    getAppSettingsMock.mockResolvedValue({
      defaultRemoteExecutionBackendId: "backend-remote-a",
    } as Awaited<ReturnType<typeof getAppSettings>>);
    prepareRuntimeRunV2Mock.mockResolvedValue({} as never);
    startRuntimeRunV2Mock.mockResolvedValue(createStartedRuntimeRun(runtimeTask));

    const startedRun = await startRuntimeRunWithRemoteSelection(createStartRequest());
    const startedTask = startedRun.run;

    expect(startRuntimeRunV2Mock).toHaveBeenCalledWith(
      expect.objectContaining({
        preferredBackendIds: ["backend-remote-a"],
      })
    );
    expect(startedTask.taskId).toBe("run-1");

    const projection = buildMissionControlProjection({
      workspaces: [
        {
          id: "ws-1",
          name: "Workspace One",
          rootPath: "/tmp/workspace-one",
          connected: true,
          defaultProfileId: "balanced-delegate",
        },
      ],
      threads: [
        {
          id: "thread-1",
          workspaceId: "ws-1",
          title: "Refactor review routing",
          updatedAt: 20,
          latestRunState: "review_ready",
        },
      ],
      runtimeTasks: [startedTask],
    });

    const detail = resolveReviewPackDetail({
      projection,
      workspaceId: "ws-1",
      reviewPackId: "review-pack:run-1",
    });

    expect(detail).toMatchObject({
      id: "review-pack:run-1",
      runId: "run-1",
      navigationTarget: {
        kind: "thread",
        workspaceId: "ws-1",
        threadId: "thread-1",
      },
      backendAudit: {
        summary: "Workspace default backend",
      },
    });
    expect(detail?.backendAudit.details).toEqual(expect.arrayContaining(["Pool: pool-a"]));
    expect(detail?.decisionActions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "accept",
          enabled: true,
          actionTarget: {
            kind: "review_decision",
            requestId: "review-pack:run-1",
            status: "approved",
          },
        }),
        expect.objectContaining({
          id: "reject",
          enabled: true,
          actionTarget: {
            kind: "review_decision",
            requestId: "review-pack:run-1",
            status: "rejected",
          },
        }),
        expect.objectContaining({
          id: "retry",
          enabled: true,
          interventionDraft: expect.objectContaining({
            intent: "retry",
            sourceReviewPackId: "review-pack:run-1",
          }),
        }),
        expect.objectContaining({
          id: "clarify",
          interventionDraft: expect.objectContaining({
            sourceReviewPackId: "review-pack:run-1",
          }),
        }),
        expect.objectContaining({
          id: "continue_in_pair",
          interventionDraft: expect.objectContaining({
            intent: "pair_mode",
            sourceReviewPackId: "review-pack:run-1",
          }),
        }),
      ])
    );
  });

  it("preserves backend evidence through review follow-up drafts", async () => {
    getAppSettingsMock.mockResolvedValue({
      defaultRemoteExecutionBackendId: "backend-global-fallback",
    } as Awaited<ReturnType<typeof getAppSettings>>);
    prepareRuntimeRunV2Mock.mockResolvedValue({} as never);
    startRuntimeRunV2Mock.mockImplementation(async (request) => {
      const resolvedBackendId = request.preferredBackendIds?.[0] ?? "runtime-auto";
      if (resolvedBackendId === "backend-explicit") {
        return createStartedRuntimeRun(
          createCompletedRuntimeTaskForBackend(
            resolvedBackendId,
            "Explicit backend route",
            "anthropic",
            "pool-explicit",
            request.preferredBackendIds
          )
        );
      }
      if (resolvedBackendId === "backend-workspace-default") {
        return createStartedRuntimeRun(
          createCompletedRuntimeTaskForBackend(
            resolvedBackendId,
            "Workspace default backend",
            "google",
            "pool-workspace",
            request.preferredBackendIds
          )
        );
      }
      return createStartedRuntimeRun(
        createCompletedRuntimeTaskForBackend(
          resolvedBackendId,
          "Global fallback backend",
          "openai",
          "pool-global",
          request.preferredBackendIds
        )
      );
    });

    const cases = [
      {
        request: {
          ...createStartRequest(),
          preferredBackendIds: ["backend-explicit", "backend-explicit"],
          defaultBackendId: "backend-workspace-default",
        },
        expectedBackendId: "backend-explicit",
        expectedRouteLabel: "Explicit backend route",
        expectedPool: "pool-explicit",
      },
      {
        request: {
          ...createStartRequest(),
          defaultBackendId: "backend-workspace-default",
        },
        expectedBackendId: "backend-workspace-default",
        expectedRouteLabel: "Workspace default backend",
        expectedPool: "pool-workspace",
      },
      {
        request: {
          ...createStartRequest(),
        },
        expectedBackendId: "backend-global-fallback",
        expectedRouteLabel: "Global fallback backend",
        expectedPool: "pool-global",
      },
    ] as const;

    for (const testCase of cases) {
      const startedRun = await startRuntimeRunWithRemoteSelection(
        testCase.request as AgentTaskStartRequest & {
          defaultBackendId?: string;
        }
      );
      const startedTask = startedRun.run;

      expect(startRuntimeRunV2Mock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          preferredBackendIds: [testCase.expectedBackendId],
        })
      );
      if (testCase.request.defaultBackendId) {
        expect(startRuntimeRunV2Mock.mock.lastCall?.[0]).toHaveProperty(
          "defaultBackendId",
          testCase.request.defaultBackendId
        );
      } else {
        expect(startRuntimeRunV2Mock.mock.lastCall?.[0]).not.toHaveProperty("defaultBackendId");
      }

      const projection = buildMissionControlProjection({
        workspaces: [
          {
            id: "ws-1",
            name: "Workspace One",
            rootPath: "/tmp/workspace-one",
            connected: true,
            defaultProfileId: "balanced-delegate",
          },
        ],
        threads: [
          {
            id: "thread-1",
            workspaceId: "ws-1",
            title: "Routing case",
            updatedAt: 20,
            latestRunState: "review_ready",
          },
        ],
        runtimeTasks: [startedTask],
      });

      const detail = resolveReviewPackDetail({
        projection,
        workspaceId: "ws-1",
        reviewPackId: "review-pack:run-1",
      });

      expect(detail?.backendAudit).toMatchObject({
        summary: testCase.expectedRouteLabel,
      });
      expect(detail?.backendAudit.details).toEqual(
        expect.arrayContaining([`Pool: ${testCase.expectedPool}`])
      );
      expect(
        detail?.decisionActions.find((action) => action.id === "retry")?.interventionDraft
      ).toMatchObject({
        preferredBackendIds: [testCase.expectedBackendId],
        sourceReviewPackId: "review-pack:run-1",
      });
    }
  });
});
