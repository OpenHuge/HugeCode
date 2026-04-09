// TODO(runtime-control-plane): remove this compatibility re-export once app surfaces
// import review-pack detail presentation helpers from @ku0/code-application directly.
export {
  buildCheckpointDetail,
  buildExecutionContext,
  buildGovernanceDetail,
  buildMissionBriefDetail,
  buildMissionLineageDetail,
  buildOperatorSnapshotDetail,
  buildPlacementDetail,
  buildRelaunchContextDetail,
  buildRunLedgerDetail,
  buildSourceProvenanceDetail,
  buildWorkspaceEvidenceDetail,
  pushUnique,
} from "@ku0/code-application/runtimeReviewPackDetailPresentation";
export type {
  OperatorEventSummary,
  OperatorSnapshotSummary,
  PlacementInput,
  WorkspaceEvidenceBucketSummary,
  WorkspaceEvidenceSummary,
} from "@ku0/code-application/runtimeReviewPackDetailPresentation";
