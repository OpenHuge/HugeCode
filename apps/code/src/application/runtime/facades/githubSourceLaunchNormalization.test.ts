import { describe, expect, it } from "vitest";
import type {
  GitHubIssue,
  GitHubPullRequest,
  GitHubPullRequestComment,
  GitHubPullRequestDiff,
} from "../../../types";
import {
  normalizeGitHubIssueLaunchInput,
  normalizeGitHubPullRequestFollowUpLaunchInput,
} from "./githubSourceLaunchNormalization";

describe("githubSourceLaunchNormalization", () => {
  it("normalizes GitHub issue launch inputs with issue detail context", () => {
    const issue: GitHubIssue = {
      number: 42,
      title: "Fix runtime source launch",
      url: "https://github.com/acme/hugecode/issues/42",
      updatedAt: "2026-03-18T00:00:00.000Z",
      body: "Keep the launch flow desktop-only for now.",
      author: { login: "octocat" },
      labels: ["bug", "launcher"],
    };

    const normalized = normalizeGitHubIssueLaunchInput({ issue });

    expect(normalized).toEqual(
      expect.objectContaining({
        title: "Fix runtime source launch",
        instruction: expect.stringContaining("GitHub issue #42: Fix runtime source launch"),
        missionBrief: expect.objectContaining({
          objective: "Fix runtime source launch",
        }),
        taskSource: expect.objectContaining({
          kind: "github_issue",
          label: "GitHub issue #42",
          title: "Fix runtime source launch",
          externalId: issue.url,
          canonicalUrl: issue.url,
          sourceTaskId: issue.url,
          sourceRunId: issue.url,
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
      preferredBackendIds: ["backend-a", "backend-a", "backend-b"],
    });

    expect(normalized).toEqual(
      expect.objectContaining({
        title: "Propagate taskSource through launch inputs",
        instruction: expect.stringContaining(
          "GitHub PR follow-up #17: Propagate taskSource through launch inputs"
        ),
        missionBrief: expect.objectContaining({
          objective: "Propagate taskSource through launch inputs",
          preferredBackendIds: ["backend-a", "backend-b"],
        }),
        taskSource: expect.objectContaining({
          kind: "github_pr_followup",
          label: "GitHub PR follow-up #17",
          title: "Propagate taskSource through launch inputs",
          externalId: pullRequest.url,
          canonicalUrl: pullRequest.url,
          sourceTaskId: pullRequest.url,
          sourceRunId: pullRequest.url,
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
});
