export type ThreadExecutionState =
  | "idle"
  | "running"
  | "awaitingApproval"
  | "completed"
  | "error"
  | "unknown";

export type ThreadStatusSummary = {
  isProcessing: boolean;
  hasUnread: boolean;
  isReviewing: boolean;
  executionState?: ThreadExecutionState | null;
  processingStartedAt?: number | null;
  lastDurationMs?: number | null;
  timelineState?:
    | "awaitingApproval"
    | "awaitingInput"
    | "planReady"
    | "reviewReady"
    | "needsAttention"
    | "completed"
    | null;
};

export type ThreadVisualState =
  | "ready"
  | "processing"
  | "awaitingApproval"
  | "awaitingInput"
  | "planReady"
  | "needsAttention"
  | "completed"
  | "reviewing"
  | "unread";

export type ThreadStatusTone = "default" | "success" | "warning" | "progress";

type ThreadStatusPresentation = {
  label: string | null;
  tone: ThreadStatusTone;
};

export function resolveThreadVisualState(
  status: ThreadStatusSummary | null | undefined
): ThreadVisualState {
  if (status?.isReviewing) {
    return "reviewing";
  }
  if (
    status?.timelineState === "awaitingApproval" ||
    status?.executionState === "awaitingApproval"
  ) {
    return "awaitingApproval";
  }
  if (status?.timelineState === "awaitingInput") {
    return "awaitingInput";
  }
  if (status?.timelineState === "needsAttention") {
    return "needsAttention";
  }
  if (status?.isProcessing || status?.executionState === "running") {
    return "processing";
  }
  if (status?.timelineState === "reviewReady") {
    return "reviewing";
  }
  if (status?.timelineState === "planReady") {
    return "planReady";
  }
  if (status?.hasUnread) {
    return "unread";
  }
  if (status?.timelineState === "completed") {
    return "completed";
  }
  return "ready";
}

export function resolveThreadStatePillLabel(status: ThreadVisualState): string | null {
  return resolveThreadStatusPresentation(status).label;
}

export function resolveThreadStatusTone(status: ThreadVisualState): ThreadStatusTone {
  return resolveThreadStatusPresentation(status).tone;
}

export function resolveThreadStatusPresentation(
  status: ThreadVisualState
): ThreadStatusPresentation {
  if (status === "processing") {
    return { label: "Working", tone: "warning" };
  }
  if (status === "awaitingApproval") {
    return { label: "Approval", tone: "warning" };
  }
  if (status === "awaitingInput") {
    return { label: "Input", tone: "progress" };
  }
  if (status === "needsAttention") {
    return { label: "Action", tone: "warning" };
  }
  if (status === "planReady") {
    return { label: "Plan", tone: "progress" };
  }
  if (status === "reviewing") {
    return { label: "Review", tone: "success" };
  }
  if (status === "completed") {
    return { label: "Done", tone: "success" };
  }
  if (status === "unread") {
    return { label: "Unread", tone: "progress" };
  }
  return { label: null, tone: "success" };
}

export function formatThreadAgentRoleLabel(agentRole?: string | null): string | null {
  const normalized = agentRole?.trim();
  if (!normalized) {
    return null;
  }

  return normalized
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
