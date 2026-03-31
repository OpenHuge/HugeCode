import { isTauri } from "../application/runtime/ports/desktopHostCore";
import { logger } from "./logger";
import {
  detectRuntimeMode,
  getRuntimeClient,
  type OAuthPrimaryAccountSetInput,
  type OAuthPrimaryAccountSummary,
  type OAuthAccountSummary,
  type OAuthAccountUpsertInput,
  type OAuthPoolAccountBindRequest,
  type OAuthPoolApplyInput,
  type OAuthPoolApplyResult,
  type OAuthPoolMember,
  type OAuthPoolMemberInput,
  type OAuthPoolSelectionRequest,
  type OAuthPoolSelectionResult,
  type OAuthPoolSummary,
  type OAuthPoolUpsertInput,
  type OAuthProviderId,
  type OAuthRateLimitReportInput,
  type OAuthUsageRefreshMode,
  type RuntimeCockpitToolsCodexImportResponse,
} from "./runtimeClient";
import type { RuntimeProviderCatalogEntry } from "../contracts/runtime";
import {
  isRuntimeMethodUnsupportedError,
  readRuntimeErrorCode,
} from "@ku0/code-runtime-client/runtimeErrorClassifier";
import { RUNTIME_MESSAGE_CODES } from "@ku0/code-runtime-client/runtimeMessageCodes";
import { createRuntimeError } from "@ku0/code-runtime-client/runtimeMessageEnvelope";
import {
  accountHasRoutingCredential,
  createMockOauthEntityId,
  pickPoolPreferredAccount,
  pickPreferredOAuthAccount,
} from "./oauthBridgeAccountHelpers";
import { normalizeNullableText, normalizeOAuthAccountSummary } from "./oauthBridgeNormalization";
import {
  clearMockOauthFallbackActive,
  isMockOauthFallbackActive,
  resetMockOauthSessionFallbackState,
} from "./oauthBridgeMockState";
import {
  bindMockOAuthPoolAccount,
  listMockOAuthAccounts,
  listMockOAuthPoolMembers,
  listMockOAuthPools,
  removeMockOAuthAccount,
  removeMockOAuthPool,
  reportMockOAuthRateLimit,
  replaceMockOAuthPoolMembers,
  selectMockOAuthPoolAccount,
  syncMockOAuthAccounts,
  upsertMockOAuthAccount,
  upsertMockOAuthPool,
} from "./oauthBridgeFallbackCrud";
import {
  cancelCodexLogin as cancelCodexLoginWithFacade,
  resolveChatgptAuthTokensRefreshResponse as resolveChatgptAuthTokensRefreshResponseWithFacade,
  runCodexLogin as runCodexLoginWithFacade,
} from "./oauthBridgeAuthFacade";
import { type ChatgptAuthTokensRefreshResolution } from "./oauthBridgeChatgptRefresh";
import type { CodexLoginOptions, CodexLoginResult } from "./oauthBridgeCodexLogin";
import {
  getOAuthPrimaryAccount as getOAuthPrimaryAccountWithFacade,
  listOAuthAccounts as listOAuthAccountsWithFacade,
  listOAuthPoolMembers as listOAuthPoolMembersWithFacade,
  listOAuthPools as listOAuthPoolsWithFacade,
  type OAuthBridgeListingFacadeDeps,
} from "./oauthBridgeListingFacade";
import {
  applyOAuthPool as applyOAuthPoolWithFacade,
  bindOAuthPoolAccount as bindOAuthPoolAccountWithFacade,
  removeOAuthAccount as removeOAuthAccountWithFacade,
  removeOAuthPool as removeOAuthPoolWithFacade,
  replaceOAuthPoolMembers as replaceOAuthPoolMembersWithFacade,
  reportOAuthRateLimit as reportOAuthRateLimitWithFacade,
  selectOAuthPoolAccount as selectOAuthPoolAccountWithFacade,
  setOAuthPrimaryAccount as setOAuthPrimaryAccountWithFacade,
  type OAuthBridgeMutationFacadeDeps,
  upsertOAuthAccount as upsertOAuthAccountWithFacade,
  upsertOAuthPool as upsertOAuthPoolWithFacade,
} from "./oauthBridgeMutationFacade";
import { invokeWebRuntimeRpcWithDeps } from "./oauthBridgeRpc";
import {
  awaitWebRuntimeWithFallbackTimeout,
  clearWebRuntimeOauthCooldown,
  clearWebRuntimeOauthRequestInFlight,
  getErrorMessage,
  isWebRuntimeOauthCooldownActive,
  markWebRuntimeOauthCooldown,
  resetWebRuntimeOauthFallbackState,
  resolveWebRuntimeControlEndpoint,
  resolveWebRuntimeRpcEndpoint,
  runWebRuntimeOAuthRequest,
  shouldUseWebRuntimeDirectRpc,
  WEB_RUNTIME_OAUTH_DIRECT_RPC_TIMEOUT_MS,
  WEB_RUNTIME_OAUTH_FALLBACK_TIMEOUT_MS,
  WEB_RUNTIME_RPC_ENDPOINT_ENV_KEY,
} from "./oauthBridgeWebRuntime";
import { type OAuthSubscriptionPersistenceCapability } from "./oauthBridgeWorkspaceAccount";
import {
  getAccountInfo as getAccountInfoWithDeps,
  getAccountRateLimits as getAccountRateLimitsWithDeps,
  readOAuthSubscriptionPersistenceCapability as readOAuthSubscriptionPersistenceCapabilityWithDeps,
} from "./oauthBridgeWorkspaceAccountFacade";
import type { LooseResultEnvelope } from "./runtimeTransport";

type JsonRecord = Record<string, unknown>;
export type { CodexLoginOptions, CodexLoginResult } from "./oauthBridgeCodexLogin";
export type { OAuthSubscriptionPersistenceCapability } from "./oauthBridgeWorkspaceAccount";

const CODE_RUNTIME_RPC_METHOD_PROVIDERS_CATALOG = "code_providers_catalog";
const CODE_RUNTIME_RPC_METHOD_OAUTH_ACCOUNTS_LIST = "code_oauth_accounts_list";
const CODE_RUNTIME_RPC_METHOD_OAUTH_PRIMARY_ACCOUNT_GET = "code_oauth_primary_account_get";
const CODE_RUNTIME_RPC_METHOD_OAUTH_PRIMARY_ACCOUNT_SET = "code_oauth_primary_account_set";
const CODE_RUNTIME_RPC_METHOD_OAUTH_POOLS_LIST = "code_oauth_pools_list";
const CODE_RUNTIME_RPC_METHOD_OAUTH_POOL_APPLY = "code_oauth_pool_apply";
const CODE_RUNTIME_RPC_METHOD_OAUTH_CHATGPT_AUTH_TOKENS_REFRESH =
  "code_oauth_chatgpt_auth_tokens_refresh";
const CODE_RUNTIME_RPC_METHOD_OAUTH_CODEX_ACCOUNTS_IMPORT_FROM_COCKPIT_TOOLS =
  "code_oauth_codex_accounts_import_from_cockpit_tools";
const DEFAULT_CODEX_OAUTH_POOL_ID = "pool-codex";

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function logRuntimeWarning(message: string, context?: unknown) {
  logger.warn(message, context);
}

function readResponseErrorCode(payload: unknown): string | null {
  return readRuntimeErrorCode(payload);
}

function normalizeOauthErrorCode(code: string | null): string | null {
  return code;
}

function normalizeCaughtOauthError(error: unknown, fallbackMessage: string): Error {
  const message = getErrorMessage(error).trim() || fallbackMessage;
  const code = normalizeOauthErrorCode(readRuntimeErrorCode(error));
  if (!code) {
    return error instanceof Error ? error : new Error(message);
  }
  return createRuntimeError({ code, message });
}

function readRequiresOpenaiAuth(payload: unknown): boolean | null {
  if (!isRecord(payload)) {
    return null;
  }
  const result = isRecord(payload.result) ? payload.result : payload;
  const raw = result.requiresOpenaiAuth ?? result.requires_openai_auth;
  return typeof raw === "boolean" ? raw : null;
}

async function verifyWorkspaceBindingForOauth(targetWorkspaceId: string): Promise<boolean> {
  return (
    readRequiresOpenaiAuth(
      await getAccountInfoWithDeps(
        {
          defaultCodexOauthPoolId: DEFAULT_CODEX_OAUTH_POOL_ID,
          listOAuthAccounts,
          listOAuthPools,
          getRuntimeClient,
          normalizeNullableText,
          isRuntimeMethodUnsupportedError,
          logRuntimeWarning,
          detectRuntimeMode,
          isWebRuntimeOauthCooldownActive,
          webRuntimePersistenceConfigured:
            resolveWebRuntimeControlEndpoint("/oauth/codex/start") !== null &&
            resolveWebRuntimeRpcEndpoint() !== null,
          mockOauthFallbackActive: isMockOauthFallbackActive(),
        },
        targetWorkspaceId
      )
    ) === false
  );
}

export function __resetWebRuntimeOauthFallbackStateForTests() {
  resetWebRuntimeOauthFallbackState();
}

export function __resetMockOauthSessionFallbackForTests() {
  resetMockOauthSessionFallbackState();
}

function createListingFacadeDeps(): OAuthBridgeListingFacadeDeps {
  return {
    oauthAccountsRpcMethod: CODE_RUNTIME_RPC_METHOD_OAUTH_ACCOUNTS_LIST,
    oauthPrimaryAccountGetRpcMethod: CODE_RUNTIME_RPC_METHOD_OAUTH_PRIMARY_ACCOUNT_GET,
    oauthPoolsRpcMethod: CODE_RUNTIME_RPC_METHOD_OAUTH_POOLS_LIST,
    oauthPoolMembersRpcMethod: "code_oauth_pool_members_list",
    webRuntimeOauthDirectRpcTimeoutMs: WEB_RUNTIME_OAUTH_DIRECT_RPC_TIMEOUT_MS,
    webRuntimeOauthFallbackTimeoutMs: WEB_RUNTIME_OAUTH_FALLBACK_TIMEOUT_MS,
    isTauri,
    shouldUseWebRuntimeDirectRpc,
    isWebRuntimeOauthCooldownActive,
    runWebRuntimeOAuthRequest,
    awaitWebRuntimeWithFallbackTimeout,
    invokeWebRuntimeRpc,
    getRuntimeClient,
    clearWebRuntimeOauthCooldown,
    clearMockOauthFallbackActive,
    markWebRuntimeOauthCooldown,
    listMockOAuthAccounts,
    listMockOAuthPools,
    listMockOAuthPoolMembers,
    normalizeOAuthAccountSummary,
  };
}

function createMutationFacadeDeps(): OAuthBridgeMutationFacadeDeps {
  return {
    oauthPoolApplyRpcMethod: CODE_RUNTIME_RPC_METHOD_OAUTH_POOL_APPLY,
    oauthPrimaryAccountSetRpcMethod: CODE_RUNTIME_RPC_METHOD_OAUTH_PRIMARY_ACCOUNT_SET,
    webRuntimeOauthDirectRpcTimeoutMs: WEB_RUNTIME_OAUTH_DIRECT_RPC_TIMEOUT_MS,
    webRuntimeOauthFallbackTimeoutMs: WEB_RUNTIME_OAUTH_FALLBACK_TIMEOUT_MS,
    isTauri,
    shouldUseWebRuntimeDirectRpc,
    runWebRuntimeOAuthRequest,
    awaitWebRuntimeWithFallbackTimeout,
    invokeWebRuntimeRpc,
    getRuntimeClient,
    clearWebRuntimeOauthRequestInFlight,
    clearWebRuntimeOauthCooldown,
    clearMockOauthFallbackActive,
    markWebRuntimeOauthCooldown,
    normalizeOAuthAccountSummary,
    upsertMockOAuthAccount,
    listMockOAuthAccounts,
    listMockOAuthPools,
    syncMockOAuthAccounts,
    removeMockOAuthAccount,
    upsertMockOAuthPool,
    replaceMockOAuthPoolMembers,
    removeMockOAuthPool,
    selectMockOAuthPoolAccount,
    bindMockOAuthPoolAccount,
    reportMockOAuthRateLimit,
    normalizeCaughtOauthError,
    readRuntimeErrorCode,
    runtimePoolVersionMismatchCode: RUNTIME_MESSAGE_CODES.runtime.approval.poolVersionMismatch,
  };
}

export async function getProvidersCatalog(): Promise<RuntimeProviderCatalogEntry[]> {
  if (isWebRuntimeOauthCooldownActive()) {
    return [];
  }
  try {
    const useDirectRpc = shouldUseWebRuntimeDirectRpc();
    const providers = await runWebRuntimeOAuthRequest<RuntimeProviderCatalogEntry[]>(
      "providers_catalog",
      () =>
        awaitWebRuntimeWithFallbackTimeout(
          (signal) =>
            useDirectRpc
              ? invokeWebRuntimeRpc<RuntimeProviderCatalogEntry[]>(
                  CODE_RUNTIME_RPC_METHOD_PROVIDERS_CATALOG,
                  {},
                  signal
                )
              : getRuntimeClient().providersCatalog(),
          "providers catalog",
          useDirectRpc
            ? WEB_RUNTIME_OAUTH_DIRECT_RPC_TIMEOUT_MS
            : WEB_RUNTIME_OAUTH_FALLBACK_TIMEOUT_MS
        )
    );
    clearWebRuntimeOauthCooldown();
    return providers;
  } catch (error) {
    if (isTauri()) {
      throw error;
    }
    markWebRuntimeOauthCooldown(error, "providers catalog");
    logRuntimeWarning("Runtime providers catalog unavailable in web mode; using fallback.", {
      error: getErrorMessage(error),
    });
    return [];
  }
}

export async function listOAuthAccounts(
  provider: OAuthProviderId | null = null,
  options: { usageRefresh?: OAuthUsageRefreshMode | null } = {}
): Promise<OAuthAccountSummary[]> {
  return listOAuthAccountsWithFacade(createListingFacadeDeps(), provider, options);
}

export async function upsertOAuthAccount(
  input: OAuthAccountUpsertInput
): Promise<OAuthAccountSummary> {
  return upsertOAuthAccountWithFacade(createMutationFacadeDeps(), input);
}

export async function removeOAuthAccount(accountId: string): Promise<boolean> {
  return removeOAuthAccountWithFacade(createMutationFacadeDeps(), accountId);
}

export async function importCodexAccountsFromCockpitTools(): Promise<RuntimeCockpitToolsCodexImportResponse> {
  return getRuntimeClient().oauthCodexAccountsImportFromCockpitTools
    ? getRuntimeClient().oauthCodexAccountsImportFromCockpitTools()
    : invokeWebRuntimeRpc<RuntimeCockpitToolsCodexImportResponse>(
        CODE_RUNTIME_RPC_METHOD_OAUTH_CODEX_ACCOUNTS_IMPORT_FROM_COCKPIT_TOOLS,
        {}
      );
}

export async function getOAuthPrimaryAccount(
  provider: OAuthProviderId
): Promise<OAuthPrimaryAccountSummary> {
  return getOAuthPrimaryAccountWithFacade(createListingFacadeDeps(), provider);
}

export async function setOAuthPrimaryAccount(
  input: OAuthPrimaryAccountSetInput
): Promise<OAuthPrimaryAccountSummary> {
  return setOAuthPrimaryAccountWithFacade(createMutationFacadeDeps(), input);
}

export async function listOAuthPools(
  provider: OAuthProviderId | null = null
): Promise<OAuthPoolSummary[]> {
  return listOAuthPoolsWithFacade(createListingFacadeDeps(), provider);
}

export async function listOAuthPoolMembers(poolId: string): Promise<OAuthPoolMember[]> {
  return listOAuthPoolMembersWithFacade(createListingFacadeDeps(), poolId);
}

export async function upsertOAuthPool(input: OAuthPoolUpsertInput): Promise<OAuthPoolSummary> {
  return upsertOAuthPoolWithFacade(createMutationFacadeDeps(), input);
}

export async function applyOAuthPool(input: OAuthPoolApplyInput): Promise<OAuthPoolApplyResult> {
  return applyOAuthPoolWithFacade(createMutationFacadeDeps(), input);
}

export async function removeOAuthPool(poolId: string): Promise<boolean> {
  return removeOAuthPoolWithFacade(createMutationFacadeDeps(), poolId);
}

export async function replaceOAuthPoolMembers(
  poolId: string,
  members: OAuthPoolMemberInput[]
): Promise<OAuthPoolMember[]> {
  return replaceOAuthPoolMembersWithFacade(createMutationFacadeDeps(), poolId, members);
}

export async function selectOAuthPoolAccount(
  request: OAuthPoolSelectionRequest
): Promise<OAuthPoolSelectionResult | null> {
  return selectOAuthPoolAccountWithFacade(createMutationFacadeDeps(), request);
}

export async function bindOAuthPoolAccount(
  request: OAuthPoolAccountBindRequest
): Promise<OAuthPoolSelectionResult | null> {
  return bindOAuthPoolAccountWithFacade(createMutationFacadeDeps(), request);
}

export async function reportOAuthRateLimit(input: OAuthRateLimitReportInput): Promise<boolean> {
  return reportOAuthRateLimitWithFacade(createMutationFacadeDeps(), input);
}

function invokeWebRuntimeRpc<Result>(
  method: string,
  params: Record<string, unknown>,
  signal?: AbortSignal
): Promise<Result> {
  return invokeWebRuntimeRpcWithDeps(
    {
      webRuntimeRpcEndpointEnvKey: WEB_RUNTIME_RPC_ENDPOINT_ENV_KEY,
      resolveWebRuntimeRpcEndpoint,
      isRecord,
      normalizeNullableText,
      readResponseErrorCode,
      normalizeOauthErrorCode,
      createRuntimeError,
    },
    method,
    params,
    signal
  ) as Promise<Result>;
}

export async function resolveChatgptAuthTokensRefreshResponse(
  options: {
    sessionId?: string | null;
    previousAccountId?: string | null;
    chatgptWorkspaceId?: string | null;
  } = {}
): Promise<ChatgptAuthTokensRefreshResolution | null> {
  return resolveChatgptAuthTokensRefreshResponseWithFacade(
    {
      isTauri,
      isRecord,
      normalizeNullableText,
      listOAuthAccounts,
      listOAuthPools,
      pickPoolPreferredAccount,
      pickPreferredOAuthAccount,
      shouldUseWebRuntimeDirectRpc,
      runWebRuntimeOAuthRequest,
      awaitWebRuntimeWithFallbackTimeout,
      invokeWebRuntimeRpc,
      getRuntimeClient,
      clearWebRuntimeOauthCooldown,
      isRuntimeMethodUnsupportedError,
      markWebRuntimeOauthCooldown,
      logRuntimeWarning,
      getErrorMessage,
      runtimeMethodOauthChatgptAuthTokensRefresh:
        CODE_RUNTIME_RPC_METHOD_OAUTH_CHATGPT_AUTH_TOKENS_REFRESH,
      webRuntimeOauthDirectRpcTimeoutMs: WEB_RUNTIME_OAUTH_DIRECT_RPC_TIMEOUT_MS,
      webRuntimeOauthFallbackTimeoutMs: WEB_RUNTIME_OAUTH_FALLBACK_TIMEOUT_MS,
    },
    options
  );
}

export function readOAuthSubscriptionPersistenceCapability(): OAuthSubscriptionPersistenceCapability {
  return readOAuthSubscriptionPersistenceCapabilityWithDeps({
    detectRuntimeMode,
    isWebRuntimeOauthCooldownActive,
    webRuntimePersistenceConfigured:
      resolveWebRuntimeControlEndpoint("/oauth/codex/start") !== null &&
      resolveWebRuntimeRpcEndpoint() !== null,
    mockOauthFallbackActive: isMockOauthFallbackActive(),
  });
}

export async function getAccountRateLimits(workspaceId: string): Promise<LooseResultEnvelope> {
  // `workspaceId` is the local project workspace/session id, not a ChatGPT workspace id.
  return getAccountRateLimitsWithDeps(
    {
      defaultCodexOauthPoolId: DEFAULT_CODEX_OAUTH_POOL_ID,
      listOAuthAccounts,
      listOAuthPools,
      getRuntimeClient,
      normalizeNullableText,
      isRuntimeMethodUnsupportedError,
      logRuntimeWarning,
      detectRuntimeMode,
      isWebRuntimeOauthCooldownActive,
      webRuntimePersistenceConfigured:
        resolveWebRuntimeControlEndpoint("/oauth/codex/start") !== null &&
        resolveWebRuntimeRpcEndpoint() !== null,
      mockOauthFallbackActive: isMockOauthFallbackActive(),
    },
    workspaceId
  );
}

export async function getAccountInfo(workspaceId: string): Promise<LooseResultEnvelope> {
  // `workspaceId` is the local project workspace/session id, not a ChatGPT workspace id.
  return getAccountInfoWithDeps(
    {
      defaultCodexOauthPoolId: DEFAULT_CODEX_OAUTH_POOL_ID,
      listOAuthAccounts,
      listOAuthPools,
      getRuntimeClient,
      normalizeNullableText,
      isRuntimeMethodUnsupportedError,
      logRuntimeWarning,
      detectRuntimeMode,
      isWebRuntimeOauthCooldownActive,
      webRuntimePersistenceConfigured:
        resolveWebRuntimeControlEndpoint("/oauth/codex/start") !== null &&
        resolveWebRuntimeRpcEndpoint() !== null,
      mockOauthFallbackActive: isMockOauthFallbackActive(),
    },
    workspaceId
  );
}

export async function runCodexLogin(
  workspaceId: string,
  options: CodexLoginOptions = {}
): Promise<CodexLoginResult> {
  return runCodexLoginWithFacade(
    {
      webRuntimeRpcEndpointEnvKey: WEB_RUNTIME_RPC_ENDPOINT_ENV_KEY,
      isTauri,
      isRecord,
      normalizeNullableText,
      listOAuthAccounts,
      listOAuthPools,
      pickPoolPreferredAccount,
      pickPreferredOAuthAccount,
      accountHasRoutingCredential,
      createMockOauthEntityId,
      resolveWebRuntimeControlEndpoint,
      runWebRuntimeOAuthRequest,
      awaitWebRuntimeWithFallbackTimeout,
      verifyWorkspaceBinding: verifyWorkspaceBindingForOauth,
      clearWebRuntimeOauthCooldown,
      markWebRuntimeOauthCooldown,
      shouldUseWebRuntimeDirectRpc,
      invokeWebRuntimeRpc,
      getRuntimeClient,
      isRuntimeMethodUnsupportedError,
      logRuntimeWarning,
      getErrorMessage,
      runtimeMethodOauthChatgptAuthTokensRefresh:
        CODE_RUNTIME_RPC_METHOD_OAUTH_CHATGPT_AUTH_TOKENS_REFRESH,
      webRuntimeOauthDirectRpcTimeoutMs: WEB_RUNTIME_OAUTH_DIRECT_RPC_TIMEOUT_MS,
      webRuntimeOauthFallbackTimeoutMs: WEB_RUNTIME_OAUTH_FALLBACK_TIMEOUT_MS,
    },
    workspaceId,
    options
  );
}

export async function cancelCodexLogin(workspaceId: string) {
  return cancelCodexLoginWithFacade(
    {
      webRuntimeRpcEndpointEnvKey: WEB_RUNTIME_RPC_ENDPOINT_ENV_KEY,
      isTauri,
      isRecord,
      normalizeNullableText,
      listOAuthAccounts,
      listOAuthPools,
      pickPoolPreferredAccount,
      pickPreferredOAuthAccount,
      accountHasRoutingCredential,
      createMockOauthEntityId,
      resolveWebRuntimeControlEndpoint,
      runWebRuntimeOAuthRequest,
      awaitWebRuntimeWithFallbackTimeout,
      verifyWorkspaceBinding: verifyWorkspaceBindingForOauth,
      clearWebRuntimeOauthCooldown,
      markWebRuntimeOauthCooldown,
      shouldUseWebRuntimeDirectRpc,
      invokeWebRuntimeRpc,
      getRuntimeClient,
      isRuntimeMethodUnsupportedError,
      logRuntimeWarning,
      getErrorMessage,
      runtimeMethodOauthChatgptAuthTokensRefresh:
        CODE_RUNTIME_RPC_METHOD_OAUTH_CHATGPT_AUTH_TOKENS_REFRESH,
      webRuntimeOauthDirectRpcTimeoutMs: WEB_RUNTIME_OAUTH_DIRECT_RPC_TIMEOUT_MS,
      webRuntimeOauthFallbackTimeoutMs: WEB_RUNTIME_OAUTH_FALLBACK_TIMEOUT_MS,
    },
    workspaceId
  );
}
