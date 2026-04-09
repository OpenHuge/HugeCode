// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  interruptRuntimeDistributedTaskGraphTasks,
  readNormalizedRuntimeDistributedTaskGraph,
  retryRuntimeDistributedTaskGraphNode,
} from "./runtimeDistributedTaskGraphFacade";
import { useRuntimeDistributedTaskGraphSupport } from "./useRuntimeDistributedTaskGraphSupport";
import { useRuntimeDistributedTaskGraph } from "./useRuntimeDistributedTaskGraph";

vi.mock("./runtimeDistributedTaskGraphFacade", () => ({
  interruptRuntimeDistributedTaskGraphTasks: vi.fn(),
  readNormalizedRuntimeDistributedTaskGraph: vi.fn(),
  retryRuntimeDistributedTaskGraphNode: vi.fn(),
}));

vi.mock("./useRuntimeDistributedTaskGraphSupport", () => ({
  useRuntimeDistributedTaskGraphSupport: vi.fn(),
}));

const readNormalizedRuntimeDistributedTaskGraphMock = vi.mocked(
  readNormalizedRuntimeDistributedTaskGraph
);
const interruptRuntimeDistributedTaskGraphTasksMock = vi.mocked(
  interruptRuntimeDistributedTaskGraphTasks
);
const retryRuntimeDistributedTaskGraphNodeMock = vi.mocked(retryRuntimeDistributedTaskGraphNode);
const useRuntimeDistributedTaskGraphSupportMock = vi.mocked(useRuntimeDistributedTaskGraphSupport);

function mockSupport(
  overrides: Partial<ReturnType<typeof useRuntimeDistributedTaskGraphSupport>> = {}
) {
  useRuntimeDistributedTaskGraphSupportMock.mockReturnValue({
    capabilityEnabled: true,
    interruptEnabled: true,
    retryEnabled: true,
    actionsEnabled: true,
    readOnlyReason: null,
    ...overrides,
  });
}

describe("useRuntimeDistributedTaskGraph", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupport();
    readNormalizedRuntimeDistributedTaskGraphMock.mockResolvedValue(null);
    interruptRuntimeDistributedTaskGraphTasksMock.mockResolvedValue([]);
    retryRuntimeDistributedTaskGraphNodeMock.mockResolvedValue({
      accepted: true,
      action: "retry",
      runId: "node-1",
      status: "queued",
      outcome: "spawned",
      spawnedRunId: "node-1-retry",
      checkpointId: null,
    });
  });

  it("reads the normalized graph when runtime support and graph id are available", async () => {
    readNormalizedRuntimeDistributedTaskGraphMock.mockResolvedValue({
      graphId: "task-root-1",
      nodes: [{ id: "node-1", title: "Node 1", status: "running", parentId: null, attempt: 1 }],
      edges: [],
    });

    const { result } = renderHook(() =>
      useRuntimeDistributedTaskGraph({
        graphId: " task-root-1 ",
        fallbackGraph: null,
      })
    );

    await waitFor(() => {
      expect(readNormalizedRuntimeDistributedTaskGraphMock).toHaveBeenCalledWith("task-root-1");
    });
    await waitFor(() => {
      expect(result.current.graph?.graphId).toBe("task-root-1");
    });
  });

  it("surfaces a read-only reason when a graph refresh fails", async () => {
    readNormalizedRuntimeDistributedTaskGraphMock
      .mockResolvedValueOnce({
        graphId: "task-root-1",
        nodes: [{ id: "node-1", title: "Node 1", status: "running", parentId: null, attempt: 1 }],
        edges: [],
      })
      .mockRejectedValueOnce(new Error("graph refresh failed"));

    const { result } = renderHook(() =>
      useRuntimeDistributedTaskGraph({
        graphId: "task-root-1",
        fallbackGraph: null,
      })
    );

    await waitFor(() => {
      expect(result.current.graph?.graphId).toBe("task-root-1");
    });

    await expect(result.current.refreshGraph()).rejects.toThrow("graph refresh failed");

    await waitFor(() => {
      expect(result.current.disabledReason).toBe("graph refresh failed");
    });
  });

  it("keeps the fallback graph visible when the runtime graph has not loaded", () => {
    const fallbackGraph = {
      graphId: "task-root-2",
      nodes: [{ id: "node-1", title: "Node 1", status: "running", parentId: null, attempt: 1 }],
      edges: [],
    };

    const { result } = renderHook(() =>
      useRuntimeDistributedTaskGraph({
        graphId: "task-root-2",
        fallbackGraph,
      })
    );

    expect(result.current.graph).toEqual(fallbackGraph);
  });

  it("interrupts a subtree through the runtime facade and refreshes the graph", async () => {
    readNormalizedRuntimeDistributedTaskGraphMock.mockResolvedValue({
      graphId: "task-root-3",
      nodes: [
        { id: "node-1", title: "Node 1", status: "running", parentId: null, attempt: 1 },
        { id: "node-2", title: "Node 2", status: "running", parentId: "node-1", attempt: 1 },
      ],
      edges: [],
    });

    const { result } = renderHook(() =>
      useRuntimeDistributedTaskGraph({
        graphId: "task-root-3",
      })
    );

    await waitFor(() => {
      expect(result.current.graph?.nodes).toHaveLength(2);
    });

    await act(async () => {
      await result.current.interruptSubtree?.("node-1");
    });

    expect(interruptRuntimeDistributedTaskGraphTasksMock).toHaveBeenCalledWith([
      "node-1",
      "node-2",
    ]);
    expect(readNormalizedRuntimeDistributedTaskGraphMock).toHaveBeenCalledTimes(2);
  });

  it("retries a node through the runtime facade and refreshes the spawned run", async () => {
    const { result } = renderHook(() =>
      useRuntimeDistributedTaskGraph({
        graphId: "task-root-4",
      })
    );

    await waitFor(() => {
      expect(result.current.retryNode).toBeTypeOf("function");
    });

    await act(async () => {
      await result.current.retryNode?.("node-1");
    });

    expect(retryRuntimeDistributedTaskGraphNodeMock).toHaveBeenCalledWith("node-1");
    expect(readNormalizedRuntimeDistributedTaskGraphMock).toHaveBeenLastCalledWith("node-1-retry");
  });
});
