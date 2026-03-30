import type { RuntimeProviderCapabilityMatrix } from "../codeRuntimeRpc.js";
export type PromptLibraryScope = "global" | "workspace";

export type PromptLibraryEntry = {
  id: string;
  title: string;
  description: string;
  content: string;
  scope: PromptLibraryScope;
};

export type OAuthProviderId = "codex" | "gemini" | "claude_code";

export type CanonicalModelProvider =
  | "openai"
  | "anthropic"
  | "claude_code_local"
  | "google"
  | "local"
  | "unknown";

export type CanonicalModelPool = "codex" | "claude" | "gemini" | "auto";

export type RuntimeProviderReadinessKind =
  | "ready"
  | "not_installed"
  | "not_authenticated"
  | "unsupported_platform"
  | "degraded";

export type RuntimeProviderExecutionKind = "local" | "cloud";

export type RuntimeProviderCatalogEntry = {
  providerId: CanonicalModelProvider | (string & {});
  displayName: string;
  pool: CanonicalModelPool | (string & {}) | null;
  oauthProviderId: OAuthProviderId | null;
  aliases: string[];
  defaultModelId: string | null;
  available: boolean;
  supportsNative: boolean;
  supportsOpenaiCompat: boolean;
  readinessKind?: RuntimeProviderReadinessKind | null;
  readinessMessage?: string | null;
  executionKind?: RuntimeProviderExecutionKind | null;
  registryVersion?: string | null;
  capabilityMatrix?: RuntimeProviderCapabilityMatrix | null;
};

export type OAuthAccountStatus = "enabled" | "disabled" | "forbidden" | "validation_blocked";

export type OAuthPoolStrategy = "round_robin" | "p2c";

export type OAuthStickyMode = "cache_first" | "balance" | "performance_first";
export type OAuthUsageRefreshMode = "auto" | "force" | "off";

export type OAuthAccountRouteConfig = {
  compatBaseUrl?: string | null;
  proxyId?: string | null;
  priority?: number | null;
  concurrencyLimit?: number | null;
  schedulable?: boolean | null;
};

export type OAuthAccountChatgptWorkspace = {
  workspaceId: string;
  title?: string | null;
  role?: string | null;
  isDefault: boolean;
};

export type OAuthAccountRoutingState = {
  credentialReady?: boolean | null;
  lastRoutingError?: string | null;
  rateLimitedUntil?: number | null;
  overloadedUntil?: number | null;
  tempUnschedulableUntil?: number | null;
  tempUnschedulableReason?: string | null;
};

export type OAuthAccountSummary = {
  accountId: string;
  provider: OAuthProviderId;
  externalAccountId: string | null;
  email: string | null;
  displayName: string | null;
  status: OAuthAccountStatus;
  disabledReason: string | null;
  routeConfig?: OAuthAccountRouteConfig | null;
  routingState?: OAuthAccountRoutingState | null;
  chatgptWorkspaces?: OAuthAccountChatgptWorkspace[] | null;
  defaultChatgptWorkspaceId?: string | null;
  metadata: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
};

export type OAuthAccountUpsertInput = {
  accountId: string;
  provider: OAuthProviderId;
  externalAccountId?: string | null;
  email?: string | null;
  displayName?: string | null;
  status?: OAuthAccountStatus;
  disabledReason?: string | null;
  routeConfig?: OAuthAccountRouteConfig | null;
  routingState?: OAuthAccountRoutingState | null;
  chatgptWorkspaces?: OAuthAccountChatgptWorkspace[] | null;
  defaultChatgptWorkspaceId?: string | null;
  metadata?: Record<string, unknown>;
};

export type OAuthPrimaryAccountSummary = {
  provider: OAuthProviderId;
  accountId: string | null;
  account: OAuthAccountSummary | null;
  defaultPoolId: string;
  routeAccountId: string | null;
  inSync: boolean;
  createdAt: number;
  updatedAt: number;
};

export type OAuthPrimaryAccountSetInput = {
  provider: OAuthProviderId;
  accountId: string | null;
};

export type OAuthPoolSummary = {
  poolId: string;
  provider: OAuthProviderId;
  name: string;
  strategy: OAuthPoolStrategy;
  stickyMode: OAuthStickyMode;
  preferredAccountId: string | null;
  enabled: boolean;
  metadata: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
};

export type OAuthPoolUpsertInput = {
  poolId: string;
  provider: OAuthProviderId;
  name: string;
  strategy?: OAuthPoolStrategy;
  stickyMode?: OAuthStickyMode;
  preferredAccountId?: string | null;
  enabled?: boolean;
  metadata?: Record<string, unknown>;
};

export type OAuthPoolMember = {
  poolId: string;
  accountId: string;
  weight: number;
  priority: number;
  position: number;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
};

export type OAuthPoolMemberInput = {
  accountId: string;
  weight?: number;
  priority?: number;
  position?: number;
  enabled?: boolean;
};

export type OAuthPoolApplyInput = {
  pool: OAuthPoolUpsertInput;
  members: OAuthPoolMemberInput[];
  expectedUpdatedAt?: number | null;
};

export type OAuthPoolApplyResult = {
  pool: OAuthPoolSummary;
  members: OAuthPoolMember[];
};

export type OAuthPoolSelectionRequest = {
  poolId: string;
  sessionId?: string | null;
  // Canonical selector for ChatGPT/Codex workspace membership.
  chatgptWorkspaceId?: string | null;
  // Legacy compat alias. New callers should use `chatgptWorkspaceId`.
  workspaceId?: string | null;
  modelId?: string | null;
};

export type OAuthPoolSelectionResult = {
  poolId: string;
  account: OAuthAccountSummary;
  reason: string;
};

export type OAuthPoolAccountBindRequest = {
  poolId: string;
  sessionId: string;
  accountId: string;
  // Canonical selector for the target ChatGPT workspace when the caller wants
  // the project-workspace binding to target one specific ChatGPT workspace.
  chatgptWorkspaceId?: string | null;
  // Legacy compat alias. New callers should use `chatgptWorkspaceId`.
  workspaceId?: string | null;
};

export type NativeProvidersSnapshot = {
  providers: RuntimeProviderCatalogEntry[];
  accounts: OAuthAccountSummary[];
  pools: OAuthPoolSummary[];
  poolMembersByPoolId: Record<string, OAuthPoolMember[]>;
};

export type NativeProviderConnectionProbeInput = {
  provider?: OAuthProviderId | null;
  providerId?: string | null;
  poolId?: string | null;
  accountId?: string | null;
  sessionId?: string | null;
  modelId?: string | null;
};

export type NativeProviderConnectionProbeResult = {
  ok: boolean;
  available: boolean;
  provider: OAuthProviderId | (string & {}) | null;
  poolId: string | null;
  accountId: string | null;
  sessionId: string | null;
  modelId: string | null;
  latencyMs: number;
  selection: OAuthPoolSelectionResult | null;
  diagnostics: {
    accounts: number;
    pools: number;
    members: number;
  };
  error: string | null;
  poolMembersByPoolId: Record<string, OAuthPoolMember[]>;
};

export type CliSessionSummary = {
  sessionId: string;
  updatedAt: number;
  path: string;
  startedAt?: number;
  cwd?: string;
  model?: string;
  inputTokens?: number;
  cachedInputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
};

export type OAuthRateLimitReportInput = {
  accountId: string;
  modelId?: string | null;
  success?: boolean;
  retryAfterSec?: number | null;
  resetAt?: number | null;
  errorCode?: string | null;
  errorMessage?: string | null;
};

export type OAuthChatgptAuthTokensRefreshReason = "unauthorized";

export type OAuthChatgptAuthTokensRefreshRequest = {
  reason?: OAuthChatgptAuthTokensRefreshReason | null;
  // Optional runtime session identifier. When present, refresh should prefer
  // the same workspace-aware account binding used by pool selection.
  sessionId?: string | null;
  previousAccountId?: string | null;
  // Canonical selector for the target ChatGPT workspace.
  chatgptWorkspaceId?: string | null;
  // Legacy compat alias. New callers should use `chatgptWorkspaceId`.
  workspaceId?: string | null;
};

export type OAuthChatgptAuthTokensRefreshResponse = {
  accessToken: string;
  chatgptAccountId: string;
  chatgptPlanType: string | null;
  sourceAccountId: string;
};

export type OAuthCodexLoginStartRequest = {
  workspaceId: string;
  forceOAuth?: boolean;
};

export type OAuthCodexLoginStartResponse = {
  loginId: string;
  authUrl: string;
  immediateSuccess?: boolean;
};

export type OAuthCodexLoginCancelRequest = {
  workspaceId: string;
};

export type OAuthCodexLoginCancelResponse = {
  canceled: boolean;
  status?: string | null;
};

export type RuntimeCockpitToolsCodexImportResponse = {
  scanned: number;
  imported: number;
  updated: number;
  skipped: number;
  failed: number;
  sourcePath: string | null;
  message: string | null;
};
