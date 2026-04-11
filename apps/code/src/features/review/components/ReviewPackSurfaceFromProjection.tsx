import type {
  HugeCodeMissionControlSnapshot as MissionControlProjection,
  RuntimeReviewGetV2Response,
} from "@ku0/code-runtime-host-contract";
import type { RepositoryExecutionContract } from "../../../application/runtime/facades/runtimeRepositoryExecutionContract";
import { useRuntimeWorkspaceSkillCatalog } from "../../../application/runtime/facades/runtimeReviewIntelligenceFacade";
import {
  buildCompactReviewEvidenceInput,
  type CompactReviewEvidenceInput,
} from "../../../application/runtime/facades/runtimeReviewEvidenceModel";
import {
  buildReviewPackDetailModel,
  buildReviewPackListItems,
  type MissionRunDetailModel,
  type ReviewPackDetailModel,
  type ReviewPackSelectionState,
} from "@ku0/code-application/runtimeReviewPackSurfaceModel";
import { ReviewPackSurface, type ReviewPackSurfaceProps } from "./ReviewPackSurface";

export type ReviewPackSurfaceFromProjectionProps = Omit<
  ReviewPackSurfaceProps,
  "items" | "detail"
> & {
  projection: MissionControlProjection | null;
  workspaceId: string;
  selection: ReviewPackSelectionState;
  repositoryExecutionContract?: RepositoryExecutionContract | null;
  runtimeReviewPack?: RuntimeReviewGetV2Response | null;
};

export function ReviewPackSurfaceFromProjection({
  projection,
  workspaceId,
  selection,
  repositoryExecutionContract = null,
  runtimeReviewPack = null,
  ...props
}: ReviewPackSurfaceFromProjectionProps) {
  const items = buildReviewPackListItems(projection, workspaceId, repositoryExecutionContract);
  const detail = buildReviewPackDetailModel({
    projection,
    selection,
    repositoryExecutionContract,
    runtimeReviewPack,
  });
  const task = detail
    ? (projection?.tasks.find((candidate) => candidate.id === detail.taskId) ?? null)
    : null;
  const run = detail
    ? (projection?.runs.find((candidate) => candidate.id === detail.runId) ?? null)
    : null;
  const reviewPack =
    detail && detail.kind === "review_pack"
      ? (projection?.reviewPacks.find((candidate) => candidate.id === detail.id) ?? null)
      : null;
  let compactEvidenceInput: CompactReviewEvidenceInput | null = null;
  if (detail && (task || run || reviewPack)) {
    if (detail.kind === "review_pack") {
      const reviewPackDetail: ReviewPackDetailModel = detail;
      compactEvidenceInput = buildCompactReviewEvidenceInput(
        reviewPack?.taskSource ?? run?.taskSource ?? task?.taskSource ?? null,
        reviewPack?.sourceCitations ?? run?.sourceCitations ?? null,
        reviewPack?.placement ?? run?.placement ?? null,
        run?.missionBrief ?? null,
        reviewPack?.relaunchOptions ?? run?.relaunchContext ?? null,
        reviewPackDetail.validationOutcome,
        reviewPackDetail.evidenceLabel,
        reviewPackDetail.reviewGate ?? null,
        reviewPackDetail.reviewStatus,
        reviewPackDetail.warningCount,
        reviewPackDetail.recommendedNextAction,
        reviewPackDetail.recommendedNextAction,
        reviewPackDetail.continuity?.recommendedAction ?? null,
        reviewPackDetail.continuity?.continuePathLabel ?? null,
        reviewPackDetail.backendAudit?.details.join(" | ") ?? null
      );
    } else {
      const missionRunDetail = detail as MissionRunDetailModel;
      compactEvidenceInput = buildCompactReviewEvidenceInput(
        reviewPack?.taskSource ?? run?.taskSource ?? task?.taskSource ?? null,
        reviewPack?.sourceCitations ?? run?.sourceCitations ?? null,
        reviewPack?.placement ?? run?.placement ?? null,
        run?.missionBrief ?? null,
        reviewPack?.relaunchOptions ?? run?.relaunchContext ?? null,
        "unknown",
        "Runtime evidence only",
        missionRunDetail.reviewGate ?? null,
        null,
        missionRunDetail.warnings.length,
        missionRunDetail.nextActionDetail,
        missionRunDetail.nextActionLabel,
        missionRunDetail.nextActionDetail,
        undefined,
        missionRunDetail.routeDetails.join(" | ")
      );
    }
  }
  const detailWithEvidence =
    detail && compactEvidenceInput ? { ...detail, compactEvidenceInput } : detail;
  const workspaceSkillCatalogState = useRuntimeWorkspaceSkillCatalog(
    workspaceId,
    repositoryExecutionContract
  );

  return (
    <ReviewPackSurface
      {...props}
      items={items}
      detail={detailWithEvidence}
      selection={selection}
      workspaceSkillCatalogState={workspaceSkillCatalogState}
    />
  );
}
