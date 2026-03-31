import { describe, expect, it } from "vitest";
import {
  applyGitHubLaunchHandshakeToTaskSource,
  buildGitHubIssueTaskSource,
  buildGitHubPullRequestFollowUpTaskSource,
  buildScheduleTaskSource,
  resolveRepoContext,
} from "./runtimeTaskSourceFacade";

describe("runtimeTaskSourceFacade", () => {
  it("normalizes GitHub issue URLs to canonical repository URLs when no git remote is loaded", () => {
    expect(
      resolveRepoContext({
        sourceUrl: "https://github.com/acme/hugecode/issues/42",
      })
    ).toEqual({
      owner: "acme",
      name: "hugecode",
      fullName: "acme/hugecode",
      remoteUrl: "https://github.com/acme/hugecode",
    });
  });

  it("prefers the workspace git remote when it is available", () => {
    expect(
      resolveRepoContext({
        sourceUrl: "https://github.com/acme/hugecode/pull/17",
        gitRemoteUrl: "https://github.com/acme/hugecode.git",
      })
    ).toEqual({
      owner: "acme",
      name: "hugecode",
      fullName: "acme/hugecode",
      remoteUrl: "https://github.com/acme/hugecode.git",
    });
  });

  it("keeps SSH remotes while still resolving canonical repo identity", () => {
    expect(
      resolveRepoContext({
        sourceUrl: "https://github.com/acme/hugecode/issues/42",
        gitRemoteUrl: "git@github.com:acme/hugecode.git",
      })
    ).toEqual({
      owner: "acme",
      name: "hugecode",
      fullName: "acme/hugecode",
      remoteUrl: "git@github.com:acme/hugecode.git",
    });
  });

  it("parses SSH remotes even without a source URL fallback", () => {
    expect(
      resolveRepoContext({
        gitRemoteUrl: "git@github.com:acme/hugecode.git",
      })
    ).toEqual({
      owner: "acme",
      name: "hugecode",
      fullName: "acme/hugecode",
      remoteUrl: "git@github.com:acme/hugecode.git",
    });
  });

  it("builds GitHub issue task sources with stable provenance fields", () => {
    expect(
      buildGitHubIssueTaskSource({
        issue: {
          number: 42,
          title: "Unify ingress",
          url: "https://github.com/acme/hugecode/issues/42",
          updatedAt: "2026-03-27T00:00:00.000Z",
        },
        workspaceId: "ws-1",
        workspaceRoot: "/workspace/hugecode",
        gitRemoteUrl: "https://github.com/acme/hugecode.git",
        sourceTaskId: "issue-42",
      })
    ).toEqual(
      expect.objectContaining({
        kind: "github_issue",
        label: "GitHub issue #42",
        shortLabel: "Issue #42",
        externalId: "https://github.com/acme/hugecode/issues/42",
        canonicalUrl: "https://github.com/acme/hugecode/issues/42",
        sourceTaskId: "issue-42",
        sourceRunId: "https://github.com/acme/hugecode/issues/42",
        workspaceId: "ws-1",
        workspaceRoot: "/workspace/hugecode",
      })
    );
  });

  it("attaches GitHub comment-command provenance to issue and PR follow-up task sources", () => {
    const issueSource = buildGitHubIssueTaskSource({
      issue: {
        number: 12,
        title: "Anchor governed issue follow-up",
        url: "https://github.com/acme/hugecode/issues/12",
        updatedAt: "2026-03-27T00:00:00.000Z",
      },
      gitRemoteUrl: "https://github.com/acme/hugecode.git",
      githubSource: {
        sourceRecordId: "source-12",
        event: {
          eventName: "issue_comment",
          action: "created",
          deliveryId: "delivery-12",
        },
        triggerMode: "issue_comment_command",
        commandKind: "continue",
        comment: {
          commentId: 1201,
          url: "https://github.com/acme/hugecode/issues/12#issuecomment-1201",
          body: "@hugecode continue with the repo-linked fix.",
          author: { login: "reviewer" },
        },
      },
    });

    const pullRequestSource = buildGitHubPullRequestFollowUpTaskSource({
      pullRequest: {
        number: 18,
        title: "Carry review-comment provenance",
        url: "https://github.com/acme/hugecode/pull/18",
        updatedAt: "2026-03-27T00:00:00.000Z",
        createdAt: "2026-03-26T00:00:00.000Z",
        body: "",
        headRefName: "feature/review-context",
        baseRefName: "main",
        isDraft: false,
        author: null,
      },
      gitRemoteUrl: "https://github.com/acme/hugecode.git",
      githubSource: {
        sourceRecordId: "source-18",
        event: {
          eventName: "pull_request_review_comment",
          action: "created",
        },
        triggerMode: "pull_request_review_comment_command",
        commandKind: "run",
        headSha: "abc123def",
        comment: {
          commentId: 1801,
          author: { login: "maintainer" },
        },
      },
    });

    expect(issueSource.githubSource).toEqual(
      expect.objectContaining({
        sourceRecordId: "source-12",
        event: expect.objectContaining({
          eventName: "issue_comment",
          action: "created",
          deliveryId: "delivery-12",
        }),
        ref: expect.objectContaining({
          label: "Issue #12",
          issueNumber: 12,
          triggerMode: "issue_comment_command",
          commandKind: "continue",
        }),
        comment: expect.objectContaining({
          commentId: 1201,
          url: "https://github.com/acme/hugecode/issues/12#issuecomment-1201",
          author: { login: "reviewer" },
        }),
        launchHandshake: expect.objectContaining({
          state: "prepared",
        }),
      })
    );
    expect(pullRequestSource.githubSource).toEqual(
      expect.objectContaining({
        sourceRecordId: "source-18",
        ref: expect.objectContaining({
          label: "PR #18",
          pullRequestNumber: 18,
          triggerMode: "pull_request_review_comment_command",
          commandKind: "run",
          headSha: "abc123def",
        }),
        comment: expect.objectContaining({
          commentId: 1801,
          author: { login: "maintainer" },
        }),
      })
    );
  });

  it("updates GitHub launch handshake metadata after runtime prepare/start", () => {
    const source = buildGitHubPullRequestFollowUpTaskSource({
      pullRequest: {
        number: 18,
        title: "Carry review-comment provenance",
        url: "https://github.com/acme/hugecode/pull/18",
        updatedAt: "2026-03-27T00:00:00.000Z",
        createdAt: "2026-03-26T00:00:00.000Z",
        body: "",
        headRefName: "feature/review-context",
        baseRefName: "main",
        isDraft: false,
        author: null,
      },
      gitRemoteUrl: "https://github.com/acme/hugecode.git",
      githubSource: {
        sourceRecordId: "source-18",
        event: {
          eventName: "pull_request_review_comment",
          action: "created",
        },
        triggerMode: "pull_request_review_comment_command",
        commandKind: "run",
        headSha: "abc123def",
        comment: {
          commentId: 1801,
          author: { login: "maintainer" },
        },
      },
    });

    const started = applyGitHubLaunchHandshakeToTaskSource(source, {
      state: "started",
      disposition: "launched",
      preparedPlanVersion: "plan-v18",
      approvedPlanVersion: "plan-v18",
    });

    expect(started?.githubSource?.launchHandshake).toEqual({
      state: "started",
      summary:
        "Governed GitHub PR follow-up launched from the linked review comment command through the canonical runtime prepare/start lane.",
      disposition: "launched",
      preparedPlanVersion: "plan-v18",
      approvedPlanVersion: "plan-v18",
    });
  });

  it("builds schedule task sources with canonical schedule provenance", () => {
    expect(
      buildScheduleTaskSource({
        scheduleId: "schedule-1",
        title: "Nightly review",
        workspaceId: "ws-1",
      })
    ).toEqual(
      expect.objectContaining({
        kind: "schedule",
        label: "Scheduled task",
        shortLabel: "Schedule",
        title: "Nightly review",
        externalId: "schedule-1",
        canonicalUrl: "schedule://schedule-1",
        sourceTaskId: "schedule-1",
        sourceRunId: "schedule-1",
        workspaceId: "ws-1",
      })
    );
  });
});
