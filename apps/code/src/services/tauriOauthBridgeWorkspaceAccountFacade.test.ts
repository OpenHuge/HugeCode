import { describe, expect, it, vi } from "vitest";
import {
  getAccountInfo,
  getAccountRateLimits,
  readOAuthSubscriptionPersistenceCapability,
} from "./tauriOauthBridgeWorkspaceAccountFacade";
import { RuntimeRpcContractFeatureMissingError } from "./runtimeClientCapabilitiesContract";

function createDeps(overrides: Partial<Parameters<typeof getAccountInfo>[0]> = {}) {
  return {
    defaultCodexOauthPoolId: "pool-codex",
    listOAuthAccounts: vi.fn().mockResolvedValue([]),
    listOAuthPools: vi.fn().mockResolvedValue([]),
    getRuntimeClient: vi.fn().mockReturnValue({}),
    normalizeOAuthAccountSummary: (account: unknown) => account,
    normalizeNullableText: (value: unknown) =>
      typeof value === "string" && value.trim().length > 0 ? value.trim() : null,
    isRuntimeMethodUnsupportedError: vi.fn().mockReturnValue(false),
    logRuntimeWarning: vi.fn(),
    detectRuntimeMode: vi.fn().mockReturnValue("runtime-gateway-web" as const),
    isWebRuntimeOauthCooldownActive: vi.fn().mockReturnValue(false),
    webRuntimePersistenceConfigured: true,
    mockOauthFallbackActive: false,
    ...overrides,
  };
}

describe("tauriOauthBridgeWorkspaceAccountFacade", () => {
  it("reports runtime-backed subscription persistence when gateway state is healthy", () => {
    expect(readOAuthSubscriptionPersistenceCapability(createDeps())).toMatchObject({
      hostMode: "runtime-gateway-web",
      persistenceKind: "runtime-backed",
      runtimeBacked: true,
      durableStorage: true,
      workspaceAwareSessionBinding: true,
    });
  });

  it("reports unavailable persistence instead of fallback session state", () => {
    expect(
      readOAuthSubscriptionPersistenceCapability(
        createDeps({
          isWebRuntimeOauthCooldownActive: vi.fn().mockReturnValue(true),
        })
      )
    ).toMatchObject({
      hostMode: "runtime-gateway-web",
      persistenceKind: "runtime-unavailable",
      runtimeBacked: false,
      durableStorage: false,
      workspaceAwareSessionBinding: false,
    });
  });

  it("forces codex usage refresh for account rate limits and does not fall back to unscoped account reads", async () => {
    const oauthAccounts = vi.fn().mockResolvedValue([]);
    const deps = createDeps({
      listOAuthAccounts: oauthAccounts,
      getRuntimeClient: vi.fn().mockReturnValue({
        oauthAccounts: vi.fn(),
        oauthSelectPoolAccount: vi.fn().mockResolvedValue(null),
      }),
    });

    await getAccountRateLimits(deps, "ws-1");
    await getAccountInfo(deps, "ws-1");

    expect(oauthAccounts).toHaveBeenCalledTimes(1);
    expect(oauthAccounts).toHaveBeenNthCalledWith(1, "codex", { usageRefresh: "force" });
  });

  it("treats runtime contract guard failures as unavailable workspace binding without warning spam", async () => {
    const logRuntimeWarning = vi.fn();
    const deps = createDeps({
      logRuntimeWarning,
      getRuntimeClient: vi.fn().mockReturnValue({
        oauthSelectPoolAccount: vi
          .fn()
          .mockRejectedValue(
            new RuntimeRpcContractFeatureMissingError(["runtime_review_linkage_v1"])
          ),
      }),
    });

    await expect(getAccountInfo(deps, "ws-1")).rejects.toMatchObject({
      code: "runtime.oauth.workspace_binding_unavailable",
    });
    expect(logRuntimeWarning).not.toHaveBeenCalled();
  });
});
