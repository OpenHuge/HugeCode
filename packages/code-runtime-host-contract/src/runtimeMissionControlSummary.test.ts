import { describe, expect, it } from "vitest";
import type { HugeCodeMissionControlSnapshot } from "./hugeCodeMissionControl.js";
import type { RuntimeCapabilitiesSummary } from "./code-runtime-rpc/runtimeFeatures.js";
import {
  buildRuntimeLaunchReadinessSummary,
  buildRuntimeMissionControlSummary,
} from "./runtimeMissionControlSummary";

function createSnapshot(
  overrides: Partial<HugeCodeMissionControlSnapshot> = {}
): HugeCodeMissionControlSnapshot {
  return {
    source: "runtime_snapshot_v1",
    generatedAt: 0,
    workspaces: [
      {
        id: "workspace-1",
        name: "Alpha",
        rootPath: "/alpha",
        connected: true,
        defaultProfileId: null,
      },
    ],
    tasks: [],
    runs: [],
    reviewPacks: [],
    ...overrides,
  };
}

function buildCapabilitiesSummary(
  overrides: Partial<RuntimeCapabilitiesSummary> = {}
): RuntimeCapabilitiesSummary {
  return {
    mode: "tauri",
    methods: ["code_health"],
    features: ["distributed_subtask_graph"],
    wsEndpointPath: "/ws",
    error: null,
    ...overrides,
  };
}

describe("runtimeMissionControlSummary", () => {
  it("prefers canonical continuation and next operator action over stale fragment truth", () => {
    const summary = buildRuntimeMissionControlSummary(
      createSnapshot({
        tasks: [
          {
            id: "task-1",
            workspaceId: "workspace-1",
            title: "Stabilize runtime truth",
            objective: null,
            origin: {
              kind: "run",
              runId: "run-1",
              threadId: null,
              requestId: null,
            },
            taskSource: null,
            mode: null,
            modeSource: "missing",
            status: "review_ready",
            createdAt: 0,
            updatedAt: 0,
            currentRunId: "run-1",
            latestRunId: "run-1",
            latestRunState: "review_ready",
          },
        ],
        runs: [
          {
            id: "run-1",
            workspaceId: "workspace-1",
            taskId: "task-1",
            state: "review_ready",
            title: "Stabilize runtime truth",
            summary: "Stale run summary",
            taskSource: null,
            startedAt: 0,
            finishedAt: null,
            updatedAt: 0,
            currentStepIndex: null,
            continuation: {
              state: "ready",
              pathKind: "review",
              source: "review_actionability",
              summary: "Canonical continuation says the review path is ready.",
              detail: "Open the published review path.",
              recommendedAction: "Use the canonical review continuation.",
              reviewPackId: "review-1",
              sessionBoundary: {
                workspaceId: "workspace-1",
                taskId: "task-1",
                runId: "run-1",
                missionTaskId: "task-1",
                sessionKind: "run",
                navigationTarget: {
                  kind: "run",
                  workspaceId: "workspace-1",
                  taskId: "task-1",
                  runId: "run-1",
                },
              },
            },
            nextOperatorAction: {
              action: "open_review_pack",
              label: "Open canonical review",
              detail: "Canonical operator action detail should be shown first.",
              source: "continuation",
              sessionBoundary: {
                workspaceId: "workspace-1",
                taskId: "task-1",
                runId: "run-1",
                missionTaskId: "task-1",
                sessionKind: "run",
                navigationTarget: {
                  kind: "run",
                  workspaceId: "workspace-1",
                  taskId: "task-1",
                  runId: "run-1",
                },
              },
            },
            takeoverBundle: {
              state: "blocked",
              pathKind: "review",
              primaryAction: "open_review_pack",
              summary: "Blocked fragment fallback should not win.",
              recommendedAction: "Blocked fallback should not win.",
              reviewPackId: "review-1",
            },
            actionability: {
              state: "blocked",
              summary: "Blocked stale actionability should not win.",
              degradedReasons: [],
              actions: [],
            },
          },
        ],
      }),
      "workspace-1"
    );

    expect(summary.continuityReadiness.tone).toBe("ready");
    expect(summary.continuityReadiness.detail).toContain("1 review follow-up actionable");
    expect(summary.missionItems[0]).toMatchObject({
      statusLabel: "Review ready",
      detail: "Canonical operator action detail should be shown first.",
    });
  });

  it("keeps launch readiness blocked when runtime or route truth blocks launch", () => {
    const summary = buildRuntimeLaunchReadinessSummary({
      capabilities: buildCapabilitiesSummary(),
      health: {
        app: "hugecode-runtime",
        version: "1.0.0",
        status: "ok",
      },
      healthError: null,
      selectedRoute: {
        value: "openai",
        label: "OpenAI",
        state: "blocked",
        ready: false,
        launchAllowed: false,
        detail: "Enable at least one pool for this provider.",
        blockingReason: "Enable at least one pool for this provider.",
      },
      executionReliability: {
        state: "ready",
        blockingReason: null,
        recommendedAction: "Runtime execution reliability looks healthy for another launch.",
        gate: {
          minSuccessRate: 0.95,
          successRate: 1,
          denominator: 10,
          passed: true,
        },
        channelHealth: {
          status: "healthy",
          reason: null,
          lastErrorCode: null,
          updatedAt: 1,
          source: "guardrails",
        },
        blockedTotal: 0,
        topFailedReason: null,
        circuitBreakers: [],
      },
      pendingApprovalCount: 0,
      stalePendingApprovalCount: 0,
    });

    expect(summary.state).toBe("blocked");
    expect(summary.launchAllowed).toBe(false);
    expect(summary.blockingReason).toBe("Enable at least one pool for this provider.");
  });
});
