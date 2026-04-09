import type {
  RuntimeExecutionEvidenceSummary,
  RuntimeExecutionLifecycleSummary,
} from "@ku0/code-runtime-host-contract";

export type SummaryDetail = {
  summary: string;
  details: string[];
};

function formatExecutionLifecycleStageLabel(
  stage: RuntimeExecutionLifecycleSummary["stage"]
): string {
  return stage.replaceAll("_", " ");
}

function formatExecutionEvidenceReviewStatusLabel(
  reviewStatus: NonNullable<RuntimeExecutionEvidenceSummary["reviewStatus"]>
): string {
  switch (reviewStatus) {
    case "ready":
      return "review ready";
    case "action_required":
      return "action required";
    case "incomplete_evidence":
      return "evidence incomplete";
  }
}

export function buildExecutionLifecycleDetail(
  lifecycleSummary: RuntimeExecutionLifecycleSummary | null | undefined
): SummaryDetail | undefined {
  if (!lifecycleSummary) {
    return undefined;
  }
  const details = [
    `Lifecycle stage: ${formatExecutionLifecycleStageLabel(lifecycleSummary.stage)}.`,
    lifecycleSummary.validated
      ? "Validation preflight completed."
      : "Validation preflight not confirmed.",
    lifecycleSummary.blocked ? "Runtime marked this execution path as blocked." : null,
    lifecycleSummary.rerouted ? "Runtime rerouted the execution path." : null,
    lifecycleSummary.readyForReview
      ? "Runtime marked this execution ready for review."
      : "Runtime has not marked this execution ready for review yet.",
  ].filter((value): value is string => value !== null);
  return {
    summary: lifecycleSummary.summary,
    details,
  };
}

export function buildExecutionEvidenceDetail(
  evidenceSummary: RuntimeExecutionEvidenceSummary | null | undefined
): SummaryDetail | undefined {
  if (!evidenceSummary) {
    return undefined;
  }
  const details = [
    `Validation checks: ${evidenceSummary.validationCount}.`,
    `Artifacts: ${evidenceSummary.artifactCount}.`,
    `Warnings: ${evidenceSummary.warningCount}.`,
    `Changed paths: ${evidenceSummary.changedPathCount}.`,
    evidenceSummary.reviewStatus
      ? `Review state: ${formatExecutionEvidenceReviewStatusLabel(evidenceSummary.reviewStatus)}.`
      : null,
    evidenceSummary.authoritativeTraceId
      ? `Authoritative trace: ${evidenceSummary.authoritativeTraceId}.`
      : null,
    evidenceSummary.authoritativeCheckpointId
      ? `Authoritative checkpoint: ${evidenceSummary.authoritativeCheckpointId}.`
      : null,
  ].filter((value): value is string => value !== null);
  return {
    summary: evidenceSummary.summary,
    details,
  };
}
