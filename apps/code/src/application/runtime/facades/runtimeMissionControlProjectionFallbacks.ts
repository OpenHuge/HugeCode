import type {
  HugeCodeRunApprovalSummary,
  HugeCodeRunInterventionSummary,
  HugeCodeRunNextAction,
  HugeCodeRunRoutingSummary,
} from "@ku0/code-runtime-host-contract";
import type { RuntimeContinuationDescriptor } from "./runtimeContinuationTruth";

export type RuntimeContinuationDescriptorProjection = {
  state: "ready" | "attention" | "blocked" | "missing";
  summary: string;
  detail: string | null;
  recommendedAction: string | null;
  continuePathLabel: string | null;
  truthSourceLabel: string | null;
  continuityOverview: string | null;
  checkpointDurabilityState: string | null;
  hasHandoffPath: boolean;
  canSafelyContinue: boolean;
  reviewFollowUpActionable: boolean;
};

export function buildFallbackApprovalSummary(): HugeCodeRunApprovalSummary {
  return {
    status: "not_required",
    approvalId: null,
    label: "No pending approval",
    summary: "This run does not currently require an approval decision.",
  };
}

export function buildFallbackInterventionSummary(): HugeCodeRunInterventionSummary {
  return {
    actions: [],
    primaryAction: null,
  };
}

export function buildFallbackNextAction(detail: string | null = null): HugeCodeRunNextAction {
  return {
    label: "Inspect run state",
    action: "review",
    detail,
  };
}

export function buildFallbackRoutingSummary(): HugeCodeRunRoutingSummary {
  return {
    backendId: null,
    provider: null,
    providerLabel: null,
    pool: null,
    routeLabel: "Runtime route unavailable",
    routeHint: "Runtime routing details are unavailable.",
    health: "attention",
    enabledAccountCount: 0,
    readyAccountCount: 0,
    enabledPoolCount: 0,
  };
}

export function mapRuntimeContinuationDescriptor(
  descriptor: RuntimeContinuationDescriptor | null
): RuntimeContinuationDescriptorProjection {
  if (!descriptor) {
    return {
      state: "missing",
      summary: "Runtime continuation guidance is unavailable.",
      detail: null,
      recommendedAction: null,
      continuePathLabel: null,
      truthSourceLabel: null,
      continuityOverview: null,
      checkpointDurabilityState: "unknown",
      hasHandoffPath: false,
      canSafelyContinue: false,
      reviewFollowUpActionable: false,
    };
  }
  const canSafelyContinue = descriptor.state === "ready" && descriptor.pathKind !== "missing";
  const hasHandoffPath = descriptor.pathKind === "handoff";
  const reviewFollowUpActionable = descriptor.pathKind === "review" && descriptor.state === "ready";
  const checkpointDurabilityState =
    descriptor.truthSource === "checkpoint"
      ? descriptor.state === "ready"
        ? "ready"
        : descriptor.state === "attention"
          ? "attention"
          : descriptor.state === "blocked"
            ? "blocked"
            : "unknown"
      : "unknown";
  const continuityOverview =
    descriptor.state === "missing"
      ? null
      : [
          descriptor.summary,
          canSafelyContinue ? "Continuation path is ready." : "Continuation path needs attention.",
          hasHandoffPath ? "Handoff path available." : "No handoff path recorded.",
          reviewFollowUpActionable
            ? "Review follow-up is actionable."
            : "Review follow-up is not yet actionable.",
        ].join(" ");

  return {
    state: descriptor.state,
    summary: descriptor.summary,
    detail: descriptor.details[0] ?? descriptor.blockingReason,
    recommendedAction: descriptor.recommendedAction,
    continuePathLabel: descriptor.continuePathLabel,
    truthSourceLabel: descriptor.truthSourceLabel,
    continuityOverview,
    checkpointDurabilityState,
    hasHandoffPath,
    canSafelyContinue,
    reviewFollowUpActionable,
  };
}
