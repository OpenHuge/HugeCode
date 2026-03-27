import type { HugeCodeTaskSourceSummary } from "@ku0/code-runtime-host-contract";
import type { GitHubIssue, GitHubPullRequest } from "../../../types";

type RuntimeTaskSourceWorkspaceContext = {
  workspaceId: string;
  workspaceRoot?: string | null;
  gitRemoteUrl?: string | null;
};

type TaskSourceFallback = RuntimeTaskSourceWorkspaceContext & {
  title?: string | null;
};

function readOptionalText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
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

export function buildManualTaskSource(input: TaskSourceFallback): HugeCodeTaskSourceSummary {
  return {
    kind: "manual",
    title: readOptionalText(input.title),
    workspaceId: input.workspaceId,
    workspaceRoot: readOptionalText(input.workspaceRoot),
  };
}

export function normalizeTaskSourceDraft(
  source: HugeCodeTaskSourceSummary | null | undefined,
  fallback: TaskSourceFallback
): HugeCodeTaskSourceSummary {
  if (!source) {
    return buildManualTaskSource(fallback);
  }
  return {
    ...source,
    title: readOptionalText(source.title) ?? readOptionalText(fallback.title),
    reference: readOptionalText(source.reference),
    url: readOptionalText(source.url),
    workspaceId: readOptionalText(source.workspaceId) ?? fallback.workspaceId,
    workspaceRoot:
      readOptionalText(source.workspaceRoot) ?? readOptionalText(fallback.workspaceRoot),
    repo:
      source.repo ??
      resolveRepoContext({ sourceUrl: source.url, gitRemoteUrl: fallback.gitRemoteUrl }),
  };
}

export function buildGitHubIssueTaskSource(input: {
  issue: GitHubIssue;
  workspaceId: string;
  workspaceRoot?: string | null;
  gitRemoteUrl?: string | null;
}): HugeCodeTaskSourceSummary {
  return normalizeTaskSourceDraft(
    {
      kind: "github_issue",
      title: input.issue.title,
      reference: `#${input.issue.number}`,
      url: input.issue.url,
      issueNumber: input.issue.number,
      repo: resolveRepoContext({
        sourceUrl: input.issue.url,
        gitRemoteUrl: input.gitRemoteUrl,
      }),
    },
    input
  );
}

export function buildGitHubPullRequestFollowUpTaskSource(input: {
  pullRequest: GitHubPullRequest;
  workspaceId: string;
  workspaceRoot?: string | null;
  gitRemoteUrl?: string | null;
}): HugeCodeTaskSourceSummary {
  return normalizeTaskSourceDraft(
    {
      kind: "github_pr_followup",
      title: input.pullRequest.title,
      reference: `#${input.pullRequest.number}`,
      url: input.pullRequest.url,
      pullRequestNumber: input.pullRequest.number,
      repo: resolveRepoContext({
        sourceUrl: input.pullRequest.url,
        gitRemoteUrl: input.gitRemoteUrl,
      }),
    },
    input
  );
}
