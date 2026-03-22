// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render as rtlRender,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { act } from "react";
import type { AgentTaskSummary } from "@ku0/code-runtime-host-contract";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { RuntimeKernelProvider } from "../../../application/runtime/kernel/RuntimeKernelContext";
import { createRuntimeAgentControlDependencies } from "../../../application/runtime/kernel/createRuntimeAgentControlDependencies";
import type { RuntimeUpdatedEvent } from "../../../application/runtime/ports/runtimeUpdatedEvents";
import { createRuntimeAgentControlFacade } from "../../../application/runtime/facades/runtimeAgentControlFacade";
import {
  projectAgentTaskSummaryToRunSummary,
  projectCompletedRunToReviewPackSummary,
  projectRuntimeTaskToTaskSummary,
} from "../../../application/runtime/facades/runtimeMissionControlFacade";
import { WorkspaceHomeAgentRuntimeOrchestration } from "./WorkspaceHomeAgentRuntimeOrchestration";

const startRuntimeJobWithRemoteSelectionMock = vi.hoisted(() => vi.fn());
const readRepositoryExecutionContractMock = vi.hoisted(() => vi.fn());
const startAgentTask = vi.hoisted(() => vi.fn());

vi.mock("../../../application/runtime/ports/runtimeUpdatedEvents", () => ({
  subscribeScopedRuntimeUpdatedEvents: vi.fn(),
}));

vi.mock("../../../application/runtime/facades/runtimeRemoteExecutionFacade", () => ({
  startRuntimeJobWithRemoteSelection: startRuntimeJobWithRemoteSelectionMock,
}));

vi.mock("../../../application/runtime/facades/runtimeRepositoryExecutionContract", async () => {
  const actual = await vi.importActual<
    typeof import("../../../application/runtime/facades/runtimeRepositoryExecutionContract")
  >("../../../application/runtime/facades/runtimeRepositoryExecutionContract");
  return {
    ...actual,
    readRepositoryExecutionContract: readRepositoryExecutionContractMock,
  };
});

vi.mock("../../../application/runtime/ports/tauriMissionControl", () => ({
  getMissionControlSnapshot: vi.fn().mockResolvedValue({
    source: "runtime_snapshot_v1",
    generatedAt: 0,
    workspaces: [],
    tasks: [],
    runs: [],
    reviewPacks: [],
  }),
}));

vi.mock("../../../application/runtime/ports/tauriRuntimeJobs", () => ({
  cancelRuntimeJob: vi.fn(),
  submitRuntimeJobApprovalDecision: vi.fn(),
  getRuntimeJob: vi.fn(),
  interveneRuntimeJob: vi.fn(),
  listRuntimeJobs: vi.fn(),
  resumeRuntimeJob: vi.fn(),
}));

vi.mock("../../../application/runtime/ports/tauriThreads", () => ({
  distributedTaskGraph: vi.fn(),
  respondToServerRequest: vi.fn(),
  respondToServerRequestResult: vi.fn(),
  respondToUserInputRequest: vi.fn(),
}));

vi.mock("../../../application/runtime/ports/tauriAppSettings", () => ({
  getAppSettings: vi.fn().mockResolvedValue({}),
  updateAppSettings: vi.fn(),
}));

vi.mock("../../../application/runtime/ports/tauriRuntime", () => ({
  getRuntimeCapabilitiesSummary: vi.fn(),
  getRuntimeHealth: vi.fn(),
}));

vi.mock("../../../application/runtime/ports/tauriRuntimeDiagnostics", () => ({
  runtimeToolMetricsRead: vi.fn(),
  runtimeToolGuardrailRead: vi.fn(),
}));

vi.mock("../../../application/runtime/ports/tauriOauth", () => ({
  getProvidersCatalog: vi.fn(),
  listOAuthAccounts: vi.fn(),
  listOAuthPools: vi.fn(),
}));

import { subscribeScopedRuntimeUpdatedEvents } from "../../../application/runtime/ports/runtimeUpdatedEvents";
import { getMissionControlSnapshot } from "../../../application/runtime/ports/tauriMissionControl";
import {
  cancelRuntimeJob as interruptAgentTask,
  submitRuntimeJobApprovalDecision as submitTaskApprovalDecision,
  listRuntimeJobs,
  resumeRuntimeJob as resumeAgentTask,
} from "../../../application/runtime/ports/tauriRuntimeJobs";
import {
  getRuntimeCapabilitiesSummary,
  getRuntimeHealth,
} from "../../../application/runtime/ports/tauriRuntime";
import {
  runtimeToolGuardrailRead,
  runtimeToolMetricsRead,
} from "../../../application/runtime/ports/tauriRuntimeDiagnostics";
import {
  getProvidersCatalog,
  listOAuthAccounts,
  listOAuthPools,
} from "../../../application/runtime/ports/tauriOauth";
import type { RuntimeKernel } from "../../../application/runtime/kernel/runtimeKernelTypes";
import { parseRepositoryExecutionContract } from "../../../application/runtime/facades/runtimeRepositoryExecutionContract";

type MockAgentTaskSummary = AgentTaskSummary;
let runtimeUpdatedListener: ((event: RuntimeUpdatedEvent) => void) | null = null;
const getMissionControlSnapshotMock = vi.mocked(getMissionControlSnapshot);
const submitTaskApprovalDecisionMock = vi.mocked(submitTaskApprovalDecision) as unknown as Mock;
const interruptAgentTaskMock = vi.mocked(interruptAgentTask) as unknown as Mock;
const resumeAgentTaskMock = vi.mocked(resumeAgentTask) as unknown as Mock;

function createEmptyMissionControlSnapshot() {
  return {
    source: "runtime_snapshot_v1" as const,
    generatedAt: 0,
    workspaces: [],
    tasks: [],
    runs: [],
    reviewPacks: [],
  };
}

function mockRuntimeTasks(tasks: MockAgentTaskSummary[]) {
  const runs = tasks.map((task) => task.runSummary ?? projectAgentTaskSummaryToRunSummary(task));
  getMissionControlSnapshotMock.mockResolvedValue({
    ...createEmptyMissionControlSnapshot(),
    tasks: tasks.map((task) => projectRuntimeTaskToTaskSummary(task)),
    runs,
    reviewPacks: runs
      .map((run) => projectCompletedRunToReviewPackSummary(run))
      .filter((reviewPack) => reviewPack !== null),
  });
  vi.mocked(listRuntimeJobs).mockResolvedValue([]);
}

beforeEach(() => {
  runtimeUpdatedListener = null;
  vi.mocked(subscribeScopedRuntimeUpdatedEvents).mockImplementation((_options, listener) => {
    runtimeUpdatedListener = listener;
    return () => {
      if (runtimeUpdatedListener === listener) {
        runtimeUpdatedListener = null;
      }
    };
  });
  startRuntimeJobWithRemoteSelectionMock.mockResolvedValue({});
  vi.mocked(getRuntimeCapabilitiesSummary).mockResolvedValue({
    mode: "tauri",
    methods: ["code_health"],
    features: [],
    wsEndpointPath: "/ws",
    error: null,
  });
  vi.mocked(getRuntimeHealth).mockResolvedValue({
    app: "hugecode-runtime",
    version: "1.0.0",
    status: "ok",
  });
  vi.mocked(getProvidersCatalog).mockResolvedValue([]);
  vi.mocked(listOAuthAccounts).mockResolvedValue([]);
  vi.mocked(listOAuthPools).mockResolvedValue([]);
  readRepositoryExecutionContractMock.mockResolvedValue(null);
  getMissionControlSnapshotMock.mockResolvedValue(createEmptyMissionControlSnapshot());
  vi.mocked(listRuntimeJobs).mockResolvedValue([]);
  vi.mocked(runtimeToolMetricsRead).mockResolvedValue({
    totals: {
      attemptedTotal: 10,
      startedTotal: 10,
      completedTotal: 10,
      successTotal: 10,
      validationFailedTotal: 0,
      runtimeFailedTotal: 0,
      timeoutTotal: 0,
      blockedTotal: 0,
    },
    byTool: {},
    recent: [],
    updatedAt: 1_700_000_000_000,
    windowSize: 500,
    channelHealth: {
      status: "healthy",
      reason: null,
      lastErrorCode: null,
      updatedAt: 1_700_000_000_000,
    },
    circuitBreakers: [],
  });
  vi.mocked(runtimeToolGuardrailRead).mockResolvedValue({
    windowSize: 500,
    payloadLimitBytes: 65_536,
    computerObserveRateLimitPerMinute: 12,
    circuitWindowSize: 50,
    circuitMinCompleted: 20,
    circuitOpenMs: 600_000,
    halfOpenMaxProbes: 3,
    halfOpenRequiredSuccesses: 2,
    channelHealth: {
      status: "healthy",
      reason: null,
      lastErrorCode: null,
      updatedAt: 1_700_000_000_000,
    },
    circuitBreakers: [],
    updatedAt: 1_700_000_000_000,
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
});

function buildTask(
  taskId: string,
  status: MockAgentTaskSummary["status"],
  title: string
): MockAgentTaskSummary {
  const now = Date.now();
  return {
    taskId,
    workspaceId: "ws-approval",
    threadId: null,
    requestId: null,
    title,
    status,
    accessMode: "on-request",
    provider: null,
    modelId: null,
    routedProvider: null,
    routedModelId: null,
    routedPool: null,
    routedSource: null,
    checkpointId: null,
    traceId: null,
    recovered: false,
    distributedStatus: null,
    currentStep: 1,
    createdAt: now,
    updatedAt: now,
    startedAt: now,
    completedAt: null,
    errorCode: null,
    errorMessage: null,
    pendingApprovalId: status === "awaiting_approval" ? `${taskId}-approval` : null,
    steps: [],
  } as MockAgentTaskSummary;
}

function buildRuntimeUpdatedEvent(
  revision: string,
  checkpointWriteFailedTotal: number,
  checkpointWriteTotal: number
): RuntimeUpdatedEvent {
  const params = {
    revision,
    reason: "agent_task_durability_degraded",
    scope: ["agents"],
    mode: "active",
    degraded: true,
    checkpointWriteFailedTotal,
    checkpointWriteTotal,
  };
  return {
    event: {
      workspace_id: "workspace-local",
      message: {
        method: "runtime/updated",
        params,
      },
    },
    params,
    scope: ["agents"],
    reason: "agent_task_durability_degraded",
    eventWorkspaceId: "workspace-local",
    paramsWorkspaceId: null,
    isWorkspaceLocalEvent: true,
  };
}

function createRuntimeKernelValue(): RuntimeKernel {
  const runtimeClientMode = "runtime-gateway-web" as const;
  const workspaceClientRuntimeMode = "connected" as const;
  const runtimeGateway = {
    detectMode: vi.fn(() => runtimeClientMode),
    discoverLocalTargets: vi.fn(),
    configureManualWebTarget: vi.fn(),
    readCapabilitiesSummary: vi.fn(),
    readMissionControlSnapshot: vi.fn(),
  };

  return {
    runtimeGateway,
    workspaceClientRuntimeGateway: {
      readRuntimeMode: vi.fn(() => workspaceClientRuntimeMode),
      subscribeRuntimeMode: vi.fn(() => () => undefined),
      discoverLocalRuntimeGatewayTargets: vi.fn(),
      configureManualWebRuntimeGatewayTarget: vi.fn(),
    },
    workspaceClientRuntime: {
      surface: "shared-workspace-client",
      settings: {
        getAppSettings: vi.fn(),
        updateAppSettings: vi.fn(),
        syncRuntimeGatewayProfileFromAppSettings: vi.fn(),
      },
      oauth: {
        listAccounts: vi.fn(),
        listPools: vi.fn(),
        listPoolMembers: vi.fn(),
        getPrimaryAccount: vi.fn(),
        setPrimaryAccount: vi.fn(),
        applyPool: vi.fn(),
        bindPoolAccount: vi.fn(),
        runLogin: vi.fn(),
        getAccountInfo: vi.fn(),
        getProvidersCatalog: vi.fn(),
      },
      models: {
        getModelList: vi.fn(),
        getConfigModel: vi.fn(),
      },
      workspaceCatalog: {
        listWorkspaces: vi.fn(),
      },
      missionControl: {
        readMissionControlSnapshot: vi.fn(() => getMissionControlSnapshot()),
      },
      agentControl: {
        startRuntimeJob: vi.fn(),
        cancelRuntimeJob: vi.fn(),
        resumeRuntimeJob: vi.fn(),
        interveneRuntimeJob: vi.fn(),
        subscribeRuntimeJob: vi.fn(),
        listRuntimeJobs: vi.fn(),
        submitRuntimeJobApprovalDecision: vi.fn(),
      },
      threads: {
        listThreads: vi.fn(),
        createThread: vi.fn(),
        resumeThread: vi.fn(),
        archiveThread: vi.fn(),
      },
      git: {
        listChanges: vi.fn(),
        readDiff: vi.fn(),
        listBranches: vi.fn(),
        createBranch: vi.fn(),
        checkoutBranch: vi.fn(),
        readLog: vi.fn(),
        stageChange: vi.fn(),
        stageAll: vi.fn(),
        unstageChange: vi.fn(),
        revertChange: vi.fn(),
        commit: vi.fn(),
      },
      workspaceFiles: {
        listWorkspaceFileEntries: vi.fn(),
        readWorkspaceFile: vi.fn(),
      },
      review: {
        listReviewPacks: vi.fn(),
      },
    },
    desktopHost: {
      getAppSettings: vi.fn(),
      isMobileRuntime: vi.fn(),
      updateAppSettings: vi.fn(),
      orbitConnectTest: vi.fn(),
      orbitSignInStart: vi.fn(),
      orbitSignInPoll: vi.fn(),
      orbitSignOut: vi.fn(),
      orbitRunnerStart: vi.fn(),
      orbitRunnerStop: vi.fn(),
      orbitRunnerStatus: vi.fn(),
      tailscaleStatus: vi.fn(),
      tailscaleDaemonCommandPreview: vi.fn(),
      tailscaleDaemonStart: vi.fn(),
      tailscaleDaemonStop: vi.fn(),
      tailscaleDaemonStatus: vi.fn(),
    },
    getWorkspaceScope: vi.fn((workspaceId: string) => ({
      workspaceId,
      runtimeGateway,
      runtimeAgentControl: createRuntimeAgentControlFacade(
        workspaceId,
        createRuntimeAgentControlDependencies(workspaceId)
      ),
    })),
  };
}

function render(ui: Parameters<typeof rtlRender>[0]) {
  return rtlRender(
    <RuntimeKernelProvider value={createRuntimeKernelValue()}>{ui}</RuntimeKernelProvider>
  );
}

describe("WorkspaceHomeAgentRuntimeOrchestration", () => {
  it("renders fixed mission control sections for launch, continuity, approval pressure, and run list", async () => {
    mockRuntimeTasks([buildTask("task-running", "running", "Ship UI")]);

    render(<WorkspaceHomeAgentRuntimeOrchestration workspaceId="ws-approval" />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Launch readiness" })).toBeTruthy();
      expect(screen.getByRole("heading", { name: "Continuity readiness" })).toBeTruthy();
      expect(screen.getByRole("heading", { name: "Approval pressure" })).toBeTruthy();
      expect(screen.getByRole("heading", { name: "Run list" })).toBeTruthy();
    });
  });

  it("shows repo-derived launch defaults and uses the repo default profile when untouched", async () => {
    mockRuntimeTasks([]);
    readRepositoryExecutionContractMock.mockResolvedValue(
      parseRepositoryExecutionContract(
        JSON.stringify({
          version: 1,
          defaults: {
            executionProfileId: "operator-review",
            validationPresetId: "review-first",
            preferredBackendIds: ["backend-policy-a"],
          },
          sourceMappings: {
            manual: {
              executionProfileId: "operator-review",
              validationPresetId: "review-first",
            },
          },
          validationPresets: [
            {
              id: "review-first",
              commands: ["pnpm validate:fast"],
            },
          ],
        })
      )
    );

    render(<WorkspaceHomeAgentRuntimeOrchestration workspaceId="ws-approval" />);

    await waitFor(() => {
      expect(screen.getByText("Repo source mapping: manual")).toBeTruthy();
      expect(screen.getByText("Repo profile default: operator-review")).toBeTruthy();
      expect(screen.getByText("Repo backend preference: backend-policy-a")).toBeTruthy();
      expect(screen.getByText("Repo validation preset: review-first")).toBeTruthy();
      expect((screen.getByLabelText("Execution profile") as HTMLSelectElement).value).toBe(
        "operator-review"
      );
    });
  });

  it("shows continuation inheritance details when retrying a source-linked run", async () => {
    mockRuntimeTasks([
      {
        ...buildTask("task-retry", "failed", "Review continuation"),
        taskSource: {
          kind: "github_issue",
          label: "GitHub issue #44 · ku0/hugecode",
          shortLabel: "Issue #44",
          title: "Review continuation",
          reference: "#44",
          url: "https://github.com/ku0/hugecode/issues/44",
        },
        executionProfileId: null,
        relaunchContext: {
          sourceTaskId: "runtime-task:task-retry",
          sourceRunId: "run-44",
          sourceReviewPackId: "review-pack:run-44",
          summary: "Retry from runtime-owned relaunch context.",
          failureClass: "validation_failed",
          recommendedActions: ["retry"],
        },
      } as MockAgentTaskSummary,
    ]);
    readRepositoryExecutionContractMock.mockResolvedValue(
      parseRepositoryExecutionContract(
        JSON.stringify({
          version: 1,
          defaults: {
            executionProfileId: "balanced-delegate",
            validationPresetId: "standard",
          },
          sourceMappings: {
            github_issue: {
              executionProfileId: "operator-review",
              validationPresetId: "review-first",
              accessMode: "read-only",
              preferredBackendIds: ["backend-policy-a"],
            },
          },
          validationPresets: [
            {
              id: "standard",
              commands: ["pnpm validate"],
            },
            {
              id: "review-first",
              commands: ["pnpm validate:fast"],
            },
          ],
        })
      )
    );

    render(<WorkspaceHomeAgentRuntimeOrchestration workspaceId="ws-approval" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => {
      expect(screen.queryByText("Repo source mapping: github_issue")).toBeNull();
      expect(screen.getAllByText("Validation preset: standard").length).toBeGreaterThan(0);
      expect(screen.getByText("Access mode: on-request")).toBeTruthy();
      expect((screen.getByLabelText("Execution profile") as HTMLSelectElement).value).toBe(
        "balanced-delegate"
      );
    });
  });

  it("shows blocked launch readiness when runtime capabilities are unavailable", async () => {
    mockRuntimeTasks([]);
    vi.mocked(getRuntimeCapabilitiesSummary).mockResolvedValue({
      mode: "unavailable",
      methods: [],
      features: [],
      wsEndpointPath: null,
      error: "Runtime capabilities unavailable.",
    });

    render(<WorkspaceHomeAgentRuntimeOrchestration workspaceId="ws-approval" />);

    await waitFor(() => {
      expect(screen.getByText("Launch readiness blocked")).toBeTruthy();
      expect(
        screen.getByText(/Runtime transport: Runtime capabilities unavailable\./)
      ).toBeTruthy();
    });

    fireEvent.change(screen.getByPlaceholderText("Mission brief for agent"), {
      target: { value: "Inspect the runtime launch path." },
    });

    expect(screen.getByRole("button", { name: "Start mission run" }).hasAttribute("disabled")).toBe(
      true
    );
  });

  it("shows route-specific readiness detail when no provider route is ready", async () => {
    mockRuntimeTasks([]);
    vi.mocked(getProvidersCatalog).mockResolvedValue([
      {
        providerId: "openai",
        displayName: "OpenAI",
        pool: "codex",
        oauthProviderId: "codex",
        aliases: [],
        defaultModelId: null,
        available: true,
        supportsNative: true,
        supportsOpenaiCompat: true,
        registryVersion: "1",
      },
    ]);
    vi.mocked(listOAuthAccounts).mockResolvedValue([]);
    vi.mocked(listOAuthPools).mockResolvedValue([]);

    render(<WorkspaceHomeAgentRuntimeOrchestration workspaceId="ws-approval" />);

    await waitFor(() => {
      expect(screen.getByText("Launch readiness blocked")).toBeTruthy();
      expect(
        screen.getByText(/Automatic workspace routing: 0\/1 provider routes ready\./)
      ).toBeTruthy();
    });

    fireEvent.change(screen.getByPlaceholderText("Mission brief for agent"), {
      target: { value: "Inspect provider route readiness." },
    });

    expect(screen.getByRole("button", { name: "Start mission run" }).hasAttribute("disabled")).toBe(
      true
    );
  });

  it("blocks launch when execution reliability falls below the success gate", async () => {
    mockRuntimeTasks([]);
    vi.mocked(runtimeToolMetricsRead).mockResolvedValue({
      totals: {
        attemptedTotal: 20,
        startedTotal: 20,
        completedTotal: 20,
        successTotal: 16,
        validationFailedTotal: 1,
        runtimeFailedTotal: 2,
        timeoutTotal: 1,
        blockedTotal: 1,
      },
      byTool: {},
      recent: [],
      updatedAt: 1_700_000_000_000,
      windowSize: 500,
      channelHealth: {
        status: "healthy",
        reason: null,
        lastErrorCode: null,
        updatedAt: 1_700_000_000_000,
      },
      errorCodeTopK: [{ errorCode: "REQUEST_TIMEOUT", count: 1 }],
      circuitBreakers: [],
    });

    render(<WorkspaceHomeAgentRuntimeOrchestration workspaceId="ws-approval" />);

    await waitFor(() => {
      expect(screen.getByText("Launch readiness blocked")).toBeTruthy();
      expect(
        screen.getByText(
          /Execution reliability: Runtime tool success rate is 80.0%, below the 95.0% launch threshold\./
        )
      ).toBeTruthy();
    });

    fireEvent.change(screen.getByPlaceholderText("Mission brief for agent"), {
      target: { value: "Inspect runtime tool failures before another launch." },
    });

    expect(screen.getByRole("button", { name: "Start mission run" }).hasAttribute("disabled")).toBe(
      true
    );
  });

  it("keeps auto launch available when local routing remains available", async () => {
    mockRuntimeTasks([]);
    vi.mocked(getProvidersCatalog).mockResolvedValue([
      {
        providerId: "native",
        displayName: "Native runtime",
        pool: null,
        oauthProviderId: null,
        aliases: [],
        defaultModelId: null,
        available: true,
        supportsNative: true,
        supportsOpenaiCompat: false,
        registryVersion: "1",
      },
      {
        providerId: "openai",
        displayName: "OpenAI",
        pool: "codex",
        oauthProviderId: "codex",
        aliases: [],
        defaultModelId: null,
        available: true,
        supportsNative: true,
        supportsOpenaiCompat: true,
        registryVersion: "1",
      },
    ]);
    vi.mocked(listOAuthAccounts).mockResolvedValue([]);
    vi.mocked(listOAuthPools).mockResolvedValue([]);

    render(<WorkspaceHomeAgentRuntimeOrchestration workspaceId="ws-approval" />);

    await waitFor(() => {
      expect(screen.getByText("Launch readiness confirmed")).toBeTruthy();
      expect(
        screen.getAllByText(/local\/native routing remains available/i).length
      ).toBeGreaterThan(0);
    });

    fireEvent.change(screen.getByPlaceholderText("Mission brief for agent"), {
      target: { value: "Inspect local launch fallback readiness." },
    });

    expect(screen.getByRole("button", { name: "Start mission run" }).hasAttribute("disabled")).toBe(
      false
    );
  });

  it("interrupts only stale pending approval tasks", async () => {
    const now = Date.now();
    mockRuntimeTasks([
      {
        ...buildTask("runtime-approval-fresh", "awaiting_approval", "Fresh approval"),
        pendingApprovalId: "approval-fresh",
        updatedAt: now - 30_000,
      },
      {
        ...buildTask("runtime-approval-stale", "awaiting_approval", "Stale approval"),
        pendingApprovalId: "approval-stale",
        updatedAt: now - 20 * 60_000,
      },
    ]);
    submitTaskApprovalDecisionMock.mockResolvedValue({
      recorded: true,
      approvalId: "approval-stale",
      taskId: "runtime-approval-stale",
      status: "running",
      message: "ok",
    });
    vi.mocked(startAgentTask).mockResolvedValue({} as Awaited<ReturnType<typeof startAgentTask>>);
    interruptAgentTaskMock.mockResolvedValue({
      accepted: true,
      taskId: "runtime-approval-stale",
      status: "interrupted",
      message: "ok",
    });

    await act(async () => {
      render(<WorkspaceHomeAgentRuntimeOrchestration workspaceId="ws-approval" />);
    });

    await waitFor(() => {
      expect(screen.getByText("Stale pending: 1")).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Interrupt stale input (1)" }));

    await waitFor(() => {
      expect(interruptAgentTask).toHaveBeenCalledTimes(1);
      expect(interruptAgentTask).toHaveBeenCalledWith({
        runId: "runtime-approval-stale",
        reason: "ui:webmcp-runtime-stale-approval-interrupt",
      });
    });
  }, 10_000);

  it("shows approval queue summary and approves the oldest pending item", async () => {
    const now = Date.now();
    mockRuntimeTasks([
      {
        ...buildTask("runtime-approval-new", "awaiting_approval", "New approval"),
        pendingApprovalId: "approval-new",
        updatedAt: now - 5_000,
      },
      {
        ...buildTask("runtime-approval-old", "awaiting_approval", "Old approval"),
        pendingApprovalId: "approval-old",
        updatedAt: now - 30_000,
      },
    ]);
    submitTaskApprovalDecisionMock.mockResolvedValue({
      recorded: true,
      approvalId: "approval-old",
      taskId: "runtime-approval-old",
      status: "running",
      message: "ok",
    });
    vi.mocked(startAgentTask).mockResolvedValue({} as Awaited<ReturnType<typeof startAgentTask>>);
    interruptAgentTaskMock.mockResolvedValue({
      accepted: true,
      taskId: "runtime-approval-old",
      status: "interrupted",
      message: "ok",
    });

    render(<WorkspaceHomeAgentRuntimeOrchestration workspaceId="ws-approval" />);

    await waitFor(() => {
      expect(screen.getByText("Approval queue (2)")).toBeTruthy();
      expect(screen.getByText("Oldest pending: Old approval")).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Approve oldest request" }));

    await waitFor(() => {
      expect(submitTaskApprovalDecision).toHaveBeenCalledWith({
        approvalId: "approval-old",
        decision: "approved",
        reason: "ui:webmcp-runtime-approved",
      });
    });
  });

  it("renders control-device supervision copy for handoff and review-pack completion", async () => {
    const now = Date.now();
    mockRuntimeTasks([
      {
        ...buildTask("runtime-review-1", "completed", "Reviewable task"),
        updatedAt: now,
        completedAt: now,
        checkpointId: "checkpoint-1",
        traceId: "trace-1",
        routing: {
          backendId: "backend-primary",
          provider: "openai",
          providerLabel: "OpenAI",
          pool: "codex",
          routeLabel: "Primary backend",
          routeHint: "Runtime confirmed backend placement.",
          health: "ready",
          resolutionSource: "workspace_default",
          lifecycleState: "confirmed",
          enabledAccountCount: 1,
          readyAccountCount: 1,
          enabledPoolCount: 1,
        },
        profileReadiness: {
          ready: true,
          health: "ready",
          summary: "Profile ready.",
          issues: [],
        },
      },
    ]);
    submitTaskApprovalDecisionMock.mockResolvedValue({
      recorded: true,
      approvalId: "approval-old",
      taskId: "runtime-review-1",
      status: "completed",
      message: "ok",
    });
    vi.mocked(startAgentTask).mockResolvedValue({} as Awaited<ReturnType<typeof startAgentTask>>);
    interruptAgentTaskMock.mockResolvedValue({
      accepted: true,
      taskId: "runtime-review-1",
      status: "interrupted",
      message: "ok",
    });

    render(<WorkspaceHomeAgentRuntimeOrchestration workspaceId="ws-approval" />);

    await waitFor(() => {
      expect(
        screen.getByText(
          /Control devices can observe runs started elsewhere, approve or intervene with low overhead/i
        )
      ).toBeTruthy();
    });

    expect(screen.getByText("Control-device loop")).toBeTruthy();
    expect(
      screen.getByText(/Resume from checkpoint or handoff using published checkpoint/i)
    ).toBeTruthy();
    expect(
      screen.getByText(/completed run moves? into Review Pack as the primary finish-line surface/i)
    ).toBeTruthy();
    expect(screen.getByText("Reviewable task")).toBeTruthy();
    expect(screen.getByText("Review Pack is ready for control-device review.")).toBeTruthy();
    expect(
      screen.getByText("Checkpoint checkpoint-1 is ready for resume or handoff.")
    ).toBeTruthy();
  });

  it("submits approval decisions for awaiting approval tasks", async () => {
    mockRuntimeTasks([
      {
        ...buildTask("runtime-approval-1", "awaiting_approval", "Need approval"),
        pendingApprovalId: "approval-1",
      },
    ]);
    submitTaskApprovalDecisionMock.mockResolvedValue({
      recorded: true,
      approvalId: "approval-1",
      taskId: "runtime-approval-1",
      status: "running",
      message: "ok",
    });
    vi.mocked(startAgentTask).mockResolvedValue({} as Awaited<ReturnType<typeof startAgentTask>>);
    interruptAgentTaskMock.mockResolvedValue({
      accepted: true,
      taskId: "runtime-approval-1",
      status: "interrupted",
      message: "ok",
    });

    render(<WorkspaceHomeAgentRuntimeOrchestration workspaceId="ws-approval" />);

    await waitFor(() => {
      expect(screen.getByText("Need approval")).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Approve" }));

    await waitFor(() => {
      expect(submitTaskApprovalDecision).toHaveBeenCalledWith({
        approvalId: "approval-1",
        decision: "approved",
        reason: "ui:webmcp-runtime-approved",
      });
    });
  });

  it("shows placement lifecycle detail for runtime runs", async () => {
    mockRuntimeTasks([
      {
        ...buildTask("runtime-running-1", "running", "Running task"),
        executionGraph: {
          graphId: "graph-runtime-running-1",
          nodes: [
            {
              id: "graph-runtime-running-1:root",
              kind: "plan",
              status: "running",
              executorKind: "sub_agent",
              executorSessionId: "session-1",
              preferredBackendIds: ["backend-primary"],
              resolvedBackendId: null,
              placementLifecycleState: "requested",
              placementResolutionSource: "explicit_preference",
            },
          ],
          edges: [],
        },
      },
    ]);
    vi.mocked(startAgentTask).mockResolvedValue({} as Awaited<ReturnType<typeof startAgentTask>>);
    interruptAgentTaskMock.mockResolvedValue({
      accepted: true,
      taskId: "runtime-running-1",
      status: "interrupted",
      message: "ok",
    });

    render(<WorkspaceHomeAgentRuntimeOrchestration workspaceId="ws-approval" />);

    await waitFor(() => {
      expect(screen.getByText("Placement: Placement is unresolved.")).toBeTruthy();
      expect(screen.getByText("Graph: 1 node(s), 0 edge(s)")).toBeTruthy();
      expect(screen.getByText("Sub-agents: 1")).toBeTruthy();
      expect(
        screen.getByText(
          "Routing detail: Runtime has not confirmed a concrete backend placement yet. This run does not require workspace OAuth routing."
        )
      ).toBeTruthy();
    });
  });

  it("accepts runtime-published delegated session state without breaking mission control rendering", async () => {
    mockRuntimeTasks([
      {
        ...buildTask("runtime-running-2", "running", "Delegated runtime task"),
        runSummary: {
          id: "runtime-running-2",
          taskId: "runtime-running-2",
          workspaceId: "ws-approval",
          state: "running",
          currentStepIndex: 0,
          title: "Delegated runtime task",
          summary: "Runtime is coordinating delegated work.",
          startedAt: 1,
          finishedAt: null,
          updatedAt: 2,
          warnings: [],
          validations: [],
          artifacts: [],
          changedPaths: [],
          nextAction: {
            label: "Approve delegated review",
            action: "resume",
            detail: "A delegated reviewer is waiting for approval before continuing.",
          },
          approval: {
            status: "pending_decision",
            approvalId: "approval-review-1",
            label: "Approval required",
            summary: "Runtime is waiting for an approval decision before continuing.",
          },
          operatorSnapshot: {
            summary: "Two delegated sessions are active under this run.",
            runtimeLabel: "Codex runtime",
            provider: "openai",
            modelId: "gpt-5.4",
            reasoningEffort: "medium",
            backendId: "backend-primary",
            machineId: "machine-1",
            machineSummary: "Primary backend",
            workspaceRoot: "/tmp/workspace",
            currentActivity: "Waiting on delegated review",
            blocker: "A reviewer session is awaiting approval.",
            recentEvents: [
              {
                kind: "tool_start",
                label: "Planner delegated implementation",
                detail: "Spawned reviewer and implementation sessions.",
                at: 1_700_000_000_000,
              },
              {
                kind: "approval_wait",
                label: "Reviewer requested approval",
                detail: "Approval required before reviewer can continue.",
                at: 1_700_000_100_000,
              },
            ],
          },
          subAgents: [
            {
              sessionId: "session-impl",
              status: "running",
              scopeProfile: "implementation",
              summary: "Implementation session is applying the runtime fix.",
              checkpointState: {
                state: "active",
                lifecycleState: "requested",
                checkpointId: "checkpoint-impl-1",
                traceId: "trace-impl-1",
                recovered: false,
                updatedAt: 1_700_000_000_000,
                resumeReady: false,
                summary: "Checkpoint checkpoint-impl-1 is current.",
              },
            },
            {
              sessionId: "session-review",
              status: "awaiting_approval",
              scopeProfile: "review",
              summary: "Reviewer session is paused for approval.",
              approvalState: {
                status: "pending",
                approvalId: "approval-review-1",
                reason: "Approve reviewer escalation to continue.",
                at: 1_700_000_100_000,
              },
              checkpointState: {
                state: "active",
                lifecycleState: "requested",
                checkpointId: "checkpoint-review-1",
                traceId: "trace-review-1",
                recovered: false,
                updatedAt: 1_700_000_100_000,
                resumeReady: true,
                summary: "Checkpoint checkpoint-review-1 is ready for resume.",
              },
              takeoverBundle: {
                state: "ready",
                pathKind: "resume",
                primaryAction: "resume",
                summary: "Resume is ready once approval is granted.",
                recommendedAction: "Resume delegated review",
              },
            },
          ],
          executionGraph: {
            graphId: "graph-runtime-running-2",
            nodes: [
              {
                id: "root",
                kind: "plan",
                status: "running",
                executorKind: "sub_agent",
                executorSessionId: "session-impl",
                resolvedBackendId: "backend-primary",
                placementLifecycleState: "confirmed",
                placementResolutionSource: "workspace_default",
              },
              {
                id: "review",
                kind: "plan",
                status: "awaiting_approval",
                executorKind: "sub_agent",
                executorSessionId: "session-review",
                resolvedBackendId: "backend-primary",
                placementLifecycleState: "confirmed",
                placementResolutionSource: "workspace_default",
              },
            ],
            edges: [{ fromNodeId: "root", toNodeId: "review", kind: "depends_on" }],
          },
          placement: {
            resolvedBackendId: "backend-primary",
            requestedBackendIds: ["backend-primary"],
            resolutionSource: "workspace_default",
            lifecycleState: "confirmed",
            readiness: "ready",
            healthSummary: "placement_ready",
            attentionReasons: [],
            summary: "Placement is confirmed on backend-primary.",
            rationale: "Workspace default route is healthy.",
          },
        },
      } as MockAgentTaskSummary,
    ]);

    render(<WorkspaceHomeAgentRuntimeOrchestration workspaceId="ws-approval" />);

    await waitFor(() => {
      expect(screen.getByText("Delegated runtime task")).toBeTruthy();
      expect(screen.getByText("Runs: 1")).toBeTruthy();
      expect(screen.getByText("Running: 1")).toBeTruthy();
    });
  });

  it("interrupts active tasks even when current status filter hides them", async () => {
    mockRuntimeTasks([
      buildTask("runtime-running-1", "running", "Running task"),
      buildTask("runtime-completed-1", "completed", "Completed task"),
    ]);
    submitTaskApprovalDecisionMock.mockResolvedValue({
      recorded: true,
      approvalId: "approval-1",
      taskId: "runtime-running-1",
      status: "running",
      message: "ok",
    });
    startRuntimeJobWithRemoteSelectionMock.mockResolvedValue({});
    interruptAgentTaskMock.mockResolvedValue({
      accepted: true,
      taskId: "runtime-running-1",
      status: "interrupted",
      message: "ok",
    });

    render(<WorkspaceHomeAgentRuntimeOrchestration workspaceId="ws-approval" />);

    await waitFor(() => {
      expect(screen.getByText("Running task")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Interrupt active runs (1)" })).toBeTruthy();
    });

    fireEvent.change(screen.getByRole("combobox", { name: "Run state" }), {
      target: { value: "completed" },
    });

    await waitFor(() => {
      expect(screen.queryByText("Running task")).toBeNull();
      expect(screen.getByRole("button", { name: "Interrupt active runs (1)" })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Interrupt active runs (1)" }));

    await waitFor(() => {
      expect(interruptAgentTask).toHaveBeenCalledWith({
        runId: "runtime-running-1",
        reason: "ui:webmcp-runtime-batch-interrupt",
      });
    });
  });

  it("shows filtered empty-state message when status filter has no matches", async () => {
    mockRuntimeTasks([buildTask("runtime-running-1", "running", "Running task")]);
    submitTaskApprovalDecisionMock.mockResolvedValue({
      recorded: true,
      approvalId: "approval-1",
      taskId: "runtime-running-1",
      status: "running",
      message: "ok",
    });
    vi.mocked(startAgentTask).mockResolvedValue({} as Awaited<ReturnType<typeof startAgentTask>>);
    interruptAgentTaskMock.mockResolvedValue({
      accepted: true,
      taskId: "runtime-running-1",
      status: "interrupted",
      message: "ok",
    });

    render(<WorkspaceHomeAgentRuntimeOrchestration workspaceId="ws-approval" />);

    await waitFor(() => {
      expect(screen.getByText("Running task")).toBeTruthy();
    });

    fireEvent.change(screen.getByRole("combobox", { name: "Run state" }), {
      target: { value: "completed" },
    });

    await waitFor(() => {
      expect(screen.getByText("No mission runs match this filter.")).toBeTruthy();
    });
  });

  it("shows recovered marker and resumes recoverable interrupted tasks", async () => {
    const now = Date.now();
    mockRuntimeTasks([
      {
        ...buildTask("runtime-recovered-1", "interrupted", "Recovered task"),
        errorCode: "RUNTIME_RESTART_RECOVERY",
        recovered: true,
        checkpointId: "checkpoint-row-1",
        traceId: "agent-task:runtime-recovered-1",
        updatedAt: now - 5_000,
      },
    ]);
    submitTaskApprovalDecisionMock.mockResolvedValue({
      recorded: true,
      approvalId: "approval-recovered-1",
      taskId: "runtime-recovered-1",
      status: "running",
      message: "ok",
    });
    vi.mocked(startAgentTask).mockResolvedValue({} as Awaited<ReturnType<typeof startAgentTask>>);
    interruptAgentTaskMock.mockResolvedValue({
      accepted: true,
      taskId: "runtime-recovered-1",
      status: "interrupted",
      message: "ok",
    });
    resumeAgentTaskMock.mockResolvedValue({
      accepted: true,
      taskId: "runtime-recovered-1",
      status: "queued",
      message: "Task resume accepted.",
      checkpointId: "checkpoint-123",
    });

    render(<WorkspaceHomeAgentRuntimeOrchestration workspaceId="ws-approval" />);

    await waitFor(() => {
      expect(screen.getByText("Recovered task")).toBeTruthy();
      expect(screen.getByText("Recovered")).toBeTruthy();
      expect(screen.getByText("Checkpoint checkpoint-row-1")).toBeTruthy();
      expect(screen.getByText("Trace agent-task:runtime-recovered-1")).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Resume" }));

    await waitFor(() => {
      expect(resumeAgentTask).toHaveBeenCalledWith({ runId: "runtime-recovered-1" });
      expect(
        screen.getByText("Run runtime-recovered-1 resumed (checkpoint checkpoint-123).")
      ).toBeTruthy();
    });
  });

  it("treats dot.case recoverable error codes as resumable mission runs", async () => {
    const now = Date.now();
    mockRuntimeTasks([
      {
        ...buildTask("runtime-recovered-dot-case", "interrupted", "Recovered dot-case"),
        errorCode: "runtime.task.interrupt.recoverable",
        recovered: false,
        updatedAt: now - 5_000,
      },
    ]);
    submitTaskApprovalDecisionMock.mockResolvedValue({
      recorded: true,
      approvalId: "approval-recovered-dot-case",
      taskId: "runtime-recovered-dot-case",
      status: "running",
      message: "ok",
    });
    vi.mocked(startAgentTask).mockResolvedValue({} as Awaited<ReturnType<typeof startAgentTask>>);
    interruptAgentTaskMock.mockResolvedValue({
      accepted: true,
      taskId: "runtime-recovered-dot-case",
      status: "interrupted",
      message: "ok",
    });
    resumeAgentTaskMock.mockResolvedValue({
      accepted: true,
      taskId: "runtime-recovered-dot-case",
      status: "queued",
      message: "Task resume accepted.",
    });

    render(<WorkspaceHomeAgentRuntimeOrchestration workspaceId="ws-approval" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Resume recoverable runs (1)" })).toBeTruthy();
      expect(screen.getByText("Recovered dot-case")).toBeTruthy();
    });
  });

  it("resumes all recoverable tasks from the runtime toolbar", async () => {
    const now = Date.now();
    mockRuntimeTasks([
      {
        ...buildTask("runtime-recovered-a", "interrupted", "Recovered A"),
        errorCode: "RUNTIME_RESTART_RECOVERY",
        recovered: true,
        updatedAt: now - 20_000,
      },
      {
        ...buildTask("runtime-recovered-b", "interrupted", "Recovered B"),
        recovered: true,
        updatedAt: now - 10_000,
      },
      buildTask("runtime-running-1", "running", "Running task"),
    ]);
    submitTaskApprovalDecisionMock.mockResolvedValue({
      recorded: true,
      approvalId: "approval-any",
      taskId: "runtime-recovered-a",
      status: "running",
      message: "ok",
    });
    vi.mocked(startAgentTask).mockResolvedValue({} as Awaited<ReturnType<typeof startAgentTask>>);
    interruptAgentTaskMock.mockResolvedValue({
      accepted: true,
      taskId: "runtime-running-1",
      status: "interrupted",
      message: "ok",
    });
    resumeAgentTaskMock
      .mockResolvedValueOnce({
        accepted: true,
        taskId: "runtime-recovered-a",
        status: "queued",
        message: "Task resume accepted.",
      })
      .mockResolvedValueOnce({
        accepted: true,
        taskId: "runtime-recovered-b",
        status: "queued",
        message: "Task resume accepted.",
      });

    render(<WorkspaceHomeAgentRuntimeOrchestration workspaceId="ws-approval" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Resume recoverable runs (2)" })).toBeTruthy();
      expect(screen.getByText("Recovered runs awaiting resume: 2")).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Resume recoverable runs (2)" }));

    await waitFor(() => {
      expect(resumeAgentTask).toHaveBeenCalledTimes(2);
      expect(resumeAgentTask).toHaveBeenNthCalledWith(1, { runId: "runtime-recovered-b" });
      expect(resumeAgentTask).toHaveBeenNthCalledWith(2, { runId: "runtime-recovered-a" });
      expect(screen.getByText("Resumed 2 recoverable run(s).")).toBeTruthy();
    });
  });

  it("shows runtime rejection message when single resume is not accepted", async () => {
    const now = Date.now();
    mockRuntimeTasks([
      {
        ...buildTask("runtime-rejected-1", "interrupted", "Rejected recovery"),
        errorCode: "RUNTIME_RESTART_RECOVERY",
        recovered: true,
        updatedAt: now - 8_000,
      },
    ]);
    submitTaskApprovalDecisionMock.mockResolvedValue({
      recorded: true,
      approvalId: "approval-rejected-1",
      taskId: "runtime-rejected-1",
      status: "running",
      message: "ok",
    });
    vi.mocked(startAgentTask).mockResolvedValue({} as Awaited<ReturnType<typeof startAgentTask>>);
    interruptAgentTaskMock.mockResolvedValue({
      accepted: true,
      taskId: "runtime-rejected-1",
      status: "interrupted",
      message: "ok",
    });
    resumeAgentTaskMock.mockResolvedValue({
      accepted: false,
      taskId: "runtime-rejected-1",
      status: "interrupted",
      message: "Task is not recoverable from runtime restart interruption.",
    });

    render(<WorkspaceHomeAgentRuntimeOrchestration workspaceId="ws-approval" />);

    await waitFor(() => {
      expect(screen.getByText("Rejected recovery")).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Resume" }));

    await waitFor(() => {
      expect(resumeAgentTask).toHaveBeenCalledWith({ runId: "runtime-rejected-1" });
      expect(
        screen.getByText("Task is not recoverable from runtime restart interruption.")
      ).toBeTruthy();
    });
  });

  it("classifies recoverable batch resume outcomes by success rejection and transport failures", async () => {
    const now = Date.now();
    mockRuntimeTasks([
      {
        ...buildTask("runtime-batch-a", "interrupted", "Batch A"),
        errorCode: "RUNTIME_RESTART_RECOVERY",
        recovered: true,
        updatedAt: now - 20_000,
      },
      {
        ...buildTask("runtime-batch-b", "interrupted", "Batch B"),
        errorCode: "RUNTIME_RESTART_RECOVERY",
        recovered: true,
        updatedAt: now - 15_000,
      },
      {
        ...buildTask("runtime-batch-c", "interrupted", "Batch C"),
        errorCode: "RUNTIME_RESTART_RECOVERY",
        recovered: true,
        updatedAt: now - 10_000,
      },
    ]);
    submitTaskApprovalDecisionMock.mockResolvedValue({
      recorded: true,
      approvalId: "approval-batch-any",
      taskId: "runtime-batch-a",
      status: "running",
      message: "ok",
    });
    vi.mocked(startAgentTask).mockResolvedValue({} as Awaited<ReturnType<typeof startAgentTask>>);
    interruptAgentTaskMock.mockResolvedValue({
      accepted: true,
      taskId: "runtime-batch-a",
      status: "interrupted",
      message: "ok",
    });
    resumeAgentTaskMock
      .mockResolvedValueOnce({
        accepted: true,
        taskId: "runtime-batch-a",
        status: "queued",
        message: "Task resume accepted.",
      })
      .mockResolvedValueOnce({
        accepted: false,
        taskId: "runtime-batch-b",
        status: "interrupted",
        code: "runtime.task.resume.not_recoverable",
        message: "Task not recoverable.",
      })
      .mockRejectedValueOnce(new Error("network timeout"));

    render(<WorkspaceHomeAgentRuntimeOrchestration workspaceId="ws-approval" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Resume recoverable runs (3)" })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Resume recoverable runs (3)" }));

    await waitFor(() => {
      expect(resumeAgentTask).toHaveBeenCalledTimes(3);
      expect(
        screen.getByText(
          "Resumed 1 recoverable run(s). 1 rejected by runtime. 1 failed to call resume."
        )
      ).toBeTruthy();
      expect(screen.getByText("Resume errors: runtime.task.resume.not_recoverable")).toBeTruthy();
    });
  });

  it("surfaces nested transport error codes when resume calls reject", async () => {
    const now = Date.now();
    mockRuntimeTasks([
      {
        ...buildTask("runtime-batch-nested", "interrupted", "Batch nested"),
        errorCode: "RUNTIME_RESTART_RECOVERY",
        recovered: true,
        updatedAt: now - 20_000,
      },
    ]);
    submitTaskApprovalDecisionMock.mockResolvedValue({
      recorded: true,
      approvalId: "approval-batch-nested",
      taskId: "runtime-batch-nested",
      status: "running",
      message: "ok",
    });
    vi.mocked(startAgentTask).mockResolvedValue({} as Awaited<ReturnType<typeof startAgentTask>>);
    interruptAgentTaskMock.mockResolvedValue({
      accepted: true,
      taskId: "runtime-batch-nested",
      status: "interrupted",
      message: "ok",
    });
    resumeAgentTaskMock.mockRejectedValueOnce({
      details: {
        error: {
          code: "runtime.transport.fetch_failed",
          message: "",
        },
      },
    });

    render(<WorkspaceHomeAgentRuntimeOrchestration workspaceId="ws-approval" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Resume recoverable runs (1)" })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Resume recoverable runs (1)" }));

    await waitFor(() => {
      expect(resumeAgentTask).toHaveBeenCalledWith({ runId: "runtime-batch-nested" });
      expect(
        screen.getByText("Resumed 0 recoverable run(s). 1 failed to call resume.")
      ).toBeTruthy();
      expect(screen.getByText("Resume errors: runtime.transport.fetch_failed")).toBeTruthy();
    });
  });

  it("shows blocked continuity readiness when runtime review actionability is blocked", async () => {
    mockRuntimeTasks([
      {
        ...buildTask("runtime-review-blocked", "completed", "Blocked review"),
        reviewPackId: "review-pack:runtime-review-blocked",
        reviewActionability: {
          state: "blocked",
          summary: "Review cannot continue until runtime evidence is restored.",
          degradedReasons: ["runtime_evidence_incomplete"],
          actions: [],
        },
      },
    ]);

    render(<WorkspaceHomeAgentRuntimeOrchestration workspaceId="ws-approval" />);

    await waitFor(() => {
      expect(screen.getByText("Continuity readiness blocked")).toBeTruthy();
      expect(screen.getByText(/Review blocked: 1/)).toBeTruthy();
      expect(
        screen.getByText("Review cannot continue until runtime evidence is restored.")
      ).toBeTruthy();
    });
  });

  it("counts handoff-ready runs without exposing them as resume-ready", async () => {
    mockRuntimeTasks([
      {
        ...buildTask("runtime-handoff-only", "interrupted", "Handoff only"),
        missionLinkage: {
          workspaceId: "ws-approval",
          taskId: "runtime-handoff-only",
          runId: "runtime-handoff-only",
          reviewPackId: "review-pack:runtime-handoff-only",
          checkpointId: null,
          traceId: null,
          threadId: "thread-handoff-only",
          requestId: null,
          missionTaskId: "runtime-task:runtime-handoff-only",
          taskEntityKind: "thread",
          recoveryPath: "thread",
          navigationTarget: {
            kind: "thread",
            workspaceId: "ws-approval",
            threadId: "thread-handoff-only",
          },
          summary: "Continue from thread-handoff-only on another control device.",
        },
        checkpointState: {
          state: "interrupted",
          lifecycleState: "interrupted",
          checkpointId: null,
          traceId: null,
          recovered: false,
          updatedAt: Date.now(),
          resumeReady: false,
          recoveredAt: null,
          summary: "Runtime published a handoff path instead of a local resume path.",
        },
      },
    ]);

    render(<WorkspaceHomeAgentRuntimeOrchestration workspaceId="ws-approval" />);

    await waitFor(() => {
      const continuity = within(screen.getByTestId("workspace-runtime-continuity"));
      expect(continuity.getByText(/Handoff ready: 1/)).toBeTruthy();
      expect(screen.getByRole("button", { name: "Resume recoverable runs (0)" })).toBeTruthy();
      expect(
        screen.getByText(
          /Continuity \(handoff\): Continue from thread-handoff-only on another control device\./
        )
      ).toBeTruthy();
    });
  });

  it("counts takeover-bundle resume paths as recoverable even when local checkpoint resume is false", async () => {
    mockRuntimeTasks([
      {
        ...buildTask("runtime-takeover-resume", "interrupted", "Takeover resume"),
        checkpointState: {
          state: "interrupted",
          lifecycleState: "interrupted",
          checkpointId: "checkpoint-takeover-resume",
          traceId: "trace-takeover-resume",
          recovered: true,
          updatedAt: Date.now(),
          resumeReady: false,
          recoveredAt: Date.now(),
          summary: "Checkpoint exists, but local resume is intentionally disabled.",
        },
        missionLinkage: {
          workspaceId: "ws-approval",
          taskId: "runtime-takeover-resume",
          runId: "runtime-takeover-resume",
          reviewPackId: "review-pack:runtime-takeover-resume",
          checkpointId: "checkpoint-takeover-resume",
          traceId: "trace-takeover-resume",
          threadId: "thread-takeover-resume",
          requestId: null,
          missionTaskId: "runtime-task:runtime-takeover-resume",
          taskEntityKind: "thread",
          recoveryPath: "thread",
          navigationTarget: {
            kind: "thread",
            workspaceId: "ws-approval",
            threadId: "thread-takeover-resume",
          },
          summary: "Fallback handoff exists, but takeover should win.",
        },
        takeoverBundle: {
          state: "ready",
          pathKind: "resume",
          primaryAction: "resume",
          summary: "Runtime takeover bundle published the canonical resume path.",
          recommendedAction: "Resume this run from takeover.",
          checkpointId: "checkpoint-takeover-resume",
          traceId: "trace-takeover-resume",
        },
      },
    ]);

    render(<WorkspaceHomeAgentRuntimeOrchestration workspaceId="ws-approval" />);

    await waitFor(() => {
      const continuity = within(screen.getByTestId("workspace-runtime-continuity"));
      expect(screen.getByText(/Recoverable: 1/)).toBeTruthy();
      expect(continuity.getByText(/Handoff ready: 0/)).toBeTruthy();
      expect(screen.getByRole("button", { name: "Resume recoverable runs (1)" })).toBeTruthy();
      expect(
        screen.getByText(
          /Continuity \(resume\): Runtime takeover bundle published the canonical resume path\./
        )
      ).toBeTruthy();
    });
  });

  it("tracks repeated durability warnings by revision, refreshes timeout, and resets on new revision", async () => {
    vi.useFakeTimers();
    mockRuntimeTasks([buildTask("runtime-running-1", "running", "Running task")]);
    submitTaskApprovalDecisionMock.mockResolvedValue({
      recorded: true,
      approvalId: "approval-1",
      taskId: "runtime-running-1",
      status: "running",
      message: "ok",
    });
    vi.mocked(startAgentTask).mockResolvedValue({} as Awaited<ReturnType<typeof startAgentTask>>);
    interruptAgentTaskMock.mockResolvedValue({
      accepted: true,
      taskId: "runtime-running-1",
      status: "interrupted",
      message: "ok",
    });

    const view = render(<WorkspaceHomeAgentRuntimeOrchestration workspaceId="ws-approval" />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText("Running task")).toBeTruthy();

    act(() => {
      runtimeUpdatedListener?.(buildRuntimeUpdatedEvent("durability-rev-1", 5, 17));
    });

    expect(screen.getByTestId("workspace-runtime-durability-warning")).toBeTruthy();
    expect(screen.getByText("Runtime durability degraded")).toBeTruthy();
    expect(screen.getByText(/Reason: agent_task_durability_degraded/)).toBeTruthy();
    expect(screen.getByText(/Revision: durability-rev-1/)).toBeTruthy();
    expect(screen.getByText(/Repeats: x1/)).toBeTruthy();
    expect(screen.getByText(/Checkpoint failed: 5\/17/)).toBeTruthy();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
    });

    act(() => {
      runtimeUpdatedListener?.(buildRuntimeUpdatedEvent("durability-rev-1", 6, 18));
    });

    expect(screen.getByText(/Checkpoint failed: 6\/18/)).toBeTruthy();
    expect(screen.getByText(/Repeats: x2/)).toBeTruthy();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(11_000);
    });
    expect(screen.getByTestId("workspace-runtime-durability-warning")).toBeTruthy();
    expect(screen.getByText(/Revision: durability-rev-1/)).toBeTruthy();
    expect(screen.getByText(/Repeats: x2/)).toBeTruthy();

    act(() => {
      runtimeUpdatedListener?.(buildRuntimeUpdatedEvent("durability-rev-2", 7, 19));
    });

    expect(screen.getByTestId("workspace-runtime-durability-warning")).toBeTruthy();
    expect(screen.getByText(/Revision: durability-rev-2/)).toBeTruthy();
    expect(screen.getByText(/Repeats: x1/)).toBeTruthy();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(25_000);
    });
    expect(screen.getByTestId("workspace-runtime-durability-warning")).toBeTruthy();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(screen.queryByTestId("workspace-runtime-durability-warning")).toBeNull();

    view.unmount();
  });

  it("updates the batch DAG preview as preview-only config changes", async () => {
    mockRuntimeTasks([buildTask("runtime-running-1", "running", "Running task")]);
    submitTaskApprovalDecisionMock.mockResolvedValue({
      recorded: true,
      approvalId: "approval-1",
      taskId: "runtime-running-1",
      status: "running",
      message: "ok",
    });
    vi.mocked(startAgentTask).mockResolvedValue({} as Awaited<ReturnType<typeof startAgentTask>>);
    interruptAgentTaskMock.mockResolvedValue({
      accepted: true,
      taskId: "runtime-running-1",
      status: "interrupted",
      message: "ok",
    });

    render(<WorkspaceHomeAgentRuntimeOrchestration workspaceId="ws-approval" />);

    await act(async () => {
      fireEvent.change(screen.getByLabelText("Batch config (preview only)"), {
        target: {
          value: JSON.stringify(
            {
              maxParallel: 3,
              tasks: [
                {
                  taskKey: "fetch",
                  dependsOn: [],
                  maxRetries: 1,
                  onFailure: "halt",
                },
                {
                  taskKey: "analyze",
                  dependsOn: ["fetch"],
                  maxRetries: 2,
                  onFailure: "continue",
                },
              ],
            },
            null,
            2
          ),
        },
      });
    });

    expect(screen.getByText("Max parallel: 3")).toBeTruthy();
    expect(screen.getByText("fetch")).toBeTruthy();
    expect(screen.getByText("analyze")).toBeTruthy();
    expect(screen.getByText("fetch -> analyze")).toBeTruthy();
    expect(screen.getByText("retries: 2")).toBeTruthy();
  });

  it("shows invalid dependency and cycle hints in the batch preview", async () => {
    mockRuntimeTasks([buildTask("runtime-running-1", "running", "Running task")]);
    submitTaskApprovalDecisionMock.mockResolvedValue({
      recorded: true,
      approvalId: "approval-1",
      taskId: "runtime-running-1",
      status: "running",
      message: "ok",
    });
    vi.mocked(startAgentTask).mockResolvedValue({} as Awaited<ReturnType<typeof startAgentTask>>);
    interruptAgentTaskMock.mockResolvedValue({
      accepted: true,
      taskId: "runtime-running-1",
      status: "interrupted",
      message: "ok",
    });

    render(<WorkspaceHomeAgentRuntimeOrchestration workspaceId="ws-approval" />);

    await act(async () => {
      fireEvent.change(screen.getByLabelText("Batch config (preview only)"), {
        target: {
          value: JSON.stringify(
            {
              maxParallel: 2,
              tasks: [
                {
                  taskKey: "plan",
                  dependsOn: ["missing"],
                  maxRetries: 1,
                  onFailure: "halt",
                },
                {
                  taskKey: "build",
                  dependsOn: ["review"],
                  maxRetries: 1,
                  onFailure: "continue",
                },
                {
                  taskKey: "review",
                  dependsOn: ["build"],
                  maxRetries: 1,
                  onFailure: "continue",
                },
              ],
            },
            null,
            2
          ),
        },
      });
    });

    expect(
      screen.getByText('Dependency hint: "plan" depends on missing task "missing".')
    ).toBeTruthy();
    expect(screen.getByText("Cycle hint: build -> review -> build.")).toBeTruthy();
  });

  it("renders outcome summary labels for success failed skipped and retried preview semantics", async () => {
    mockRuntimeTasks([buildTask("runtime-running-1", "running", "Running task")]);
    submitTaskApprovalDecisionMock.mockResolvedValue({
      recorded: true,
      approvalId: "approval-1",
      taskId: "runtime-running-1",
      status: "running",
      message: "ok",
    });
    vi.mocked(startAgentTask).mockResolvedValue({} as Awaited<ReturnType<typeof startAgentTask>>);
    interruptAgentTaskMock.mockResolvedValue({
      accepted: true,
      taskId: "runtime-running-1",
      status: "interrupted",
      message: "ok",
    });

    render(<WorkspaceHomeAgentRuntimeOrchestration workspaceId="ws-approval" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Sync runs" })).toBeTruthy();
    });

    expect(
      screen.getByText(
        "Outcome labels: success = completed task; failed = retries exhausted; skipped = blocked by dependencies or failure policy; retried = task rerun up to maxRetries."
      )
    ).toBeTruthy();
  });

  it("keeps start mission run payload unchanged when batch preview config changes", async () => {
    mockRuntimeTasks([]);
    submitTaskApprovalDecisionMock.mockResolvedValue({
      recorded: true,
      approvalId: "approval-1",
      taskId: "runtime-running-1",
      status: "running",
      message: "ok",
    });
    vi.mocked(startAgentTask).mockResolvedValue({} as Awaited<ReturnType<typeof startAgentTask>>);
    render(<WorkspaceHomeAgentRuntimeOrchestration workspaceId="ws-approval" />);

    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText("Mission brief for agent"), {
        target: { value: "Inspect src/runtime and summarize." },
      });

      fireEvent.change(screen.getByLabelText("Batch config (preview only)"), {
        target: {
          value: JSON.stringify(
            {
              maxParallel: 4,
              tasks: [
                {
                  taskKey: "task-a",
                  dependsOn: [],
                  maxRetries: 2,
                  onFailure: "skip",
                },
              ],
            },
            null,
            2
          ),
        },
      });
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Start mission run" })).toHaveProperty(
        "disabled",
        false
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Start mission run" }));

    await waitFor(() => {
      expect(startRuntimeJobWithRemoteSelectionMock).toHaveBeenCalledWith({
        workspaceId: "ws-approval",
        title: null,
        validationPresetId: "standard",
        accessMode: "on-request",
        executionMode: "single",
        missionBrief: {
          objective: "Inspect src/runtime and summarize.",
          doneDefinition: null,
          constraints: null,
          riskLevel: "medium",
          requiredCapabilities: null,
          maxSubtasks: null,
          preferredBackendIds: null,
          permissionSummary: {
            accessMode: "on-request",
            allowNetwork: null,
            writableRoots: null,
            toolNames: null,
          },
        },
        steps: [
          {
            kind: "read",
            input: "Inspect src/runtime and summarize.",
          },
        ],
      });
    });
  });
});
