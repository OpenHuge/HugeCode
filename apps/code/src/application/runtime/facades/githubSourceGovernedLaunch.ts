import type {
  AccessMode,
  AgentTaskMissionBrief,
  AgentTaskSourceSummary,
  HugeCodeExecutionProfile,
  RuntimeAutonomyRequestV2,
  RuntimeRunPrepareV2Request,
  RuntimeRunPrepareV2Response,
  RuntimeRunStartV2Response,
} from "@ku0/code-runtime-host-contract";
import type {
  GitHubIssue,
  GitHubPullRequest,
  GitHubPullRequestComment,
  GitHubPullRequestDiff,
} from "../../../types";
import { prepareRuntimeRunV2, startRuntimeRunV2 } from "../ports/tauriRuntimeJobs";
import {
  buildAgentTaskLaunchControls,
  buildAgentTaskMissionBrief,
} from "./runtimeMissionDraftFacade";
import { listRunExecutionProfiles } from "./runtimeMissionControlExecutionProfiles";
import {
  normalizeGitHubIssueLaunchInput,
  normalizeGitHubPullRequestFollowUpLaunchInput,
  type GitHubSourceLaunchSummary,
} from "./githubSourceLaunchNormalization";
import {
  resolveRepositoryExecutionDefaults,
  type RepositoryExecutionContract,
} from "./runtimeRepositoryExecutionContract";

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
  preparation: RuntimeRunPrepareV2Response;
  response: RuntimeRunStartV2Response;
  request: RuntimeRunPrepareV2Request;
  launch: GitHubSourceLaunchSummary;
};

function readOptionalText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeBackendIds(value: readonly string[] | null | undefined): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const entry of value) {
    const normalized = readOptionalText(entry);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    ids.push(normalized);
  }
  return ids.length > 0 ? ids : undefined;
}

function resolveExecutionProfile(profileId: string | null | undefined): HugeCodeExecutionProfile {
  const normalizedProfileId = readOptionalText(profileId);
  return (
    listRunExecutionProfiles().find((profile) => profile.id === normalizedProfileId) ??
    listRunExecutionProfiles().find((profile) => profile.id === "balanced-delegate") ??
    listRunExecutionProfiles()[0]
  );
}

function mapExecutionProfileModeToTaskMode(
  value: HugeCodeExecutionProfile["executionMode"]
): "single" | "distributed" {
  return value === "remote_sandbox" ? "distributed" : "single";
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

function buildGovernedGitHubMissionBrief(input: {
  launch: GitHubSourceLaunchSummary;
  accessMode: AccessMode | null;
  preferredBackendIds?: string[];
  requiredCapabilities?: string[] | null;
  maxSubtasks?: number | null;
}): AgentTaskMissionBrief {
  return buildAgentTaskMissionBrief({
    objective: input.launch.title,
    accessMode: input.accessMode,
    preferredBackendIds: input.preferredBackendIds,
    requiredCapabilities: input.requiredCapabilities ?? null,
    maxSubtasks: input.maxSubtasks ?? null,
    allowNetwork: false,
  });
}

function buildGovernedGitHubLaunchRequest(input: {
  launch: GitHubSourceLaunchSummary;
  workspaceId: string;
  repositoryExecutionContract?: RepositoryExecutionContract | null;
  preferredBackendIds?: string[] | null;
}): RuntimeRunPrepareV2Request {
  const resolvedDefaults = resolveRepositoryExecutionDefaults({
    contract: input.repositoryExecutionContract ?? null,
    taskSource: input.launch.taskSource,
    explicitLaunchInput: {
      preferredBackendIds: normalizeBackendIds(input.preferredBackendIds),
    },
  });
  const selectedExecutionProfile = resolveExecutionProfile(resolvedDefaults.executionProfileId);
  const accessMode = resolvedDefaults.accessMode ?? selectedExecutionProfile.accessMode;
  const preferredBackendIds = normalizeBackendIds(resolvedDefaults.preferredBackendIds);
  const launchControls = buildAgentTaskLaunchControls({
    objective: input.launch.title,
    accessMode,
    preferredBackendIds,
  });
  const missionBrief = buildGovernedGitHubMissionBrief({
    launch: input.launch,
    accessMode,
    preferredBackendIds,
    requiredCapabilities: launchControls.requiredCapabilities,
    maxSubtasks: launchControls.maxSubtasks,
  });

  return {
    workspaceId: input.workspaceId,
    title: input.launch.title,
    taskSource: input.launch.taskSource,
    executionProfileId: selectedExecutionProfile.id,
    ...(resolvedDefaults.reviewProfileId
      ? { reviewProfileId: resolvedDefaults.reviewProfileId }
      : {}),
    ...(resolvedDefaults.validationPresetId
      ? { validationPresetId: resolvedDefaults.validationPresetId }
      : {}),
    accessMode,
    executionMode: mapExecutionProfileModeToTaskMode(selectedExecutionProfile.executionMode),
    ...(launchControls.requiredCapabilities
      ? { requiredCapabilities: launchControls.requiredCapabilities }
      : {}),
    ...(preferredBackendIds ? { preferredBackendIds } : {}),
    missionBrief,
    autonomyRequest: buildGitHubSourceAutonomyRequest(),
    steps: [
      {
        kind: "read",
        input: input.launch.instruction,
      },
    ],
  };
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
    preferredBackendIds: input.options?.preferredBackendIds,
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
    preferredBackendIds: input.options?.preferredBackendIds,
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
  const preparation = await prepareRuntimeRunV2(input.request);
  const response = await startRuntimeRunV2(input.request);
  await input.onRefresh?.();
  return {
    preparation,
    response,
    request: input.request,
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
