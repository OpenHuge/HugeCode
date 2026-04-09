// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HugeCodeRunSummary } from "@ku0/code-runtime-host-contract";
import type { RuntimeAgentTaskSummary } from "../../../application/runtime/types/webMcpBridge";
import { WorkspaceHomeAgentRuntimeRunItem } from "./WorkspaceHomeAgentRuntimeRunItem";

const getRuntimeRunV2Mock = vi.hoisted(() => vi.fn());
const subscribeRuntimeRunV2Mock = vi.hoisted(() => vi.fn());

vi.mock("../../../application/runtime/ports/runtimeJobs", () => ({
  getRuntimeRunV2: getRuntimeRunV2Mock,
  subscribeRuntimeRunV2: subscribeRuntimeRunV2Mock,
}));

function buildTask(overrides: Partial<RuntimeAgentTaskSummary> = {}): RuntimeAgentTaskSummary {
  const now = 1_700_000_000_000;
  return {
    taskId: "runtime-task-1",
    workspaceId: "workspace-1",
    threadId: null,
    title: "Delegated runtime task",
    status: "running",
    accessMode: "on-request",
    distributedStatus: null,
    currentStep: 1,
    createdAt: now,
    updatedAt: now,
    startedAt: now,
    completedAt: null,
    errorCode: null,
    errorMessage: null,
    pendingApprovalId: null,
    ...overrides,
  };
}

function buildRun(overrides: Partial<HugeCodeRunSummary> = {}): HugeCodeRunSummary {
  return {
    id: "runtime-task-1",
    taskId: "runtime-task-1",
    workspaceId: "workspace-1",
    state: "running",
    title: "Delegated runtime task",
    summary: "Runtime is coordinating delegated work.",
    startedAt: 1_700_000_000_000,
    finishedAt: null,
    updatedAt: 1_700_000_050_000,
    warnings: [],
    validations: [],
    artifacts: [],
    changedPaths: [],
    subAgents: [
      {
        sessionId: "session-impl",
        status: "running",
        summary: "Implementation session is applying the runtime fix.",
      },
    ],
    operatorSnapshot: {
      summary: "One delegated session is active under this run.",
      currentActivity: "Implementation is applying the runtime fix.",
      recentEvents: [],
    },
    executionGraph: {
      graphId: "graph-runtime-task-1",
      nodes: [
        {
          id: "node-impl",
          kind: "plan",
          status: "running",
          executorKind: "sub_agent",
          executorSessionId: "session-impl",
          resolvedBackendId: "backend-primary",
          placementLifecycleState: "confirmed",
          placementResolutionSource: "workspace_default",
        },
      ],
      edges: [],
    },
    ...overrides,
  } as HugeCodeRunSummary;
}

describe("WorkspaceHomeAgentRuntimeRunItem", () => {
  beforeEach(() => {
    getRuntimeRunV2Mock.mockResolvedValue(null);
    subscribeRuntimeRunV2Mock.mockResolvedValue(null);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("surfaces placement rationale and fallback reasons in run details and observability", () => {
    const noop = vi.fn();

    render(
      <WorkspaceHomeAgentRuntimeRunItem
        task={buildTask()}
        run={buildRun({
          placement: {
            resolvedBackendId: "backend-local",
            requestedBackendIds: [],
            resolutionSource: "workspace_default",
            lifecycleState: "fallback",
            readiness: "attention",
            healthSummary: "placement_attention",
            attentionReasons: ["fallback_backend_selected"],
            summary: "Launch fell back to the local runtime backend.",
            rationale: "Remote provider routing is not ready for this run.",
            fallbackReasonCode: "remote_provider_not_ready",
          },
          routing: {
            backendId: "backend-local",
            provider: "native",
            providerLabel: "Native runtime",
            pool: null,
            routeLabel: "Automatic workspace routing",
            routeHint: "Local/native fallback is handling this run.",
            health: "attention",
            enabledAccountCount: 0,
            readyAccountCount: 0,
            enabledPoolCount: 0,
          },
        })}
        continuityItem={null}
        runtimeLoading={false}
        onRefresh={noop}
        onInterrupt={noop}
        onResume={noop}
        onIntervene={noop}
        onPrepareLauncher={noop}
        onApproval={noop}
      />
    );

    expect(
      screen.getByText("Placement: Launch fell back to the local runtime backend.")
    ).toBeTruthy();
    expect(
      screen.getByText("Placement rationale: Remote provider routing is not ready for this run.")
    ).toBeTruthy();
    expect(screen.getByText("Fallback reason: remote_provider_not_ready")).toBeTruthy();
    expect(
      screen.getByText("Routing detail: Local/native fallback is handling this run.")
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Open sub-agent observability" }));

    const observability = screen.getByRole("region", { name: "Sub-agent observability" });
    expect(
      within(observability).getByText(
        "Placement rationale: Remote provider routing is not ready for this run."
      )
    ).toBeTruthy();
    expect(
      within(observability).getByText("Fallback reason: remote_provider_not_ready")
    ).toBeTruthy();
  });

  it("opens runtime-published child continuation targets from takeover truth", () => {
    const noop = vi.fn();
    const onOpenMissionTarget = vi.fn();

    render(
      <WorkspaceHomeAgentRuntimeRunItem
        task={buildTask({ threadId: "thread-runtime-1" })}
        run={buildRun({
          reviewPackId: "review-pack-parent",
          subAgents: [
            {
              sessionId: "session-review",
              status: "failed",
              summary: "Review delegate is blocked on operator follow-up.",
              takeoverBundle: {
                state: "attention",
                pathKind: "review",
                primaryAction: "open_review_pack",
                summary: "Open the delegated review pack.",
                recommendedAction: "Inspect the delegated review continuation.",
                target: {
                  kind: "review_pack",
                  workspaceId: "workspace-1",
                  taskId: "runtime-task-1",
                  runId: "runtime-task-1",
                  reviewPackId: "review-pack-child",
                },
              },
            },
          ],
        })}
        continuityItem={null}
        runtimeLoading={false}
        onRefresh={noop}
        onInterrupt={noop}
        onOpenMissionTarget={onOpenMissionTarget}
        onResume={noop}
        onIntervene={noop}
        onPrepareLauncher={noop}
        onApproval={noop}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Open review" }));

    expect(onOpenMissionTarget).toHaveBeenCalledWith({
      kind: "review",
      workspaceId: "workspace-1",
      taskId: "runtime-task-1",
      runId: "runtime-task-1",
      reviewPackId: "review-pack-child",
      limitation: null,
    });
  });
});
