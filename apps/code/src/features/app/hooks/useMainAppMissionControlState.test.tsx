// @vitest-environment jsdom

import type {
  HugeCodeMissionControlSnapshot,
  HugeCodeReviewPackSummary,
  HugeCodeRunSummary,
  HugeCodeTaskSummary,
} from "@ku0/code-runtime-host-contract";
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceInfo } from "../../../types";
import { useMainAppMissionControlState } from "./useMainAppMissionControlState";
import { trackProductAnalyticsEvent } from "../../shared/productAnalytics";

vi.mock("./useMainAppAutoDriveState", () => ({
  useMainAppAutoDriveState: vi.fn(() => ({ controls: {} })),
}));

vi.mock("./useSystemNotificationThreadLinks", () => ({
  useSystemNotificationThreadLinks: vi.fn(() => ({
    recordPendingThreadLink: vi.fn(),
    recordPendingMissionTarget: vi.fn(),
  })),
}));

vi.mock("./useMissionControlCompletionNotificationsController", () => ({
  useMissionControlCompletionNotificationsController: vi.fn(),
}));

vi.mock("./useMissionControlAttentionNotificationsController", () => ({
  useMissionControlAttentionNotificationsController: vi.fn(),
}));

vi.mock("../../shared/productAnalytics", () => ({
  trackProductAnalyticsEvent: vi.fn(async () => undefined),
}));

const WORKSPACE: WorkspaceInfo = {
  id: "ws-1",
  name: "Workspace",
  path: "/repo",
  connected: true,
  settings: {
    sidebarCollapsed: false,
  },
};

function createTask(overrides: Partial<HugeCodeTaskSummary> = {}): HugeCodeTaskSummary {
  return {
    id: "task-1",
    workspaceId: "ws-1",
    title: "Ship decomposition",
    objective: "Split control-plane concerns",
    origin: {
      kind: "thread",
      threadId: "thread-1",
      runId: "run-1",
      requestId: null,
    },
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
    taskId: "task-1",
    workspaceId: "ws-1",
    state: "running",
    title: "Run 1",
    summary: "Delegating work",
    startedAt: 1,
    finishedAt: null,
    updatedAt: 2,
    currentStepIndex: 0,
    pendingIntervention: null,
    autoDrive: null,
    executionProfile: {
      id: "profile-1",
      name: "Balanced Delegate",
      description: "Balanced",
      executionMode: "remote_sandbox",
      autonomy: "bounded_delegate",
      supervisionLabel: "Balanced",
      accessMode: "on-request",
      networkPolicy: "default",
      routingStrategy: "provider_route",
      toolPosture: "workspace_safe",
      approvalSensitivity: "standard",
      identitySource: null,
      validationPresetId: null,
    },
    profileReadiness: null,
    routing: {
      backendId: null,
      provider: "openai",
      providerLabel: "OpenAI",
      pool: "pool-a",
      routeLabel: "Remote backend",
      routeHint: null,
      health: "ready",
      enabledAccountCount: 1,
      readyAccountCount: 1,
      enabledPoolCount: 1,
    },
    approval: {
      status: "not_required",
      approvalId: null,
      label: "No pending approval",
      summary: "No approval required.",
    },
    reviewDecision: null,
    intervention: null,
    operatorState: null,
    nextAction: null,
    warnings: [],
    validations: [],
    artifacts: [],
    completionReason: null,
    reviewPackId: null,
    lineage: null,
    ledger: null,
    governance: null,
    placement: null,
    ...overrides,
  };
}

function createReviewPack(
  overrides: Partial<HugeCodeReviewPackSummary> = {}
): HugeCodeReviewPackSummary {
  return {
    id: "review-pack:run-1",
    runId: "run-1",
    taskId: "task-1",
    workspaceId: "ws-1",
    summary: "Review ready",
    reviewStatus: "ready",
    evidenceState: "confirmed",
    validationOutcome: "passed",
    warningCount: 0,
    warnings: [],
    validations: [],
    artifacts: [],
    checksPerformed: [],
    recommendedNextAction: null,
    assumptions: [],
    reproductionGuidance: [],
    rollbackGuidance: [],
    reviewDecision: null,
    createdAt: 10,
    lineage: null,
    ledger: null,
    governance: null,
    placement: null,
    ...overrides,
  };
}

function createSnapshot(input?: {
  run?: HugeCodeRunSummary;
  reviewPacks?: HugeCodeReviewPackSummary[];
}): HugeCodeMissionControlSnapshot {
  return {
    source: "runtime_snapshot_v1",
    generatedAt: 10,
    workspaces: [
      {
        id: "ws-1",
        name: "Workspace",
        rootPath: "/repo",
        connected: true,
        defaultProfileId: "profile-1",
      },
    ],
    tasks: [createTask()],
    runs: [input?.run ?? createRun()],
    reviewPacks: input?.reviewPacks ?? [],
  };
}

function createHookProps(
  missionControlProjection: HugeCodeMissionControlSnapshot | null
): Parameters<typeof useMainAppMissionControlState>[0] {
  return {
    activeWorkspace: WORKSPACE,
    activeThreadId: "thread-1",
    missionControlProjection,
    refreshMissionControl: vi.fn(),
    systemNotificationsEnabled: true,
    getWorkspaceName: vi.fn(() => "Workspace"),
    hasLoadedWorkspaces: true,
    workspacesById: new Map([[WORKSPACE.id, WORKSPACE]]),
    refreshWorkspaces: vi.fn(),
    connectWorkspace: vi.fn(),
    setActiveTab: vi.fn(),
    setCenterMode: vi.fn(),
    setSelectedDiffPath: vi.fn(),
    setActiveWorkspaceId: vi.fn(),
    setActiveThreadId: vi.fn(),
    onDebug: vi.fn(),
    threadCodexState: {
      accessMode: "on-request",
      selectedModelId: "gpt-5",
      selectedEffort: "medium",
    },
    threadCodexParamsVersion: 1,
    getThreadCodexParams: vi.fn(() => null),
    patchThreadCodexParams: vi.fn(),
    preferredBackendIds: ["backend-a"],
  };
}

describe("useMainAppMissionControlState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("records product-loop events from mission-control snapshot transitions without duplicates", () => {
    const { rerender } = renderHook(
      ({ snapshot }) => useMainAppMissionControlState(createHookProps(snapshot)),
      {
        initialProps: { snapshot: null as HugeCodeMissionControlSnapshot | null },
      }
    );

    const placedRun = createRun({
      placement: {
        resolvedBackendId: "backend-a",
        requestedBackendIds: ["backend-a"],
        resolutionSource: "explicit_preference",
        lifecycleState: "confirmed",
        readiness: "ready",
        summary: "Placed on backend-a",
        rationale: "Runtime honored the explicit preference.",
        backendContract: null,
      },
    });
    rerender({ snapshot: createSnapshot({ run: placedRun }) });
    rerender({ snapshot: createSnapshot({ run: placedRun }) });

    const awaitingApprovalRun = createRun({
      state: "needs_input",
      approval: {
        status: "pending_decision",
        approvalId: "approval-1",
        label: "Awaiting approval",
        summary: "Waiting for approval.",
      },
      placement: placedRun.placement,
    });
    rerender({ snapshot: createSnapshot({ run: awaitingApprovalRun }) });

    rerender({
      snapshot: createSnapshot({
        run: awaitingApprovalRun,
        reviewPacks: [createReviewPack()],
      }),
    });

    expect(trackProductAnalyticsEvent).toHaveBeenCalledWith(
      "placement_confirmed",
      expect.objectContaining({
        workspaceId: "ws-1",
        taskId: "task-1",
        runId: "run-1",
        backendId: "backend-a",
        runState: "running",
      })
    );
    expect(trackProductAnalyticsEvent).toHaveBeenCalledWith(
      "approval_wait_started",
      expect.objectContaining({
        workspaceId: "ws-1",
        taskId: "task-1",
        runId: "run-1",
        approvalStatus: "pending_decision",
        runState: "needs_input",
      })
    );
    expect(trackProductAnalyticsEvent).toHaveBeenCalledWith(
      "review_pack_ready",
      expect.objectContaining({
        workspaceId: "ws-1",
        taskId: "task-1",
        runId: "run-1",
        reviewPackId: "review-pack:run-1",
        reviewStatus: "ready",
      })
    );
    expect(
      vi
        .mocked(trackProductAnalyticsEvent)
        .mock.calls.filter(([eventName]) => eventName === "placement_confirmed")
    ).toHaveLength(1);
  });

  it("waits for confirmed ready placement before recording placement confirmation", () => {
    const { rerender } = renderHook(
      ({ snapshot }) => useMainAppMissionControlState(createHookProps(snapshot)),
      {
        initialProps: { snapshot: null as HugeCodeMissionControlSnapshot | null },
      }
    );

    const unresolvedRun = createRun({
      placement: {
        resolvedBackendId: "backend-a",
        requestedBackendIds: ["backend-a"],
        resolutionSource: "explicit_preference",
        lifecycleState: "resolved",
        readiness: "attention",
        summary: "Routing is still being confirmed.",
        rationale: "Backend selection is inferred but not yet confirmed by runtime.",
        backendContract: null,
      },
    });
    rerender({ snapshot: createSnapshot({ run: unresolvedRun }) });

    expect(
      vi
        .mocked(trackProductAnalyticsEvent)
        .mock.calls.filter(([eventName]) => eventName === "placement_confirmed")
    ).toHaveLength(0);

    const confirmedRun = createRun({
      placement: {
        ...unresolvedRun.placement!,
        lifecycleState: "confirmed",
        readiness: "ready",
        summary: "Placed on backend-a",
        rationale: "Runtime confirmed the route.",
      },
    });
    rerender({ snapshot: createSnapshot({ run: confirmedRun }) });

    expect(trackProductAnalyticsEvent).toHaveBeenCalledWith(
      "placement_confirmed",
      expect.objectContaining({
        backendId: "backend-a",
        isFallbackPlacement: false,
      })
    );
    expect(
      vi
        .mocked(trackProductAnalyticsEvent)
        .mock.calls.filter(([eventName]) => eventName === "placement_confirmed")
    ).toHaveLength(1);
  });
});
