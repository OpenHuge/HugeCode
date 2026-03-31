import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RuntimeRunStartRequest, RuntimeRunStartV2Response } from "../ports/runtimeClient";
import { getAppSettings } from "../ports/desktopAppSettings";
import { prepareRuntimeRunV2, startRuntimeRunV2 } from "../ports/runtimeJobs";
import {
  resolveRuntimePreferredBackendIdsInput,
  resolvePreferredBackendIdsForRuntimeRunLaunch,
  startRuntimeRunWithRemoteSelection,
} from "./runtimeRemoteExecutionFacade";

vi.mock("../ports/desktopAppSettings", () => ({
  getAppSettings: vi.fn(),
}));

vi.mock("../ports/runtimeJobs", () => ({
  prepareRuntimeRunV2: vi.fn(),
  startRuntimeRunV2: vi.fn(),
}));

const getAppSettingsMock = vi.mocked(getAppSettings);
const prepareRuntimeRunV2Mock = vi.mocked(prepareRuntimeRunV2);
const startRuntimeRunV2Mock = vi.mocked(startRuntimeRunV2);

function createRuntimeRunRecord(
  overrides: Partial<RuntimeRunStartV2Response["run"]> = {}
): RuntimeRunStartV2Response {
  return {
    run: {
      taskId: "run-1",
      workspaceId: "ws-1",
      threadId: null,
      requestId: null,
      title: "Run task",
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
      createdAt: 1,
      updatedAt: 1,
      startedAt: null,
      completedAt: null,
      errorCode: null,
      errorMessage: null,
      pendingApprovalId: null,
      steps: [],
      ...overrides,
    },
    missionRun: {
      id: "run-1",
      taskId: "runtime-task:run-1",
      workspaceId: "ws-1",
      state: "queued",
      title: "Run task",
      summary: null,
      taskSource: null,
      startedAt: null,
      finishedAt: null,
      updatedAt: 1,
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

function createStartRequest(): RuntimeRunStartRequest {
  return {
    workspaceId: "ws-1",
    title: "Run task",
    executionMode: "single",
    steps: [
      {
        kind: "read",
        input: "inspect repo",
      },
    ],
  };
}

describe("runtimeRemoteExecutionFacade", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses the configured default execution backend when no preference is supplied", async () => {
    getAppSettingsMock.mockResolvedValue({
      defaultRemoteExecutionBackendId: "backend-remote-a",
    } as Awaited<ReturnType<typeof getAppSettings>>);

    await expect(resolvePreferredBackendIdsForRuntimeRunLaunch(undefined)).resolves.toEqual([
      "backend-remote-a",
    ]);
  });

  it("preserves explicit backend preferences over the default setting", async () => {
    getAppSettingsMock.mockResolvedValue({
      defaultRemoteExecutionBackendId: "backend-remote-a",
    } as Awaited<ReturnType<typeof getAppSettings>>);

    await expect(
      resolvePreferredBackendIdsForRuntimeRunLaunch(["backend-explicit", "backend-explicit"])
    ).resolves.toEqual(["backend-explicit"]);
  });

  it("prefers a launch-scoped default backend over the global fallback when no explicit preference is supplied", async () => {
    getAppSettingsMock.mockResolvedValue({
      defaultRemoteExecutionBackendId: "backend-global-fallback",
    } as Awaited<ReturnType<typeof getAppSettings>>);

    await expect(
      resolvePreferredBackendIdsForRuntimeRunLaunch(undefined, "backend-workspace-default")
    ).resolves.toEqual(["backend-workspace-default"]);
  });

  it("shares the same synchronous backend-default resolution helper across UI call sites", () => {
    expect(
      resolveRuntimePreferredBackendIdsInput({
        preferredBackendIds: null,
        fallbackDefaultBackendId: "backend-global-default",
      })
    ).toEqual(["backend-global-default"]);

    expect(
      resolveRuntimePreferredBackendIdsInput({
        preferredBackendIds: ["backend-explicit", "backend-explicit"],
        fallbackDefaultBackendId: "backend-global-default",
      })
    ).toEqual(["backend-explicit"]);
  });

  it("keeps single-run launches free of implicit remote backend preferences", async () => {
    const summary = createRuntimeRunRecord();

    getAppSettingsMock.mockResolvedValue({
      defaultRemoteExecutionBackendId: "backend-remote-a",
    } as Awaited<ReturnType<typeof getAppSettings>>);
    prepareRuntimeRunV2Mock.mockResolvedValue({} as never);
    startRuntimeRunV2Mock.mockResolvedValue(summary);

    await expect(startRuntimeRunWithRemoteSelection(createStartRequest())).resolves.toEqual(
      summary
    );

    expect(prepareRuntimeRunV2Mock).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "ws-1",
        executionMode: "single",
        title: "Run task",
        steps: [{ kind: "read", input: "inspect repo" }],
      })
    );
    expect(startRuntimeRunV2Mock).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "ws-1",
        executionMode: "single",
      })
    );
    expect(startRuntimeRunV2Mock.mock.calls[0]?.[0]).not.toHaveProperty("missionBrief");
  });

  it("threads the resolved backend preference into distributed task starts", async () => {
    const summary = createRuntimeRunRecord({
      preferredBackendIds: ["backend-remote-a"],
    });

    getAppSettingsMock.mockResolvedValue({
      defaultRemoteExecutionBackendId: "backend-remote-a",
    } as Awaited<ReturnType<typeof getAppSettings>>);
    prepareRuntimeRunV2Mock.mockResolvedValue({} as never);
    startRuntimeRunV2Mock.mockResolvedValue(summary);

    await expect(
      startRuntimeRunWithRemoteSelection({
        ...createStartRequest(),
        executionMode: "distributed",
      })
    ).resolves.toEqual(summary);

    expect(startRuntimeRunV2Mock).toHaveBeenCalledWith(
      expect.objectContaining({
        preferredBackendIds: ["backend-remote-a"],
        executionMode: "distributed",
      })
    );
    expect(startRuntimeRunV2Mock.mock.calls[0]?.[0]).not.toHaveProperty("missionBrief");
  });

  it("preserves explicit mission brief fields when the caller already provided one", async () => {
    const summary = createRuntimeRunRecord({
      taskId: "run-2",
    });

    getAppSettingsMock.mockResolvedValue({} as Awaited<ReturnType<typeof getAppSettings>>);
    prepareRuntimeRunV2Mock.mockResolvedValue({} as never);
    startRuntimeRunV2Mock.mockResolvedValue(summary);

    await startRuntimeRunWithRemoteSelection({
      ...createStartRequest(),
      missionBrief: {
        objective: "Explicit objective",
        riskLevel: "high",
      },
    });

    expect(startRuntimeRunV2Mock).toHaveBeenCalledWith(
      expect.objectContaining({
        missionBrief: {
          objective: "Explicit objective",
          riskLevel: "high",
        },
      })
    );
  });
});
