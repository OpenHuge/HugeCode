import { interveneRuntimeJob } from "../ports/tauriRuntimeJobs";

export async function retryDistributedTaskGraphNode(nodeId: string) {
  const runId = nodeId.trim();
  if (!runId) {
    throw new Error("Distributed task graph retry requires a node id.");
  }

  return interveneRuntimeJob({
    runId,
    action: "retry",
    reason: "ui:distributed_control_retry",
  });
}
