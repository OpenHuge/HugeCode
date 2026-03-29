import {
  buildSharedMissionControlSummary,
  EMPTY_SHARED_MISSION_CONTROL_SUMMARY,
} from "./sharedMissionControlSummary";
import type {
  MissionControlSummaryComposer,
  MissionControlSummaryLoadResult,
  MissionControlSummarySource,
} from "./missionControlSummaryContracts";

export const DEFAULT_MISSION_CONTROL_SUMMARY_COMPOSER: MissionControlSummaryComposer = {
  compose: (snapshot, activeWorkspaceId) =>
    snapshot
      ? buildSharedMissionControlSummary(snapshot, activeWorkspaceId)
      : EMPTY_SHARED_MISSION_CONTROL_SUMMARY,
};

export function createMissionControlSummaryLoader(
  source: MissionControlSummarySource,
  composer: MissionControlSummaryComposer = DEFAULT_MISSION_CONTROL_SUMMARY_COMPOSER
) {
  return {
    load: async (activeWorkspaceId: string | null): Promise<MissionControlSummaryLoadResult> => {
      const snapshot = await source.readMissionControlSnapshot();
      return {
        snapshot,
        summary: composer.compose(snapshot, activeWorkspaceId),
      };
    },
  };
}
