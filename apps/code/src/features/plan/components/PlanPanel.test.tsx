// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CODE_RUNTIME_RPC_METHODS } from "@ku0/code-runtime-host-contract";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { distributedTaskGraph } from "../../../application/runtime/ports/tauriThreads";
import { getRuntimeCapabilitiesSummary } from "../../../application/runtime/ports/tauriRuntime";
import {
  cancelRuntimeJob,
  getRuntimeJob,
} from "../../../application/runtime/ports/tauriRuntimeJobs";
import { startRuntimeJobWithRemoteSelection } from "../../../application/runtime/facades/runtimeRemoteExecutionFacade";
import { PlanPanel } from "./PlanPanel";

vi.mock("../../../application/runtime/ports/tauriThreads", () => ({
  distributedTaskGraph: vi.fn(),
}));

vi.mock("../../../application/runtime/ports/tauriRuntime", () => ({
  getRuntimeCapabilitiesSummary: vi.fn(),
}));

vi.mock("../../../application/runtime/ports/tauriRuntimeJobs", () => ({
  cancelRuntimeJob: vi.fn(),
  getRuntimeJob: vi.fn(),
}));

vi.mock("../../../application/runtime/facades/runtimeRemoteExecutionFacade", () => ({
  startRuntimeJobWithRemoteSelection: vi.fn(),
}));

vi.mock("../../../application/runtime/ports/tauriAppSettings", () => ({
  getAppSettings: vi.fn().mockResolvedValue({}),
}));

vi.mock("./DistributedTaskGraphPanel", () => ({
  DistributedTaskGraphPanel: ({
    capabilityEnabled,
    graph,
    actionsEnabled,
    onInterruptNode,
    onRetryNode,
  }: {
    capabilityEnabled: boolean;
    graph: unknown;
    actionsEnabled?: boolean;
    onInterruptNode?: (nodeId: string) => Promise<void>;
    onRetryNode?: (nodeId: string) => Promise<void>;
  }) =>
    capabilityEnabled ? (
      <div>
        <div data-testid="distributed-graph-slot">{graph ? "graph-present" : "graph-empty"}</div>
        <div data-testid="distributed-graph-actions">
          {actionsEnabled ? "actions-enabled" : "actions-disabled"}
        </div>
        <button
          type="button"
          onClick={() => {
            void onInterruptNode?.("task-node-1");
          }}
        >
          interrupt-node-1
        </button>
        <button
          type="button"
          onClick={() => {
            void onRetryNode?.("task-node-1");
          }}
        >
          retry-node-1
        </button>
      </div>
    ) : null,
}));

const getRuntimeCapabilitiesSummaryMock = vi.mocked(getRuntimeCapabilitiesSummary);
const distributedTaskGraphMock = vi.mocked(distributedTaskGraph);
const cancelRuntimeJobMock = vi.mocked(cancelRuntimeJob);
const getRuntimeJobMock = vi.mocked(getRuntimeJob);
const startAgentTaskMock = vi.mocked(startRuntimeJobWithRemoteSelection);

describe("PlanPanel", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  beforeEach(() => {
    getRuntimeCapabilitiesSummaryMock.mockResolvedValue({
      mode: "tauri",
      methods: [],
      features: [],
      wsEndpointPath: null,
      error: null,
    });
    distributedTaskGraphMock.mockResolvedValue(null);
    cancelRuntimeJobMock.mockResolvedValue({
      accepted: true,
      runId: "task-node-1",
      status: "interrupted",
      message: "ok",
    });
    getRuntimeJobMock.mockResolvedValue({
      id: "task-node-1",
      workspaceId: "ws-1",
      threadId: "thread-1",
      title: "Investigate issue",
      status: "running",
      provider: "openai",
      modelId: "gpt-5.3-codex",
      backendId: null,
      preferredBackendIds: null,
      executionProfile: {
        placement: "local",
        interactivity: "interactive",
        isolation: "host",
        network: "default",
        authority: "user",
      },
      createdAt: 1,
      updatedAt: 1,
      startedAt: 1,
      completedAt: null,
      continuation: {
        resumeSupported: true,
        recovered: false,
      },
      metadata: null,
    });
    startAgentTaskMock.mockResolvedValue({
      id: "task-node-retry-1",
      workspaceId: "ws-1",
      threadId: "thread-1",
      title: "Investigate issue (retry)",
      status: "queued",
      provider: "openai",
      modelId: "gpt-5.3-codex",
      backendId: null,
      preferredBackendIds: null,
      executionProfile: {
        placement: "local",
        interactivity: "interactive",
        isolation: "host",
        network: "default",
        authority: "user",
      },
      createdAt: 2,
      updatedAt: 2,
      startedAt: null,
      completedAt: null,
      continuation: {
        resumeSupported: true,
        recovered: false,
      },
      metadata: null,
    });
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

  it("shows distributed graph slot when capability is enabled", async () => {
    getRuntimeCapabilitiesSummaryMock.mockResolvedValue({
      mode: "tauri",
      methods: ["code_distributed_task_graph"],
      features: ["distributed_subtask_graph_v1"],
      wsEndpointPath: null,
      error: null,
    });

    render(
      <PlanPanel
        plan={{
          turnId: "turn-1",
          explanation: "Distributed plan",
          steps: [],
          distributedGraph: {
            nodes: [
              {
                id: "node-1",
                title: "Node 1",
                status: "running",
              },
            ],
            edges: [],
          },
        }}
        isProcessing={false}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("distributed-graph-slot")).toBeTruthy();
    });
    expect(screen.getByText("graph-present")).toBeTruthy();
  });

  it("refreshes graph from rpc when graph id is available", async () => {
    getRuntimeCapabilitiesSummaryMock.mockResolvedValue({
      mode: "tauri",
      methods: ["code_distributed_task_graph"],
      features: ["distributed_subtask_graph_v1"],
      wsEndpointPath: null,
      error: null,
    });
    distributedTaskGraphMock.mockResolvedValue({
      taskId: "task-root-1",
      rootTaskId: "task-root-1",
      nodes: [
        {
          taskId: "task-node-1",
          parentTaskId: null,
          role: "planner",
          backendId: null,
          status: "running",
          attempt: 1,
        },
      ],
      edges: [],
    });

    render(
      <PlanPanel
        plan={{
          turnId: "turn-1",
          explanation: "Distributed plan",
          steps: [],
          distributedGraph: {
            graphId: "task-root-1",
            nodes: [],
            edges: [],
          },
        }}
        isProcessing={false}
      />
    );

    await waitFor(() => {
      expect(distributedTaskGraphMock).toHaveBeenCalledWith({
        taskId: "task-root-1",
        includeDiagnostics: false,
      });
    });
    await waitFor(() => {
      expect(screen.getAllByText("graph-present").length).toBeGreaterThan(0);
    });
  });

  it("enables interrupt controls and routes interrupt action to runtime rpc", async () => {
    getRuntimeCapabilitiesSummaryMock.mockResolvedValue({
      mode: "tauri",
      methods: [
        CODE_RUNTIME_RPC_METHODS.DISTRIBUTED_TASK_GRAPH,
        CODE_RUNTIME_RPC_METHODS.KERNEL_JOB_CANCEL_V3,
      ],
      features: ["distributed_subtask_graph_v1"],
      wsEndpointPath: null,
      error: null,
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

    await waitFor(() => {
      expect(screen.getByTestId("distributed-graph-actions").textContent).toBe("actions-enabled");
    });

    fireEvent.click(screen.getByText("interrupt-node-1"));

    await waitFor(() => {
      expect(cancelRuntimeJobMock).toHaveBeenCalledWith({
        runId: "task-node-1",
        reason: "ui:distributed_control_interrupt",
      });
    });
  });

  it("routes retry controls to task status and start rpc", async () => {
    getRuntimeCapabilitiesSummaryMock.mockResolvedValue({
      mode: "tauri",
      methods: [
        CODE_RUNTIME_RPC_METHODS.DISTRIBUTED_TASK_GRAPH,
        CODE_RUNTIME_RPC_METHODS.KERNEL_JOB_CANCEL_V3,
        CODE_RUNTIME_RPC_METHODS.KERNEL_JOB_GET_V3,
        CODE_RUNTIME_RPC_METHODS.KERNEL_JOB_START_V3,
      ],
      features: ["distributed_subtask_graph_v1"],
      wsEndpointPath: null,
      error: null,
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

    await waitFor(() => {
      expect(screen.getByTestId("distributed-graph-actions")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("retry-node-1"));

    await waitFor(() => {
      expect(getRuntimeJobMock).toHaveBeenCalledWith({ jobId: "task-node-1" });
    });
    await waitFor(() => {
      expect(startAgentTaskMock).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: "ws-1",
          threadId: "thread-1",
          steps: [{ kind: "read", path: "AGENTS.md" }],
        })
      );
    });
  });

  it("renders remote-first diagnostics warning when graph summary includes distributed context", async () => {
    getRuntimeCapabilitiesSummaryMock.mockResolvedValue({
      mode: "tauri",
      methods: ["code_distributed_task_graph"],
      features: ["distributed_subtask_graph_v1"],
      wsEndpointPath: null,
      error: null,
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
        }}
        isProcessing={false}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("plan-distributed-warning")).toBeTruthy();
    });
    expect(screen.getByText(/placement failures detected/i)).toBeTruthy();
    expect(screen.getByText(/access_mode=on-request/i)).toBeTruthy();
    expect(screen.getByText(/execution_mode=runtime/i)).toBeTruthy();
    expect(screen.getByText(/runtime-only execution mode/i)).toBeTruthy();
  });
});
