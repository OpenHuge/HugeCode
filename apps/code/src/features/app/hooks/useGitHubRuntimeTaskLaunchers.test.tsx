// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useGitHubRuntimeTaskLaunchers } from "./useGitHubRuntimeTaskLaunchers";
import { useRuntimeWorkspaceExecutionPolicy } from "../../../application/runtime/facades/runtimeWorkspaceExecutionPolicyFacade";
import {
  assertGovernedGitHubLaunchReady,
  buildGovernedGitHubIssueLaunchRequest,
  buildGovernedGitHubPullRequestLaunchRequest,
  evaluateGovernedGitHubLaunchPreflight,
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
  evaluateGovernedGitHubLaunchPreflight: vi.fn(),
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
    vi.mocked(evaluateGovernedGitHubLaunchPreflight).mockReturnValue({
      state: "ready",
      reason: null,
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

  it("builds governed follow-up previews for issue and PR sources", () => {
    const issue: GitHubIssue = {
      number: 19,
      title: "Preview governed issue follow-up",
      url: "https://github.com/ku0/hugecode/issues/19",
      updatedAt: "2026-03-25T00:00:00.000Z",
      body: "Keep issue follow-up grounded in repository evidence.",
    };
    const pullRequest: GitHubPullRequest = {
      number: 27,
      title: "Preview governed PR follow-up",
      url: "https://github.com/ku0/hugecode/pull/27",
      updatedAt: "2026-03-25T00:00:00.000Z",
      createdAt: "2026-03-24T00:00:00.000Z",
      body: "Show backend preference before launch.",
      headRefName: "feature/governed-preview",
      baseRefName: "main",
      isDraft: false,
      author: { login: "octocat" },
    };

    vi.mocked(buildGovernedGitHubIssueLaunchRequest).mockReturnValue({
      launch: {
        title: issue.title,
        instruction: "Issue instruction",
        taskSource: {
          kind: "github_issue",
          label: "GitHub issue #19",
          shortLabel: "Issue #19",
          title: issue.title,
          reference: "#19",
          url: issue.url,
          issueNumber: 19,
          externalId: issue.url,
          canonicalUrl: issue.url,
          sourceTaskId: issue.url,
          sourceRunId: issue.url,
          repo: {
            owner: "ku0",
            name: "hugecode",
            fullName: "ku0/hugecode",
            remoteUrl: "https://github.com/ku0/hugecode.git",
          },
          githubSource: null,
        },
      },
      request: {
        workspaceId: "ws-1",
        title: issue.title,
        executionProfileId: "autonomous-delegate",
        accessMode: "full-access",
        executionMode: "distributed",
        preferredBackendIds: ["backend-a"],
        missionBrief: {
          objective: issue.title,
          summary: issue.title,
          constraints: [],
        },
        steps: [{ kind: "read", input: "Issue instruction" }],
      },
    } as never);
    vi.mocked(buildGovernedGitHubPullRequestLaunchRequest).mockReturnValue({
      launch: {
        title: pullRequest.title,
        instruction: "PR instruction",
        taskSource: {
          kind: "github_pr_followup",
          label: "GitHub PR follow-up #27",
          shortLabel: "PR #27 follow-up",
          title: pullRequest.title,
          reference: "#27",
          url: pullRequest.url,
          pullRequestNumber: 27,
          externalId: pullRequest.url,
          canonicalUrl: pullRequest.url,
          sourceTaskId: pullRequest.url,
          sourceRunId: pullRequest.url,
          repo: {
            owner: "ku0",
            name: "hugecode",
            fullName: "ku0/hugecode",
            remoteUrl: "https://github.com/ku0/hugecode.git",
          },
          githubSource: null,
        },
      },
      request: {
        workspaceId: "ws-1",
        title: pullRequest.title,
        executionProfileId: "operator-review",
        accessMode: "read-only",
        executionMode: "single",
        preferredBackendIds: [],
        missionBrief: {
          objective: pullRequest.title,
          summary: pullRequest.title,
          constraints: [],
        },
        steps: [{ kind: "read", input: "PR instruction" }],
      },
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

    expect(result.current.getGitHubIssueFollowUpPreview(issue)).toEqual(
      expect.objectContaining({
        state: "ready",
        title: "Issue follow-up preview",
        fields: expect.arrayContaining([
          expect.objectContaining({
            id: "backend",
            value: "backend-a",
          }),
          expect.objectContaining({
            id: "source",
            value: expect.stringContaining("GitHub issue #19"),
          }),
        ]),
      })
    );
    expect(result.current.getGitHubPullRequestFollowUpPreview(pullRequest)).toEqual(
      expect.objectContaining({
        state: "ready",
        title: "PR follow-up preview",
        fields: expect.arrayContaining([
          expect.objectContaining({
            id: "launch",
            value: "operator-review",
          }),
          expect.objectContaining({
            id: "backend",
            value: "backend-a",
          }),
        ]),
      })
    );
  });

  it("retains the operator-selected backend in blocked follow-up previews", () => {
    const issue: GitHubIssue = {
      number: 28,
      title: "Blocked preview keeps backend selection",
      url: "https://github.com/ku0/hugecode/issues/28",
      updatedAt: "2026-03-25T00:00:00.000Z",
    };
    vi.mocked(evaluateGovernedGitHubLaunchPreflight).mockReturnValue({
      state: "blocked",
      reason: "Runtime approvals are still resolving.",
    });

    const { result } = renderHook(() =>
      useGitHubRuntimeTaskLaunchers({
        activeWorkspace: { id: "ws-1", path: "/workspace/hugecode", connected: true } as never,
        activeWorkspaceId: "ws-1",
        gitRemoteUrl: "https://github.com/ku0/hugecode.git",
        selectedRemoteBackendId: "backend-a",
        refreshMissionControl,
      })
    );

    expect(result.current.getGitHubIssueFollowUpPreview(issue)).toEqual(
      expect.objectContaining({
        state: "blocked",
        blockedReason: "Runtime approvals are still resolving.",
        fields: expect.arrayContaining([
          expect.objectContaining({
            id: "backend",
            value: "backend-a",
            detail: "Selected in operator controls.",
          }),
        ]),
      })
    );
  });

  it("builds governed follow-up previews for issue-comment and review-comment sources", () => {
    const issue: GitHubIssue = {
      number: 33,
      title: "Issue comment preview",
      url: "https://github.com/ku0/hugecode/issues/33",
      updatedAt: "2026-03-25T00:00:00.000Z",
      body: "Carry comment context into the operator preview.",
    };
    const pullRequest: GitHubPullRequest = {
      number: 34,
      title: "Review comment preview",
      url: "https://github.com/ku0/hugecode/pull/34",
      updatedAt: "2026-03-25T00:00:00.000Z",
      createdAt: "2026-03-24T00:00:00.000Z",
      body: "Show review-comment evidence before launch.",
      headRefName: "feature/review-comment-preview",
      baseRefName: "main",
      isDraft: false,
      author: { login: "octocat" },
    };

    vi.mocked(buildGovernedGitHubIssueCommentCommandLaunchRequest).mockReturnValue({
      launch: {
        title: issue.title,
        instruction: "Issue comment instruction",
        taskSource: {
          kind: "github_issue",
          label: "GitHub issue #33",
          shortLabel: "Issue #33",
          title: issue.title,
          reference: "#33",
          url: issue.url,
          issueNumber: 33,
          externalId: issue.url,
          canonicalUrl: issue.url,
          sourceTaskId: issue.url,
          sourceRunId: issue.url,
          repo: {
            owner: "ku0",
            name: "hugecode",
            fullName: "ku0/hugecode",
            remoteUrl: "https://github.com/ku0/hugecode.git",
          },
          githubSource: {
            sourceRecordId: "source-33",
            repo: {
              owner: "ku0",
              name: "hugecode",
              fullName: "ku0/hugecode",
              remoteUrl: "https://github.com/ku0/hugecode.git",
            },
            event: {
              eventName: "issue_comment",
              action: "created",
            },
            ref: {
              label: "Issue #33",
              issueNumber: 33,
              triggerMode: "issue_comment_command",
            },
            comment: {
              commentId: 3301,
              author: { login: "reviewer" },
            },
            launchHandshake: {
              state: "prepared",
              summary:
                "Governed GitHub issue follow-up prepared from the linked issue comment command.",
            },
          },
        },
      },
      request: {
        workspaceId: "ws-1",
        title: issue.title,
        executionProfileId: "autonomous-delegate",
        accessMode: "full-access",
        executionMode: "distributed",
        preferredBackendIds: ["backend-b"],
        missionBrief: {
          objective: issue.title,
          summary: issue.title,
          constraints: [],
        },
        steps: [{ kind: "read", input: "Issue comment instruction" }],
      },
    } as never);
    vi.mocked(buildGovernedGitHubPullRequestReviewCommentLaunchRequest).mockReturnValue({
      launch: {
        title: pullRequest.title,
        instruction: "Review comment instruction",
        taskSource: {
          kind: "github_pr_followup",
          label: "GitHub PR follow-up #34",
          shortLabel: "PR #34 follow-up",
          title: pullRequest.title,
          reference: "#34",
          url: pullRequest.url,
          pullRequestNumber: 34,
          externalId: pullRequest.url,
          canonicalUrl: pullRequest.url,
          sourceTaskId: pullRequest.url,
          sourceRunId: pullRequest.url,
          repo: {
            owner: "ku0",
            name: "hugecode",
            fullName: "ku0/hugecode",
            remoteUrl: "https://github.com/ku0/hugecode.git",
          },
          githubSource: {
            sourceRecordId: "source-34",
            repo: {
              owner: "ku0",
              name: "hugecode",
              fullName: "ku0/hugecode",
              remoteUrl: "https://github.com/ku0/hugecode.git",
            },
            event: {
              eventName: "pull_request_review_comment",
              action: "created",
            },
            ref: {
              label: "PR #34",
              pullRequestNumber: 34,
              triggerMode: "pull_request_review_comment_command",
            },
            comment: {
              commentId: 3401,
              author: { login: "reviewer" },
            },
            launchHandshake: {
              state: "prepared",
              summary:
                "Governed GitHub PR follow-up prepared from the linked review comment command.",
            },
          },
        },
      },
      request: {
        workspaceId: "ws-1",
        title: pullRequest.title,
        executionProfileId: "operator-review",
        accessMode: "read-only",
        executionMode: "single",
        preferredBackendIds: ["backend-b"],
        missionBrief: {
          objective: pullRequest.title,
          summary: pullRequest.title,
          constraints: [],
        },
        steps: [{ kind: "read", input: "Review comment instruction" }],
      },
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

    expect(
      result.current.getGitHubIssueCommentCommandFollowUpPreview({
        issue,
        event: {
          eventName: "issue_comment",
          action: "created",
        },
        command: {
          triggerMode: "issue_comment_command",
          comment: {
            commentId: 3301,
            body: "@hugecode continue",
            author: { login: "reviewer" },
          },
        },
      })
    ).toEqual(
      expect.objectContaining({
        state: "ready",
        title: "Issue comment follow-up preview",
        fields: expect.arrayContaining([
          expect.objectContaining({
            id: "source",
            value: "ku0/hugecode · Issue #33 · issue_comment.created",
          }),
        ]),
      })
    );
    expect(
      result.current.getGitHubPullRequestReviewCommentCommandFollowUpPreview({
        pullRequest,
        event: {
          eventName: "pull_request_review_comment",
          action: "created",
        },
        command: {
          triggerMode: "pull_request_review_comment_command",
          comment: {
            commentId: 3401,
            body: "Please tighten the runtime boundary.",
            author: { login: "reviewer" },
          },
        },
      })
    ).toEqual(
      expect.objectContaining({
        state: "ready",
        title: "Review comment follow-up preview",
        fields: expect.arrayContaining([
          expect.objectContaining({
            id: "backend",
            value: "backend-b",
          }),
          expect.objectContaining({
            id: "source",
            detail: expect.stringContaining("Please tighten the runtime boundary."),
          }),
        ]),
      })
    );
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
