// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RuntimeRunGetV2Response, HugeCodeRunSummary } from "@ku0/code-runtime-host-contract";
import { __resetRuntimeRunTruthStoreForTests } from "../../../application/runtime/facades/runtimeRunTruthStore";
import type { RuntimeAgentTaskSummary } from "../../../application/runtime/types/webMcpBridge";
import { WorkspaceHomeAgentRuntimeRunItem } from "./WorkspaceHomeAgentRuntimeRunItem";

const getRuntimeRunV2Mock = vi.hoisted(() => vi.fn());
const subscribeRuntimeRunV2Mock = vi.hoisted(() => vi.fn());

vi.mock("../../../application/runtime/ports/runtimeJobs", () => ({
  getRuntimeRunV2: getRuntimeRunV2Mock,
  subscribeRuntimeRunV2: subscribeRuntimeRunV2Mock,
}));

type RuntimeAgentTaskFixture = RuntimeAgentTaskSummary & {
  requestId: string | null;
} & RuntimeRunGetV2Response["run"];

function buildTask(overrides: Partial<RuntimeAgentTaskFixture> = {}): RuntimeAgentTaskFixture {
  const now = 1_700_000_000_000;
  return {
    taskId: "runtime-task-1",
    workspaceId: "workspace-1",
    threadId: null,
    requestId: null,
    title: "Delegated runtime task",
    status: "running",
    accessMode: "on-request",
    provider: null,
    modelId: null,
    routedProvider: null,
    routedModelId: null,
    routedPool: null,
    routedSource: null,
    distributedStatus: null,
    currentStep: 1,
    createdAt: now,
    updatedAt: now,
    startedAt: now,
    completedAt: null,
    errorCode: null,
    errorMessage: null,
    pendingApprovalId: null,
    steps: [],
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

async function flushAsyncEffects() {
  await Promise.resolve();
  await Promise.resolve();
}

async function renderAndFlush(element: Parameters<typeof render>[0]) {
  let view: ReturnType<typeof render> | null = null;
  await act(async () => {
    view = render(element);
    await flushAsyncEffects();
  });
  if (!view) {
    throw new Error("renderAndFlush did not produce a render result.");
  }
  return view;
}

async function rerenderAndFlush(
  view: ReturnType<typeof render>,
  element: Parameters<typeof render>[0]
) {
  await act(async () => {
    view.rerender(element);
    await flushAsyncEffects();
  });
}

describe("WorkspaceHomeAgentRuntimeRunItem", () => {
  beforeEach(() => {
    __resetRuntimeRunTruthStoreForTests();
    getRuntimeRunV2Mock.mockResolvedValue(null);
    subscribeRuntimeRunV2Mock.mockResolvedValue(null);
  });

  afterEach(() => {
    cleanup();
    __resetRuntimeRunTruthStoreForTests();
    vi.clearAllMocks();
  });

  it("keeps observability collapsed by default and toggles an accessible region", async () => {
    const noop = vi.fn();

    await renderAndFlush(
      <WorkspaceHomeAgentRuntimeRunItem
        task={buildTask()}
        run={buildRun()}
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

    const toggle = screen.getByRole("button", { name: "Open sub-agent observability" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(toggle.getAttribute("aria-controls")).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Sub-agent observability" })).toBeNull();

    fireEvent.click(toggle);

    const region = screen.getByRole("region", { name: "Sub-agent observability" });
    expect(region.getAttribute("id")).toBe(toggle.getAttribute("aria-controls"));
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(within(region).getAllByText("Delegated sessions").length).toBeGreaterThan(0);
    expect(within(region).getAllByText("Execution graph").length).toBeGreaterThan(0);
    expect(within(region).getAllByText("Operator trajectory").length).toBeGreaterThan(0);
    expect(within(region).getAllByText("Governance and next action").length).toBeGreaterThan(0);
    expect(region.querySelectorAll('[data-review-loop-section="true"]').length).toBe(4);

    fireEvent.click(screen.getByRole("button", { name: "Hide sub-agent observability" }));

    expect(screen.queryByRole("region", { name: "Sub-agent observability" })).toBeNull();
  });

  it("auto-expands observability when a visible run later requires approval", async () => {
    const noop = vi.fn();
    const view = await renderAndFlush(
      <WorkspaceHomeAgentRuntimeRunItem
        task={buildTask()}
        run={buildRun()}
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

    expect(screen.getByRole("button", { name: "Open sub-agent observability" })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Sub-agent observability" })).toBeNull();

    await rerenderAndFlush(
      view,
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
                status: "pending",
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
        onIntervene={noop}
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

  it("keeps observability collapsed after a manual close during same blocking refresh", async () => {
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
            status: "pending",
            approvalId: "approval-review-1",
            reason: "Approve reviewer escalation to continue.",
            at: 1_700_000_100_000,
          },
        },
      ],
    });
    const view = await renderAndFlush(
      <WorkspaceHomeAgentRuntimeRunItem
        task={blockingTask}
        run={blockingRun}
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

    expect(screen.getByRole("region", { name: "Sub-agent observability" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Hide sub-agent observability" }));
    expect(screen.queryByRole("region", { name: "Sub-agent observability" })).toBeNull();

    await rerenderAndFlush(
      view,
      <WorkspaceHomeAgentRuntimeRunItem
        task={{ ...blockingTask, updatedAt: 1_700_000_200_000 }}
        run={{ ...blockingRun, updatedAt: 1_700_000_200_000 }}
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

    expect(screen.getByRole("button", { name: "Open sub-agent observability" })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Sub-agent observability" })).toBeNull();
  });

  it("prefers runtime run truth for review, checkpoint, and publish handoff detail", async () => {
    const noop = vi.fn();
    getRuntimeRunV2Mock.mockResolvedValue({
      run: {
        ...buildTask({
          status: "completed",
          checkpointId: "checkpoint-runtime-1",
          traceId: "trace-runtime-1",
        }),
      },
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

    await renderAndFlush(
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
        onIntervene={noop}
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

  it("submits structured mission interventions with approved plan version", async () => {
    const noop = vi.fn();
    const onIntervene = vi.fn();

    await renderAndFlush(
      <WorkspaceHomeAgentRuntimeRunItem
        task={buildTask()}
        run={buildRun({
          missionBrief: {
            objective: "Stabilize runtime mission control.",
            planVersion: "plan-2026",
            planSummary: "Replan, validate, and hand off.",
            currentMilestoneId: "milestone-execute",
            milestones: [
              {
                id: "milestone-execute",
                label: "Execute fixes",
                summary: "Apply the runtime fix.",
                status: "active",
              },
            ],
            validationLanes: [
              {
                id: "lane-fast",
                label: "Fast lane",
                summary: "Run validate:fast.",
                trigger: "per_feature",
                commands: ["pnpm validate:fast"],
              },
            ],
          },
        })}
        continuityItem={null}
        runtimeLoading={false}
        onRefresh={noop}
        onInterrupt={noop}
        onResume={noop}
        onIntervene={onIntervene}
        onPrepareLauncher={noop}
        onApproval={noop}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Mission intervene" }));
    fireEvent.change(screen.getByLabelText("Action"), {
      target: { value: "change_backend_preference" },
    });
    fireEvent.change(screen.getByLabelText("Reason"), {
      target: { value: "Route this run to healthier backends." },
    });
    fireEvent.change(screen.getByLabelText("Backend preference"), {
      target: { value: "backend-b, backend-c" },
    });
    fireEvent.change(screen.getByLabelText("Patch"), {
      target: { value: "Keep scope fixed and preserve the current validation lane." },
    });

    fireEvent.click(screen.getByRole("button", { name: "Submit intervention" }));

    expect(onIntervene).toHaveBeenCalledWith({
      action: "change_backend_preference",
      reason: "Route this run to healthier backends.",
      instructionPatch:
        "Preferred backends: backend-b, backend-c.\nKeep scope fixed and preserve the current validation lane.",
      preferredBackendIds: ["backend-b", "backend-c"],
      approvedPlanVersion: "plan-2026",
    });
  });

  it("dispatches child-session approval, interrupt, and close actions from runtime truth", async () => {
    const noop = vi.fn();
    const onSubAgentApproval = vi.fn();
    const onSubAgentInterrupt = vi.fn();
    const onSubAgentClose = vi.fn();

    await renderAndFlush(
      <WorkspaceHomeAgentRuntimeRunItem
        task={buildTask({
          status: "awaiting_approval",
          pendingApprovalId: "approval-parent-1",
        })}
        run={buildRun({
          subAgents: [
            {
              sessionId: "session-review",
              status: "awaiting_approval",
              summary: "Reviewer session is paused for approval.",
              approvalState: {
                status: "pending",
                approvalId: "approval-review-1",
                reason: "Approve reviewer escalation to continue.",
                at: 1_700_000_100_000,
              },
              resultSummary: {
                summary: "Reviewer summarized the remaining risk.",
                nextAction: "Approve the delegated reviewer to continue.",
              },
              contextProjection: {
                boundaryId: "boundary-review",
                workingSetSummary: "Review scope is narrowed to runtime approval evidence.",
                knowledgeItems: [
                  {
                    id: "knowledge-review-1",
                    kind: "delegation_hint",
                    scope: "sub_agent",
                    summary: "Approval context was inherited from the parent run.",
                    provenance: ["runtime"],
                  },
                ],
              },
            },
            {
              sessionId: "session-impl",
              status: "running",
              summary: "Implementation session is still executing.",
            },
            {
              sessionId: "session-timeout",
              status: "failed",
              summary: "Timed-out diagnostics lane.",
              timedOutReason: "runtime_watchdog_timeout",
              failureClass: "budget",
              takeoverBundle: {
                state: "attention",
                pathKind: "resume",
                primaryAction: "resume",
                summary: "Resume the lane from its last checkpoint.",
                recommendedAction: "Close the timed-out session and relaunch from parent control.",
              },
            },
          ],
        })}
        continuityItem={null}
        runtimeLoading={false}
        onRefresh={noop}
        onInterrupt={noop}
        onSubAgentApproval={onSubAgentApproval}
        onSubAgentInterrupt={onSubAgentInterrupt}
        onSubAgentClose={onSubAgentClose}
        onResume={noop}
        onIntervene={noop}
        onPrepareLauncher={noop}
        onApproval={noop}
      />
    );

    const observability = screen.getByRole("region", { name: "Sub-agent observability" });
    expect(
      within(observability).getByText("Result: Reviewer summarized the remaining risk.")
    ).toBeTruthy();
    expect(
      within(observability).getByText(
        "Context: Review scope is narrowed to runtime approval evidence."
      )
    ).toBeTruthy();
    expect(
      within(observability).getByText(
        "Knowledge: Approval context was inherited from the parent run."
      )
    ).toBeTruthy();
    expect(within(observability).getByText("Failure: Budget")).toBeTruthy();
    expect(
      within(observability).getByText(
        "Continuation: Close the timed-out session and relaunch from parent control."
      )
    ).toBeTruthy();

    const reviewCard = screen.getByText("session-review").closest("article");
    const timeoutCard = screen.getByText("session-timeout").closest("article");

    expect(reviewCard).toBeTruthy();
    expect(timeoutCard).toBeTruthy();

    fireEvent.click(within(reviewCard!).getByRole("button", { name: "Approve child" }));
    fireEvent.click(within(reviewCard!).getByRole("button", { name: "Reject child" }));
    fireEvent.click(within(reviewCard!).getByRole("button", { name: "Interrupt child" }));
    fireEvent.click(within(timeoutCard!).getByRole("button", { name: "Close child" }));

    expect(onSubAgentApproval).toHaveBeenNthCalledWith(1, "approval-review-1", "approved");
    expect(onSubAgentApproval).toHaveBeenNthCalledWith(2, "approval-review-1", "rejected");
    expect(onSubAgentInterrupt).toHaveBeenCalledWith(
      "session-review",
      "ui:webmcp-runtime-sub-agent-interrupt"
    );
    expect(onSubAgentClose).toHaveBeenCalledWith(
      "session-timeout",
      "ui:webmcp-runtime-sub-agent-timeout-close",
      true
    );
  });

  it("shows runtime autonomy and wake policy context for delegated runs", async () => {
    const noop = vi.fn();
    getRuntimeRunV2Mock.mockResolvedValue({
      run: buildTask(),
      missionRun: buildRun(),
      reviewPack: null,
      autonomyProfile: "night_operator",
      wakePolicy: {
        mode: "review_queue",
        safeFollowUp: true,
        allowAutomaticContinuation: false,
        allowedActions: ["approve", "clarify"],
        stopGates: ["review_gate"],
        queueBudget: {
          maxQueuedActions: 3,
          maxRuntimeMinutes: 45,
          maxAutoContinuations: 1,
        },
      },
      wakeReason: "review_ready",
    } satisfies RuntimeRunGetV2Response);

    await renderAndFlush(
      <WorkspaceHomeAgentRuntimeRunItem
        task={buildTask()}
        run={buildRun({
          queuePosition: 2,
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

    await waitFor(() => {
      expect(screen.getByText("Autonomy profile: Night Operator")).toBeTruthy();
      expect(screen.getByText("Wake policy: Review Queue")).toBeTruthy();
      expect(screen.getByText("Safe follow-up: enabled")).toBeTruthy();
      expect(screen.getByText("Automatic continuation: disabled")).toBeTruthy();
      expect(
        screen.getByText(
          "Queue budget: 3 queued actions / 45 runtime minutes / 1 auto continuations"
        )
      ).toBeTruthy();
      expect(screen.getByText("Wake reason: Review ready")).toBeTruthy();
      expect(screen.getByText("Queue position: 2")).toBeTruthy();
    });
  });
});
