import type { MissionNavigationTarget } from "../../missions/utils/missionControlPresentation";

export type LatestAgentRun = {
  message: string;
  timestamp: number;
  projectName: string;
  groupName?: string | null;
  workspaceId: string;
  threadId: string;
  navigationTarget?: MissionNavigationTarget;
  secondaryLabel?: string | null;
  runId: string | null;
  taskId: string | null;
  statusLabel: string;
  statusKind: "active" | "review_ready" | "needs_input" | "attention" | "recent_activity";
  source: "runtime_snapshot_v1";
  warningCount: number;
  operatorActionLabel?: string | null;
  operatorActionDetail?: string | null;
  operatorActionTarget?: MissionNavigationTarget | null;
};
