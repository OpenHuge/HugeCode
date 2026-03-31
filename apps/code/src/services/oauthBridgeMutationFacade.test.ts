import { describe, expect, it, vi } from "vitest";
import {
  applyOAuthPool,
  removeOAuthAccount,
  reportOAuthRateLimit,
  setOAuthPrimaryAccount,
  upsertOAuthAccount,
  type OAuthBridgeMutationFacadeDeps,
} from "./oauthBridgeMutationFacade";
import type { OAuthPoolMemberInput } from "./runtimeClient";

function createBaseDeps(): OAuthBridgeMutationFacadeDeps {
  const invokeWebRuntimeRpc: OAuthBridgeMutationFacadeDeps["invokeWebRuntimeRpc"] = async <
    Result,
  >() => ({ pool: null, members: [] }) as unknown as Result;

  return {
    oauthPoolApplyRpcMethod: "code_oauth_pool_apply",
    oauthPrimaryAccountSetRpcMethod: "code_oauth_primary_account_set",
    webRuntimeOauthDirectRpcTimeoutMs: 1000,
    webRuntimeOauthFallbackTimeoutMs: 1000,
    isDesktopHostRuntime: () => false,
    shouldUseWebRuntimeDirectRpc: () => false,
    runWebRuntimeOAuthRequest: async (_key, request) => request(),
    awaitWebRuntimeWithFallbackTimeout: async (request) => request(undefined),
    invokeWebRuntimeRpc,
    getRuntimeClient: () => ({
      oauthUpsertAccount: async () => {
        throw new Error("unimplemented");
      },
      oauthRemoveAccount: async () => {
        throw new Error("unimplemented");
      },
      oauthAccounts: async () => [],
      oauthPrimaryAccountSet: async () => ({
        provider: "codex",
        accountId: null,
        account: null,
        defaultPoolId: "pool-codex",
        routeAccountId: null,
        inSync: true,
        createdAt: 0,
        updatedAt: 0,
      }),
      oauthUpsertPool: async () => {
        throw new Error("unimplemented");
      },
      oauthApplyPool: async () => {
        throw new Error("unimplemented");
      },
      oauthRemovePool: async () => {
        throw new Error("unimplemented");
      },
      oauthReplacePoolMembers: async () => {
        throw new Error("unimplemented");
      },
      oauthSelectPoolAccount: async () => null,
      oauthBindPoolAccount: async () => null,
      oauthReportRateLimit: async () => false,
    }),
    clearWebRuntimeOauthRequestInFlight: vi.fn(),
    clearWebRuntimeOauthCooldown: vi.fn(),
    clearMockOauthFallbackActive: vi.fn(),
    markWebRuntimeOauthCooldown: vi.fn(),
    normalizeOAuthAccountSummary: (account) => account,
    upsertMockOAuthAccount: (input) => ({
      accountId: input.accountId ?? "mock-account",
      provider: input.provider,
      externalAccountId: null,
      email: input.email ?? null,
      displayName: input.displayName ?? null,
      status: input.status ?? "enabled",
      disabledReason: null,
      routeConfig: null,
      routingState: null,
      chatgptWorkspaces: null,
      defaultChatgptWorkspaceId: null,
      metadata: input.metadata ?? {},
      createdAt: 1,
      updatedAt: 1,
    }),
    listMockOAuthAccounts: () => [],
    listMockOAuthPools: () => [],
    syncMockOAuthAccounts: vi.fn(),
    removeMockOAuthAccount: vi.fn(() => true),
    upsertMockOAuthPool: vi.fn((input) => ({
      poolId: input.poolId,
      provider: input.provider,
      name: input.name,
      strategy: input.strategy ?? "round_robin",
      stickyMode: input.stickyMode ?? "cache_first",
      preferredAccountId: input.preferredAccountId ?? null,
      enabled: input.enabled ?? true,
      metadata: input.metadata ?? {},
      createdAt: 1,
      updatedAt: 1,
    })),
    replaceMockOAuthPoolMembers: vi.fn((poolId: string, members: OAuthPoolMemberInput[]) =>
      members.map((member, index: number) => ({
        poolId,
        accountId: member.accountId,
        weight: member.weight ?? 1,
        priority: member.priority ?? index,
        position: member.position ?? index,
        enabled: member.enabled ?? true,
        createdAt: 1,
        updatedAt: 1,
      }))
    ),
    removeMockOAuthPool: vi.fn(() => true),
    selectMockOAuthPoolAccount: vi.fn(() => null),
    bindMockOAuthPoolAccount: vi.fn(() => null),
    reportMockOAuthRateLimit: vi.fn(() => true),
    normalizeCaughtOauthError: (error) =>
      error instanceof Error ? error : new Error(String(error)),
    readRuntimeErrorCode: () => null,
    runtimePoolVersionMismatchCode: "runtime.approval.poolVersionMismatch",
  };
}

describe("oauthBridgeMutationFacade", () => {
  it("normalizes runtime account results on account upsert", async () => {
    const deps = createBaseDeps();
    deps.getRuntimeClient = () => ({
      oauthUpsertAccount: async () => ({
        accountId: "acct-1",
        provider: "codex",
        externalAccountId: null,
        email: "user@example.com",
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
      }),
      oauthRemoveAccount: async () => {
        throw new Error("unimplemented");
      },
      oauthAccounts: async () => [],
      oauthPrimaryAccountSet: async () => ({
        provider: "codex",
        accountId: null,
        account: null,
        defaultPoolId: "pool-codex",
        routeAccountId: null,
        inSync: true,
        createdAt: 0,
        updatedAt: 0,
      }),
      oauthUpsertPool: async () => {
        throw new Error("unimplemented");
      },
      oauthApplyPool: async () => {
        throw new Error("unimplemented");
      },
      oauthRemovePool: async () => {
        throw new Error("unimplemented");
      },
      oauthReplacePoolMembers: async () => {
        throw new Error("unimplemented");
      },
      oauthSelectPoolAccount: async () => null,
      oauthBindPoolAccount: async () => null,
      oauthReportRateLimit: async () => false,
    });
    deps.normalizeOAuthAccountSummary = (account) => ({ ...account, displayName: "Normalized" });

    await expect(
      upsertOAuthAccount(deps, {
        accountId: "acct-1",
        provider: "codex",
        status: "enabled",
        metadata: {},
      })
    ).resolves.toEqual(expect.objectContaining({ displayName: "Normalized" }));
  });

  it("fails closed for account removal when web runtime oauth persistence is unavailable", async () => {
    const deps = createBaseDeps();
    deps.getRuntimeClient = () => ({
      oauthRemoveAccount: async () => {
        throw new Error("runtime unavailable");
      },
      oauthAccounts: async () => [
        {
          accountId: "acct-1",
          provider: "codex",
          externalAccountId: null,
          email: "user@example.com",
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
      oauthPrimaryAccountSet: async () => ({
        provider: "codex",
        accountId: null,
        account: null,
        defaultPoolId: "pool-codex",
        routeAccountId: null,
        inSync: true,
        createdAt: 0,
        updatedAt: 0,
      }),
      oauthUpsertAccount: async () => {
        throw new Error("unimplemented");
      },
      oauthUpsertPool: async () => {
        throw new Error("unimplemented");
      },
      oauthApplyPool: async () => {
        throw new Error("unimplemented");
      },
      oauthRemovePool: async () => {
        throw new Error("unimplemented");
      },
      oauthReplacePoolMembers: async () => {
        throw new Error("unimplemented");
      },
      oauthSelectPoolAccount: async () => null,
      oauthBindPoolAccount: async () => null,
      oauthReportRateLimit: async () => false,
    });
    const syncMockOAuthAccounts = vi.fn();
    deps.syncMockOAuthAccounts = syncMockOAuthAccounts;
    const removeMockOAuthAccount = vi.fn(() => true);
    deps.removeMockOAuthAccount = removeMockOAuthAccount;

    await expect(removeOAuthAccount(deps, "acct-1")).rejects.toThrow(
      /durable oauth persistence is unavailable/i
    );
    expect(syncMockOAuthAccounts).not.toHaveBeenCalled();
    expect(removeMockOAuthAccount).not.toHaveBeenCalled();
  });

  it("fails closed for pool apply and rate-limit reporting in web mode", async () => {
    const deps = createBaseDeps();
    deps.getRuntimeClient = () => ({
      oauthUpsertAccount: async () => {
        throw new Error("unimplemented");
      },
      oauthRemoveAccount: async () => {
        throw new Error("unimplemented");
      },
      oauthAccounts: async () => [],
      oauthPrimaryAccountSet: async () => {
        throw new Error("runtime unavailable");
      },
      oauthUpsertPool: async () => {
        throw new Error("unimplemented");
      },
      oauthApplyPool: async () => {
        throw new Error("runtime unavailable");
      },
      oauthRemovePool: async () => {
        throw new Error("unimplemented");
      },
      oauthReplacePoolMembers: async () => {
        throw new Error("unimplemented");
      },
      oauthSelectPoolAccount: async () => null,
      oauthBindPoolAccount: async () => null,
      oauthReportRateLimit: async () => {
        throw new Error("runtime unavailable");
      },
    });

    await expect(
      applyOAuthPool(deps, {
        pool: { poolId: "pool-1", provider: "codex", name: "Pool" },
        members: [{ accountId: "acct-1", weight: 1, priority: 0, position: 0, enabled: true }],
      })
    ).rejects.toThrow(/durable oauth persistence is unavailable/i);
    await expect(
      reportOAuthRateLimit(deps, { accountId: "acct-1", retryAfterSec: 30, success: false })
    ).rejects.toThrow(/durable oauth persistence is unavailable/i);
  });

  it("fails closed when setting oauth primary account in web mode without runtime persistence", async () => {
    const deps = createBaseDeps();
    deps.getRuntimeClient = () => ({
      oauthUpsertAccount: async () => {
        throw new Error("unimplemented");
      },
      oauthRemoveAccount: async () => {
        throw new Error("unimplemented");
      },
      oauthAccounts: async () => [],
      oauthPrimaryAccountSet: async () => {
        throw new Error("runtime unavailable");
      },
      oauthUpsertPool: async () => {
        throw new Error("unimplemented");
      },
      oauthApplyPool: async () => {
        throw new Error("unimplemented");
      },
      oauthRemovePool: async () => {
        throw new Error("unimplemented");
      },
      oauthReplacePoolMembers: async () => {
        throw new Error("unimplemented");
      },
      oauthSelectPoolAccount: async () => null,
      oauthBindPoolAccount: async () => null,
      oauthReportRateLimit: async () => false,
    });
    await expect(
      setOAuthPrimaryAccount(deps, { provider: "codex", accountId: "acct-primary" })
    ).rejects.toThrow(/durable oauth persistence is unavailable/i);
    expect(deps.upsertMockOAuthPool).not.toHaveBeenCalled();
  });
});
