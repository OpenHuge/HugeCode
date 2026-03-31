import { describe, expect, it, vi } from "vitest";
import {
  cancelCodexLogin,
  resolveChatgptAuthTokensRefreshResponse,
  runCodexLogin,
  type OAuthBridgeAuthFacadeDeps,
} from "./oauthBridgeAuthFacade";
import type { OAuthAccountSummary, RuntimeClient } from "./runtimeClient";

function makeOAuthAccount(overrides: Partial<OAuthAccountSummary> = {}): OAuthAccountSummary {
  return {
    accountId: "acct-1",
    provider: "codex",
    externalAccountId: "ext-1",
    email: "user@example.com",
    displayName: "User",
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

function createRuntimeClientMock(
  overrides: Partial<
    Pick<
      RuntimeClient,
      | "oauthCodexLoginStart"
      | "oauthCodexLoginCancel"
      | "oauthChatgptAuthTokensRefresh"
      | "oauthSelectPoolAccount"
    >
  > = {}
) {
  return {
    oauthCodexLoginStart: async () => ({
      loginId: "login-tauri-1",
      authUrl: "https://auth.openai.com/oauth/authorize?state=tauri-test",
    }),
    oauthCodexLoginCancel: async () => ({
      canceled: true,
      status: "canceled",
    }),
    oauthChatgptAuthTokensRefresh: async () => null,
    oauthSelectPoolAccount: async () => null,
    ...overrides,
  };
}

function createBaseDeps(): OAuthBridgeAuthFacadeDeps {
  return {
    webRuntimeRpcEndpointEnvKey: "VITE_CODE_RUNTIME_GATEWAY_WEB_ENDPOINT",
    isTauri: () => false,
    isRecord: (value: unknown): value is Record<string, unknown> =>
      Boolean(value) && typeof value === "object" && !Array.isArray(value),
    normalizeNullableText: (value: unknown) =>
      typeof value === "string" ? (value.trim() ? value.trim() : null) : null,
    listOAuthAccounts: vi.fn(async () => []),
    listOAuthPools: vi.fn(async () => []),
    pickPoolPreferredAccount: (accounts) => accounts[0] ?? null,
    pickPreferredOAuthAccount: (accounts) => accounts[0] ?? null,
    accountHasRoutingCredential: () => true,
    createMockOauthEntityId: (prefix: string) => `${prefix}-1`,
    resolveWebRuntimeControlEndpoint: () => null,
    runWebRuntimeOAuthRequest: async (_key, request) => request(),
    awaitWebRuntimeWithFallbackTimeout: async (request) => request(undefined),
    verifyWorkspaceBinding: vi.fn(async () => false),
    clearWebRuntimeOauthCooldown: vi.fn(),
    markWebRuntimeOauthCooldown: vi.fn(),
    shouldUseWebRuntimeDirectRpc: () => false,
    invokeWebRuntimeRpc: async <Result>() => null as Result,
    getRuntimeClient: () => createRuntimeClientMock(),
    isRuntimeMethodUnsupportedError: () => false,
    logRuntimeWarning: vi.fn(),
    getErrorMessage: (error: unknown) => (error instanceof Error ? error.message : String(error)),
    runtimeMethodOauthChatgptAuthTokensRefresh: "code_oauth_chatgpt_auth_tokens_refresh",
    webRuntimeOauthDirectRpcTimeoutMs: 1000,
    webRuntimeOauthFallbackTimeoutMs: 1000,
  };
}

describe("oauthBridgeAuthFacade", () => {
  it("returns immediate success for web codex login only after workspace binding is verified", async () => {
    const deps = createBaseDeps();
    deps.listOAuthAccounts = vi.fn(async () => [
      makeOAuthAccount({
        metadata: { apiKeyConfigured: true },
      }),
    ]);
    deps.verifyWorkspaceBinding = vi.fn(async () => true);

    await expect(runCodexLogin(deps, "ws-1")).resolves.toEqual(
      expect.objectContaining({
        loginId: "codex-login-1",
        authUrl: "",
        immediateSuccess: true,
      })
    );
  });

  it("does not short-circuit to immediate success when a routable account exists without workspace binding", async () => {
    const deps = createBaseDeps();
    deps.listOAuthAccounts = vi.fn(async () => [
      makeOAuthAccount({
        metadata: { apiKeyConfigured: true },
      }),
    ]);
    deps.verifyWorkspaceBinding = vi.fn(async () => false);
    deps.resolveWebRuntimeControlEndpoint = () => "https://runtime.example.test/oauth/codex/start";
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              loginId: "login-1",
              authUrl: "https://auth.openai.com/oauth/authorize",
            }),
            {
              status: 200,
              headers: { "content-type": "application/json" },
            }
          )
      )
    );

    await expect(runCodexLogin(deps, "ws-1")).resolves.toEqual(
      expect.objectContaining({
        loginId: "login-1",
        authUrl: "https://auth.openai.com/oauth/authorize",
      })
    );
  });

  it("fails closed when web codex cancel cannot resolve a control endpoint", async () => {
    const deps = createBaseDeps();

    await expect(cancelCodexLogin(deps, "ws-1")).rejects.toThrow(
      /durable oauth persistence is unavailable/i
    );
  });

  it("falls back to oauth account metadata when chatgpt refresh RPC is unavailable", async () => {
    const deps = createBaseDeps();
    deps.getRuntimeClient = () =>
      createRuntimeClientMock({
        oauthChatgptAuthTokensRefresh: async () => {
          throw new Error("unsupported");
        },
      });
    deps.isRuntimeMethodUnsupportedError = () => true;
    deps.listOAuthAccounts = vi.fn(async () => [
      makeOAuthAccount({
        accountId: "codex-1",
        externalAccountId: "chatgpt-account-1",
        metadata: {
          accessToken: "token-1",
          chatgptAccountId: "chatgpt-account-1",
          chatgptPlanType: "plus",
        },
      }),
    ]);

    await expect(
      resolveChatgptAuthTokensRefreshResponse(deps, { previousAccountId: "chatgpt-account-1" })
    ).resolves.toEqual({
      accessToken: "token-1",
      chatgptAccountId: "chatgpt-account-1",
      chatgptPlanType: "plus",
      sourceAccountId: "codex-1",
    });
  });
});
