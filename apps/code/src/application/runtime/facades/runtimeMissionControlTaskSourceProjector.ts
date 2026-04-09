// TODO(runtime-control-plane): remove this compatibility re-export once app surfaces
// import task-source projection helpers from @ku0/code-application directly.
export {
  buildTaskSourceEvidenceLabel,
  buildTaskSourceLineageDetails,
  buildTaskSourceProvenanceDetail,
  buildTaskSourceProvenanceSummary,
  normalizeTaskSourceLinkage,
  readTaskSourceGitHubProvenanceHint,
  resolveTaskSourceSecondaryLabel,
} from "@ku0/code-application/runtimeMissionControlTaskSourceProjector";
export type {
  TaskSourceGitHubProvenanceHint,
  TaskSourceProvenanceDetail,
} from "@ku0/code-application/runtimeMissionControlTaskSourceProjector";
