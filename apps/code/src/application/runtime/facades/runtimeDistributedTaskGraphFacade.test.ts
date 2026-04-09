import type { RuntimeCapabilitiesSummary } from "@ku0/code-runtime-client/runtimeClientTypes";
import type { RuntimeRunRecordV2 } from "@ku0/code-runtime-host-contract";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { distributedTaskGraph } from "../ports/threads";
import { getRuntimeCapabilitiesSummary } from "../ports/runtime";
import { cancelRuntimeRun, interveneRuntimeRun } from "../ports/runtimeJobs";
import { DISTRIBUTED_SUBTASK_GRAPH_CAPABILITY } from "../types/distributedTaskGraph";
import {
  buildRuntimeDistributedTaskGraphSupport,
  interruptRuntimeDistributedTaskGraphTasks,
  readNormalizedRuntimeDistributedTaskGraph,
  readRuntimeDistributedTaskGraph,
  readRuntimeDistributedTaskGraphSupport,
  retryRuntimeDistributedTaskGraphNode,
} from "./runtimeDistributedTaskGraphFacade";

vi.mock("../ports/threads", () => ({
  distributedTaskGraph: vi.fn(),
}));

vi.mock("../ports/runtime", () => ({
  getRuntimeCapabilitiesSummary: vi.fn(),
}));

vi.mock("../ports/runtimeJobs", () => ({
  cancelRuntimeRun: vi.fn(),
  interveneRuntimeRun: vi.fn(),
}));

const distributedTaskGraphMock = vi.mocked(distributedTaskGraph);
const getRuntimeCapabilitiesSummaryMock = vi.mocked(getRuntimeCapabilitiesSummary);
const cancelRuntimeRunMock = vi.mocked(cancelRuntimeRun);
const interveneRuntimeRunMock = vi.mocked(interveneRuntimeRun);

function buildRuntimeRunRecord(
  runId: string,
  status: RuntimeRunRecordV2["run"]["status"] = "queued"
) {
  return {
    run: {
      taskId: runId,
      status,
      checkpointId: null,
      checkpointState: null,
    },
    missionRun: {
      checkpoint: null,
      ledger: null,
    },
    reviewPack: null,
  } as unknown as RuntimeRunRecordV2;
}

function buildCapabilitiesSummary(
  overrides: Partial<RuntimeCapabilitiesSummary> = {}
): RuntimeCapabilitiesSummary {
  return {
    mode: "runtime-gateway-web",
    methods: [],
    features: [],
    wsEndpointPath: "/ws",
    error: null,
    ...overrides,
  };
}

describe("runtimeDistributedTaskGraphFacade", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    distributedTaskGraphMock.mockResolvedValue(null);
    cancelRuntimeRunMock.mockResolvedValue({
      accepted: true,
      runId: "task-node-1",
      status: "interrupted",
      message: "ok",
    });
    interveneRuntimeRunMock.mockResolvedValue(buildRuntimeRunRecord("task-node-1-retry"));
    getRuntimeCapabilitiesSummaryMock.mockResolvedValue(buildCapabilitiesSummary());
  });

  it("builds graph support from runtime capabilities", () => {
    expect(
      buildRuntimeDistributedTaskGraphSupport(
        buildCapabilitiesSummary({
          methods: ["code_distributed_task_graph", "code_runtime_run_cancel_v2"],
          features: [DISTRIBUTED_SUBTASK_GRAPH_CAPABILITY],
        })
      )
    ).toEqual({
      capabilityEnabled: true,
      interruptEnabled: true,
      retryEnabled: false,
      actionsEnabled: true,
      readOnlyReason: null,
    });
  });

  it("keeps capability off and reason empty when the feature is absent", () => {
    expect(
      buildRuntimeDistributedTaskGraphSupport(
        buildCapabilitiesSummary({
          methods: ["code_distributed_task_graph", "code_runtime_run_cancel_v2"],
        })
      )
    ).toEqual({
      capabilityEnabled: false,
      interruptEnabled: false,
      retryEnabled: false,
      actionsEnabled: false,
      readOnlyReason: null,
    });
  });

  it("surfaces a read-only reason when graph control methods are unavailable", () => {
    expect(
      buildRuntimeDistributedTaskGraphSupport(
        buildCapabilitiesSummary({
          methods: ["code_distributed_task_graph"],
          features: [DISTRIBUTED_SUBTASK_GRAPH_CAPABILITY],
        })
      )
    ).toEqual({
      capabilityEnabled: true,
      interruptEnabled: false,
      retryEnabled: false,
      actionsEnabled: false,
      readOnlyReason: "Distributed graph control RPC is unavailable in current runtime.",
    });
  });

  it("reads runtime graph support through the runtime summary port", async () => {
    getRuntimeCapabilitiesSummaryMock.mockResolvedValue(
      buildCapabilitiesSummary({
        methods: ["code_distributed_task_graph", "code_runtime_run_intervene_v2"],
        features: [DISTRIBUTED_SUBTASK_GRAPH_CAPABILITY],
      })
    );

    await expect(readRuntimeDistributedTaskGraphSupport()).resolves.toEqual({
      capabilityEnabled: true,
      interruptEnabled: false,
      retryEnabled: true,
      actionsEnabled: true,
      readOnlyReason: null,
    });
  });

  it("reads the distributed graph through the runtime control port", async () => {
    distributedTaskGraphMock.mockResolvedValue({
      taskId: "task-root-1",
      rootTaskId: "task-root-1",
      nodes: [],
      edges: [],
    });

    await expect(readRuntimeDistributedTaskGraph(" task-root-1 ")).resolves.toEqual({
      taskId: "task-root-1",
      rootTaskId: "task-root-1",
      nodes: [],
      edges: [],
    });
    expect(distributedTaskGraphMock).toHaveBeenCalledWith({
      taskId: "task-root-1",
      includeDiagnostics: false,
    });
  });

  it("returns null for blank graph reads", async () => {
    await expect(readRuntimeDistributedTaskGraph("   ")).resolves.toBeNull();
    expect(distributedTaskGraphMock).not.toHaveBeenCalled();
  });

  it("reads and normalizes the distributed graph through one runtime facade call", async () => {
    distributedTaskGraphMock.mockResolvedValue({
      taskId: "task-root-1",
      rootTaskId: "task-root-1",
      nodes: [
        {
          taskId: "task-node-1",
          parentTaskId: "task-root-1",
          role: "planner",
          backendId: "backend-a",
          status: "running",
          attempt: 1,
        },
      ],
      edges: [],
    });

    await expect(readNormalizedRuntimeDistributedTaskGraph("task-root-1")).resolves.toMatchObject({
      graphId: "task-root-1",
      nodes: [{ id: "task-node-1", parentId: "task-root-1", title: "planner" }],
    });
  });

  it("interrupts all normalized task ids once", async () => {
    await interruptRuntimeDistributedTaskGraphTasks([
      " task-node-1 ",
      "task-node-2",
      "task-node-1",
    ]);

    expect(cancelRuntimeRunMock).toHaveBeenCalledTimes(2);
    expect(cancelRuntimeRunMock).toHaveBeenNthCalledWith(1, {
      runId: "task-node-1",
      reason: "ui:distributed_control_interrupt",
    });
    expect(cancelRuntimeRunMock).toHaveBeenNthCalledWith(2, {
      runId: "task-node-2",
      reason: "ui:distributed_control_interrupt",
    });
  });

  it("throws when the runtime rejects an interrupt", async () => {
    cancelRuntimeRunMock
      .mockResolvedValueOnce({
        accepted: true,
        runId: "task-node-1",
        status: "interrupted",
        message: "ok",
      })
      .mockResolvedValueOnce({
        accepted: false,
        runId: "task-node-2",
        status: "failed",
        message: "busy",
      });

    await expect(
      interruptRuntimeDistributedTaskGraphTasks(["task-node-1", "task-node-2"])
    ).rejects.toThrow("busy");
  });

  it("routes retry through the runtime intervention port", async () => {
    await expect(retryRuntimeDistributedTaskGraphNode(" task-node-1 ")).resolves.toMatchObject({
      accepted: true,
      spawnedRunId: "task-node-1-retry",
    });

    expect(interveneRuntimeRunMock).toHaveBeenCalledWith({
      runId: "task-node-1",
      action: "retry",
      reason: "ui:distributed_control_retry",
    });
  });
});
