import { resolveRuntimeRecommendedAction } from "./runtimeOperatorActionPresentation";
import { resolveReviewIntelligenceSummary } from "./runtimeReviewIntelligenceSummary";

type RuntimeOperatorActionLike = {
  detail?: string | null;
  label?: string | null;
};

function readOptionalText(value: string | null | undefined) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export function resolveFirstRecommendedAction(
  ...values: Array<string | null | undefined>
): string | null {
  for (const value of values) {
    const text = readOptionalText(value);
    if (text) {
      return text;
    }
  }
  return null;
}

type ReviewIntelligenceInput = Parameters<typeof resolveReviewIntelligenceSummary>[0];

export function resolveMissionReviewRecommendedAction(
  input: Omit<ReviewIntelligenceInput, "recommendedNextAction"> & {
    operatorAction?: RuntimeOperatorActionLike | null;
    fallbacks: Array<string | null | undefined>;
  }
) {
  const fallbackRecommendedNextAction = resolveRuntimeRecommendedAction({
    operatorAction: input.operatorAction,
    fallbacks: input.fallbacks,
  });
  const reviewIntelligence = resolveReviewIntelligenceSummary({
    ...input,
    recommendedNextAction:
      fallbackRecommendedNextAction ?? resolveFirstRecommendedAction(...input.fallbacks),
  });

  return {
    recommendedNextAction:
      fallbackRecommendedNextAction ??
      reviewIntelligence?.nextRecommendedAction ??
      resolveFirstRecommendedAction(...input.fallbacks),
    reviewIntelligence,
  };
}

export function resolveOpenReviewPackOperatorActionDetail(input: {
  runtimeActionDetail?: string | null;
  continuationRecommendedAction?: string | null;
  explicitContinuationOperatorAction: boolean;
}) {
  return input.explicitContinuationOperatorAction
    ? (input.runtimeActionDetail ?? input.continuationRecommendedAction ?? null)
    : (input.continuationRecommendedAction ?? input.runtimeActionDetail ?? null);
}

export function resolveReviewPackRecommendedAction(input: {
  prefersContinuationRecommendedAction: boolean;
  continuityRecommendedAction?: string | null;
  continuityBlockingReason?: string | null;
  continuitySummary?: string | null;
  runtimeReviewTruthRecommendedAction?: string | null;
  reviewPackActionabilitySummary?: string | null;
  runActionabilitySummary?: string | null;
  intelligenceRecommendedAction?: string | null;
  reviewPackRecommendedAction?: string | null;
}) {
  return (
    (input.prefersContinuationRecommendedAction ? input.continuityRecommendedAction : null) ??
    input.runtimeReviewTruthRecommendedAction ??
    (!input.prefersContinuationRecommendedAction
      ? resolveFirstRecommendedAction(
          input.continuityBlockingReason,
          input.continuitySummary,
          input.continuityRecommendedAction
        )
      : null) ??
    input.reviewPackActionabilitySummary ??
    input.runActionabilitySummary ??
    input.intelligenceRecommendedAction ??
    resolveFirstRecommendedAction(
      input.continuityBlockingReason,
      input.continuitySummary,
      input.continuityRecommendedAction,
      input.reviewPackRecommendedAction
    )
  );
}
