// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useGitHubRuntimeTaskLaunchers } from "./useGitHubRuntimeTaskLaunchers";
import { useRuntimeWorkspaceExecutionPolicy } from "../../../application/runtime/facades/runtimeWorkspaceExecutionPolicyFacade";
import {
  assertGovernedGitHubLaunchReady,
  buildGovernedGitHubIssueLaunchRequest,
  buildGovernedGitHubPullRequestLaunchRequest,
  launchGovernedGitHubRun,
} from "../../../application/runtime/facades/githubSourceGovernedLaunch";
import {
  buildGovernedGitHubIssueCommentCommandLaunchRequest,
  buildGovernedGitHubPullRequestReviewCommentLaunchRequest,
} from "../../../application/runtime/facades/githubCommentSourceGovernedLaunch";
import { pushErrorToast } from "../../../application/runtime/ports/toasts";
import { parseRepositoryExecutionContract } from "../../../application/runtime/facades/runtimeRepositoryExecutionContract";
import type { GitHubIssue, GitHubPullRequest, GitHubPullRequestComment } from "../../../types";

vi.mock("../../../application/runtime/facades/runtimeWorkspaceExecutionPolicyFacade", () => ({
  useRuntimeWorkspaceExecutionPolicy: vi.fn(),
}));

vi.mock("../../../application/runtime/facades/githubSourceGovernedLaunch", () => ({
  assertGovernedGitHubLaunchReady: vi.fn(),
  buildGovernedGitHubIssueLaunchRequest: vi.fn(),
  buildGovernedGitHubPullRequestLaunchRequest: vi.fn(),
  launchGovernedGitHubRun: vi.fn(),
}));

vi.mock("../../../application/runtime/facades/githubCommentSourceGovernedLaunch", () => ({
  buildGovernedGitHubIssueCommentCommandLaunchRequest: vi.fn(),
  buildGovernedGitHubPullRequestReviewCommentLaunchRequest: vi.fn(),
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
      repositoryExecutionContractStatus: "ready",
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
    expect(assertGovernedGitHubLaunchReady).toHaveBeenCalledWith({
      policyStatus: "ready",
      policyError: null,
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
    expect(assertGovernedGitHubLaunchReady).toHaveBeenCalledWith({
      policyStatus: "ready",
      policyError: null,
    });
  });

  it("routes GitHub issue comment-command launches through the governed runtime launch path", async () => {
    const issue: GitHubIssue = {
      number: 13,
      title: "Issue comment command",
      url: "https://github.com/ku0/hugecode/issues/13",
      updatedAt: "2026-03-25T00:00:00.000Z",
    };
    const comment: GitHubPullRequestComment = {
      id: 1301,
      body: "@hugecode continue",
      createdAt: "2026-03-25T00:00:00.000Z",
      url: "https://github.com/ku0/hugecode/issues/13#issuecomment-1301",
      author: { login: "reviewer" },
    };
    const launch = { taskSource: { kind: "github_issue" } };
    const request = { workspaceId: "ws-1", title: issue.title };
    vi.mocked(buildGovernedGitHubIssueCommentCommandLaunchRequest).mockReturnValue({
      launch,
      request,
    } as never);

    const { result } = renderHook(() =>
      useGitHubRuntimeTaskLaunchers({
        activeWorkspace: { id: "ws-1", path: "/workspace/hugecode", connected: true } as never,
        activeWorkspaceId: "ws-1",
        gitRemoteUrl: "https://github.com/ku0/hugecode.git",
        selectedRemoteBackendId: "backend-b",
        refreshMissionControl,
      })
    );

    await act(async () => {
      await result.current.handleStartTaskFromGitHubIssueCommentCommand({
        issue,
        event: {
          eventName: "issue_comment",
          action: "created",
        },
        command: {
          triggerMode: "issue_comment_command",
          commandKind: "continue",
          comment,
        },
      });
    });

    expect(buildGovernedGitHubIssueCommentCommandLaunchRequest).toHaveBeenCalledWith({
      issue,
      event: {
        eventName: "issue_comment",
        action: "created",
      },
      command: {
        triggerMode: "issue_comment_command",
        commandKind: "continue",
        comment,
      },
      workspace: {
        workspaceId: "ws-1",
        workspaceRoot: "/workspace/hugecode",
        gitRemoteUrl: "https://github.com/ku0/hugecode.git",
      },
      options: {
        repositoryExecutionContract,
        preferredBackendIds: ["backend-b"],
      },
    });
    expect(launchGovernedGitHubRun).toHaveBeenCalledWith({
      launch,
      request,
      onRefresh: refreshMissionControl,
    });
  });

  it("surfaces PR review-comment prepare failures through shared toasts", async () => {
    const pullRequest: GitHubPullRequest = {
      number: 14,
      title: "Review comment failure",
      url: "https://github.com/ku0/hugecode/pull/14",
      updatedAt: "2026-03-25T00:00:00.000Z",
      createdAt: "2026-03-24T00:00:00.000Z",
      body: "",
      headRefName: "feature/review-comment-failure",
      baseRefName: "main",
      isDraft: false,
      author: null,
    };
    vi.mocked(buildGovernedGitHubPullRequestReviewCommentLaunchRequest).mockImplementation(() => {
      throw new Error("review-comment prepare failed");
    });

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
      await result.current.handleStartTaskFromGitHubPullRequestReviewCommentCommand({
        pullRequest,
        event: {
          eventName: "pull_request_review_comment",
          action: "created",
        },
        command: {
          triggerMode: "pull_request_review_comment_command",
        },
      });
    });

    expect(pushErrorToast).toHaveBeenCalledWith({
      title: "Couldn't start review-comment follow-up task",
      message: "review-comment prepare failed",
    });
    expect(launchGovernedGitHubRun).not.toHaveBeenCalled();
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

  it("fails fast while repository execution defaults are still loading", async () => {
    const issue: GitHubIssue = {
      number: 10,
      title: "Block until policy loads",
      url: "https://github.com/ku0/hugecode/issues/10",
      updatedAt: "2026-03-25T00:00:00.000Z",
    };
    vi.mocked(useRuntimeWorkspaceExecutionPolicy).mockReturnValue({
      repositoryExecutionContract,
      repositoryExecutionContractError: null,
      repositoryExecutionContractStatus: "loading",
    });
    vi.mocked(assertGovernedGitHubLaunchReady).mockImplementation(() => {
      throw new Error(
        "GitHub source launch is waiting for repository execution defaults to finish loading."
      );
    });

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

    expect(buildGovernedGitHubIssueLaunchRequest).not.toHaveBeenCalled();
    expect(launchGovernedGitHubRun).not.toHaveBeenCalled();
    expect(pushErrorToast).toHaveBeenCalledWith({
      title: "Couldn't start issue task",
      message:
        "GitHub source launch is waiting for repository execution defaults to finish loading.",
    });
  });

  it("fails fast when repository execution policy is unavailable", async () => {
    const pullRequest: GitHubPullRequest = {
      number: 11,
      title: "Block on policy error",
      url: "https://github.com/ku0/hugecode/pull/11",
      updatedAt: "2026-03-25T00:00:00.000Z",
      createdAt: "2026-03-24T00:00:00.000Z",
      body: "",
      headRefName: "feature/block-policy-error",
      baseRefName: "main",
      isDraft: false,
      author: null,
    };
    vi.mocked(useRuntimeWorkspaceExecutionPolicy).mockReturnValue({
      repositoryExecutionContract,
      repositoryExecutionContractError: "contract parse failed",
      repositoryExecutionContractStatus: "error",
    });
    vi.mocked(assertGovernedGitHubLaunchReady).mockImplementation(() => {
      throw new Error(
        "GitHub source launch is blocked until repository execution policy loads cleanly. contract parse failed"
      );
    });

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

    expect(buildGovernedGitHubPullRequestLaunchRequest).not.toHaveBeenCalled();
    expect(launchGovernedGitHubRun).not.toHaveBeenCalled();
    expect(pushErrorToast).toHaveBeenCalledWith({
      title: "Couldn't start PR follow-up task",
      message:
        "GitHub source launch is blocked until repository execution policy loads cleanly. contract parse failed",
    });
  });
});
