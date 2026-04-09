import { describe, expect, it } from "vitest";
import { buildRuntimeAiWebLabSourceDraft } from "./runtimeAiWebLabSourceDraft";

describe("runtimeAiWebLabSourceDraft", () => {
  it("builds a governed source-linked draft from a successful AI Web Lab artifact", () => {
    const result = buildRuntimeAiWebLabSourceDraft({
      artifact: {
        artifactKind: "prompt_markdown",
        content: "Ship the Review Pack continuity summary using the canonical runtime fields.",
        entrypointId: "prompt_refinement",
        errorMessage: null,
        extractedAt: "2026-04-09T00:00:00.000Z",
        format: "markdown",
        pageTitle: "ChatGPT prompt refinement",
        providerId: "chatgpt",
        sourceUrl: "https://chatgpt.com/c/source-linked-launch",
        status: "succeeded",
      },
      workspace: {
        id: "ws-1",
        name: "Runtime Control Plane",
      },
      profileId: "review-first",
    });

    expect(result).toEqual({
      draftTitle: "ChatGPT prompt refinement",
      draftInstruction:
        "Ship the Review Pack continuity summary using the canonical runtime fields.",
      sourceDraft: {
        kind: "source_launch",
        taskId: "ai-web-lab:chatgpt:prompt_markdown:prompt_refinement",
        title: "ChatGPT prompt refinement",
        instruction: "Ship the Review Pack continuity summary using the canonical runtime fields.",
        profileId: "review-first",
        reviewProfileId: null,
        taskSource: {
          kind: "external_ref",
          label: "AI Web Lab",
          shortLabel: "AI Web Lab",
          title: "ChatGPT prompt refinement",
          reference: "chatgpt/prompt_markdown",
          url: "https://chatgpt.com/c/source-linked-launch",
          workspaceId: "ws-1",
          externalId: "ai-web-lab:chatgpt:prompt_markdown:prompt_refinement",
          canonicalUrl: "https://chatgpt.com/c/source-linked-launch",
          sourceTaskId: "ai-web-lab:chatgpt:prompt_markdown:prompt_refinement",
          sourceRunId: "ai-web-lab:chatgpt:prompt_markdown:prompt_refinement",
        },
        validationPresetId: null,
        accessMode: null,
        fieldOrigins: {
          executionProfileId: "explicit_override",
          preferredBackendIds: "explicit_override",
          accessMode: "explicit_override",
          reviewProfileId: "explicit_override",
          validationPresetId: "explicit_override",
        },
      },
    });
  });

  it("returns null when the artifact cannot drive a launch draft", () => {
    expect(
      buildRuntimeAiWebLabSourceDraft({
        artifact: {
          artifactKind: "prompt_markdown",
          content: null,
          entrypointId: null,
          errorMessage: "Blocked",
          extractedAt: "2026-04-09T00:00:00.000Z",
          format: "markdown",
          pageTitle: null,
          providerId: "gemini",
          sourceUrl: null,
          status: "blocked",
        },
        workspace: {
          id: "ws-1",
          name: "Runtime Control Plane",
        },
        profileId: "balanced-delegate",
      })
    ).toBeNull();
  });
});
