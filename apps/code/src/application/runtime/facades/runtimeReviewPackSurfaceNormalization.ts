export type NormalizedRelaunchOption = {
  id: string;
  label: string;
  detail: string | null;
  enabled: boolean;
  disabledReason: string | null;
};

export type NormalizedPublishHandoff = {
  summary: string | null;
  branchName: string | null;
  reviewTitle: string | null;
  reviewBody?: string | null;
  reviewChecklist?: string[];
  operatorCommands?: string[];
  details?: string[];
};

export function normalizeReviewPackRelaunchOptions(
  input: Record<string, unknown> | Array<Record<string, unknown>> | null | undefined
): NormalizedRelaunchOption[] {
  if (!input) {
    return [];
  }
  if (Array.isArray(input)) {
    return input
      .map((option) => {
        if (!option) {
          return null;
        }
        const label = typeof option.label === "string" ? option.label.trim() : "";
        const id =
          typeof option.id === "string" && option.id.trim().length > 0 ? option.id : "option";
        const detail = typeof option.detail === "string" ? option.detail.trim() : null;
        const enabled = option.enabled ?? false;
        const disabledReason =
          typeof option.disabledReason === "string" ? option.disabledReason : null;
        return {
          id,
          label: label || id,
          detail,
          enabled: Boolean(enabled),
          disabledReason,
        };
      })
      .filter((value): value is NormalizedRelaunchOption => value !== null);
  }

  const availableActions = Array.isArray(input.availableActions) ? input.availableActions : [];
  if (availableActions.length > 0) {
    return availableActions
      .filter(
        (
          action
        ): action is {
          action: string;
          label?: string | null;
          enabled?: boolean | null;
          reason?: string | null;
        } =>
          Boolean(action) &&
          typeof action === "object" &&
          typeof action.action === "string" &&
          action.action.trim().length > 0
      )
      .map((action) => ({
        id:
          action.action === "continue_with_clarification"
            ? "clarify"
            : action.action === "escalate_to_pair_mode"
              ? "continue_in_pair"
              : action.action,
        label: action.label?.trim() || action.action,
        detail: typeof input.summary === "string" ? input.summary.trim() : null,
        enabled: action.enabled ?? false,
        disabledReason: action.enabled ? null : (action.reason?.trim() ?? null),
      }));
  }

  const recommendedActions = Array.isArray(input.recommendedActions)
    ? input.recommendedActions
    : [];
  const labels: Record<string, string> = {
    retry: "Retry",
    continue_with_clarification: "Clarify",
    switch_profile_and_retry: "Switch profile and retry",
    escalate_to_pair_mode: "Continue in pair",
  };
  return recommendedActions
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map((action) => ({
      id:
        action === "continue_with_clarification"
          ? "clarify"
          : action === "escalate_to_pair_mode"
            ? "continue_in_pair"
            : action,
      label: labels[action] ?? action,
      detail: typeof input.summary === "string" ? input.summary.trim() : null,
      enabled: true,
      disabledReason: null,
    }));
}

export function normalizeReviewPackPublishHandoff(
  input: Record<string, unknown> | null | undefined
): NormalizedPublishHandoff | null {
  if (!input) {
    return null;
  }
  const jsonPath = typeof input.jsonPath === "string" ? input.jsonPath : null;
  const markdownPath = typeof input.markdownPath === "string" ? input.markdownPath : null;
  const summary =
    typeof input.summary === "string"
      ? input.summary
      : typeof input.description === "string"
        ? input.description
        : null;
  const handoff = input.handoff as Record<string, unknown> | undefined;
  const publish = (input.publish ?? handoff?.publish) as Record<string, unknown> | undefined;
  const branchName =
    typeof input.branchName === "string"
      ? input.branchName
      : typeof publish?.branchName === "string"
        ? publish.branchName
        : null;
  const reviewDraft = (input.reviewDraft ?? handoff?.reviewDraft ?? publish?.reviewDraft) as
    | Record<string, unknown>
    | undefined;
  const reviewTitle = typeof reviewDraft?.title === "string" ? reviewDraft.title : null;
  const reviewBody = typeof reviewDraft?.body === "string" ? reviewDraft.body : null;
  const reviewChecklist = Array.isArray(reviewDraft?.checklist)
    ? reviewDraft.checklist.filter((item): item is string => typeof item === "string")
    : [];
  const rawOperatorCommands = input.operatorCommands ?? handoff?.operatorCommands;
  const operatorCommands = Array.isArray(rawOperatorCommands)
    ? rawOperatorCommands.filter((item): item is string => typeof item === "string")
    : [];
  const details = (
    Array.isArray(input.details) && input.details.every((item) => typeof item === "string")
      ? input.details
      : []
  ).slice();
  if (jsonPath) {
    details.push(`JSON handoff: ${jsonPath}`);
  }
  if (markdownPath) {
    details.push(`Markdown handoff: ${markdownPath}`);
  }
  if (typeof input.reason === "string" && input.reason.trim().length > 0) {
    details.push(input.reason.trim());
  }
  if (
    !summary &&
    !branchName &&
    !reviewTitle &&
    !reviewBody &&
    reviewChecklist.length === 0 &&
    operatorCommands.length === 0 &&
    details.length === 0
  ) {
    return null;
  }
  return {
    summary,
    branchName,
    reviewTitle,
    reviewBody,
    reviewChecklist: reviewChecklist.length > 0 ? reviewChecklist : undefined,
    operatorCommands: operatorCommands.length > 0 ? operatorCommands : undefined,
    details: details.length > 0 ? details : undefined,
  };
}
