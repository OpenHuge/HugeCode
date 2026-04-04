import type {
  RuntimeAutonomyProfileV2,
  RuntimeQueueBudgetV2,
  RuntimeWakePolicyV2,
} from "@ku0/code-runtime-host-contract";

function formatBudgetPart(value: number | null | undefined, label: string): string | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }
  return `${value} ${label}`;
}

export function formatRuntimeAutonomyProfileLabel(
  autonomyProfile: RuntimeAutonomyProfileV2 | null | undefined
): string | null {
  switch (autonomyProfile) {
    case "night_operator":
      return "Night Operator";
    case "supervised":
      return "Supervised";
    default:
      return null;
  }
}

export function formatRuntimeWakePolicyLabel(
  wakePolicy: RuntimeWakePolicyV2 | null | undefined
): string | null {
  switch (wakePolicy?.mode) {
    case "auto_queue":
      return "Auto Queue";
    case "review_queue":
      return "Review Queue";
    case "hold":
      return "Hold";
    default:
      return null;
  }
}

export function formatRuntimeQueueBudgetSummary(
  queueBudget: RuntimeQueueBudgetV2 | null | undefined
): string | null {
  if (!queueBudget) {
    return null;
  }
  const parts = [
    formatBudgetPart(queueBudget.maxQueuedActions, "queued actions"),
    formatBudgetPart(queueBudget.maxRuntimeMinutes, "runtime minutes"),
    formatBudgetPart(queueBudget.maxAutoContinuations, "auto continuations"),
  ].filter((entry): entry is string => entry !== null);
  return parts.length > 0 ? parts.join(" / ") : null;
}

export function buildRuntimeAutonomyContextDetails(input: {
  autonomyProfile?: RuntimeAutonomyProfileV2 | null;
  wakePolicy?: RuntimeWakePolicyV2 | null;
}): string[] {
  const details: string[] = [];
  const autonomyProfileLabel = formatRuntimeAutonomyProfileLabel(input.autonomyProfile);
  const wakePolicyLabel = formatRuntimeWakePolicyLabel(input.wakePolicy);
  const queueBudgetSummary = formatRuntimeQueueBudgetSummary(input.wakePolicy?.queueBudget);

  if (autonomyProfileLabel) {
    details.push(`Autonomy profile: ${autonomyProfileLabel}`);
  }
  if (wakePolicyLabel) {
    details.push(`Wake policy: ${wakePolicyLabel}`);
  }
  if (typeof input.wakePolicy?.safeFollowUp === "boolean") {
    details.push(`Safe follow-up: ${input.wakePolicy.safeFollowUp ? "enabled" : "disabled"}`);
  }
  if (typeof input.wakePolicy?.allowAutomaticContinuation === "boolean") {
    details.push(
      `Automatic continuation: ${input.wakePolicy.allowAutomaticContinuation ? "enabled" : "disabled"}`
    );
  }
  if (queueBudgetSummary) {
    details.push(`Queue budget: ${queueBudgetSummary}`);
  }

  return details;
}
