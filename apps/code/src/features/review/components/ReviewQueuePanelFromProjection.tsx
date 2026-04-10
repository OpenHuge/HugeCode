import {
  buildCompactReviewEvidenceInput,
  buildReviewEvidenceInputGate,
  type CompactReviewEvidenceInput,
} from "../../../application/runtime/facades/runtimeReviewEvidenceModel";
import type { HugeCodeMissionControlSnapshot as MissionControlProjection } from "@ku0/code-runtime-host-contract";
import type { RepositoryExecutionContract } from "../../../application/runtime/facades/runtimeRepositoryExecutionContract";
import { buildMissionReviewEntriesFromProjection } from "@ku0/code-application/runtimeMissionControlSurfaceModel";
import { ReviewQueuePanel, type ReviewQueuePanelProps } from "./ReviewQueuePanel";

export type ReviewQueuePanelFromProjectionProps = Omit<ReviewQueuePanelProps, "items"> & {
  projection: MissionControlProjection | null;
  workspaceId: string;
  repositoryExecutionContract?: RepositoryExecutionContract | null;
  limit?: number;
};

export function ReviewQueuePanelFromProjection({
  projection,
  workspaceId,
  repositoryExecutionContract = null,
  limit = 8,
  ...props
}: ReviewQueuePanelFromProjectionProps) {
  const items = projection
    ? buildMissionReviewEntriesFromProjection(projection, {
        workspaceId,
        limit,
        repositoryExecutionContract,
      }).map((entry) => {
        const task = projection.tasks.find((candidate) => candidate.id === entry.taskId);
        const run = projection.runs.find((candidate) => candidate.id === entry.runId);
        const reviewPack = entry.reviewPackId
          ? projection.reviewPacks.find((candidate) => candidate.id === entry.reviewPackId)
          : null;
        const compactEvidenceInput: CompactReviewEvidenceInput | null =
          task || run || reviewPack
            ? buildCompactReviewEvidenceInput(
                reviewPack?.taskSource ?? run?.taskSource ?? task?.taskSource ?? null,
                reviewPack?.sourceCitations ?? run?.sourceCitations ?? null,
                reviewPack?.placement ?? run?.placement ?? null,
                run?.missionBrief ?? null,
                reviewPack?.relaunchOptions ?? run?.relaunchContext ?? null,
                entry.validationOutcome,
                entry.evidenceLabel,
                buildReviewEvidenceInputGate(
                  entry.reviewGateState,
                  entry.reviewFindingCount ?? null
                ),
                reviewPack?.reviewStatus ?? null,
                entry.warningCount,
                entry.recommendedNextAction,
                entry.kind === "mission_run" ? (entry.operatorActionLabel ?? undefined) : undefined,
                entry.kind === "mission_run"
                  ? (entry.operatorActionDetail ?? undefined)
                  : undefined,
                entry.continuePathLabel ?? null,
                entry.routeDetail ?? null
              )
            : null;

        return compactEvidenceInput ? { ...entry, compactEvidenceInput } : entry;
      })
    : [];

  return <ReviewQueuePanel {...props} items={items} />;
}
