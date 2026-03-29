import { describe, expect, it } from "vitest";
import {
  normalizeCallSummarySourceLaunchInput,
  normalizeCustomerFeedbackSourceLaunchInput,
  normalizeDocumentSourceLaunchInput,
  normalizeExternalReferenceSourceLaunchInput,
  normalizeGitHubDiscussionSourceLaunchInput,
  normalizeGitHubIssueCommentCommandSourceLaunchInput,
  normalizeGitHubPullRequestReviewCommentCommandSourceLaunchInput,
  normalizeNoteSourceLaunchInput,
} from "./runtimeSourceLaunchNormalization";

describe("runtimeSourceLaunchNormalization", () => {
  it("normalizes GitHub discussion sources into canonical taskSource inputs", () => {
    const normalized = normalizeGitHubDiscussionSourceLaunchInput({
      discussion: {
        number: 14,
        title: "Refine runtime triage semantics",
        url: "https://github.com/acme/hugecode/discussions/14",
        body: "Operators need one next action instead of multiple fragmented hints.",
        category: "Ideas",
        author: { login: "maintainer" },
      },
    });

    expect(normalized.taskSource).toEqual(
      expect.objectContaining({
        kind: "github_discussion",
        label: "GitHub discussion #14",
        reference: "#14",
        canonicalUrl: "https://github.com/acme/hugecode/discussions/14",
      })
    );
    expect(normalized.instruction).toContain("Category: Ideas");
    expect(normalized.instruction).toContain("Operators need one next action");
  });

  it("normalizes note, feedback, document, call, and external reference sources", () => {
    const note = normalizeNoteSourceLaunchInput({
      note: {
        title: "Operator desk note",
        body: "Keep the launch flow governed and review-native.",
        sourceId: "note-1",
      },
    });
    const feedback = normalizeCustomerFeedbackSourceLaunchInput({
      feedback: {
        customer: "Acme",
        title: "Review handoff is too expensive",
        body: "Need a faster way to understand whether to resume or review.",
        priority: "high",
        sourceId: "feedback-8",
      },
    });
    const document = normalizeDocumentSourceLaunchInput({
      document: {
        title: "Runtime design brief",
        url: "https://docs.acme.dev/runtime-brief",
        excerpt: "Promote source-linked work into the canonical governed run path.",
      },
    });
    const call = normalizeCallSummarySourceLaunchInput({
      callSummary: {
        title: "Weekly operator sync",
        summary:
          "HugeCode should expose a single operator next action across launch, review, and takeover.",
        attendees: ["han", "maintainer"],
      },
    });
    const external = normalizeExternalReferenceSourceLaunchInput({
      reference: {
        title: "Linear Next notes",
        url: "https://linear.app/next",
        summary: "Context to execution is replacing issue-first delegation flows.",
      },
    });

    expect(note.taskSource.kind).toBe("note");
    expect(feedback.taskSource.kind).toBe("customer_feedback");
    expect(document.taskSource.kind).toBe("doc");
    expect(call.taskSource.kind).toBe("call_summary");
    expect(external.taskSource.kind).toBe("external_ref");

    expect(note.taskSource.sourceTaskId).toBe("note-1");
    expect(feedback.instruction).toContain("Priority: high");
    expect(document.instruction).toContain("Promote source-linked work");
    expect(call.instruction).toContain("Attendees: han, maintainer");
    expect(external.instruction).toContain("Context to execution is replacing issue-first");
  });

  it("normalizes GitHub comment-command source launches into governed task sources", () => {
    const issue = normalizeGitHubIssueCommentCommandSourceLaunchInput({
      issue: {
        number: 31,
        title: "Issue comment launch",
        url: "https://github.com/acme/hugecode/issues/31",
      },
      event: {
        eventName: "issue_comment",
        action: "created",
      },
      command: {
        triggerMode: "issue_comment_command",
        commandKind: "continue",
        sourceRecordId: "source-31",
        comment: {
          commentId: 3101,
          body: "@hugecode continue",
          author: { login: "reviewer" },
        },
      },
    });

    const pullRequest = normalizeGitHubPullRequestReviewCommentCommandSourceLaunchInput({
      pullRequest: {
        number: 32,
        title: "Review comment launch",
        url: "https://github.com/acme/hugecode/pull/32",
        body: "",
        headRefName: "feature/review-comment-launch",
        baseRefName: "main",
        isDraft: false,
        author: null,
      },
      event: {
        eventName: "pull_request_review_comment",
        action: "created",
      },
      command: {
        triggerMode: "pull_request_review_comment_command",
      },
    });

    expect(issue.taskSource).toEqual(
      expect.objectContaining({
        kind: "github_issue",
        label: "GitHub issue #31",
        githubSource: expect.objectContaining({
          sourceRecordId: "source-31",
        }),
      })
    );
    expect(issue.instruction).toContain("GitHub event: issue_comment.created");
    expect(issue.instruction).toContain("Command comment summary: @hugecode continue");
    expect(pullRequest.taskSource).toEqual(
      expect.objectContaining({
        kind: "github_pr_followup",
        label: "GitHub PR follow-up #32",
      })
    );
    expect(pullRequest.instruction).toContain("GitHub event: pull_request_review_comment.created");
    expect(pullRequest.instruction).toContain("Review comment context unavailable.");
  });
});
