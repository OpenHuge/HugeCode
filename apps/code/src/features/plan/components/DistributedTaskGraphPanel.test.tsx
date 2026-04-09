// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DistributedTaskGraphSnapshot } from "../../../application/runtime/types/distributedTaskGraph";
import { DistributedTaskGraphPanel } from "./DistributedTaskGraphPanel";

function buildGraph(nodeCount = 4): DistributedTaskGraphSnapshot {
  return {
    graphId: "graph-1",
    updatedAt: Date.now(),
    nodes: Array.from({ length: nodeCount }).map((_, index) => ({
      id: `node-${index + 1}`,
      title: `Node ${index + 1}`,
      status: index === 0 ? "running" : index === 1 ? "failed" : "pending",
      backendId: index % 2 === 0 ? "backend-a" : "backend-b",
      backendLabel: index % 2 === 0 ? "Backend A" : "Backend B",
      queueDepth: index,
      metadata: {
        dependencies: index > 0 ? ["node-1"] : [],
      },
    })),
    edges: [],
    summary: {
      totalNodes: nodeCount,
      runningNodes: 1,
      completedNodes: 0,
      failedNodes: 1,
      queueDepth: nodeCount,
      placementFailuresTotal: null,
      accessMode: null,
      routedProvider: null,
      executionMode: null,
      reason: null,
    },
  };
}

describe("DistributedTaskGraphPanel", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders grouped graph rows and summary", () => {
    render(
      <DistributedTaskGraphPanel graph={buildGraph()} capabilityEnabled actionsEnabled={false} />
    );

    expect(screen.getByText("Distributed Task Graph")).toBeTruthy();
    expect(screen.getByText("Total 4")).toBeTruthy();
    expect(screen.getAllByText("Backend A").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Backend B").length).toBeGreaterThan(0);
  });

  it("opens and closes the control drawer", () => {
    render(
      <DistributedTaskGraphPanel graph={buildGraph()} capabilityEnabled actionsEnabled={false} />
    );

    fireEvent.click(screen.getAllByLabelText("Open controls for Node 1")[0] as HTMLButtonElement);
    expect(screen.getByTestId("distributed-control-drawer")).toBeTruthy();

    fireEvent.click(screen.getByLabelText("Close distributed control drawer"));
    expect(screen.queryByTestId("distributed-control-drawer")).toBeNull();
  });

  it("renders virtualization hint for large graphs", () => {
    render(
      <DistributedTaskGraphPanel graph={buildGraph(90)} capabilityEnabled actionsEnabled={false} />
    );

    expect(screen.getByTestId("distributed-task-graph-virtualized-hint")).toBeTruthy();
  });

  it("renders diagnostics warning when provided", () => {
    render(
      <DistributedTaskGraphPanel
        graph={buildGraph()}
        capabilityEnabled
        actionsEnabled={false}
        diagnosticsMessage="Placement failures detected (2)."
      />
    );

    expect(screen.getByTestId("distributed-task-graph-warning")).toBeTruthy();
  });

  it("renders empty state when graph is absent", () => {
    render(<DistributedTaskGraphPanel graph={null} capabilityEnabled actionsEnabled={false} />);

    expect(screen.getByText("No distributed subtask graph available yet.")).toBeTruthy();
  });

  it("routes retry through the runtime-owned parent handler", async () => {
    const onRetryNode = vi.fn(async () => undefined);

    render(
      <DistributedTaskGraphPanel
        graph={buildGraph()}
        capabilityEnabled
        actionsEnabled
        retryEnabled
        onRetryNode={onRetryNode}
      />
    );

    fireEvent.click(screen.getAllByLabelText("Open controls for Node 2")[0] as HTMLButtonElement);
    fireEvent.click(screen.getByText("Retry"));

    await waitFor(() => {
      expect(onRetryNode).toHaveBeenCalledWith("node-2");
    });
  });
});
