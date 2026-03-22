import { describe, expect, it } from "vitest";
import {
  buildRuntimeProviderRoutingHealth,
  hasRuntimeRoutingCredential,
} from "./runtimeRoutingHealth";

describe("runtimeRoutingHealth", () => {
  it("treats api-key and local-cli metadata as routing credentials", () => {
    expect(
      hasRuntimeRoutingCredential({
        accountId: "account-api-key",
        provider: "codex",
        externalAccountId: null,
        email: null,
        displayName: null,
        status: "enabled",
        disabledReason: null,
        metadata: {
          apiKeyConfigured: true,
        },
        createdAt: 1,
        updatedAt: 1,
      })
    ).toBe(true);

    expect(
      hasRuntimeRoutingCredential({
        accountId: "account-cli",
        provider: "codex",
        externalAccountId: null,
        email: null,
        displayName: null,
        status: "enabled",
        disabledReason: null,
        metadata: {
          localCliManaged: true,
          source: "local_codex_cli_auth",
          credentialAvailable: true,
        },
        createdAt: 1,
        updatedAt: 1,
      })
    ).toBe(true);
  });

  it("builds routing guidance from provider, account, and pool state", () => {
    const health = buildRuntimeProviderRoutingHealth({
      providers: [
        {
          providerId: "codex",
          label: "Codex",
          available: true,
        },
        {
          providerId: "claude_code",
          label: "Claude Code",
          available: false,
        },
      ],
      accounts: [
        {
          accountId: "codex-enabled",
          provider: "codex",
          externalAccountId: null,
          email: null,
          displayName: null,
          status: "enabled",
          disabledReason: null,
          metadata: {
            apiKeyConfigured: true,
          },
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      pools: [
        {
          poolId: "pool-codex",
          provider: "codex",
          name: "Codex pool",
          strategy: "round_robin",
          stickyMode: "cache_first",
          preferredAccountId: null,
          enabled: true,
          metadata: {},
          createdAt: 1,
          updatedAt: 1,
        },
      ],
    });

    expect(health).toEqual([
      expect.objectContaining({
        providerId: "codex",
        poolRoutingReady: true,
        enabledAccounts: 1,
        credentialReadyAccounts: 1,
        enabledPools: 1,
        recommendation: null,
      }),
      expect.objectContaining({
        providerId: "claude_code",
        poolRoutingReady: false,
        recommendation: "Runtime provider catalog currently marks this provider unavailable.",
      }),
    ]);
  });
});
