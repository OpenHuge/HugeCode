// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { HugeCodeRunSummary } from "@ku0/code-runtime-host-contract";
import type { RuntimeAgentTaskSummary } from "../../../application/runtime/types/webMcpBridge";
import { WorkspaceHomeAgentRuntimeRunItem } from "./WorkspaceHomeAgentRuntimeRunItem";

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
    expect(within(region).getAllByText("Delegated sessions").length).toBeGreaterThan(0);
    expect(within(region).getAllByText("Execution graph").length).toBeGreaterThan(0);
    expect(within(region).getAllByText("Operator trajectory").length).toBeGreaterThan(0);
    expect(within(region).getAllByText("Governance and next action").length).toBeGreaterThan(0);
    expect(region.querySelectorAll('[data-review-loop-section="true"]').length).toBe(4);

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
            state: "pending_decision",
            label: "Approval required",
            summary: "Runtime is waiting for approval before continuing.",
            blocking: true,
          },
          nextAction: {
            label: "Approve delegated review",
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
        state: "pending_decision",
        label: "Approval required",
        summary: "Runtime is waiting for approval before continuing.",
        blocking: true,
      },
      nextAction: {
        label: "Approve delegated review",
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
});
