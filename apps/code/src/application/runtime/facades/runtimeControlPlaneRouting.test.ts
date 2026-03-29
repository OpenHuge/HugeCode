import { describe, expect, it } from "vitest";
import type {
  OAuthAccountSummary,
  OAuthPoolSummary,
  RuntimeProviderCatalogEntry,
} from "@ku0/code-runtime-host-contract";
import {
  resolveExplicitRuntimeControlPlaneRoute,
  resolveRuntimeControlPlaneModelRoute,
  resolveRuntimeControlPlaneRouteSelection,
} from "./runtimeControlPlaneRouting";

const PROVIDERS: RuntimeProviderCatalogEntry[] = [
  {
    providerId: "openai",
    displayName: "OpenAI",
    pool: "codex",
    oauthProviderId: "codex",
    aliases: ["openai", "codex"],
    defaultModelId: "gpt-5.4",
    available: true,
    supportsNative: true,
    supportsOpenaiCompat: true,
    registryVersion: "1",
  },
  {
    providerId: "anthropic",
    displayName: "Claude Code",
    pool: "claude",
    oauthProviderId: "claude_code",
    aliases: ["anthropic", "claude", "claude_code"],
    defaultModelId: "claude-sonnet-4.5",
    available: true,
    supportsNative: true,
    supportsOpenaiCompat: false,
    registryVersion: "1",
  },
  {
    providerId: "local",
    displayName: "Native runtime",
    pool: null,
    oauthProviderId: null,
    aliases: ["local"],
    defaultModelId: null,
    available: true,
    supportsNative: true,
    supportsOpenaiCompat: false,
    registryVersion: "1",
  },
];

function buildAccount(provider: OAuthAccountSummary["provider"]): OAuthAccountSummary {
  return {
    accountId: `${provider}-account-1`,
    provider,
    externalAccountId: null,
    status: "enabled",
    displayName: `${provider} account`,
    email: `${provider}@example.com`,
    disabledReason: null,
    routeConfig: {
      schedulable: true,
    },
    routingState: {
      credentialReady: true,
    },
    metadata: {},
    createdAt: 1,
    updatedAt: 1,
  };
}

function buildPool(provider: OAuthPoolSummary["provider"], poolId: string): OAuthPoolSummary {
  return {
    poolId,
    provider,
    name: poolId,
    strategy: "round_robin",
    stickyMode: "balance",
    preferredAccountId: null,
    enabled: true,
    metadata: {},
    createdAt: 1,
    updatedAt: 1,
  };
}

describe("runtimeControlPlaneRouting", () => {
  it("marks automatic routing blocked when no provider family is ready", () => {
    const selection = resolveRuntimeControlPlaneRouteSelection({
      selectedRoute: "auto",
      providers: PROVIDERS.filter((provider) => provider.providerId !== "local"),
      accounts: [],
      pools: [],
    });

    expect(selection.selected.value).toBe("auto");
    expect(selection.selected.ready).toBe(false);
    expect(selection.selected.detail).toContain("0/2 provider routes ready");
  });

  it("keeps automatic routing launchable when local runtime remains available", () => {
    const selection = resolveRuntimeControlPlaneRouteSelection({
      selectedRoute: "auto",
      providers: PROVIDERS,
      accounts: [],
      pools: [],
    });

    expect(selection.selected.ready).toBe(false);
    expect(selection.selected.readiness).toBe("attention");
    expect(selection.selected.launchAllowed).toBe(true);
    expect(selection.selected.detail).toContain("fall back to local/native execution");
  });

  it("resolves model-selected OpenAI routing through the provider catalog and OAuth readiness", () => {
    const route = resolveRuntimeControlPlaneModelRoute({
      model: {
        id: "gpt-5.4",
        model: "gpt-5.4",
        provider: "openai",
        pool: "codex",
      },
      providers: PROVIDERS,
      accounts: [buildAccount("codex")],
      pools: [buildPool("codex", "pool-codex")],
    });

    expect(route).toMatchObject({
      providerId: "openai",
      oauthProviderId: "codex",
      pool: "codex",
      readiness: "ready",
      ready: true,
      source: "model_selection",
      preferredBackendIds: null,
      resolvedBackendId: null,
    });
  });

  it("resolves model-selected Claude routing and reports blocked readiness without pools", () => {
    const route = resolveRuntimeControlPlaneModelRoute({
      model: {
        id: "claude-sonnet-4.5",
        model: "claude-sonnet-4.5",
        provider: "claude",
        pool: "claude",
      },
      providers: PROVIDERS,
      accounts: [],
      pools: [],
    });

    expect(route).toMatchObject({
      providerId: "anthropic",
      oauthProviderId: "claude_code",
      readiness: "blocked",
      ready: false,
      launchAllowed: false,
      source: "model_selection",
    });
    expect(route?.detail).toContain("Enable at least one pool");
  });

  it("keeps explicit provider launch routes aligned with the same readiness calculation", () => {
    const route = resolveExplicitRuntimeControlPlaneRoute({
      routeValue: "anthropic",
      providers: PROVIDERS,
      accounts: [buildAccount("claude_code")],
      pools: [buildPool("claude_code", "pool-claude")],
    });

    expect(route.source).toBe("explicit_route");
    expect(route.providerId).toBe("anthropic");
    expect(route.ready).toBe(true);
  });

  it("keeps explicit provider routes blocked when credentials are missing", () => {
    const route = resolveExplicitRuntimeControlPlaneRoute({
      routeValue: "openai",
      providers: PROVIDERS,
      accounts: [
        {
          ...buildAccount("codex"),
          routingState: {
            credentialReady: false,
          },
          metadata: {},
        },
      ],
      pools: [buildPool("codex", "pool-codex")],
    });

    expect(route).toMatchObject({
      readiness: "blocked",
      launchAllowed: false,
      blockingReason: "Sign in or configure credentials for at least one enabled account.",
    });
  });
});
