import type {
  OAuthAccountSummary,
  OAuthChatgptAuthTokensRefreshRequest,
  OAuthChatgptAuthTokensRefreshResponse,
  OAuthPoolSelectionRequest,
  OAuthPoolSummary,
  OAuthProviderId,
  OAuthUsageRefreshMode,
} from "./runtimeClient";

type JsonRecord = Record<string, unknown>;

type RuntimeClientOAuthBridge = {
  oauthSelectPoolAccount?: (
    request: OAuthPoolSelectionRequest
  ) => Promise<{ account: OAuthAccountSummary } | null>;
  oauthChatgptAuthTokensRefresh?: (
    request: OAuthChatgptAuthTokensRefreshRequest
  ) => Promise<OAuthChatgptAuthTokensRefreshResponse | null>;
};

type ChatgptWorkspaceMembership = {
  workspaceId: string;
  title: string | null;
  role: string | null;
  isDefault: boolean;
};

export type ChatgptAuthTokensRefreshResolution = {
  accessToken: string;
  chatgptAccountId: string;
  chatgptPlanType: string | null;
  sourceAccountId: string;
};

export type ChatgptAuthTokensRefreshResolverDeps = {
  isRecord(value: unknown): value is JsonRecord;
  normalizeNullableText(value: unknown): string | null;
  listOAuthAccounts(
    provider: OAuthProviderId | null,
    options?: { usageRefresh?: OAuthUsageRefreshMode }
  ): Promise<OAuthAccountSummary[]>;
  listOAuthPools(provider: OAuthProviderId | null): Promise<OAuthPoolSummary[]>;
  pickPoolPreferredAccount(
    accounts: OAuthAccountSummary[],
    pools: OAuthPoolSummary[],
    provider: OAuthProviderId | null
  ): OAuthAccountSummary | null;
  pickPreferredOAuthAccount(
    accounts: OAuthAccountSummary[],
    provider: OAuthProviderId | null
  ): OAuthAccountSummary | null;
  shouldUseWebRuntimeDirectRpc(): boolean;
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
  isRuntimeMethodUnsupportedError(error: unknown, method: string): boolean;
  isTauri(): boolean;
  markWebRuntimeOauthCooldown(error: unknown, label: string): void;
  logRuntimeWarning(message: string, context?: unknown): void;
  getErrorMessage(error: unknown): string;
  runtimeMethodOauthChatgptAuthTokensRefresh: string;
  webRuntimeOauthDirectRpcTimeoutMs: number;
  webRuntimeOauthFallbackTimeoutMs: number;
};

const CODEX_PROVIDER: OAuthProviderId = "codex";
const CHATGPT_ACCESS_TOKEN_METADATA_KEYS = [
  "accessToken",
  "access_token",
  "oauthAccessToken",
  "oauth_access_token",
  "chatgptAccessToken",
  "chatgpt_access_token",
  "token",
  "apiKey",
  "api_key",
  "openaiApiKey",
] as const;
const CHATGPT_ACCOUNT_ID_METADATA_KEYS = [
  "chatgptAccountId",
  "chatgpt_account_id",
  "workspaceId",
  "workspace_id",
  "externalAccountId",
  "external_account_id",
] as const;
const CHATGPT_PLAN_TYPE_METADATA_KEYS = [
  "chatgptPlanType",
  "chatgpt_plan_type",
  "planType",
  "plan_type",
  "plan",
  "tier",
] as const;
const CHATGPT_WORKSPACE_COLLECTION_METADATA_KEYS = [
  "chatgptWorkspaces",
  "chatgpt_workspaces",
  "chatgptOrganizations",
  "chatgpt_organizations",
  "organizations",
] as const;
const CHATGPT_DEFAULT_WORKSPACE_ID_METADATA_KEYS = [
  "defaultChatgptWorkspaceId",
  "default_chatgpt_workspace_id",
  "defaultChatgptOrganizationId",
  "default_chatgpt_organization_id",
  "chatgptWorkspaceId",
  "chatgpt_workspace_id",
  "organizationId",
  "organization_id",
  "workspaceId",
  "workspace_id",
] as const;

function readFirstMetadataString(
  deps: ChatgptAuthTokensRefreshResolverDeps,
  metadata: JsonRecord,
  keys: readonly string[]
): string | null {
  for (const key of keys) {
    const value = deps.normalizeNullableText(metadata[key]);
    if (value) {
      return value;
    }
  }
  return null;
}

function resolveChatgptAccessTokenCandidate(
  deps: ChatgptAuthTokensRefreshResolverDeps,
  account: OAuthAccountSummary
): string | null {
  if (!deps.isRecord(account.metadata)) {
    return null;
  }
  return readFirstMetadataString(deps, account.metadata, CHATGPT_ACCESS_TOKEN_METADATA_KEYS);
}

function resolveChatgptPlanTypeCandidate(
  deps: ChatgptAuthTokensRefreshResolverDeps,
  account: OAuthAccountSummary
): string | null {
  if (!deps.isRecord(account.metadata)) {
    return null;
  }
  return readFirstMetadataString(deps, account.metadata, CHATGPT_PLAN_TYPE_METADATA_KEYS);
}

function resolveChatgptAccountIdCandidate(
  deps: ChatgptAuthTokensRefreshResolverDeps,
  account: OAuthAccountSummary
): string | null {
  if (deps.isRecord(account.metadata)) {
    const fromMetadata = readFirstMetadataString(
      deps,
      account.metadata,
      CHATGPT_ACCOUNT_ID_METADATA_KEYS
    );
    if (fromMetadata) {
      return fromMetadata;
    }
  }
  return (
    deps.normalizeNullableText(account.externalAccountId) ??
    deps.normalizeNullableText(account.accountId)
  );
}

function normalizeChatgptWorkspaceMembership(
  deps: ChatgptAuthTokensRefreshResolverDeps,
  value: unknown
): ChatgptWorkspaceMembership | null {
  if (!deps.isRecord(value)) {
    return null;
  }
  const workspaceId =
    deps.normalizeNullableText(value.workspaceId) ??
    deps.normalizeNullableText(value.workspace_id) ??
    deps.normalizeNullableText(value.organizationId) ??
    deps.normalizeNullableText(value.organization_id) ??
    deps.normalizeNullableText(value.id);
  if (!workspaceId) {
    return null;
  }
  return {
    workspaceId,
    title:
      deps.normalizeNullableText(value.title) ?? deps.normalizeNullableText(value.name) ?? null,
    role: deps.normalizeNullableText(value.role),
    isDefault: value.isDefault === true || value.is_default === true || value.default === true,
  };
}

function resolveChatgptWorkspaceMemberships(
  deps: ChatgptAuthTokensRefreshResolverDeps,
  account: OAuthAccountSummary
): ChatgptWorkspaceMembership[] {
  const typedMemberships = Array.isArray(account.chatgptWorkspaces)
    ? account.chatgptWorkspaces
        .map((entry) => normalizeChatgptWorkspaceMembership(deps, entry))
        .filter((entry): entry is ChatgptWorkspaceMembership => entry !== null)
    : [];
  if (typedMemberships.length > 0) {
    return typedMemberships;
  }
  if (!deps.isRecord(account.metadata)) {
    return [];
  }
  for (const key of CHATGPT_WORKSPACE_COLLECTION_METADATA_KEYS) {
    const value = account.metadata[key];
    if (!Array.isArray(value)) {
      continue;
    }
    const memberships = value
      .map((entry) => normalizeChatgptWorkspaceMembership(deps, entry))
      .filter((entry): entry is ChatgptWorkspaceMembership => entry !== null);
    if (memberships.length > 0) {
      return memberships;
    }
  }
  return [];
}

function resolveDefaultChatgptWorkspaceId(
  deps: ChatgptAuthTokensRefreshResolverDeps,
  account: OAuthAccountSummary
): string | null {
  const typedDefault = deps.normalizeNullableText(account.defaultChatgptWorkspaceId);
  if (typedDefault) {
    return typedDefault;
  }
  if (deps.isRecord(account.metadata)) {
    const fromMetadata = readFirstMetadataString(
      deps,
      account.metadata,
      CHATGPT_DEFAULT_WORKSPACE_ID_METADATA_KEYS
    );
    if (fromMetadata) {
      return fromMetadata;
    }
  }
  return (
    resolveChatgptWorkspaceMemberships(deps, account).find((entry) => entry.isDefault)
      ?.workspaceId ?? null
  );
}

function accountSupportsChatgptWorkspace(
  deps: ChatgptAuthTokensRefreshResolverDeps,
  account: OAuthAccountSummary,
  chatgptWorkspaceId: string | null
): boolean {
  if (!chatgptWorkspaceId) {
    return true;
  }
  if (resolveDefaultChatgptWorkspaceId(deps, account) === chatgptWorkspaceId) {
    return true;
  }
  return resolveChatgptWorkspaceMemberships(deps, account).some(
    (entry) => entry.workspaceId === chatgptWorkspaceId
  );
}

function accountMatchesPreviousAccountId(
  deps: ChatgptAuthTokensRefreshResolverDeps,
  account: OAuthAccountSummary,
  previousAccountId: string
): boolean {
  const normalizedPrevious = previousAccountId.trim();
  if (!normalizedPrevious) {
    return false;
  }
  return (
    deps.normalizeNullableText(account.accountId) === normalizedPrevious ||
    deps.normalizeNullableText(account.externalAccountId) === normalizedPrevious ||
    resolveChatgptAccountIdCandidate(deps, account) === normalizedPrevious
  );
}

async function resolvePreferredCodexOAuthAccount(
  deps: ChatgptAuthTokensRefreshResolverDeps,
  sessionId: string | null,
  previousAccountId: string | null,
  chatgptWorkspaceId: string | null
): Promise<OAuthAccountSummary | null> {
  const accounts = await deps.listOAuthAccounts(CODEX_PROVIDER, { usageRefresh: "force" });
  if (accounts.length === 0) {
    return null;
  }
  const pools = await deps.listOAuthPools(CODEX_PROVIDER);
  const enabledAccounts = accounts.filter((account) => account.status === "enabled");
  const activeAccounts = enabledAccounts.length > 0 ? enabledAccounts : accounts;
  const workspaceScopedAccounts = activeAccounts.filter((account) =>
    accountSupportsChatgptWorkspace(deps, account, chatgptWorkspaceId)
  );
  const candidateAccounts = chatgptWorkspaceId ? workspaceScopedAccounts : activeAccounts;
  if (candidateAccounts.length === 0) {
    return null;
  }

  try {
    const selected = await deps.getRuntimeClient().oauthSelectPoolAccount?.({
      poolId: "pool-codex",
      sessionId,
      chatgptWorkspaceId,
      modelId: null,
    });
    if (selected?.account) {
      const matched = candidateAccounts.find(
        (account) => account.accountId === selected.account.accountId
      );
      if (matched) {
        return matched;
      }
    }
  } catch (error) {
    deps.logRuntimeWarning(
      "Runtime oauth pool selection unavailable during chatgpt auth token refresh fallback.",
      {
        error: deps.getErrorMessage(error),
      }
    );
  }

  if (previousAccountId) {
    const previousMatched = candidateAccounts.filter((account) =>
      accountMatchesPreviousAccountId(deps, account, previousAccountId)
    );
    if (previousMatched.length > 0) {
      return (
        deps.pickPoolPreferredAccount(previousMatched, pools, CODEX_PROVIDER) ??
        deps.pickPreferredOAuthAccount(previousMatched, CODEX_PROVIDER) ??
        previousMatched[0] ??
        null
      );
    }
  }

  return (
    deps.pickPoolPreferredAccount(candidateAccounts, pools, CODEX_PROVIDER) ??
    deps.pickPreferredOAuthAccount(candidateAccounts, CODEX_PROVIDER) ??
    candidateAccounts[0] ??
    null
  );
}

function normalizeChatgptAuthTokensRefreshResponsePayload(
  deps: ChatgptAuthTokensRefreshResolverDeps,
  payload: unknown
): ChatgptAuthTokensRefreshResolution | null {
  if (!deps.isRecord(payload)) {
    return null;
  }
  const accessToken =
    deps.normalizeNullableText(payload.accessToken) ??
    deps.normalizeNullableText(payload.access_token) ??
    deps.normalizeNullableText(payload.token);
  if (!accessToken) {
    return null;
  }
  const chatgptAccountId =
    deps.normalizeNullableText(payload.chatgptAccountId) ??
    deps.normalizeNullableText(payload.chatgpt_account_id);
  if (!chatgptAccountId) {
    return null;
  }
  const sourceAccountId =
    deps.normalizeNullableText(payload.sourceAccountId) ??
    deps.normalizeNullableText(payload.source_account_id) ??
    deps.normalizeNullableText(payload.accountId) ??
    deps.normalizeNullableText(payload.account_id) ??
    chatgptAccountId;
  return {
    accessToken,
    chatgptAccountId,
    chatgptPlanType:
      deps.normalizeNullableText(payload.chatgptPlanType) ??
      deps.normalizeNullableText(payload.chatgpt_plan_type) ??
      deps.normalizeNullableText(payload.planType) ??
      deps.normalizeNullableText(payload.plan_type) ??
      deps.normalizeNullableText(payload.plan),
    sourceAccountId,
  };
}

async function resolveChatgptAuthTokensRefreshViaRuntimeRpc(
  deps: ChatgptAuthTokensRefreshResolverDeps,
  sessionId: string | null,
  previousAccountId: string | null,
  chatgptWorkspaceId: string | null
): Promise<ChatgptAuthTokensRefreshResolution | null | undefined> {
  const requestPayload: OAuthChatgptAuthTokensRefreshRequest = {
    reason: "unauthorized",
    sessionId,
    previousAccountId,
    chatgptWorkspaceId,
  };
  try {
    const useDirectRpc = deps.shouldUseWebRuntimeDirectRpc();
    const refreshed = await deps.runWebRuntimeOAuthRequest<unknown>(
      `oauth_chatgpt_auth_tokens_refresh:${sessionId ?? "*"}:${previousAccountId ?? "*"}:${chatgptWorkspaceId ?? "*"}`,
      () =>
        deps.awaitWebRuntimeWithFallbackTimeout(
          (signal) =>
            useDirectRpc
              ? deps.invokeWebRuntimeRpc<unknown>(
                  deps.runtimeMethodOauthChatgptAuthTokensRefresh,
                  requestPayload,
                  signal
                )
              : (
                  deps.getRuntimeClient() as {
                    oauthChatgptAuthTokensRefresh: (
                      request: OAuthChatgptAuthTokensRefreshRequest
                    ) => Promise<OAuthChatgptAuthTokensRefreshResponse | null>;
                  }
                ).oauthChatgptAuthTokensRefresh(requestPayload),
          "oauth chatgpt auth token refresh",
          useDirectRpc
            ? deps.webRuntimeOauthDirectRpcTimeoutMs
            : deps.webRuntimeOauthFallbackTimeoutMs
        )
    );
    deps.clearWebRuntimeOauthCooldown();
    if (refreshed === null) {
      return null;
    }
    return normalizeChatgptAuthTokensRefreshResponsePayload(deps, refreshed);
  } catch (error) {
    if (
      deps.isRuntimeMethodUnsupportedError(error, deps.runtimeMethodOauthChatgptAuthTokensRefresh)
    ) {
      return undefined;
    }
    if (!deps.isTauri()) {
      deps.markWebRuntimeOauthCooldown(error, "oauth chatgpt auth token refresh");
    }
    deps.logRuntimeWarning(
      "Runtime oauth chatgpt auth token refresh RPC unavailable; falling back to oauth account metadata.",
      {
        error: deps.getErrorMessage(error),
      }
    );
    return undefined;
  }
}

export async function resolveChatgptAuthTokensRefreshResponseWithDeps(
  deps: ChatgptAuthTokensRefreshResolverDeps,
  options: {
    sessionId?: string | null;
    previousAccountId?: string | null;
    chatgptWorkspaceId?: string | null;
  } = {}
): Promise<ChatgptAuthTokensRefreshResolution | null> {
  const sessionId = deps.normalizeNullableText(options.sessionId ?? null);
  const previousAccountId = deps.normalizeNullableText(options.previousAccountId ?? null);
  const chatgptWorkspaceId = deps.normalizeNullableText(options.chatgptWorkspaceId ?? null);
  const refreshedViaRpc = await resolveChatgptAuthTokensRefreshViaRuntimeRpc(
    deps,
    sessionId,
    previousAccountId,
    chatgptWorkspaceId
  );
  if (refreshedViaRpc !== undefined) {
    return refreshedViaRpc;
  }

  const account = await resolvePreferredCodexOAuthAccount(
    deps,
    sessionId,
    previousAccountId,
    chatgptWorkspaceId
  );
  if (!account) {
    return null;
  }
  const accessToken = resolveChatgptAccessTokenCandidate(deps, account);
  if (!accessToken) {
    return null;
  }
  const chatgptAccountId = resolveChatgptAccountIdCandidate(deps, account) ?? previousAccountId;
  if (!chatgptAccountId) {
    return null;
  }
  return {
    accessToken,
    chatgptAccountId,
    chatgptPlanType: resolveChatgptPlanTypeCandidate(deps, account),
    sourceAccountId: account.accountId,
  };
}
