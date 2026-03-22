import { describe, expect, it } from "vitest";
import {
  resolveProviderModelFromInputAndAgent,
  resolveProviderModelFromInputAndAgentWithSource,
} from "./webMcpBridgeRuntimeToolsShared";

const toNonEmptyString = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

describe("webMcpBridgeRuntimeToolsShared caller context resolution", () => {
  it("reports explicit source when explicit provider/model inputs are present", () => {
    const resolution = resolveProviderModelFromInputAndAgentWithSource(
      { provider: " anthropic " },
      {
        model: {
          provider: "openai",
          id: " gpt-5.3-codex ",
        },
      },
      { toNonEmptyString }
    );

    expect(resolution).toEqual({
      provider: "anthropic",
      modelId: "gpt-5.3-codex",
      source: "explicit",
    });
  });

  it("reports agent source when values are inferred from agent metadata only", () => {
    const resolution = resolveProviderModelFromInputAndAgentWithSource(
      {},
      {
        context: {
          provider: " google ",
          model_id: " gemini-2.5-pro ",
        },
      },
      { toNonEmptyString }
    );

    expect(resolution).toEqual({
      provider: "google",
      modelId: "gemini-2.5-pro",
      source: "agent",
    });
  });

  it("reports none source when no provider/model can be resolved", () => {
    const resolution = resolveProviderModelFromInputAndAgentWithSource(
      { provider: "   ", modelId: "" },
      {
        context: {
          provider: " ",
          modelId: "",
        },
      },
      { toNonEmptyString }
    );

    expect(resolution).toEqual({
      provider: null,
      modelId: null,
      source: "none",
    });
  });

  it("keeps legacy helper behavior for provider/model return shape", () => {
    const resolution = resolveProviderModelFromInputAndAgent(
      {},
      {
        provider: "openai",
        modelId: "gpt-5.3-codex",
      },
      { toNonEmptyString }
    );

    expect(resolution).toEqual({
      provider: "openai",
      modelId: "gpt-5.3-codex",
    });
  });
});
