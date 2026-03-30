import type { RuntimeRunPrepareV2Request } from "@ku0/code-runtime-host-contract";
import {
  buildTaskSourceEvidenceLabel,
  normalizeTaskSourceLinkage,
  readTaskSourceGitHubProvenanceHint,
} from "./runtimeMissionControlTaskSourceProjector";
import type { GitHubSourceLaunchSummary } from "./githubSourceLaunchNormalization";

export type GovernedGitHubFollowUpPreviewField = {
  id: "launch" | "backend" | "source";
  label: string;
  value: string;
  detail: string | null;
};

export type GovernedGitHubFollowUpPreview = {
  title: string;
  state: "ready" | "blocked";
  summary: string;
  blockedReason: string | null;
  fields: GovernedGitHubFollowUpPreviewField[];
};

export type GovernedGitHubFollowUpPreviewBackendOrigin =
  | "operator_selected"
  | "repository_policy"
  | "runtime_default";

function readOptionalText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function joinDefined(parts: Array<string | null | undefined>, separator: string): string | null {
  const values = parts.filter((value): value is string => Boolean(value));
  return values.length > 0 ? values.join(separator) : null;
}

function resolvePreviewTitle(launch: GitHubSourceLaunchSummary): string {
  const triggerMode = readOptionalText(launch.taskSource.githubSource?.ref.triggerMode);
  if (triggerMode === "issue_comment_command") {
    return "Issue comment follow-up preview";
  }
  if (triggerMode === "pull_request_review_comment_command") {
    return "Review comment follow-up preview";
  }
  if (launch.taskSource.kind === "github_pr_followup") {
    return "PR follow-up preview";
  }
  return "Issue follow-up preview";
}

function resolveBackendValue(input: {
  request?: RuntimeRunPrepareV2Request | null;
  preferredBackendIds?: readonly string[] | null;
  defaultBackendId?: string | null;
  backendOrigin: GovernedGitHubFollowUpPreviewBackendOrigin;
}): { value: string; detail: string | null } {
  const preferredBackendIds = input.preferredBackendIds ?? input.request?.preferredBackendIds ?? [];
  if (preferredBackendIds.length > 0) {
    return {
      value: preferredBackendIds.join(", "),
      detail:
        input.backendOrigin === "operator_selected"
          ? "Selected in operator controls."
          : "Resolved from repository execution policy.",
    };
  }
  const defaultBackendId =
    readOptionalText(input.defaultBackendId) ?? readOptionalText(input.request?.defaultBackendId);
  if (defaultBackendId) {
    return {
      value: defaultBackendId,
      detail: "Using the configured default backend route.",
    };
  }
  return {
    value: "Runtime default route",
    detail:
      input.backendOrigin === "operator_selected"
        ? "No explicit backend selected. Runtime will resolve the route at launch."
        : "Runtime will resolve the route at launch.",
  };
}

function resolveLaunchValue(request?: RuntimeRunPrepareV2Request | null): {
  value: string;
  detail: string | null;
} {
  if (!request) {
    return {
      value: "Governed runtime launch",
      detail: "Preview is blocked before a launch request could be prepared.",
    };
  }
  return {
    value: readOptionalText(request.executionProfileId) ?? "Governed runtime launch",
    detail:
      joinDefined(
        [
          readOptionalText(request.accessMode),
          readOptionalText(request.executionMode),
          readOptionalText(request.validationPresetId)
            ? `validation ${readOptionalText(request.validationPresetId)}`
            : null,
        ],
        " · "
      ) ?? null,
  };
}

function resolveSourceValue(input: {
  launch: GitHubSourceLaunchSummary;
  sourceEvidenceDetail: string | null;
}): { value: string; detail: string | null } {
  const githubHint = readTaskSourceGitHubProvenanceHint(input.launch.taskSource);
  const compactGitHubProof =
    githubHint && (githubHint.repoFullName || githubHint.refLabel || githubHint.eventLabel)
      ? joinDefined(
          [githubHint.repoFullName ?? "GitHub source", githubHint.refLabel, githubHint.eventLabel],
          " · "
        ) || null
      : null;
  const normalized = normalizeTaskSourceLinkage(input.launch.taskSource);
  const fallbackDetail =
    joinDefined(
      [readOptionalText(normalized?.title), readOptionalText(normalized?.canonicalUrl)],
      " | "
    ) ?? null;
  return {
    value:
      compactGitHubProof ??
      buildTaskSourceEvidenceLabel(input.launch.taskSource) ??
      "GitHub source record",
    detail: input.sourceEvidenceDetail ?? fallbackDetail,
  };
}

export function buildGovernedGitHubFollowUpPreview(input: {
  launch: GitHubSourceLaunchSummary;
  request?: RuntimeRunPrepareV2Request | null;
  state: "ready" | "blocked";
  blockedReason?: string | null;
  backendOrigin?: GovernedGitHubFollowUpPreviewBackendOrigin;
  preferredBackendIds?: readonly string[] | null;
  defaultBackendId?: string | null;
  sourceEvidenceDetail?: string | null;
}): GovernedGitHubFollowUpPreview {
  const title = resolvePreviewTitle(input.launch);
  const sourceLabel = buildTaskSourceEvidenceLabel(input.launch.taskSource) ?? "GitHub source";
  const blockedReason = readOptionalText(input.blockedReason);
  const backend = resolveBackendValue({
    request: input.request,
    preferredBackendIds: input.preferredBackendIds,
    defaultBackendId: input.defaultBackendId,
    backendOrigin: input.backendOrigin ?? "runtime_default",
  });
  const launch = resolveLaunchValue(input.request);
  const source = resolveSourceValue({
    launch: input.launch,
    sourceEvidenceDetail: input.sourceEvidenceDetail ?? null,
  });

  return {
    title,
    state: input.state,
    summary:
      input.state === "ready"
        ? `${sourceLabel} is ready on the governed runtime path.`
        : `${sourceLabel} is waiting on governed runtime launch readiness.`,
    blockedReason,
    fields: [
      {
        id: "launch",
        label: "Launch",
        value: launch.value,
        detail: blockedReason ?? launch.detail,
      },
      {
        id: "backend",
        label: "Backend preference",
        value: backend.value,
        detail: backend.detail,
      },
      {
        id: "source",
        label: "Source evidence",
        value: source.value,
        detail: source.detail,
      },
    ],
  };
}
