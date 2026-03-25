// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useGitHubRuntimeTaskLaunchers } from "./useGitHubRuntimeTaskLaunchers";
import { useRuntimeWorkspaceExecutionPolicy } from "../../../application/runtime/facades/runtimeWorkspaceExecutionPolicyFacade";
import {
  buildGovernedGitHubIssueLaunchRequest,
  buildGovernedGitHubPullRequestLaunchRequest,
  launchGovernedGitHubRun,
} from "../../../application/runtime/facades/githubSourceGovernedLaunch";
import { pushErrorToast } from "../../../application/runtime/ports/toasts";
import { parseRepositoryExecutionContract } from "../../../application/runtime/facades/runtimeRepositoryExecutionContract";
import type { GitHubIssue, GitHubPullRequest } from "../../../types";

vi.mock("../../../application/runtime/facades/runtimeWorkspaceExecutionPolicyFacade", () => ({
  useRuntimeWorkspaceExecutionPolicy: vi.fn(),
}));

vi.mock("../../../application/runtime/facades/githubSourceGovernedLaunch", () => ({
  buildGovernedGitHubIssueLaunchRequest: vi.fn(),
  buildGovernedGitHubPullRequestLaunchRequest: vi.fn(),
  launchGovernedGitHubRun: vi.fn(),
}));

vi.mock("../../../application/runtime/ports/toasts", () => ({
  pushErrorToast: vi.fn(),
}));

describe("useGitHubRuntimeTaskLaunchers", () => {
  const refreshMissionControl = vi.fn(async () => undefined);
  const repositoryExecutionContract = parseRepositoryExecutionContract(
    JSON.stringify({
      version: 1,
      defaults: {
        executionProfileId: "balanced-delegate",
      },
      defaultReviewProfileId: null,
      sourceMappings: {},
      validationPresets: [],
      reviewProfiles: [],
    })
  );

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useRuntimeWorkspaceExecutionPolicy).mockReturnValue({
      repositoryExecutionContract,
      repositoryExecutionContractError: null,
    });
  });

  it("routes GitHub issue launches through the governed runtime launch path", async () => {
    const issue: GitHubIssue = {
      number: 42,
      title: "Unify issue launches",
      url: "https://github.com/ku0/hugecode/issues/42",
      updatedAt: "2026-03-25T00:00:00.000Z",
    };
    const launch = { taskSource: { kind: "github_issue" } };
    const request = { workspaceId: "ws-1", title: issue.title };
    vi.mocked(buildGovernedGitHubIssueLaunchRequest).mockReturnValue({
      launch,
      request,
    } as never);

    const { result } = renderHook(() =>
      useGitHubRuntimeTaskLaunchers({
        activeWorkspace: { id: "ws-1", path: "/workspace/hugecode", connected: true } as never,
        activeWorkspaceId: "ws-1",
        gitRemoteUrl: "https://github.com/ku0/hugecode.git",
        selectedRemoteBackendId: "backend-a",
        refreshMissionControl,
      })
    );

    await act(async () => {
      await result.current.handleStartTaskFromGitHubIssue(issue);
    });

    expect(buildGovernedGitHubIssueLaunchRequest).toHaveBeenCalledWith({
      issue,
      workspace: {
        workspaceId: "ws-1",
        workspaceRoot: "/workspace/hugecode",
        gitRemoteUrl: "https://github.com/ku0/hugecode.git",
      },
      options: {
        repositoryExecutionContract,
        preferredBackendIds: ["backend-a"],
      },
    });
    expect(launchGovernedGitHubRun).toHaveBeenCalledWith({
      launch,
      request,
      onRefresh: refreshMissionControl,
    });
  });

  it("routes GitHub PR follow-up launches through the governed runtime launch path", async () => {
    const pullRequest: GitHubPullRequest = {
      number: 7,
      title: "Unify PR follow-up launches",
      url: "https://github.com/ku0/hugecode/pull/7",
      updatedAt: "2026-03-25T00:00:00.000Z",
      createdAt: "2026-03-24T00:00:00.000Z",
      body: "",
      headRefName: "feature/unify-pr-launch",
      baseRefName: "main",
      isDraft: false,
      author: null,
    };
    const launch = { taskSource: { kind: "github_pr_followup" } };
    const request = { workspaceId: "ws-1", title: pullRequest.title };
    vi.mocked(buildGovernedGitHubPullRequestLaunchRequest).mockReturnValue({
      launch,
      request,
    } as never);

    const { result } = renderHook(() =>
      useGitHubRuntimeTaskLaunchers({
        activeWorkspace: { id: "ws-1", path: "/workspace/hugecode", connected: true } as never,
        activeWorkspaceId: "ws-1",
        gitRemoteUrl: "https://github.com/ku0/hugecode.git",
        selectedRemoteBackendId: null,
        refreshMissionControl,
      })
    );

    await act(async () => {
      await result.current.handleStartTaskFromGitHubPullRequest(pullRequest);
    });

    expect(buildGovernedGitHubPullRequestLaunchRequest).toHaveBeenCalledWith({
      pullRequest,
      workspace: {
        workspaceId: "ws-1",
        workspaceRoot: "/workspace/hugecode",
        gitRemoteUrl: "https://github.com/ku0/hugecode.git",
      },
      options: {
        repositoryExecutionContract,
        preferredBackendIds: undefined,
      },
    });
    expect(launchGovernedGitHubRun).toHaveBeenCalledWith({
      launch,
      request,
      onRefresh: refreshMissionControl,
    });
  });

  it("surfaces GitHub launch failures through shared toasts", async () => {
    const issue: GitHubIssue = {
      number: 9,
      title: "Show toast on failure",
      url: "https://github.com/ku0/hugecode/issues/9",
      updatedAt: "2026-03-25T00:00:00.000Z",
    };
    vi.mocked(buildGovernedGitHubIssueLaunchRequest).mockReturnValue({
      launch: { taskSource: { kind: "github_issue" } },
      request: { workspaceId: "ws-1", title: issue.title },
    } as never);
    vi.mocked(launchGovernedGitHubRun).mockRejectedValue(new Error("prepare failed"));

    const { result } = renderHook(() =>
      useGitHubRuntimeTaskLaunchers({
        activeWorkspace: { id: "ws-1", path: "/workspace/hugecode", connected: true } as never,
        activeWorkspaceId: "ws-1",
        gitRemoteUrl: "https://github.com/ku0/hugecode.git",
        selectedRemoteBackendId: null,
        refreshMissionControl,
      })
    );

    await act(async () => {
      await result.current.handleStartTaskFromGitHubIssue(issue);
    });

    expect(pushErrorToast).toHaveBeenCalledWith({
      title: "Couldn't start issue task",
      message: "prepare failed",
    });
  });
});
