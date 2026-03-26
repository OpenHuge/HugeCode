import { beforeEach, describe, expect, it, vi } from "vitest";
import type { KernelJob, KernelJobStartRequestV3 } from "../ports/runtimeClient";
import { getAppSettings } from "../ports/tauriAppSettings";
import { startRuntimeJob } from "../ports/tauriRuntimeJobs";
import {
  resolveRuntimePreferredBackendIdsInput,
  resolvePreferredBackendIdsForRuntimeJobStart,
  startRuntimeJobWithRemoteSelection,
} from "./runtimeRemoteExecutionFacade";

vi.mock("../ports/tauriAppSettings", () => ({
  getAppSettings: vi.fn(),
}));

vi.mock("../ports/tauriRuntimeJobs", () => ({
  startRuntimeJob: vi.fn(),
}));

const getAppSettingsMock = vi.mocked(getAppSettings);
const startRuntimeJobMock = vi.mocked(startRuntimeJob);

function createKernelJob(overrides: Partial<KernelJob> = {}): KernelJob {
  return {
    id: "job-1",
    workspaceId: "ws-1",
    threadId: null,
    title: "Run task",
    status: "queued",
    provider: null,
    modelId: null,
    backendId: null,
    preferredBackendIds: null,
    executionProfile: {
      placement: "local",
      interactivity: "interactive",
      isolation: "host",
      network: "default",
      authority: "user",
    },
    createdAt: 1,
    updatedAt: 1,
    startedAt: null,
    completedAt: null,
    continuation: {
      resumeSupported: true,
      recovered: false,
      summary: "Ready",
    },
    metadata: null,
    ...overrides,
  };
}

function createStartRequest(): KernelJobStartRequestV3 {
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

    await expect(resolvePreferredBackendIdsForRuntimeJobStart(undefined)).resolves.toEqual([
      "backend-remote-a",
    ]);
  });

  it("preserves explicit backend preferences over the default setting", async () => {
    getAppSettingsMock.mockResolvedValue({
      defaultRemoteExecutionBackendId: "backend-remote-a",
    } as Awaited<ReturnType<typeof getAppSettings>>);

    await expect(
      resolvePreferredBackendIdsForRuntimeJobStart(["backend-explicit", "backend-explicit"])
    ).resolves.toEqual(["backend-explicit"]);
  });

  it("prefers a launch-scoped default backend over the global fallback when no explicit preference is supplied", async () => {
    getAppSettingsMock.mockResolvedValue({
      defaultRemoteExecutionBackendId: "backend-global-fallback",
    } as Awaited<ReturnType<typeof getAppSettings>>);

    await expect(
      resolvePreferredBackendIdsForRuntimeJobStart(undefined, "backend-workspace-default")
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
    const summary = createKernelJob();

    getAppSettingsMock.mockResolvedValue({
      defaultRemoteExecutionBackendId: "backend-remote-a",
    } as Awaited<ReturnType<typeof getAppSettings>>);
    startRuntimeJobMock.mockResolvedValue(summary);

    await expect(startRuntimeJobWithRemoteSelection(createStartRequest())).resolves.toEqual(
      summary
    );

    expect(startRuntimeJobMock).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "ws-1",
        executionMode: "single",
        title: "Run task",
        steps: [{ kind: "read", input: "inspect repo" }],
      })
    );
    expect(startRuntimeJobMock.mock.calls[0]?.[0]).not.toHaveProperty("missionBrief");
  });

  it("threads the resolved backend preference into distributed task starts", async () => {
    const summary = createKernelJob({
      preferredBackendIds: ["backend-remote-a"],
      executionProfile: {
        placement: "remote",
        interactivity: "background",
        isolation: "container_sandbox",
        network: "default",
        authority: "service",
      },
    });

    getAppSettingsMock.mockResolvedValue({
      defaultRemoteExecutionBackendId: "backend-remote-a",
    } as Awaited<ReturnType<typeof getAppSettings>>);
    startRuntimeJobMock.mockResolvedValue(summary);

    await expect(
      startRuntimeJobWithRemoteSelection({
        ...createStartRequest(),
        executionMode: "distributed",
      })
    ).resolves.toEqual(summary);

    expect(startRuntimeJobMock).toHaveBeenCalledWith(
      expect.objectContaining({
        preferredBackendIds: ["backend-remote-a"],
        executionMode: "distributed",
      })
    );
    expect(startRuntimeJobMock.mock.calls[0]?.[0]).not.toHaveProperty("missionBrief");
  });

  it("preserves explicit mission brief fields when the caller already provided one", async () => {
    const summary = createKernelJob({
      id: "job-2",
    });

    getAppSettingsMock.mockResolvedValue({} as Awaited<ReturnType<typeof getAppSettings>>);
    startRuntimeJobMock.mockResolvedValue(summary);

    await startRuntimeJobWithRemoteSelection({
      ...createStartRequest(),
      missionBrief: {
        objective: "Explicit objective",
        riskLevel: "high",
      },
    });

    expect(startRuntimeJobMock).toHaveBeenCalledWith(
      expect.objectContaining({
        missionBrief: {
          objective: "Explicit objective",
          riskLevel: "high",
        },
      })
    );
  });
});
