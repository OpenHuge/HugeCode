import type {
  HugeCodeEvidenceState,
  HugeCodeReviewStatus,
  HugeCodeValidationOutcome,
} from "@ku0/code-runtime-host-contract";

type ReviewBadgeTone = "success" | "warning" | "danger" | "neutral";

export function formatReviewStatusLabel(
  status: HugeCodeReviewStatus,
  warningCount: number
): string {
  if (status === "action_required") {
    return warningCount > 0 ? `Needs attention (${warningCount} warnings)` : "Needs attention";
  }
  if (status === "incomplete_evidence") {
    return "Evidence incomplete";
  }
  return "Review ready";
}

export function formatReviewEvidenceStateLabel(evidenceState: HugeCodeEvidenceState): string {
  return evidenceState === "confirmed" ? "Evidence confirmed" : "Evidence incomplete";
}

export function getReviewStatusTone(status: HugeCodeReviewStatus): ReviewBadgeTone {
  return status === "ready" ? "success" : "warning";
}

export function getReviewEvidenceStateTone(evidenceState: HugeCodeEvidenceState): ReviewBadgeTone {
  return evidenceState === "confirmed" ? "success" : "warning";
}

export function formatValidationOutcomeLabel(outcome: HugeCodeValidationOutcome): string {
  switch (outcome) {
    case "passed":
      return "Validation passed";
    case "failed":
      return "Validation failed";
    case "warning":
      return "Validation warning";
    case "skipped":
      return "Validation skipped";
    default:
      return "Validation unavailable";
  }
}

export function getValidationOutcomeTone(outcome: HugeCodeValidationOutcome): ReviewBadgeTone {
  switch (outcome) {
    case "passed":
      return "success";
    case "failed":
      return "danger";
    case "warning":
      return "warning";
    default:
      return "neutral";
  }
}

export function formatMissionReviewEvidenceLabel(
  outcome: HugeCodeValidationOutcome,
  warningCount: number,
  isRuntimeManagedMission: boolean
): string {
  if (outcome === "passed") {
    return warningCount > 0 ? "Validation passed with warnings" : "Validation passed";
  }
  if (outcome === "warning") {
    return "Evidence needs review";
  }
  if (outcome === "failed") {
    return "Validation failed";
  }
  if (isRuntimeManagedMission) {
    return "Runtime evidence only";
  }
  return "Validation evidence unavailable";
}
