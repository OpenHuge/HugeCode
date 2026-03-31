import type {
  HugeCodeTaskSourceSummary,
  RuntimeGitHubSourceProvenance,
  RuntimeGitHubSourceLaunchHandshakeState,
  RuntimeTaskSourceCommandKind,
  RuntimeTaskSourceLaunchDisposition,
  RuntimeTaskSourceTriggerMode,
} from "@ku0/code-runtime-host-contract";
import type { GitHubIssue, GitHubPullRequest, GitHubUser } from "../../../types";

export type RuntimeTaskSourceWorkspaceContext = {
  workspaceId?: string | null;
  workspaceRoot?: string | null;
  gitRemoteUrl?: string | null;
};

export type RuntimeTaskSourceFallback = RuntimeTaskSourceWorkspaceContext & {
  title?: string | null;
};

export type GitHubTaskSourceCommentInput = {
  id?: number | null;
  commentId?: number | null;
  url?: string | null;
  body?: string | null;
  author?: GitHubUser | null;
};

export type GitHubTaskSourceProvenanceInput = {
  sourceRecordId?: string | null;
  event: {
    eventName: string;
    action?: string | null;
    deliveryId?: string | null;
    receivedAt?: number | null;
  };
  triggerMode?: RuntimeTaskSourceTriggerMode | null;
  commandKind?: RuntimeTaskSourceCommandKind | null;
  headSha?: string | null;
  comment?: GitHubTaskSourceCommentInput | null;
  launchHandshake?: {
    state?: RuntimeGitHubSourceLaunchHandshakeState | null;
    summary?: string | null;
    disposition?: RuntimeTaskSourceLaunchDisposition | null;
    preparedPlanVersion?: string | null;
    approvedPlanVersion?: string | null;
  } | null;
};

export type GitHubTaskSourceLaunchHandshakePatch = {
  state: RuntimeGitHubSourceLaunchHandshakeState;
  summary?: string | null;
  disposition?: RuntimeTaskSourceLaunchDisposition | null;
  preparedPlanVersion?: string | null;
  approvedPlanVersion?: string | null;
};

function readOptionalText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readOptionalNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readGitHubCommentId(
  comment: GitHubTaskSourceCommentInput | null | undefined
): number | null {
  return readOptionalNumber(comment?.commentId) ?? readOptionalNumber(comment?.id);
}

function buildFallbackGitHubSourceRecordId(input: {
  kind: HugeCodeTaskSourceSummary["kind"];
  issueNumber?: number | null;
  pullRequestNumber?: number | null;
  commentId?: number | null;
}): string {
  const subject =
    input.kind === "github_issue"
      ? `issue-${input.issueNumber ?? "unknown"}`
      : `pr-${input.pullRequestNumber ?? "unknown"}`;
  return input.commentId === null
    ? `github-${subject}`
    : `github-${subject}-comment-${input.commentId}`;
}

function buildFallbackGitHubLaunchHandshakeSummary(input: {
  kind: HugeCodeTaskSourceSummary["kind"];
  triggerMode?: RuntimeTaskSourceTriggerMode | null;
}): string {
  if (input.kind === "github_issue" && input.triggerMode === "issue_comment_command") {
    return "Governed GitHub issue follow-up prepared from the linked issue comment command.";
  }
  if (
    input.kind === "github_pr_followup" &&
    input.triggerMode === "pull_request_review_comment_command"
  ) {
    return "Governed GitHub PR follow-up prepared from the linked review comment command.";
  }
  if (input.kind === "github_pr_followup" && input.triggerMode === "pull_request_comment_command") {
    return "Governed GitHub PR follow-up prepared from the linked pull request comment command.";
  }
  return "Governed GitHub source launch prepared.";
}

function buildStartedGitHubLaunchHandshakeSummary(input: {
  kind: HugeCodeTaskSourceSummary["kind"];
  triggerMode?: RuntimeTaskSourceTriggerMode | null;
}): string {
  if (input.kind === "github_issue" && input.triggerMode === "issue_comment_command") {
    return "Governed GitHub issue follow-up launched from the linked issue comment command through the canonical runtime prepare/start lane.";
  }
  if (
    input.kind === "github_pr_followup" &&
    input.triggerMode === "pull_request_review_comment_command"
  ) {
    return "Governed GitHub PR follow-up launched from the linked review comment command through the canonical runtime prepare/start lane.";
  }
  if (input.kind === "github_pr_followup" && input.triggerMode === "pull_request_comment_command") {
    return "Governed GitHub PR follow-up launched from the linked pull request comment command through the canonical runtime prepare/start lane.";
  }
  return "Governed GitHub source launch entered the canonical runtime prepare/start lane.";
}

function stripDotGitSegment(value: string): string {
  return value.endsWith(".git") ? value.slice(0, -4) : value;
}

function normalizeRepoPathSegments(pathname: string): { owner: string; name: string } | null {
  const segments = pathname
    .split("/")
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (segments.length < 2) {
    return null;
  }
  const owner = stripDotGitSegment(segments[0] ?? "");
  const name = stripDotGitSegment(segments[1] ?? "");
  if (!owner || !name) {
    return null;
  }
  return {
    owner,
    name,
  };
}

function parseScpLikeGitRemote(
  value: string
): { host: string; owner: string; name: string } | null {
  const match = /^(?:[^@]+@)?([^:]+):([^/]+)\/(.+?)(?:\.git)?$/u.exec(value);
  if (!match) {
    return null;
  }
  const host = readOptionalText(match[1]);
  const owner = readOptionalText(match[2]);
  const name = readOptionalText(match[3]);
  if (!host || !owner || !name) {
    return null;
  }
  return {
    host,
    owner,
    name,
  };
}

function parseRepoFromUrl(
  value: string | null,
  options?: {
    preserveRemoteUrl?: boolean;
  }
): HugeCodeTaskSourceSummary["repo"] {
  const normalizedValue = readOptionalText(value);
  if (!normalizedValue) {
    return null;
  }
  try {
    const url = new URL(normalizedValue);
    const repoSegments = normalizeRepoPathSegments(url.pathname);
    if (!repoSegments) {
      return null;
    }
    return {
      owner: repoSegments.owner,
      name: repoSegments.name,
      fullName: `${repoSegments.owner}/${repoSegments.name}`,
      remoteUrl: options?.preserveRemoteUrl
        ? normalizedValue
        : `${url.protocol}//${url.host}/${repoSegments.owner}/${repoSegments.name}`,
    };
  } catch {
    const scpRemote = parseScpLikeGitRemote(normalizedValue);
    if (!scpRemote) {
      return null;
    }
    return {
      owner: scpRemote.owner,
      name: scpRemote.name,
      fullName: `${scpRemote.owner}/${scpRemote.name}`,
      remoteUrl: normalizedValue,
    };
  }
}

export function resolveRepoContext(input: {
  sourceUrl?: string | null;
  gitRemoteUrl?: string | null;
}): HugeCodeTaskSourceSummary["repo"] {
  const issueOrPrRepo = parseRepoFromUrl(input.sourceUrl ?? null, {
    preserveRemoteUrl: false,
  });
  const gitRemoteRepo = parseRepoFromUrl(input.gitRemoteUrl ?? null, {
    preserveRemoteUrl: true,
  });
  if (!issueOrPrRepo && !gitRemoteRepo) {
    return null;
  }
  return {
    owner: issueOrPrRepo?.owner ?? gitRemoteRepo?.owner ?? null,
    name: issueOrPrRepo?.name ?? gitRemoteRepo?.name ?? null,
    fullName: issueOrPrRepo?.fullName ?? gitRemoteRepo?.fullName ?? null,
    remoteUrl: readOptionalText(input.gitRemoteUrl) ?? issueOrPrRepo?.remoteUrl ?? null,
  };
}

export function buildManualTaskSource(input: RuntimeTaskSourceFallback): HugeCodeTaskSourceSummary {
  return {
    kind: "manual",
    title: readOptionalText(input.title),
    workspaceId: readOptionalText(input.workspaceId),
    workspaceRoot: readOptionalText(input.workspaceRoot),
  };
}

export function normalizeTaskSourceDraft(
  source: HugeCodeTaskSourceSummary | null | undefined,
  fallback: RuntimeTaskSourceFallback
): HugeCodeTaskSourceSummary {
  if (!source) {
    return buildManualTaskSource(fallback);
  }
  return {
    ...source,
    title: readOptionalText(source.title) ?? readOptionalText(fallback.title),
    reference: readOptionalText(source.reference),
    url: readOptionalText(source.url),
    workspaceId: readOptionalText(source.workspaceId) ?? readOptionalText(fallback.workspaceId),
    workspaceRoot:
      readOptionalText(source.workspaceRoot) ?? readOptionalText(fallback.workspaceRoot),
    repo:
      source.repo ??
      resolveRepoContext({ sourceUrl: source.url, gitRemoteUrl: fallback.gitRemoteUrl }),
  };
}

export function buildGitHubSourceProvenance(input: {
  kind: Extract<HugeCodeTaskSourceSummary["kind"], "github_issue" | "github_pr_followup">;
  issueNumber?: number | null;
  pullRequestNumber?: number | null;
  repo: HugeCodeTaskSourceSummary["repo"];
  provenance?: GitHubTaskSourceProvenanceInput | null;
}): RuntimeGitHubSourceProvenance | null {
  const eventName = readOptionalText(input.provenance?.event.eventName);
  if (!eventName) {
    return null;
  }
  const commentId = readGitHubCommentId(input.provenance?.comment);
  const sourceRecordId =
    readOptionalText(input.provenance?.sourceRecordId) ??
    buildFallbackGitHubSourceRecordId({
      kind: input.kind,
      issueNumber: input.issueNumber,
      pullRequestNumber: input.pullRequestNumber,
      commentId,
    });
  return {
    sourceRecordId,
    repo: input.repo ?? {},
    event: {
      eventName,
      ...(readOptionalText(input.provenance?.event.action)
        ? { action: readOptionalText(input.provenance?.event.action) }
        : {}),
      ...(readOptionalText(input.provenance?.event.deliveryId)
        ? { deliveryId: readOptionalText(input.provenance?.event.deliveryId) }
        : {}),
      ...(readOptionalNumber(input.provenance?.event.receivedAt) !== null
        ? { receivedAt: readOptionalNumber(input.provenance?.event.receivedAt) }
        : {}),
    },
    ref: {
      label:
        input.kind === "github_issue"
          ? `Issue #${input.issueNumber ?? "?"}`
          : `PR #${input.pullRequestNumber ?? "?"}`,
      ...(typeof input.issueNumber === "number" ? { issueNumber: input.issueNumber } : {}),
      ...(typeof input.pullRequestNumber === "number"
        ? { pullRequestNumber: input.pullRequestNumber }
        : {}),
      ...(readOptionalText(input.provenance?.headSha)
        ? { headSha: readOptionalText(input.provenance?.headSha) }
        : {}),
      ...(readOptionalText(input.provenance?.triggerMode)
        ? { triggerMode: readOptionalText(input.provenance?.triggerMode) }
        : {}),
      ...(readOptionalText(input.provenance?.commandKind)
        ? { commandKind: readOptionalText(input.provenance?.commandKind) }
        : {}),
    },
    comment:
      commentId === null &&
      !readOptionalText(input.provenance?.comment?.url) &&
      !readOptionalText(input.provenance?.comment?.author?.login)
        ? null
        : {
            ...(commentId !== null ? { commentId } : {}),
            ...(readOptionalText(input.provenance?.comment?.url)
              ? { url: readOptionalText(input.provenance?.comment?.url) }
              : {}),
            ...(readOptionalText(input.provenance?.comment?.author?.login)
              ? {
                  author: {
                    login: readOptionalText(input.provenance?.comment?.author?.login),
                  },
                }
              : {}),
          },
    launchHandshake: {
      state:
        input.provenance?.launchHandshake?.state ??
        ("prepared" as RuntimeGitHubSourceLaunchHandshakeState),
      summary:
        readOptionalText(input.provenance?.launchHandshake?.summary) ??
        buildFallbackGitHubLaunchHandshakeSummary({
          kind: input.kind,
          triggerMode: input.provenance?.triggerMode,
        }),
      ...(input.provenance?.launchHandshake?.disposition
        ? { disposition: input.provenance.launchHandshake.disposition }
        : {}),
      ...(readOptionalText(input.provenance?.launchHandshake?.preparedPlanVersion)
        ? {
            preparedPlanVersion: readOptionalText(
              input.provenance?.launchHandshake?.preparedPlanVersion
            ),
          }
        : {}),
      ...(readOptionalText(input.provenance?.launchHandshake?.approvedPlanVersion)
        ? {
            approvedPlanVersion: readOptionalText(
              input.provenance?.launchHandshake?.approvedPlanVersion
            ),
          }
        : {}),
    },
  };
}

export function applyGitHubLaunchHandshakeToTaskSource(
  taskSource: HugeCodeTaskSourceSummary | null | undefined,
  patch: GitHubTaskSourceLaunchHandshakePatch
): HugeCodeTaskSourceSummary | null {
  if (!taskSource?.githubSource) {
    return taskSource ?? null;
  }
  const existingHandshake = taskSource.githubSource.launchHandshake;
  const triggerMode = taskSource.githubSource.ref.triggerMode ?? null;
  const summary =
    readOptionalText(patch.summary) ??
    (patch.state === "started"
      ? buildStartedGitHubLaunchHandshakeSummary({
          kind: taskSource.kind,
          triggerMode,
        })
      : buildFallbackGitHubLaunchHandshakeSummary({
          kind: taskSource.kind,
          triggerMode,
        }));

  return {
    ...taskSource,
    githubSource: {
      ...taskSource.githubSource,
      launchHandshake: {
        ...(existingHandshake ?? {}),
        state: patch.state,
        summary,
        ...(patch.disposition ? { disposition: patch.disposition } : {}),
        ...(readOptionalText(patch.preparedPlanVersion)
          ? { preparedPlanVersion: readOptionalText(patch.preparedPlanVersion) }
          : {}),
        ...(readOptionalText(patch.approvedPlanVersion)
          ? { approvedPlanVersion: readOptionalText(patch.approvedPlanVersion) }
          : {}),
      },
    },
  };
}

export function buildGitHubIssueTaskSource(input: {
  issue: GitHubIssue;
  workspaceId?: string | null;
  workspaceRoot?: string | null;
  gitRemoteUrl?: string | null;
  sourceTaskId?: string | null;
  sourceRunId?: string | null;
  githubSource?: GitHubTaskSourceProvenanceInput | null;
}): HugeCodeTaskSourceSummary {
  const repo = resolveRepoContext({
    sourceUrl: input.issue.url,
    gitRemoteUrl: input.gitRemoteUrl,
  });
  return normalizeTaskSourceDraft(
    {
      kind: "github_issue",
      label: `GitHub issue #${input.issue.number}`,
      shortLabel: `Issue #${input.issue.number}`,
      title: input.issue.title,
      reference: `#${input.issue.number}`,
      url: input.issue.url,
      issueNumber: input.issue.number,
      externalId: input.issue.url,
      canonicalUrl: input.issue.url,
      sourceTaskId: readOptionalText(input.sourceTaskId) ?? input.issue.url,
      sourceRunId: readOptionalText(input.sourceRunId) ?? input.issue.url,
      repo,
      githubSource: buildGitHubSourceProvenance({
        kind: "github_issue",
        issueNumber: input.issue.number,
        repo,
        provenance: input.githubSource ?? null,
      }),
    },
    input
  );
}

export function buildGitHubPullRequestFollowUpTaskSource(input: {
  pullRequest: GitHubPullRequest;
  workspaceId?: string | null;
  workspaceRoot?: string | null;
  gitRemoteUrl?: string | null;
  sourceTaskId?: string | null;
  sourceRunId?: string | null;
  githubSource?: GitHubTaskSourceProvenanceInput | null;
}): HugeCodeTaskSourceSummary {
  const repo = resolveRepoContext({
    sourceUrl: input.pullRequest.url,
    gitRemoteUrl: input.gitRemoteUrl,
  });
  return normalizeTaskSourceDraft(
    {
      kind: "github_pr_followup",
      label: `GitHub PR follow-up #${input.pullRequest.number}`,
      shortLabel: `PR #${input.pullRequest.number} follow-up`,
      title: input.pullRequest.title,
      reference: `#${input.pullRequest.number}`,
      url: input.pullRequest.url,
      pullRequestNumber: input.pullRequest.number,
      externalId: input.pullRequest.url,
      canonicalUrl: input.pullRequest.url,
      sourceTaskId: readOptionalText(input.sourceTaskId) ?? input.pullRequest.url,
      sourceRunId: readOptionalText(input.sourceRunId) ?? input.pullRequest.url,
      repo,
      githubSource: buildGitHubSourceProvenance({
        kind: "github_pr_followup",
        pullRequestNumber: input.pullRequest.number,
        repo,
        provenance: input.githubSource ?? null,
      }),
    },
    input
  );
}

export function buildScheduleTaskSource(input: {
  scheduleId: string;
  title?: string | null;
  workspaceId?: string | null;
  workspaceRoot?: string | null;
  gitRemoteUrl?: string | null;
  sourceTaskId?: string | null;
  sourceRunId?: string | null;
}): HugeCodeTaskSourceSummary {
  const scheduleId = readOptionalText(input.scheduleId) ?? "schedule";
  return normalizeTaskSourceDraft(
    {
      kind: "schedule",
      label: "Scheduled task",
      shortLabel: "Schedule",
      title: readOptionalText(input.title) ?? "Scheduled automation",
      externalId: scheduleId,
      canonicalUrl: `schedule://${scheduleId}`,
      sourceTaskId: readOptionalText(input.sourceTaskId) ?? scheduleId,
      sourceRunId: readOptionalText(input.sourceRunId) ?? scheduleId,
      repo: resolveRepoContext({
        gitRemoteUrl: input.gitRemoteUrl,
      }),
    },
    input
  );
}
