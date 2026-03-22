import type { RuntimeAgentTaskSummary } from "../types/webMcpBridge";
import { projectAgentTaskStatusToRunState } from "./runtimeMissionControlFacade";

export type MissionControlLoopItem = {
  id: "observe" | "approve" | "intervene" | "resume" | "review";
  label: string;
  detail: string;
};

export type MissionRunSummary = {
  queued: number;
  running: number;
  needsInput: number;
  reviewReady: number;
  failed: number;
  cancelled: number;
};

export function buildMissionRunSummary(tasks: RuntimeAgentTaskSummary[]): MissionRunSummary {
  const counts: MissionRunSummary = {
    queued: 0,
    running: 0,
    needsInput: 0,
    reviewReady: 0,
    failed: 0,
    cancelled: 0,
  };

  for (const task of tasks) {
    const runState = projectAgentTaskStatusToRunState(task.status);
    switch (runState) {
      case "queued":
        counts.queued += 1;
        break;
      case "running":
      case "paused":
        counts.running += 1;
        break;
      case "needs_input":
        counts.needsInput += 1;
        break;
      case "review_ready":
        counts.reviewReady += 1;
        break;
      case "failed":
        counts.failed += 1;
        break;
      case "cancelled":
        counts.cancelled += 1;
        break;
      default:
        break;
    }
  }

  return counts;
}

export function buildMissionControlLoopItems(
  tasks: RuntimeAgentTaskSummary[]
): MissionControlLoopItem[] {
  const counts = buildMissionRunSummary(tasks);

  return [
    {
      id: "observe",
      label: "Observe",
      detail:
        counts.running + counts.queued > 0
          ? `${counts.running + counts.queued} active run${counts.running + counts.queued === 1 ? "" : "s"} can be supervised from this control device.`
          : "Runs started elsewhere appear here once runtime publishes the mission snapshot.",
    },
    {
      id: "approve",
      label: "Approve",
      detail:
        counts.needsInput > 0
          ? `${counts.needsInput} run${counts.needsInput === 1 ? "" : "s"} are waiting on operator approval or clarification.`
          : "Approval requests stay visible here without introducing page-local task truth.",
    },
    {
      id: "intervene",
      label: "Intervene",
      detail:
        "Retry, clarify, or switch profile while runtime remains the source of truth for placement and lifecycle.",
    },
    {
      id: "resume",
      label: "Resume",
      detail: "Resume from checkpoint or handoff using published checkpoint and trace IDs.",
    },
    {
      id: "review",
      label: "Review",
      detail:
        counts.reviewReady > 0
          ? `${counts.reviewReady} completed run${counts.reviewReady === 1 ? " moves" : "s move"} into Review Pack as the primary finish-line surface.`
          : "Completed runs move into Review Pack as the primary finish-line surface.",
    },
  ];
}
