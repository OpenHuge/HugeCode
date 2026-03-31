import type { RuntimeRunPrepareV2Request } from "@ku0/code-runtime-host-contract";
import type { GitHubIssue } from "../../../types";
import { getGitHubIssueDetails, getGitRemote } from "../ports/tauriGit";
import type { RepositoryExecutionContract } from "./runtimeRepositoryExecutionContract";
import {
  buildGovernedGitHubLaunchRequestFromSummary,
  type GitHubSourceLaunchRequestOptions,
} from "./githubSourceGovernedLaunch";
import {
  buildGitHubIssueEvidenceDetail,
  buildGitHubIssueInstruction,
  readOptionalText,
} from "./githubSourceLaunchInstructionShared";
import {
  type GovernedGitHubFollowUpPreview,
  type GovernedGitHubFollowUpPreviewField,
} from "./githubSourceLaunchPreview";
import type { GitHubSourceLaunchSummary } from "./githubSourceLaunchNormalization";
import { buildGitHubIssueTaskSource, resolveRepoContext } from "./runtimeTaskSourceFacade";

export type GitHubIssueUriTaskIntent = {
  issueUri: string;
  issue: GitHubIssue;
  launch: GitHubSourceLaunchSummary;
  request: RuntimeRunPrepareV2Request;
  preview: GovernedGitHubFollowUpPreview;
};

type ResolveGitHubIssueUriTaskIntentInput = {
  workspaceId: string;
  issueUri: string;
  repositoryExecutionContract?: RepositoryExecutionContract | null;
  preferredBackendIds?: string[] | null;
};

type ParsedGitHubIssueUri = {
  canonicalUrl: string;
  issueNumber: number;
};

function assertResolvedIssueMatchesRequestedUri(input: {
  canonicalIssueUri: string;
  issue: GitHubIssue;
}) {
  const resolvedIssueUrl = readOptionalText(input.issue.url);
  if (!resolvedIssueUrl) {
    throw new Error(
      `GitHub issue ${input.canonicalIssueUri} did not include a canonical issue URL in the active workspace bridge response.`
    );
  }
  if (resolvedIssueUrl !== input.canonicalIssueUri) {
    throw new Error(
      `GitHub issue URI ${input.canonicalIssueUri} resolved to ${resolvedIssueUrl} through the active workspace bridge.`
    );
  }
}

function parseGitHubIssueUri(issueUri: string): ParsedGitHubIssueUri {
  const normalizedIssueUri = readOptionalText(issueUri);
  if (!normalizedIssueUri) {
    throw new Error("Enter a valid GitHub issue URI before starting Autonomous Issue Drive.");
  }

  let url: URL;
  try {
    url = new URL(normalizedIssueUri);
  } catch {
    throw new Error("Enter a valid GitHub issue URI before starting Autonomous Issue Drive.");
  }

  if (url.hostname !== "github.com" && url.hostname !== "www.github.com") {
    throw new Error("Autonomous Issue Drive currently accepts only github.com issue URIs.");
  }

  const pathMatch = /^\/([^/]+)\/([^/]+)\/issues\/(\d+)(?:\/)?$/u.exec(url.pathname);
  if (!pathMatch) {
    throw new Error("Enter a valid GitHub issue URI before starting Autonomous Issue Drive.");
  }

  const issueNumber = Number.parseInt(pathMatch[3] ?? "", 10);
  if (!Number.isFinite(issueNumber) || issueNumber <= 0) {
    throw new Error("Enter a valid GitHub issue URI before starting Autonomous Issue Drive.");
  }

  return {
    canonicalUrl: `https://github.com/${pathMatch[1]}/${pathMatch[2]}/issues/${issueNumber}`,
    issueNumber,
  };
}

function buildGitHubIssueDriveInstruction(issue: GitHubIssue): string {
  return [
    buildGitHubIssueInstruction({
      issue,
      heading: `Autonomous issue drive #${issue.number}: ${issue.title}`,
    }),
    "",
    "Autonomous issue-drive workflow:",
    "1. Create a local execution plan grounded in the linked issue and current repository state.",
    "2. Implement the plan through the runtime operator path, including multi-file edits when the repo requires them.",
    "3. Run the narrowest validation that proves the change and record any remaining operator-facing risk.",
    "4. Stage the resulting changes with git for operator review, but do not push or open a PR automatically.",
  ].join("\n");
}

function assertWorkspaceRepoMatchesIssue(input: { issueUri: string; gitRemoteUrl: string | null }) {
  const issueRepo = resolveRepoContext({
    sourceUrl: input.issueUri,
  })?.fullName;
  const workspaceRepo = resolveRepoContext({
    gitRemoteUrl: input.gitRemoteUrl,
  })?.fullName;

  if (issueRepo && workspaceRepo && issueRepo !== workspaceRepo) {
    throw new Error(
      `Issue URI repository ${issueRepo} does not match the active workspace repository ${workspaceRepo}.`
    );
  }
}

function buildGitHubIssueDriveLaunch(input: {
  issue: GitHubIssue;
  workspaceId: string;
  gitRemoteUrl: string | null;
}): GitHubSourceLaunchSummary {
  return {
    title: readOptionalText(input.issue.title) ?? `GitHub issue #${input.issue.number}`,
    instruction: buildGitHubIssueDriveInstruction(input.issue),
    taskSource: buildGitHubIssueTaskSource({
      issue: input.issue,
      workspaceId: input.workspaceId,
      gitRemoteUrl: input.gitRemoteUrl,
    }),
  };
}

function buildLaunchField(request: RuntimeRunPrepareV2Request): GovernedGitHubFollowUpPreviewField {
  const validationPresetId = readOptionalText(request.validationPresetId);
  const detailParts = [
    readOptionalText(request.accessMode),
    readOptionalText(request.executionMode),
    validationPresetId ? `validation ${validationPresetId}` : null,
  ].filter((value): value is string => Boolean(value));

  return {
    id: "launch",
    label: "Launch",
    value: readOptionalText(request.executionProfileId) ?? "Governed runtime launch",
    detail: detailParts.length > 0 ? detailParts.join(" · ") : null,
  };
}

function buildBackendField(input: {
  request: RuntimeRunPrepareV2Request;
  preferredBackendIds?: readonly string[] | null;
}): GovernedGitHubFollowUpPreviewField {
  const backendIds = input.preferredBackendIds ?? input.request.preferredBackendIds ?? [];
  if (backendIds.length > 0) {
    return {
      id: "backend",
      label: "Backend preference",
      value: backendIds.join(", "),
      detail: "Selected in operator controls.",
    };
  }

  const defaultBackendId = readOptionalText(input.request.defaultBackendId);
  if (defaultBackendId) {
    return {
      id: "backend",
      label: "Backend preference",
      value: defaultBackendId,
      detail: "Using the configured default backend route.",
    };
  }

  return {
    id: "backend",
    label: "Backend preference",
    value: "Runtime default route",
    detail: "Runtime will resolve the route at launch.",
  };
}

function buildSourceField(input: {
  issue: GitHubIssue;
  launch: GitHubSourceLaunchSummary;
}): GovernedGitHubFollowUpPreviewField {
  const repoFullName = readOptionalText(input.launch.taskSource.repo?.fullName);
  return {
    id: "source",
    label: "Source evidence",
    value: repoFullName
      ? `GitHub issue #${input.issue.number} · ${repoFullName}`
      : `GitHub issue #${input.issue.number}`,
    detail: buildGitHubIssueEvidenceDetail({
      issue: input.issue,
    }),
  };
}

function buildGitHubIssueDrivePreview(input: {
  issue: GitHubIssue;
  launch: GitHubSourceLaunchSummary;
  request: RuntimeRunPrepareV2Request;
  preferredBackendIds?: readonly string[] | null;
}): GovernedGitHubFollowUpPreview {
  const sourceLabel = readOptionalText(input.launch.taskSource.label) ?? "GitHub issue";
  return {
    title: "Issue follow-up preview",
    state: "ready",
    summary: `${sourceLabel} is ready on the governed runtime path.`,
    blockedReason: null,
    fields: [
      buildLaunchField(input.request),
      buildBackendField({
        request: input.request,
        preferredBackendIds: input.preferredBackendIds,
      }),
      buildSourceField({
        issue: input.issue,
        launch: input.launch,
      }),
    ],
  };
}

export async function resolveGitHubIssueUriTaskIntent(
  input: ResolveGitHubIssueUriTaskIntentInput
): Promise<GitHubIssueUriTaskIntent> {
  const parsedIssueUri = parseGitHubIssueUri(input.issueUri);
  const gitRemoteUrl = await getGitRemote(input.workspaceId);
  assertWorkspaceRepoMatchesIssue({
    issueUri: parsedIssueUri.canonicalUrl,
    gitRemoteUrl,
  });

  const issue = await getGitHubIssueDetails(input.workspaceId, parsedIssueUri.issueNumber);
  if (!issue) {
    throw new Error(
      `GitHub issue #${parsedIssueUri.issueNumber} is not available through the active workspace bridge.`
    );
  }
  assertResolvedIssueMatchesRequestedUri({
    canonicalIssueUri: parsedIssueUri.canonicalUrl,
    issue,
  });

  const launch = buildGitHubIssueDriveLaunch({
    issue,
    workspaceId: input.workspaceId,
    gitRemoteUrl,
  });
  const options: GitHubSourceLaunchRequestOptions = {
    repositoryExecutionContract: input.repositoryExecutionContract ?? null,
    preferredBackendIds: input.preferredBackendIds ?? null,
  };
  const { request } = buildGovernedGitHubLaunchRequestFromSummary({
    launch,
    workspace: {
      workspaceId: input.workspaceId,
      gitRemoteUrl,
    },
    options,
  });

  return {
    issueUri: parsedIssueUri.canonicalUrl,
    issue,
    launch,
    request,
    preview: buildGitHubIssueDrivePreview({
      issue,
      launch,
      request,
      preferredBackendIds: input.preferredBackendIds ?? null,
    }),
  };
}
