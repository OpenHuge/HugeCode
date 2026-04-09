import type { TurnPlan, TurnPlanStep, TurnPlanStepStatus } from "../../../types";
import { normalizeDistributedTaskGraphSnapshot } from "../types/distributedTaskGraph";

function asString(value: unknown) {
  return typeof value === "string" ? value : value ? String(value) : "";
}

export function normalizePlanStepStatus(value: unknown): TurnPlanStepStatus {
  const raw = typeof value === "string" ? value : "";
  const normalized = raw.replace(/[_\s-]/g, "").toLowerCase();
  if (["inprogress", "running", "active", "working"].includes(normalized)) {
    return "inProgress";
  }
  if (["completed", "done", "success", "succeeded", "finished"].includes(normalized)) {
    return "completed";
  }
  if (
    ["blocked", "awaitingapproval", "waitingapproval", "needsapproval", "onhold"].includes(
      normalized
    )
  ) {
    return "blocked";
  }
  if (["failed", "error", "errored"].includes(normalized)) {
    return "failed";
  }
  if (
    ["cancelled", "canceled", "aborted", "interrupted", "stopped", "terminated"].includes(
      normalized
    )
  ) {
    return "cancelled";
  }
  return "pending";
}

export function normalizePlanUpdate(
  turnId: string,
  explanation: unknown,
  plan: unknown
): TurnPlan | null {
  const planRecord =
    plan && typeof plan === "object" && !Array.isArray(plan)
      ? (plan as Record<string, unknown>)
      : null;
  const rawSteps = (() => {
    if (Array.isArray(plan)) {
      return plan;
    }
    if (planRecord) {
      const candidate =
        planRecord.steps ?? planRecord.plan ?? planRecord.items ?? planRecord.entries ?? null;
      return Array.isArray(candidate) ? candidate : [];
    }
    return [];
  })();
  const steps = rawSteps
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }
      const record = entry as Record<string, unknown>;
      const step = asString(record.step ?? record.text ?? record.title ?? "");
      if (!step) {
        return null;
      }
      return {
        step,
        status: normalizePlanStepStatus(record.status),
      } satisfies TurnPlanStep;
    })
    .filter((entry): entry is TurnPlanStep => Boolean(entry));
  const note = asString(explanation ?? planRecord?.explanation ?? planRecord?.note).trim();
  const distributedGraph = normalizeDistributedTaskGraphSnapshot(
    planRecord?.distributedGraph ??
      planRecord?.distributed_graph ??
      planRecord?.distributedTaskGraph ??
      planRecord?.distributed_task_graph ??
      planRecord?.graph ??
      null
  );
  if (!steps.length && !note && !distributedGraph) {
    return null;
  }
  return {
    turnId,
    explanation: note ? note : null,
    steps,
    distributedGraph,
  };
}
