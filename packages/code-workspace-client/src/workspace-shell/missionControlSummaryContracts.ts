import type {
  HugeCodeMissionControlSnapshot,
  HugeCodeMissionControlSummary,
} from "@ku0/code-runtime-host-contract";

export type MissionControlSummaryComposer = {
  compose: (
    snapshot: HugeCodeMissionControlSnapshot | null,
    activeWorkspaceId: string | null
  ) => HugeCodeMissionControlSummary;
};

export type MissionControlSummarySource = {
  readMissionControlSnapshot: () => Promise<HugeCodeMissionControlSnapshot>;
  readMissionControlSummary?: (
    activeWorkspaceId: string | null
  ) => Promise<HugeCodeMissionControlSummary>;
};

export type MissionControlSummaryLoadResult = {
  snapshot: HugeCodeMissionControlSnapshot | null;
  summary: HugeCodeMissionControlSummary;
};
