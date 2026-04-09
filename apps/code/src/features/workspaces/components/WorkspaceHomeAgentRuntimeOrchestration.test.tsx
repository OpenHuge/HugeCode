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
import type {
  AgentTaskSummary,
  RuntimeCompositionProfile,
  RuntimeCompositionProfileSummaryV2,
  RuntimeCompositionResolution,
  RuntimeCompositionResolveV2Response,
  RuntimeCompositionSnapshotPublishResponse,
  RuntimeProviderCatalogEntry,
} from "@ku0/code-runtime-host-contract";
import {
  type SettingsShellFraming,
  type WorkspaceClientBindings,
  WorkspaceClientBindingsProvider,
} from "@ku0/code-workspace-client";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import type { WorkspaceInfo } from "../../../types";
import {
  buildRuntimeToolLifecyclePresentationSummary,
  type RuntimeToolLifecycleEvent,
} from "../../../application/runtime/ports/runtimeToolLifecycle";
import { buildRuntimeSessionCheckpointBaseline } from "../../../application/runtime/facades/runtimeSessionCheckpointFacade";
import { buildRuntimeSessionCheckpointPresentationSummary } from "../../../application/runtime/facades/runtimeSessionCheckpointPresentation";
import { resetRuntimeParallelDispatchManagerForTests } from "../../../application/runtime/facades/runtimeParallelDispatchManager";
import { REVIEW_START_DESKTOP_ONLY_MESSAGE } from "../../../application/runtime/ports/threads";
import { RuntimeKernelProvider } from "../../../application/runtime/kernel/RuntimeKernelContext";
import { createRuntimeAgentControlDependencies } from "../../../application/runtime/kernel/createRuntimeAgentControlDependencies";
import {
  RUNTIME_KERNEL_CAPABILITY_KEYS,
  type RuntimeKernelCapabilityKey,
  type RuntimeKernelCapabilityMap,
} from "../../../application/runtime/kernel/runtimeKernelCapabilities";
import {
  createRuntimeProviderRoutePluginDescriptors,
  type RuntimeKernelPluginDescriptor,
} from "../../../application/runtime/kernel/runtimeKernelPlugins";
import type { RuntimeKernelCompositionFacade } from "../../../application/runtime/kernel/runtimeKernelComposition";
import type { RuntimeUpdatedEvent } from "../../../application/runtime/ports/runtimeUpdatedEvents";
import { createRuntimeAgentControlFacade } from "../../../application/runtime/facades/runtimeAgentControlFacade";
import { useWorkspacePersistentFlowState } from "../../../application/runtime/facades/runtimePersistentFlowState";
import type { RuntimeSessionCommandFacade } from "../../../application/runtime/facades/runtimeSessionCommandFacade";
import type { RuntimeKernelPluginCatalogFacade } from "../../../application/runtime/kernel/runtimeKernelPlugins";
import type { RuntimeKernelPluginRegistryFacade } from "../../../application/runtime/kernel/runtimeKernelPluginRegistry";
import { useWorkspaceRuntimeSessionCheckpoint } from "../../shared/hooks/useWorkspaceRuntimeSessionCheckpoint";
import {
  projectAgentTaskSummaryToRunSummary,
  projectCompletedRunToReviewPackSummary,
  projectRuntimeTaskToTaskSummary,
} from "../../../application/runtime/facades/runtimeMissionControlFacade";
import { WorkspaceHomeAgentRuntimeOrchestration } from "./WorkspaceHomeAgentRuntimeOrchestration";

const startRuntimeJobWithRemoteSelectionMock = vi.hoisted(() => vi.fn());
const readRepositoryExecutionContractMock = vi.hoisted(() => vi.fn());
const startAgentTask = vi.hoisted(() => vi.fn());
const prepareRuntimeRunV2Mock = vi.hoisted(() => vi.fn());
const getRuntimeRunV2Mock = vi.hoisted(() => vi.fn());
const subscribeRuntimeRunV2Mock = vi.hoisted(() => vi.fn());
const startRuntimeRunV2Mock = vi.hoisted(() => vi.fn());
const runtimePluginCatalogListMock = vi.hoisted(() =>
  vi.fn<RuntimeKernelPluginCatalogFacade["listPlugins"]>(async () => [])
);
const runtimePluginRegistryListMock = vi.hoisted(() =>
  vi.fn<RuntimeKernelPluginRegistryFacade["listInstalledPackages"]>(async () => [])
);
const runtimePluginRegistryInstallMock = vi.hoisted(() =>
  vi.fn<RuntimeKernelPluginRegistryFacade["installPackage"]>(async () => ({
    package: {} as never,
    installed: true,
    blockedReason: null,
  }))
);
const runtimePluginRegistryUpdateMock = vi.hoisted(() =>
  vi.fn<RuntimeKernelPluginRegistryFacade["updatePackage"]>(async () => ({
    package: null,
    updated: false,
    blockedReason: null,
  }))
);
const runtimePluginRegistryUninstallMock = vi.hoisted(() =>
  vi.fn<RuntimeKernelPluginRegistryFacade["uninstallPackage"]>(async () => ({
    packageRef: "pkg.search.remote",
    removed: true,
    blockedReason: null,
  }))
);
const runtimeCompositionProfilesMock = vi.hoisted(() =>
  vi.fn<RuntimeKernelCompositionFacade["listProfiles"]>(async () => [])
);
const runtimeCompositionProfilesV2Mock = vi.hoisted(() =>
  vi.fn<RuntimeKernelCompositionFacade["listProfilesV2"]>(async () => [])
);
const runtimeCompositionResolutionMock = vi.hoisted(() =>
  vi.fn<RuntimeKernelCompositionFacade["getActiveResolution"]>(async () => null as never)
);
const runtimeCompositionResolutionV2Mock = vi.hoisted(() =>
  vi.fn<RuntimeKernelCompositionFacade["getActiveResolutionV2"]>(async () => null as never)
);
const readBrowserReadinessMock = vi.hoisted(() => vi.fn());
const extractBrowserContentMock = vi.hoisted(() => vi.fn());
const getLastBrowserExtractionResultMock = vi.hoisted(() => vi.fn());
const assessBrowserSurfaceMock = vi.hoisted(() => vi.fn());
const getLastBrowserAssessmentResultMock = vi.hoisted(() => vi.fn());
const workspaceHomeAiWebLabSectionSpy = vi.hoisted(() => vi.fn());
const runtimeCompositionPreviewMock = vi.hoisted(() =>
  vi.fn<RuntimeKernelCompositionFacade["previewResolution"]>(async () => ({
    selectedPlugins: [],
    selectedRouteCandidates: [],
    selectedBackendCandidates: [{ backendId: "backend-primary", sourcePluginId: null }],
    blockedPlugins: [],
    trustDecisions: [],
    provenance: {
      activeProfileId: "workspace-default",
      activeProfileName: "Workspace Default",
      appliedLayerOrder: ["built_in", "user", "workspace", "launch_override"],
      selectorDecisions: {},
    },
  }))
);
const runtimeCompositionPreviewV2Mock = vi.hoisted(() =>
  vi.fn<RuntimeKernelCompositionFacade["previewResolutionV2"]>(async () => null as never)
);
const runtimeCompositionApplyMock = vi.hoisted(() =>
  vi.fn<RuntimeKernelCompositionFacade["applyProfile"]>(async () => ({
    selectedPlugins: [],
    selectedRouteCandidates: [],
    selectedBackendCandidates: [{ backendId: "backend-primary", sourcePluginId: null }],
    blockedPlugins: [],
    trustDecisions: [],
    provenance: {
      activeProfileId: "workspace-default",
      activeProfileName: "Workspace Default",
      appliedLayerOrder: ["built_in", "user", "workspace", "launch_override"],
      selectorDecisions: {},
    },
  }))
);
const runtimeCompositionApplyV2Mock = vi.hoisted(() =>
  vi.fn<RuntimeKernelCompositionFacade["applyProfileV2"]>(async () => null as never)
);
const runtimeCompositionPublishMock = vi.hoisted(() =>
  vi.fn<RuntimeKernelCompositionFacade["publishActiveResolutionV1"]>(async () => null as never)
);
const runtimeCompositionPublishSnapshotMock = vi.hoisted(() =>
  vi.fn<() => Promise<RuntimeCompositionSnapshotPublishResponse>>(async () => ({
    authorityState: "published",
    freshnessState: "current",
    authorityRevision: 1,
    lastAcceptedRevision: 1,
    lastPublishAttemptAt: 1_771_331_697_000,
    publishedAt: 1_771_331_697_000,
    publisherSessionId: "publisher-session",
  }))
);

function createRuntimeCompositionProfileFixture(): RuntimeCompositionProfile {
  return {
    id: "workspace-default",
    name: "Workspace Default",
    scope: "workspace",
    enabled: true,
    pluginSelectors: [],
    routePolicy: {
      preferredRoutePluginIds: [],
      providerPreference: [],
      allowRuntimeFallback: true,
    },
    backendPolicy: {
      preferredBackendIds: ["backend-primary"],
      resolvedBackendId: null,
    },
    trustPolicy: {
      requireVerifiedSignatures: true,
      allowDevOverrides: false,
      blockedPublishers: [],
    },
    executionPolicyRefs: [],
    observabilityPolicy: {
      emitStableEvents: true,
      emitOtelAlignedTelemetry: true,
    },
    configLayers: [],
  };
}

function createRuntimeCompositionProfileSummaryFixture(): RuntimeCompositionProfileSummaryV2 {
  return {
    id: "workspace-default",
    name: "Workspace Default",
    scope: "workspace",
    enabled: true,
    active: true,
  };
}

function createRuntimeCompositionResolutionFixture(): RuntimeCompositionResolution {
  return {
    selectedPlugins: [],
    selectedRouteCandidates: [],
    selectedBackendCandidates: [{ backendId: "backend-primary", sourcePluginId: null }],
    blockedPlugins: [],
    trustDecisions: [],
    provenance: {
      activeProfileId: "workspace-default",
      activeProfileName: "Workspace Default",
      appliedLayerOrder: ["built_in", "user", "workspace", "launch_override"],
      selectorDecisions: {},
    },
  };
}

function createRuntimeCompositionSnapshotFixture(
  overrides: Partial<RuntimeCompositionResolveV2Response> = {}
): RuntimeCompositionResolveV2Response {
  return {
    activeProfile: createRuntimeCompositionProfileFixture(),
    authorityState: "published",
    freshnessState: "current",
    authorityRevision: 1,
    lastAcceptedRevision: 1,
    lastPublishAttemptAt: 1,
    publishedAt: 1,
    publisherSessionId: "session-1",
    provenance: {
      activeProfileId: "workspace-default",
      activeProfileName: "Workspace Default",
      appliedLayerOrder: ["built_in", "user", "workspace", "launch_override"],
      selectorDecisions: {},
    },
    pluginEntries: [],
    selectedRouteCandidates: [],
    selectedBackendCandidates: [{ backendId: "backend-primary", sourcePluginId: null }],
    blockedPlugins: [],
    trustDecisions: [],
    ...overrides,
  };
}

vi.mock("../../../application/runtime/ports/runtimeUpdatedEvents", () => ({
  subscribeScopedRuntimeUpdatedEvents: vi.fn(),
}));

vi.mock("../../../application/runtime/facades/runtimeRemoteExecutionFacade", () => ({
  startRuntimeJobWithRemoteSelection: startRuntimeJobWithRemoteSelectionMock,
  startRuntimeRunWithRemoteSelection: startRuntimeJobWithRemoteSelectionMock,
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

vi.mock("../../../application/runtime/ports/missionControl", () => ({
  getMissionControlSnapshot: vi.fn().mockResolvedValue({
    source: "runtime_snapshot_v1",
    generatedAt: 0,
    workspaces: [],
    tasks: [],
    runs: [],
    reviewPacks: [],
  }),
}));

vi.mock("./WorkspaceHomeAiWebLabSection", () => ({
  WorkspaceHomeAiWebLabSection: (props: unknown) => {
    workspaceHomeAiWebLabSectionSpy(props);
    return <div data-testid="workspace-home-ai-web-lab-stub" />;
  },
}));

vi.mock("../../../application/runtime/ports/runtimeJobs", () => ({
  cancelRuntimeRun: vi.fn(),
  submitRuntimeJobApprovalDecision: vi.fn(),
  interveneRuntimeRun: vi.fn(),
  getRuntimeRunV2: getRuntimeRunV2Mock,
  subscribeRuntimeRunV2: subscribeRuntimeRunV2Mock,
  prepareRuntimeRunV2: prepareRuntimeRunV2Mock,
  startRuntimeRunV2: startRuntimeRunV2Mock,
  resumeRuntimeRun: vi.fn(),
}));

vi.mock("../../../application/runtime/ports/threads", async () => {
  const actual = await vi.importActual<typeof import("../../../application/runtime/ports/threads")>(
    "../../../application/runtime/ports/threads"
  );
  return {
    ...actual,
    distributedTaskGraph: vi.fn(),
    respondToServerRequest: vi.fn(),
    respondToServerRequestResult: vi.fn(),
    respondToUserInputRequest: vi.fn(),
    sendUserMessage: vi.fn(),
    steerTurn: vi.fn(),
  };
});

vi.mock("../../../application/runtime/ports/desktopAppSettings", () => ({
  getAppSettings: vi.fn().mockResolvedValue({}),
  updateAppSettings: vi.fn(),
}));

vi.mock("../../../application/runtime/ports/browserCapability", () => ({
  assessBrowserSurface: assessBrowserSurfaceMock,
  getLastBrowserAssessmentResult: getLastBrowserAssessmentResultMock,
  readBrowserReadiness: readBrowserReadinessMock,
  extractBrowserContent: extractBrowserContentMock,
  getLastBrowserExtractionResult: getLastBrowserExtractionResultMock,
}));

vi.mock("../../../application/runtime/ports/runtime", () => ({
  getRuntimeCapabilitiesSummary: vi.fn(),
  getRuntimeHealth: vi.fn(),
}));

vi.mock("../../../application/runtime/ports/runtimeDiagnostics", () => ({
  runtimeToolMetricsRead: vi.fn(),
  runtimeToolGuardrailRead: vi.fn(),
}));

vi.mock("../../../application/runtime/ports/runtimePolicy", () => ({
  getRuntimePolicy: vi.fn(),
  setRuntimePolicy: vi.fn(),
}));

vi.mock("../../shared/hooks/useWorkspaceRuntimeSessionCheckpoint", () => ({
  useWorkspaceRuntimeSessionCheckpoint: vi.fn(),
}));

vi.mock("../../../application/runtime/facades/runtimePersistentFlowState", () => ({
  useWorkspacePersistentFlowState: vi.fn(() => ({
    context: null,
    hydratedIntent: null,
    source: "none",
    loadState: "ready",
    saveError: null,
    indicator: {
      tone: "neutral",
      label: "Persistent flow state",
      detail:
        "Persistent flow state will appear once the workspace has intent or runtime evidence.",
      recovered: false,
    },
  })),
}));

vi.mock("../../../application/runtime/ports/oauth", () => ({
  getProvidersCatalog: vi.fn(),
  listOAuthAccounts: vi.fn(),
  listOAuthPools: vi.fn(),
}));

import { subscribeScopedRuntimeUpdatedEvents } from "../../../application/runtime/ports/runtimeUpdatedEvents";
import { getMissionControlSnapshot } from "../../../application/runtime/ports/missionControl";
import {
  cancelRuntimeRun as interruptAgentTask,
  getRuntimeRunV2,
  submitRuntimeJobApprovalDecision as submitTaskApprovalDecision,
  resumeRuntimeRun as resumeAgentTask,
} from "../../../application/runtime/ports/runtimeJobs";
import {
  getRuntimeCapabilitiesSummary,
  getRuntimeHealth,
} from "../../../application/runtime/ports/runtime";
import {
  runtimeToolGuardrailRead,
  runtimeToolMetricsRead,
} from "../../../application/runtime/ports/runtimeDiagnostics";
import { getRuntimePolicy } from "../../../application/runtime/ports/runtimePolicy";
import {
  getProvidersCatalog,
  listOAuthAccounts,
  listOAuthPools,
} from "../../../application/runtime/ports/oauth";
import type { RuntimeKernel } from "../../../application/runtime/kernel/runtimeKernelTypes";
import { parseRepositoryExecutionContract } from "../../../application/runtime/facades/runtimeRepositoryExecutionContract";

type MockAgentTaskSummary = AgentTaskSummary;
const runtimeUpdatedListeners = new Set<(event: RuntimeUpdatedEvent) => void>();
const getMissionControlSnapshotMock = vi.mocked(getMissionControlSnapshot);
const submitTaskApprovalDecisionMock = vi.mocked(submitTaskApprovalDecision) as unknown as Mock;
const interruptAgentTaskMock = vi.mocked(interruptAgentTask) as unknown as Mock;
const resumeAgentTaskMock = vi.mocked(resumeAgentTask) as unknown as Mock;
const useWorkspaceRuntimeSessionCheckpointMock = vi.mocked(useWorkspaceRuntimeSessionCheckpoint);
const useWorkspacePersistentFlowStateMock = vi.mocked(useWorkspacePersistentFlowState);
const getRuntimePolicyMock = vi.mocked(getRuntimePolicy);

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

function createBrowserReadinessSummary(overrides: Record<string, unknown> = {}) {
  return {
    state: "ready",
    headline: "Browser readiness confirmed",
    detail: "Desktop host bridge publishes the browser extraction contract.",
    recommendedAction: "Use the runtime browser extraction contract.",
    runtimeHost: "electron",
    source: "desktop_host_bridge",
    sourceLabel: "Desktop host bridge",
    assessmentAvailable: true,
    assessmentHistoryAvailable: true,
    extractionAvailable: true,
    historyAvailable: true,
    localOnly: false,
    lastAssessmentResult: null,
    lastResult: null,
    capabilities: {
      browserAssessment: true,
      browserAssessmentHistory: true,
      browserDebug: true,
      browserExtraction: true,
      browserExtractionHistory: true,
      webMcp: true,
    },
    ...overrides,
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
}

function mockRoutingPlugins(input: {
  providers: Parameters<typeof createRuntimeProviderRoutePluginDescriptors>[0]["providers"];
  accounts?: Parameters<typeof createRuntimeProviderRoutePluginDescriptors>[0]["accounts"];
  pools?: Parameters<typeof createRuntimeProviderRoutePluginDescriptors>[0]["pools"];
}) {
  runtimePluginCatalogListMock.mockResolvedValue(
    createRuntimeProviderRoutePluginDescriptors({
      providers: input.providers,
      accounts: input.accounts ?? [],
      pools: input.pools ?? [],
    })
  );
}

beforeEach(() => {
  runtimeUpdatedListeners.clear();
  runtimePluginCatalogListMock.mockResolvedValue([]);
  runtimePluginRegistryListMock.mockResolvedValue([]);
  runtimePluginRegistryInstallMock.mockClear();
  runtimePluginRegistryInstallMock.mockResolvedValue({
    package: {} as never,
    installed: true,
    blockedReason: null,
  });
  runtimePluginRegistryUpdateMock.mockClear();
  runtimePluginRegistryUpdateMock.mockResolvedValue({
    package: null,
    updated: false,
    blockedReason: null,
  });
  runtimePluginRegistryUninstallMock.mockClear();
  runtimePluginRegistryUninstallMock.mockResolvedValue({
    packageRef: "pkg.search.remote",
    removed: true,
    blockedReason: null,
  });
  runtimeCompositionProfilesMock.mockResolvedValue([createRuntimeCompositionProfileFixture()]);
  runtimeCompositionProfilesV2Mock.mockResolvedValue([
    createRuntimeCompositionProfileSummaryFixture(),
  ]);
  runtimeCompositionResolutionMock.mockResolvedValue(createRuntimeCompositionResolutionFixture());
  runtimeCompositionResolutionV2Mock.mockResolvedValue(createRuntimeCompositionSnapshotFixture());
  getRuntimePolicyMock.mockResolvedValue({
    mode: "strict",
    updatedAt: 1_700_000_000_000,
    state: {
      readiness: "attention",
      summary: "Runtime policy is active in Strict mode with 2 operator-visible constraints.",
      activeConstraintCount: 2,
      blockedCapabilityCount: 1,
      capabilities: [
        {
          capabilityId: "tool_preflight",
          label: "Tool preflight",
          readiness: "attention",
          effect: "approval",
          activeConstraint: true,
          summary: "Strict mode gates medium and high-risk actions.",
          detail: "Operator approval is required before risky tool execution can continue.",
        },
        {
          capabilityId: "network_analysis",
          label: "Network analysis",
          readiness: "attention",
          effect: "blocked",
          activeConstraint: true,
          summary: "Network-backed analysis is disabled by runtime policy.",
          detail: "Enable live-skills network access to restore remote search and fetch paths.",
        },
      ],
    },
  });
  runtimeCompositionPreviewMock.mockClear();
  runtimeCompositionPreviewMock.mockResolvedValue(createRuntimeCompositionResolutionFixture());
  runtimeCompositionPreviewV2Mock.mockClear();
  runtimeCompositionPreviewV2Mock.mockResolvedValue(createRuntimeCompositionSnapshotFixture());
  runtimeCompositionApplyMock.mockClear();
  runtimeCompositionApplyMock.mockResolvedValue(createRuntimeCompositionResolutionFixture());
  runtimeCompositionApplyV2Mock.mockClear();
  runtimeCompositionApplyV2Mock.mockResolvedValue(createRuntimeCompositionSnapshotFixture());
  const lifecycle = {
    summary: buildRuntimeToolLifecyclePresentationSummary({
      lifecycleEvents: [],
      hookCheckpoints: [],
    }),
    revision: 0,
    lastHookCheckpoint: null,
    lastEvent: null,
    hookCheckpoints: [],
    lifecycleEvents: [],
  };
  const sessionCheckpointBaseline = buildRuntimeSessionCheckpointBaseline({
    workspaceId: "ws-approval",
    lifecycleSnapshot: {
      revision: lifecycle.revision,
      lastEvent: lifecycle.lastEvent,
      recentEvents: lifecycle.lifecycleEvents,
      lastHookCheckpoint: lifecycle.lastHookCheckpoint,
      recentHookCheckpoints: lifecycle.hookCheckpoints,
    },
  });
  useWorkspaceRuntimeSessionCheckpointMock.mockReturnValue({
    lifecycle,
    sessionCheckpointBaseline,
    sessionCheckpointSummary:
      buildRuntimeSessionCheckpointPresentationSummary(sessionCheckpointBaseline),
  });
  useWorkspacePersistentFlowStateMock.mockReturnValue({
    context: null,
    hydratedIntent: null,
    source: "none",
    loadState: "ready",
    saveError: null,
    indicator: {
      tone: "neutral",
      label: "Persistent flow state",
      detail:
        "Persistent flow state will appear once the workspace has intent or runtime evidence.",
      recovered: false,
    },
  });
  vi.mocked(subscribeScopedRuntimeUpdatedEvents).mockImplementation((_options, listener) => {
    runtimeUpdatedListeners.add(listener);
    return () => {
      runtimeUpdatedListeners.delete(listener);
    };
  });
  startRuntimeJobWithRemoteSelectionMock.mockResolvedValue({});
  vi.mocked(getRuntimeRunV2).mockResolvedValue(
    null as unknown as Awaited<ReturnType<typeof getRuntimeRunV2>>
  );
  subscribeRuntimeRunV2Mock.mockResolvedValue(null);
  prepareRuntimeRunV2Mock.mockResolvedValue(createRuntimeLaunchPreparationFixture());
  startRuntimeRunV2Mock.mockResolvedValue({
    run: {
      taskId: "run-123",
      workspaceId: "ws-approval",
      threadId: null,
      requestId: null,
      title: "Inspect runtime launch path",
      status: "queued",
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
      currentStep: 0,
      createdAt: 1_700_000_000_000,
      updatedAt: 1_700_000_000_000,
      startedAt: null,
      completedAt: null,
      errorCode: null,
      errorMessage: null,
      pendingApprovalId: null,
      steps: [],
    },
    missionRun: projectAgentTaskSummaryToRunSummary(
      buildTask("run-123", "queued", "Inspect runtime launch path")
    ),
    reviewPack: null,
  });
  vi.mocked(getRuntimeCapabilitiesSummary).mockResolvedValue({
    mode: "electron-bridge",
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
  readBrowserReadinessMock.mockReturnValue(createBrowserReadinessSummary());
  assessBrowserSurfaceMock.mockReset();
  assessBrowserSurfaceMock.mockResolvedValue(null);
  extractBrowserContentMock.mockReset();
  extractBrowserContentMock.mockResolvedValue(null);
  getLastBrowserAssessmentResultMock.mockReset();
  getLastBrowserAssessmentResultMock.mockResolvedValue(null);
  getLastBrowserExtractionResultMock.mockReset();
  getLastBrowserExtractionResultMock.mockResolvedValue(null);
  vi.mocked(getProvidersCatalog).mockResolvedValue([]);
  vi.mocked(listOAuthAccounts).mockResolvedValue([]);
  vi.mocked(listOAuthPools).mockResolvedValue([]);
  readRepositoryExecutionContractMock.mockResolvedValue(null);
  getMissionControlSnapshotMock.mockResolvedValue(createEmptyMissionControlSnapshot());
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
  runtimeUpdatedListeners.clear();
  resetRuntimeParallelDispatchManagerForTests();
});

function emitRuntimeUpdated(event: RuntimeUpdatedEvent) {
  for (const listener of runtimeUpdatedListeners) {
    listener(event);
  }
}

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

function buildRuntimeRunRecord(
  overrides: Partial<MockAgentTaskSummary> & Pick<MockAgentTaskSummary, "taskId" | "status">
) {
  const run = {
    ...buildTask(overrides.taskId, overrides.status, overrides.title ?? overrides.taskId),
    ...overrides,
  } as MockAgentTaskSummary;
  return {
    run,
    missionRun: projectAgentTaskSummaryToRunSummary(run),
    reviewPack: null,
  };
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

function createRuntimeLaunchPreparationFixture() {
  return {
    preparedAt: 1_700_000_000_000,
    runIntent: {
      title: "Inspect runtime launch path",
      objective: "Inspect runtime launch path",
      summary: "Runtime clarified the mission and built a native execution plan.",
      taskSource: {
        kind: "manual" as const,
        title: "Inspect runtime launch path",
      },
      accessMode: "on-request" as const,
      executionMode: "single" as const,
      executionProfileId: "balanced-delegate",
      reviewProfileId: null,
      validationPresetId: "standard",
      preferredBackendIds: ["backend-policy-a"],
      requiredCapabilities: [],
      riskLevel: "medium" as const,
      clarified: true,
      missingContext: [],
    },
    contextWorkingSet: {
      summary: "Hot repo context plus validation defaults are loaded.",
      workspaceRoot: "/workspaces/HugeCode",
      layers: [
        {
          tier: "hot" as const,
          summary: "Immediate launch context",
          entries: [
            {
              id: "repo-instruction-surfaces",
              label: "Repo instruction surfaces",
              kind: "repo_rule" as const,
              detail:
                "Runtime detected AGENTS.md, CLAUDE.md, .github/copilot-instructions.md as hot repo guidance surfaces.",
              source: "repo_guidance",
            },
            {
              id: "workspace",
              label: "HugeCode workspace",
              kind: "workspace" as const,
              detail: "Current repository root",
              source: "runtime",
            },
          ],
        },
      ],
    },
    contextTruth: {
      summary: "Runtime normalized manual context into the canonical governed run path.",
      canonicalTaskSource: {
        kind: "manual",
        family: "manual",
        label: "Inspect runtime launch path",
        summary: "Inspect runtime launch path",
        source: "manual",
        reference: null,
        canonicalUrl: null,
        primary: true,
      },
      sources: [
        {
          kind: "manual",
          family: "manual",
          label: "Inspect runtime launch path",
          summary: "Inspect runtime launch path",
          source: "manual",
          reference: null,
          canonicalUrl: null,
          primary: true,
        },
      ],
      executionProfileId: "balanced-delegate",
      reviewProfileId: null,
      validationPresetId: "standard",
      reviewIntent: "execute",
      ownerSummary: "Human owner stays accountable; the runtime agent executes the delegated work.",
      sourceMetadata: [],
      consumers: ["run", "review_pack", "takeover", "follow_up"],
    },
    guidanceStack: {
      summary: "Guidance resolves through launch -> repo.",
      precedence: ["launch", "repo"],
      layers: [
        {
          id: "repo-instructions",
          scope: "repo",
          summary:
            "Repo instructions remain the baseline contract for launch, review, and follow-up.",
          source: "AGENTS.md",
          priority: 10,
          instructions: ["Prefer runtime-owned truth over page-local heuristics."],
          skillIds: [],
        },
      ],
    },
    triageSummary: {
      owner: "Operator",
      priority: "medium",
      riskLevel: "medium",
      tags: ["manual"],
      dedupeKey: "manual::inspect runtime launch path",
      summary: "Owner Operator · Priority medium · Risk medium · Tags manual",
    },
    delegationPlan: {
      summary: "Runtime will fan out review and validation in two child batches.",
      fanOutReady: true,
      reviewRequired: true,
      childCount: 2,
      batches: [
        {
          id: "delegation-batch-1",
          summary: "Review and validation batch",
          strategy: "parallel" as const,
          mergeStrategy: "operator_review" as const,
          childRoles: ["review", "validate"],
          preferredBackendIds: ["backend-policy-a"],
        },
      ],
    },
    delegationContract: {
      summary:
        "Delegate the work, then review a compact evidence artifact instead of supervising the full transcript.",
      state: "launch_ready",
      humanOwner: "Operator",
      agentExecutor: "Runtime agent",
      accountability:
        "Human owner stays accountable; the runtime agent executes the delegated work.",
      nextOperatorAction:
        "Launch the run and review the resulting Review Pack before accepting outcomes.",
      continueVia: null,
    },
    auxiliaryExecutionPolicy: {
      enabled: true,
      summary: "Runtime will offload compaction and recall to auxiliary routes.",
      routes: [
        {
          task: "context_compaction" as const,
          mode: "auxiliary_preferred" as const,
          summary: "Compaction prefers auxiliary processing.",
        },
        {
          task: "session_recall" as const,
          mode: "primary_fallback" as const,
          summary: "Session recall falls back to the primary runtime.",
        },
      ],
      fallbackSummary: "Primary runtime remains the fallback for auxiliary work.",
    },
    executionGraph: {
      graphId: "graph-1",
      summary: "Read, validate, then review.",
      nodes: [
        {
          id: "node-read",
          label: "Inspect runtime boundary",
          kind: "read" as const,
          status: "planned" as const,
          capability: "code",
          dependsOn: [],
          parallelSafe: true,
          requiresApproval: false,
        },
        {
          id: "node-validate",
          label: "Run validation",
          kind: "validate" as const,
          status: "planned" as const,
          capability: "validation",
          dependsOn: ["node-read"],
          parallelSafe: false,
          requiresApproval: false,
        },
      ],
    },
    approvalBatches: [
      {
        id: "batch-1",
        summary: "Workspace-safe reads",
        riskLevel: "low" as const,
        actionCount: 2,
        stepIds: ["node-read"],
      },
    ],
    validationPlan: {
      required: true,
      summary: "Run the standard validation lane before review.",
      commands: ["pnpm validate:fast"],
    },
    reviewFocus: ["runtime truth", "approval batching"],
    plan: {
      planVersion: "plan-1",
      summary: "Inspect runtime boundary, validate, then hand off for review.",
      currentMilestoneId: "milestone-read",
      estimatedDurationMinutes: 12,
      estimatedWorkerRuns: 1,
      parallelismHint: "sequential",
      clarifyingQuestions: [],
      milestones: [
        {
          id: "milestone-read",
          label: "Inspect runtime boundary",
          status: "in_progress" as const,
          acceptanceCriteria: ["Identify the launch path", "Capture risks"],
        },
        {
          id: "milestone-validate",
          label: "Run validation",
          status: "pending" as const,
          acceptanceCriteria: ["Run validate:fast"],
        },
      ],
      validationLanes: [
        {
          id: "lane-fast",
          label: "Fast lane",
          trigger: "pre_review" as const,
          commands: ["pnpm validate:fast"],
        },
      ],
      skillPlan: [
        {
          id: "skill-runtime",
          label: "Runtime boundary inspection",
          state: "planned" as const,
          detail: "Use runtime truth and approval batching surfaces.",
        },
      ],
    },
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

  const runtimeSessionCommands: RuntimeSessionCommandFacade = {
    sendMessage: vi.fn(),
    steerTurn: vi.fn(),
    interruptTurn: vi.fn(),
    startReview: vi.fn(),
    compactThread: vi.fn(),
    listMcpServerStatus: vi.fn(),
    respondToApproval: vi.fn(),
    respondToUserInput: vi.fn(),
    respondToToolCall: vi.fn(),
    canStartReviewInCurrentHost: vi.fn(() => true),
    reviewStartDesktopOnlyMessage: REVIEW_START_DESKTOP_ONLY_MESSAGE,
  };
  const runtimePluginCatalog: RuntimeKernelPluginCatalogFacade = {
    listPlugins: runtimePluginCatalogListMock,
    readPluginResource: vi.fn(),
    executePlugin: vi.fn(),
    evaluatePluginPermissions: vi.fn(),
  };
  const runtimePluginRegistry: RuntimeKernelPluginRegistryFacade = {
    searchPackages: vi.fn(),
    getPackage: vi.fn(),
    verifyPackage: vi.fn(),
    installPackage: runtimePluginRegistryInstallMock,
    updatePackage: runtimePluginRegistryUpdateMock,
    uninstallPackage: runtimePluginRegistryUninstallMock,
    listInstalledPackages: runtimePluginRegistryListMock,
  };
  const runtimeComposition: RuntimeKernelCompositionFacade = {
    listProfiles: runtimeCompositionProfilesMock,
    listProfilesV2: runtimeCompositionProfilesV2Mock,
    getProfile: vi.fn(),
    getProfileV2: vi.fn(),
    previewResolution: runtimeCompositionPreviewMock,
    previewResolutionV2: runtimeCompositionPreviewV2Mock,
    applyProfile: runtimeCompositionApplyMock,
    applyProfileV2: runtimeCompositionApplyV2Mock,
    getActiveResolution: runtimeCompositionResolutionMock,
    getActiveResolutionV2: runtimeCompositionResolutionV2Mock,
    publishActiveResolutionV1: runtimeCompositionPublishMock,
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
      composition: {
        listProfilesV2: runtimeCompositionProfilesV2Mock,
        getProfileV2: vi.fn(async (_workspaceId, profileId) => {
          const profiles = await runtimeCompositionProfilesMock();
          return profiles.find((profile) => profile.id === profileId) ?? null;
        }),
        resolveV2: runtimeCompositionResolutionV2Mock,
        publishSnapshotV1: runtimeCompositionPublishSnapshotMock,
        getSettings: vi.fn(async () => ({
          selection: {
            profileId: null,
            preferredBackendIds: [],
          },
          launchOverride: null,
          persistence: {
            publisherSessionId: null,
            lastAcceptedAuthorityRevision: null,
            lastPublishAttemptAt: null,
            lastPublishedAt: null,
          },
        })),
        updateSettings: vi.fn(async (_workspaceId, settings) => settings),
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
        prepareRuntimeRun: vi.fn(),
        startRuntimeRun: vi.fn(),
        cancelRuntimeRun: vi.fn(),
        resumeRuntimeRun: vi.fn(),
        interveneRuntimeRun: vi.fn(),
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
      getCapability: <K extends RuntimeKernelCapabilityKey>(key: K) => {
        if (key === RUNTIME_KERNEL_CAPABILITY_KEYS.agentControl) {
          return createRuntimeAgentControlFacade(
            workspaceId,
            createRuntimeAgentControlDependencies(workspaceId)
          ) as RuntimeKernelCapabilityMap[K];
        }
        if (key === RUNTIME_KERNEL_CAPABILITY_KEYS.sessionCommands) {
          return runtimeSessionCommands as RuntimeKernelCapabilityMap[K];
        }
        if (key === RUNTIME_KERNEL_CAPABILITY_KEYS.pluginCatalog) {
          return runtimePluginCatalog as RuntimeKernelCapabilityMap[K];
        }
        if (key === RUNTIME_KERNEL_CAPABILITY_KEYS.pluginRegistry) {
          return runtimePluginRegistry as RuntimeKernelCapabilityMap[K];
        }
        if (key === RUNTIME_KERNEL_CAPABILITY_KEYS.compositionRuntime) {
          return runtimeComposition as RuntimeKernelCapabilityMap[K];
        }
        throw new Error(`Unsupported workspace runtime capability: ${key}`);
      },
      hasCapability: (key: string) =>
        key === RUNTIME_KERNEL_CAPABILITY_KEYS.agentControl ||
        key === RUNTIME_KERNEL_CAPABILITY_KEYS.sessionCommands ||
        key === RUNTIME_KERNEL_CAPABILITY_KEYS.pluginCatalog ||
        key === RUNTIME_KERNEL_CAPABILITY_KEYS.pluginRegistry ||
        key === RUNTIME_KERNEL_CAPABILITY_KEYS.compositionRuntime,
      listCapabilities: () => [
        RUNTIME_KERNEL_CAPABILITY_KEYS.agentControl,
        RUNTIME_KERNEL_CAPABILITY_KEYS.sessionCommands,
        RUNTIME_KERNEL_CAPABILITY_KEYS.pluginCatalog,
        RUNTIME_KERNEL_CAPABILITY_KEYS.pluginRegistry,
        RUNTIME_KERNEL_CAPABILITY_KEYS.compositionRuntime,
      ],
    })),
  };
}

const desktopSettingsShellFraming: SettingsShellFraming = {
  kickerLabel: "Workspace",
  contextLabel: "Desktop runtime",
  title: "Settings",
  subtitle: "Runtime orchestration",
};

function createWorkspaceClientBindings(runtimeKernel: RuntimeKernel): WorkspaceClientBindings {
  return {
    navigation: {
      readRouteSelection: () => ({ kind: "home" }),
      subscribeRouteSelection: () => () => undefined,
      navigateToWorkspace: () => undefined,
      navigateToSection: () => undefined,
      navigateHome: () => undefined,
    },
    runtimeGateway: runtimeKernel.workspaceClientRuntimeGateway,
    runtime: runtimeKernel.workspaceClientRuntime,
    host: {
      platform: "desktop",
      intents: {
        openOauthAuthorizationUrl: async () => undefined,
        createOauthPopupWindow: () => null,
        waitForOauthBinding: async () => false,
      },
      notifications: {
        testSound: () => undefined,
        testSystemNotification: () => undefined,
      },
      shell: {
        platformHint: "desktop",
      },
    },
    platformUi: {
      WorkspaceRuntimeShell: () => null,
      WorkspaceApp: () => null,
      renderWorkspaceHost: (children) => children,
      settingsShellFraming: desktopSettingsShellFraming,
    },
  };
}

function render(ui: Parameters<typeof rtlRender>[0]) {
  const runtimeKernel = createRuntimeKernelValue();
  const workspaceClientBindings = createWorkspaceClientBindings(runtimeKernel);
  return rtlRender(
    <WorkspaceClientBindingsProvider bindings={workspaceClientBindings}>
      <RuntimeKernelProvider value={runtimeKernel}>{ui}</RuntimeKernelProvider>
    </WorkspaceClientBindingsProvider>
  );
}

describe("WorkspaceHomeAgentRuntimeOrchestration", () => {
  it("passes the real workspace record to AI Web Lab so unrelated settings remain available", async () => {
    const workspace: WorkspaceInfo = {
      id: "ws-approval",
      name: "Approval Workspace",
      path: "/tmp/ws-approval",
      connected: true,
      kind: "main",
      parentId: null,
      worktree: null,
      settings: {
        sidebarCollapsed: false,
        groupId: "group-review",
        sortOrder: 7,
        gitRoot: "/tmp/ws-approval/repo",
        launchScript: "pnpm dev",
      },
    };
    mockRuntimeTasks([buildTask("task-running", "running", "Ship UI")]);

    render(
      <WorkspaceHomeAgentRuntimeOrchestration workspaceId={workspace.id} workspace={workspace} />
    );

    await waitFor(() => {
      expect(workspaceHomeAiWebLabSectionSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          workspace: expect.objectContaining({
            id: workspace.id,
            name: workspace.name,
            settings: expect.objectContaining({
              groupId: "group-review",
              sortOrder: 7,
              gitRoot: "/tmp/ws-approval/repo",
              launchScript: "pnpm dev",
            }),
          }),
        })
      );
    });
  });

  it("attaches AI Web Lab artifacts through a source-linked runtime draft", async () => {
    const workspace: WorkspaceInfo = {
      id: "ws-ai-web-lab",
      name: "AI Web Lab Workspace",
      path: "/tmp/ws-ai-web-lab",
      connected: true,
      kind: "main",
      parentId: null,
      worktree: null,
      settings: {
        sidebarCollapsed: false,
      },
    };
    mockRuntimeTasks([]);

    render(
      <WorkspaceHomeAgentRuntimeOrchestration workspaceId={workspace.id} workspace={workspace} />
    );

    await waitFor(() => {
      expect(workspaceHomeAiWebLabSectionSpy).toHaveBeenCalled();
    });

    const props = workspaceHomeAiWebLabSectionSpy.mock.calls.at(-1)?.[0] as {
      onApplyArtifactToDraft: (artifact: {
        artifactKind: "prompt_markdown";
        content: string;
        entrypointId: string;
        errorMessage: null;
        extractedAt: string;
        format: "markdown";
        pageTitle: string;
        providerId: "chatgpt";
        sourceUrl: string;
        status: "succeeded";
      }) => void;
    };

    await act(async () => {
      props.onApplyArtifactToDraft({
        artifactKind: "prompt_markdown",
        content: "Promote the artifact through the canonical source-linked launch path.",
        entrypointId: "prompt_refinement",
        errorMessage: null,
        extractedAt: "2026-04-09T00:00:00.000Z",
        format: "markdown",
        pageTitle: "ChatGPT prompt refinement",
        providerId: "chatgpt",
        sourceUrl: "https://chatgpt.com/c/source-linked-launch",
        status: "succeeded",
      });
    });

    await waitFor(() => {
      expect(screen.getByText("Source-linked draft from ChatGPT prompt refinement")).toBeTruthy();
    });

    expect(screen.getByText("Source-linked launch: AI Web Lab")).toBeTruthy();
    expect(
      screen.getByText("Review the profile and route below, then launch with the linked source.")
    ).toBeTruthy();
    expect(screen.getByDisplayValue("ChatGPT prompt refinement")).toBeTruthy();
    expect(
      screen.getByDisplayValue(
        "Promote the artifact through the canonical source-linked launch path."
      )
    ).toBeTruthy();
  });

  it("republishes live runtime run evidence into persistent flow state when mission control opens", async () => {
    const runtimeTask = {
      ...buildTask("task-running", "running", "Ship UI"),
      reviewPackId: "review-pack:task-running",
      runSummary: {
        ...projectAgentTaskSummaryToRunSummary(buildTask("task-running", "running", "Ship UI")),
        changedPaths: [
          "apps/code/src/features/workspaces/components/WorkspaceHomeAgentControlCore.tsx",
        ],
        validations: [
          {
            id: "validation-1",
            label: "TypeScript",
            outcome: "failed",
            summary: "TypeScript still has one unresolved issue.",
          },
        ],
      },
    } as MockAgentTaskSummary;
    mockRuntimeTasks([runtimeTask]);

    render(
      <WorkspaceHomeAgentRuntimeOrchestration
        workspaceId="ws-approval"
        intent={{
          objective: "Keep continuity context warm",
          constraints: "",
          successCriteria: "",
          deadline: null,
          priority: "high",
          managerNotes: "",
        }}
      />
    );

    await waitFor(() => {
      expect(useWorkspacePersistentFlowStateMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          workspaceId: "ws-approval",
          intent: expect.objectContaining({
            objective: "Keep continuity context warm",
          }),
          runs: [
            expect.objectContaining({
              id: "task-running",
              title: "Ship UI",
              changedPaths: [
                "apps/code/src/features/workspaces/components/WorkspaceHomeAgentControlCore.tsx",
              ],
              reviewPackId: null,
              validations: [
                expect.objectContaining({
                  summary: "TypeScript still has one unresolved issue.",
                }),
              ],
            }),
          ],
        })
      );
    });
  });

  it("renders fixed mission control sections for launch, continuity, approval pressure, and run list", async () => {
    mockRuntimeTasks([buildTask("task-running", "running", "Ship UI")]);

    render(<WorkspaceHomeAgentRuntimeOrchestration workspaceId="ws-approval" />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Governance / Policy" })).toBeTruthy();
      expect(screen.getByRole("heading", { name: "Launch readiness" })).toBeTruthy();
      expect(screen.getByRole("heading", { name: "Continuity readiness" })).toBeTruthy();
      expect(screen.getByRole("heading", { name: "Approval pressure" })).toBeTruthy();
      expect(screen.getByRole("heading", { name: "Autonomous Issue Drive" })).toBeTruthy();
      expect(screen.getByRole("heading", { name: "Extension readiness" })).toBeTruthy();
      expect(screen.getByRole("heading", { name: "Browser readiness" })).toBeTruthy();
      expect(screen.getByRole("heading", { name: "Run list" })).toBeTruthy();
    });
  });

  it("renders runtime-published governance and policy capability details", async () => {
    mockRuntimeTasks([buildTask("task-running", "running", "Ship UI")]);

    render(<WorkspaceHomeAgentRuntimeOrchestration workspaceId="ws-approval" />);

    await waitFor(() => {
      expect(
        screen.getByText("Governance / Policy is actively constraining runtime behavior")
      ).toBeTruthy();
      expect(screen.getByText("Policy mode: Strict")).toBeTruthy();
      expect(screen.getByText("Tool preflight")).toBeTruthy();
      expect(screen.getByText("Network analysis")).toBeTruthy();
      expect(screen.getAllByText("Active constraint").length).toBeGreaterThan(0);
    });
  });

  it("renders browser readiness as a separate capability surface from policy attention", async () => {
    mockRuntimeTasks([buildTask("task-running", "running", "Ship UI")]);
    readBrowserReadinessMock.mockReturnValue(
      createBrowserReadinessSummary({
        state: "attention",
        headline: "Browser readiness is local-only",
        detail:
          "Browser extraction still resolves through placeholder local state until a host adapter publishes the canonical contract.",
        recommendedAction:
          "Treat browser extraction as placeholder-only until a host or runtime adapter publishes canonical results.",
        runtimeHost: "browser",
        source: "local_placeholder",
        sourceLabel: "Local placeholder",
        assessmentAvailable: false,
        assessmentHistoryAvailable: false,
        extractionAvailable: false,
        localOnly: true,
        lastAssessmentResult: null,
        lastResult: {
          status: "empty",
          normalizedText: null,
          snippet: null,
          errorCode: "LOCAL_PLACEHOLDER_STATE",
          errorMessage: "Placeholder browser extraction state only.",
          traceId: null,
          trace: [],
        },
        capabilities: {
          browserAssessment: false,
          browserAssessmentHistory: false,
          browserDebug: false,
          browserExtraction: false,
          browserExtractionHistory: false,
          webMcp: true,
        },
      })
    );

    render(<WorkspaceHomeAgentRuntimeOrchestration workspaceId="ws-approval" />);

    await waitFor(() => {
      const section = screen.getByRole("heading", { name: "Browser readiness" }).closest("section");

      expect(section).toBeTruthy();

      const readinessPanel = within(section as HTMLElement);

      expect(readinessPanel.getAllByText("Attention").length).toBeGreaterThan(0);
      expect(readinessPanel.getByText("Host browser")).toBeTruthy();
      expect(readinessPanel.getByText("Browser loop unavailable")).toBeTruthy();
      expect(readinessPanel.getByText("Source Local placeholder")).toBeTruthy();
      expect(readinessPanel.getByText("Browser readiness is local-only")).toBeTruthy();
      expect(
        readinessPanel.getByText(
          /separate from Governance \/ Policy and sourced from browser host capability truth/i
        )
      ).toBeTruthy();
      expect(readinessPanel.getByText("Last result: empty (LOCAL_PLACEHOLDER_STATE)")).toBeTruthy();
    });
  });

  it("lets Mission Control trigger browser extraction and review the latest host result", async () => {
    mockRuntimeTasks([buildTask("task-running", "running", "Ship UI")]);
    extractBrowserContentMock.mockResolvedValue({
      status: "succeeded",
      normalizedText: "Mission Control extracted browser text.",
      snippet: "Mission Control extracted browser text.",
      sourceUrl: "https://example.com/browser-readiness",
      title: "Browser readiness",
      traceId: "browser-trace-1",
      trace: [
        {
          stage: "availability",
          at: "2026-03-30T00:00:00.000Z",
          message: "Resolved a local Chrome DevTools endpoint for browser extraction.",
        },
        {
          stage: "capture",
          at: "2026-03-30T00:00:01.000Z",
          message: "Selected a debuggable browser page target for extraction.",
        },
        {
          stage: "extract",
          at: "2026-03-30T00:00:02.000Z",
          message: "Evaluated the selected browser page target for text extraction.",
        },
        {
          stage: "normalize",
          at: "2026-03-30T00:00:03.000Z",
          message: "Normalized browser text without truncation.",
        },
      ],
    });
    getLastBrowserExtractionResultMock.mockResolvedValue({
      status: "partial",
      normalizedText: "Latest recorded browser extraction excerpt.",
      snippet: "Latest recorded browser extraction excerpt.",
      sourceUrl: "https://example.com/browser-readiness",
      title: "Browser readiness",
      errorCode: "BROWSER_TEXT_TRUNCATED",
      errorMessage: "Browser extraction was truncated to 4000 characters.",
      traceId: "browser-trace-2",
      trace: [
        {
          stage: "availability",
          at: "2026-03-30T00:00:04.000Z",
          message: "Resolved a local Chrome DevTools endpoint for browser extraction.",
        },
        {
          stage: "capture",
          at: "2026-03-30T00:00:05.000Z",
          message: "Selected a debuggable browser page target for extraction.",
        },
        {
          stage: "extract",
          at: "2026-03-30T00:00:06.000Z",
          message: "Evaluated the selected browser page target for text extraction.",
        },
        {
          stage: "normalize",
          at: "2026-03-30T00:00:07.000Z",
          message: "Normalized browser text and truncated it to 4000 characters.",
        },
      ],
    });

    render(<WorkspaceHomeAgentRuntimeOrchestration workspaceId="ws-approval" />);

    await waitFor(() => {
      expect(screen.getByTestId("workspace-runtime-browser-extraction-operator")).toBeTruthy();
    });

    const operator = within(screen.getByTestId("workspace-runtime-browser-extraction-operator"));

    fireEvent.change(operator.getByLabelText("Preferred page URL"), {
      target: { value: "  https://example.com/browser-readiness  " },
    });
    fireEvent.change(operator.getByLabelText("Selector"), {
      target: { value: "  main article  " },
    });
    fireEvent.click(operator.getByRole("button", { name: "Extract browser page" }));

    await waitFor(() => {
      expect(extractBrowserContentMock).toHaveBeenCalledWith({
        sourceUrl: "https://example.com/browser-readiness",
        selector: "main article",
      });
    });

    let resultPanel = within(screen.getByTestId("workspace-runtime-browser-extraction-result"));
    expect(resultPanel.getByText("Browser extraction completed.")).toBeTruthy();
    expect(resultPanel.getByText("Succeeded")).toBeTruthy();
    expect(resultPanel.getByText("Latest extraction")).toBeTruthy();
    expect(resultPanel.getByText("Page URL: https://example.com/browser-readiness")).toBeTruthy();
    expect(resultPanel.getByText("Mission Control extracted browser text.")).toBeTruthy();

    fireEvent.click(operator.getByRole("button", { name: "Review last result" }));

    await waitFor(() => {
      expect(getLastBrowserExtractionResultMock).toHaveBeenCalledTimes(1);
    });

    resultPanel = within(screen.getByTestId("workspace-runtime-browser-extraction-result"));
    expect(resultPanel.getByText("Browser extraction completed with truncation.")).toBeTruthy();
    expect(resultPanel.getByText("Partial")).toBeTruthy();
    expect(resultPanel.getByText("Last host result")).toBeTruthy();
    expect(resultPanel.getByText("Latest recorded browser extraction excerpt.")).toBeTruthy();
    expect(resultPanel.getByText("Error code: BROWSER_TEXT_TRUNCATED")).toBeTruthy();
  });

  it("disables last-result review when the host does not publish history", async () => {
    mockRuntimeTasks([buildTask("task-running", "running", "Ship UI")]);
    readBrowserReadinessMock.mockReturnValue(
      createBrowserReadinessSummary({
        assessmentHistoryAvailable: true,
        historyAvailable: false,
        capabilities: {
          browserAssessment: true,
          browserAssessmentHistory: true,
          browserDebug: true,
          browserExtraction: true,
          browserExtractionHistory: false,
          webMcp: true,
        },
      })
    );

    render(<WorkspaceHomeAgentRuntimeOrchestration workspaceId="ws-approval" />);

    await waitFor(() => {
      expect(screen.getByTestId("workspace-runtime-browser-extraction-operator")).toBeTruthy();
    });

    const operator = within(screen.getByTestId("workspace-runtime-browser-extraction-operator"));
    const reviewButton = operator.getByRole("button", { name: "Review last result" });
    expect(operator.getByText(/Review last result: blocked/i)).toBeTruthy();
    expect(reviewButton).toHaveProperty("disabled", true);
  });

  it("explains when no local debuggable browser page target is available", async () => {
    mockRuntimeTasks([buildTask("task-running", "running", "Ship UI")]);
    extractBrowserContentMock.mockResolvedValue({
      status: "empty",
      normalizedText: null,
      snippet: null,
      errorCode: "BROWSER_PAGE_TARGET_UNAVAILABLE",
      errorMessage: "No debuggable browser page target is currently available for extraction.",
      traceId: "browser-trace-3",
      trace: [
        {
          stage: "availability",
          at: "2026-03-30T00:00:00.000Z",
          message: "Resolved a local Chrome DevTools endpoint for browser extraction.",
        },
        {
          stage: "capture",
          at: "2026-03-30T00:00:01.000Z",
          message: "No debuggable browser page target was available for extraction.",
        },
      ],
    });

    render(<WorkspaceHomeAgentRuntimeOrchestration workspaceId="ws-approval" />);

    await waitFor(() => {
      expect(screen.getByTestId("workspace-runtime-browser-extraction-operator")).toBeTruthy();
    });

    const operator = within(screen.getByTestId("workspace-runtime-browser-extraction-operator"));
    fireEvent.click(operator.getByRole("button", { name: "Extract browser page" }));

    await waitFor(() => {
      expect(extractBrowserContentMock).toHaveBeenCalledTimes(1);
    });

    const resultPanel = within(screen.getByTestId("workspace-runtime-browser-extraction-result"));
    expect(resultPanel.getByText("No debuggable local browser page is available.")).toBeTruthy();
    expect(resultPanel.getByText("Error code: BROWSER_PAGE_TARGET_UNAVAILABLE")).toBeTruthy();
    expect(
      resultPanel.getByText(
        /No local debuggable browser page is currently available\. Open the intended page/i
      )
    ).toBeTruthy();
    expect(resultPanel.getByText("Trace: availability -> capture")).toBeTruthy();
  });

  it("renders blocked extension readiness with human-readable runtime host remediation", async () => {
    mockRuntimeTasks([buildTask("task-running", "running", "Ship UI")]);
    runtimePluginCatalogListMock.mockResolvedValue([
      {
        id: "host:wasi",
        name: "WASI host slot",
        version: "unbound",
        summary: null,
        source: "wasi_host",
        transport: "wasi_host",
        hostProfile: {
          kind: "wasi",
          executionBoundaries: ["wasi_host"],
        },
        workspaceId: null,
        enabled: false,
        runtimeBacked: false,
        capabilities: [],
        permissions: [],
        resources: [],
        executionBoundaries: ["wasi_host"],
        binding: {
          state: "unbound",
          contractFormat: "wit",
          contractBoundary: "world-imports",
          interfaceId: "wasi:*/*",
          surfaces: [
            {
              id: "hugecode:runtime/plugin-host",
              kind: "world",
              direction: "import",
              summary:
                "Reserved component-model world that the runtime host binder is expected to satisfy.",
            },
            {
              id: "wasi:*/*",
              kind: "interface",
              direction: "import",
              summary:
                "Semver-qualified WIT interface imports published by the runtime host binder.",
            },
          ],
        },
        operations: {
          execution: {
            executable: false,
            mode: "none",
            reason:
              "Plugin `host:wasi` reserves a WIT/component-model host slot and is currently unbound in the runtime host binder.",
          },
          resources: {
            readable: false,
            mode: "none",
            reason:
              "Plugin `host:wasi` does not expose readable resources through the runtime kernel.",
          },
          permissions: {
            evaluable: false,
            mode: "none",
            reason: "Plugin `host:wasi` does not publish runtime-evaluable permission state.",
          },
        },
        metadata: null,
        permissionDecision: "unsupported" as const,
        health: {
          state: "unsupported" as const,
          checkedAt: null,
          warnings: [],
        },
      },
    ] satisfies RuntimeKernelPluginDescriptor[]);

    render(<WorkspaceHomeAgentRuntimeOrchestration workspaceId="ws-approval" />);

    await waitFor(() => {
      const section = screen
        .getByRole("heading", { name: "Extension readiness" })
        .closest("section");

      expect(section).toBeTruthy();

      const readinessPanel = within(section as HTMLElement);

      expect(readinessPanel.getAllByText("Blocked").length).toBeGreaterThan(0);
      expect(readinessPanel.getByText("Action required 1")).toBeTruthy();
      expect(readinessPanel.getByText("Selected now 0")).toBeTruthy();
      expect(readinessPanel.getByText("Verified/runtime-managed 0")).toBeTruthy();
      expect(readinessPanel.getByText("Needs action")).toBeTruthy();
      expect(readinessPanel.getByText("WASI host slot (unbound)")).toBeTruthy();
      expect(readinessPanel.getByText("Source: WASI host")).toBeTruthy();
      expect(readinessPanel.getAllByText("Selection: Available inventory").length).toBeGreaterThan(
        0
      );
      expect(readinessPanel.getAllByText("Trust: Runtime-published").length).toBeGreaterThan(0);
      expect(
        readinessPanel.getByText(
          "Capability support: Runtime host binder imports are published, but the binder is not connected."
        )
      ).toBeTruthy();
      expect(readinessPanel.getByText("Permission state: Runtime-managed")).toBeTruthy();
      expect(readinessPanel.getByText("Readiness: Blocked")).toBeTruthy();
      expect(
        readinessPanel.getByText(
          "Remediation: Connect the WASI host binder so runtime can satisfy the published WIT imports."
        )
      ).toBeTruthy();
    });
  });

  it("wires plugin operator actions through the mission control section", async () => {
    mockRuntimeTasks([buildTask("task-running", "running", "Ship UI")]);
    runtimePluginCatalogListMock.mockResolvedValue([
      {
        id: "pkg.search.remote",
        name: "Remote Search Tools",
        version: "1.0.0",
        summary: "Registry package",
        source: "mcp_remote",
        transport: "mcp_remote",
        hostProfile: {
          kind: "remote",
          executionBoundaries: ["registry"],
        },
        workspaceId: null,
        enabled: true,
        runtimeBacked: false,
        capabilities: [],
        permissions: ["network"],
        resources: [],
        executionBoundaries: ["registry"],
        binding: {
          state: "declaration_only",
          contractFormat: "mcp",
          contractBoundary: "registry:mcp_remote",
          interfaceId: "pkg.search.remote",
          surfaces: [],
        },
        operations: {
          execution: {
            executable: false,
            mode: "none",
            reason: "Registry package is not runtime-bound.",
          },
          resources: {
            readable: false,
            mode: "none",
            reason: "Registry package is not runtime-bound.",
          },
          permissions: {
            evaluable: false,
            mode: "none",
            reason: "Registry package is not runtime-bound.",
          },
        },
        metadata: {
          pluginRegistry: {
            packageRef: "hugecode.mcp.search@1.0.0",
            transport: "mcp_remote",
            source: "catalog",
            installed: false,
            installedPluginId: null,
            publisher: "HugeCode Labs",
            trust: {
              status: "verified",
              verificationStatus: "verified",
              publisher: "HugeCode Labs",
              attestationSource: "sigstore",
              blockedReason: null,
              packageRef: "hugecode.mcp.search@1.0.0",
              pluginId: "pkg.search.remote",
            },
            compatibility: {
              status: "compatible",
              minimumHostContractVersion: "2026-03-25",
              supportedRuntimeProtocolVersions: ["2026-03-25"],
              supportedCapabilityKeys: ["plugins.catalog", "plugins.registry"],
              optionalTransportFeatures: [],
              blockers: [],
            },
          },
          composition: {
            activeProfileId: "workspace-default",
            activeProfileName: "Workspace Default",
            selectedInActiveProfile: false,
            blockedInActiveProfile: false,
            blockedReason: null,
            selectedRouteCandidate: false,
            selectedBackendCandidateIds: [],
            layerOrder: ["built_in", "user", "workspace", "launch_override"],
          },
        },
        permissionDecision: null,
        health: null,
      },
    ] satisfies RuntimeKernelPluginDescriptor[]);
    runtimeCompositionProfilesMock.mockResolvedValue([createRuntimeCompositionProfileFixture()]);
    runtimeCompositionProfilesV2Mock.mockResolvedValue([
      createRuntimeCompositionProfileSummaryFixture(),
    ]);
    runtimeCompositionResolutionMock.mockResolvedValue(createRuntimeCompositionResolutionFixture());
    runtimeCompositionResolutionV2Mock.mockResolvedValue(
      createRuntimeCompositionSnapshotFixture({
        pluginEntries: [
          {
            pluginId: "pkg.search.remote",
            source: "mcp_remote",
            packageRef: "hugecode.mcp.search@1.0.0",
            installed: false,
            trust: {
              status: "verified",
              verificationStatus: "verified",
              publisher: "HugeCode Labs",
              attestationSource: "sigstore",
              blockedReason: null,
              packageRef: "hugecode.mcp.search@1.0.0",
              pluginId: "pkg.search.remote",
            },
            trustStatus: "verified",
            compatibility: {
              status: "compatible",
              minimumHostContractVersion: "2026-03-25",
              supportedRuntimeProtocolVersions: ["2026-03-25"],
              supportedCapabilityKeys: ["plugins.catalog", "plugins.registry"],
              optionalTransportFeatures: [],
              blockers: [],
            },
            compatibilityStatus: "compatible",
            bindingState: "unbound",
            publicationState: "declaration_only",
            selectedInActiveProfile: false,
            blockedReason: null,
            selectedReason: null,
            routeCandidate: false,
            selectedRouteCandidate: null,
            backendCandidateIds: [],
            backendCandidates: [],
            bindingDescriptor: {
              pluginId: "pkg.search.remote",
              packageRef: "hugecode.mcp.search@1.0.0",
              source: "mcp_remote",
              bindingState: "unbound",
              publicationState: "declaration_only",
              contractFormat: "mcp",
              contractBoundary: "registry:mcp_remote",
              interfaceId: "pkg.search.remote",
              rawBindingState: "declaration_only",
              executable: false,
              reason: "Registry package is not runtime-bound.",
              diagnostics: [],
              contractSurfaces: [],
            },
            bindingDiagnostics: [],
            registryPackage: null,
          },
        ],
      })
    );

    await import("./WorkspaceHomeAgentRuntimePluginControlPlane");

    render(<WorkspaceHomeAgentRuntimeOrchestration workspaceId="ws-approval" />);

    let section: HTMLElement | null = null;
    await waitFor(
      () => {
        section = screen.getByTestId("workspace-runtime-plugin-operator-actions");
      },
      { timeout: 5_000 }
    );

    const pluginSection = section;
    if (!pluginSection) {
      throw new Error("Expected plugin operator actions section to render");
    }

    expect(within(pluginSection).getByText("Composition profiles")).toBeTruthy();
    expect(screen.getAllByText("Needs action").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Inventory", { selector: "strong" }).length).toBeGreaterThan(0);

    const installButton = await screen.findByRole("button", {
      name: "Remote Search Tools: Install",
    });
    await waitFor(() => {
      expect((installButton as HTMLButtonElement).disabled).toBe(false);
    });

    fireEvent.click(installButton);

    await waitFor(() => {
      expect(runtimePluginRegistryInstallMock).toHaveBeenCalledWith({
        packageRef: "hugecode.mcp.search@1.0.0",
      });
    });

    const previewButton = await screen.findByRole("button", { name: "Preview active profile" });
    await waitFor(() => {
      expect((previewButton as HTMLButtonElement).disabled).toBe(false);
    });

    fireEvent.click(previewButton);

    await waitFor(() => {
      expect(runtimeCompositionResolutionV2Mock).toHaveBeenCalledWith({
        workspaceId: "ws-approval",
        profileId: "workspace-default",
        launchOverride: null,
      });
      expect(screen.getByText("Preview: workspace-default")).toBeTruthy();
    });
  }, 15_000);

  it("renders session logs from runtime lifecycle events", async () => {
    mockRuntimeTasks([buildTask("task-running", "running", "Ship UI")]);
    const lifecycleEvents: RuntimeToolLifecycleEvent[] = [
      {
        id: "tool-1",
        kind: "tool",
        phase: "completed",
        source: "telemetry",
        workspaceId: "ws-approval",
        threadId: "thread-1",
        turnId: "turn-1",
        toolCallId: "call-1",
        toolName: "bash",
        scope: "write",
        status: "success",
        at: 1_771_331_697_000,
        errorCode: null,
      },
      {
        id: "approval-1",
        kind: "approval",
        phase: "requested",
        source: "app-event",
        workspaceId: "ws-approval",
        threadId: "thread-1",
        turnId: "turn-1",
        toolCallId: null,
        toolName: null,
        scope: null,
        status: "pending",
        at: 1_771_331_690_000,
        errorCode: null,
        approvalId: "approval-1",
      },
    ];
    const hookCheckpoints = [
      {
        key: "hook-1",
        point: "post_execution_pre_publication",
        status: "ready",
        source: "telemetry",
        workspaceId: "ws-approval",
        threadId: "thread-1",
        turnId: "turn-1",
        toolCallId: "call-1",
        toolName: "bash",
        scope: "write",
        lifecycleEventId: "tool-1",
        at: 1_771_331_697_000,
        reason: null,
      },
    ] as const;
    const lifecycle = {
      summary: buildRuntimeToolLifecyclePresentationSummary({
        lifecycleEvents,
        hookCheckpoints: [...hookCheckpoints],
      }),
      revision: 2,
      lastHookCheckpoint: hookCheckpoints[0] ?? null,
      lastEvent: lifecycleEvents[0] ?? null,
      hookCheckpoints: [...hookCheckpoints],
      lifecycleEvents,
    };
    const sessionCheckpointBaseline = buildRuntimeSessionCheckpointBaseline({
      workspaceId: "ws-approval",
      lifecycleSnapshot: {
        revision: lifecycle.revision,
        lastEvent: lifecycle.lastEvent,
        recentEvents: lifecycle.lifecycleEvents,
        lastHookCheckpoint: lifecycle.lastHookCheckpoint,
        recentHookCheckpoints: lifecycle.hookCheckpoints,
      },
    });
    useWorkspaceRuntimeSessionCheckpointMock.mockReturnValue({
      lifecycle,
      sessionCheckpointBaseline,
      sessionCheckpointSummary:
        buildRuntimeSessionCheckpointPresentationSummary(sessionCheckpointBaseline),
    });

    render(<WorkspaceHomeAgentRuntimeOrchestration workspaceId="ws-approval" />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Session log" })).toBeTruthy();
      expect(screen.getByText("bash completed")).toBeTruthy();
      expect(screen.getByText("Approval requested")).toBeTruthy();
      expect(screen.getByText("Structured sessions 1")).toBeTruthy();
      expect(screen.getByText("Session thread:thread-1/turn:turn-1")).toBeTruthy();
      expect(screen.getByText("Last event: tool-1")).toBeTruthy();
      expect(screen.getByText("Last checkpoint: hook-1")).toBeTruthy();
      expect(screen.getByText("Hook checkpoints 1")).toBeTruthy();
      expect(
        screen.getByText((content) => content.includes("Hook post execution pre publication"))
      ).toBeTruthy();
      expect(screen.getAllByText("Source: telemetry").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Scope: write").length).toBeGreaterThan(0);
    });
  });

  it("shows runtime-owned launch preparation from runtime kernel v2", async () => {
    mockRuntimeTasks([]);

    render(<WorkspaceHomeAgentRuntimeOrchestration workspaceId="ws-approval" />);

    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText("Mission brief for agent"), {
        target: { value: "Inspect runtime launch path" },
      });
    });
    await waitFor(() => {
      expect(prepareRuntimeRunV2Mock).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: "ws-approval",
          executionProfileId: "balanced-delegate",
          validationPresetId: "standard",
          accessMode: "on-request",
          steps: [{ kind: "read", input: "Inspect runtime launch path" }],
        })
      );
    });

    expect(await screen.findByText("Mission planning")).toBeTruthy();
    expect(await screen.findByText("Plan version: plan-1")).toBeTruthy();
    expect(screen.getByText("Plan approval: pending")).toBeTruthy();
    expect(
      screen.getByText("Runtime clarified the mission and built a native execution plan.")
    ).toBeTruthy();
    expect(
      screen.getByText(
        "Delegation plan: Runtime will fan out review and validation in two child batches. | Child count 2 | Batches 1"
      )
    ).toBeTruthy();
    expect(
      screen.getByText(
        "Auxiliary execution: Runtime will offload compaction and recall to auxiliary routes."
      )
    ).toBeTruthy();
    expect(
      screen.getByText(/Validation: Run the standard validation lane before review\./)
    ).toBeTruthy();
    expect(screen.getByText(/Review focus: runtime truth \| approval batching/)).toBeTruthy();
    expect(
      screen.getByText("Repo guidance: AGENTS.md, CLAUDE.md, .github/copilot-instructions.md")
    ).toBeTruthy();
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

    const retryButton = screen.getByRole("button", { name: "Retry" });
    await waitFor(() => {
      expect((retryButton as HTMLButtonElement).disabled).toBe(false);
    });

    fireEvent.click(retryButton);

    await waitFor(() => {
      expect(
        screen.getByText(
          "Run task-retry loaded into the launcher for retry. Source-linked launch: GitHub issue #44 · ku0/hugecode. Retry from runtime-owned relaunch context."
        )
      ).toBeTruthy();
      expect(
        screen.getByText("Source-linked launch: GitHub issue #44 · ku0/hugecode")
      ).toBeTruthy();
      expect(screen.queryByText("Repo source mapping: github_issue")).toBeNull();
      expect(screen.getByText("Review profile source: runtime relaunch context")).toBeTruthy();
      expect(screen.getByText("Validation source: runtime relaunch context")).toBeTruthy();
      expect(screen.getAllByText("Validation preset: standard").length).toBeGreaterThan(0);
      expect(screen.getByText("Access mode: on-request")).toBeTruthy();
      expect(
        screen.getByText("Relaunch context: Retry from runtime-owned relaunch context.")
      ).toBeTruthy();
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
    const providers: RuntimeProviderCatalogEntry[] = [
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
    ];
    vi.mocked(getProvidersCatalog).mockResolvedValue(providers);
    vi.mocked(listOAuthAccounts).mockResolvedValue([]);
    vi.mocked(listOAuthPools).mockResolvedValue([]);
    mockRoutingPlugins({ providers });

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
    const providers: RuntimeProviderCatalogEntry[] = [
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
    ];
    vi.mocked(getProvidersCatalog).mockResolvedValue(providers);
    vi.mocked(listOAuthAccounts).mockResolvedValue([]);
    vi.mocked(listOAuthPools).mockResolvedValue([]);
    mockRoutingPlugins({ providers });

    render(<WorkspaceHomeAgentRuntimeOrchestration workspaceId="ws-approval" />);

    await waitFor(() => {
      expect(screen.getByText("Launch readiness needs attention")).toBeTruthy();
      expect(screen.getAllByText("Attention").length).toBeGreaterThan(0);
      expect(screen.getAllByText(/fall back to local\/native execution/i).length).toBeGreaterThan(
        0
      );
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

    const approveOldestButton = screen.getByRole("button", { name: "Approve oldest request" });
    await waitFor(() => {
      expect((approveOldestButton as HTMLButtonElement).disabled).toBe(false);
    });

    fireEvent.click(approveOldestButton);

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

    const approveButton = screen.getByRole("button", { name: "Approve" });
    await waitFor(() => {
      expect((approveButton as HTMLButtonElement).disabled).toBe(false);
    });

    fireEvent.click(approveButton);

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
    resumeAgentTaskMock.mockResolvedValue(
      buildRuntimeRunRecord({
        taskId: "runtime-recovered-1",
        status: "queued",
        checkpointId: "checkpoint-123",
      })
    );

    render(<WorkspaceHomeAgentRuntimeOrchestration workspaceId="ws-approval" />);

    await waitFor(() => {
      expect(screen.getByText("Recovered task")).toBeTruthy();
      expect(screen.getByText("Recovered")).toBeTruthy();
      expect(screen.getByText("Checkpoint checkpoint-row-1")).toBeTruthy();
      expect(screen.getByText("Trace agent-task:runtime-recovered-1")).toBeTruthy();
    });

    const recoveredTaskCard = screen
      .getByText("Recovered task")
      .closest(".workspace-home-code-runtime-item");
    if (!recoveredTaskCard) {
      throw new Error("Expected recovered task card to render");
    }

    const recoveredTaskCardElement = recoveredTaskCard as HTMLElement;
    const resumeButton = within(recoveredTaskCardElement).getByRole("button", {
      name: "Resume",
    });
    await waitFor(() => {
      expect((resumeButton as HTMLButtonElement).disabled).toBe(false);
    });

    fireEvent.click(resumeButton);

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
    resumeAgentTaskMock.mockResolvedValue(
      buildRuntimeRunRecord({
        taskId: "runtime-recovered-dot-case",
        status: "queued",
      })
    );

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
      .mockResolvedValueOnce(
        buildRuntimeRunRecord({
          taskId: "runtime-recovered-a",
          status: "queued",
        })
      )
      .mockResolvedValueOnce(
        buildRuntimeRunRecord({
          taskId: "runtime-recovered-b",
          status: "queued",
        })
      );

    render(<WorkspaceHomeAgentRuntimeOrchestration workspaceId="ws-approval" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Resume recoverable runs (2)" })).toBeTruthy();
      expect(screen.getByText("Recovered runs awaiting resume: 2")).toBeTruthy();
    });

    await waitFor(() => {
      expect(
        (
          screen.getByRole("button", {
            name: "Resume recoverable runs (2)",
          }) as HTMLButtonElement
        ).disabled
      ).toBe(false);
    });

    fireEvent.click(
      screen.getByRole("button", {
        name: "Resume recoverable runs (2)",
      })
    );

    await waitFor(() => {
      expect(resumeAgentTask).toHaveBeenCalledTimes(2);
      expect(resumeAgentTask).toHaveBeenNthCalledWith(1, { runId: "runtime-recovered-b" });
      expect(resumeAgentTask).toHaveBeenNthCalledWith(2, { runId: "runtime-recovered-a" });
      expect(screen.getByText("Resumed 2 recoverable run(s).")).toBeTruthy();
    });
  });

  it("shows runtime error when single resume fails", async () => {
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
    resumeAgentTaskMock.mockRejectedValue(
      new Error("Task is not recoverable from runtime restart interruption.")
    );

    render(<WorkspaceHomeAgentRuntimeOrchestration workspaceId="ws-approval" />);

    await waitFor(() => {
      expect(screen.getByText("Rejected recovery")).toBeTruthy();
    });

    const resumeRejectedButton = screen.getByRole("button", { name: "Resume" });
    await waitFor(() => {
      expect((resumeRejectedButton as HTMLButtonElement).disabled).toBe(false);
    });

    fireEvent.click(resumeRejectedButton);

    await waitFor(() => {
      expect(resumeAgentTask).toHaveBeenCalledWith({ runId: "runtime-rejected-1" });
      expect(
        screen.getByText("Task is not recoverable from runtime restart interruption.")
      ).toBeTruthy();
    });
  });

  it("classifies recoverable batch resume outcomes by success and transport failures", async () => {
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
      .mockResolvedValueOnce(
        buildRuntimeRunRecord({
          taskId: "runtime-batch-a",
          status: "queued",
        })
      )
      .mockRejectedValueOnce(new Error("runtime.task.resume.not_recoverable"))
      .mockRejectedValueOnce(new Error("network timeout"));

    render(<WorkspaceHomeAgentRuntimeOrchestration workspaceId="ws-approval" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Resume recoverable runs (3)" })).toBeTruthy();
    });

    await waitFor(() => {
      expect(
        (
          screen.getByRole("button", {
            name: "Resume recoverable runs (3)",
          }) as HTMLButtonElement
        ).disabled
      ).toBe(false);
    });

    fireEvent.click(
      screen.getByRole("button", {
        name: "Resume recoverable runs (3)",
      })
    );

    await waitFor(() => {
      expect(resumeAgentTask).toHaveBeenCalledTimes(3);
      expect(
        screen.getByText("Resumed 1 recoverable run(s). 2 failed to call resume.")
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

    await waitFor(() => {
      expect(
        (
          screen.getByRole("button", {
            name: "Resume recoverable runs (1)",
          }) as HTMLButtonElement
        ).disabled
      ).toBe(false);
    });

    fireEvent.click(
      screen.getByRole("button", {
        name: "Resume recoverable runs (1)",
      })
    );

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
          /Continuity \(handoff via Runtime mission linkage\): Continue from thread-handoff-only on another control device\./
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
          /Continuity \(resume via Runtime takeover bundle\): Runtime takeover bundle published the canonical resume path\./
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
      emitRuntimeUpdated(buildRuntimeUpdatedEvent("durability-rev-1", 5, 17));
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
      emitRuntimeUpdated(buildRuntimeUpdatedEvent("durability-rev-1", 6, 18));
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
      emitRuntimeUpdated(buildRuntimeUpdatedEvent("durability-rev-2", 7, 19));
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
      fireEvent.change(screen.getByLabelText("Batch config (parallel dispatch)"), {
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
    expect(
      screen.getByTestId("workspace-runtime-parallel-dispatch").textContent?.includes("retries: 2")
    ).toBe(true);
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
      fireEvent.change(screen.getByLabelText("Batch config (parallel dispatch)"), {
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
        "Outcome labels: success = completed task; failed = retries exhausted without a skip policy; skipped = dependency or failure policy prevented completion; retried = task rerun after a launch or runtime failure up to maxRetries."
      )
    ).toBeTruthy();
  });

  it("does not allow starting an enabled dispatch plan while validation hints remain", async () => {
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
        target: { value: "Do not start invalid parallel plans." },
      });

      fireEvent.change(screen.getByLabelText("Batch config (parallel dispatch)"), {
        target: {
          value: JSON.stringify(
            {
              enabled: true,
              maxParallel: 2,
              tasks: [
                {
                  taskKey: "plan",
                  dependsOn: ["missing"],
                  maxRetries: 1,
                  onFailure: "halt",
                },
              ],
            },
            null,
            2
          ),
        },
      });
    });

    const approveCurrentPlanButton = screen.queryByRole("button", {
      name: "Approve current plan",
    });
    if (approveCurrentPlanButton) {
      fireEvent.click(approveCurrentPlanButton);
    }

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Start mission run" })).toHaveProperty(
        "disabled",
        true
      );
    });
    expect(startRuntimeJobWithRemoteSelectionMock).not.toHaveBeenCalled();
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

      fireEvent.change(screen.getByLabelText("Batch config (parallel dispatch)"), {
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
      expect(screen.getByRole("button", { name: "Approve plan to start" })).toHaveProperty(
        "disabled",
        true
      );
    });

    const approveButton = screen.queryByRole("button", { name: "Approve current plan" });
    if (approveButton) {
      fireEvent.click(approveButton);
    }

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
        title: "Inspect src/runtime and summarize.",
        taskSource: {
          kind: "manual",
          title: "Inspect src/runtime and summarize.",
          workspaceId: "ws-approval",
          workspaceRoot: null,
        },
        executionProfileId: "balanced-delegate",
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
          planVersion: "plan-1",
          planSummary: "Inspect runtime boundary, validate, then hand off for review.",
          currentMilestoneId: "milestone-read",
          estimatedDurationMinutes: 12,
          estimatedWorkerRuns: 1,
          parallelismHint: "sequential",
          clarificationQuestions: [],
          milestones: [
            {
              id: "milestone-read",
              label: "Inspect runtime boundary",
              status: "in_progress",
              acceptanceCriteria: ["Identify the launch path", "Capture risks"],
            },
            {
              id: "milestone-validate",
              label: "Run validation",
              status: "pending",
              acceptanceCriteria: ["Run validate:fast"],
            },
          ],
          validationLanes: [
            {
              id: "lane-fast",
              label: "Fast lane",
              trigger: "pre_review",
              commands: ["pnpm validate:fast"],
            },
          ],
          skillPlan: [
            {
              id: "skill-runtime",
              label: "Runtime boundary inspection",
              state: "planned",
              detail: "Use runtime truth and approval batching surfaces.",
            },
          ],
          permissionSummary: {
            accessMode: "on-request",
            allowNetwork: null,
            writableRoots: null,
            toolNames: null,
          },
        },
        approvedPlanVersion: "plan-1",
        steps: [
          {
            kind: "read",
            input: "Inspect src/runtime and summarize.",
          },
        ],
      });
    });
  });

  it("fans out enabled dispatch chunks through preferred backend routing and renders live dispatch progress", async () => {
    mockRuntimeTasks([]);
    submitTaskApprovalDecisionMock.mockResolvedValue({
      recorded: true,
      approvalId: "approval-1",
      taskId: "runtime-running-1",
      status: "running",
      message: "ok",
    });
    startRuntimeJobWithRemoteSelectionMock
      .mockResolvedValueOnce(
        buildRuntimeRunRecord({
          taskId: "run-inspect",
          status: "queued",
          title: "Inspect runtime boundary",
          backendId: "backend-inspect",
          preferredBackendIds: ["backend-inspect"],
        })
      )
      .mockResolvedValueOnce(
        buildRuntimeRunRecord({
          taskId: "run-ux",
          status: "queued",
          title: "Render parallel progress",
          backendId: "backend-ui",
          preferredBackendIds: ["backend-ui"],
        })
      );
    render(<WorkspaceHomeAgentRuntimeOrchestration workspaceId="ws-approval" />);

    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText("Mission brief for agent"), {
        target: { value: "Split runtime orchestration work across specialized backends." },
      });

      fireEvent.change(screen.getByLabelText("Batch config (parallel dispatch)"), {
        target: {
          value: JSON.stringify(
            {
              enabled: true,
              maxParallel: 2,
              tasks: [
                {
                  taskKey: "inspect",
                  title: "Inspect runtime boundary",
                  instruction:
                    "Inspect runtime composition routing and summarize the dispatcher boundary.",
                  preferredBackendIds: ["backend-inspect"],
                  dependsOn: [],
                  maxRetries: 1,
                  onFailure: "halt",
                },
                {
                  taskKey: "ux",
                  title: "Render parallel progress",
                  instruction:
                    "Render live multi-agent mission control progress without page-local orchestration.",
                  preferredBackendIds: ["backend-ui"],
                  dependsOn: [],
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

    await waitFor(() => {
      expect(screen.queryByText("Runtime launch plan unavailable.")).toBeNull();
    });

    const approveCurrentPlanButton = screen.queryByRole("button", {
      name: "Approve current plan",
    });
    if (approveCurrentPlanButton) {
      fireEvent.click(approveCurrentPlanButton);
    }

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Start mission run" })).toHaveProperty(
        "disabled",
        false
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Start mission run" }));

    await waitFor(() => {
      expect(startRuntimeJobWithRemoteSelectionMock).toHaveBeenCalledTimes(2);
    });

    expect(
      startRuntimeJobWithRemoteSelectionMock.mock.calls.map((call) => ({
        title: call[0].title,
        executionMode: call[0].executionMode,
        preferredBackendIds: call[0].preferredBackendIds,
      }))
    ).toEqual([
      {
        title: "Inspect runtime boundary",
        executionMode: "distributed",
        preferredBackendIds: ["backend-inspect"],
      },
      {
        title: "Render parallel progress",
        executionMode: "distributed",
        preferredBackendIds: ["backend-ui"],
      },
    ]);

    const parallelDispatchSurface = screen.getByTestId("workspace-runtime-parallel-dispatch");
    expect(screen.getByText("Parallel dispatch")).toBeTruthy();
    expect(screen.getAllByText("Inspect runtime boundary").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Render parallel progress").length).toBeGreaterThan(0);
    expect(parallelDispatchSurface.textContent?.includes("backend-inspect")).toBe(true);
    expect(parallelDispatchSurface.textContent?.includes("backend-ui")).toBe(true);
  });
});
