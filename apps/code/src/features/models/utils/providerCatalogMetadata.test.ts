import { describe, expect, it } from "vitest";
import type { RuntimeProviderCatalogEntry } from "../../../contracts/runtime";
import type { ModelOption } from "../../../types";
import { mergeModelsWithProviderCatalogMetadata } from "./providerCatalogMetadata";

function createModelOption(overrides: Partial<ModelOption> = {}): ModelOption {
  return {
    id: "openai::gpt-5.4",
    model: "gpt-5.4",
    displayName: "GPT-5.4",
    description: "",
    provider: "openai",
    pool: "codex",
    source: "oauth-account",
    available: true,
    supportedReasoningEfforts: [{ reasoningEffort: "high", description: "High" }],
    defaultReasoningEffort: "high",
    capabilityMatrix: {
      supportsTools: "supported",
      supportsReasoningEffort: "supported",
      supportsVision: "supported",
      supportsJsonSchema: "supported",
      maxContextTokens: 200000,
      supportedReasoningEfforts: ["medium", "high"],
    },
    isDefault: false,
    ...overrides,
  };
}

function createProviderCatalogEntry(
  overrides: Partial<RuntimeProviderCatalogEntry> = {}
): RuntimeProviderCatalogEntry {
  return {
    providerId: "openai",
    displayName: "OpenAI",
    pool: "codex",
    oauthProviderId: null,
    aliases: [],
    defaultModelId: "gpt-5.4",
    available: true,
    supportsNative: false,
    supportsOpenaiCompat: true,
    readinessKind: "ready",
    readinessMessage: null,
    executionKind: "cloud",
    registryVersion: "v1",
    capabilityMatrix: {
      supportsTools: "unknown",
      supportsReasoningEffort: "unsupported",
      supportsVision: "unknown",
      supportsJsonSchema: "unknown",
      maxContextTokens: 64000,
      supportedReasoningEfforts: [],
    },
    ...overrides,
  };
}

describe("providerCatalogMetadata", () => {
  it("clamps model capabilities by provider compatibility limits", () => {
    const [merged] = mergeModelsWithProviderCatalogMetadata(
      [createModelOption()],
      [createProviderCatalogEntry()]
    );

    expect(merged.capabilityMatrix).toEqual({
      supportsTools: "supported",
      supportsReasoningEffort: "unsupported",
      supportsVision: "supported",
      supportsJsonSchema: "supported",
      maxContextTokens: 64000,
      supportedReasoningEfforts: [],
    });
  });
});
