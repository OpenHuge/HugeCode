// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  RuntimeRunGetV2Response,
  RuntimeRunSummary,
  HugeCodeRunSummary,
} from "@ku0/code-runtime-host-contract";
import type { RuntimeAgentTaskSummary } from "../../../application/runtime/types/webMcpBridge";
import { WorkspaceHomeAgentRuntimeRunItem } from "./WorkspaceHomeAgentRuntimeRunItem";

const getRuntimeRunV2Mock = vi.hoisted(() => vi.fn());

vi.mock("../../../application/runtime/ports/tauriRuntimeJobs", () => ({
  getRuntimeRunV2: getRuntimeRunV2Mock,
}));

function buildTask(overrides: Partial<RuntimeAgentTaskSummary> = {}): RuntimeAgentTaskSummary {
  const now = 1_700_000_000_000;
  return {
    taskId: "runtime-task-1",
    workspaceId: "workspace-1",
    threadId: null,
    requestId: null,
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

function buildRuntimeRunSummary(overrides: Partial<RuntimeRunSummary> = {}): RuntimeRunSummary {
  const task = buildTask(overrides);
  return {
    ...task,
    ...overrides,
    title: task.title ?? null,
    currentStep: task.currentStep ?? null,
    startedAt: task.startedAt ?? null,
    completedAt: task.completedAt ?? null,
    errorCode: task.errorCode ?? null,
    errorMessage: task.errorMessage ?? null,
    pendingApprovalId: task.pendingApprovalId ?? null,
    threadId: task.threadId ?? null,
    requestId: task.requestId ?? null,
    provider: task.provider ?? null,
    modelId: task.modelId ?? null,
    routedProvider: task.routedProvider ?? null,
    routedModelId: task.routedModelId ?? null,
    routedPool: task.routedPool ?? null,
    routedSource: task.routedSource ?? null,
    steps: task.steps ?? [],
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
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("keeps observability collapsed by default and toggles an accessible region", () => {
    const noop = vi.fn();

    render(
      <WorkspaceHomeAgentRuntimeRunItem
        task={buildTask()}
        run={buildRun()}
        continuityItem={null}
        runtimeLoading={false}
        onRefresh={noop}
        onInterrupt={noop}
        onResume={noop}
        onPrepareLauncher={noop}
        onApproval={noop}
      />
    );

    const toggle = screen.getByRole("button", { name: "Open sub-agent observability" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(toggle.getAttribute("aria-controls")).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Sub-agent observability" })).toBeNull();

    fireEvent.click(toggle);

    const region = screen.getByRole("region", { name: "Sub-agent observability" });
    expect(region.getAttribute("id")).toBe(toggle.getAttribute("aria-controls"));
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(within(region).getAllByText("Runtime wake and planning").length).toBeGreaterThan(0);
    expect(within(region).getAllByText("Delegated sessions").length).toBeGreaterThan(0);
    expect(within(region).getAllByText("Execution graph").length).toBeGreaterThan(0);
    expect(within(region).getAllByText("Operator trajectory").length).toBeGreaterThan(0);
    expect(within(region).getAllByText("Governance and next action").length).toBeGreaterThan(0);
    expect(region.querySelectorAll('[data-review-loop-section="true"]').length).toBe(5);

    fireEvent.click(screen.getByRole("button", { name: "Hide sub-agent observability" }));

    expect(screen.queryByRole("region", { name: "Sub-agent observability" })).toBeNull();
  });

  it("auto-expands observability when a visible run later requires approval", () => {
    const noop = vi.fn();
    const { rerender } = render(
      <WorkspaceHomeAgentRuntimeRunItem
        task={buildTask()}
        run={buildRun()}
        continuityItem={null}
        runtimeLoading={false}
        onRefresh={noop}
        onInterrupt={noop}
        onResume={noop}
        onPrepareLauncher={noop}
        onApproval={noop}
      />
    );

    expect(screen.getByRole("button", { name: "Open sub-agent observability" })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Sub-agent observability" })).toBeNull();

    rerender(
      <WorkspaceHomeAgentRuntimeRunItem
        task={buildTask({
          status: "awaiting_approval",
          pendingApprovalId: "approval-review-1",
        })}
        run={buildRun({
          approval: {
            status: "pending_decision",
            approvalId: "approval-review-1",
            label: "Approval required",
            summary: "Runtime is waiting for approval before continuing.",
          },
          nextAction: {
            label: "Approve delegated review",
            action: "review",
            detail: "A delegated reviewer is waiting for approval before continuing.",
          },
          subAgents: [
            {
              sessionId: "session-review",
              status: "awaiting_approval",
              summary: "Reviewer session is paused for approval.",
              approvalState: {
                status: "pending_decision",
                approvalId: "approval-review-1",
                reason: "Approve reviewer escalation to continue.",
                at: 1_700_000_100_000,
              },
            },
          ],
        })}
        continuityItem={null}
        runtimeLoading={false}
        onRefresh={noop}
        onInterrupt={noop}
        onResume={noop}
        onPrepareLauncher={noop}
        onApproval={noop}
      />
    );

    expect(screen.getByRole("button", { name: "Hide sub-agent observability" })).toBeTruthy();
    const observability = screen.getByRole("region", { name: "Sub-agent observability" });
    expect(observability).toBeTruthy();
    expect(observability.getAttribute("data-review-loop-panel")).toBe("runtime-observability");
    expect(
      within(observability).getByText("Reviewer session is paused for approval.")
    ).toBeTruthy();
  });

  it("keeps observability collapsed after a manual close during same blocking refresh", () => {
    const noop = vi.fn();
    const blockingTask = buildTask({
      status: "awaiting_approval",
      pendingApprovalId: "approval-review-1",
      updatedAt: 1_700_000_100_000,
    });
    const blockingRun = buildRun({
      updatedAt: 1_700_000_100_000,
      approval: {
        status: "pending_decision",
        approvalId: "approval-review-1",
        label: "Approval required",
        summary: "Runtime is waiting for approval before continuing.",
      },
      nextAction: {
        label: "Approve delegated review",
        action: "review",
        detail: "A delegated reviewer is waiting for approval before continuing.",
      },
      subAgents: [
        {
          sessionId: "session-review",
          status: "awaiting_approval",
          summary: "Reviewer session is paused for approval.",
          approvalState: {
            status: "pending_decision",
            approvalId: "approval-review-1",
            reason: "Approve reviewer escalation to continue.",
            at: 1_700_000_100_000,
          },
        },
      ],
    });
    const { rerender } = render(
      <WorkspaceHomeAgentRuntimeRunItem
        task={blockingTask}
        run={blockingRun}
        continuityItem={null}
        runtimeLoading={false}
        onRefresh={noop}
        onInterrupt={noop}
        onResume={noop}
        onPrepareLauncher={noop}
        onApproval={noop}
      />
    );

    expect(screen.getByRole("region", { name: "Sub-agent observability" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Hide sub-agent observability" }));
    expect(screen.queryByRole("region", { name: "Sub-agent observability" })).toBeNull();

    rerender(
      <WorkspaceHomeAgentRuntimeRunItem
        task={{ ...blockingTask, updatedAt: 1_700_000_200_000 }}
        run={{ ...blockingRun, updatedAt: 1_700_000_200_000 }}
        continuityItem={null}
        runtimeLoading={false}
        onRefresh={noop}
        onInterrupt={noop}
        onResume={noop}
        onPrepareLauncher={noop}
        onApproval={noop}
      />
    );

    expect(screen.getByRole("button", { name: "Open sub-agent observability" })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Sub-agent observability" })).toBeNull();
  });

  it("prefers runtime run truth for review, checkpoint, and publish handoff detail", async () => {
    const noop = vi.fn();
    getRuntimeRunV2Mock.mockResolvedValue({
      run: buildRuntimeRunSummary({
        status: "completed",
        checkpointId: "checkpoint-runtime-1",
        traceId: "trace-runtime-1",
      }),
      missionRun: buildRun({
        state: "review_ready",
        summary: "Projection summary should not win.",
      }),
      reviewPack: {
        id: "review-pack:runtime-task-1",
        runId: "runtime-task-1",
        taskId: "runtime-task-1",
        workspaceId: "workspace-1",
        summary: "Runtime review truth is ready for operator inspection.",
        reviewStatus: "ready",
        evidenceState: "confirmed",
        validationOutcome: "passed",
        warningCount: 0,
        warnings: [],
        validations: [],
        artifacts: [],
        checksPerformed: [],
        recommendedNextAction: "Inspect review evidence.",
        createdAt: 1_700_000_000_000,
        checkpoint: {
          state: "available",
          lifecycleState: "published",
          checkpointId: "checkpoint-runtime-1",
          traceId: "trace-runtime-1",
          recovered: false,
          updatedAt: 1_700_000_000_000,
          resumeReady: true,
          summary: "Checkpoint published.",
        },
        publishHandoff: {
          jsonPath: ".hugecode/runs/runtime-task-1/publish/handoff.json",
          markdownPath: ".hugecode/runs/runtime-task-1/publish/handoff.md",
          summary: "Runtime handoff is ready for another control device.",
        },
      },
    } satisfies RuntimeRunGetV2Response);

    render(
      <WorkspaceHomeAgentRuntimeRunItem
        task={buildTask({
          status: "completed",
        })}
        run={buildRun({
          state: "review_ready",
          summary: "Projection summary should not win.",
        })}
        continuityItem={null}
        runtimeLoading={false}
        onRefresh={noop}
        onInterrupt={noop}
        onResume={noop}
        onPrepareLauncher={noop}
        onApproval={noop}
      />
    );

    await waitFor(() => {
      expect(
        screen.getByText("Review: Runtime review truth is ready for operator inspection.")
      ).toBeTruthy();
      expect(
        screen.getByText("Publish handoff: Runtime handoff is ready for another control device.")
      ).toBeTruthy();
      expect(screen.getAllByText(/Checkpoint checkpoint-runtime-1/).length).toBeGreaterThan(0);
    });
  });

  it("surfaces runtime kernel v2 wake and planning truth from the run record", async () => {
    const noop = vi.fn();
    getRuntimeRunV2Mock.mockResolvedValue({
      run: buildRuntimeRunSummary(),
      missionRun: buildRun({
        subAgents: [],
        operatorSnapshot: null,
        executionGraph: null,
      }),
      reviewPack: null,
      autonomyProfile: "night_operator",
      wakePolicy: {
        mode: "auto_queue",
        safeFollowUp: true,
        allowAutomaticContinuation: true,
        allowedActions: ["continue", "approve", "clarify", "reroute", "pair", "hold"],
        stopGates: ["validation_failure_requires_review"],
      },
      intentSnapshot: {
        summary: "Runtime preserved the bounded mission intent for this run.",
        primaryGoal: "Delegated runtime task",
        dominantDirection: "Advance the runtime task safely.",
        confidence: "high",
        signals: [],
      },
      opportunityQueue: {
        selectedOpportunityId: "opportunity-runtime-primary",
        selectionSummary: "Runtime kept the closest bounded opportunity active.",
        candidates: [],
      },
      researchTrace: {
        mode: "repository_only",
        stage: "repository",
        summary: "Research remains repository-only for this run.",
        citations: [],
        sensitiveContextMixed: false,
      },
      executionEligibility: {
        eligible: true,
        summary: "Runtime can continue within the current bounded opportunity.",
        wakeState: "ready",
        nextEligibleAction: "continue",
        blockingReasons: [],
      },
      wakeReason: "review_pack_ready",
      selectedOpportunityId: "opportunity-runtime-primary",
    } satisfies RuntimeRunGetV2Response);

    render(
      <WorkspaceHomeAgentRuntimeRunItem
        task={buildTask()}
        run={buildRun({
          subAgents: [],
          operatorSnapshot: null,
          executionGraph: null,
        })}
        continuityItem={null}
        runtimeLoading={false}
        onRefresh={noop}
        onInterrupt={noop}
        onResume={noop}
        onPrepareLauncher={noop}
        onApproval={noop}
      />
    );

    await waitFor(() => {
      expect(
        screen.getByText(
          "Execution eligibility: Runtime can continue within the current bounded opportunity."
        )
      ).toBeTruthy();
      expect(
        screen.getByText("Opportunity queue: Runtime kept the closest bounded opportunity active.")
      ).toBeTruthy();
      expect(
        screen.getByText("Research: Research remains repository-only for this run. (Repository)")
      ).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Open sub-agent observability" }));

    const region = await screen.findByRole("region", { name: "Sub-agent observability" });
    expect(within(region).getByText("Runtime wake and planning")).toBeTruthy();
    expect(
      within(region).getByText("Intent: Runtime preserved the bounded mission intent for this run.")
    ).toBeTruthy();
    expect(within(region).getByText("Next eligible action: Continue")).toBeTruthy();
    expect(
      within(region).getByText("Selected opportunity: opportunity-runtime-primary")
    ).toBeTruthy();
    expect(within(region).getByText("Wake reason: review_pack_ready")).toBeTruthy();
  });
});
