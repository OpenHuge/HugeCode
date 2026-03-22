import { describe, expect, it } from "vitest";
import { parseModelListResponse } from "./modelListResponse";

describe("parseModelListResponse", () => {
  it("normalizes runtime routing metadata for each model entry", () => {
    const parsed = parseModelListResponse({
      result: {
        data: [
          {
            id: "gpt-5.3-codex",
            model: "gpt-5.3-codex",
            displayName: "GPT-5.3 Codex",
            description: "openai (chat, coding)",
            provider: " OpenAI ",
            pool: "Codex",
            source: "local_codex",
            available: false,
            supportedReasoningEfforts: [
              { reasoningEffort: " low ", description: "Low" },
              { reasoningEffort: "high", description: "High" },
            ],
            defaultReasoningEffort: " LOW ",
            isDefault: true,
          },
        ],
      },
    });

    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({
      id: "gpt-5.3-codex",
      model: "gpt-5.3-codex",
      provider: "openai",
      pool: "codex",
      source: "local-codex",
      available: false,
      supportedReasoningEfforts: [
        { reasoningEffort: "low", description: "Low" },
        { reasoningEffort: "high", description: "High" },
      ],
      defaultReasoningEffort: "low",
    });
  });

  it("defaults routing metadata to safe values when fields are missing", () => {
    const parsed = parseModelListResponse({
      result: {
        data: [
          {
            id: "fallback-model",
            model: "fallback-model",
            displayName: "Fallback",
            supportedReasoningEfforts: [],
            defaultReasoningEffort: null,
            isDefault: false,
          },
        ],
      },
    });

    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({
      provider: null,
      pool: null,
      source: null,
      available: true,
    });
  });

  it("supports runtime responses where result is a direct model array", () => {
    const parsed = parseModelListResponse({
      ok: true,
      result: [
        {
          id: "gpt-5.3-codex",
          displayName: "GPT-5.3 Codex",
          provider: "openai",
          pool: "codex",
          source: "local-codex",
          available: true,
          reasoningEfforts: ["low", "medium", "high"],
        },
      ],
    });

    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({
      id: "gpt-5.3-codex",
      model: "gpt-5.3-codex",
      displayName: "GPT-5.3 Codex",
      provider: "openai",
      pool: "codex",
      source: "local-codex",
      available: true,
    });
  });

  it("falls back to model slug when displayName is blank", () => {
    const parsed = parseModelListResponse({
      result: {
        data: [
          {
            id: "provider::gpt-5.2-codex",
            model: "gpt-5.2-codex",
            displayName: "   ",
          },
        ],
      },
    });

    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({
      id: "provider::gpt-5.2-codex",
      model: "gpt-5.2-codex",
      displayName: "gpt-5.2-codex",
    });
  });
});
