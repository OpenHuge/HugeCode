import type {
  AgentTaskSourceSummary,
  RuntimeAutonomyRequestV2,
  RuntimeRunPrepareV2Request,
} from "@ku0/code-runtime-host-contract";
import type {
  GitHubIssue,
  GitHubPullRequest,
  GitHubPullRequestComment,
  GitHubPullRequestDiff,
} from "../../../types";
import {
  normalizeGitHubIssueCommentCommandLaunchInput,
  normalizeGitHubIssueLaunchInput,
  normalizeGitHubPullRequestFollowUpLaunchInput,
  normalizeGitHubPullRequestReviewCommentCommandLaunchInput,
  type GitHubIssueCommentCommandLaunchInput,
  type GitHubPullRequestReviewCommentCommandLaunchInput,
  type GitHubSourceLaunchSummary,
} from "./githubSourceLaunchNormalization";
import {
  buildGovernedRuntimeRunRequest,
  launchGovernedRuntimeRun,
  type GovernedRuntimeRunLaunchAck,
} from "./runtimeGovernedRunIngestion";
import { type RepositoryExecutionContract } from "./runtimeRepositoryExecutionContract";
import type { RuntimeWorkspaceExecutionPolicyStatus } from "./runtimeWorkspaceExecutionPolicyFacade";

type GitHubSourceWorkspaceContext = {
  workspaceId: string;
  workspaceRoot?: string | null;
  gitRemoteUrl?: string | null;
};

type GitHubSourceLaunchRequestOptions = {
  repositoryExecutionContract?: RepositoryExecutionContract | null;
  preferredBackendIds?: string[] | null;
};

export type GovernedGitHubRunLaunchAck = {
  preparation: GovernedRuntimeRunLaunchAck["preparation"];
  response: GovernedRuntimeRunLaunchAck["response"];
  request: RuntimeRunPrepareV2Request;
  launch: GitHubSourceLaunchSummary;
};

export type GovernedGitHubLaunchPreflight = {
  state: "ready" | "blocked";
  reason: string | null;
};

function readOptionalText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function buildGitHubSourceAutonomyRequest(): RuntimeAutonomyRequestV2 {
  return {
    autonomyProfile: "supervised",
    wakePolicy: {
      mode: "hold",
      safeFollowUp: true,
      allowAutomaticContinuation: false,
      allowedActions: ["continue", "approve", "clarify", "reroute", "pair", "hold"],
      stopGates: [
        "github_source_requires_operator_review",
        "validation_failure_requires_review",
        "approval_or_permission_change_required",
      ],
    },
    sourceScope: "workspace_graph",
    researchPolicy: {
      mode: "repository_only",
      allowNetworkAnalysis: false,
      requireCitations: true,
      allowPrivateContextStage: false,
    },
    queueBudget: {
      maxQueuedActions: 0,
      maxAutoContinuations: 0,
    },
  };
}

function buildGitHubSourceMissionConstraints(input: {
  launch: GitHubSourceLaunchSummary;
}): string[] {
  const sourceLabel = summarizeGovernedGitHubLaunchSource(input.launch.taskSource);
  const constraints = [
    `Stay within the linked workspace and repository context for ${sourceLabel} unless an operator explicitly expands scope.`,
    "Keep continuation operator-supervised and do not auto-continue past review, approval, or validation gates.",
    "Cite repository evidence for findings, recommendations, and follow-up actions instead of relying on broad network research.",
  ];
  if (input.launch.taskSource.githubSource?.ref.triggerMode?.includes("comment_command")) {
    constraints.unshift(
      "Treat the linked GitHub comment command as the primary follow-up request and resolve it against repository evidence before broadening scope."
    );
  }
  return constraints;
}

export function evaluateGovernedGitHubLaunchPreflight(input: {
  policyStatus: RuntimeWorkspaceExecutionPolicyStatus;
  policyError?: string | null;
}): GovernedGitHubLaunchPreflight {
  switch (input.policyStatus) {
    case "idle":
    case "loading":
      return {
        state: "blocked",
        reason:
          "GitHub source launch is waiting for repository execution defaults to finish loading.",
      };
    case "error":
      return {
        state: "blocked",
        reason: `GitHub source launch is blocked until repository execution policy loads cleanly.${input.policyError ? ` ${input.policyError}` : ""}`,
      };
    default:
      return {
        state: "ready",
        reason: null,
      };
  }
}

export function assertGovernedGitHubLaunchReady(input: {
  policyStatus: RuntimeWorkspaceExecutionPolicyStatus;
  policyError?: string | null;
}) {
  const preflight = evaluateGovernedGitHubLaunchPreflight(input);
  if (preflight.state === "blocked") {
    throw new Error(preflight.reason ?? "GitHub source launch preflight blocked.");
  }
}

function buildGovernedGitHubLaunchRequest(input: {
  launch: GitHubSourceLaunchSummary;
  workspaceId: string;
  repositoryExecutionContract?: RepositoryExecutionContract | null;
  preferredBackendIds?: string[] | null;
}): RuntimeRunPrepareV2Request {
  const request = buildGovernedRuntimeRunRequest({
    workspaceId: input.workspaceId,
    source: {
      ...input.launch,
      autonomyRequest: buildGitHubSourceAutonomyRequest(),
      missionConstraints: buildGitHubSourceMissionConstraints({
        launch: input.launch,
      }),
    },
    repositoryExecutionContract: input.repositoryExecutionContract ?? null,
    explicitLaunchInput: {
      preferredBackendIds: input.preferredBackendIds ?? undefined,
    },
    fallbackExecutionProfileId: "balanced-delegate",
  });
  if (!request) {
    throw new Error("GitHub source launch requires a non-empty instruction.");
  }
  return request;
}

export function buildGovernedGitHubIssueLaunchRequest(input: {
  issue: Pick<GitHubIssue, "number" | "title" | "url" | "body" | "author" | "labels">;
  workspace: GitHubSourceWorkspaceContext;
  options?: GitHubSourceLaunchRequestOptions;
}) {
  const launch = normalizeGitHubIssueLaunchInput({
    issue: input.issue,
    workspaceId: input.workspace.workspaceId,
    workspaceRoot: input.workspace.workspaceRoot,
    gitRemoteUrl: input.workspace.gitRemoteUrl,
  });
  const request = buildGovernedGitHubLaunchRequest({
    launch,
    workspaceId: input.workspace.workspaceId,
    repositoryExecutionContract: input.options?.repositoryExecutionContract ?? null,
    preferredBackendIds: input.options?.preferredBackendIds,
  });
  return {
    launch,
    request,
  };
}

export function buildGovernedGitHubIssueCommentCommandLaunchRequest(input: {
  issue: Pick<GitHubIssue, "number" | "title" | "url" | "body" | "author" | "labels">;
  event: GitHubIssueCommentCommandLaunchInput["event"];
  command: GitHubIssueCommentCommandLaunchInput["command"];
  workspace: GitHubSourceWorkspaceContext;
  options?: GitHubSourceLaunchRequestOptions;
}) {
  const launch = normalizeGitHubIssueCommentCommandLaunchInput({
    issue: input.issue,
    event: input.event,
    command: input.command,
    workspaceId: input.workspace.workspaceId,
    workspaceRoot: input.workspace.workspaceRoot,
    gitRemoteUrl: input.workspace.gitRemoteUrl,
  });
  const request = buildGovernedGitHubLaunchRequest({
    launch,
    workspaceId: input.workspace.workspaceId,
    repositoryExecutionContract: input.options?.repositoryExecutionContract ?? null,
    preferredBackendIds: input.options?.preferredBackendIds,
  });
  return {
    launch,
    request,
  };
}

export function buildGovernedGitHubPullRequestLaunchRequest(input: {
  pullRequest: Pick<
    GitHubPullRequest,
    "number" | "title" | "url" | "body" | "headRefName" | "baseRefName" | "isDraft" | "author"
  >;
  diffs?: GitHubPullRequestDiff[] | null;
  comments?: GitHubPullRequestComment[] | null;
  workspace: GitHubSourceWorkspaceContext;
  options?: GitHubSourceLaunchRequestOptions;
}) {
  const launch = normalizeGitHubPullRequestFollowUpLaunchInput({
    pullRequest: input.pullRequest,
    diffs: input.diffs ?? null,
    comments: input.comments ?? null,
    workspaceId: input.workspace.workspaceId,
    workspaceRoot: input.workspace.workspaceRoot,
    gitRemoteUrl: input.workspace.gitRemoteUrl,
  });
  const request = buildGovernedGitHubLaunchRequest({
    launch,
    workspaceId: input.workspace.workspaceId,
    repositoryExecutionContract: input.options?.repositoryExecutionContract ?? null,
    preferredBackendIds: input.options?.preferredBackendIds,
  });
  return {
    launch,
    request,
  };
}

export function buildGovernedGitHubPullRequestReviewCommentLaunchRequest(input: {
  pullRequest: Pick<
    GitHubPullRequest,
    "number" | "title" | "url" | "body" | "headRefName" | "baseRefName" | "isDraft" | "author"
  >;
  diffs?: GitHubPullRequestDiff[] | null;
  comments?: GitHubPullRequestComment[] | null;
  event: GitHubPullRequestReviewCommentCommandLaunchInput["event"];
  command: GitHubPullRequestReviewCommentCommandLaunchInput["command"];
  workspace: GitHubSourceWorkspaceContext;
  options?: GitHubSourceLaunchRequestOptions;
}) {
  const launch = normalizeGitHubPullRequestReviewCommentCommandLaunchInput({
    pullRequest: input.pullRequest,
    diffs: input.diffs ?? null,
    comments: input.comments ?? null,
    event: input.event,
    command: input.command,
    workspaceId: input.workspace.workspaceId,
    workspaceRoot: input.workspace.workspaceRoot,
    gitRemoteUrl: input.workspace.gitRemoteUrl,
  });
  const request = buildGovernedGitHubLaunchRequest({
    launch,
    workspaceId: input.workspace.workspaceId,
    repositoryExecutionContract: input.options?.repositoryExecutionContract ?? null,
    preferredBackendIds: input.options?.preferredBackendIds,
  });
  return {
    launch,
    request,
  };
}

export async function launchGovernedGitHubRun(input: {
  request: RuntimeRunPrepareV2Request;
  launch: GitHubSourceLaunchSummary;
  onRefresh?: (() => void | Promise<void>) | null;
}): Promise<GovernedGitHubRunLaunchAck> {
  const launchAck = await launchGovernedRuntimeRun({
    request: input.request,
    onRefresh: input.onRefresh,
  });
  return {
    ...launchAck,
    launch: input.launch,
  };
}

export function summarizeGovernedGitHubLaunchSource(
  taskSource: AgentTaskSourceSummary | null | undefined
) {
  const label = readOptionalText(taskSource?.label) ?? "GitHub source";
  const reference = readOptionalText(taskSource?.reference);
  const repo = readOptionalText(taskSource?.repo?.fullName);
  if (reference && repo) {
    return `${label} · ${reference} · ${repo}`;
  }
  if (repo) {
    return `${label} · ${repo}`;
  }
  return label;
}
