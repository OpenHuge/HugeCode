import { isDesktopHostRuntime } from "@desktop-host/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { detectRuntimeMode, getRuntimeClient } from "./runtimeClient";
import {
  __resetMockOauthSessionFallbackForTests,
  __resetWebRuntimeOauthFallbackStateForTests,
  applyOAuthPool,
  bindOAuthPoolAccount,
  readOAuthSubscriptionPersistenceCapability,
  runCodexLogin,
  upsertOAuthAccount,
} from "./desktopHost";

vi.mock("@desktop-host/core", () => ({
  invoke: vi.fn(),
  isDesktopHostRuntime: vi.fn(() => true),
}));

vi.mock("./runtimeClient", () => ({
  detectRuntimeMode: vi.fn(() => "desktop-compat"),
  getRuntimeClient: vi.fn(),
}));

describe("desktop host oauth fail-closed behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    __resetWebRuntimeOauthFallbackStateForTests();
    __resetMockOauthSessionFallbackForTests();
    vi.mocked(isDesktopHostRuntime).mockReturnValue(false);
    vi.mocked(detectRuntimeMode).mockReturnValue("runtime-gateway-web");
    vi.mocked(getRuntimeClient).mockImplementation(() => {
      throw new Error("runtime unavailable");
    });
  });

  it("reports runtime binding unavailable instead of fallback session persistence", () => {
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

  it("rejects account upserts when runtime-backed web oauth persistence is unavailable", async () => {
    vi.mocked(getRuntimeClient).mockReturnValue({
      oauthUpsertAccount: vi
        .fn()
        .mockRejectedValue(new Error("runtime oauth account upsert failed")),
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(
      upsertOAuthAccount({
        accountId: "acct-1",
        provider: "codex",
        email: "acct-1@example.com",
        status: "enabled",
        metadata: {},
      })
    ).rejects.toThrow("runtime oauth account upsert failed");
  });

  it("rejects workspace account binding when runtime-backed web oauth persistence is unavailable", async () => {
    vi.mocked(getRuntimeClient).mockReturnValue({
      oauthBindPoolAccount: vi.fn().mockRejectedValue(new Error("runtime oauth bind failed")),
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(
      bindOAuthPoolAccount({
        poolId: "pool-codex",
        sessionId: "ws-1",
        accountId: "acct-1",
        chatgptWorkspaceId: "org-1",
      })
    ).rejects.toThrow("runtime oauth bind failed");
  });

  it("rejects oauth pool writes when runtime-backed web oauth persistence is unavailable", async () => {
    vi.mocked(getRuntimeClient).mockReturnValue({
      oauthApplyPool: vi.fn().mockRejectedValue(new Error("runtime oauth apply failed")),
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(
      applyOAuthPool({
        pool: {
          poolId: "pool-codex",
          provider: "codex",
          name: "Codex Pool",
          strategy: "p2c",
          stickyMode: "cache_first",
          preferredAccountId: "acct-1",
          enabled: true,
          metadata: {},
        },
        members: [{ accountId: "acct-1" }],
        expectedUpdatedAt: null,
      })
    ).rejects.toThrow(/durable oauth persistence is unavailable/i);
  });

  it("rejects codex login start when the web runtime oauth endpoint is unavailable", async () => {
    vi.stubEnv("VITE_CODE_RUNTIME_GATEWAY_WEB_ENDPOINT", "http://127.0.0.1:8788/rpc");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((input: RequestInfo | URL) => {
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
          new Response(JSON.stringify({ error: { message: "oauth start unavailable" } }), {
            status: 503,
            headers: { "content-type": "application/json" },
          })
        );
      })
    );
    vi.mocked(getRuntimeClient).mockReturnValue({
      oauthAccounts: vi.fn().mockResolvedValue([]),
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(runCodexLogin("ws-1", { forceOAuth: true })).rejects.toThrow(
      "oauth start unavailable"
    );
  });
});
