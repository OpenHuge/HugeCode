import { invoke, isDesktopHostRuntime } from "@desktop-host/core";
import { listen } from "@desktop-host/event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  detectRuntimeMode,
  getRuntimeClient,
  readRuntimeCapabilitiesSummary,
} from "./runtimeClient";
import {
  __resetLocalUsageSnapshotCacheForTests,
  __resetMockOauthSessionFallbackForTests,
  __resetWebRuntimeOauthFallbackStateForTests,
  applyOAuthPool,
  getAccountInfo,
  getAccountRateLimits,
  listOAuthAccounts,
  listOAuthPoolMembers,
  listOAuthPools,
  localUsageSnapshot,
  readOAuthSubscriptionPersistenceCapability,
  removeOAuthAccount,
  replaceOAuthPoolMembers,
  reportOAuthRateLimit,
  selectOAuthPoolAccount,
  upsertOAuthAccount,
} from "./desktopHost";

vi.mock("@desktop-host/core", () => ({
  invoke: vi.fn(),
  isDesktopHostRuntime: vi.fn(() => true),
}));

vi.mock("@desktop-host/event", () => ({
  listen: vi.fn(),
}));

vi.mock("@desktop-host/notifications", () => ({
  isPermissionGranted: vi.fn(),
  requestPermission: vi.fn(),
  sendNotification: vi.fn(),
}));

vi.mock("./runtimeClient", () => ({
  detectRuntimeMode: vi.fn(() => "desktop-host"),
  getRuntimeClient: vi.fn(),
  readRuntimeCapabilitiesSummary: vi.fn(),
}));

describe("desktop host invoke wrappers (usage + oauth fallbacks)", () => {
  function formatRolloutPathTimestamp(epochMs: number) {
    const date = new Date(epochMs);
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    const hours = String(date.getUTCHours()).padStart(2, "0");
    const minutes = String(date.getUTCMinutes()).padStart(2, "0");
    const seconds = String(date.getUTCSeconds()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}-${minutes}-${seconds}`;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    __resetWebRuntimeOauthFallbackStateForTests();
    __resetMockOauthSessionFallbackForTests();
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
    vi.mocked(detectRuntimeMode).mockReturnValue("desktop-host");
    vi.mocked(readRuntimeCapabilitiesSummary).mockResolvedValue({
      mode: "desktop-host",
      methods: [],
      features: [],
      wsEndpointPath: null,
      error: null,
    });
  });

  it("builds local usage snapshot from runtime cli sessions in web mode", async () => {
    vi.mocked(isDesktopHostRuntime).mockReturnValue(false);
    const sessionAUpdatedAt = Date.now() - 90 * 60 * 1000;
    const sessionBUpdatedAt = Date.now() - 30 * 60 * 1000;
    const runtimeCliSessionsMock = vi.fn().mockResolvedValue([
      {
        sessionId: "session-a",
        updatedAt: sessionAUpdatedAt,
        path: `/tmp/rollout-${formatRolloutPathTimestamp(sessionAUpdatedAt - 60 * 60 * 1000)}-session-a.jsonl`,
      },
      {
        sessionId: "session-b",
        updatedAt: sessionBUpdatedAt,
        path: `/tmp/rollout-${formatRolloutPathTimestamp(sessionBUpdatedAt - 30 * 60 * 1000)}-session-b.jsonl`,
      },
    ]);
    vi.mocked(getRuntimeClient).mockReturnValue({
      cliSessions: runtimeCliSessionsMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);
    const invokeMock = vi.mocked(invoke);

    const snapshot = await localUsageSnapshot(30, null);

    expect(runtimeCliSessionsMock).toHaveBeenCalledTimes(1);
    expect(snapshot.days.reduce((total, day) => total + day.agentRuns, 0)).toBe(2);
    expect(snapshot.days.reduce((total, day) => total + day.agentTimeMs, 0)).toBeGreaterThan(0);
    expect(snapshot.totals.last30DaysTokens).toBe(0);
    expect(snapshot.topModels).toEqual([]);
    expect(invokeMock).not.toHaveBeenCalledWith("local_usage_snapshot", expect.anything());
  });

  it("normalizes non-positive local usage windows in web mode", async () => {
    vi.mocked(isDesktopHostRuntime).mockReturnValue(false);
    const runtimeCliSessionsMock = vi.fn().mockResolvedValue([]);
    vi.mocked(getRuntimeClient).mockReturnValue({
      cliSessions: runtimeCliSessionsMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    const snapshot = await localUsageSnapshot(0, null);

    expect(snapshot.days).toHaveLength(30);
    expect(runtimeCliSessionsMock).toHaveBeenCalledTimes(1);
  });

  it("normalizes local usage snapshot invoke payload arguments", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValueOnce({
      updatedAt: Date.parse("2026-02-11T12:30:00Z"),
      days: [],
      totals: {
        last7DaysTokens: 0,
        last30DaysTokens: 0,
        averageDailyTokens: 0,
        cacheHitRatePercent: 0,
        peakDay: null,
        peakDayTokens: 0,
      },
      topModels: [],
    });

    await localUsageSnapshot(0, "  /tmp/workspace-a  ");

    expect(invokeMock).toHaveBeenCalledWith("local_usage_snapshot", {
      days: 30,
      workspacePath: "/tmp/workspace-a",
    });
  });

  it("deduplicates concurrent local usage snapshot requests for identical inputs", async () => {
    vi.mocked(isDesktopHostRuntime).mockReturnValue(false);
    let resolveSessions!: (value: Array<Record<string, unknown>>) => void;
    const sessionsPromise = new Promise<Array<Record<string, unknown>>>((resolve) => {
      resolveSessions = resolve;
    });
    const runtimeCliSessionsMock = vi.fn().mockReturnValue(sessionsPromise);
    vi.mocked(getRuntimeClient).mockReturnValue({
      cliSessions: runtimeCliSessionsMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    const firstSnapshotPromise = localUsageSnapshot(30, null);
    const secondSnapshotPromise = localUsageSnapshot(30, null);

    expect(runtimeCliSessionsMock).toHaveBeenCalledTimes(1);
    resolveSessions([
      {
        sessionId: "session-concurrent",
        updatedAt: Date.parse("2026-02-11T10:00:00Z"),
        path: "/tmp/rollout-2026-02-11T10-00-00-session-concurrent.jsonl",
      },
    ]);

    const [firstSnapshot, secondSnapshot] = await Promise.all([
      firstSnapshotPromise,
      secondSnapshotPromise,
    ]);
    expect(firstSnapshot).toEqual(secondSnapshot);
    expect(runtimeCliSessionsMock).toHaveBeenCalledTimes(1);
  });

  it("reuses a recent local usage snapshot for repeated identical inputs", async () => {
    vi.mocked(isDesktopHostRuntime).mockReturnValue(false);
    const runtimeCliSessionsMock = vi.fn().mockResolvedValue([
      {
        sessionId: "session-cached",
        updatedAt: Date.parse("2026-02-11T12:00:00Z"),
        path: "/tmp/rollout-2026-02-11T12-00-00-session-cached.jsonl",
      },
    ]);
    vi.mocked(getRuntimeClient).mockReturnValue({
      cliSessions: runtimeCliSessionsMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await localUsageSnapshot(30, null);
    await localUsageSnapshot(30, null);
    await localUsageSnapshot(30, "/tmp/workspace-a");

    expect(runtimeCliSessionsMock).toHaveBeenCalledTimes(2);
  });

  it("falls back to runtime cli sessions when local_usage_snapshot command is unavailable", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockRejectedValueOnce(new Error("unknown command: local_usage_snapshot"));
    const runtimeCliSessionsMock = vi.fn().mockResolvedValue([
      {
        sessionId: "session-fallback",
        updatedAt: Date.parse("2026-02-10T04:00:00Z"),
        path: "/tmp/fallback.jsonl",
      },
    ]);
    vi.mocked(getRuntimeClient).mockReturnValue({
      cliSessions: runtimeCliSessionsMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    const snapshot = await localUsageSnapshot(30, null);

    expect(invokeMock).toHaveBeenCalledWith("local_usage_snapshot", { days: 30 });
    expect(runtimeCliSessionsMock).toHaveBeenCalledTimes(1);
    expect(snapshot.days.reduce((total, day) => total + day.agentRuns, 0)).toBeGreaterThanOrEqual(
      0
    );
    expect(snapshot.updatedAt).toBeGreaterThan(0);
  });

  it("reads codex account info from runtime when available", async () => {
    const oauthSelectPoolAccountMock = vi.fn().mockResolvedValue({
      poolId: "pool-codex",
      reason: "preferred_account",
      account: {
        accountId: "acc-1",
        provider: "codex",
        externalAccountId: "4f253fe4-8b98-4598-b682-ebbfd6a0c001",
        email: "user@example.com",
        displayName: "User",
        status: "enabled",
        disabledReason: null,
        metadata: {
          planType: "pro",
          chatgpt_workspaces: [
            {
              workspace_id: "org-marcos",
              name: "MarcosSauerkraokpq",
              default: true,
            },
          ],
          default_chatgpt_workspace_id: "org-marcos",
        },
        createdAt: 100,
        updatedAt: 200,
      },
    });
    vi.mocked(getRuntimeClient).mockReturnValue({
      oauthSelectPoolAccount: oauthSelectPoolAccountMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(getAccountInfo("ws-1")).resolves.toEqual({
      result: {
        account: {
          type: "chatgpt",
          email: "user@example.com",
          planType: "pro",
          provider: "codex",
          accountId: "acc-1",
          displayName: "User",
          externalAccountId: "4f253fe4-8b98-4598-b682-ebbfd6a0c001",
          defaultChatgptWorkspaceTitle: "MarcosSauerkraokpq",
        },
        requiresOpenaiAuth: false,
        requires_openai_auth: false,
      },
    });
    expect(oauthSelectPoolAccountMock).toHaveBeenCalledWith({
      poolId: "pool-codex",
      sessionId: "ws-1",
      modelId: null,
    });
  });

  it("prefers hydrated codex account profile name over token workspace title", async () => {
    const oauthSelectPoolAccountMock = vi.fn().mockResolvedValue({
      poolId: "pool-codex",
      reason: "preferred_account",
      account: {
        accountId: "acc-1",
        provider: "codex",
        externalAccountId: "e9f5dacf-3788-4b9e-bf82-5c4df748d89d",
        email: "iappsky@gmail.com",
        displayName: "iappsky@gmail.com",
        status: "enabled",
        disabledReason: null,
        metadata: {
          authMode: "chatgpt",
          planType: "team",
          accountName: "lewiszlewisl1983",
          chatgptWorkspaces: [
            {
              workspaceId: "org-personal",
              title: "Personal",
              isDefault: true,
            },
          ],
          defaultChatgptWorkspaceId: "org-personal",
        },
        createdAt: 100,
        updatedAt: 200,
      },
    });
    vi.mocked(getRuntimeClient).mockReturnValue({
      oauthSelectPoolAccount: oauthSelectPoolAccountMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(getAccountInfo("ws-1")).resolves.toEqual({
      result: {
        account: {
          type: "chatgpt",
          email: "iappsky@gmail.com",
          planType: "team",
          provider: "codex",
          accountId: "acc-1",
          displayName: "iappsky@gmail.com",
          externalAccountId: "e9f5dacf-3788-4b9e-bf82-5c4df748d89d",
          defaultChatgptWorkspaceTitle: "lewiszlewisl1983",
          authMode: "chatgpt",
        },
        requiresOpenaiAuth: false,
        requires_openai_auth: false,
      },
    });
  });

  it("routes oauth inventory and mutation wrappers through runtime client in desktop-host mode", async () => {
    const oauthAccountsMock = vi.fn().mockResolvedValue([
      {
        accountId: "acc-1",
        provider: "codex",
        externalAccountId: null,
        email: "user@example.com",
        displayName: "User",
        status: "enabled",
        disabledReason: null,
        metadata: {},
        createdAt: 100,
        updatedAt: 200,
      },
    ]);
    const oauthPoolsMock = vi.fn().mockResolvedValue([
      {
        poolId: "pool-1",
        provider: "codex",
        name: "Primary Pool",
        strategy: "round_robin",
        stickyMode: "cache_first",
        preferredAccountId: "acc-1",
        enabled: true,
        metadata: {},
        createdAt: 100,
        updatedAt: 200,
      },
    ]);
    const oauthPoolMembersMock = vi.fn().mockResolvedValue([
      {
        poolId: "pool-1",
        accountId: "acc-1",
        weight: 1,
        priority: 0,
        position: 0,
        enabled: true,
        createdAt: 100,
        updatedAt: 200,
      },
    ]);
    const oauthUpsertAccountMock = vi.fn().mockResolvedValue({
      accountId: "acc-1",
      provider: "codex",
      externalAccountId: null,
      email: "user@example.com",
      displayName: "User",
      status: "enabled",
      disabledReason: null,
      routeConfig: {
        compatBaseUrl: "https://proxy.example.dev/v1",
        proxyId: "proxy-east",
        priority: 9,
        concurrencyLimit: 2,
        schedulable: true,
      },
      routingState: {
        credentialReady: true,
        lastRoutingError: null,
        rateLimitedUntil: null,
        overloadedUntil: null,
        tempUnschedulableUntil: null,
        tempUnschedulableReason: null,
      },
      metadata: {},
      createdAt: 100,
      updatedAt: 200,
    });
    const oauthRemoveAccountMock = vi.fn().mockResolvedValue(true);
    const oauthApplyPoolMock = vi.fn().mockResolvedValue({
      pool: {
        poolId: "pool-1",
        provider: "codex",
        name: "Primary Pool",
        strategy: "round_robin",
        stickyMode: "cache_first",
        preferredAccountId: "acc-1",
        enabled: true,
        metadata: {},
        createdAt: 100,
        updatedAt: 200,
      },
      members: [
        {
          poolId: "pool-1",
          accountId: "acc-1",
          weight: 1,
          priority: 0,
          position: 0,
          enabled: true,
          createdAt: 100,
          updatedAt: 200,
        },
      ],
    });
    const oauthRemovePoolMock = vi.fn().mockResolvedValue(true);
    const oauthSelectPoolAccountMock = vi.fn().mockResolvedValue({
      poolId: "pool-1",
      reason: "preferred_account",
      account: {
        accountId: "acc-1",
        provider: "codex",
        externalAccountId: null,
        email: "user@example.com",
        displayName: "User",
        status: "enabled",
        disabledReason: null,
        metadata: {},
        createdAt: 100,
        updatedAt: 200,
      },
    });
    vi.mocked(getRuntimeClient).mockReturnValue({
      oauthAccounts: oauthAccountsMock,
      oauthPools: oauthPoolsMock,
      oauthPoolMembers: oauthPoolMembersMock,
      oauthUpsertAccount: oauthUpsertAccountMock,
      oauthRemoveAccount: oauthRemoveAccountMock,
      oauthApplyPool: oauthApplyPoolMock,
      oauthRemovePool: oauthRemovePoolMock,
      oauthSelectPoolAccount: oauthSelectPoolAccountMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await listOAuthAccounts("codex", { usageRefresh: "force" });
    await listOAuthPools("codex");
    await listOAuthPoolMembers("pool-1");
    await upsertOAuthAccount({
      accountId: "acc-1",
      provider: "codex",
      email: "user@example.com",
      status: "enabled",
      routeConfig: {
        compatBaseUrl: "https://proxy.example.dev/v1",
        proxyId: "proxy-east",
        priority: 9,
        concurrencyLimit: 2,
        schedulable: true,
      },
      routingState: {
        credentialReady: true,
        lastRoutingError: null,
        rateLimitedUntil: null,
        overloadedUntil: null,
        tempUnschedulableUntil: null,
        tempUnschedulableReason: null,
      },
      metadata: {},
    });
    await removeOAuthAccount("acc-1");
    await applyOAuthPool({
      pool: {
        poolId: "pool-1",
        provider: "codex",
        name: "Primary Pool",
        strategy: "round_robin",
        stickyMode: "cache_first",
        preferredAccountId: "acc-1",
        enabled: true,
        metadata: {},
      },
      members: [{ accountId: "acc-1" }],
      expectedUpdatedAt: 200,
    });
    await selectOAuthPoolAccount({ poolId: "pool-1", modelId: "gpt-5.3-codex" });

    expect(oauthAccountsMock).toHaveBeenCalledWith("codex", { usageRefresh: "force" });
    expect(oauthPoolsMock).toHaveBeenCalledWith("codex");
    expect(oauthPoolMembersMock).toHaveBeenCalledWith("pool-1");
    expect(oauthUpsertAccountMock).toHaveBeenCalledWith({
      accountId: "acc-1",
      provider: "codex",
      email: "user@example.com",
      status: "enabled",
      routeConfig: {
        compatBaseUrl: "https://proxy.example.dev/v1",
        proxyId: "proxy-east",
        priority: 9,
        concurrencyLimit: 2,
        schedulable: true,
      },
      routingState: {
        credentialReady: true,
        lastRoutingError: null,
        rateLimitedUntil: null,
        overloadedUntil: null,
        tempUnschedulableUntil: null,
        tempUnschedulableReason: null,
      },
      metadata: {},
    });
    expect(oauthRemoveAccountMock).toHaveBeenCalledWith("acc-1");
    expect(oauthApplyPoolMock).toHaveBeenCalledWith({
      pool: {
        poolId: "pool-1",
        provider: "codex",
        name: "Primary Pool",
        strategy: "round_robin",
        stickyMode: "cache_first",
        preferredAccountId: "acc-1",
        enabled: true,
        metadata: {},
      },
      members: [{ accountId: "acc-1" }],
      expectedUpdatedAt: 200,
    });
    expect(oauthSelectPoolAccountMock).toHaveBeenCalledWith({
      poolId: "pool-1",
      modelId: "gpt-5.3-codex",
    });
  });

  it("fails closed instead of persisting typed route config when web oauth persistence is unavailable", async () => {
    vi.mocked(isDesktopHostRuntime).mockReturnValue(false);
    vi.mocked(detectRuntimeMode).mockReturnValue("runtime-gateway-web");
    vi.mocked(getRuntimeClient).mockImplementation(() => {
      throw new Error("runtime unavailable");
    });

    await expect(
      upsertOAuthAccount({
        accountId: "acc-route",
        provider: "codex",
        displayName: "Route account",
        routeConfig: {
          compatBaseUrl: "https://compat.route.dev/v1",
          proxyId: "proxy-route",
          priority: 4,
          concurrencyLimit: 6,
          schedulable: false,
        },
        routingState: {
          credentialReady: false,
          lastRoutingError: "upstream timeout",
          rateLimitedUntil: 123,
          overloadedUntil: 456,
          tempUnschedulableUntil: 789,
          tempUnschedulableReason: "manual drain",
        },
        metadata: { planType: "team" },
      })
    ).rejects.toThrow(/durable oauth persistence is unavailable/i);
  });

  it("falls back to metadata/display identity when oauth account email is missing", async () => {
    const codexAccounts = [
      {
        accountId: "acc-empty",
        provider: "codex",
        externalAccountId: null,
        email: null,
        displayName: null,
        status: "enabled",
        disabledReason: null,
        metadata: {},
        createdAt: 100,
        updatedAt: 400,
      },
      {
        accountId: "acc-meta",
        provider: "codex",
        externalAccountId: null,
        email: null,
        displayName: "Codex Team",
        status: "enabled",
        disabledReason: null,
        metadata: {
          email: "meta@example.com",
          planType: "team",
        },
        createdAt: 100,
        updatedAt: 300,
      },
    ];
    const oauthAccountsMock = vi.fn().mockResolvedValue(codexAccounts);
    const oauthPoolsMock = vi.fn().mockResolvedValue([]);
    const oauthSelectPoolAccountMock = vi.fn().mockResolvedValue({
      poolId: "pool-codex",
      reason: "sticky_binding",
      account: codexAccounts[1],
    });
    vi.mocked(getRuntimeClient).mockReturnValue({
      oauthAccounts: oauthAccountsMock,
      oauthPools: oauthPoolsMock,
      oauthSelectPoolAccount: oauthSelectPoolAccountMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(getAccountInfo("ws-1")).resolves.toEqual({
      result: {
        account: {
          type: "chatgpt",
          email: "meta@example.com",
          planType: "team",
          provider: "codex",
          accountId: "acc-meta",
          displayName: "Codex Team",
          externalAccountId: null,
        },
        requiresOpenaiAuth: false,
        requires_openai_auth: false,
      },
    });
  });

  it("falls back to API key account type when oauth account has no profile fields", async () => {
    const codexAccounts = [
      {
        accountId: "acc-fallback-id",
        provider: "codex",
        externalAccountId: null,
        email: null,
        displayName: null,
        status: "enabled",
        disabledReason: null,
        metadata: {},
        createdAt: 100,
        updatedAt: 500,
      },
    ];
    const oauthAccountsMock = vi.fn().mockResolvedValue(codexAccounts);
    const oauthPoolsMock = vi.fn().mockResolvedValue([]);
    const oauthSelectPoolAccountMock = vi.fn().mockResolvedValue({
      poolId: "pool-codex",
      reason: "sticky_binding",
      account: codexAccounts[0],
    });
    vi.mocked(getRuntimeClient).mockReturnValue({
      oauthAccounts: oauthAccountsMock,
      oauthPools: oauthPoolsMock,
      oauthSelectPoolAccount: oauthSelectPoolAccountMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(getAccountInfo("ws-1")).resolves.toEqual({
      result: {
        account: {
          type: "apikey",
          email: null,
          planType: null,
          provider: "codex",
          accountId: "acc-fallback-id",
          displayName: null,
          externalAccountId: null,
        },
        requiresOpenaiAuth: false,
        requires_openai_auth: false,
      },
    });
  });

  it("preserves oauth auth mode metadata in runtime account info responses", async () => {
    const codexAccounts = [
      {
        accountId: "acc-cli",
        provider: "codex",
        externalAccountId: "sample-handle",
        email: "sample-user@example.com",
        displayName: null,
        status: "enabled",
        disabledReason: null,
        metadata: {
          authMode: "api_key",
          localCliManaged: true,
        },
        createdAt: 100,
        updatedAt: 600,
      },
    ];
    const oauthAccountsMock = vi.fn().mockResolvedValue(codexAccounts);
    const oauthPoolsMock = vi.fn().mockResolvedValue([]);
    const oauthSelectPoolAccountMock = vi.fn().mockResolvedValue({
      poolId: "pool-codex",
      reason: "sticky_binding",
      account: codexAccounts[0],
    });
    vi.mocked(getRuntimeClient).mockReturnValue({
      oauthAccounts: oauthAccountsMock,
      oauthPools: oauthPoolsMock,
      oauthSelectPoolAccount: oauthSelectPoolAccountMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(getAccountInfo("ws-1")).resolves.toEqual({
      result: {
        account: {
          type: "apikey",
          email: "sample-user@example.com",
          planType: null,
          provider: "codex",
          accountId: "acc-cli",
          externalAccountId: "sample-handle",
          displayName: null,
          authMode: "api_key",
          localCliManaged: true,
        },
        requiresOpenaiAuth: false,
        requires_openai_auth: false,
      },
    });
  });

  it("reads account rate limits from runtime metadata when available", async () => {
    const oauthSelectPoolAccountMock = vi.fn().mockResolvedValue({
      poolId: "pool-codex",
      reason: "sticky_binding",
      account: {
        accountId: "acc-1",
        provider: "codex",
        externalAccountId: null,
        email: "user@example.com",
        displayName: "User",
        status: "enabled",
        disabledReason: null,
        metadata: {
          rateLimits: {
            primary: { usedPercent: 12 },
          },
        },
        createdAt: 100,
        updatedAt: 200,
      },
    });
    vi.mocked(getRuntimeClient).mockReturnValue({
      oauthSelectPoolAccount: oauthSelectPoolAccountMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(getAccountRateLimits("ws-1")).resolves.toEqual({
      result: {
        rateLimits: {
          primary: { usedPercent: 12 },
        },
        rate_limits: {
          primary: { usedPercent: 12 },
        },
      },
    });
    expect(oauthSelectPoolAccountMock).toHaveBeenCalledWith({
      poolId: "pool-codex",
      sessionId: "ws-1",
      modelId: null,
    });
  });

  it("normalizes raw wham usage metadata into runtime account rate limits", async () => {
    const codexAccounts = [
      {
        accountId: "acc-1",
        provider: "codex",
        externalAccountId: null,
        email: "user@example.com",
        displayName: "User",
        status: "enabled",
        disabledReason: null,
        metadata: {
          usageCheckedAt: 1_735_300_000_000,
          plan_type: "pro",
          rate_limit: {
            primary_window: {
              used_percent: 12,
              limit_window_seconds: 18_000,
              reset_after_seconds: 600,
            },
            secondary_window: {
              used_percent: 34,
              reset_at: 1_735_920_000,
              limit_window_seconds: 604_800,
            },
          },
          credits: {
            has_credits: true,
            unlimited: false,
            balance: 150.0,
          },
        },
        createdAt: 100,
        updatedAt: 200,
      },
    ];
    const oauthAccountsMock = vi.fn().mockResolvedValue(codexAccounts);
    const oauthPoolsMock = vi.fn().mockResolvedValue([]);
    const oauthSelectPoolAccountMock = vi.fn().mockResolvedValue({
      poolId: "pool-codex",
      reason: "sticky_binding",
      account: codexAccounts[0],
    });
    vi.mocked(getRuntimeClient).mockReturnValue({
      oauthAccounts: oauthAccountsMock,
      oauthPools: oauthPoolsMock,
      oauthSelectPoolAccount: oauthSelectPoolAccountMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(getAccountRateLimits("ws-1")).resolves.toEqual({
      result: {
        rateLimits: {
          primary: {
            usedPercent: 12,
            windowDurationMins: 300,
            resetsAt: 1_735_300_600_000,
          },
          secondary: {
            usedPercent: 34,
            windowDurationMins: 10_080,
            resetsAt: 1_735_920_000_000,
          },
          credits: {
            hasCredits: true,
            unlimited: false,
            balance: "150",
          },
          planType: "pro",
        },
        rate_limits: {
          primary: {
            usedPercent: 12,
            windowDurationMins: 300,
            resetsAt: 1_735_300_600_000,
          },
          secondary: {
            usedPercent: 34,
            windowDurationMins: 10_080,
            resetsAt: 1_735_920_000_000,
          },
          credits: {
            hasCredits: true,
            unlimited: false,
            balance: "150",
          },
          planType: "pro",
        },
      },
    });
  });

  it("returns codex-first flattened rate limits when metadata provides rate_limits_by_limit_id", async () => {
    const rateLimitsByLimitId = {
      claude: {
        primary: { usedPercent: 12 },
        planType: "team",
        limit_id: "claude",
      },
      codex: {
        primary: { usedPercent: 66 },
        secondary: { usedPercent: 20 },
        planType: "pro",
        limit_id: "codex",
        limit_name: "Codex",
      },
    };
    const codexAccounts = [
      {
        accountId: "acc-1",
        provider: "codex",
        externalAccountId: null,
        email: "user@example.com",
        displayName: "User",
        status: "enabled",
        disabledReason: null,
        metadata: {
          rate_limits_by_limit_id: rateLimitsByLimitId,
        },
        createdAt: 100,
        updatedAt: 200,
      },
    ];
    const oauthAccountsMock = vi.fn().mockResolvedValue(codexAccounts);
    const oauthPoolsMock = vi.fn().mockResolvedValue([]);
    const oauthSelectPoolAccountMock = vi.fn().mockResolvedValue({
      poolId: "pool-codex",
      reason: "sticky_binding",
      account: codexAccounts[0],
    });
    vi.mocked(getRuntimeClient).mockReturnValue({
      oauthAccounts: oauthAccountsMock,
      oauthPools: oauthPoolsMock,
      oauthSelectPoolAccount: oauthSelectPoolAccountMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(getAccountRateLimits("ws-1")).resolves.toEqual({
      result: {
        rateLimits: {
          primary: { usedPercent: 66 },
          secondary: { usedPercent: 20 },
          planType: "pro",
          limit_id: "codex",
          limit_name: "Codex",
          limitId: "codex",
          limitName: "Codex",
        },
        rate_limits: {
          primary: { usedPercent: 66 },
          secondary: { usedPercent: 20 },
          planType: "pro",
          limit_id: "codex",
          limit_name: "Codex",
          limitId: "codex",
          limitName: "Codex",
        },
        rateLimitsByLimitId: rateLimitsByLimitId,
        rate_limits_by_limit_id: rateLimitsByLimitId,
      },
    });
  });

  it("uses force-refreshed codex account metadata when pool selection lacks rate limits", async () => {
    const oauthAccountsMock = vi.fn().mockResolvedValue([
      {
        accountId: "acc-1",
        provider: "codex",
        externalAccountId: null,
        email: "user@example.com",
        displayName: "User",
        status: "enabled",
        disabledReason: null,
        metadata: {
          usageCheckedAt: 1_735_300_000_000,
          plan_type: "pro",
          rate_limit: {
            primary_window: {
              used_percent: 44,
              limit_window_seconds: 18_000,
              reset_after_seconds: 600,
            },
          },
        },
        createdAt: 100,
        updatedAt: 200,
      },
    ]);
    const oauthSelectPoolAccountMock = vi.fn().mockResolvedValue({
      poolId: "pool-codex",
      reason: "sticky_binding",
      account: {
        accountId: "acc-1",
        provider: "codex",
        externalAccountId: null,
        email: "user@example.com",
        displayName: "User",
        status: "enabled",
        disabledReason: null,
        metadata: {},
        createdAt: 100,
        updatedAt: 200,
      },
    });
    vi.mocked(getRuntimeClient).mockReturnValue({
      oauthAccounts: oauthAccountsMock,
      oauthSelectPoolAccount: oauthSelectPoolAccountMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(getAccountRateLimits("ws-1")).resolves.toEqual({
      result: {
        rateLimits: {
          primary: {
            usedPercent: 44,
            windowDurationMins: 300,
            resetsAt: 1_735_300_600_000,
          },
          planType: "pro",
        },
        rate_limits: {
          primary: {
            usedPercent: 44,
            windowDurationMins: 300,
            resetsAt: 1_735_300_600_000,
          },
          planType: "pro",
        },
      },
    });
    expect(oauthAccountsMock).toHaveBeenCalledWith("codex", { usageRefresh: "force" });
    expect(oauthSelectPoolAccountMock).toHaveBeenCalledWith({
      poolId: "pool-codex",
      sessionId: "ws-1",
      modelId: null,
    });
  });

  it("does not fall back to legacy account_read invoke when runtime account resolution fails", async () => {
    const invokeMock = vi.mocked(invoke);
    vi.mocked(getRuntimeClient).mockReturnValue({
      oauthAccounts: vi.fn().mockRejectedValue(new Error("runtime accounts failed")),
      oauthPools: vi.fn().mockRejectedValue(new Error("runtime pools failed")),
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(getAccountInfo("")).rejects.toThrow("runtime accounts failed");
    expect(invokeMock).not.toHaveBeenCalledWith("oauth_accounts_list", expect.anything());
    expect(invokeMock).not.toHaveBeenCalledWith("oauth_pools_list", expect.anything());
    expect(invokeMock).not.toHaveBeenCalledWith("account_read", expect.anything());
  });

  it("does not fall back to legacy account_rate_limits invoke when runtime account resolution fails", async () => {
    const invokeMock = vi.mocked(invoke);
    vi.mocked(getRuntimeClient).mockReturnValue({
      oauthAccounts: vi.fn().mockRejectedValue(new Error("runtime accounts failed")),
      oauthPools: vi.fn().mockRejectedValue(new Error("runtime pools failed")),
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(getAccountRateLimits("ws-1")).rejects.toThrow("runtime accounts failed");
    expect(invokeMock).not.toHaveBeenCalledWith("oauth_accounts_list", expect.anything());
    expect(invokeMock).not.toHaveBeenCalledWith("oauth_pools_list", expect.anything());
    expect(invokeMock).not.toHaveBeenCalledWith("account_rate_limits", expect.anything());
  });

  it("fails closed for multi-provider oauth account reads in web mode", async () => {
    vi.mocked(isDesktopHostRuntime).mockReturnValue(false);
    vi.mocked(getRuntimeClient).mockReturnValue({
      oauthAccounts: vi.fn().mockRejectedValue(new Error("accounts failed")),
      oauthPools: vi.fn().mockRejectedValue(new Error("pools failed")),
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(listOAuthAccounts("gemini")).rejects.toThrow(
      /durable oauth persistence is unavailable/i
    );
    await expect(listOAuthPools("gemini")).rejects.toThrow(
      /durable oauth persistence is unavailable/i
    );
    await expect(getAccountInfo("")).rejects.toThrow(/durable oauth persistence is unavailable/i);
    await expect(getAccountRateLimits("")).rejects.toThrow(
      /durable oauth persistence is unavailable/i
    );
    await expect(removeOAuthAccount("gem-1")).rejects.toThrow(
      /durable oauth persistence is unavailable/i
    );
  });

  it("fails closed for oauth pool member writes and reads in web mode when runtime calls fail", async () => {
    vi.mocked(isDesktopHostRuntime).mockReturnValue(false);
    vi.mocked(getRuntimeClient).mockReturnValue({
      oauthReplacePoolMembers: vi.fn().mockRejectedValue(new Error("replace failed")),
      oauthPoolMembers: vi.fn().mockRejectedValue(new Error("members list failed")),
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(
      replaceOAuthPoolMembers("pool-member-gemini", [
        {
          accountId: "pool-member-gem-1",
          weight: 0,
          priority: -5,
          position: -1,
          enabled: false,
        },
      ])
    ).rejects.toThrow(/durable oauth persistence is unavailable/i);
    await expect(listOAuthPoolMembers("pool-member-gemini")).rejects.toThrow(
      /durable oauth persistence is unavailable/i
    );
  });

  it("fails closed for oauth pool selection in web mode", async () => {
    vi.mocked(isDesktopHostRuntime).mockReturnValue(false);
    vi.mocked(getRuntimeClient).mockReturnValue({
      oauthSelectPoolAccount: vi.fn().mockRejectedValue(new Error("selection failed")),
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(selectOAuthPoolAccount({ poolId: "pool-select-codex" })).rejects.toThrow(
      /durable oauth persistence is unavailable/i
    );
  });

  it("forwards explicit chatgptWorkspaceId to runtime selection and still fails closed in web mode", async () => {
    vi.mocked(isDesktopHostRuntime).mockReturnValue(false);
    const oauthSelectPoolAccountMock = vi.fn().mockRejectedValue(new Error("selection failed"));
    vi.mocked(getRuntimeClient).mockReturnValue({
      oauthSelectPoolAccount: oauthSelectPoolAccountMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(
      selectOAuthPoolAccount({
        poolId: "pool-select-chatgpt-workspace",
        chatgptWorkspaceId: "org-b",
        workspaceId: "org-a",
      })
    ).rejects.toThrow(/durable oauth persistence is unavailable/i);
    expect(oauthSelectPoolAccountMock).toHaveBeenCalledWith({
      poolId: "pool-select-chatgpt-workspace",
      chatgptWorkspaceId: "org-b",
      workspaceId: "org-a",
    });
  });

  it("fails closed for rate-limit reporting in web mode when runtime calls fail", async () => {
    vi.mocked(isDesktopHostRuntime).mockReturnValue(false);
    vi.mocked(getRuntimeClient).mockReturnValue({
      oauthReportRateLimit: vi.fn().mockRejectedValue(new Error("report failed")),
    } as unknown as ReturnType<typeof getRuntimeClient>);

    const resetAt = Date.now() + 60_000;
    await expect(
      reportOAuthRateLimit({
        accountId: "rate-limit-codex-1",
        modelId: "gpt-5",
        success: false,
        retryAfterSec: 60,
        resetAt,
        errorCode: "rate_limit_exceeded",
        errorMessage: "fallback test",
      })
    ).rejects.toThrow(/durable oauth persistence is unavailable/i);
  });

  it("does not write mock oauth fallback storage in web mode when persistence is unavailable", async () => {
    vi.mocked(isDesktopHostRuntime).mockReturnValue(false);

    await expect(
      upsertOAuthAccount({
        accountId: "session-only-1",
        provider: "codex",
        email: "session-only@example.com",
        status: "enabled",
        metadata: {},
      })
    ).rejects.toThrow(/durable oauth persistence is unavailable/i);
    expect(localStorage.getItem("codex_monitor_mock_oauth_accounts_v1")).toBeNull();
    expect(localStorage.getItem("codex_monitor_mock_oauth_pools_v1")).toBeNull();
    expect(localStorage.getItem("codex_monitor_mock_oauth_pool_members_v1")).toBeNull();
  });

  it("reports runtime-backed oauth subscription persistence in desktop-host mode", () => {
    vi.mocked(isDesktopHostRuntime).mockReturnValue(true);
    vi.mocked(detectRuntimeMode).mockReturnValue("desktop-host");

    expect(readOAuthSubscriptionPersistenceCapability()).toEqual({
      hostMode: "desktop-host",
      persistenceKind: "runtime-backed",
      runtimeBacked: true,
      durableStorage: true,
      workspaceAwareSessionBinding: true,
      summary:
        "Runtime-backed subscription persistence is active. ChatGPT workspace memberships, default workspace overrides, and workspace-aware session bindings are durably stored.",
    });
  });

  it("reports unavailable oauth subscription persistence when web oauth cannot durably bind state", async () => {
    vi.mocked(isDesktopHostRuntime).mockReturnValue(false);
    vi.mocked(detectRuntimeMode).mockReturnValue("runtime-gateway-web");
    vi.mocked(getRuntimeClient).mockImplementation(() => {
      throw new Error("runtime unavailable");
    });

    expect(readOAuthSubscriptionPersistenceCapability()).toEqual({
      hostMode: "runtime-gateway-web",
      persistenceKind: "runtime-unavailable",
      runtimeBacked: false,
      durableStorage: false,
      workspaceAwareSessionBinding: false,
      summary:
        "Web runtime durable OAuth persistence is unavailable. Authentication is not complete, no durable account or workspace binding has been written, and the UI must remain disconnected until runtime-backed OAuth recovers.",
    });
  });

  it("fails closed for oauth pool apply in web mode", async () => {
    vi.mocked(isDesktopHostRuntime).mockReturnValue(false);
    vi.mocked(getRuntimeClient).mockReturnValue({
      oauthApplyPool: vi.fn().mockRejectedValue(new Error("runtime oauth apply failed")),
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(
      applyOAuthPool({
        pool: {
          poolId: "pool-apply-gemini",
          provider: "gemini",
          name: "Pool Apply Gemini",
          strategy: "round_robin",
          stickyMode: "cache_first",
          preferredAccountId: "pool-apply-gem-1",
          enabled: true,
          metadata: {},
        },
        members: [{ accountId: "pool-apply-gem-1", weight: 2, priority: 0, position: 0 }],
        expectedUpdatedAt: null,
      })
    ).rejects.toThrow(/durable oauth persistence is unavailable/i);
  });

  it("rejects oauth pool apply when structured conflict code is present in nested error chain", async () => {
    vi.mocked(isDesktopHostRuntime).mockReturnValue(false);
    vi.mocked(getRuntimeClient).mockReturnValue({
      oauthApplyPool: vi.fn().mockRejectedValue({
        details: {
          error: {
            code: "runtime.approval.pool.version_mismatch",
            message: "Pool revision mismatch.",
          },
        },
      }),
      oauthPools: vi.fn().mockResolvedValue([]),
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(
      applyOAuthPool({
        pool: {
          poolId: "pool-conflict-gemini",
          provider: "gemini",
          name: "Pool Conflict Gemini",
          strategy: "round_robin",
          stickyMode: "cache_first",
          preferredAccountId: "pool-conflict-gem-1",
          enabled: true,
          metadata: {},
        },
        members: [{ accountId: "pool-conflict-gem-1", weight: 1, priority: 0, position: 0 }],
        expectedUpdatedAt: null,
      })
    ).rejects.toMatchObject({
      code: "runtime.approval.pool.version_mismatch",
    });

    await expect(listOAuthPools("gemini")).resolves.toEqual([]);
  });

  it("does not treat legacy prefix-only oauth pool apply failures as version mismatch conflicts", async () => {
    vi.mocked(isDesktopHostRuntime).mockReturnValue(false);
    vi.mocked(getRuntimeClient).mockReturnValue({
      oauthApplyPool: vi
        .fn()
        .mockRejectedValue(new Error("POOL_VERSION_MISMATCH:pool-prefix-only-gemini")),
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(
      applyOAuthPool({
        pool: {
          poolId: "pool-prefix-only-gemini",
          provider: "gemini",
          name: "Pool Prefix Gemini",
          strategy: "round_robin",
          stickyMode: "cache_first",
          preferredAccountId: "pool-prefix-gem-1",
          enabled: true,
          metadata: {},
        },
        members: [{ accountId: "pool-prefix-gem-1", weight: 1, priority: 0, position: 0 }],
        expectedUpdatedAt: null,
      })
    ).rejects.toThrow(/durable oauth persistence is unavailable/i);
  });

  it("fails closed when web runtime oauth account listing hangs", async () => {
    vi.mocked(isDesktopHostRuntime).mockReturnValue(false);

    const runtimeOauthAccountsMock = vi.fn(
      () =>
        new Promise<unknown>(() => undefined) as Promise<
          Awaited<ReturnType<typeof listOAuthAccounts>>
        >
    );
    vi.mocked(getRuntimeClient).mockReturnValue({
      oauthAccounts: runtimeOauthAccountsMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    vi.useFakeTimers();
    try {
      const accountsPromise = listOAuthAccounts("codex");
      const rejection = expect(accountsPromise).rejects.toThrow(
        /durable oauth persistence is unavailable/i
      );
      await vi.advanceTimersByTimeAsync(2_100);
      await rejection;
    } finally {
      vi.useRealTimers();
    }
  });

  it("aborts direct web oauth rpc requests when timeout elapses", async () => {
    vi.mocked(isDesktopHostRuntime).mockReturnValue(false);
    vi.mocked(detectRuntimeMode).mockReturnValue("runtime-gateway-web");
    vi.stubEnv("VITE_CODE_RUNTIME_GATEWAY_WEB_ENDPOINT", "http://127.0.0.1:8788/rpc");

    let capturedSignal: AbortSignal | undefined;
    const fetchMock = vi
      .fn()
      .mockImplementation((_input: RequestInfo | URL, init?: RequestInit) => {
        const signal = init?.signal;
        capturedSignal = signal ?? undefined;
        return new Promise<Response>((_resolve, reject) => {
          signal?.addEventListener("abort", () => {
            reject(new Error("AbortError"));
          });
        });
      });
    vi.stubGlobal("fetch", fetchMock);

    vi.useFakeTimers();
    try {
      const accountsPromise = listOAuthAccounts("codex");
      const rejection = expect(accountsPromise).rejects.toThrow(
        /durable oauth persistence is unavailable/i
      );
      await vi.advanceTimersByTimeAsync(30_100);
      await rejection;
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(capturedSignal).toBeDefined();
      expect(capturedSignal?.aborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("skips repeated runtime oauth account calls during cooldown after timeout", async () => {
    vi.mocked(isDesktopHostRuntime).mockReturnValue(false);

    const runtimeOauthAccountsMock = vi.fn(
      () =>
        new Promise<unknown>(() => undefined) as Promise<
          Awaited<ReturnType<typeof listOAuthAccounts>>
        >
    );
    vi.mocked(getRuntimeClient).mockReturnValue({
      oauthAccounts: runtimeOauthAccountsMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    vi.useFakeTimers();
    try {
      const firstPromise = listOAuthAccounts("codex");
      const firstRejection = expect(firstPromise).rejects.toThrow(
        /durable oauth persistence is unavailable/i
      );
      await vi.advanceTimersByTimeAsync(2_100);
      await firstRejection;
      await expect(listOAuthAccounts("codex")).rejects.toThrow(
        /durable oauth persistence is unavailable/i
      );
      expect(runtimeOauthAccountsMock).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("dedupes concurrent web oauth account calls for the same provider", async () => {
    vi.mocked(isDesktopHostRuntime).mockReturnValue(false);
    const sharedAccounts = [
      {
        accountId: "web-concurrent-1",
        provider: "codex",
        externalAccountId: "ext-1",
        email: "concurrent@example.com",
        displayName: "Concurrent",
        status: "enabled",
        disabledReason: null,
        metadata: {},
        createdAt: 1,
        updatedAt: 1,
      },
    ] as Awaited<ReturnType<typeof listOAuthAccounts>>;
    let resolveAccounts!: (value: Awaited<ReturnType<typeof listOAuthAccounts>>) => void;
    const pendingAccountsPromise = new Promise<Awaited<ReturnType<typeof listOAuthAccounts>>>(
      (resolve) => {
        resolveAccounts = resolve;
      }
    );
    const runtimeOauthAccountsMock = vi.fn(() => pendingAccountsPromise);
    vi.mocked(getRuntimeClient).mockReturnValue({
      oauthAccounts: runtimeOauthAccountsMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    const firstPromise = listOAuthAccounts("codex");
    const secondPromise = listOAuthAccounts("codex");

    expect(runtimeOauthAccountsMock).toHaveBeenCalledTimes(1);
    resolveAccounts(sharedAccounts);
    await expect(Promise.all([firstPromise, secondPromise])).resolves.toEqual([
      [
        expect.objectContaining({
          ...sharedAccounts[0],
          routeConfig: null,
          routingState: null,
        }),
      ],
      [
        expect.objectContaining({
          ...sharedAccounts[0],
          routeConfig: null,
          routingState: null,
        }),
      ],
    ]);
  });
});
