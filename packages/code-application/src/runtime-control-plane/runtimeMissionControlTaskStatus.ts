import type { AgentTaskStatus, HugeCodeRunState } from "@ku0/code-runtime-host-contract";

export function projectAgentTaskStatusToRunState(status: AgentTaskStatus): HugeCodeRunState {
  switch (status) {
    case "queued":
      return "queued";
    case "running":
      return "running";
    case "paused":
      return "paused";
    case "awaiting_approval":
      return "needs_input";
    case "completed":
      return "review_ready";
    case "failed":
      return "failed";
    case "cancelled":
    case "interrupted":
      return "cancelled";
    default: {
      const exhaustiveCheck: never = status;
      return exhaustiveCheck;
    }
  }
}
