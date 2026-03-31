import {
  EMPTY_RUNTIME_MISSION_CONTROL_SUMMARY,
  buildRuntimeMissionControlSummary,
  type HugeCodeMissionActivityItem as SharedMissionActivityItem,
  type HugeCodeMissionControlReadinessSummary as SharedMissionControlReadinessSummary,
  type HugeCodeMissionControlSnapshot,
  type HugeCodeMissionControlSummary as SharedMissionControlSummary,
  type HugeCodeReviewQueueItem as SharedReviewQueueItem,
} from "@ku0/code-runtime-host-contract";

export type {
  SharedMissionActivityItem,
  SharedMissionControlReadinessSummary,
  SharedMissionControlSummary,
  SharedReviewQueueItem,
};

export const EMPTY_SHARED_MISSION_CONTROL_SUMMARY = EMPTY_RUNTIME_MISSION_CONTROL_SUMMARY;

export function buildSharedMissionControlSummary(
  snapshot: HugeCodeMissionControlSnapshot | null,
  activeWorkspaceId: string | null
): SharedMissionControlSummary {
  return buildRuntimeMissionControlSummary(snapshot, activeWorkspaceId);
}
