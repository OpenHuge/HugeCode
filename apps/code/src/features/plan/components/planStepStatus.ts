import type { TurnPlan } from "../../../types";

type PlanStepStatus = TurnPlan["steps"][number]["status"];
type PlanStepTone = "default" | "progress" | "success" | "warning" | "error" | "muted";

export function getPlanStepStatusLabel(status: PlanStepStatus): string {
  if (status === "completed") {
    return "[x]";
  }
  if (status === "inProgress") {
    return "[>]";
  }
  if (status === "blocked") {
    return "[!]";
  }
  if (status === "failed") {
    return "[x!]";
  }
  if (status === "cancelled") {
    return "[-]";
  }
  return "[ ]";
}

export function getPlanStepStatusTone(status: PlanStepStatus): PlanStepTone {
  if (status === "completed") {
    return "success";
  }
  if (status === "inProgress") {
    return "progress";
  }
  if (status === "blocked") {
    return "warning";
  }
  if (status === "failed") {
    return "error";
  }
  if (status === "cancelled") {
    return "muted";
  }
  return "default";
}
