import { describe, expect, it } from "vitest";
import {
  buildRuntimeSourceTaskSource,
  normalizeCallSummarySourceLaunchInput,
  normalizeCustomerFeedbackSourceLaunchInput,
  normalizeDocumentSourceLaunchInput,
  normalizeExternalReferenceSourceLaunchInput,
  normalizeGitHubDiscussionSourceLaunchInput,
  normalizeNoteSourceLaunchInput,
} from "./runtime-control-plane/runtimeSourceLaunchNormalization";

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
      preferredBackendIds: [" local ", "remote", "local", ""],
    });

    expect(normalized.taskSource).toEqual(
      expect.objectContaining({
        kind: "github_discussion",
        label: "GitHub discussion #14",
        reference: "#14",
        canonicalUrl: "https://github.com/acme/hugecode/discussions/14",
      })
    );
    expect(normalized.missionBrief).toEqual(
      expect.objectContaining({
        objective: "Refine runtime triage semantics",
        preferredBackendIds: ["local", "remote"],
        riskLevel: "low",
        permissionSummary: null,
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
        attendees: ["han", "maintainer", "han", " "],
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

  it("builds deterministic source ids from explicit launch lineage before source ids", () => {
    const source = buildRuntimeSourceTaskSource({
      kind: "external_ref",
      label: "External reference",
      title: "Runtime reference",
      externalId: "https://example.com/runtime",
      canonicalUrl: "https://example.com/runtime",
      sourceTaskId: "task-42",
      sourceRunId: "run-42",
    });

    expect(source).toEqual(
      expect.objectContaining({
        sourceTaskId: "task-42",
        sourceRunId: "run-42",
        threadId: null,
        requestId: null,
        githubSource: null,
      })
    );
  });

  it("keeps blank optional source content deterministic", () => {
    const call = normalizeCallSummarySourceLaunchInput({
      callSummary: {
        title: "   ",
        summary: "   ",
      },
    });

    expect(call.title).toBe("Call summary");
    expect(call.instruction).toContain("Call summary unavailable.");
    expect(call.taskSource.sourceTaskId).toBe("Call summary");
  });
});
