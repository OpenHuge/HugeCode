import { beforeEach, describe, expect, it } from "vitest";
import type { OAuthAccountSummary } from "./runtimeClient";
import {
  bindMockOAuthPoolAccount,
  listMockOAuthAccounts,
  removeMockOAuthAccount,
  reportMockOAuthRateLimit,
  replaceMockOAuthPoolMembers,
  selectMockOAuthPoolAccount,
  upsertMockOAuthAccount,
  upsertMockOAuthPool,
} from "./oauthBridgeFallbackCrud";
import { __resetMockOauthSessionFallbackForTests } from "./oauthBridge";
import {
  readMockOAuthPoolMembers,
  readMockOAuthPools,
  readMockProjectWorkspaceBindings,
} from "./oauthBridgeMockState";

const baseAccount = (overrides: Partial<OAuthAccountSummary> = {}): OAuthAccountSummary => ({
  accountId: "acct-1",
  provider: "codex",
  externalAccountId: null,
  email: "acct-1@example.com",
  displayName: "acct-1",
  status: "enabled",
  disabledReason: null,
  metadata: {},
  routeConfig: null,
  routingState: null,
  chatgptWorkspaces: null,
  defaultChatgptWorkspaceId: null,
  createdAt: 1,
  updatedAt: 1,
  ...overrides,
});

describe("oauthBridgeFallbackCrud", () => {
  beforeEach(() => {
    __resetMockOauthSessionFallbackForTests();
  });

  it("removes account references from pools and members", async () => {
    upsertMockOAuthAccount(baseAccount({ accountId: "acct-1" }));
    upsertMockOAuthAccount(baseAccount({ accountId: "acct-2" }));
    upsertMockOAuthPool({
      poolId: "pool-1",
      provider: "codex",
      name: "Pool",
      preferredAccountId: "acct-1",
    });
    replaceMockOAuthPoolMembers("pool-1", [{ accountId: "acct-1" }, { accountId: "acct-2" }]);

    expect(removeMockOAuthAccount("acct-1")).toBe(true);

    expect(readMockOAuthPools()).toEqual([
      expect.objectContaining({ poolId: "pool-1", preferredAccountId: null }),
    ]);
    expect(readMockOAuthPoolMembers()).toEqual({
      "pool-1": [expect.objectContaining({ accountId: "acct-2" })],
    });
  });

  it("prefers manual workspace binding over preferred account selection", async () => {
    upsertMockOAuthAccount(
      baseAccount({
        accountId: "acct-preferred",
        updatedAt: 10,
        defaultChatgptWorkspaceId: "ws-1",
      })
    );
    upsertMockOAuthAccount(
      baseAccount({
        accountId: "acct-manual",
        updatedAt: 1,
        defaultChatgptWorkspaceId: "ws-1",
      })
    );
    upsertMockOAuthPool({
      poolId: "pool-1",
      provider: "codex",
      name: "Pool",
      preferredAccountId: "acct-preferred",
    });
    replaceMockOAuthPoolMembers("pool-1", [
      { accountId: "acct-preferred" },
      { accountId: "acct-manual" },
    ]);
    const bound = bindMockOAuthPoolAccount({
      poolId: "pool-1",
      sessionId: "session-1",
      accountId: "acct-manual",
      chatgptWorkspaceId: "ws-1",
    });

    expect(bound).toEqual({
      poolId: "pool-1",
      account: expect.objectContaining({ accountId: "acct-manual" }),
      reason: "manual_binding",
    });
    expect(
      selectMockOAuthPoolAccount({
        poolId: "pool-1",
        sessionId: "session-1",
        chatgptWorkspaceId: "ws-1",
      })
    ).toEqual({
      poolId: "pool-1",
      account: expect.objectContaining({ accountId: "acct-manual" }),
      reason: "manual_binding",
    });
    expect(readMockProjectWorkspaceBindings()).toEqual({
      "pool-1::session-1::ws-1": "acct-manual",
    });
  });

  it("normalizes pool members when replacing fallback members", () => {
    const replaced = replaceMockOAuthPoolMembers("pool-1", [
      { accountId: "acct-1", weight: 0, priority: -5, position: -3, enabled: false },
    ]);

    expect(replaced).toEqual([
      expect.objectContaining({
        poolId: "pool-1",
        accountId: "acct-1",
        weight: 1,
        priority: 0,
        position: 0,
        enabled: false,
      }),
    ]);
  });

  it("records fallback rate-limit metadata on the matching account", () => {
    upsertMockOAuthAccount(baseAccount({ accountId: "acct-rate-limit" }));

    expect(
      reportMockOAuthRateLimit({
        accountId: "acct-rate-limit",
        modelId: "gpt-5",
        success: false,
        retryAfterSec: 30,
        resetAt: 123456,
        errorCode: "rate_limit_exceeded",
        errorMessage: "slow down",
      })
    ).toBe(true);

    expect(listMockOAuthAccounts("codex")).toEqual([
      expect.objectContaining({
        accountId: "acct-rate-limit",
        metadata: {
          rateLimits: {
            "gpt-5": expect.objectContaining({
              success: false,
              retryAfterSec: 30,
              resetAt: 123456,
              errorCode: "rate_limit_exceeded",
              errorMessage: "slow down",
            }),
          },
        },
      }),
    ]);
  });
});
