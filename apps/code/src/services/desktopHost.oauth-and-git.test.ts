import {
  invoke,
  invokeDesktopCommand,
  isDesktopHostRuntime,
} from "../application/runtime/ports/desktopHostCore";
import { listen } from "../application/runtime/ports/desktopHostEvent";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  detectRuntimeMode,
  getRuntimeClient,
  type OAuthAccountSummary,
  readRuntimeCapabilitiesSummary,
} from "./runtimeClient";
import {
  __resetLocalUsageSnapshotCacheForTests,
  __resetWebRuntimeOauthFallbackStateForTests,
  archiveThread,
  checkoutGitBranch,
  compactThread,
  createGitBranch,
  forkThread,
  getGitDiffs,
  getGitHubIssues,
  getGitLog,
  getGitStatus,
  getInstructionSkill,
  getOAuthPrimaryAccount,
  getSkillsList,
  listGitBranches,
  listMcpServerStatus,
  listOAuthAccounts,
  listThreads,
  listWorkspaces,
  resolveChatgptAuthTokensRefreshResponse,
  resumeThread,
  runCodexLogin,
  setOAuthPrimaryAccount,
  setThreadName,
  startThread,
  upsertOAuthAccount,
} from "./desktopHost";

vi.mock("../application/runtime/ports/desktopHostCore", () => {
  const invokeMock = vi.fn();
  return {
    invoke: invokeMock,
    invokeDesktopCommand: invokeMock,
    isDesktopHostRuntime: vi.fn(() => true),
  };
});

vi.mock("../application/runtime/ports/desktopHostEvent", () => ({
  listen: vi.fn(),
}));

vi.mock("../application/runtime/ports/desktopHostDialogs", () => ({
  open: vi.fn(),
}));

vi.mock("./runtimeClient", () => ({
  detectRuntimeMode: vi.fn(() => "desktop-compat"),
  getRuntimeClient: vi.fn(),
  readRuntimeCapabilitiesSummary: vi.fn(),
}));

describe("desktop host invoke wrappers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    __resetWebRuntimeOauthFallbackStateForTests();
    __resetLocalUsageSnapshotCacheForTests();
    localStorage.clear();
    const invokeMock = vi.mocked(invoke);
    vi.mocked(listen).mockResolvedValue(async () => undefined);
    vi.mocked(isDesktopHostRuntime).mockReturnValue(true);
    invokeMock.mockImplementation(async (command: string) => {
      if (command === "is_macos_debug_build") {
        return false;
      }
      return undefined;
    });
    vi.mocked(getRuntimeClient).mockImplementation(() => {
      throw new Error("runtime unavailable");
    });
    vi.mocked(detectRuntimeMode).mockReturnValue("desktop-compat");
    vi.mocked(readRuntimeCapabilitiesSummary).mockResolvedValue({
      mode: "desktop-compat",
      methods: [],
      features: [],
      wsEndpointPath: null,
      error: null,
    });
    expect(vi.mocked(invokeDesktopCommand)).toBe(invokeMock);
  });

  it("invalidates web oauth account in-flight cache after account upsert", async () => {
    vi.mocked(isDesktopHostRuntime).mockReturnValue(false);
    let resolveStaleAccounts: (value: OAuthAccountSummary[]) => void = () => undefined;
    const staleAccountsPromise = new Promise<OAuthAccountSummary[]>((resolve) => {
      resolveStaleAccounts = resolve;
    });
    const freshAccounts = [
      {
        accountId: "web-upsert-refresh-1",
        provider: "codex",
        externalAccountId: "ext-upsert",
        email: "fresh@example.com",
        displayName: "Fresh Account",
        status: "enabled",
        disabledReason: null,
        routeConfig: null,
        routingState: null,
        chatgptWorkspaces: null,
        defaultChatgptWorkspaceId: null,
        metadata: {},
        createdAt: 2,
        updatedAt: 2,
      },
    ] as OAuthAccountSummary[];
    const runtimeOauthAccountsMock = vi
      .fn()
      .mockImplementationOnce(() => staleAccountsPromise)
      .mockImplementationOnce(async () => freshAccounts);
    const runtimeOauthUpsertMock = vi.fn().mockResolvedValue({
      accountId: "web-upsert-refresh-1",
      provider: "codex",
      externalAccountId: "ext-upsert",
      email: "fresh@example.com",
      displayName: "Fresh Account",
      status: "enabled",
      disabledReason: null,
      routeConfig: null,
      routingState: null,
      chatgptWorkspaces: null,
      defaultChatgptWorkspaceId: null,
      metadata: {},
      createdAt: 2,
      updatedAt: 2,
    });
    vi.mocked(getRuntimeClient).mockReturnValue({
      oauthAccounts: runtimeOauthAccountsMock,
      oauthUpsertAccount: runtimeOauthUpsertMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    const staleReadPromise = listOAuthAccounts("codex");
    await upsertOAuthAccount({
      accountId: "web-upsert-refresh-1",
      provider: "codex",
      email: "fresh@example.com",
      displayName: "Fresh Account",
      status: "enabled",
      metadata: {},
    });
    await expect(listOAuthAccounts("codex")).resolves.toEqual(freshAccounts);
    expect(runtimeOauthAccountsMock).toHaveBeenCalledTimes(2);

    resolveStaleAccounts(freshAccounts);
    await expect(staleReadPromise).resolves.toEqual(freshAccounts);
  });

  it("routes oauth primary account get/set through runtime client", async () => {
    const runtimePrimaryGetMock = vi.fn().mockResolvedValue({
      provider: "codex",
      accountId: "primary-codex-1",
      account: null,
      defaultPoolId: "pool-codex",
      routeAccountId: "primary-codex-1",
      inSync: true,
      createdAt: 1,
      updatedAt: 1,
    });
    const runtimePrimarySetMock = vi.fn().mockResolvedValue({
      provider: "codex",
      accountId: "primary-codex-2",
      account: null,
      defaultPoolId: "pool-codex",
      routeAccountId: "primary-codex-2",
      inSync: true,
      createdAt: 2,
      updatedAt: 3,
    });
    vi.mocked(getRuntimeClient).mockReturnValue({
      oauthPrimaryAccountGet: runtimePrimaryGetMock,
      oauthPrimaryAccountSet: runtimePrimarySetMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(getOAuthPrimaryAccount("codex")).resolves.toEqual(
      expect.objectContaining({
        provider: "codex",
        accountId: "primary-codex-1",
      })
    );
    await expect(
      setOAuthPrimaryAccount({ provider: "codex", accountId: "primary-codex-2" })
    ).resolves.toEqual(
      expect.objectContaining({
        provider: "codex",
        accountId: "primary-codex-2",
      })
    );

    expect(runtimePrimaryGetMock).toHaveBeenCalledWith("codex");
    expect(runtimePrimarySetMock).toHaveBeenCalledWith({
      provider: "codex",
      accountId: "primary-codex-2",
    });
  });

  it("starts web codex oauth via runtime service when no account credentials are available", async () => {
    vi.mocked(isDesktopHostRuntime).mockReturnValue(false);
    vi.mocked(detectRuntimeMode).mockReturnValue("runtime-gateway-web");
    vi.stubEnv("VITE_CODE_RUNTIME_GATEWAY_WEB_ENDPOINT", "http://127.0.0.1:8788/rpc");
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/rpc")) {
        return Promise.resolve(
          new Response(JSON.stringify({ ok: true, result: [] }), {
            status: 200,
            headers: { "content-type": "application/json" },
          })
        );
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({
            loginId: "login-web-1",
            authUrl: "https://auth.openai.com/oauth/authorize?state=test-web",
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          }
        )
      );
    });

    vi.stubGlobal("fetch", fetchMock);

    await expect(runCodexLogin("ws-1")).resolves.toEqual(
      expect.objectContaining({
        loginId: "login-web-1",
        authUrl: "https://auth.openai.com/oauth/authorize?state=test-web",
      })
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8788/oauth/codex/start",
      expect.objectContaining({
        method: "POST",
      })
    );
  });

  it("preserves codex auth URL query parameters from web runtime", async () => {
    vi.mocked(isDesktopHostRuntime).mockReturnValue(false);
    vi.mocked(detectRuntimeMode).mockReturnValue("runtime-gateway-web");
    vi.stubEnv("VITE_CODE_RUNTIME_GATEWAY_WEB_ENDPOINT", "http://127.0.0.1:8788/rpc");
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/rpc")) {
        return Promise.resolve(
          new Response(JSON.stringify({ ok: true, result: [] }), {
            status: 200,
            headers: { "content-type": "application/json" },
          })
        );
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({
            loginId: "login-web-2",
            authUrl:
              "https://auth.openai.com/oauth/authorize?client_id=app_EMoamEEZ73f0CkXaXp7hrann&redirect_uri=http%3A%2F%2F127.0.0.1%3A8788%2Fauth%2Fcallback&allowed_workspace_id=workspace-local&state=test-web",
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          }
        )
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await runCodexLogin("ws-1");
    expect(result.loginId).toBe("login-web-2");
    const parsed = new URL(result.authUrl);
    expect(parsed.searchParams.get("allowed_workspace_id")).toBe("workspace-local");
    expect(parsed.searchParams.get("redirect_uri")).toBe("http://127.0.0.1:8788/auth/callback");
  });

  it("surfaces web codex oauth start errors from runtime service", async () => {
    vi.mocked(isDesktopHostRuntime).mockReturnValue(false);
    vi.mocked(detectRuntimeMode).mockReturnValue("runtime-gateway-web");
    vi.stubEnv("VITE_CODE_RUNTIME_GATEWAY_WEB_ENDPOINT", "http://127.0.0.1:8788/rpc");
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/rpc")) {
        return Promise.resolve(
          new Response(JSON.stringify({ ok: true, result: [] }), {
            status: 200,
            headers: { "content-type": "application/json" },
          })
        );
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({
            error: { message: "oauth start unavailable" },
          }),
          {
            status: 503,
            headers: { "content-type": "application/json" },
          }
        )
      );
    });

    vi.stubGlobal("fetch", fetchMock);

    await expect(runCodexLogin("ws-1")).rejects.toThrow("oauth start unavailable");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8788/oauth/codex/start",
      expect.objectContaining({
        method: "POST",
      })
    );
  });

  it("starts oauth when existing codex account is present but durable workspace binding is not verified", async () => {
    vi.mocked(isDesktopHostRuntime).mockReturnValue(false);
    vi.mocked(detectRuntimeMode).mockReturnValue("runtime-gateway-web");
    vi.stubEnv("VITE_CODE_RUNTIME_GATEWAY_WEB_ENDPOINT", "http://127.0.0.1:8788/rpc");
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/rpc")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              ok: true,
              result: [
                {
                  accountId: "codex-existing-1",
                  provider: "codex",
                  email: "existing@example.com",
                  displayName: "Existing",
                  status: "enabled",
                  metadata: { apiKeyConfigured: true },
                  createdAt: 1,
                  updatedAt: 1,
                },
              ],
            }),
            {
              status: 200,
              headers: { "content-type": "application/json" },
            }
          )
        );
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({
            loginId: "login-web-existing-unbound",
            authUrl: "https://auth.openai.com/oauth/authorize?state=test-existing-unbound",
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          }
        )
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await runCodexLogin("ws-1");

    expect(result.loginId).toBe("login-web-existing-unbound");
    expect(result.authUrl).toContain("state=test-existing-unbound");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8788/oauth/codex/start",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("forces web codex oauth start when forceOAuth is enabled", async () => {
    vi.mocked(isDesktopHostRuntime).mockReturnValue(false);
    vi.mocked(detectRuntimeMode).mockReturnValue("runtime-gateway-web");
    vi.stubEnv("VITE_CODE_RUNTIME_GATEWAY_WEB_ENDPOINT", "http://127.0.0.1:8788/rpc");

    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/rpc")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              ok: true,
              result: [
                {
                  accountId: "codex-existing-force-1",
                  provider: "codex",
                  email: "existing-force@example.com",
                  displayName: "Existing Force",
                  status: "enabled",
                  metadata: { apiKeyConfigured: true },
                  createdAt: Date.now(),
                  updatedAt: Date.now(),
                },
              ],
            }),
            {
              status: 200,
              headers: { "content-type": "application/json" },
            }
          )
        );
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({
            loginId: "login-web-force-1",
            authUrl: "https://auth.openai.com/oauth/authorize?state=test-force",
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          }
        )
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(runCodexLogin("ws-1", { forceOAuth: true })).resolves.toEqual(
      expect.objectContaining({
        loginId: "login-web-force-1",
        authUrl: "https://auth.openai.com/oauth/authorize?state=test-force",
      })
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8788/oauth/codex/start",
      expect.objectContaining({
        method: "POST",
      })
    );
  });

  it("normalizes codex auth URL from desktop host runtime oauth payload", async () => {
    vi.mocked(isDesktopHostRuntime).mockReturnValue(true);
    vi.mocked(getRuntimeClient).mockReturnValue({
      oauthCodexLoginStart: vi.fn(async () => ({
        loginId: "login-desktop-1",
        authUrl:
          "https://auth.openai.com/api/oauth/oauth2/auth?client_id=app_EMoamEEZ73f0CkXaXp7hrann&redirect_uri=http%3A%2F%2F127.0.0.1%3A8788%2Fauth%2Fcallback&allowed_workspace_id=workspace-local&state=test-desktop",
      })),
    } as never);

    const result = await runCodexLogin("ws-desktop-1");
    expect(result.loginId).toBe("login-desktop-1");
    const parsed = new URL(result.authUrl);
    expect(parsed.pathname).toBe("/oauth/authorize");
    expect(parsed.searchParams.get("allowed_workspace_id")).toBe("workspace-local");
    expect(parsed.searchParams.get("redirect_uri")).toBe("http://127.0.0.1:8788/auth/callback");
  });

  it("resolves chatgpt refresh payload from codex oauth metadata", async () => {
    const runtimeOauthAccountsMock = vi.fn().mockResolvedValue([
      {
        accountId: "codex-account-1",
        provider: "codex",
        externalAccountId: "chatgpt-account-1",
        email: "primary@example.com",
        displayName: "Primary",
        status: "enabled",
        disabledReason: null,
        metadata: {
          accessToken: "chatgpt-access-token-1",
          chatgpt_account_id: "chatgpt-account-1",
          chatgpt_plan_type: "pro",
        },
        createdAt: 100,
        updatedAt: 200,
      },
      {
        accountId: "codex-account-2",
        provider: "codex",
        externalAccountId: "chatgpt-account-2",
        email: "secondary@example.com",
        displayName: "Secondary",
        status: "enabled",
        disabledReason: null,
        metadata: {
          accessToken: "chatgpt-access-token-2",
          chatgpt_account_id: "chatgpt-account-2",
          chatgpt_plan_type: "team",
        },
        createdAt: 101,
        updatedAt: 201,
      },
    ]);
    const runtimeOauthPoolsMock = vi.fn().mockResolvedValue([]);
    vi.mocked(getRuntimeClient).mockReturnValue({
      oauthAccounts: runtimeOauthAccountsMock,
      oauthPools: runtimeOauthPoolsMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(
      resolveChatgptAuthTokensRefreshResponse({ previousAccountId: "chatgpt-account-2" })
    ).resolves.toEqual({
      accessToken: "chatgpt-access-token-2",
      chatgptAccountId: "chatgpt-account-2",
      chatgptPlanType: "team",
      sourceAccountId: "codex-account-2",
    });
  });

  it("prefers runtime oauth chatgpt token refresh RPC payload when available", async () => {
    const runtimeRefreshMock = vi.fn().mockResolvedValue({
      accessToken: "chatgpt-access-token-rpc",
      chatgptAccountId: "chatgpt-account-rpc",
      chatgptPlanType: "business",
      sourceAccountId: "codex-rpc-account",
    });
    vi.mocked(getRuntimeClient).mockReturnValue({
      oauthChatgptAuthTokensRefresh: runtimeRefreshMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(
      resolveChatgptAuthTokensRefreshResponse({
        sessionId: "session-rpc-1",
        previousAccountId: "chatgpt-account-rpc",
        chatgptWorkspaceId: "org-rpc",
      })
    ).resolves.toEqual({
      accessToken: "chatgpt-access-token-rpc",
      chatgptAccountId: "chatgpt-account-rpc",
      chatgptPlanType: "business",
      sourceAccountId: "codex-rpc-account",
    });
    expect(runtimeRefreshMock).toHaveBeenCalledWith({
      reason: "unauthorized",
      sessionId: "session-rpc-1",
      previousAccountId: "chatgpt-account-rpc",
      chatgptWorkspaceId: "org-rpc",
    });
  });

  it("reuses workspace-aware pool selection for refresh fallback before previousAccountId guessing", async () => {
    const runtimeRefreshMock = vi.fn().mockRejectedValue({
      name: "RuntimeRpcMethodUnsupportedError",
      message: "method not found",
    });
    const runtimeSelectPoolAccountMock = vi.fn().mockResolvedValue({
      poolId: "pool-codex",
      reason: "sticky_binding",
      account: {
        accountId: "codex-account-bound",
        provider: "codex",
        externalAccountId: "chatgpt-account-bound",
        email: "bound@example.com",
        displayName: "Bound Account",
        status: "enabled",
        disabledReason: null,
        metadata: {
          accessToken: "chatgpt-access-token-bound",
          chatgpt_account_id: "chatgpt-account-bound",
        },
        createdAt: 100,
        updatedAt: 200,
      },
    });
    const runtimeOauthAccountsMock = vi.fn().mockResolvedValue([
      {
        accountId: "codex-account-previous",
        provider: "codex",
        externalAccountId: "chatgpt-account-previous",
        email: "previous@example.com",
        displayName: "Previous",
        status: "enabled",
        disabledReason: null,
        metadata: {
          accessToken: "chatgpt-access-token-previous",
          chatgpt_account_id: "chatgpt-account-previous",
          chatgptWorkspaces: [{ workspaceId: "org-b", title: "Org B", isDefault: true }],
        },
        createdAt: 101,
        updatedAt: 201,
      },
      {
        accountId: "codex-account-bound",
        provider: "codex",
        externalAccountId: "chatgpt-account-bound",
        email: "bound@example.com",
        displayName: "Bound Account",
        status: "enabled",
        disabledReason: null,
        metadata: {
          accessToken: "chatgpt-access-token-bound",
          chatgpt_account_id: "chatgpt-account-bound",
          chatgptWorkspaces: [{ workspaceId: "org-b", title: "Org B", isDefault: true }],
        },
        createdAt: 102,
        updatedAt: 202,
      },
    ]);
    const runtimeOauthPoolsMock = vi.fn().mockResolvedValue([]);
    vi.mocked(getRuntimeClient).mockReturnValue({
      oauthChatgptAuthTokensRefresh: runtimeRefreshMock,
      oauthSelectPoolAccount: runtimeSelectPoolAccountMock,
      oauthAccounts: runtimeOauthAccountsMock,
      oauthPools: runtimeOauthPoolsMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(
      resolveChatgptAuthTokensRefreshResponse({
        sessionId: "session-bound-1",
        previousAccountId: "chatgpt-account-previous",
        chatgptWorkspaceId: "org-b",
      })
    ).resolves.toEqual({
      accessToken: "chatgpt-access-token-bound",
      chatgptAccountId: "chatgpt-account-bound",
      chatgptPlanType: null,
      sourceAccountId: "codex-account-bound",
    });

    expect(runtimeSelectPoolAccountMock).toHaveBeenCalledWith({
      poolId: "pool-codex",
      sessionId: "session-bound-1",
      chatgptWorkspaceId: "org-b",
      modelId: null,
    });
  });

  it("filters fallback refresh account by requested ChatGPT workspace", async () => {
    const runtimeRefreshMock = vi.fn().mockRejectedValue({
      name: "RuntimeRpcMethodUnsupportedError",
      message: "method not found",
    });
    const runtimeOauthAccountsMock = vi.fn().mockResolvedValue([
      {
        accountId: "codex-account-org-a",
        provider: "codex",
        externalAccountId: "chatgpt-account-org-a",
        email: "orga@example.com",
        displayName: "Org A",
        status: "enabled",
        disabledReason: null,
        metadata: {
          accessToken: "chatgpt-access-token-org-a",
          chatgpt_account_id: "chatgpt-account-org-a",
          chatgptWorkspaces: [{ workspaceId: "org-a", title: "Org A", isDefault: true }],
        },
        createdAt: 100,
        updatedAt: 200,
      },
      {
        accountId: "codex-account-org-b",
        provider: "codex",
        externalAccountId: "chatgpt-account-org-b",
        email: "orgb@example.com",
        displayName: "Org B",
        status: "enabled",
        disabledReason: null,
        metadata: {
          accessToken: "chatgpt-access-token-org-b",
          chatgpt_account_id: "chatgpt-account-org-b",
          chatgptWorkspaces: [{ workspaceId: "org-b", title: "Org B", isDefault: true }],
        },
        createdAt: 101,
        updatedAt: 201,
      },
    ]);
    const runtimeOauthPoolsMock = vi.fn().mockResolvedValue([]);
    vi.mocked(getRuntimeClient).mockReturnValue({
      oauthChatgptAuthTokensRefresh: runtimeRefreshMock,
      oauthAccounts: runtimeOauthAccountsMock,
      oauthPools: runtimeOauthPoolsMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(
      resolveChatgptAuthTokensRefreshResponse({
        chatgptWorkspaceId: "org-b",
      })
    ).resolves.toEqual({
      accessToken: "chatgpt-access-token-org-b",
      chatgptAccountId: "chatgpt-account-org-b",
      chatgptPlanType: null,
      sourceAccountId: "codex-account-org-b",
    });
  });

  it("falls back to oauth metadata when runtime oauth chatgpt refresh RPC is unsupported", async () => {
    const runtimeRefreshMock = vi.fn().mockRejectedValue({
      name: "RuntimeRpcMethodUnsupportedError",
      message: "method not found",
    });
    const runtimeOauthAccountsMock = vi.fn().mockResolvedValue([
      {
        accountId: "codex-account-fallback",
        provider: "codex",
        externalAccountId: "chatgpt-account-fallback",
        email: "fallback@example.com",
        displayName: "Fallback",
        status: "enabled",
        disabledReason: null,
        metadata: {
          accessToken: "chatgpt-access-token-fallback",
          chatgpt_account_id: "chatgpt-account-fallback",
          chatgpt_plan_type: "pro",
        },
        createdAt: 1,
        updatedAt: 2,
      },
    ]);
    const runtimeOauthPoolsMock = vi.fn().mockResolvedValue([]);
    vi.mocked(getRuntimeClient).mockReturnValue({
      oauthChatgptAuthTokensRefresh: runtimeRefreshMock,
      oauthAccounts: runtimeOauthAccountsMock,
      oauthPools: runtimeOauthPoolsMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(
      resolveChatgptAuthTokensRefreshResponse({
        previousAccountId: "chatgpt-account-fallback",
      })
    ).resolves.toEqual({
      accessToken: "chatgpt-access-token-fallback",
      chatgptAccountId: "chatgpt-account-fallback",
      chatgptPlanType: "pro",
      sourceAccountId: "codex-account-fallback",
    });
  });

  it("returns null when refresh payload cannot resolve a usable access token", async () => {
    const runtimeOauthAccountsMock = vi.fn().mockResolvedValue([
      {
        accountId: "codex-account-3",
        provider: "codex",
        externalAccountId: "chatgpt-account-3",
        email: "user@example.com",
        displayName: "No Token",
        status: "enabled",
        disabledReason: null,
        metadata: {
          refreshTokenAvailable: true,
          chatgpt_account_id: "chatgpt-account-3",
          planType: "pro",
        },
        createdAt: 300,
        updatedAt: 400,
      },
    ]);
    const runtimeOauthPoolsMock = vi.fn().mockResolvedValue([]);
    vi.mocked(getRuntimeClient).mockReturnValue({
      oauthAccounts: runtimeOauthAccountsMock,
      oauthPools: runtimeOauthPoolsMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(resolveChatgptAuthTokensRefreshResponse()).resolves.toBeNull();
  });

  it("routes getGitStatus through runtime gitChanges/gitBranches", async () => {
    const invokeMock = vi.mocked(invoke);
    const runtimeGitChangesMock = vi.fn().mockResolvedValue({
      staged: [{ id: "chg-1", path: "src/main.ts", status: "staged", summary: "" }],
      unstaged: [{ id: "chg-2", path: "README.md", status: "modified", summary: "" }],
    });
    const runtimeGitBranchesMock = vi.fn().mockResolvedValue({
      currentBranch: "main",
      branches: [{ name: "main", lastUsedAt: 1700000000000 }],
    });
    vi.mocked(getRuntimeClient).mockReturnValue({
      gitChanges: runtimeGitChangesMock,
      gitBranches: runtimeGitBranchesMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(getGitStatus("ws-1")).resolves.toEqual({
      branchName: "main",
      files: [
        { path: "src/main.ts", status: "staged", additions: 0, deletions: 0 },
        { path: "README.md", status: "modified", additions: 0, deletions: 0 },
      ],
      stagedFiles: [{ path: "src/main.ts", status: "staged", additions: 0, deletions: 0 }],
      unstagedFiles: [{ path: "README.md", status: "modified", additions: 0, deletions: 0 }],
      totalAdditions: 0,
      totalDeletions: 0,
    });

    expect(runtimeGitChangesMock).toHaveBeenCalledWith("ws-1");
    expect(runtimeGitBranchesMock).toHaveBeenCalledWith("ws-1");
    expect(invokeMock).not.toHaveBeenCalledWith("get_git_status", expect.anything());
  });

  it("does not fall back to legacy get_git_status invoke when runtime git status APIs fail", async () => {
    const invokeMock = vi.mocked(invoke);
    const runtimeGitChangesMock = vi.fn().mockRejectedValue(new Error("runtime git status failed"));
    vi.mocked(getRuntimeClient).mockReturnValue({
      gitChanges: runtimeGitChangesMock,
      gitBranches: vi.fn(),
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(getGitStatus("ws-status-2")).rejects.toThrow("runtime git status failed");
    expect(invokeMock).not.toHaveBeenCalledWith("get_git_status", expect.anything());
  });

  it("routes getGitDiffs through runtime gitChanges/gitDiffRead", async () => {
    const invokeMock = vi.mocked(invoke);
    const runtimeGitChangesMock = vi.fn().mockResolvedValue({
      staged: [
        { id: "chg-1", path: "src/main.ts", status: "staged", summary: "" },
        { id: "chg-2", path: "README.md", status: "staged", summary: "" },
      ],
      unstaged: [{ id: "chg-3", path: "src/main.ts", status: "modified", summary: "" }],
    });
    const runtimeGitDiffReadMock = vi
      .fn()
      .mockResolvedValueOnce({ id: "chg-1", diff: "diff --git a/src/main.ts b/src/main.ts" })
      .mockResolvedValueOnce({ id: "chg-2", diff: "diff --git a/README.md b/README.md" })
      .mockResolvedValueOnce({
        id: "chg-3",
        diff: "diff --git a/src/main.ts b/src/main.ts\n@@ unstaged @@",
      });
    vi.mocked(getRuntimeClient).mockReturnValue({
      gitChanges: runtimeGitChangesMock,
      gitDiffRead: runtimeGitDiffReadMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(getGitDiffs("ws-diff-1")).resolves.toEqual([
      { path: "src/main.ts", diff: "diff --git a/src/main.ts b/src/main.ts", scope: "staged" },
      { path: "README.md", diff: "diff --git a/README.md b/README.md", scope: "staged" },
      {
        path: "src/main.ts",
        diff: "diff --git a/src/main.ts b/src/main.ts\n@@ unstaged @@",
        scope: "unstaged",
      },
    ]);
    expect(runtimeGitChangesMock).toHaveBeenCalledWith("ws-diff-1");
    expect(runtimeGitDiffReadMock).toHaveBeenCalledTimes(3);
    expect(invokeMock).not.toHaveBeenCalledWith("get_git_diffs", expect.anything());
  });

  it("auto-assembles paged git diffs when runtime advertises paging capability", async () => {
    vi.mocked(readRuntimeCapabilitiesSummary).mockResolvedValue({
      mode: "desktop-compat",
      methods: [],
      features: ["git_diff_paging_v1"],
      wsEndpointPath: null,
      error: null,
    });
    const runtimeGitChangesMock = vi.fn().mockResolvedValue({
      staged: [{ id: "chg-1", path: "src/main.ts", status: "staged", summary: "" }],
      unstaged: [],
    });
    const runtimeGitDiffReadMock = vi
      .fn()
      .mockResolvedValueOnce({
        id: "chg-1",
        diff: "part-1\n",
        hasMore: true,
        nextOffset: 7,
      })
      .mockResolvedValueOnce({
        id: "chg-1",
        diff: "part-2",
        hasMore: false,
        nextOffset: null,
      });
    vi.mocked(getRuntimeClient).mockReturnValue({
      gitChanges: runtimeGitChangesMock,
      gitDiffRead: runtimeGitDiffReadMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(getGitDiffs("ws-diff-page-1")).resolves.toEqual([
      { path: "src/main.ts", diff: "part-1\npart-2", scope: "staged" },
    ]);
    expect(runtimeGitDiffReadMock).toHaveBeenNthCalledWith(1, "ws-diff-page-1", "chg-1", {
      offset: 0,
      maxBytes: 262144,
    });
    expect(runtimeGitDiffReadMock).toHaveBeenNthCalledWith(2, "ws-diff-page-1", "chg-1", {
      offset: 7,
      maxBytes: 262144,
    });
  });

  it("does not fall back to legacy get_git_diffs invoke when runtime git diff APIs fail", async () => {
    const invokeMock = vi.mocked(invoke);
    const runtimeGitChangesMock = vi
      .fn()
      .mockRejectedValue(new Error("runtime git changes failed"));
    vi.mocked(getRuntimeClient).mockReturnValue({
      gitChanges: runtimeGitChangesMock,
      gitDiffRead: vi.fn(),
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(getGitDiffs("ws-diff-2")).rejects.toThrow("runtime git changes failed");
    expect(invokeMock).not.toHaveBeenCalledWith("get_git_diffs", expect.anything());
  });

  it("routes listGitBranches through runtime gitBranches", async () => {
    const invokeMock = vi.mocked(invoke);
    const runtimeGitBranchesMock = vi.fn().mockResolvedValue({
      currentBranch: "main",
      branches: [
        { name: "main", lastUsedAt: 1700000001000 },
        { name: "feature/a", lastUsedAt: 1700000000000 },
      ],
    });
    vi.mocked(getRuntimeClient).mockReturnValue({
      gitBranches: runtimeGitBranchesMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(listGitBranches("ws-git-branches-1")).resolves.toEqual({
      result: {
        currentBranch: "main",
        current_branch: "main",
        branches: [
          { name: "main", lastCommit: 1700000001000, last_commit: 1700000001000 },
          { name: "feature/a", lastCommit: 1700000000000, last_commit: 1700000000000 },
        ],
      },
      currentBranch: "main",
      current_branch: "main",
      branches: [
        { name: "main", lastCommit: 1700000001000, last_commit: 1700000001000 },
        { name: "feature/a", lastCommit: 1700000000000, last_commit: 1700000000000 },
      ],
    });
    expect(runtimeGitBranchesMock).toHaveBeenCalledWith("ws-git-branches-1");
    expect(invokeMock).not.toHaveBeenCalledWith("list_git_branches", expect.anything());
  });

  it("does not fall back to legacy list_git_branches invoke when runtime gitBranches fails", async () => {
    const invokeMock = vi.mocked(invoke);
    const runtimeGitBranchesMock = vi
      .fn()
      .mockRejectedValue(new Error("runtime git branches failed"));
    vi.mocked(getRuntimeClient).mockReturnValue({
      gitBranches: runtimeGitBranchesMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(listGitBranches("ws-git-branches-2")).rejects.toThrow(
      "runtime git branches failed"
    );
    expect(invokeMock).not.toHaveBeenCalledWith("list_git_branches", expect.anything());
  });

  it("routes checkout/create git branch through runtime git APIs", async () => {
    const invokeMock = vi.mocked(invoke);
    const runtimeCheckoutMock = vi.fn().mockResolvedValue({ ok: true, error: null });
    const runtimeCreateMock = vi.fn().mockResolvedValue({ ok: true, error: null });
    vi.mocked(getRuntimeClient).mockReturnValue({
      gitBranchCheckout: runtimeCheckoutMock,
      gitBranchCreate: runtimeCreateMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(
      checkoutGitBranch("ws-git-branches-3", "feature/runtime")
    ).resolves.toBeUndefined();
    await expect(
      createGitBranch("ws-git-branches-3", "feature/new-runtime")
    ).resolves.toBeUndefined();

    expect(runtimeCheckoutMock).toHaveBeenCalledWith("ws-git-branches-3", "feature/runtime");
    expect(runtimeCreateMock).toHaveBeenCalledWith("ws-git-branches-3", "feature/new-runtime");
    expect(invokeMock).not.toHaveBeenCalledWith("checkout_git_branch", expect.anything());
    expect(invokeMock).not.toHaveBeenCalledWith("create_git_branch", expect.anything());
  });

  it("does not fall back to legacy branch invoke when runtime checkout/create fails", async () => {
    const invokeMock = vi.mocked(invoke);
    const runtimeCheckoutMock = vi.fn().mockResolvedValue({ ok: false, error: "checkout denied" });
    const runtimeCreateMock = vi.fn().mockResolvedValue({ ok: false, error: "create denied" });
    vi.mocked(getRuntimeClient).mockReturnValue({
      gitBranchCheckout: runtimeCheckoutMock,
      gitBranchCreate: runtimeCreateMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(checkoutGitBranch("ws-git-branches-4", "feature/runtime")).rejects.toThrow(
      "checkout denied"
    );
    await expect(createGitBranch("ws-git-branches-4", "feature/new-runtime")).rejects.toThrow(
      "create denied"
    );
    expect(invokeMock).not.toHaveBeenCalledWith("checkout_git_branch", expect.anything());
    expect(invokeMock).not.toHaveBeenCalledWith("create_git_branch", expect.anything());
  });

  it("maps workspace_id to workspaceId for GitHub issues", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValueOnce({ total: 0, issues: [] });

    await getGitHubIssues("ws-2");

    expect(invokeMock).toHaveBeenCalledWith("get_github_issues", {
      workspaceId: "ws-2",
    });
  });

  it("does not fall back to legacy list_workspaces invoke when runtime workspaces fails", async () => {
    const invokeMock = vi.mocked(invoke);
    const runtimeWorkspacesMock = vi.fn().mockRejectedValue(new Error("runtime workspaces failed"));
    vi.mocked(getRuntimeClient).mockReturnValue({
      workspaces: runtimeWorkspacesMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(listWorkspaces()).rejects.toThrow("runtime workspaces failed");
    expect(invokeMock).not.toHaveBeenCalledWith("list_workspaces");
  });

  it("does not fall back to mock workspaces when runtime workspaces fails in runtime-gateway-web mode", async () => {
    vi.mocked(isDesktopHostRuntime).mockReturnValue(false);
    vi.mocked(detectRuntimeMode).mockReturnValue("runtime-gateway-web");
    const runtimeWorkspacesMock = vi.fn().mockRejectedValue(new Error("runtime workspaces failed"));
    vi.mocked(getRuntimeClient).mockReturnValue({
      workspaces: runtimeWorkspacesMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(listWorkspaces()).rejects.toThrow("runtime workspaces failed");
  });

  it("falls back to direct web RPC workspaces list when runtime client list fails", async () => {
    vi.mocked(isDesktopHostRuntime).mockReturnValue(false);
    vi.mocked(detectRuntimeMode).mockReturnValue("runtime-gateway-web");
    vi.stubEnv("VITE_CODE_RUNTIME_GATEWAY_WEB_ENDPOINT", "http://127.0.0.1:8788/rpc");
    const runtimeWorkspacesMock = vi
      .fn()
      .mockRejectedValue(new Error("Runtime RPC compatFieldAliases mismatch"));
    vi.mocked(getRuntimeClient).mockReturnValue({
      workspaces: runtimeWorkspacesMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        result: [
          {
            id: "ws-list-fallback",
            path: "/tmp/ws-list-fallback",
            displayName: "ws-list-fallback",
            connected: true,
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const workspaces = await listWorkspaces();

    expect(workspaces).toEqual([
      expect.objectContaining({
        id: "ws-list-fallback",
        path: "/tmp/ws-list-fallback",
      }),
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to a basename when runtime workspace displayName mirrors a Windows device path", async () => {
    const runtimeWorkspacesMock = vi.fn().mockResolvedValue([
      {
        id: "ws-windows-device-path",
        path: "\\\\?\\C:\\Dev\\keep-up",
        displayName: "\\\\?\\C:\\Dev\\keep-up",
        connected: true,
      },
    ]);
    vi.mocked(getRuntimeClient).mockReturnValue({
      workspaces: runtimeWorkspacesMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    const workspaces = await listWorkspaces();

    expect(workspaces).toEqual([
      expect.objectContaining({
        id: "ws-windows-device-path",
        name: "keep-up",
        path: "\\\\?\\C:\\Dev\\keep-up",
      }),
    ]);
  });

  it("routes getGitLog through runtime gitLog with default limit", async () => {
    const invokeMock = vi.mocked(invoke);
    const runtimeGitLogMock = vi.fn().mockResolvedValue({
      total: 0,
      entries: [],
      ahead: 0,
      behind: 0,
      aheadEntries: [],
      behindEntries: [],
      upstream: null,
    });
    vi.mocked(getRuntimeClient).mockReturnValue({
      gitLog: runtimeGitLogMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await getGitLog("ws-3");

    expect(runtimeGitLogMock).toHaveBeenCalledWith("ws-3", 40);
    expect(invokeMock).not.toHaveBeenCalledWith("get_git_log", expect.anything());
  });

  it("does not fall back to legacy get_git_log invoke when runtime gitLog fails", async () => {
    const invokeMock = vi.mocked(invoke);
    const runtimeGitLogMock = vi.fn().mockRejectedValue(new Error("runtime git log failed"));
    vi.mocked(getRuntimeClient).mockReturnValue({
      gitLog: runtimeGitLogMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(getGitLog("ws-3")).rejects.toThrow("runtime git log failed");
    expect(invokeMock).not.toHaveBeenCalledWith("get_git_log", expect.anything());
  });

  it("maps workspaceId and threadId for fork_thread", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValueOnce({});

    await forkThread("ws-9", "thread-9");

    expect(invokeMock).toHaveBeenCalledWith("fork_thread", {
      workspaceId: "ws-9",
      threadId: "thread-9",
    });
  });

  it("maps workspaceId and threadId for compact_thread", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValueOnce({});

    await compactThread("ws-10", "thread-10");

    expect(invokeMock).toHaveBeenCalledWith("compact_thread", {
      workspaceId: "ws-10",
      threadId: "thread-10",
    });
  });

  it("routes thread lifecycle wrappers through runtime thread APIs", async () => {
    const invokeMock = vi.mocked(invoke);
    const runtimeThread = {
      id: "thread-1",
      workspaceId: "ws-2",
      title: "Thread title",
      unread: false,
      running: false,
      createdAt: 1700000000000,
      updatedAt: 1700000005000,
      provider: "openai",
      modelId: "gpt-5.3-codex",
    } as const;
    const runtimeWorkspacesMock = vi.fn().mockResolvedValue([
      {
        id: "ws-2",
        path: "/tmp/ws-2",
        displayName: "Workspace 2",
        connected: true,
        defaultModelId: null,
      },
    ]);
    const runtimeCreateThreadMock = vi.fn().mockResolvedValue(runtimeThread);
    const runtimeThreadsMock = vi.fn().mockResolvedValue([runtimeThread]);
    const runtimeResumeThreadMock = vi.fn().mockResolvedValue(runtimeThread);
    const runtimeArchiveThreadMock = vi.fn().mockResolvedValue(true);
    vi.mocked(getRuntimeClient).mockReturnValue({
      workspaces: runtimeWorkspacesMock,
      createThread: runtimeCreateThreadMock,
      threads: runtimeThreadsMock,
      resumeThread: runtimeResumeThreadMock,
      archiveThread: runtimeArchiveThreadMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(startThread("ws-2")).resolves.toEqual({
      result: {
        thread: expect.objectContaining({
          id: "thread-1",
          workspaceId: "ws-2",
          cwd: "/tmp/ws-2",
          title: "Thread title",
          modelId: "gpt-5.3-codex",
          model_id: "gpt-5.3-codex",
        }),
      },
    });

    await expect(listThreads("ws-2", "cursor-1", 1, "created_at")).resolves.toEqual({
      result: {
        data: [
          expect.objectContaining({
            id: "thread-1",
            workspaceId: "ws-2",
            cwd: "/tmp/ws-2",
          }),
        ],
        nextCursor: null,
      },
    });

    await expect(resumeThread("ws-2", "thread-1")).resolves.toEqual({
      result: {
        thread: expect.objectContaining({
          id: "thread-1",
          workspaceId: "ws-2",
          cwd: "/tmp/ws-2",
        }),
      },
    });

    await expect(archiveThread("ws-2", "thread-1")).resolves.toEqual({
      result: {
        archived: true,
      },
    });

    expect(runtimeCreateThreadMock).toHaveBeenCalledWith({
      workspaceId: "ws-2",
      title: null,
    });
    expect(runtimeThreadsMock).toHaveBeenCalledWith("ws-2");
    expect(runtimeResumeThreadMock).toHaveBeenCalledWith("ws-2", "thread-1");
    expect(runtimeArchiveThreadMock).toHaveBeenCalledWith("ws-2", "thread-1");
    expect(invokeMock).not.toHaveBeenCalledWith("start_thread", expect.anything());
    expect(invokeMock).not.toHaveBeenCalledWith("list_threads", expect.anything());
    expect(invokeMock).not.toHaveBeenCalledWith("resume_thread", expect.anything());
    expect(invokeMock).not.toHaveBeenCalledWith("archive_thread", expect.anything());
  });

  it("returns empty thread list when web runtime transport is unavailable", async () => {
    const invokeMock = vi.mocked(invoke);
    vi.mocked(isDesktopHostRuntime).mockReturnValue(false);
    vi.mocked(detectRuntimeMode).mockReturnValue("runtime-gateway-web");
    const runtimeThreadsMock = vi
      .fn()
      .mockRejectedValue(new TypeError("Failed to fetch (127.0.0.1:8788)"));
    vi.mocked(getRuntimeClient).mockReturnValue({
      threads: runtimeThreadsMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(listThreads("ws-web-unavailable")).resolves.toEqual({
      result: {
        data: [],
        nextCursor: null,
      },
    });
    expect(runtimeThreadsMock).toHaveBeenCalledWith("ws-web-unavailable");
    expect(invokeMock).not.toHaveBeenCalledWith("list_threads", expect.anything());
  });

  it("does not fall back to legacy start_thread invoke when runtime createThread fails", async () => {
    const invokeMock = vi.mocked(invoke);
    const runtimeCreateThreadMock = vi.fn().mockRejectedValue(new Error("runtime create failed"));
    vi.mocked(getRuntimeClient).mockReturnValue({
      createThread: runtimeCreateThreadMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(startThread("ws-2")).rejects.toThrow("runtime create failed");
    expect(invokeMock).not.toHaveBeenCalledWith("start_thread", expect.anything());
  });

  it("does not fall back to mock workspace cwd when runtime workspace lookup fails in runtime-gateway-web mode", async () => {
    vi.mocked(isDesktopHostRuntime).mockReturnValue(false);
    vi.mocked(detectRuntimeMode).mockReturnValue("runtime-gateway-web");
    const runtimeThread = {
      id: "thread-runtime-gateway-web-cwd",
      workspaceId: "ws-2",
      title: "Thread title",
      unread: false,
      running: false,
      createdAt: 1700000000000,
      updatedAt: 1700000005000,
      provider: "openai",
      modelId: "gpt-5.3-codex",
    } as const;
    vi.mocked(getRuntimeClient).mockReturnValue({
      createThread: vi.fn().mockResolvedValue(runtimeThread),
      workspaces: vi.fn().mockRejectedValue(new Error("runtime workspaces failed")),
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(startThread("ws-2")).resolves.toEqual({
      result: {
        thread: expect.objectContaining({
          id: "thread-runtime-gateway-web-cwd",
          workspaceId: "ws-2",
          cwd: "",
        }),
      },
    });
  });

  it("maps workspaceId/threadId/name for set_thread_name", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValueOnce({});

    await setThreadName("ws-9", "thread-9", "New Name");

    expect(invokeMock).toHaveBeenCalledWith("set_thread_name", {
      workspaceId: "ws-9",
      threadId: "thread-9",
      name: "New Name",
    });
  });

  it("routes listMcpServerStatus through runtime client canonical RPC", async () => {
    const runtimeMcpListMock = vi.fn().mockResolvedValue({
      data: [],
      nextCursor: null,
      warnings: [],
    });
    vi.mocked(getRuntimeClient).mockReturnValue({
      mcpServerStatusListV1: runtimeMcpListMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(listMcpServerStatus("ws-10", "cursor-1", 25)).resolves.toEqual({
      data: [],
      nextCursor: null,
      warnings: [],
    });
    expect(runtimeMcpListMock).toHaveBeenCalledWith({
      workspaceId: "ws-10",
      cursor: "cursor-1",
      limit: 25,
    });
  });

  it("prefers the unified extension catalog when listing instruction skills", async () => {
    const invokeMock = vi.mocked(invoke);
    const extensionCatalogListV2 = vi.fn(async () => [
      {
        extensionId: "workspace.agents.review",
        version: "1.0.0",
        displayName: "review",
        publisher: "agents",
        summary: "Review the current changeset",
        kind: "instruction",
        distribution: "workspace",
        name: "review",
        transport: "repo-manifest",
        lifecycleState: "enabled",
        enabled: true,
        workspaceId: "ws-skills-catalog",
        capabilities: ["instructions"],
        permissions: [],
        uiApps: [],
        provenance: {
          sourceId: "workspace-skill",
          scope: "workspace",
          sourceFamily: "agents",
          entryPath: "/repo/.agents/skills/review/SKILL.md",
          aliases: ["review", "agents:review"],
          shadowedBy: null,
        },
        config: {},
        installedAt: 1,
        updatedAt: 1,
      },
      {
        extensionId: "ext-mcp-1",
        version: "1.0.0",
        displayName: "MCP Server",
        publisher: "HugeCode",
        summary: "Non-instruction extension",
        kind: "mcp",
        distribution: "workspace",
        name: "MCP Server",
        transport: "mcp-http",
        lifecycleState: "enabled",
        enabled: true,
        workspaceId: "ws-skills-catalog",
        capabilities: ["tools"],
        permissions: [],
        uiApps: [],
        provenance: {},
        config: {},
        installedAt: 1,
        updatedAt: 1,
      },
    ]);
    vi.mocked(getRuntimeClient).mockReturnValue({
      extensionCatalogListV2,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(getSkillsList("ws-skills-catalog")).resolves.toEqual({
      result: {
        skills: [
          {
            name: "review",
            path: "workspace.agents.review",
            description: "Review the current changeset",
            scope: "workspace",
            sourceFamily: "agents",
            enabled: true,
            aliases: ["review", "agents:review"],
            shadowedBy: null,
          },
        ],
      },
      skills: [
        {
          name: "review",
          path: "workspace.agents.review",
          description: "Review the current changeset",
          scope: "workspace",
          sourceFamily: "agents",
          enabled: true,
          aliases: ["review", "agents:review"],
          shadowedBy: null,
        },
      ],
    });

    expect(extensionCatalogListV2).toHaveBeenCalledWith({ workspaceId: "ws-skills-catalog" });
    expect(invokeMock).not.toHaveBeenCalledWith("native_skills_list", expect.anything());
  });

  it("maps instruction skill metadata without collapsing source and conflict fields", async () => {
    const extensionCatalogListV2 = vi.fn(async () => [
      {
        extensionId: "workspace.agents.review",
        version: "1.0.0",
        displayName: "review",
        publisher: "agents",
        summary: "Review the current changeset",
        kind: "instruction",
        distribution: "workspace",
        name: "review",
        transport: "repo-manifest",
        lifecycleState: "enabled",
        enabled: true,
        workspaceId: "ws-skills-availability",
        capabilities: ["instructions"],
        permissions: [],
        uiApps: [],
        provenance: {
          sourceId: "workspace-skill",
          scope: "workspace",
          sourceFamily: "agents",
          entryPath: "/repo/.agents/skills/review/SKILL.md",
          aliases: ["agents:review"],
          shadowedBy: null,
        },
        config: {},
        installedAt: 1,
        updatedAt: 1,
      },
      {
        extensionId: "user.codex.review",
        version: "1.0.0",
        displayName: "review",
        publisher: "codex",
        summary: "Legacy codex review flow",
        kind: "instruction",
        distribution: "workspace",
        name: "review",
        transport: "repo-manifest",
        lifecycleState: "installed",
        enabled: false,
        workspaceId: "ws-skills-availability",
        capabilities: ["instructions"],
        permissions: [],
        uiApps: [],
        provenance: {
          sourceId: "workspace-skill",
          scope: "global",
          sourceFamily: "codex",
          entryPath: "/Users/han/.codex/skills/review/SKILL.md",
          aliases: ["codex:review"],
          shadowedBy: "workspace.agents.review",
        },
        config: {},
        installedAt: 1,
        updatedAt: 1,
      },
    ]);
    vi.mocked(getRuntimeClient).mockReturnValue({
      extensionCatalogListV2,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(getSkillsList("ws-skills-availability")).resolves.toEqual({
      result: {
        skills: [
          {
            name: "review",
            path: "workspace.agents.review",
            description: "Review the current changeset",
            scope: "workspace",
            sourceFamily: "agents",
            enabled: true,
            aliases: ["agents:review"],
            shadowedBy: null,
          },
          {
            name: "review",
            path: "user.codex.review",
            description: "Legacy codex review flow",
            scope: "global",
            sourceFamily: "codex",
            enabled: false,
            aliases: ["codex:review"],
            shadowedBy: "workspace.agents.review",
          },
        ],
      },
      skills: [
        {
          name: "review",
          path: "workspace.agents.review",
          description: "Review the current changeset",
          scope: "workspace",
          sourceFamily: "agents",
          enabled: true,
          aliases: ["agents:review"],
          shadowedBy: null,
        },
        {
          name: "review",
          path: "user.codex.review",
          description: "Legacy codex review flow",
          scope: "global",
          sourceFamily: "codex",
          enabled: false,
          aliases: ["codex:review"],
          shadowedBy: "workspace.agents.review",
        },
      ],
    });
  });

  it("surfaces extension catalog failures instead of falling back to legacy skill rpc", async () => {
    const extensionCatalogListV2 = vi.fn(async () => {
      throw new Error("extension catalog failed");
    });
    vi.mocked(getRuntimeClient).mockReturnValue({
      extensionCatalogListV2,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(getSkillsList("ws-skills-2")).rejects.toThrow("extension catalog failed");
  });

  it("loads instruction skill content through extension resources", async () => {
    const invokeMock = vi.mocked(invoke);
    const extensionGetV2 = vi.fn(async () => ({
      extensionId: "workspace.agents.review",
      version: "1.0.0",
      displayName: "review",
      publisher: "agents",
      summary: "Review the current changeset",
      kind: "instruction",
      distribution: "workspace",
      name: "review",
      transport: "repo-manifest",
      lifecycleState: "enabled",
      enabled: true,
      workspaceId: "ws-skills-extension-read",
      capabilities: ["instructions"],
      permissions: [],
      uiApps: [],
      provenance: {
        sourceId: "workspace-skill",
        scope: "workspace",
        sourceFamily: "agents",
        sourceRoot: "/repo/.agents/skills",
        entryPath: "/repo/.agents/skills/review/SKILL.md",
        aliases: ["review", "agents:review"],
        shadowedBy: null,
      },
      config: {},
      installedAt: 1,
      updatedAt: 1,
    }));
    const extensionResourceReadV2 = vi.fn(async (request: { resourceId: string }) => {
      if (request.resourceId === "body") {
        return {
          extensionId: "workspace.agents.review",
          resourceId: "body",
          contentType: "text/markdown",
          content: "Review carefully",
          metadata: null,
        };
      }
      if (request.resourceId === "frontmatter") {
        return {
          extensionId: "workspace.agents.review",
          resourceId: "frontmatter",
          contentType: "application/json",
          content: JSON.stringify({ name: "review" }),
          metadata: null,
        };
      }
      return {
        extensionId: "workspace.agents.review",
        resourceId: "supporting-files",
        contentType: "application/json",
        content: JSON.stringify([{ path: "checklist.md", content: "- item" }]),
        metadata: null,
      };
    });
    vi.mocked(getRuntimeClient).mockReturnValue({
      extensionGetV2,
      extensionResourceReadV2,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(
      getInstructionSkill("ws-skills-extension-read", "workspace.agents.review")
    ).resolves.toEqual({
      id: "workspace.agents.review",
      name: "review",
      description: "Review the current changeset",
      scope: "workspace",
      sourceFamily: "agents",
      sourceRoot: "/repo/.agents/skills",
      entryPath: "/repo/.agents/skills/review/SKILL.md",
      enabled: true,
      aliases: ["review", "agents:review"],
      shadowedBy: undefined,
      frontmatter: { name: "review" },
      body: "Review carefully",
      supportingFiles: [{ path: "checklist.md", content: "- item" }],
    });

    expect(extensionGetV2).toHaveBeenCalledWith({
      workspaceId: "ws-skills-extension-read",
      extensionId: "workspace.agents.review",
    });
    expect(extensionResourceReadV2).toHaveBeenCalledTimes(3);
    expect(invokeMock).not.toHaveBeenCalledWith("native_skill_get", expect.anything());
  });

  it("returns null when the instruction extension does not expose a body resource", async () => {
    const extensionGetV2 = vi.fn(async () => ({
      extensionId: "workspace.agents.review",
      version: "1.0.0",
      displayName: "review",
      publisher: "agents",
      summary: "Review the current changeset",
      kind: "instruction",
      distribution: "workspace",
      name: "review",
      transport: "repo-manifest",
      lifecycleState: "enabled",
      enabled: true,
      workspaceId: "ws-skills-3",
      capabilities: ["instructions"],
      permissions: [],
      uiApps: [],
      provenance: {
        sourceId: "workspace-skill",
        scope: "workspace",
        sourceFamily: "agents",
        sourceRoot: "/repo/.agents/skills",
        entryPath: "/repo/.agents/skills/review/SKILL.md",
        aliases: ["review", "agents:review"],
        shadowedBy: null,
      },
      config: {},
      installedAt: 1,
      updatedAt: 1,
    }));
    const extensionResourceReadV2 = vi.fn(async (request: { resourceId: string }) =>
      request.resourceId === "body" ? null : null
    );
    vi.mocked(getRuntimeClient).mockReturnValue({
      extensionGetV2,
      extensionResourceReadV2,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(getInstructionSkill("ws-skills-3", "workspace.agents.review")).resolves.toBeNull();
  });
});
