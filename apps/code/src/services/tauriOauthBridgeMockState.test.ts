import { describe, expect, it } from "vitest";
import type { OAuthAccountSummary } from "./runtimeClient";
import {
  clearMockOauthFallbackActive,
  isMockOauthFallbackActive,
  readMockOAuthAccounts,
  resetMockOauthSessionFallbackState,
  writeMockOAuthAccounts,
} from "./tauriOauthBridgeMockState";

function createAccount(overrides: Partial<OAuthAccountSummary> = {}): OAuthAccountSummary {
  return {
    accountId: "account-1",
    provider: "codex",
    externalAccountId: null,
    email: "person@example.com",
    displayName: "Person",
    status: "enabled",
    disabledReason: null,
    routeConfig: null,
    routingState: null,
    chatgptWorkspaces: null,
    defaultChatgptWorkspaceId: null,
    metadata: {},
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

describe("tauriOauthBridgeMockState", () => {
  it("returns cloned account snapshots and resets fallback state", () => {
    resetMockOauthSessionFallbackState();
    writeMockOAuthAccounts([createAccount()]);

    const accounts = readMockOAuthAccounts();
    expect(isMockOauthFallbackActive()).toBe(true);

    accounts[0]!.email = "changed@example.com";
    expect(readMockOAuthAccounts()[0]!.email).toBe("person@example.com");

    clearMockOauthFallbackActive();
    expect(isMockOauthFallbackActive()).toBe(false);

    resetMockOauthSessionFallbackState();
    expect(readMockOAuthAccounts()).toEqual([]);
  });
});
