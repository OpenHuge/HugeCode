import type { DistributedTaskGraphNode } from "../../../application/runtime/types/distributedTaskGraph";

type DistributedTaskGraphStatusTone = "default" | "progress" | "success" | "warning" | "error";

export function getDistributedTaskGraphStatusLabel(
  status: DistributedTaskGraphNode["status"]
): string {
  if (status === "completed") {
    return "Done";
  }
  if (status === "running") {
    return "Running";
  }
  if (status === "failed") {
    return "Failed";
  }
  if (status === "queued") {
    return "Queued";
  }
  if (status === "blocked") {
    return "Blocked";
  }
  if (status === "canceled") {
    return "Canceled";
  }
  return "Pending";
}

export function getDistributedTaskGraphStatusTone(
  status: DistributedTaskGraphNode["status"]
): DistributedTaskGraphStatusTone {
  if (status === "completed") {
    return "success";
  }
  if (status === "running") {
    return "progress";
  }
  if (status === "failed") {
    return "error";
  }
  if (status === "blocked") {
    return "warning";
  }
  return "default";
}
