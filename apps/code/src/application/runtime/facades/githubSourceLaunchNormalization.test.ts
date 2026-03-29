import { describe, expect, it } from "vitest";
import type {
  GitHubIssue,
  GitHubPullRequest,
  GitHubPullRequestComment,
  GitHubPullRequestDiff,
} from "../../../types";
import {
  normalizeGitHubIssueLaunchInput,
  normalizeGitHubIssueCommentCommandLaunchInput,
  normalizeGitHubPullRequestFollowUpLaunchInput,
  normalizeGitHubPullRequestReviewCommentCommandLaunchInput,
} from "./githubSourceLaunchNormalization";

describe("githubSourceLaunchNormalization", () => {
  it("normalizes GitHub issue launch inputs with issue detail context and repo defaults", () => {
    const issue: GitHubIssue = {
      number: 42,
      title: "Fix runtime source launch",
      url: "https://github.com/acme/hugecode/issues/42",
      updatedAt: "2026-03-18T00:00:00.000Z",
      body: "Keep the launch flow desktop-only for now.",
      author: { login: "octocat" },
      labels: ["bug", "launcher"],
    };

    const normalized = normalizeGitHubIssueLaunchInput({
      issue,
    });

    expect(normalized).toEqual(
      expect.objectContaining({
        title: "Fix runtime source launch",
        instruction: expect.stringContaining("GitHub issue #42: Fix runtime source launch"),
        taskSource: expect.objectContaining({
          kind: "github_issue",
          label: "GitHub issue #42",
          title: "Fix runtime source launch",
          externalId: issue.url,
          canonicalUrl: issue.url,
          sourceTaskId: issue.url,
          sourceRunId: issue.url,
          repo: expect.objectContaining({
            fullName: "acme/hugecode",
            remoteUrl: "https://github.com/acme/hugecode",
          }),
        }),
      })
    );
    expect(normalized.instruction).toContain("Author: @octocat");
    expect(normalized.instruction).toContain("Labels: bug, launcher");
    expect(normalized.instruction).toContain("Issue body:");
    expect(normalized.instruction).toContain("Keep the launch flow desktop-only for now.");
  });

  it("falls back cleanly when GitHub issue body is missing", () => {
    const issue: GitHubIssue = {
      number: 7,
      title: "Document source launch edge cases",
      url: "https://github.com/acme/hugecode/issues/7",
      updatedAt: "2026-03-18T00:00:00.000Z",
    };

    const normalized = normalizeGitHubIssueLaunchInput({ issue, sourceTaskId: "source-task-7" });

    expect(normalized.taskSource).toEqual(
      expect.objectContaining({
        kind: "github_issue",
        sourceTaskId: "source-task-7",
        sourceRunId: issue.url,
      })
    );
    expect(normalized.instruction).toContain("Issue body unavailable.");
  });

  it("normalizes GitHub issue comment-command launches with source-linked follow-up context", () => {
    const issue: GitHubIssue = {
      number: 21,
      title: "Carry issue comment context",
      url: "https://github.com/acme/hugecode/issues/21",
      updatedAt: "2026-03-18T00:00:00.000Z",
      body: "Keep the launch governed.",
      author: { login: "octocat" },
    };

    const normalized = normalizeGitHubIssueCommentCommandLaunchInput({
      issue,
      event: {
        eventName: "issue_comment",
        action: "created",
        deliveryId: "delivery-21",
      },
      command: {
        triggerMode: "issue_comment_command",
        commandKind: "continue",
        sourceRecordId: "source-21",
        comment: {
          commentId: 2101,
          url: "https://github.com/acme/hugecode/issues/21#issuecomment-2101",
          body: "@hugecode continue with the scoped fix.",
          author: { login: "reviewer" },
        },
      },
    });

    expect(normalized.instruction).toContain(
      "GitHub issue follow-up from issue comment #21: Carry issue comment context"
    );
    expect(normalized.instruction).toContain("GitHub event: issue_comment.created");
    expect(normalized.instruction).toContain("Trigger mode: issue_comment_command");
    expect(normalized.instruction).toContain("Command: continue");
    expect(normalized.instruction).toContain("Comment author: @reviewer");
    expect(normalized.instruction).toContain(
      "Command comment summary: @hugecode continue with the scoped fix."
    );
    expect(normalized.instruction).toContain(
      "Follow-up defaults: Stay anchored to the linked GitHub command, issue, and repository evidence."
    );
    expect(normalized.taskSource.githubSource).toEqual(
      expect.objectContaining({
        sourceRecordId: "source-21",
        event: expect.objectContaining({
          eventName: "issue_comment",
          action: "created",
          deliveryId: "delivery-21",
        }),
        ref: expect.objectContaining({
          triggerMode: "issue_comment_command",
          commandKind: "continue",
        }),
        comment: expect.objectContaining({
          commentId: 2101,
          author: { login: "reviewer" },
        }),
      })
    );
  });

  it("falls back cleanly when GitHub issue comment-command context is missing", () => {
    const issue: GitHubIssue = {
      number: 22,
      title: "Fallback issue comment follow-up",
      url: "https://github.com/acme/hugecode/issues/22",
      updatedAt: "2026-03-18T00:00:00.000Z",
    };

    const normalized = normalizeGitHubIssueCommentCommandLaunchInput({
      issue,
      event: {
        eventName: "issue_comment",
        action: "created",
      },
      command: {
        triggerMode: "issue_comment_command",
      },
    });

    expect(normalized.instruction).toContain("Issue body unavailable.");
    expect(normalized.instruction).toContain("Command comment context unavailable.");
    expect(normalized.taskSource.githubSource?.comment ?? null).toBeNull();
  });

  it("normalizes GitHub PR follow-up launch inputs with diff and comment summaries", () => {
    const pullRequest: GitHubPullRequest = {
      number: 17,
      title: "Propagate taskSource through launch inputs",
      url: "https://github.com/acme/hugecode/pull/17",
      updatedAt: "2026-03-18T00:00:00.000Z",
      createdAt: "2026-03-17T00:00:00.000Z",
      body: "Follow up on the source-linked delegation slice.",
      headRefName: "feature/task-source",
      baseRefName: "main",
      isDraft: false,
      author: { login: "maintainer" },
    };
    const diffs: GitHubPullRequestDiff[] = [
      { path: "src/a.ts", status: "modified", diff: "@@" },
      { path: "src/b.ts", status: "modified", diff: "@@" },
    ];
    const comments: GitHubPullRequestComment[] = [
      {
        id: 1,
        body: "Keep the wrapper fallback safe.",
        createdAt: "2026-03-17T00:00:00.000Z",
        url: "https://github.com/acme/hugecode/pull/17#issuecomment-1",
        author: { login: "reviewer" },
      },
    ];

    const normalized = normalizeGitHubPullRequestFollowUpLaunchInput({
      pullRequest,
      diffs,
      comments,
    });

    expect(normalized).toEqual(
      expect.objectContaining({
        title: "Propagate taskSource through launch inputs",
        instruction: expect.stringContaining(
          "GitHub PR follow-up #17: Propagate taskSource through launch inputs"
        ),
        taskSource: expect.objectContaining({
          kind: "github_pr_followup",
          label: "GitHub PR follow-up #17",
          title: "Propagate taskSource through launch inputs",
          externalId: pullRequest.url,
          canonicalUrl: pullRequest.url,
          sourceTaskId: pullRequest.url,
          sourceRunId: pullRequest.url,
          repo: expect.objectContaining({
            fullName: "acme/hugecode",
            remoteUrl: "https://github.com/acme/hugecode",
          }),
        }),
      })
    );
    expect(normalized.instruction).toContain("Branches: main <- feature/task-source");
    expect(normalized.instruction).toContain("Changed files (2):");
    expect(normalized.instruction).toContain("- src/a.ts");
    expect(normalized.instruction).toContain("Discussion notes:");
    expect(normalized.instruction).toContain("@reviewer: Keep the wrapper fallback safe.");
  });

  it("falls back cleanly when GitHub PR follow-up diffs and comments are missing", () => {
    const pullRequest: GitHubPullRequest = {
      number: 9,
      title: "Handle missing PR context",
      url: "https://github.com/acme/hugecode/pull/9",
      updatedAt: "2026-03-18T00:00:00.000Z",
      createdAt: "2026-03-17T00:00:00.000Z",
      body: "",
      headRefName: "feature/missing-context",
      baseRefName: "main",
      isDraft: true,
      author: null,
    };

    const normalized = normalizeGitHubPullRequestFollowUpLaunchInput({
      pullRequest,
      diffs: [],
      comments: [],
      sourceRunId: "run-9",
    });

    expect(normalized.taskSource).toEqual(
      expect.objectContaining({
        kind: "github_pr_followup",
        sourceTaskId: pullRequest.url,
        sourceRunId: "run-9",
      })
    );
    expect(normalized.instruction).toContain("State: draft");
    expect(normalized.instruction).toContain("Pull request body unavailable.");
    expect(normalized.instruction).toContain("Changed files unavailable.");
    expect(normalized.instruction).toContain("Discussion notes unavailable.");
  });

  it("normalizes GitHub PR review-comment launches with diff, discussion, and review comment context", () => {
    const pullRequest: GitHubPullRequest = {
      number: 23,
      title: "Preserve review-comment linkage",
      url: "https://github.com/acme/hugecode/pull/23",
      updatedAt: "2026-03-18T00:00:00.000Z",
      createdAt: "2026-03-17T00:00:00.000Z",
      body: "Keep review follow-up routed through runtime.",
      headRefName: "feature/review-followup",
      baseRefName: "main",
      isDraft: false,
      author: { login: "maintainer" },
    };
    const normalized = normalizeGitHubPullRequestReviewCommentCommandLaunchInput({
      pullRequest,
      diffs: [{ path: "src/runtime.ts", status: "modified", diff: "@@" }],
      comments: [
        {
          id: 2,
          body: "Keep the shared runtime facade.",
          createdAt: "2026-03-17T00:00:00.000Z",
          url: "https://github.com/acme/hugecode/pull/23#issuecomment-2",
          author: { login: "reviewer" },
        },
      ],
      event: {
        eventName: "pull_request_review_comment",
        action: "created",
      },
      command: {
        triggerMode: "pull_request_review_comment_command",
        commandKind: "run",
        headSha: "abcdef123456",
        sourceRecordId: "source-23",
        comment: {
          commentId: 2301,
          url: "https://github.com/acme/hugecode/pull/23#discussion_r2301",
          body: "Please keep the launcher on the governed path.",
          author: { login: "approver" },
        },
      },
    });

    expect(normalized.instruction).toContain(
      "GitHub PR review-comment follow-up #23: Preserve review-comment linkage"
    );
    expect(normalized.instruction).toContain("GitHub event: pull_request_review_comment.created");
    expect(normalized.instruction).toContain("Trigger mode: pull_request_review_comment_command");
    expect(normalized.instruction).toContain(
      "Review comment summary: Please keep the launcher on the governed path."
    );
    expect(normalized.instruction).toContain("Changed files (1):");
    expect(normalized.instruction).toContain("Discussion notes:");
    expect(normalized.taskSource.githubSource).toEqual(
      expect.objectContaining({
        sourceRecordId: "source-23",
        ref: expect.objectContaining({
          triggerMode: "pull_request_review_comment_command",
          commandKind: "run",
          headSha: "abcdef123456",
        }),
        comment: expect.objectContaining({
          commentId: 2301,
          author: { login: "approver" },
        }),
      })
    );
  });

  it("falls back cleanly when GitHub PR review-comment context is missing", () => {
    const pullRequest: GitHubPullRequest = {
      number: 24,
      title: "Fallback review-comment follow-up",
      url: "https://github.com/acme/hugecode/pull/24",
      updatedAt: "2026-03-18T00:00:00.000Z",
      createdAt: "2026-03-17T00:00:00.000Z",
      body: "",
      headRefName: "feature/fallback-review-comment",
      baseRefName: "main",
      isDraft: false,
      author: null,
    };

    const normalized = normalizeGitHubPullRequestReviewCommentCommandLaunchInput({
      pullRequest,
      event: {
        eventName: "pull_request_review_comment",
        action: "created",
      },
      command: {
        triggerMode: "pull_request_review_comment_command",
      },
    });

    expect(normalized.instruction).toContain("Review comment context unavailable.");
    expect(normalized.instruction).toContain("Changed files unavailable.");
    expect(normalized.instruction).toContain("Discussion notes unavailable.");
    expect(normalized.taskSource.githubSource?.comment ?? null).toBeNull();
  });
});
