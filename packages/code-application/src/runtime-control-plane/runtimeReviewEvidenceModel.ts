import type { HugeCodeValidationOutcome } from "@ku0/code-runtime-host-contract";
import type { HugeCodeMissionControlSnapshot as MissionControlProjection } from "@ku0/code-runtime-host-contract";

export type ReviewEvidenceInputSource =
  | MissionControlProjection["tasks"][number]["taskSource"]
  | MissionControlProjection["runs"][number]["taskSource"]
  | MissionControlProjection["reviewPacks"][number]["taskSource"]
  | null
  | undefined;

export type ReviewEvidenceInputCitations =
  | Array<
      | NonNullable<MissionControlProjection["runs"][number]["sourceCitations"]>[number]
      | NonNullable<MissionControlProjection["reviewPacks"][number]["sourceCitations"]>[number]
    >
  | null
  | undefined;

export type ReviewEvidenceInputPlacement =
  | MissionControlProjection["runs"][number]["placement"]
  | MissionControlProjection["reviewPacks"][number]["placement"]
  | null
  | undefined;

export type ReviewEvidenceInputMissionBrief =
  | MissionControlProjection["runs"][number]["missionBrief"]
  | null
  | undefined;

export type ReviewEvidenceInputRelaunchContext =
  | MissionControlProjection["runs"][number]["relaunchContext"]
  | MissionControlProjection["reviewPacks"][number]["relaunchOptions"]
  | null
  | undefined;

export type ReviewEvidenceInputReviewGate = {
  state?: "pass" | "warn" | "fail" | "blocked" | null;
  findingCount?: number | null;
} | null;

export type CompactReviewEvidenceInput = {
  source: ReviewEvidenceInputSource;
  sourceCitations?: ReviewEvidenceInputCitations;
  placement: ReviewEvidenceInputPlacement;
  missionBrief?: ReviewEvidenceInputMissionBrief;
  relaunchContext?: ReviewEvidenceInputRelaunchContext;
  validationOutcome: HugeCodeValidationOutcome;
  evidenceLabel: string;
  reviewGate?: ReviewEvidenceInputReviewGate;
  reviewStatus?: "ready" | "action_required" | "incomplete_evidence" | null;
  warningCount?: number;
  recommendedNextAction?: string | null;
  nextActionLabel?: string | null;
  nextActionDetail?: string | null;
  continuePathLabel?: string | null;
  routeDetail?: string | null;
};

export function buildReviewEvidenceInputGate(
  state?: "pass" | "warn" | "fail" | "blocked" | null,
  findingCount?: number | null
): ReviewEvidenceInputReviewGate {
  return state || typeof findingCount === "number" ? { state: state ?? null, findingCount } : null;
}

export function buildCompactReviewEvidenceInput(
  source: ReviewEvidenceInputSource,
  sourceCitations: ReviewEvidenceInputCitations,
  placement: ReviewEvidenceInputPlacement,
  missionBrief: ReviewEvidenceInputMissionBrief,
  relaunchContext: ReviewEvidenceInputRelaunchContext,
  validationOutcome: HugeCodeValidationOutcome,
  evidenceLabel: string,
  reviewGate: ReviewEvidenceInputReviewGate,
  reviewStatus?: "ready" | "action_required" | "incomplete_evidence" | null,
  warningCount?: number,
  recommendedNextAction?: string | null,
  nextActionLabel?: string | null,
  nextActionDetail?: string | null,
  continuePathLabel?: string | null,
  routeDetail?: string | null
): CompactReviewEvidenceInput {
  return {
    source,
    sourceCitations,
    placement,
    missionBrief,
    relaunchContext,
    validationOutcome,
    evidenceLabel,
    reviewGate,
    reviewStatus,
    warningCount,
    recommendedNextAction,
    nextActionLabel,
    nextActionDetail,
    continuePathLabel,
    routeDetail,
  };
}
