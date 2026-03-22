type SubAgentTone = "accent" | "warning" | "success" | "danger" | "neutral";

const SUB_AGENT_TONE_BY_STATUS: Record<string, SubAgentTone> = {
  running: "accent",
  awaiting_approval: "warning",
  blocked: "warning",
  pending: "warning",
  waiting: "warning",
  completed: "success",
  closed: "success",
  failed: "danger",
  timed_out: "danger",
  timeout: "danger",
};

const BLOCKING_SUB_AGENT_STATUSES = new Set([
  "awaiting_approval",
  "failed",
  "cancelled",
  "interrupted",
  "blocked",
  "timed_out",
  "timeout",
]);

const SUB_AGENT_SIGNAL_PRIORITY = [
  "awaiting_approval",
  "blocked",
  "timed_out",
  "timeout",
  "failed",
  "interrupted",
  "cancelled",
  "completed",
  "closed",
  "running",
] as const;

export function getSubAgentTone(status: string | null | undefined): SubAgentTone {
  if (!status) {
    return "neutral";
  }
  return SUB_AGENT_TONE_BY_STATUS[status] ?? "neutral";
}

export function isBlockingSubAgentStatus(status: string | null | undefined): boolean {
  return status ? BLOCKING_SUB_AGENT_STATUSES.has(status) : false;
}

export function getSubAgentSignalLabel(status: string | null | undefined): string | null {
  switch (status) {
    case "awaiting_approval":
      return "Sub-agent awaiting approval";
    case "blocked":
      return "Sub-agent blocked";
    case "timed_out":
    case "timeout":
      return "Sub-agent timed out";
    case "failed":
      return "Sub-agent failed";
    case "interrupted":
      return "Sub-agent interrupted";
    case "cancelled":
      return "Sub-agent cancelled";
    case "completed":
    case "closed":
      return "Sub-agent completed";
    case "running":
      return "Sub-agent running";
    default:
      return null;
  }
}

export function resolveSubAgentSignalLabel(
  statuses: Array<string | null | undefined>
): string | null {
  for (const status of SUB_AGENT_SIGNAL_PRIORITY) {
    if (statuses.some((value) => value === status)) {
      return getSubAgentSignalLabel(status);
    }
  }
  return null;
}
