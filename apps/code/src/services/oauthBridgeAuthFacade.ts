import type {
  OAuthAccountSummary,
  OAuthChatgptAuthTokensRefreshRequest,
  OAuthChatgptAuthTokensRefreshResponse,
  OAuthPoolSummary,
  OAuthPoolSelectionRequest,
  OAuthProviderId,
  RuntimeClient,
  OAuthUsageRefreshMode,
} from "./runtimeClient";
import {
  type ChatgptAuthTokensRefreshResolution,
  resolveChatgptAuthTokensRefreshResponseWithDeps,
} from "./oauthBridgeChatgptRefresh";
import {
  cancelCodexLoginWithDeps,
  type CodexLoginDeps,
  type CodexLoginOptions,
  type CodexLoginResult,
  runCodexLoginWithDeps,
} from "./oauthBridgeCodexLogin";

type JsonRecord = Record<string, unknown>;

type RuntimeClientOAuthBridge = Pick<
  RuntimeClient,
  | "oauthCodexLoginCancel"
  | "oauthCodexLoginStart"
  | "oauthSelectPoolAccount"
  | "oauthChatgptAuthTokensRefresh"
> & {
  oauthCodexLoginStart?: RuntimeClient["oauthCodexLoginStart"];
  oauthCodexLoginCancel?: RuntimeClient["oauthCodexLoginCancel"];
  oauthSelectPoolAccount?: (
    request: OAuthPoolSelectionRequest
  ) => Promise<{ account: OAuthAccountSummary } | null>;
  oauthChatgptAuthTokensRefresh?: (
    request?: OAuthChatgptAuthTokensRefreshRequest
  ) => Promise<OAuthChatgptAuthTokensRefreshResponse | null>;
};

export type { CodexLoginOptions, CodexLoginResult } from "./oauthBridgeCodexLogin";

export type OAuthBridgeAuthFacadeDeps = {
  webRuntimeRpcEndpointEnvKey: string;
  isTauri(): boolean;
  isRecord(value: unknown): value is JsonRecord;
  normalizeNullableText(value: unknown): string | null;
  listOAuthAccounts(
    provider: OAuthProviderId | null,
    options?: { usageRefresh?: OAuthUsageRefreshMode | null }
  ): Promise<OAuthAccountSummary[]>;
  listOAuthPools(provider: OAuthProviderId | null): Promise<OAuthPoolSummary[]>;
  pickPoolPreferredAccount(
    accounts: OAuthAccountSummary[],
    pools: OAuthPoolSummary[],
    provider: OAuthProviderId | null
  ): OAuthAccountSummary | null;
  pickPreferredOAuthAccount(
    accounts: OAuthAccountSummary[],
    provider?: OAuthProviderId | null
  ): OAuthAccountSummary | null;
  accountHasRoutingCredential(account: OAuthAccountSummary): boolean;
  createMockOauthEntityId(prefix: string): string;
  resolveWebRuntimeControlEndpoint(path: string): string | null;
  runWebRuntimeOAuthRequest<Result>(key: string, request: () => Promise<Result>): Promise<Result>;
  awaitWebRuntimeWithFallbackTimeout<Result>(
    request: (signal: AbortSignal | undefined) => Promise<Result>,
    label: string,
    timeoutMs?: number
  ): Promise<Result>;
  verifyWorkspaceBinding(workspaceId: string): Promise<boolean>;
  clearWebRuntimeOauthCooldown(): void;
  markWebRuntimeOauthCooldown(error: unknown, label: string): void;
  shouldUseWebRuntimeDirectRpc(): boolean;
  invokeWebRuntimeRpc<Result>(
    method: string,
    params: Record<string, unknown>,
    signal?: AbortSignal
  ): Promise<Result>;
  getRuntimeClient(): RuntimeClientOAuthBridge;
  isRuntimeMethodUnsupportedError(error: unknown, method: string): boolean;
  logRuntimeWarning(message: string, context?: unknown): void;
  getErrorMessage(error: unknown): string;
  runtimeMethodOauthChatgptAuthTokensRefresh: string;
  webRuntimeOauthDirectRpcTimeoutMs: number;
  webRuntimeOauthFallbackTimeoutMs: number;
};

type ChatgptRefreshFacadeDeps = Pick<
  OAuthBridgeAuthFacadeDeps,
  | "isRecord"
  | "normalizeNullableText"
  | "listOAuthAccounts"
  | "listOAuthPools"
  | "pickPoolPreferredAccount"
  | "pickPreferredOAuthAccount"
  | "shouldUseWebRuntimeDirectRpc"
  | "runWebRuntimeOAuthRequest"
  | "awaitWebRuntimeWithFallbackTimeout"
  | "invokeWebRuntimeRpc"
  | "getRuntimeClient"
  | "clearWebRuntimeOauthCooldown"
  | "isRuntimeMethodUnsupportedError"
  | "isTauri"
  | "markWebRuntimeOauthCooldown"
  | "logRuntimeWarning"
  | "getErrorMessage"
  | "runtimeMethodOauthChatgptAuthTokensRefresh"
  | "webRuntimeOauthDirectRpcTimeoutMs"
  | "webRuntimeOauthFallbackTimeoutMs"
>;

function createCodexLoginDeps(deps: OAuthBridgeAuthFacadeDeps): CodexLoginDeps {
  return {
    webRuntimeRpcEndpointEnvKey: deps.webRuntimeRpcEndpointEnvKey,
    isTauri: deps.isTauri,
    isRecord: deps.isRecord,
    normalizeNullableText: deps.normalizeNullableText,
    listOAuthAccounts: deps.listOAuthAccounts,
    pickPreferredOAuthAccount: deps.pickPreferredOAuthAccount,
    accountHasRoutingCredential: deps.accountHasRoutingCredential,
    createMockOauthEntityId: deps.createMockOauthEntityId,
    resolveWebRuntimeControlEndpoint: deps.resolveWebRuntimeControlEndpoint,
    runWebRuntimeOAuthRequest: deps.runWebRuntimeOAuthRequest,
    awaitWebRuntimeWithFallbackTimeout: deps.awaitWebRuntimeWithFallbackTimeout,
    verifyWorkspaceBinding: deps.verifyWorkspaceBinding,
    clearWebRuntimeOauthCooldown: deps.clearWebRuntimeOauthCooldown,
    markWebRuntimeOauthCooldown: deps.markWebRuntimeOauthCooldown,
    getRuntimeClient: deps.getRuntimeClient,
  };
}

export async function resolveChatgptAuthTokensRefreshResponse(
  deps: ChatgptRefreshFacadeDeps,
  options: {
    sessionId?: string | null;
    previousAccountId?: string | null;
    chatgptWorkspaceId?: string | null;
  } = {}
): Promise<ChatgptAuthTokensRefreshResolution | null> {
  return resolveChatgptAuthTokensRefreshResponseWithDeps(
    {
      isRecord: deps.isRecord,
      normalizeNullableText: deps.normalizeNullableText,
      listOAuthAccounts: deps.listOAuthAccounts,
      listOAuthPools: deps.listOAuthPools,
      pickPoolPreferredAccount: deps.pickPoolPreferredAccount,
      pickPreferredOAuthAccount: deps.pickPreferredOAuthAccount,
      shouldUseWebRuntimeDirectRpc: deps.shouldUseWebRuntimeDirectRpc,
      runWebRuntimeOAuthRequest: deps.runWebRuntimeOAuthRequest,
      awaitWebRuntimeWithFallbackTimeout: deps.awaitWebRuntimeWithFallbackTimeout,
      invokeWebRuntimeRpc: deps.invokeWebRuntimeRpc,
      getRuntimeClient: deps.getRuntimeClient,
      clearWebRuntimeOauthCooldown: deps.clearWebRuntimeOauthCooldown,
      isRuntimeMethodUnsupportedError: deps.isRuntimeMethodUnsupportedError,
      isTauri: deps.isTauri,
      markWebRuntimeOauthCooldown: deps.markWebRuntimeOauthCooldown,
      logRuntimeWarning: deps.logRuntimeWarning,
      getErrorMessage: deps.getErrorMessage,
      runtimeMethodOauthChatgptAuthTokensRefresh: deps.runtimeMethodOauthChatgptAuthTokensRefresh,
      webRuntimeOauthDirectRpcTimeoutMs: deps.webRuntimeOauthDirectRpcTimeoutMs,
      webRuntimeOauthFallbackTimeoutMs: deps.webRuntimeOauthFallbackTimeoutMs,
    },
    options
  );
}

export async function runCodexLogin(
  deps: OAuthBridgeAuthFacadeDeps,
  workspaceId: string,
  options: CodexLoginOptions = {}
): Promise<CodexLoginResult> {
  return runCodexLoginWithDeps(createCodexLoginDeps(deps), workspaceId, options);
}

export async function cancelCodexLogin(deps: OAuthBridgeAuthFacadeDeps, workspaceId: string) {
  return cancelCodexLoginWithDeps(createCodexLoginDeps(deps), workspaceId);
}
