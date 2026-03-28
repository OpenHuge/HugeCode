import type {
  HugeCodeReviewFindingSeverity,
  HugeCodeReviewPackSummary,
  HugeCodeRunSummary,
} from "@ku0/code-runtime-host-contract";
import { resolveMissionControlReviewPresentation } from "@ku0/code-runtime-host-contract";
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
type ContinuationState = "ready" | "degraded" | "blocked" | "missing" | null;

export type MissionReviewTriageMetadata = {
  filterTags: MissionReviewFilterTag[];
  triagePriority: number;
};

function resolveTriagePriority(input: {
  reviewPack: HugeCodeReviewPackSummary | null;
  run: MissionControlProjection["runs"][number] | null;
  continuationState: ContinuationState;
  hasBlockedSubAgents: boolean;
}): number {
  return resolveMissionControlReviewPresentation({
    reviewPack: input.reviewPack,
    run: input.run as HugeCodeRunSummary | null,
    continuationState: input.continuationState,
    hasBlockedSubAgents: input.hasBlockedSubAgents,
  }).triagePriority;
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
    input.reviewPack?.validationOutcome === "failed" ||
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
    input.reviewPack?.validationOutcome === "failed" ||
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
    input.continuationState === "degraded" ||
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
    triagePriority: resolveTriagePriority({
      reviewPack: input.reviewPack,
      run: input.run,
      continuationState: input.continuationState,
      hasBlockedSubAgents: input.hasBlockedSubAgents,
    }),
  };
}
