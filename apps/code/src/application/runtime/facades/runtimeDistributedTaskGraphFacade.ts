import {
  CODE_RUNTIME_RPC_METHODS,
  type DistributedTaskGraph,
} from "@ku0/code-runtime-host-contract";
import type { RuntimeCapabilitiesSummary } from "@ku0/code-runtime-client/runtimeClientTypes";
import {
  DISTRIBUTED_SUBTASK_GRAPH_CAPABILITY,
  type DistributedTaskGraphSnapshot,
  normalizeDistributedTaskGraphSnapshot,
} from "../types/distributedTaskGraph";
import { distributedTaskGraph } from "../ports/tauriThreads";
import { getRuntimeCapabilitiesSummary } from "../ports/tauriRuntime";
import {
  cancelRuntimeJob,
  interveneRuntimeJob,
  type RuntimeJobInterventionAck,
} from "../ports/tauriRuntimeJobs";

export type RuntimeDistributedTaskGraphSupport = {
  capabilityEnabled: boolean;
  interruptEnabled: boolean;
  retryEnabled: boolean;
  actionsEnabled: boolean;
  readOnlyReason: string | null;
};

export const DEFAULT_RUNTIME_DISTRIBUTED_TASK_GRAPH_SUPPORT: RuntimeDistributedTaskGraphSupport = {
  capabilityEnabled: false,
  interruptEnabled: false,
  retryEnabled: false,
  actionsEnabled: false,
  readOnlyReason: null,
};

export function buildRuntimeDistributedTaskGraphSupport(
  summary: RuntimeCapabilitiesSummary
): RuntimeDistributedTaskGraphSupport {
  const hasCapability = summary.features.includes(DISTRIBUTED_SUBTASK_GRAPH_CAPABILITY);
  const supportsGraphMethod = summary.methods.includes(
    CODE_RUNTIME_RPC_METHODS.DISTRIBUTED_TASK_GRAPH
  );
  const supportsInterruptMethod = summary.methods.includes(
    CODE_RUNTIME_RPC_METHODS.KERNEL_JOB_CANCEL_V3
  );
  const supportsRetryMethod = summary.methods.includes(
    CODE_RUNTIME_RPC_METHODS.KERNEL_JOB_INTERVENE_V3
  );

  let readOnlyReason: string | null = null;
  if (hasCapability) {
    if (summary.error) {
      readOnlyReason = summary.error;
    } else if (!supportsGraphMethod) {
      readOnlyReason = "Distributed graph RPC is unavailable in current runtime.";
    } else if (!supportsInterruptMethod && !supportsRetryMethod) {
      readOnlyReason = "Distributed graph control RPC is unavailable in current runtime.";
    }
  }

  return {
    capabilityEnabled: hasCapability && supportsGraphMethod,
    interruptEnabled: hasCapability && supportsGraphMethod && supportsInterruptMethod,
    retryEnabled: hasCapability && supportsGraphMethod && supportsRetryMethod,
    actionsEnabled:
      hasCapability && supportsGraphMethod && (supportsInterruptMethod || supportsRetryMethod),
    readOnlyReason,
  };
}

export async function readRuntimeDistributedTaskGraphSupport() {
  const summary = await getRuntimeCapabilitiesSummary();
  return buildRuntimeDistributedTaskGraphSupport(summary);
}

export async function readRuntimeDistributedTaskGraph(
  taskId: string
): Promise<DistributedTaskGraph | null> {
  const normalizedTaskId = taskId.trim();
  if (!normalizedTaskId) {
    return null;
  }

  return distributedTaskGraph({
    taskId: normalizedTaskId,
    includeDiagnostics: false,
  });
}

export async function readNormalizedRuntimeDistributedTaskGraph(
  taskId: string
): Promise<DistributedTaskGraphSnapshot | null> {
  const graph = await readRuntimeDistributedTaskGraph(taskId);
  return normalizeDistributedTaskGraphSnapshot(graph);
}

export async function interruptRuntimeDistributedTaskGraphTasks(taskIds: string[]) {
  const normalizedTaskIds = [...new Set(taskIds.map((taskId) => taskId.trim()))].filter(
    (taskId) => taskId.length > 0
  );
  if (normalizedTaskIds.length === 0) {
    return [];
  }

  const acknowledgements = await Promise.all(
    normalizedTaskIds.map((taskId) =>
      cancelRuntimeJob({
        runId: taskId,
        reason: "ui:distributed_control_interrupt",
      })
    )
  );

  const rejected = acknowledgements.find((ack) => !ack.accepted);
  if (rejected) {
    const rejectedTaskId = rejected.runId.trim();
    throw new Error(rejected.message || `Runtime rejected interrupt for task '${rejectedTaskId}'.`);
  }

  return acknowledgements;
}

export async function retryRuntimeDistributedTaskGraphNode(
  nodeId: string
): Promise<RuntimeJobInterventionAck> {
  const normalizedNodeId = nodeId.trim();
  if (!normalizedNodeId) {
    throw new Error("Distributed graph retry requires a task id.");
  }

  return interveneRuntimeJob({
    runId: normalizedNodeId,
    action: "retry",
    reason: "ui:distributed_control_retry",
  });
}
