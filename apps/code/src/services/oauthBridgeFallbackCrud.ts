import type {
  OAuthAccountSummary,
  OAuthAccountUpsertInput,
  OAuthPoolAccountBindRequest,
  OAuthPoolMember,
  OAuthPoolMemberInput,
  OAuthPoolSelectionRequest,
  OAuthPoolSelectionResult,
  OAuthPoolSummary,
  OAuthPoolUpsertInput,
  OAuthProviderId,
  OAuthRateLimitReportInput,
} from "./runtimeClient";
import {
  buildMockProjectWorkspaceBindingKey,
  mergeOAuthAccountMetadata,
  normalizeNullableText,
  normalizeOAuthAccountChatgptWorkspaceState,
  normalizeOAuthAccountRouteConfig,
  normalizeOAuthAccountRoutingState,
  normalizeOAuthAccountStatus,
  normalizeOAuthPoolStrategy,
  normalizeOAuthStickyMode,
} from "./oauthBridgeNormalization";
import {
  readMockOAuthAccounts,
  readMockOAuthPoolMembers,
  readMockOAuthPools,
  readMockProjectWorkspaceBindings,
  writeMockOAuthAccounts,
  writeMockOAuthPoolMembers,
  writeMockOAuthPools,
  writeMockProjectWorkspaceBindings,
} from "./oauthBridgeMockState";

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function listMockOAuthAccounts(
  provider: OAuthProviderId | null = null
): OAuthAccountSummary[] {
  const accounts = readMockOAuthAccounts();
  if (!provider) {
    return accounts;
  }
  return accounts.filter((account) => account.provider === provider);
}

export function upsertMockOAuthAccount(input: OAuthAccountUpsertInput): OAuthAccountSummary {
  const accounts = readMockOAuthAccounts();
  const existing = accounts.find((account) => account.accountId === input.accountId) ?? null;
  const now = Date.now();
  const baseMetadata = isRecord(input.metadata)
    ? { ...input.metadata }
    : isRecord(existing?.metadata)
      ? { ...existing.metadata }
      : {};
  const routeConfig = normalizeOAuthAccountRouteConfig(input.routeConfig, baseMetadata);
  const routingState = normalizeOAuthAccountRoutingState(input.routingState, baseMetadata);
  const { chatgptWorkspaces, defaultChatgptWorkspaceId } =
    normalizeOAuthAccountChatgptWorkspaceState(
      {
        ...(existing ?? {
          accountId: input.accountId,
          provider: input.provider,
          externalAccountId: null,
          email: null,
          displayName: null,
          status: "enabled",
          disabledReason: null,
          metadata: baseMetadata,
          createdAt: now,
          updatedAt: now,
        }),
        ...input,
      } as OAuthAccountSummary,
      baseMetadata
    );
  const next: OAuthAccountSummary = {
    accountId: input.accountId,
    provider: input.provider,
    externalAccountId: normalizeNullableText(input.externalAccountId),
    email: normalizeNullableText(input.email),
    displayName: normalizeNullableText(input.displayName),
    status: normalizeOAuthAccountStatus(input.status ?? existing?.status ?? "enabled"),
    disabledReason: normalizeNullableText(input.disabledReason),
    routeConfig,
    routingState,
    chatgptWorkspaces,
    defaultChatgptWorkspaceId,
    metadata: mergeOAuthAccountMetadata(
      baseMetadata,
      routeConfig,
      routingState,
      chatgptWorkspaces,
      defaultChatgptWorkspaceId
    ),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  const updated = [...accounts.filter((account) => account.accountId !== input.accountId), next];
  writeMockOAuthAccounts(updated);
  return next;
}

export function syncMockOAuthAccounts(accounts: OAuthAccountSummary[]) {
  writeMockOAuthAccounts(accounts);
}

export function removeMockOAuthAccount(accountId: string): boolean {
  const accounts = readMockOAuthAccounts();
  const before = accounts.length;
  const nextAccounts = accounts.filter((account) => account.accountId !== accountId);
  writeMockOAuthAccounts(nextAccounts);

  const pools = readMockOAuthPools();
  const nextPools = pools.map((pool) =>
    pool.preferredAccountId === accountId ? { ...pool, preferredAccountId: null } : pool
  );
  writeMockOAuthPools(nextPools);

  const membersByPool = readMockOAuthPoolMembers();
  const nextMembersByPool = Object.fromEntries(
    Object.entries(membersByPool).map(([poolId, members]) => [
      poolId,
      members.filter((member) => member.accountId !== accountId),
    ])
  );
  writeMockOAuthPoolMembers(nextMembersByPool);
  return before !== nextAccounts.length;
}

export function listMockOAuthPools(provider: OAuthProviderId | null = null): OAuthPoolSummary[] {
  const pools = readMockOAuthPools();
  if (!provider) {
    return pools;
  }
  return pools.filter((pool) => pool.provider === provider);
}

export function listMockOAuthPoolMembers(poolId: string): OAuthPoolMember[] {
  return readMockOAuthPoolMembers()[poolId] ?? [];
}

export function upsertMockOAuthPool(input: OAuthPoolUpsertInput): OAuthPoolSummary {
  const pools = readMockOAuthPools();
  const existing = pools.find((pool) => pool.poolId === input.poolId) ?? null;
  const now = Date.now();
  const next: OAuthPoolSummary = {
    poolId: input.poolId,
    provider: input.provider,
    name: input.name,
    strategy: normalizeOAuthPoolStrategy(input.strategy ?? existing?.strategy ?? "round_robin"),
    stickyMode: normalizeOAuthStickyMode(input.stickyMode ?? existing?.stickyMode ?? "cache_first"),
    preferredAccountId: normalizeNullableText(input.preferredAccountId),
    enabled: input.enabled ?? existing?.enabled ?? true,
    metadata: input.metadata ?? existing?.metadata ?? {},
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  const updated = [...pools.filter((pool) => pool.poolId !== input.poolId), next];
  writeMockOAuthPools(updated);
  return next;
}

export function removeMockOAuthPool(poolId: string): boolean {
  const pools = readMockOAuthPools();
  const before = pools.length;
  const nextPools = pools.filter((pool) => pool.poolId !== poolId);
  writeMockOAuthPools(nextPools);

  const membersByPool = readMockOAuthPoolMembers();
  if (poolId in membersByPool) {
    delete membersByPool[poolId];
    writeMockOAuthPoolMembers(membersByPool);
  }
  return before !== nextPools.length;
}

export function replaceMockOAuthPoolMembers(
  poolId: string,
  members: OAuthPoolMemberInput[]
): OAuthPoolMember[] {
  const membersByPool = readMockOAuthPoolMembers();
  const now = Date.now();
  const replaced = members.map((member, index) => ({
    poolId,
    accountId: member.accountId,
    weight: Math.max(1, Math.trunc(member.weight ?? 1)),
    priority: Math.max(0, Math.trunc(member.priority ?? index)),
    position: Math.max(0, Math.trunc(member.position ?? index)),
    enabled: member.enabled !== false,
    createdAt: now,
    updatedAt: now,
  }));
  membersByPool[poolId] = replaced;
  writeMockOAuthPoolMembers(membersByPool);
  return replaced;
}

export function selectMockOAuthPoolAccount(
  request: OAuthPoolSelectionRequest
): OAuthPoolSelectionResult | null {
  const poolId = normalizeNullableText(request.poolId);
  if (!poolId) {
    return null;
  }

  const pools = readMockOAuthPools();
  const pool = pools.find((entry) => entry.poolId === poolId) ?? null;
  if (!pool || !pool.enabled) {
    return null;
  }

  const accounts = readMockOAuthAccounts().filter(
    (account) => account.provider === pool.provider && account.status === "enabled"
  );
  if (accounts.length === 0) {
    return null;
  }

  const members = (readMockOAuthPoolMembers()[poolId] ?? []).filter((member) => member.enabled);
  const memberIdSet = new Set(members.map((member) => member.accountId));
  const poolAccounts =
    memberIdSet.size > 0
      ? accounts.filter((account) => memberIdSet.has(account.accountId))
      : accounts;
  const requestedWorkspaceId = normalizeNullableText(
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
  const requestedProjectWorkspaceId = normalizeNullableText(request.sessionId);
  const projectWorkspaceBindings = readMockProjectWorkspaceBindings();
  const manuallyBoundAccountId =
    poolId && requestedProjectWorkspaceId
      ? (projectWorkspaceBindings[
          buildMockProjectWorkspaceBindingKey(
            poolId,
            requestedProjectWorkspaceId,
            requestedWorkspaceId
          )
        ] ?? null)
      : null;
  const manuallyBoundAccount =
    manuallyBoundAccountId === null
      ? null
      : (workspaceScopedAccounts.find((account) => account.accountId === manuallyBoundAccountId) ??
        null);

  if (manuallyBoundAccount) {
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
    return null;
  }

  return {
    poolId: pool.poolId,
    account: selected,
    reason: preferred ? "preferred_account" : "latest_enabled_account",
  };
}

export function bindMockOAuthPoolAccount(
  request: OAuthPoolAccountBindRequest
): OAuthPoolSelectionResult | null {
  const poolId = normalizeNullableText(request.poolId);
  const sessionId = normalizeNullableText(request.sessionId);
  const accountId = normalizeNullableText(request.accountId);
  const requestedWorkspaceId = normalizeNullableText(
    request.chatgptWorkspaceId ?? request.workspaceId
  );
  if (!poolId || !sessionId || !accountId) {
    return null;
  }

  const accounts = readMockOAuthAccounts();
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
    return null;
  }

  const bindings = readMockProjectWorkspaceBindings();
  bindings[buildMockProjectWorkspaceBindingKey(poolId, sessionId, requestedWorkspaceId)] =
    accountId;
  writeMockProjectWorkspaceBindings(bindings);
  return {
    poolId,
    account: matchedAccount,
    reason: "manual_binding",
  };
}

export function reportMockOAuthRateLimit(input: OAuthRateLimitReportInput): boolean {
  const accountId = normalizeNullableText(input.accountId);
  if (!accountId) {
    return false;
  }

  const accounts = readMockOAuthAccounts();
  const nextAccounts = accounts.map((account) => {
    if (account.accountId !== accountId) {
      return account;
    }
    const metadata =
      account.metadata && isRecord(account.metadata) ? { ...account.metadata } : ({} as JsonRecord);
    const rateLimits =
      metadata.rateLimits && isRecord(metadata.rateLimits)
        ? { ...metadata.rateLimits }
        : ({} as JsonRecord);
    const reportKey = normalizeNullableText(input.modelId) ?? "default";
    rateLimits[reportKey] = {
      success: input.success ?? null,
      retryAfterSec: input.retryAfterSec ?? null,
      resetAt: input.resetAt ?? null,
      errorCode: normalizeNullableText(input.errorCode),
      errorMessage: normalizeNullableText(input.errorMessage),
      reportedAt: Date.now(),
    };
    metadata.rateLimits = rateLimits;
    return {
      ...account,
      metadata,
      updatedAt: Date.now(),
    };
  });

  writeMockOAuthAccounts(nextAccounts);
  return true;
}
