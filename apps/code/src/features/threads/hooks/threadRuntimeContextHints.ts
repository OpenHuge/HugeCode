import type { AtlasLongTermMemoryDigest } from "../../atlas/utils/atlasContext";
import type { ThreadStatusSummary } from "../utils/threadExecutionState";

type RuntimePlanLike = {
  explanation?: string | null;
  steps: Array<{ status: string; step: string }>;
};

function buildRuntimePlanHint(plan: RuntimePlanLike | null): string | null {
  if (!plan) {
    return null;
  }
  const explanation = (plan.explanation ?? "").trim();
  const stepSummary = plan.steps
    .slice(0, 3)
    .map((step) => `[${step.status}] ${step.step.trim()}`)
    .filter((step) => step.length > 0)
    .join(" | ");
  if (!explanation && !stepSummary) {
    return null;
  }
  return explanation
    ? `Active plan: ${explanation}${stepSummary ? ` | Steps: ${stepSummary}` : ""}`
    : `Active plan steps: ${stepSummary}`;
}

function buildRuntimeExecutionStateHint(
  threadStatus: ThreadStatusSummary | null,
  activeTurnId: string | null | undefined
): string | null {
  if (threadStatus?.isReviewing) {
    return activeTurnId
      ? `Thread is in review mode. Active turn id: ${activeTurnId}.`
      : "Thread is in review mode.";
  }
  if (threadStatus?.executionState === "awaitingApproval") {
    return activeTurnId
      ? `Thread is awaiting approval. Active turn id: ${activeTurnId}.`
      : "Thread is awaiting approval.";
  }
  if (threadStatus?.isProcessing || threadStatus?.executionState === "running") {
    return activeTurnId
      ? `Thread is currently running. Active turn id: ${activeTurnId}.`
      : "Thread is currently running.";
  }
  if (threadStatus?.hasUnread) {
    return "Thread is idle and has unread updates.";
  }
  return "Thread is idle.";
}

function buildRuntimeMemoryHint(
  longTermMemoryDigest: AtlasLongTermMemoryDigest | null
): string | null {
  if (!longTermMemoryDigest?.summary.trim()) {
    return null;
  }
  const updatedAt =
    Number.isFinite(longTermMemoryDigest.updatedAt) && longTermMemoryDigest.updatedAt > 0
      ? new Date(longTermMemoryDigest.updatedAt).toISOString()
      : "unknown";
  return `Memory digest (updated ${updatedAt}): ${longTermMemoryDigest.summary.trim()}`;
}

export function buildRuntimeThreadContextHints(params: {
  plan: RuntimePlanLike | null;
  threadStatus: ThreadStatusSummary | null;
  activeTurnId: string | null | undefined;
  longTermMemoryDigest: AtlasLongTermMemoryDigest | null;
}): string[] {
  return [
    buildRuntimePlanHint(params.plan),
    buildRuntimeExecutionStateHint(params.threadStatus, params.activeTurnId),
    buildRuntimeMemoryHint(params.longTermMemoryDigest),
  ].filter((entry): entry is string => Boolean(entry));
}
