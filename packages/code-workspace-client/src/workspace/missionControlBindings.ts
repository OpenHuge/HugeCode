import type { HugeCodeMissionControlSnapshot } from "@ku0/code-runtime-host-contract";
import type { WorkspaceClientRuntimeMissionControlBindings } from "./bindings";
import {
  createMissionControlSummaryLoader,
  DEFAULT_MISSION_CONTROL_SUMMARY_COMPOSER,
} from "../workspace-shell/missionControlSummaryLoader";
import type { MissionControlSummaryComposer } from "../workspace-shell/missionControlSummaryContracts";

export type MissionControlSnapshotReader = () => Promise<HugeCodeMissionControlSnapshot>;

export function createSnapshotBackedMissionControlBindings(input: {
  readMissionControlSnapshot: MissionControlSnapshotReader;
  composer?: MissionControlSummaryComposer;
}): WorkspaceClientRuntimeMissionControlBindings {
  const composer = input.composer ?? DEFAULT_MISSION_CONTROL_SUMMARY_COMPOSER;
  const loader = createMissionControlSummaryLoader(
    {
      readMissionControlSnapshot: input.readMissionControlSnapshot,
    },
    composer
  );

  return {
    readMissionControlSnapshot: input.readMissionControlSnapshot,
    readMissionControlSummary: async (activeWorkspaceId) =>
      (await loader.load(activeWorkspaceId)).summary,
  };
}
