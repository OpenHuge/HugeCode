import type {
  HugeCodeReviewFindingSeverity,
  HugeCodeReviewPackSummary,
} from "@ku0/code-runtime-host-contract";
import type { MissionControlProjection } from "./runtimeMissionControlFacade";

export type MissionReviewFilterTag =
  | "needs_attention"
  | "critical_review"
  | "autofix_ready"
  | "blocked_follow_up"
  | "incomplete_evidence"
  | "fallback_routing"
  | "sub_agent_blocked";

type ReviewGateState = "pass" | "warn" | "fail" | "blocked" | null;
type ContinuationState = "ready" | "attention" | "blocked" | "missing" | null;

export type MissionReviewTriageMetadata = {
  filterTags: MissionReviewFilterTag[];
  triagePriority: number;
};

function resolveTriagePriority(input: {
  reviewPack: HugeCodeReviewPackSummary | null;
  run: MissionControlProjection["runs"][number] | null;
  reviewGateState: ReviewGateState;
  highestReviewSeverity: HugeCodeReviewFindingSeverity | null;
  autofixAvailable: boolean;
  continuationState: ContinuationState;
  hasBlockedSubAgents: boolean;
}): number {
  const hasBlockedFollowUp =
    input.continuationState === "blocked" ||
    input.continuationState === "attention" ||
    input.hasBlockedSubAgents;
  const hasFallbackRouting =
    input.reviewPack?.placement?.resolutionSource === "runtime_fallback" ||
    input.reviewPack?.placement?.lifecycleState === "fallback" ||
    input.run?.placement?.resolutionSource === "runtime_fallback" ||
    input.run?.placement?.lifecycleState === "fallback";
  const hasPlacementAttention =
    input.reviewPack?.placement?.healthSummary === "placement_attention" ||
    input.reviewPack?.placement?.healthSummary === "placement_blocked" ||
    input.run?.placement?.healthSummary === "placement_attention" ||
    input.run?.placement?.healthSummary === "placement_blocked";
  const hasEvidenceFollowUp =
    input.reviewPack?.reviewStatus === "incomplete_evidence" ||
    hasFallbackRouting ||
    hasPlacementAttention;
  if (
    input.run?.approval?.status === "pending_decision" ||
    Boolean(input.run?.operatorSnapshot?.blocker?.trim()) ||
    input.reviewPack?.reviewDecision?.status === "rejected" ||
    input.reviewPack?.reviewStatus === "action_required" ||
    input.reviewGateState === "fail" ||
    input.reviewGateState === "blocked" ||
    input.highestReviewSeverity === "critical" ||
    (!input.reviewPack &&
      input.run !== null &&
      ["needs_input", "failed", "cancelled"].includes(input.run.state))
  ) {
    return 4;
  }
  if (hasBlockedFollowUp && hasEvidenceFollowUp) {
    return 3.5;
  }
  if (hasBlockedFollowUp) {
    return 3;
  }
  if (input.autofixAvailable) {
    return 2;
  }
  if (
    input.reviewPack?.reviewStatus === "incomplete_evidence" ||
    hasFallbackRouting ||
    hasPlacementAttention ||
    input.hasBlockedSubAgents
  ) {
    return 1;
  }
  return 0;
}

export function buildMissionReviewTriageMetadata(input: {
  reviewPack: HugeCodeReviewPackSummary | null;
  run: MissionControlProjection["runs"][number] | null;
  reviewGateState: ReviewGateState;
  highestReviewSeverity: HugeCodeReviewFindingSeverity | null;
  autofixAvailable: boolean;
  continuationState: ContinuationState;
  hasBlockedSubAgents: boolean;
}): MissionReviewTriageMetadata {
  const filterTags: MissionReviewFilterTag[] = [];

  if (
    input.reviewPack?.reviewStatus === "action_required" ||
    input.reviewPack?.reviewDecision?.status === "rejected" ||
    input.run?.approval?.status === "pending_decision" ||
    Boolean(input.run?.operatorSnapshot?.blocker?.trim()) ||
    (!input.reviewPack &&
      input.run !== null &&
      ["needs_input", "failed", "cancelled"].includes(input.run.state)) ||
    input.reviewGateState === "fail" ||
    input.reviewGateState === "blocked"
  ) {
    filterTags.push("needs_attention");
  }
  if (
    input.reviewGateState === "fail" ||
    input.reviewGateState === "blocked" ||
    input.highestReviewSeverity === "critical"
  ) {
    filterTags.push("critical_review");
  }
  if (input.autofixAvailable) {
    filterTags.push("autofix_ready");
  }
  if (
    input.continuationState === "blocked" ||
    input.continuationState === "attention" ||
    input.hasBlockedSubAgents
  ) {
    filterTags.push("blocked_follow_up");
  }
  if (input.reviewPack?.reviewStatus === "incomplete_evidence") {
    filterTags.push("incomplete_evidence");
  }
  if (
    input.reviewPack?.placement?.resolutionSource === "runtime_fallback" ||
    input.reviewPack?.placement?.lifecycleState === "fallback" ||
    input.run?.placement?.resolutionSource === "runtime_fallback" ||
    input.run?.placement?.lifecycleState === "fallback"
  ) {
    filterTags.push("fallback_routing");
  }
  if (input.hasBlockedSubAgents) {
    filterTags.push("sub_agent_blocked");
  }

  return {
    filterTags,
    triagePriority: resolveTriagePriority(input),
  };
}
