import { describe, expect, it } from "vitest";
import type { ModelOption } from "../../../types";
import {
  getModelReasoningOptions,
  normalizeEffortValue,
  normalizeModelOption,
  supportsModelReasoning,
} from "./modelOptionCapabilities";

function createModelOption(overrides: Partial<ModelOption> = {}): ModelOption {
  return {
    id: "model-1",
    model: "gpt-5.4",
    displayName: "GPT-5.4",
    description: "",
    provider: "openai",
    pool: "codex",
    source: "oauth-account",
    available: true,
    supportedReasoningEfforts: [],
    defaultReasoningEffort: null,
    isDefault: false,
    ...overrides,
  };
}

describe("modelOptionCapabilities", () => {
  it("canonicalizes provider aliases and source aliases during model normalization", () => {
    const normalized = normalizeModelOption(
      createModelOption({
        provider: " Codex ",
        pool: "OpenAI",
        source: "oauth_account",
        supportedReasoningEfforts: [
          { reasoningEffort: " High ", description: "High" },
          { reasoningEffort: "high", description: "Duplicate" },
        ],
        defaultReasoningEffort: " Medium ",
      })
    );

    expect(normalized.provider).toBe("openai");
    expect(normalized.pool).toBe("codex");
    expect(normalized.source).toBe("oauth-account");
    expect(normalized.supportedReasoningEfforts).toEqual([
      { reasoningEffort: "high", description: "High" },
    ]);
    expect(normalized.defaultReasoningEffort).toBe("high");
  });

  it("derives reasoning support and options from normalized model capabilities", () => {
    const model = normalizeModelOption(
      createModelOption({
        supportedReasoningEfforts: [
          { reasoningEffort: "LOW", description: "" },
          { reasoningEffort: "medium", description: "" },
        ],
      })
    );

    expect(supportsModelReasoning(model)).toBe(true);
    expect(getModelReasoningOptions(model)).toEqual(["low", "medium"]);
  });

  it("falls back to the normalized default effort when no explicit reasoning list is present", () => {
    const model = normalizeModelOption(
      createModelOption({
        supportedReasoningEfforts: [],
        defaultReasoningEffort: " High ",
      })
    );

    expect(getModelReasoningOptions(model)).toEqual(["high"]);
    expect(normalizeEffortValue(" XHIGH ")).toBe("xhigh");
  });

  it("honors explicit unsupported reasoning capability over legacy reasoning fields", () => {
    const model = normalizeModelOption(
      createModelOption({
        supportedReasoningEfforts: [{ reasoningEffort: "high", description: "High" }],
        defaultReasoningEffort: "high",
        capabilityMatrix: {
          supportsTools: "supported",
          supportsReasoningEffort: "unsupported",
          supportsVision: "supported",
          supportsJsonSchema: "unknown",
          maxContextTokens: 128000,
          supportedReasoningEfforts: [],
        },
      })
    );

    expect(supportsModelReasoning(model)).toBe(false);
    expect(getModelReasoningOptions(model)).toEqual([]);
    expect(model.defaultReasoningEffort).toBeNull();
  });
});
