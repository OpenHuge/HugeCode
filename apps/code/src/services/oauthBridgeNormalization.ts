import type { OAuthAccountSummary, OAuthPoolMember, OAuthPoolSummary } from "./runtimeClient";

type JsonRecord = Record<string, unknown>;
type OAuthAccountStatus = OAuthAccountSummary["status"];
type OAuthAccountRouteConfig = NonNullable<OAuthAccountSummary["routeConfig"]>;
type OAuthAccountRoutingState = NonNullable<OAuthAccountSummary["routingState"]>;
type OAuthAccountChatgptWorkspace = NonNullable<OAuthAccountSummary["chatgptWorkspaces"]>[number];
type OAuthPoolStrategy = OAuthPoolSummary["strategy"];
type OAuthStickyMode = OAuthPoolSummary["stickyMode"];

const OAUTH_ACCOUNT_STATUS_VALUES = new Set([
  "enabled",
  "disabled",
  "forbidden",
  "validation_blocked",
]);
const OAUTH_POOL_STRATEGY_VALUES = new Set(["round_robin", "p2c"]);
const OAUTH_POOL_STICKY_MODE_VALUES = new Set(["cache_first", "balance", "performance_first"]);

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function normalizeNullableText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function normalizeNullableUrl(value: unknown): string | null {
  const normalized = normalizeNullableText(value);
  return normalized ? normalized.replace(/\/+$/u, "") : null;
}

function normalizeOptionalInteger(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return Math.trunc(value);
}

function normalizeOptionalBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

export function normalizeOAuthAccountStatus(value: unknown): OAuthAccountStatus {
  if (typeof value === "string" && OAUTH_ACCOUNT_STATUS_VALUES.has(value)) {
    return value as OAuthAccountStatus;
  }
  return "enabled";
}

export function normalizeOAuthPoolStrategy(value: unknown): OAuthPoolStrategy {
  if (typeof value === "string" && OAUTH_POOL_STRATEGY_VALUES.has(value)) {
    return value as OAuthPoolStrategy;
  }
  return "round_robin";
}

export function normalizeOAuthStickyMode(value: unknown): OAuthStickyMode {
  if (typeof value === "string" && OAUTH_POOL_STICKY_MODE_VALUES.has(value)) {
    return value as OAuthStickyMode;
  }
  return "cache_first";
}

export function normalizeOAuthAccountRouteConfig(
  value: unknown,
  metadata: JsonRecord | null = null
): OAuthAccountRouteConfig | null {
  const routeConfig = isRecord(value) ? value : {};
  const compatBaseUrl = normalizeNullableUrl(
    routeConfig.compatBaseUrl ??
      routeConfig.compat_base_url ??
      metadata?.compatBaseUrl ??
      metadata?.compat_base_url ??
      metadata?.baseUrl ??
      metadata?.base_url ??
      metadata?.proxyBaseUrl ??
      metadata?.proxy_base_url
  );
  const proxyId = normalizeNullableText(routeConfig.proxyId ?? routeConfig.proxy_id);
  const priority = normalizeOptionalInteger(routeConfig.priority);
  const concurrencyLimit = normalizeOptionalInteger(
    routeConfig.concurrencyLimit ?? routeConfig.concurrency_limit
  );
  const schedulable = normalizeOptionalBoolean(routeConfig.schedulable);
  if (
    compatBaseUrl === null &&
    proxyId === null &&
    priority === null &&
    concurrencyLimit === null &&
    schedulable === null
  ) {
    return null;
  }
  return {
    compatBaseUrl,
    proxyId,
    priority,
    concurrencyLimit,
    schedulable,
  };
}

export function normalizeOAuthAccountRoutingState(
  value: unknown,
  metadata: JsonRecord | null = null
): OAuthAccountRoutingState | null {
  const routingState = isRecord(value) ? value : {};
  const credentialReady = normalizeOptionalBoolean(
    routingState.credentialReady ??
      routingState.credential_ready ??
      metadata?.credentialReady ??
      metadata?.credential_ready
  );
  const lastRoutingError = normalizeNullableText(
    routingState.lastRoutingError ?? routingState.last_routing_error
  );
  const rateLimitedUntil = normalizeOptionalInteger(
    routingState.rateLimitedUntil ?? routingState.rate_limited_until
  );
  const overloadedUntil = normalizeOptionalInteger(
    routingState.overloadedUntil ?? routingState.overloaded_until
  );
  const tempUnschedulableUntil = normalizeOptionalInteger(
    routingState.tempUnschedulableUntil ?? routingState.temp_unschedulable_until
  );
  const tempUnschedulableReason = normalizeNullableText(
    routingState.tempUnschedulableReason ?? routingState.temp_unschedulable_reason
  );
  if (
    credentialReady === null &&
    lastRoutingError === null &&
    rateLimitedUntil === null &&
    overloadedUntil === null &&
    tempUnschedulableUntil === null &&
    tempUnschedulableReason === null
  ) {
    return null;
  }
  return {
    credentialReady,
    lastRoutingError,
    rateLimitedUntil,
    overloadedUntil,
    tempUnschedulableUntil,
    tempUnschedulableReason,
  };
}

function normalizeOAuthAccountChatgptWorkspace(
  value: unknown
): OAuthAccountChatgptWorkspace | null {
  const workspace = isRecord(value) ? value : {};
  const workspaceId = normalizeNullableText(
    workspace.workspaceId ??
      workspace.workspace_id ??
      workspace.organizationId ??
      workspace.organization_id ??
      workspace.id
  );
  if (!workspaceId) {
    return null;
  }
  return {
    workspaceId,
    title: normalizeNullableText(workspace.title ?? workspace.name),
    role: normalizeNullableText(workspace.role),
    isDefault:
      workspace.isDefault === true || workspace.is_default === true || workspace.default === true,
  };
}

export function normalizeOAuthAccountChatgptWorkspaceState(
  account: OAuthAccountSummary,
  metadata: JsonRecord | null = null
): {
  chatgptWorkspaces: OAuthAccountChatgptWorkspace[] | null;
  defaultChatgptWorkspaceId: string | null;
} {
  const workspaceCandidates = [
    account.chatgptWorkspaces,
    metadata?.chatgptWorkspaces,
    metadata?.chatgpt_workspaces,
    metadata?.chatgptOrganizations,
    metadata?.chatgpt_organizations,
    metadata?.organizations,
  ];
  let chatgptWorkspaces: OAuthAccountChatgptWorkspace[] | null = null;
  for (const candidate of workspaceCandidates) {
    if (!Array.isArray(candidate)) {
      continue;
    }
    const normalized = candidate
      .map((entry) => normalizeOAuthAccountChatgptWorkspace(entry))
      .filter((entry): entry is OAuthAccountChatgptWorkspace => entry !== null);
    if (normalized.length > 0) {
      chatgptWorkspaces = normalized;
      break;
    }
  }
  const defaultChatgptWorkspaceId =
    normalizeNullableText(
      account.defaultChatgptWorkspaceId ??
        metadata?.defaultChatgptWorkspaceId ??
        metadata?.default_chatgpt_workspace_id ??
        metadata?.defaultChatgptOrganizationId ??
        metadata?.default_chatgpt_organization_id ??
        metadata?.chatgptWorkspaceId ??
        metadata?.chatgpt_workspace_id ??
        metadata?.organizationId ??
        metadata?.organization_id
    ) ??
    chatgptWorkspaces?.find((workspace) => workspace.isDefault)?.workspaceId ??
    null;
  const normalizedWorkspaces =
    chatgptWorkspaces?.map((workspace) =>
      defaultChatgptWorkspaceId && workspace.workspaceId === defaultChatgptWorkspaceId
        ? { ...workspace, isDefault: true }
        : workspace
    ) ?? null;
  return {
    chatgptWorkspaces: normalizedWorkspaces,
    defaultChatgptWorkspaceId,
  };
}

export function mergeOAuthAccountMetadata(
  baseMetadata: JsonRecord,
  routeConfig: OAuthAccountRouteConfig | null,
  routingState: OAuthAccountRoutingState | null,
  chatgptWorkspaces: OAuthAccountChatgptWorkspace[] | null,
  defaultChatgptWorkspaceId: string | null
): JsonRecord {
  const nextMetadata: JsonRecord = { ...baseMetadata };
  delete nextMetadata.routeConfig;
  delete nextMetadata.routingState;
  delete nextMetadata.compatBaseUrl;
  delete nextMetadata.compat_base_url;
  delete nextMetadata.baseUrl;
  delete nextMetadata.base_url;
  delete nextMetadata.proxyBaseUrl;
  delete nextMetadata.proxy_base_url;
  delete nextMetadata.chatgptWorkspaces;
  delete nextMetadata.chatgpt_workspaces;
  delete nextMetadata.chatgptOrganizations;
  delete nextMetadata.chatgpt_organizations;
  delete nextMetadata.organizations;
  delete nextMetadata.defaultChatgptWorkspaceId;
  delete nextMetadata.default_chatgpt_workspace_id;
  delete nextMetadata.defaultChatgptOrganizationId;
  delete nextMetadata.default_chatgpt_organization_id;

  if (routeConfig) {
    const routeMetadata: JsonRecord = {};
    if (routeConfig.compatBaseUrl) {
      routeMetadata.compatBaseUrl = routeConfig.compatBaseUrl;
      nextMetadata.compatBaseUrl = routeConfig.compatBaseUrl;
    }
    if (routeConfig.proxyId) {
      routeMetadata.proxyId = routeConfig.proxyId;
    }
    if (routeConfig.priority !== null && routeConfig.priority !== undefined) {
      routeMetadata.priority = routeConfig.priority;
    }
    if (routeConfig.concurrencyLimit !== null && routeConfig.concurrencyLimit !== undefined) {
      routeMetadata.concurrencyLimit = routeConfig.concurrencyLimit;
    }
    if (routeConfig.schedulable !== null && routeConfig.schedulable !== undefined) {
      routeMetadata.schedulable = routeConfig.schedulable;
    }
    if (Object.keys(routeMetadata).length > 0) {
      nextMetadata.routeConfig = routeMetadata;
    }
  }

  if (routingState) {
    const routingMetadata: JsonRecord = {};
    if (routingState.credentialReady !== null && routingState.credentialReady !== undefined) {
      routingMetadata.credentialReady = routingState.credentialReady;
    }
    if (routingState.lastRoutingError) {
      routingMetadata.lastRoutingError = routingState.lastRoutingError;
    }
    if (routingState.rateLimitedUntil !== null && routingState.rateLimitedUntil !== undefined) {
      routingMetadata.rateLimitedUntil = routingState.rateLimitedUntil;
    }
    if (routingState.overloadedUntil !== null && routingState.overloadedUntil !== undefined) {
      routingMetadata.overloadedUntil = routingState.overloadedUntil;
    }
    if (
      routingState.tempUnschedulableUntil !== null &&
      routingState.tempUnschedulableUntil !== undefined
    ) {
      routingMetadata.tempUnschedulableUntil = routingState.tempUnschedulableUntil;
    }
    if (routingState.tempUnschedulableReason) {
      routingMetadata.tempUnschedulableReason = routingState.tempUnschedulableReason;
    }
    if (Object.keys(routingMetadata).length > 0) {
      nextMetadata.routingState = routingMetadata;
    }
  }

  if (chatgptWorkspaces && chatgptWorkspaces.length > 0) {
    nextMetadata.chatgptWorkspaces = chatgptWorkspaces.map((workspace) => ({
      workspaceId: workspace.workspaceId,
      title: workspace.title,
      role: workspace.role,
      isDefault:
        defaultChatgptWorkspaceId !== null
          ? workspace.workspaceId === defaultChatgptWorkspaceId
          : workspace.isDefault,
    }));
  }
  if (defaultChatgptWorkspaceId) {
    nextMetadata.defaultChatgptWorkspaceId = defaultChatgptWorkspaceId;
  }

  return nextMetadata;
}

export function normalizeOAuthAccountSummary(account: OAuthAccountSummary): OAuthAccountSummary {
  const metadata = isRecord(account.metadata) ? { ...account.metadata } : {};
  const routeConfig = normalizeOAuthAccountRouteConfig(account.routeConfig, metadata);
  const routingState = normalizeOAuthAccountRoutingState(account.routingState, metadata);
  const { chatgptWorkspaces, defaultChatgptWorkspaceId } =
    normalizeOAuthAccountChatgptWorkspaceState(account, metadata);
  return {
    ...account,
    routeConfig,
    routingState,
    chatgptWorkspaces,
    defaultChatgptWorkspaceId,
    metadata: mergeOAuthAccountMetadata(
      metadata,
      routeConfig,
      routingState,
      chatgptWorkspaces,
      defaultChatgptWorkspaceId
    ),
  };
}

export function cloneMockOAuthAccount(account: OAuthAccountSummary): OAuthAccountSummary {
  return normalizeOAuthAccountSummary(account);
}

export function cloneMockOAuthPool(pool: OAuthPoolSummary): OAuthPoolSummary {
  return {
    ...pool,
    metadata: isRecord(pool.metadata) ? { ...pool.metadata } : {},
  };
}

export function cloneMockOAuthPoolMembersByPoolId(
  poolMembersByPoolId: Record<string, OAuthPoolMember[]>
): Record<string, OAuthPoolMember[]> {
  return Object.fromEntries(
    Object.entries(poolMembersByPoolId).map(([poolId, members]) => [
      poolId,
      members.map((member) => ({ ...member })),
    ])
  );
}

export function buildMockProjectWorkspaceBindingKey(
  poolId: string,
  sessionId: string,
  chatgptWorkspaceId: string | null
): string {
  return `${poolId}::${sessionId}::${chatgptWorkspaceId ?? ""}`;
}
