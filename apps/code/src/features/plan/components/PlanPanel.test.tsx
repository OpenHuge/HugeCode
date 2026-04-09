// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useRuntimeDistributedTaskGraph } from "../../../application/runtime/facades/useRuntimeDistributedTaskGraph";
import { PlanPanel } from "./PlanPanel";

vi.mock("../../../application/runtime/facades/useRuntimeDistributedTaskGraph", () => ({
  useRuntimeDistributedTaskGraph: vi.fn(),
}));

vi.mock("../../../application/runtime/ports/tauriAppSettings", () => ({
  getAppSettings: vi.fn().mockResolvedValue({}),
}));

vi.mock("./DistributedTaskGraphPanel", () => ({
  DistributedTaskGraphPanel: ({
    capabilityEnabled,
    graph,
    actionsEnabled,
    retryEnabled,
    onInterruptNode,
  }: {
    capabilityEnabled: boolean;
    graph: unknown;
    actionsEnabled?: boolean;
    retryEnabled?: boolean;
    onInterruptNode?: (nodeId: string) => Promise<void>;
  }) =>
    capabilityEnabled ? (
      <div>
        <div data-testid="distributed-graph-slot">{graph ? "graph-present" : "graph-empty"}</div>
        <div data-testid="distributed-graph-actions">
          {actionsEnabled ? "actions-enabled" : "actions-disabled"}
        </div>
        <div data-testid="distributed-graph-retry">
          {retryEnabled ? "retry-enabled" : "retry-disabled"}
        </div>
        <button
          type="button"
          onClick={() => {
            void onInterruptNode?.("task-node-1");
          }}
        >
          interrupt-node-1
        </button>
      </div>
    ) : null,
}));

const useRuntimeDistributedTaskGraphMock = vi.mocked(useRuntimeDistributedTaskGraph);

function mockDistributedTaskGraphState(
  overrides: Partial<ReturnType<typeof useRuntimeDistributedTaskGraph>> = {}
) {
  const interruptNode = vi.fn(async () => undefined);
  const interruptSubtree = vi.fn(async () => undefined);
  const retryNode = vi.fn(async () => undefined);
  const refreshGraph = vi.fn(async () => undefined);

  const baseState: ReturnType<typeof useRuntimeDistributedTaskGraph> = {
    graph: null,
    capabilityEnabled: false,
    actionsEnabled: false,
    retryEnabled: false,
    disabledReason: "Control actions are unavailable in current runtime.",
    refreshGraph,
    interruptNode,
    interruptSubtree,
    retryNode,
  };

  useRuntimeDistributedTaskGraphMock.mockReturnValue({
    ...baseState,
    ...overrides,
  });

  return {
    interruptNode,
    interruptSubtree,
    retryNode,
    refreshGraph,
  };
}

describe("PlanPanel", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  beforeEach(() => {
    mockDistributedTaskGraphState();
  });

  it("shows a waiting label while processing without a plan", () => {
    render(<PlanPanel plan={null} isProcessing />);

    expect(screen.getByText("Waiting on a plan...")).toBeTruthy();
  });

  it("shows an empty label when idle without a plan", () => {
    render(<PlanPanel plan={null} isProcessing={false} />);

    expect(screen.getByText("No active plan.")).toBeTruthy();
  });

  it("renders the active plan artifact preview when a follow-up is pending", () => {
    render(
      <PlanPanel
        plan={null}
        isProcessing={false}
        activeArtifact={{
          planItemId: "plan-artifact-1",
          threadId: "thread-1",
          title: "Stabilize runtime startup",
          preview: "1. Verify launch path\n2. Add boot diagnostics",
          body: "## Stabilize runtime startup\n1. Verify launch path\n2. Add boot diagnostics",
          awaitingFollowup: true,
        }}
      />
    );

    expect(screen.getByTestId("plan-active-artifact")).toBeTruthy();
    expect(screen.getByText("Stabilize runtime startup")).toBeTruthy();
    expect(
      screen.getByText(
        (_, node) => node?.textContent === "1. Verify launch path\n2. Add boot diagnostics"
      )
    ).toBeTruthy();
    expect(screen.queryByText("No active plan.")).toBeNull();
  });

  it("renders extended step status markers", () => {
    render(
      <PlanPanel
        plan={{
          turnId: "turn-statuses",
          explanation: null,
          steps: [
            { step: "Wait for approval", status: "blocked" },
            { step: "Step failed", status: "failed" },
            { step: "Step cancelled", status: "cancelled" },
          ],
        }}
        isProcessing={false}
      />
    );

    expect(screen.getByText("Wait for approval")).toBeTruthy();
    expect(screen.getByText("Step failed")).toBeTruthy();
    expect(screen.getByText("Step cancelled")).toBeTruthy();
    expect(screen.getByText("[!]")).toBeTruthy();
    expect(screen.getByText("[x!]")).toBeTruthy();
    expect(screen.getByText("[-]")).toBeTruthy();
  });

  it("shows distributed graph slot when capability is enabled", () => {
    mockDistributedTaskGraphState({
      capabilityEnabled: true,
      graph: {
        nodes: [{ id: "node-1", title: "Node 1", status: "running" }],
        edges: [],
      },
    });

    render(
      <PlanPanel
        plan={{
          turnId: "turn-1",
          explanation: "Distributed plan",
          steps: [],
          distributedGraph: {
            nodes: [{ id: "node-1", title: "Node 1", status: "running" }],
            edges: [],
          },
        }}
        isProcessing={false}
      />
    );

    expect(screen.getByTestId("distributed-graph-slot").textContent).toBe("graph-present");
  });

  it("enables interrupt controls and routes interrupt action through the runtime hook", () => {
    const interruptNode = vi.fn(async () => undefined);
    mockDistributedTaskGraphState({
      capabilityEnabled: true,
      actionsEnabled: true,
      interruptNode,
    });

    render(
      <PlanPanel
        plan={{
          turnId: "turn-3",
          explanation: "Distributed plan",
          steps: [],
          distributedGraph: {
            nodes: [{ id: "task-node-1", title: "Node 1", status: "running" }],
            edges: [],
          },
        }}
        isProcessing={false}
      />
    );

    expect(screen.getByTestId("distributed-graph-actions").textContent).toBe("actions-enabled");
    fireEvent.click(screen.getByText("interrupt-node-1"));
    expect(interruptNode).toHaveBeenCalledWith("task-node-1");
  });

  it("keeps retry controls hidden from the plan panel graph surface", () => {
    mockDistributedTaskGraphState({
      capabilityEnabled: true,
      actionsEnabled: true,
      retryEnabled: true,
    });

    render(
      <PlanPanel
        plan={{
          turnId: "turn-4",
          explanation: "Distributed plan",
          steps: [],
          distributedGraph: {
            graphId: "task-root-1",
            nodes: [{ id: "task-node-1", title: "Node 1", status: "failed" }],
            edges: [],
          },
        }}
        isProcessing={false}
      />
    );

    expect(screen.getByTestId("distributed-graph-retry").textContent).toBe("retry-disabled");
  });

  it("renders remote-first diagnostics warning when graph summary includes distributed context", () => {
    mockDistributedTaskGraphState({
      capabilityEnabled: true,
      graph: {
        graphId: "task-root-2",
        nodes: [],
        edges: [],
        summary: {
          totalNodes: 0,
          runningNodes: 0,
          completedNodes: 0,
          failedNodes: 0,
          queueDepth: 9,
          placementFailuresTotal: 2,
          accessMode: "on-request",
          routedProvider: "openai",
          executionMode: "runtime",
          reason: "Local host access is denied in remote-provider mode.",
        },
      },
    });

    render(
      <PlanPanel
        plan={{
          turnId: "turn-2",
          explanation: null,
          steps: [],
          distributedGraph: {
            graphId: "task-root-2",
            nodes: [],
            edges: [],
          },
        }}
        isProcessing={false}
      />
    );

    expect(screen.getByTestId("plan-distributed-warning")).toBeTruthy();
    expect(screen.getByText(/placement failures detected/i)).toBeTruthy();
    expect(screen.getByText(/access_mode=on-request/i)).toBeTruthy();
    expect(screen.getByText(/execution_mode=runtime/i)).toBeTruthy();
    expect(screen.getByText(/runtime-only execution mode/i)).toBeTruthy();
  });
});
