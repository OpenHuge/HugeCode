// @vitest-environment jsdom

import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useCodexAccountsDerivedState } from "./useCodexAccountsDerivedState";
import type { OAuthAccountSummary } from "../../../../../application/runtime/ports/tauriOauth";
import type { ProviderOption } from "../settingsCodexAccountsCardUtils";

const providerOptions: ProviderOption[] = [
  {
    id: "codex",
    routeProviderId: "codex",
    label: "Codex",
    available: true,
    supportsNative: true,
    supportsOpenaiCompat: true,
  },
];

function createAccount(): OAuthAccountSummary {
  return {
    accountId: "acct-codex-1",
    provider: "codex",
    externalAccountId: "chatgpt-acct-1",
    email: "coder@example.com",
    displayName: "Coder",
    status: "enabled",
    disabledReason: null,
    routeConfig: null,
    routingState: null,
    chatgptWorkspaces: [
      { workspaceId: "org-alpha", title: "Alpha Team", role: "owner", isDefault: true },
      { workspaceId: "org-beta", title: "Beta Org", role: "member", isDefault: false },
    ],
    defaultChatgptWorkspaceId: "org-alpha",
    metadata: {},
    createdAt: 100,
    updatedAt: 200,
  };
}

describe("useCodexAccountsDerivedState", () => {
  it("matches account search against ChatGPT workspace id, title, and role", () => {
    const account = createAccount();
    const buildResult = (accountSearchQuery: string) =>
      renderHook(() =>
        useCodexAccountsDerivedState({
          accounts: [account],
          pools: [],
          providerOptions,
          accountProviderFilter: "all",
          accountStatusFilter: "all",
          accountSearchQuery,
          poolProviderFilter: "all",
          selectedAccountIds: [],
          selectedPoolIds: [],
          poolProviderDraft: "codex",
          poolMemberAccountIdsDraft: [],
        })
      ).result.current;

    expect(buildResult("org-alpha").visibleAccounts).toHaveLength(1);
    expect(buildResult("alpha team").visibleAccounts).toHaveLength(1);
    expect(buildResult("owner").visibleAccounts).toHaveLength(1);
    expect(buildResult("missing-workspace").visibleAccounts).toHaveLength(0);
  });

  it("treats antigravity filters as gemini-backed account and pool matches", () => {
    const { result } = renderHook(() =>
      useCodexAccountsDerivedState({
        accounts: [
          {
            ...createAccount(),
            accountId: "acct-gemini-1",
            provider: "gemini",
          },
        ],
        pools: [
          {
            poolId: "pool-gemini",
            provider: "gemini",
            name: "Gemini pool",
            strategy: "round_robin",
            stickyMode: "cache_first",
            preferredAccountId: null,
            enabled: true,
            metadata: {},
            createdAt: 1,
            updatedAt: 2,
          },
        ],
        providerOptions: [
          ...providerOptions,
          {
            id: "antigravity",
            routeProviderId: "gemini",
            label: "Antigravity",
            available: true,
            supportsNative: true,
            supportsOpenaiCompat: true,
          },
        ],
        accountProviderFilter: "antigravity",
        accountStatusFilter: "all",
        accountSearchQuery: "",
        poolProviderFilter: "antigravity",
        selectedAccountIds: [],
        selectedPoolIds: [],
        poolProviderDraft: "antigravity",
        poolMemberAccountIdsDraft: ["acct-gemini-1"],
      })
    );

    expect(result.current.visibleAccounts.map((account) => account.accountId)).toEqual([
      "acct-gemini-1",
    ]);
    expect(result.current.visiblePools.map((pool) => pool.poolId)).toEqual(["pool-gemini"]);
    expect(result.current.providerAccounts.map((account) => account.accountId)).toEqual([
      "acct-gemini-1",
    ]);
  });
});
