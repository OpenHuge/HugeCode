import type {
  OAuthAccountSummary,
  OAuthPrimaryAccountSummary,
  OAuthPoolMember,
  OAuthPoolSummary,
  OAuthProviderId,
  OAuthUsageRefreshMode,
} from "./runtimeClient";
import { createWebRuntimeOauthPersistenceUnavailableError } from "./oauthBridgeWebRuntime";

type RuntimeClientOAuthBridge = {
  oauthAccounts(
    provider: OAuthProviderId | null,
    options?: { usageRefresh?: OAuthUsageRefreshMode | null }
  ): Promise<OAuthAccountSummary[]>;
  oauthPools(provider: OAuthProviderId | null): Promise<OAuthPoolSummary[]>;
  oauthPoolMembers(poolId: string): Promise<OAuthPoolMember[]>;
  oauthPrimaryAccountGet(provider: OAuthProviderId): Promise<OAuthPrimaryAccountSummary>;
};

export type OAuthBridgeListingFacadeDeps = {
  oauthAccountsRpcMethod: string;
  oauthPrimaryAccountGetRpcMethod: string;
  oauthPoolsRpcMethod: string;
  oauthPoolMembersRpcMethod: string;
  webRuntimeOauthDirectRpcTimeoutMs: number;
  webRuntimeOauthFallbackTimeoutMs: number;
  isTauri(): boolean;
  shouldUseWebRuntimeDirectRpc(): boolean;
  isWebRuntimeOauthCooldownActive(): boolean;
  runWebRuntimeOAuthRequest<Result>(key: string, request: () => Promise<Result>): Promise<Result>;
  awaitWebRuntimeWithFallbackTimeout<Result>(
    request: (signal: AbortSignal | undefined) => Promise<Result>,
    label: string,
    timeoutMs: number
  ): Promise<Result>;
  invokeWebRuntimeRpc<Result>(
    method: string,
    params: Record<string, unknown>,
    signal?: AbortSignal
  ): Promise<Result>;
  getRuntimeClient(): RuntimeClientOAuthBridge;
  clearWebRuntimeOauthCooldown(): void;
  clearMockOauthFallbackActive(): void;
  markWebRuntimeOauthCooldown(error: unknown, label: string): void;
  listMockOAuthAccounts(provider: OAuthProviderId | null): OAuthAccountSummary[];
  listMockOAuthPools(provider: OAuthProviderId | null): OAuthPoolSummary[];
  listMockOAuthPoolMembers(poolId: string): OAuthPoolMember[];
  normalizeOAuthAccountSummary(account: OAuthAccountSummary): OAuthAccountSummary;
};

export async function listOAuthAccounts(
  deps: OAuthBridgeListingFacadeDeps,
  provider: OAuthProviderId | null = null,
  options: { usageRefresh?: OAuthUsageRefreshMode | null } = {}
): Promise<OAuthAccountSummary[]> {
  if (deps.isWebRuntimeOauthCooldownActive()) {
    throw createWebRuntimeOauthPersistenceUnavailableError("oauth accounts");
  }
  try {
    const useDirectRpc = deps.shouldUseWebRuntimeDirectRpc();
    const usageRefresh = options.usageRefresh ?? null;
    const accounts = await deps.runWebRuntimeOAuthRequest<OAuthAccountSummary[]>(
      `oauth_accounts:${provider ?? "*"}:${usageRefresh ?? "default"}`,
      () =>
        deps.awaitWebRuntimeWithFallbackTimeout(
          (signal) =>
            useDirectRpc
              ? deps.invokeWebRuntimeRpc<OAuthAccountSummary[]>(
                  deps.oauthAccountsRpcMethod,
                  usageRefresh ? { provider, usageRefresh } : { provider },
                  signal
                )
              : usageRefresh
                ? deps.getRuntimeClient().oauthAccounts(provider, { usageRefresh })
                : deps.getRuntimeClient().oauthAccounts(provider),
          "oauth accounts",
          useDirectRpc
            ? deps.webRuntimeOauthDirectRpcTimeoutMs
            : deps.webRuntimeOauthFallbackTimeoutMs
        )
    );
    deps.clearWebRuntimeOauthCooldown();
    deps.clearMockOauthFallbackActive();
    return accounts.map(deps.normalizeOAuthAccountSummary);
  } catch (error) {
    if (deps.isTauri()) {
      throw error;
    }
    deps.markWebRuntimeOauthCooldown(error, "oauth accounts");
    throw createWebRuntimeOauthPersistenceUnavailableError("oauth accounts", error);
  }
}

export async function listOAuthPools(
  deps: OAuthBridgeListingFacadeDeps,
  provider: OAuthProviderId | null = null
): Promise<OAuthPoolSummary[]> {
  if (deps.isWebRuntimeOauthCooldownActive()) {
    throw createWebRuntimeOauthPersistenceUnavailableError("oauth pools");
  }
  try {
    const useDirectRpc = deps.shouldUseWebRuntimeDirectRpc();
    const pools = await deps.runWebRuntimeOAuthRequest<OAuthPoolSummary[]>(
      `oauth_pools:${provider ?? "*"}`,
      () =>
        deps.awaitWebRuntimeWithFallbackTimeout(
          (signal) =>
            useDirectRpc
              ? deps.invokeWebRuntimeRpc<OAuthPoolSummary[]>(
                  deps.oauthPoolsRpcMethod,
                  { provider },
                  signal
                )
              : deps.getRuntimeClient().oauthPools(provider),
          "oauth pools",
          useDirectRpc
            ? deps.webRuntimeOauthDirectRpcTimeoutMs
            : deps.webRuntimeOauthFallbackTimeoutMs
        )
    );
    deps.clearWebRuntimeOauthCooldown();
    deps.clearMockOauthFallbackActive();
    return pools;
  } catch (error) {
    if (deps.isTauri()) {
      throw error;
    }
    deps.markWebRuntimeOauthCooldown(error, "oauth pools");
    throw createWebRuntimeOauthPersistenceUnavailableError("oauth pools", error);
  }
}

export async function listOAuthPoolMembers(
  deps: OAuthBridgeListingFacadeDeps,
  poolId: string
): Promise<OAuthPoolMember[]> {
  if (deps.isWebRuntimeOauthCooldownActive()) {
    throw createWebRuntimeOauthPersistenceUnavailableError("oauth pool members");
  }
  try {
    const useDirectRpc = deps.shouldUseWebRuntimeDirectRpc();
    const members = await deps.runWebRuntimeOAuthRequest<OAuthPoolMember[]>(
      `oauth_pool_members:${poolId}`,
      () =>
        deps.awaitWebRuntimeWithFallbackTimeout(
          (signal) =>
            useDirectRpc
              ? deps.invokeWebRuntimeRpc<OAuthPoolMember[]>(
                  deps.oauthPoolMembersRpcMethod,
                  { poolId },
                  signal
                )
              : deps.getRuntimeClient().oauthPoolMembers(poolId),
          "oauth pool members",
          useDirectRpc
            ? deps.webRuntimeOauthDirectRpcTimeoutMs
            : deps.webRuntimeOauthFallbackTimeoutMs
        )
    );
    deps.clearWebRuntimeOauthCooldown();
    deps.clearMockOauthFallbackActive();
    return members;
  } catch (error) {
    if (deps.isTauri()) {
      throw error;
    }
    deps.markWebRuntimeOauthCooldown(error, "oauth pool members");
    throw createWebRuntimeOauthPersistenceUnavailableError("oauth pool members", error);
  }
}

export async function getOAuthPrimaryAccount(
  deps: OAuthBridgeListingFacadeDeps,
  provider: OAuthProviderId
): Promise<OAuthPrimaryAccountSummary> {
  if (deps.isWebRuntimeOauthCooldownActive()) {
    throw createWebRuntimeOauthPersistenceUnavailableError("oauth primary account");
  }
  try {
    const useDirectRpc = deps.shouldUseWebRuntimeDirectRpc();
    const summary = await deps.runWebRuntimeOAuthRequest<OAuthPrimaryAccountSummary>(
      `oauth_primary_account:${provider}`,
      () =>
        deps.awaitWebRuntimeWithFallbackTimeout(
          (signal) =>
            useDirectRpc
              ? deps.invokeWebRuntimeRpc<OAuthPrimaryAccountSummary>(
                  deps.oauthPrimaryAccountGetRpcMethod,
                  { provider },
                  signal
                )
              : deps.getRuntimeClient().oauthPrimaryAccountGet(provider),
          "oauth primary account",
          useDirectRpc
            ? deps.webRuntimeOauthDirectRpcTimeoutMs
            : deps.webRuntimeOauthFallbackTimeoutMs
        )
    );
    deps.clearWebRuntimeOauthCooldown();
    deps.clearMockOauthFallbackActive();
    return summary;
  } catch (error) {
    if (deps.isTauri()) {
      throw error;
    }
    deps.markWebRuntimeOauthCooldown(error, "oauth primary account");
    throw createWebRuntimeOauthPersistenceUnavailableError("oauth primary account", error);
  }
}
