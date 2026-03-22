import { describe, expect, it } from "vitest";
import type { RuntimeProviderCatalogEntry } from "../../../contracts/runtime";
import type { ModelOption } from "../../../types";
import {
  applyModelBrandDisplay,
  buildProviderBrandOptionsFromCatalog,
  buildProviderBrandOptionsFromState,
  canonicalizeProviderBrandId,
  expandComposerModelBrandOptions,
  matchesProviderBrand,
} from "./antiGravityBranding";

function createCatalogEntry(
  overrides: Partial<RuntimeProviderCatalogEntry> = {}
): RuntimeProviderCatalogEntry {
  return {
    providerId: "google",
    displayName: "Google",
    pool: "gemini",
    oauthProviderId: "gemini",
    aliases: ["google", "gemini", "antigravity", "anti-gravity", "gemini-antigravity"],
    defaultModelId: "gemini-3.1-pro",
    available: true,
    supportsNative: true,
    supportsOpenaiCompat: true,
    registryVersion: "2026-03-15",
    ...overrides,
  };
}

function createModel(overrides: Partial<ModelOption> = {}): ModelOption {
  return {
    id: "google::gemini-3.1-pro",
    model: "gemini-3.1-pro",
    displayName: "Gemini 3.1 Pro",
    description: "",
    provider: "google",
    pool: "gemini",
    source: "oauth-account",
    available: true,
    supportedReasoningEfforts: [],
    defaultReasoningEffort: null,
    isDefault: true,
    ...overrides,
  };
}

describe("antiGravityBranding", () => {
  it("projects antigravity as a visible brand for gemini providers", () => {
    const options = buildProviderBrandOptionsFromCatalog([createCatalogEntry()]);

    expect(options.map((option) => option.id)).toEqual(["gemini", "antigravity"]);
    expect(options.map((option) => option.routeProviderId)).toEqual(["gemini", "gemini"]);
    expect(options.map((option) => option.label)).toEqual(["Gemini", "Antigravity"]);
  });

  it("keeps antigravity visible in fallback state when gemini-backed oauth data exists", () => {
    const options = buildProviderBrandOptionsFromState(
      [
        {
          accountId: "gemini-a1",
          provider: "gemini",
          externalAccountId: null,
          email: "gemini@example.com",
          displayName: "Gemini Main",
          status: "enabled",
          disabledReason: null,
          routeConfig: null,
          routingState: null,
          chatgptWorkspaces: null,
          defaultChatgptWorkspaceId: null,
          metadata: {},
          createdAt: 10,
          updatedAt: 20,
        },
      ],
      []
    );

    expect(options.map((option) => option.id)).toContain("antigravity");
    expect(matchesProviderBrand("antigravity", "gemini")).toBe(true);
    expect(canonicalizeProviderBrandId("antigravity")).toBe("gemini");
  });

  it("duplicates gemini composer models into antigravity-branded options", () => {
    const models = expandComposerModelBrandOptions([createModel()]);

    expect(models.map((model) => model.id)).toEqual([
      "google::gemini-3.1-pro",
      "google::gemini-3.1-pro::brand:antigravity",
    ]);
    expect(models.map((model) => model.displayName)).toEqual([
      "Gemini 3.1 Pro",
      "Antigravity 3.1 Pro",
    ]);
    expect(models[1]?.provider).toBe("antigravity");
    expect(models[1]?.pool).toBe("antigravity");
  });

  it("normalizes anti-gravity model display names", () => {
    expect(
      applyModelBrandDisplay(
        createModel({
          id: "antigravity",
          model: "antigravity",
          displayName: "anti-gravity",
          provider: "google",
          pool: "gemini",
        })
      ).displayName
    ).toBe("Antigravity");
  });
});
