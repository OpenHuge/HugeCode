import { describe, expect, it } from "vitest";
import {
  buildModelProviderOptions,
  buildProviderModelEntries,
  resolveProviderModelId,
  resolveSelectedProviderId,
  type ProviderSelectableModel,
} from "./modelProviderSelection";

function createModel(
  overrides: Partial<ProviderSelectableModel> & Pick<ProviderSelectableModel, "id" | "model">
): ProviderSelectableModel {
  return {
    displayName: overrides.displayName ?? overrides.model,
    provider: overrides.provider ?? "openai",
    pool: overrides.pool ?? "codex",
    source: overrides.source ?? "runtime",
    available: overrides.available ?? true,
    providerReadinessKind: overrides.providerReadinessKind ?? "ready",
    providerReadinessMessage: overrides.providerReadinessMessage ?? null,
    executionKind: overrides.executionKind ?? "cloud",
    ...overrides,
  };
}

describe("modelProviderSelection", () => {
  it("orders stronger models ahead of weaker versions within a provider family", () => {
    const entries = buildProviderModelEntries([
      createModel({ id: "gpt-4.1", model: "gpt-4.1", displayName: "GPT-4.1" }),
      createModel({ id: "gpt-5.1", model: "gpt-5.1", displayName: "GPT-5.1" }),
    ]);

    expect(entries.map((entry) => entry.id)).toEqual(["gpt-5.1", "gpt-4.1"]);
  });

  it("preserves distinct route ids when the same model slug is exposed by multiple pools", () => {
    const entries = buildProviderModelEntries([
      createModel({
        id: "openai-primary",
        model: "gpt-5.1",
        displayName: "GPT-5.1",
        pool: "codex-primary",
      }),
      createModel({
        id: "openai-secondary",
        model: "gpt-5.1",
        displayName: "GPT-5.1",
        pool: "codex-secondary",
      }),
    ]);

    expect(entries.map((entry) => entry.id)).toEqual(["openai-primary", "openai-secondary"]);
  });

  it("groups provider families and resolves the selected provider from the current model route", () => {
    const providerOptions = buildModelProviderOptions([
      createModel({ id: "gpt-5.1", model: "gpt-5.1", displayName: "GPT-5.1" }),
      createModel({
        id: "claude-sonnet-4-5",
        model: "claude-sonnet-4-5",
        displayName: "Claude Sonnet 4.5",
        provider: "claude_code_local",
        pool: "claude",
      }),
    ]);

    expect(providerOptions.map((provider) => provider.id)).toEqual(["codex", "claude"]);
    expect(resolveSelectedProviderId(providerOptions, "claude-sonnet-4-5")).toBe("claude");
  });

  it("selecting a provider resolves to that provider's recommended model route", () => {
    const providerOptions = buildModelProviderOptions([
      createModel({ id: "gpt-4.1", model: "gpt-4.1", displayName: "GPT-4.1" }),
      createModel({ id: "gpt-5.1", model: "gpt-5.1", displayName: "GPT-5.1" }),
      createModel({
        id: "claude-sonnet-4-5",
        model: "claude-sonnet-4-5",
        displayName: "Claude Sonnet 4.5",
        provider: "claude_code_local",
        pool: "claude",
      }),
    ]);

    expect(resolveProviderModelId(providerOptions, "codex", null)).toBe("gpt-5.1");
    expect(resolveProviderModelId(providerOptions, "claude", null)).toBe("claude-sonnet-4-5");
  });
});
