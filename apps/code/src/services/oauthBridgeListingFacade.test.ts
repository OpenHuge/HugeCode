import { describe, expect, it, vi } from "vitest";
import {
  getOAuthPrimaryAccount,
  listOAuthAccounts,
  listOAuthPoolMembers,
  listOAuthPools,
  type OAuthBridgeListingFacadeDeps,
} from "./oauthBridgeListingFacade";

function createBaseDeps(): OAuthBridgeListingFacadeDeps {
  const invokeWebRuntimeRpc: OAuthBridgeListingFacadeDeps["invokeWebRuntimeRpc"] = async <
    Result,
  >() => [] as unknown as Result;

  return {
    oauthAccountsRpcMethod: "code_oauth_accounts_list",
    oauthPrimaryAccountGetRpcMethod: "code_oauth_primary_account_get",
    oauthPoolsRpcMethod: "code_oauth_pools_list",
    oauthPoolMembersRpcMethod: "code_oauth_pool_members_list",
    webRuntimeOauthDirectRpcTimeoutMs: 1000,
    webRuntimeOauthFallbackTimeoutMs: 1000,
    isDesktopHostRuntime: () => false,
    shouldUseWebRuntimeDirectRpc: () => false,
    isWebRuntimeOauthCooldownActive: () => false,
    runWebRuntimeOAuthRequest: async (_key, request) => request(),
    awaitWebRuntimeWithFallbackTimeout: async (request) => request(undefined),
    invokeWebRuntimeRpc,
    getRuntimeClient: () => ({
      oauthAccounts: async () => [],
      oauthPrimaryAccountGet: async () => ({
        provider: "codex",
        accountId: null,
        account: null,
        defaultPoolId: "pool-codex",
        routeAccountId: null,
        inSync: true,
        createdAt: 0,
        updatedAt: 0,
      }),
      oauthPools: async () => [],
      oauthPoolMembers: async () => [],
    }),
    clearWebRuntimeOauthCooldown: vi.fn(),
    clearMockOauthFallbackActive: vi.fn(),
    markWebRuntimeOauthCooldown: vi.fn(),
    listMockOAuthAccounts: () => [],
    listMockOAuthPools: () => [],
    listMockOAuthPoolMembers: () => [],
    normalizeOAuthAccountSummary: (account) => account,
  };
}

describe("oauthBridgeListingFacade", () => {
  it("fails closed when web oauth cooldown is active", async () => {
    const deps = createBaseDeps();
    deps.isWebRuntimeOauthCooldownActive = () => true;

    await expect(listOAuthAccounts(deps, "codex")).rejects.toThrow(
      /durable oauth persistence is unavailable/i
    );
  });

  it("normalizes runtime account results when web runtime listing succeeds", async () => {
    const deps = createBaseDeps();
    deps.getRuntimeClient = () => ({
      oauthAccounts: async () => [
        {
          accountId: "runtime-1",
          provider: "codex",
          externalAccountId: null,
          email: "runtime@example.com",
          displayName: "Runtime",
          status: "enabled",
          disabledReason: null,
          routeConfig: null,
          routingState: null,
          chatgptWorkspaces: null,
          defaultChatgptWorkspaceId: null,
          metadata: {},
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      oauthPrimaryAccountGet: async () => ({
        provider: "codex",
        accountId: null,
        account: null,
        defaultPoolId: "pool-codex",
        routeAccountId: null,
        inSync: true,
        createdAt: 0,
        updatedAt: 0,
      }),
      oauthPools: async () => [],
      oauthPoolMembers: async () => [],
    });
    deps.normalizeOAuthAccountSummary = (account) => ({ ...account, displayName: "Normalized" });

    await expect(listOAuthAccounts(deps, "codex", { usageRefresh: "force" })).resolves.toEqual([
      expect.objectContaining({ displayName: "Normalized" }),
    ]);
  });

  it("fails closed instead of returning mock pools and members after web runtime errors", async () => {
    const deps = createBaseDeps();
    deps.getRuntimeClient = () => ({
      oauthAccounts: async () => [],
      oauthPrimaryAccountGet: async () => ({
        provider: "codex",
        accountId: null,
        account: null,
        defaultPoolId: "pool-codex",
        routeAccountId: null,
        inSync: true,
        createdAt: 0,
        updatedAt: 0,
      }),
      oauthPools: async () => {
        throw new Error("runtime unavailable");
      },
      oauthPoolMembers: async () => {
        throw new Error("runtime unavailable");
      },
    });
    await expect(listOAuthPools(deps, "codex")).rejects.toThrow(
      /durable oauth persistence is unavailable/i
    );
    await expect(listOAuthPoolMembers(deps, "pool-1")).rejects.toThrow(
      /durable oauth persistence is unavailable/i
    );
  });

  it("fails closed for oauth primary account reads during web cooldown", async () => {
    const deps = createBaseDeps();
    deps.isWebRuntimeOauthCooldownActive = () => true;

    await expect(getOAuthPrimaryAccount(deps, "codex")).rejects.toThrow(
      /durable oauth persistence is unavailable/i
    );
  });

  it("reads oauth primary account from runtime when available", async () => {
    const deps = createBaseDeps();
    deps.getRuntimeClient = () => ({
      oauthAccounts: async () => [],
      oauthPrimaryAccountGet: async () => ({
        provider: "codex",
        accountId: "runtime-primary-1",
        account: null,
        defaultPoolId: "pool-codex",
        routeAccountId: "runtime-primary-1",
        inSync: true,
        createdAt: 1,
        updatedAt: 2,
      }),
      oauthPools: async () => [],
      oauthPoolMembers: async () => [],
    });

    await expect(getOAuthPrimaryAccount(deps, "codex")).resolves.toEqual(
      expect.objectContaining({
        provider: "codex",
        accountId: "runtime-primary-1",
        inSync: true,
      })
    );
  });
});
