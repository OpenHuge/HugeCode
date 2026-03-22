import type {
  AutoDriveContextSnapshot,
  AutoDrivePublishOutcome,
  AutoDriveStopReason,
} from "../types/autoDrive";

export function requiresManualPublishReview(
  publishOutcome: AutoDrivePublishOutcome | null
): boolean {
  if (!publishOutcome || publishOutcome.status !== "failed") {
    return false;
  }

  const summary = publishOutcome.summary.trim().toLowerCase();
  if (summary.length === 0) {
    return false;
  }

  return [
    "branch protection",
    "protected branch",
    "remote rejected",
    "permission denied",
    "access denied",
    "credentials",
    "credential",
    "authentication",
    "review required",
    "403",
  ].some((signal) => summary.includes(signal));
}

export function requiresHumanPublishInput(publishOutcome: AutoDrivePublishOutcome | null): boolean {
  if (!publishOutcome || publishOutcome.status !== "failed") {
    return false;
  }

  const summary = publishOutcome.summary.trim().toLowerCase();
  if (summary.length === 0) {
    return false;
  }

  return [
    "credentials",
    "credential",
    "authentication",
    "auth failed",
    "token expired",
    "missing token",
    "missing credentials",
    "login required",
  ].some((signal) => summary.includes(signal));
}

export function buildPublishFailureOperatorActions(params: {
  publishOutcome: AutoDrivePublishOutcome | null;
  originalBranch: string | null;
}): string[] {
  const outcome = params.publishOutcome;
  if (!outcome || outcome.status !== "failed" || outcome.mode !== "push_candidate") {
    return [];
  }

  const branchName = outcome.branchName;
  if (!branchName) {
    return [];
  }

  if (requiresHumanPublishInput(outcome)) {
    return [
      "Run `gh auth login` or refresh the repository credentials before retrying the publish candidate.",
      `Checkout \`${branchName}\` and retry \`git push origin ${branchName}\` after credentials are fixed.`,
      params.originalBranch
        ? `Return to \`${params.originalBranch}\` and resume AutoDrive after the isolated branch is pushed.`
        : "Resume AutoDrive after the isolated branch is pushed successfully.",
    ];
  }

  if (requiresManualPublishReview(outcome)) {
    return [
      "Confirm the remote branch policy, required review gate, or repository permission that rejected this push.",
      `Checkout \`${branchName}\` and retry \`git push origin ${branchName}\` after access or review requirements are satisfied.`,
      "Resume AutoDrive once the isolated branch is available for operator-reviewed handoff.",
    ];
  }

  return [];
}

export function resolvePublishAwareStopReason(params: {
  decisionReason: AutoDriveStopReason | null;
  publishOutcome: AutoDrivePublishOutcome | null;
}): AutoDriveStopReason | null {
  if (
    params.decisionReason?.code === "goal_reached" &&
    requiresHumanPublishInput(params.publishOutcome)
  ) {
    return {
      code: "missing_human_input",
      detail: `AutoDrive reached the destination, but publish handoff needs operator credentials or authentication: ${params.publishOutcome?.summary ?? "unknown publish failure"}`,
    };
  }

  if (
    params.decisionReason?.code === "goal_reached" &&
    requiresManualPublishReview(params.publishOutcome)
  ) {
    return {
      code: "unsafe_route_requires_review",
      detail: `AutoDrive reached the destination, but publish handoff requires operator review: ${params.publishOutcome?.summary ?? "unknown publish failure"}`,
    };
  }

  return params.decisionReason;
}

export function shouldAvoidAutomaticPushFromHistory(context: AutoDriveContextSnapshot): boolean {
  const failureSummary = context.publishHistory.latestFailureSummary?.trim().toLowerCase();
  if (!failureSummary) {
    return false;
  }

  return [
    "branch protection",
    "protected branch",
    "remote rejected",
    "permission denied",
    "credentials",
    "credential",
    "non-fast-forward",
    "review required",
  ].some((signal) => failureSummary.includes(signal));
}
