export type ExecutionTone = "neutral" | "running" | "success" | "warning" | "danger";
export type ExecutionLifecycleTone = "completed" | "processing" | "failed" | "unknown";

type ExecutionStatusCategory = "success" | "running" | "warning" | "danger" | "neutral";

const CANONICAL_EXECUTION_STATUS_PRESENTATION = {
  awaiting_approval: { label: "Awaiting approval", tone: "warning" },
  needs_input: { label: "Needs input", tone: "warning" },
  pending_decision: { label: "Awaiting approval", tone: "warning" },
  review_ready: { label: "Review ready", tone: "success" },
  validating: { label: "Validating", tone: "running" },
} as const satisfies Record<string, { label: string; tone: ExecutionTone }>;

function toExecutionStatusLabel(value: string): string {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function classifyExecutionStatus(value?: string | null): {
  normalized: string;
  category: ExecutionStatusCategory;
} | null {
  const normalized = value?.trim().toLowerCase() ?? "";
  if (!normalized) {
    return null;
  }
  if (/completed|complete|done|success/.test(normalized)) {
    return { normalized, category: "success" };
  }
  if (/started|starting|running|progress|pending|queued|streaming|thinking/.test(normalized)) {
    return { normalized, category: "running" };
  }
  if (/warning|offline/.test(normalized)) {
    return { normalized, category: "warning" };
  }
  if (/failed|error|rejected|cancelled|canceled/.test(normalized)) {
    return { normalized, category: "danger" };
  }
  return { normalized, category: "neutral" };
}

function labelForExecutionStatusCategory(category: ExecutionStatusCategory): string | null {
  switch (category) {
    case "success":
      return "Completed";
    case "running":
      return "In progress";
    case "warning":
      return "Attention";
    case "danger":
      return "Failed";
    default:
      return null;
  }
}

function toneForExecutionStatusCategory(category: ExecutionStatusCategory): ExecutionTone {
  switch (category) {
    case "success":
      return "success";
    case "running":
      return "running";
    case "warning":
      return "warning";
    case "danger":
      return "danger";
    default:
      return "neutral";
  }
}

export function resolveExecutionStatusPresentation(value?: string | null): {
  label: string;
  tone: ExecutionTone;
} | null {
  const normalized = value?.trim().toLowerCase() ?? "";
  const canonicalPresentation =
    normalized.length > 0
      ? CANONICAL_EXECUTION_STATUS_PRESENTATION[
          normalized as keyof typeof CANONICAL_EXECUTION_STATUS_PRESENTATION
        ]
      : null;
  if (canonicalPresentation) {
    return canonicalPresentation;
  }
  const status = classifyExecutionStatus(value);
  if (!status) {
    return null;
  }
  return {
    label:
      labelForExecutionStatusCategory(status.category) ?? toExecutionStatusLabel(status.normalized),
    tone: toneForExecutionStatusCategory(status.category),
  };
}

export function formatExecutionStatusLabel(value?: string | null) {
  return resolveExecutionStatusPresentation(value)?.label ?? null;
}

export function resolveExecutionTone(value?: string | null): ExecutionTone | null {
  return resolveExecutionStatusPresentation(value)?.tone ?? null;
}

export function formatCompactExecutionStatusLabel(statusLabel: string, tone: ExecutionTone | null) {
  if (tone === "success") {
    return "Done";
  }
  if (tone === "running") {
    return "Running";
  }
  if (tone === "danger") {
    return "Failed";
  }
  if (tone === "warning") {
    return "Attention";
  }
  return statusLabel;
}

export function executionToneFromLifecycleTone(tone: ExecutionLifecycleTone): ExecutionTone {
  if (tone === "completed") {
    return "success";
  }
  if (tone === "processing") {
    return "running";
  }
  if (tone === "failed") {
    return "danger";
  }
  return "neutral";
}
