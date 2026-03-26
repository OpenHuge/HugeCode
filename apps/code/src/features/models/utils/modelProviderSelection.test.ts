import { describe, expect, it } from "vitest";
import {
  buildModelProviderOptions,
  buildProviderModelEntries,
  resolveAutoModelProviderSelection,
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
    const entries = buildProviderModelEntries(
      [
        createModel({ id: "gpt-4.1", model: "gpt-4.1", displayName: "GPT-4.1" }),
        createModel({ id: "gpt-5.1", model: "gpt-5.1", displayName: "GPT-5.1" }),
      ],
      null
    );

    expect(entries.map((entry) => entry.id)).toEqual(["gpt-5.1", "gpt-4.1"]);
  });

  it("prefers higher Claude tiers when versions match", () => {
    const entries = buildProviderModelEntries(
      [
        createModel({
          id: "claude-haiku-4-5",
          model: "claude-haiku-4-5",
          displayName: "Claude Haiku 4.5",
          provider: "claude_code_local",
          pool: "claude",
        }),
        createModel({
          id: "claude-sonnet-4-5",
          model: "claude-sonnet-4-5",
          displayName: "Claude Sonnet 4.5",
          provider: "claude_code_local",
          pool: "claude",
        }),
        createModel({
          id: "claude-opus-4-5",
          model: "claude-opus-4-5",
          displayName: "Claude Opus 4.5",
          provider: "claude_code_local",
          pool: "claude",
        }),
      ],
      null
    );

    expect(entries.map((entry) => entry.id)).toEqual([
      "claude-opus-4-5",
      "claude-sonnet-4-5",
      "claude-haiku-4-5",
    ]);
  });

  it("uses the strongest healthy model as the recommended auto route", () => {
    const providerOptions = buildModelProviderOptions([
      createModel({ id: "gpt-4.1", model: "gpt-4.1", displayName: "GPT-4.1" }),
      createModel({ id: "gpt-5.1", model: "gpt-5.1", displayName: "GPT-5.1" }),
    ]);

    expect(resolveAutoModelProviderSelection(providerOptions, null, null)).toMatchObject({
      providerId: "codex",
      modelId: "gpt-5.1",
    });
  });
});
