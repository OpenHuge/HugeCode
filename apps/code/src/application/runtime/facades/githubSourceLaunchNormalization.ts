import type { AccessMode, AgentTaskMissionBrief } from "@ku0/code-runtime-host-contract";
import { buildAgentTaskMissionBrief } from "./runtimeMissionDraftFacade";
import { type RepositoryExecutionContract } from "./runtimeRepositoryExecutionContract";
import { resolveRepositoryExecutionDefaults } from "./runtimeRepositoryExecutionDefaults";
import {
  normalizeGitHubIssueSourceLaunchInput,
  normalizeGitHubPullRequestFollowUpSourceLaunchInput,
  type GitHubIssueSourceLaunchInput as RuntimeGitHubIssueSourceLaunchInput,
  type GitHubPullRequestFollowUpSourceLaunchInput as RuntimeGitHubPullRequestFollowUpSourceLaunchInput,
  type RuntimeNormalizedSourceLaunchSummary,
} from "./runtimeSourceLaunchNormalization";

export type GitHubSourceLaunchSummary = RuntimeNormalizedSourceLaunchSummary & {
  missionBrief: AgentTaskMissionBrief;
  executionProfileId: string | null;
  reviewProfileId: string | null;
  validationPresetId: string | null;
  accessMode: AccessMode | null;
  preferredBackendIds: string[] | null;
};

export type GitHubIssueSourceLaunchInput = RuntimeGitHubIssueSourceLaunchInput & {
  repositoryExecutionContract?: RepositoryExecutionContract | null;
};

export type GitHubPullRequestFollowUpSourceLaunchInput =
  RuntimeGitHubPullRequestFollowUpSourceLaunchInput & {
    repositoryExecutionContract?: RepositoryExecutionContract | null;
  };

function applyLaunchDefaults(input: {
  summary: RuntimeNormalizedSourceLaunchSummary;
  repositoryExecutionContract?: RepositoryExecutionContract | null;
  preferredBackendIds?: string[] | null;
}): GitHubSourceLaunchSummary {
  const launchDefaults = resolveRepositoryExecutionDefaults({
    contract: input.repositoryExecutionContract ?? null,
    taskSource: input.summary.taskSource,
    explicitLaunchInput: input.preferredBackendIds
      ? { preferredBackendIds: input.preferredBackendIds }
      : undefined,
  });
  const preferredBackendIds = launchDefaults.preferredBackendIds ?? null;

  return {
    ...input.summary,
    missionBrief: buildAgentTaskMissionBrief({
      objective: input.summary.title,
      accessMode: launchDefaults.accessMode,
      preferredBackendIds,
    }),
    executionProfileId: launchDefaults.executionProfileId,
    reviewProfileId: launchDefaults.reviewProfileId,
    validationPresetId: launchDefaults.validationPresetId,
    accessMode: launchDefaults.accessMode,
    preferredBackendIds,
  };
}

export function normalizeGitHubIssueLaunchInput(
  input: GitHubIssueSourceLaunchInput
): GitHubSourceLaunchSummary {
  return applyLaunchDefaults({
    summary: normalizeGitHubIssueSourceLaunchInput(input),
    repositoryExecutionContract: input.repositoryExecutionContract,
    preferredBackendIds: input.preferredBackendIds,
  });
}

export function normalizeGitHubPullRequestFollowUpLaunchInput(
  input: GitHubPullRequestFollowUpSourceLaunchInput
): GitHubSourceLaunchSummary {
  return applyLaunchDefaults({
    summary: normalizeGitHubPullRequestFollowUpSourceLaunchInput(input),
    repositoryExecutionContract: input.repositoryExecutionContract,
    preferredBackendIds: input.preferredBackendIds,
  });
}
