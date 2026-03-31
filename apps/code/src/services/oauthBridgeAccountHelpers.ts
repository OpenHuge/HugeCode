import { resolveRateLimitsByLimitIdMap, resolveRateLimitsSnapshot } from "../utils/rateLimits";
import type {
  OAuthAccountSummary,
  OAuthPoolAccountBindRequest,
  OAuthPoolSelectionRequest,
  OAuthPoolSelectionResult,
  OAuthPoolSummary,
  OAuthProviderId,
  OAuthUsageRefreshMode,
} from "./runtimeClient";

const LOCAL_CODEX_CLI_ACCOUNT_SOURCE = "local_codex_cli_auth";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeAccountIdentityText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function resolveDefaultChatgptWorkspaceTitle(account: OAuthAccountSummary | null): string | null {
  if (!account) {
    return null;
  }
  if (isRecord(account.metadata)) {
    const profileTitle =
      normalizeAccountIdentityText(account.metadata.workspaceTitle) ??
      normalizeAccountIdentityText(account.metadata.workspace_title) ??
      normalizeAccountIdentityText(account.metadata.accountName) ??
      normalizeAccountIdentityText(account.metadata.account_name) ??
      normalizeAccountIdentityText(account.metadata.organizationName) ??
      normalizeAccountIdentityText(account.metadata.organization_name);
    if (profileTitle) {
      return profileTitle;
    }
  }
  const defaultWorkspace =
    account.chatgptWorkspaces?.find(
      (workspace) =>
        workspace.workspaceId === account.defaultChatgptWorkspaceId || workspace.isDefault
    ) ?? null;
  const titledWorkspace =
    defaultWorkspace ??
    account.chatgptWorkspaces?.find(
      (workspace) => normalizeAccountIdentityText(workspace.title) !== null
    ) ??
    null;
  const workspaceTitle = normalizeAccountIdentityText(titledWorkspace?.title);
  if (workspaceTitle) {
    return workspaceTitle;
  }
  if (!isRecord(account.metadata)) {
    return null;
  }
  return (
    normalizeAccountIdentityText(account.metadata.teamName) ??
    normalizeAccountIdentityText(account.metadata.team_name)
  );
}

function getAccountPlanType(account: OAuthAccountSummary | null): string | null {
  if (!account || !isRecord(account.metadata)) {
    return null;
  }
  const planTypeRaw =
    account.metadata.planType ??
    account.metadata.plan_type ??
    account.metadata.plan ??
    account.metadata.tier ??
    null;
  if (typeof planTypeRaw !== "string") {
    return null;
  }
  const normalized = planTypeRaw.trim();
  return normalized.length > 0 ? normalized : null;
}

function getAccountAuthMode(account: OAuthAccountSummary | null): string | null {
  if (!account || !isRecord(account.metadata)) {
    return null;
  }
  const authModeRaw = account.metadata.authMode ?? account.metadata.auth_mode ?? null;
  if (typeof authModeRaw !== "string") {
    return null;
  }
  const normalized = authModeRaw.trim();
  return normalized.length > 0 ? normalized : null;
}

function isLocalCliManagedAccount(account: OAuthAccountSummary | null): boolean | null {
  if (!account || !isRecord(account.metadata)) {
    return null;
  }
  return typeof account.metadata.localCliManaged === "boolean"
    ? account.metadata.localCliManaged
    : null;
}

function resolveOAuthAccountIdentity(account: OAuthAccountSummary | null): string | null {
  if (!account) {
    return null;
  }
  const directEmail = normalizeAccountIdentityText(account.email);
  if (directEmail) {
    return directEmail;
  }
  if (!isRecord(account.metadata)) {
    return (
      normalizeAccountIdentityText(account.displayName) ??
      normalizeAccountIdentityText(account.externalAccountId)
    );
  }
  const metadataEmail =
    normalizeAccountIdentityText(account.metadata.email) ??
    normalizeAccountIdentityText(account.metadata.userEmail) ??
    normalizeAccountIdentityText(account.metadata.user_email);
  if (metadataEmail) {
    return metadataEmail;
  }
  const metadataIdentity =
    normalizeAccountIdentityText(account.metadata.login) ??
    normalizeAccountIdentityText(account.metadata.username);
  return (
    normalizeAccountIdentityText(account.displayName) ??
    normalizeAccountIdentityText(account.externalAccountId) ??
    metadataIdentity
  );
}

function getOAuthAccountIdentityScore(account: OAuthAccountSummary): number {
  const identity = resolveOAuthAccountIdentity(account);
  if (!identity) {
    return 0;
  }
  return identity.includes("@") ? 2 : 1;
}

export function pickPreferredOAuthAccount(
  accounts: OAuthAccountSummary[],
  provider: OAuthProviderId | null = null
): OAuthAccountSummary | null {
  const scoped = provider ? accounts.filter((account) => account.provider === provider) : accounts;
  if (scoped.length === 0) {
    return null;
  }
  const enabled = scoped.filter((account) => account.status === "enabled");
  const candidates = enabled.length > 0 ? enabled : scoped;
  return (
    candidates.slice().sort((left, right) => {
      const rightIdentityScore = getOAuthAccountIdentityScore(right);
      const leftIdentityScore = getOAuthAccountIdentityScore(left);
      if (rightIdentityScore !== leftIdentityScore) {
        return rightIdentityScore - leftIdentityScore;
      }
      return (right.updatedAt ?? 0) - (left.updatedAt ?? 0);
    })[0] ?? null
  );
}

export function pickPoolPreferredAccount(
  accounts: OAuthAccountSummary[],
  pools: OAuthPoolSummary[],
  provider: OAuthProviderId | null = null
): OAuthAccountSummary | null {
  const scopedPools = pools.filter(
    (pool) => pool.enabled && (!provider || pool.provider === provider)
  );
  const orderedPools = scopedPools
    .slice()
    .sort((left, right) => (right.updatedAt ?? 0) - (left.updatedAt ?? 0));
  for (const pool of orderedPools) {
    if (pool.preferredAccountId) {
      const preferred = accounts.find(
        (account) =>
          account.accountId === pool.preferredAccountId &&
          account.provider === pool.provider &&
          account.status === "enabled"
      );
      if (preferred) {
        return preferred;
      }
    }
    const providerPreferred = pickPreferredOAuthAccount(accounts, pool.provider);
    if (providerPreferred) {
      return providerPreferred;
    }
  }
  return pickPreferredOAuthAccount(accounts, provider);
}

export function createRuntimeAccountInfoResponse(
  account: OAuthAccountSummary | null
): Record<string, unknown> {
  if (!account) {
    return {
      result: {
        account: null,
        requiresOpenaiAuth: true,
        requires_openai_auth: true,
      },
    };
  }
  const identity = resolveOAuthAccountIdentity(account);
  const identityLooksLikeEmail = Boolean(identity?.includes("@"));
  const authMode = getAccountAuthMode(account);
  const localCliManaged = isLocalCliManagedAccount(account);
  const defaultChatgptWorkspaceTitle = resolveDefaultChatgptWorkspaceTitle(account);
  const normalizedAuthMode = authMode?.trim().toLowerCase() ?? null;
  const type =
    normalizedAuthMode === "chatgpt"
      ? "chatgpt"
      : normalizedAuthMode === "apikey" || normalizedAuthMode === "api_key"
        ? "apikey"
        : identityLooksLikeEmail
          ? "chatgpt"
          : "apikey";
  return {
    result: {
      account: {
        type,
        email: identity || null,
        planType: getAccountPlanType(account),
        provider: account.provider,
        accountId: account.accountId,
        externalAccountId: account.externalAccountId,
        displayName: account.displayName,
        ...(defaultChatgptWorkspaceTitle ? { defaultChatgptWorkspaceTitle } : {}),
        ...(authMode ? { authMode } : {}),
        ...(localCliManaged !== null ? { localCliManaged } : {}),
      },
      requiresOpenaiAuth: false,
      requires_openai_auth: false,
    },
  };
}

export function createRuntimeAccountRateLimitsResponse(
  account: OAuthAccountSummary | null
): Record<string, unknown> {
  if (!account || !isRecord(account.metadata)) {
    return { result: {} };
  }
  const rateLimitsRaw = resolveRateLimitsSnapshot(account.metadata);
  const rateLimitsByLimitId = resolveRateLimitsByLimitIdMap(account.metadata);
  if (!rateLimitsRaw && !rateLimitsByLimitId) {
    return { result: {} };
  }
  return {
    result: {
      ...(rateLimitsRaw
        ? {
            rateLimits: rateLimitsRaw,
            rate_limits: rateLimitsRaw,
          }
        : {}),
      ...(rateLimitsByLimitId
        ? {
            rateLimitsByLimitId: rateLimitsByLimitId,
            rate_limits_by_limit_id: rateLimitsByLimitId,
          }
        : {}),
    },
  };
}

export function createMockOauthEntityId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

export function accountHasRoutingCredential(account: OAuthAccountSummary): boolean {
  const metadata = account.metadata;
  if (!metadata || !isRecord(metadata)) {
    return false;
  }
  if (metadata.apiKeyConfigured === true) {
    return true;
  }
  return (
    metadata.localCliManaged === true &&
    metadata.source === LOCAL_CODEX_CLI_ACCOUNT_SOURCE &&
    metadata.credentialAvailable === true
  );
}

type RuntimeProjectWorkspaceAccountClient = {
  oauthAccounts?:
    | ((
        provider?: OAuthProviderId | null,
        options?: { usageRefresh?: OAuthUsageRefreshMode | null }
      ) => Promise<OAuthAccountSummary[]>)
    | undefined;
  oauthSelectPoolAccount?:
    | ((request: OAuthPoolSelectionRequest) => Promise<OAuthPoolSelectionResult | null>)
    | undefined;
};

type ResolveProjectWorkspaceScopedOAuthAccountDeps = {
  defaultCodexOauthPoolId: string;
  projectWorkspaceId: string;
  refreshCodexUsage?: boolean;
  normalizeOAuthAccountSummary: (account: OAuthAccountSummary) => OAuthAccountSummary;
  normalizeNullableText: (value: unknown) => string | null;
  getRuntimeClient: () => RuntimeProjectWorkspaceAccountClient;
  listOAuthAccounts: (
    provider: OAuthProviderId | null,
    options?: { usageRefresh?: OAuthUsageRefreshMode | null }
  ) => Promise<OAuthAccountSummary[]>;
  resolvePreferredOAuthAccount: () => Promise<OAuthAccountSummary | null>;
  isRuntimeMethodUnsupportedError: (error: unknown) => boolean;
  logRuntimeWarning: (message: string, context?: unknown) => void;
};

export async function resolveProjectWorkspaceScopedOAuthAccount(
  deps: ResolveProjectWorkspaceScopedOAuthAccountDeps
): Promise<OAuthAccountSummary | null> {
  const normalizedProjectWorkspaceId = deps.normalizeNullableText(deps.projectWorkspaceId);
  let runtimeClient: RuntimeProjectWorkspaceAccountClient | null = null;
  try {
    runtimeClient = deps.getRuntimeClient();
  } catch {
    runtimeClient = null;
  }
  const refreshedCodexAccounts =
    deps.refreshCodexUsage && runtimeClient && typeof runtimeClient.oauthAccounts === "function"
      ? await deps.listOAuthAccounts("codex", { usageRefresh: "force" })
      : null;
  if (normalizedProjectWorkspaceId) {
    try {
      const selectPoolAccount = runtimeClient?.oauthSelectPoolAccount;
      if (typeof selectPoolAccount === "function") {
        const selected = await selectPoolAccount({
          poolId: deps.defaultCodexOauthPoolId,
          sessionId: normalizedProjectWorkspaceId,
          modelId: null,
        });
        if (selected?.account) {
          return selectRefreshedCodexAccount(
            deps.normalizeOAuthAccountSummary(selected.account),
            refreshedCodexAccounts,
            deps.normalizeNullableText
          );
        }
      }
    } catch (error) {
      if (!deps.isRuntimeMethodUnsupportedError(error)) {
        deps.logRuntimeWarning(
          "Runtime oauth pool selection failed while reading project workspace account info; falling back to preferred account resolution.",
          error
        );
      }
    }
  }
  return (
    selectRefreshedCodexAccount(
      pickPreferredOAuthAccount(refreshedCodexAccounts ?? [], "codex"),
      refreshedCodexAccounts,
      deps.normalizeNullableText
    ) ?? deps.resolvePreferredOAuthAccount()
  );
}

function selectRefreshedCodexAccount(
  account: OAuthAccountSummary | null,
  refreshedCodexAccounts: OAuthAccountSummary[] | null,
  normalizeNullableText: (value: unknown) => string | null
): OAuthAccountSummary | null {
  if (!account) {
    return null;
  }
  if (!refreshedCodexAccounts || refreshedCodexAccounts.length === 0) {
    return account;
  }
  if (resolveRateLimitsSnapshot(account.metadata) !== null) {
    return account;
  }
  const accountId = normalizeNullableText(account.accountId);
  if (!accountId) {
    return account;
  }
  const refreshed =
    refreshedCodexAccounts.find(
      (entry) => entry.accountId === accountId && resolveRateLimitsSnapshot(entry.metadata) !== null
    ) ?? null;
  return refreshed ?? account;
}

function buildMockProjectWorkspaceBindingKey(
  poolId: string,
  sessionId: string,
  chatgptWorkspaceId: string | null
): string {
  return `${poolId}::${sessionId}::${chatgptWorkspaceId ?? ""}`;
}

type SelectOAuthPoolAccountWithFallbackDeps = {
  getRuntimeClient: () => {
    oauthSelectPoolAccount?: (
      request: OAuthPoolSelectionRequest
    ) => Promise<OAuthPoolSelectionResult | null>;
  };
  isDesktopHostRuntime: () => boolean;
  normalizeNullableText: (value: unknown) => string | null;
  readMockOAuthPools: () => OAuthPoolSummary[];
  readMockOAuthAccounts: () => OAuthAccountSummary[];
  readMockOAuthPoolMembers: () => Record<string, { accountId: string; enabled: boolean }[]>;
  readMockProjectWorkspaceBindings: () => Record<string, string>;
  clearWebRuntimeOauthRequestInFlight: () => void;
  clearMockOauthFallbackActive: () => void;
};

export async function selectOAuthPoolAccountWithFallback(
  request: OAuthPoolSelectionRequest,
  deps: SelectOAuthPoolAccountWithFallbackDeps
): Promise<OAuthPoolSelectionResult | null> {
  try {
    const selected = await deps.getRuntimeClient().oauthSelectPoolAccount?.(request);
    deps.clearWebRuntimeOauthRequestInFlight();
    deps.clearMockOauthFallbackActive();
    return selected ?? null;
  } catch (error) {
    if (deps.isDesktopHostRuntime()) {
      throw error;
    }
  }

  const poolId = deps.normalizeNullableText(request.poolId);
  if (!poolId) {
    deps.clearWebRuntimeOauthRequestInFlight();
    return null;
  }

  const pool = deps.readMockOAuthPools().find((entry) => entry.poolId === poolId) ?? null;
  if (!pool || !pool.enabled) {
    deps.clearWebRuntimeOauthRequestInFlight();
    return null;
  }

  const accounts = deps
    .readMockOAuthAccounts()
    .filter((account) => account.provider === pool.provider && account.status === "enabled");
  if (accounts.length === 0) {
    deps.clearWebRuntimeOauthRequestInFlight();
    return null;
  }

  const members = (deps.readMockOAuthPoolMembers()[poolId] ?? []).filter(
    (member) => member.enabled
  );
  const memberIdSet = new Set(members.map((member) => member.accountId));
  const poolAccounts =
    memberIdSet.size > 0
      ? accounts.filter((account) => memberIdSet.has(account.accountId))
      : accounts;
  const requestedWorkspaceId = deps.normalizeNullableText(
    request.chatgptWorkspaceId ?? request.workspaceId
  );
  const workspaceScopedAccounts =
    requestedWorkspaceId === null
      ? poolAccounts
      : poolAccounts.filter((account) => {
          if (account.defaultChatgptWorkspaceId === requestedWorkspaceId) {
            return true;
          }
          return (
            account.chatgptWorkspaces?.some(
              (workspace) => workspace.workspaceId === requestedWorkspaceId
            ) ?? false
          );
        });
  const requestedProjectWorkspaceId = deps.normalizeNullableText(request.sessionId);
  const projectWorkspaceBindings = deps.readMockProjectWorkspaceBindings();
  const manuallyBoundAccountId =
    requestedProjectWorkspaceId === null
      ? null
      : (projectWorkspaceBindings[
          buildMockProjectWorkspaceBindingKey(
            poolId,
            requestedProjectWorkspaceId,
            requestedWorkspaceId
          )
        ] ?? null);
  const manuallyBoundAccount =
    manuallyBoundAccountId === null
      ? null
      : (workspaceScopedAccounts.find((account) => account.accountId === manuallyBoundAccountId) ??
        null);

  if (manuallyBoundAccount) {
    deps.clearWebRuntimeOauthRequestInFlight();
    return {
      poolId: pool.poolId,
      account: manuallyBoundAccount,
      reason: "manual_binding",
    };
  }

  const preferred =
    (pool.preferredAccountId
      ? (workspaceScopedAccounts.find((account) => account.accountId === pool.preferredAccountId) ??
        null)
      : null) ?? null;
  const selected =
    preferred ??
    workspaceScopedAccounts
      .slice()
      .sort((left, right) => (right.updatedAt ?? 0) - (left.updatedAt ?? 0))[0] ??
    null;
  if (!selected) {
    deps.clearWebRuntimeOauthRequestInFlight();
    return null;
  }

  deps.clearWebRuntimeOauthRequestInFlight();
  return {
    poolId: pool.poolId,
    account: selected,
    reason: preferred ? "preferred_account" : "latest_enabled_account",
  };
}

type BindOAuthPoolAccountWithFallbackDeps = {
  getRuntimeClient: () => {
    oauthBindPoolAccount?: (
      request: OAuthPoolAccountBindRequest
    ) => Promise<OAuthPoolSelectionResult | null>;
  };
  isDesktopHostRuntime: () => boolean;
  normalizeNullableText: (value: unknown) => string | null;
  readMockOAuthAccounts: () => OAuthAccountSummary[];
  readMockProjectWorkspaceBindings: () => Record<string, string>;
  writeMockProjectWorkspaceBindings: (bindings: Record<string, string>) => void;
  clearWebRuntimeOauthRequestInFlight: () => void;
  clearMockOauthFallbackActive: () => void;
};

export async function bindOAuthPoolAccountWithFallback(
  request: OAuthPoolAccountBindRequest,
  deps: BindOAuthPoolAccountWithFallbackDeps
): Promise<OAuthPoolSelectionResult | null> {
  try {
    const selected = await deps.getRuntimeClient().oauthBindPoolAccount?.(request);
    deps.clearWebRuntimeOauthRequestInFlight();
    deps.clearMockOauthFallbackActive();
    return selected ?? null;
  } catch (error) {
    if (deps.isDesktopHostRuntime()) {
      throw error;
    }
  }

  const poolId = deps.normalizeNullableText(request.poolId);
  const sessionId = deps.normalizeNullableText(request.sessionId);
  const accountId = deps.normalizeNullableText(request.accountId);
  const requestedWorkspaceId = deps.normalizeNullableText(
    request.chatgptWorkspaceId ?? request.workspaceId
  );
  if (!poolId || !sessionId || !accountId) {
    deps.clearWebRuntimeOauthRequestInFlight();
    return null;
  }

  const accounts = deps.readMockOAuthAccounts();
  const matchedAccount =
    accounts.find((account) => account.accountId === accountId && account.provider === "codex") ??
    null;
  const allowedForWorkspace =
    matchedAccount === null
      ? false
      : requestedWorkspaceId === null
        ? true
        : matchedAccount.defaultChatgptWorkspaceId === requestedWorkspaceId ||
          (matchedAccount.chatgptWorkspaces?.some(
            (workspace) => workspace.workspaceId === requestedWorkspaceId
          ) ??
            false);
  if (!matchedAccount || !allowedForWorkspace || matchedAccount.status !== "enabled") {
    deps.clearWebRuntimeOauthRequestInFlight();
    return null;
  }

  const bindings = deps.readMockProjectWorkspaceBindings();
  bindings[buildMockProjectWorkspaceBindingKey(poolId, sessionId, requestedWorkspaceId)] =
    accountId;
  deps.writeMockProjectWorkspaceBindings(bindings);
  deps.clearWebRuntimeOauthRequestInFlight();
  return {
    poolId,
    account: matchedAccount,
    reason: "manual_binding",
  };
}
