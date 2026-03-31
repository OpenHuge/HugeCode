import { describe, expect, it } from "vitest";
import { normalizeOAuthAccountSummary } from "./oauthBridgeNormalization";
import type { OAuthAccountSummary } from "./runtimeClient";

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

describe("oauthBridgeNormalization", () => {
  it("promotes route, routing, and ChatGPT workspace state from metadata into normalized fields", () => {
    const normalized = normalizeOAuthAccountSummary(
      createAccount({
        routingState: {
          credentialReady: true,
          lastRoutingError: "rate_limited",
          rateLimitedUntil: 42,
          overloadedUntil: null,
          tempUnschedulableUntil: null,
          tempUnschedulableReason: null,
        },
        metadata: {
          compat_base_url: "https://example.com///",
          proxy_id: "proxy-a",
          credential_ready: true,
          chatgpt_workspaces: [
            {
              workspace_id: "org-a",
              name: "Org A",
              default: true,
            },
          ],
          default_chatgpt_workspace_id: "org-a",
        },
      })
    );

    expect(normalized.routeConfig).toEqual({
      compatBaseUrl: "https://example.com",
      proxyId: null,
      priority: null,
      concurrencyLimit: null,
      schedulable: null,
    });
    expect(normalized.routingState).toEqual({
      credentialReady: true,
      lastRoutingError: "rate_limited",
      rateLimitedUntil: 42,
      overloadedUntil: null,
      tempUnschedulableUntil: null,
      tempUnschedulableReason: null,
    });
    expect(normalized.chatgptWorkspaces).toEqual([
      {
        workspaceId: "org-a",
        title: "Org A",
        role: null,
        isDefault: true,
      },
    ]);
    expect(normalized.defaultChatgptWorkspaceId).toBe("org-a");
    expect(normalized.metadata).toMatchObject({
      compatBaseUrl: "https://example.com",
      defaultChatgptWorkspaceId: "org-a",
      routeConfig: {
        compatBaseUrl: "https://example.com",
      },
      routingState: {
        credentialReady: true,
        lastRoutingError: "rate_limited",
        rateLimitedUntil: 42,
      },
      chatgptWorkspaces: [
        {
          workspaceId: "org-a",
          title: "Org A",
          role: null,
          isDefault: true,
        },
      ],
    });
  });
});
