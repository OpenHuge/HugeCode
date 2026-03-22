import type {
  OAuthAccountSummary,
  OAuthAccountUpsertInput,
  OAuthPrimaryAccountSetInput,
  OAuthPrimaryAccountSummary,
  OAuthPoolAccountBindRequest,
  OAuthPoolApplyInput,
  OAuthPoolApplyResult,
  OAuthPoolMember,
  OAuthPoolMemberInput,
  OAuthPoolSelectionRequest,
  OAuthPoolSelectionResult,
  OAuthPoolSummary,
  OAuthPoolUpsertInput,
  OAuthProviderId,
  OAuthRateLimitReportInput,
} from "./runtimeClient";
import { createWebRuntimeOauthPersistenceUnavailableError } from "./tauriOauthBridgeWebRuntime";

type RuntimeClientOAuthBridge = {
  oauthUpsertAccount(input: OAuthAccountUpsertInput): Promise<OAuthAccountSummary>;
  oauthRemoveAccount(accountId: string): Promise<boolean>;
  oauthAccounts(provider: null): Promise<OAuthAccountSummary[]>;
  oauthPrimaryAccountSet(input: OAuthPrimaryAccountSetInput): Promise<OAuthPrimaryAccountSummary>;
  oauthUpsertPool(input: OAuthPoolUpsertInput): Promise<OAuthPoolSummary>;
  oauthApplyPool(input: OAuthPoolApplyInput): Promise<OAuthPoolApplyResult>;
  oauthRemovePool(poolId: string): Promise<boolean>;
  oauthReplacePoolMembers(
    poolId: string,
    members: OAuthPoolMemberInput[]
  ): Promise<OAuthPoolMember[]>;
  oauthSelectPoolAccount(
    request: OAuthPoolSelectionRequest
  ): Promise<OAuthPoolSelectionResult | null>;
  oauthBindPoolAccount(
    request: OAuthPoolAccountBindRequest
  ): Promise<OAuthPoolSelectionResult | null>;
  oauthReportRateLimit(input: OAuthRateLimitReportInput): Promise<boolean>;
};

export type TauriOauthBridgeMutationFacadeDeps = {
  oauthPoolApplyRpcMethod: string;
  oauthPrimaryAccountSetRpcMethod: string;
  webRuntimeOauthDirectRpcTimeoutMs: number;
  webRuntimeOauthFallbackTimeoutMs: number;
  isTauri(): boolean;
  shouldUseWebRuntimeDirectRpc(): boolean;
  runWebRuntimeOAuthRequest<Result>(key: string, request: () => Promise<Result>): Promise<Result>;
  awaitWebRuntimeWithFallbackTimeout<Result>(
    request: (signal: AbortSignal | undefined) => Promise<Result>,
    label: string,
    timeoutMs?: number
  ): Promise<Result>;
  invokeWebRuntimeRpc<Result>(
    method: string,
    params: Record<string, unknown>,
    signal?: AbortSignal
  ): Promise<Result>;
  getRuntimeClient(): RuntimeClientOAuthBridge;
  clearWebRuntimeOauthRequestInFlight(): void;
  clearWebRuntimeOauthCooldown(): void;
  clearMockOauthFallbackActive(): void;
  markWebRuntimeOauthCooldown(error: unknown, label: string): void;
  normalizeOAuthAccountSummary(account: OAuthAccountSummary): OAuthAccountSummary;
  upsertMockOAuthAccount(input: OAuthAccountUpsertInput): OAuthAccountSummary;
  listMockOAuthAccounts(provider?: OAuthProviderId | null): OAuthAccountSummary[];
  listMockOAuthPools(provider?: OAuthProviderId | null): OAuthPoolSummary[];
  syncMockOAuthAccounts(accounts: OAuthAccountSummary[]): void;
  removeMockOAuthAccount(accountId: string): boolean;
  upsertMockOAuthPool(input: OAuthPoolUpsertInput): OAuthPoolSummary;
  replaceMockOAuthPoolMembers(poolId: string, members: OAuthPoolMemberInput[]): OAuthPoolMember[];
  removeMockOAuthPool(poolId: string): boolean;
  selectMockOAuthPoolAccount(request: OAuthPoolSelectionRequest): OAuthPoolSelectionResult | null;
  bindMockOAuthPoolAccount(request: OAuthPoolAccountBindRequest): OAuthPoolSelectionResult | null;
  reportMockOAuthRateLimit(input: OAuthRateLimitReportInput): boolean;
  normalizeCaughtOauthError(error: unknown, fallbackMessage: string): Error;
  readRuntimeErrorCode(error: unknown): string | null;
  runtimePoolVersionMismatchCode: string;
};

export async function upsertOAuthAccount(
  deps: TauriOauthBridgeMutationFacadeDeps,
  input: OAuthAccountUpsertInput
): Promise<OAuthAccountSummary> {
  try {
    const account = await deps.getRuntimeClient().oauthUpsertAccount(input);
    deps.clearWebRuntimeOauthRequestInFlight();
    deps.clearMockOauthFallbackActive();
    return deps.normalizeOAuthAccountSummary(account);
  } catch (error) {
    if (deps.isTauri()) {
      throw error;
    }
    throw createWebRuntimeOauthPersistenceUnavailableError("oauth account upsert", error);
  }
}

export async function removeOAuthAccount(
  deps: TauriOauthBridgeMutationFacadeDeps,
  accountId: string
): Promise<boolean> {
  try {
    const removed = await deps.getRuntimeClient().oauthRemoveAccount(accountId);
    deps.clearWebRuntimeOauthRequestInFlight();
    deps.clearMockOauthFallbackActive();
    return removed;
  } catch (error) {
    if (deps.isTauri()) {
      throw error;
    }
    throw createWebRuntimeOauthPersistenceUnavailableError("oauth account removal", error);
  }
}

export async function upsertOAuthPool(
  deps: TauriOauthBridgeMutationFacadeDeps,
  input: OAuthPoolUpsertInput
): Promise<OAuthPoolSummary> {
  try {
    const pool = await deps.getRuntimeClient().oauthUpsertPool(input);
    deps.clearWebRuntimeOauthRequestInFlight();
    deps.clearMockOauthFallbackActive();
    return pool;
  } catch (error) {
    if (deps.isTauri()) {
      throw error;
    }
    throw createWebRuntimeOauthPersistenceUnavailableError("oauth pool upsert", error);
  }
}

export async function setOAuthPrimaryAccount(
  deps: TauriOauthBridgeMutationFacadeDeps,
  input: OAuthPrimaryAccountSetInput
): Promise<OAuthPrimaryAccountSummary> {
  try {
    const useDirectRpc = deps.shouldUseWebRuntimeDirectRpc();
    const summary = await deps.runWebRuntimeOAuthRequest<OAuthPrimaryAccountSummary>(
      `oauth_primary_account_set:${input.provider}:${input.accountId ?? "none"}`,
      () =>
        deps.awaitWebRuntimeWithFallbackTimeout(
          (signal) =>
            useDirectRpc
              ? deps.invokeWebRuntimeRpc<OAuthPrimaryAccountSummary>(
                  deps.oauthPrimaryAccountSetRpcMethod,
                  { provider: input.provider, accountId: input.accountId ?? null },
                  signal
                )
              : deps.getRuntimeClient().oauthPrimaryAccountSet({
                  provider: input.provider,
                  accountId: input.accountId ?? null,
                }),
          "oauth primary account set",
          useDirectRpc
            ? deps.webRuntimeOauthDirectRpcTimeoutMs
            : deps.webRuntimeOauthFallbackTimeoutMs
        )
    );
    deps.clearWebRuntimeOauthCooldown();
    deps.clearWebRuntimeOauthRequestInFlight();
    deps.clearMockOauthFallbackActive();
    return summary;
  } catch (error) {
    if (deps.isTauri()) {
      throw error;
    }
    deps.markWebRuntimeOauthCooldown(error, "oauth primary account set");
    throw createWebRuntimeOauthPersistenceUnavailableError("oauth primary account set", error);
  }
}

export async function replaceOAuthPoolMembers(
  deps: TauriOauthBridgeMutationFacadeDeps,
  poolId: string,
  members: OAuthPoolMemberInput[]
): Promise<OAuthPoolMember[]> {
  try {
    const updatedMembers = await deps.getRuntimeClient().oauthReplacePoolMembers(poolId, members);
    deps.clearWebRuntimeOauthRequestInFlight();
    deps.clearMockOauthFallbackActive();
    return updatedMembers;
  } catch (error) {
    if (deps.isTauri()) {
      throw error;
    }
    throw createWebRuntimeOauthPersistenceUnavailableError("oauth pool members replace", error);
  }
}

export async function applyOAuthPool(
  deps: TauriOauthBridgeMutationFacadeDeps,
  input: OAuthPoolApplyInput
): Promise<OAuthPoolApplyResult> {
  try {
    const useDirectRpc = deps.shouldUseWebRuntimeDirectRpc();
    const result = await deps.runWebRuntimeOAuthRequest<OAuthPoolApplyResult>(
      `oauth_pool_apply:${input.pool.poolId}`,
      () =>
        deps.awaitWebRuntimeWithFallbackTimeout(
          (signal) =>
            useDirectRpc
              ? deps.invokeWebRuntimeRpc<OAuthPoolApplyResult>(
                  deps.oauthPoolApplyRpcMethod,
                  {
                    pool: input.pool,
                    members: input.members,
                    expectedUpdatedAt: input.expectedUpdatedAt ?? null,
                    expected_updated_at: input.expectedUpdatedAt ?? null,
                  },
                  signal
                )
              : deps.getRuntimeClient().oauthApplyPool(input),
          "oauth pool apply",
          useDirectRpc
            ? deps.webRuntimeOauthDirectRpcTimeoutMs
            : deps.webRuntimeOauthFallbackTimeoutMs
        )
    );
    deps.clearWebRuntimeOauthCooldown();
    deps.clearMockOauthFallbackActive();
    return result;
  } catch (error) {
    const normalizedError = deps.normalizeCaughtOauthError(error, "oauth pool apply failed.");
    if (deps.isTauri()) {
      throw normalizedError;
    }
    if (deps.readRuntimeErrorCode(normalizedError) === deps.runtimePoolVersionMismatchCode) {
      throw normalizedError;
    }
    deps.markWebRuntimeOauthCooldown(normalizedError, "oauth pool apply");
    throw createWebRuntimeOauthPersistenceUnavailableError("oauth pool apply", normalizedError);
  }
}

export async function removeOAuthPool(
  deps: TauriOauthBridgeMutationFacadeDeps,
  poolId: string
): Promise<boolean> {
  try {
    const removed = await deps.getRuntimeClient().oauthRemovePool(poolId);
    deps.clearWebRuntimeOauthRequestInFlight();
    deps.clearMockOauthFallbackActive();
    return removed;
  } catch (error) {
    if (deps.isTauri()) {
      throw error;
    }
    throw createWebRuntimeOauthPersistenceUnavailableError("oauth pool removal", error);
  }
}

export async function selectOAuthPoolAccount(
  deps: TauriOauthBridgeMutationFacadeDeps,
  request: OAuthPoolSelectionRequest
): Promise<OAuthPoolSelectionResult | null> {
  try {
    const selected = await deps.getRuntimeClient().oauthSelectPoolAccount(request);
    deps.clearWebRuntimeOauthRequestInFlight();
    deps.clearMockOauthFallbackActive();
    return selected;
  } catch (error) {
    if (deps.isTauri()) {
      throw error;
    }
    throw createWebRuntimeOauthPersistenceUnavailableError("oauth pool selection", error);
  }
}

export async function bindOAuthPoolAccount(
  deps: TauriOauthBridgeMutationFacadeDeps,
  request: OAuthPoolAccountBindRequest
): Promise<OAuthPoolSelectionResult | null> {
  try {
    const selected = await deps.getRuntimeClient().oauthBindPoolAccount(request);
    deps.clearWebRuntimeOauthRequestInFlight();
    deps.clearMockOauthFallbackActive();
    return selected;
  } catch (error) {
    if (deps.isTauri()) {
      throw error;
    }
    throw createWebRuntimeOauthPersistenceUnavailableError("oauth pool binding", error);
  }
}

export async function reportOAuthRateLimit(
  deps: TauriOauthBridgeMutationFacadeDeps,
  input: OAuthRateLimitReportInput
): Promise<boolean> {
  try {
    const reported = await deps.getRuntimeClient().oauthReportRateLimit(input);
    deps.clearWebRuntimeOauthRequestInFlight();
    deps.clearMockOauthFallbackActive();
    return reported;
  } catch (error) {
    if (deps.isTauri()) {
      throw error;
    }
    throw createWebRuntimeOauthPersistenceUnavailableError("oauth rate limit reporting", error);
  }
}
