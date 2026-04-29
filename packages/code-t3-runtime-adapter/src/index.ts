import type {
  AccessMode,
  AgentTaskExecutionMode,
  AgentTaskSourceSummary,
  AgentTaskStartRequest,
  AgentTaskStepInput,
  ModelPoolEntry,
  ModelProvider,
  ReasonEffort,
  RuntimeBackendSummary,
} from "@ku0/code-runtime-host-contract";
import type {
  HugeRouterCommercialServiceSnapshot,
  HugeRouterRouteTokenIssueRequest,
  HugeRouterRouteTokenIssueResponse,
} from "@ku0/code-runtime-host-contract/codeRuntimeRpc";

export type T3CodeProviderKind = "codex" | "claudeAgent";

export type T3CodeProviderAuthState = "authenticated" | "unauthenticated" | "unknown";

export type T3CodeProviderRouteStatus = "ready" | "attention" | "blocked" | "unknown";

export type T3CodexExecutionTarget = "embedded_app_server" | "local_cli";

export type T3GatewayProfileKind = "hugerouter_commercial" | "custom_gateway";

export type T3GatewayWireApi = "responses";

export type T3GatewayAuthMode = "env_api_key";

export type T3HugerouterCapacitySource =
  | "hugerouter_native_credits"
  | "provider_authorized_pool"
  | "merchant_relay_listing";

export type T3HugerouterCommercialServiceInput = {
  capacitySource: T3HugerouterCapacitySource;
  commercialServiceEnabled?: boolean | null;
  planId?: string | null;
  projectId?: string | null;
  routeReceiptRequired?: boolean | null;
  tenantId?: string | null;
};

export type T3CodexGatewayProviderProfileInput = {
  apiKey: string;
  apiKeyEnvKey?: string | null;
  baseUrl: string;
  displayName?: string | null;
  executionTarget?: T3CodexExecutionTarget | null;
  modelAlias: string;
  profileKind?: T3GatewayProfileKind | null;
  providerId?: string | null;
  commercial?: T3HugerouterCommercialServiceInput | null;
};

export type T3HugerouterCommercialServiceProfile = {
  capacitySource: T3HugerouterCapacitySource;
  commercialServiceEnabled: boolean;
  planId: string | null;
  projectId: string | null;
  routeReceiptRequired: boolean;
  tenantId: string | null;
};

export type T3CodexGatewayProviderProfile = {
  apiKeyEnvKey: string;
  authMode: T3GatewayAuthMode;
  baseUrl: string;
  commercial: T3HugerouterCommercialServiceProfile | null;
  configToml: string;
  displayName: string;
  environment: Record<string, string>;
  executionTarget: T3CodexExecutionTarget;
  modelAlias: string;
  profileKind: T3GatewayProfileKind;
  providerId: string;
  wireApi: T3GatewayWireApi;
};

export type T3CodeProviderModel = {
  available: boolean;
  capabilities: string[];
  name: string;
  reasoningEfforts: ReasonEffort[];
  runtimeProvider: ModelProvider;
  shortName?: string;
  slug: string;
  source: string;
  subProvider?: string;
  supportsReasoning: boolean;
  supportsVision: boolean;
};

export type T3CodeServerProviderModel = {
  capabilities: {
    optionDescriptors: Array<{
      id: string;
      label: string;
      options: Array<{
        id: string;
        isDefault?: boolean;
        label: string;
      }>;
      type: "select";
    }>;
  };
  isCustom: boolean;
  name: string;
  runtimeProvider?: ModelProvider;
  shortName?: string;
  slug: string;
  subProvider?: string;
};

export type T3CodeServerProvider = {
  auth: {
    status: T3CodeProviderAuthState;
  };
  checkedAt: string;
  displayName: string;
  enabled: boolean;
  installed: boolean;
  models: T3CodeServerProviderModel[];
  provider: T3CodeProviderKind;
  showInteractionModeToggle: boolean;
  skills: [];
  slashCommands: [];
  status: T3CodeProviderRouteStatus;
  version: string | null;
};

export type T3CodeProviderModelOption = {
  name: string;
  runtimeProvider?: ModelProvider;
  shortName?: string;
  slug: string;
  subProvider?: string;
};

export type T3CodeProviderModelOptionsByProvider = Record<
  T3CodeProviderKind,
  T3CodeProviderModelOption[]
>;

export type T3CodeProviderCatalog = {
  checkedAt: string;
  modelOptionsByProvider: T3CodeProviderModelOptionsByProvider;
  routes: T3CodeProviderRoute[];
  serverProviders: T3CodeServerProvider[];
};

export type T3CodeProviderRoute = {
  provider: T3CodeProviderKind;
  providerLabel: string;
  modelId: string | null;
  models: T3CodeProviderModel[];
  backendId: string;
  backendLabel: string;
  preferredBackendIds: string[];
  status: T3CodeProviderRouteStatus;
  authState: T3CodeProviderAuthState;
  installed: boolean;
  capabilities: string[];
  summary: string;
  reasons: string[];
};

export type T3CodeProviderSelection = {
  provider: T3CodeProviderKind;
  modelId?: string | null;
  backendId?: string | null;
};

export type T3CodeThreadLaunchInput = {
  workspaceId: string;
  threadId?: string | null;
  requestId?: string;
  prompt: string;
  title?: string | null;
  selection: T3CodeProviderSelection;
  accessMode?: AccessMode;
  executionMode?: AgentTaskExecutionMode;
  reasonEffort?: ReasonEffort | null;
  taskSource?: AgentTaskSourceSummary | null;
};

export type HugeCodeRuntimeBridge = {
  listBackends(): Promise<RuntimeBackendSummary[]>;
  listModels(): Promise<ModelPoolEntry[]>;
  readHugeRouterCommercialService?(): Promise<HugeRouterCommercialServiceSnapshot | null>;
  issueHugeRouterRouteToken?(
    request?: HugeRouterRouteTokenIssueRequest
  ): Promise<HugeRouterRouteTokenIssueResponse>;
  startAgentTask(request: AgentTaskStartRequest): Promise<unknown>;
  interruptTurn(turnId: string | null, reason?: string | null): Promise<unknown>;
  approveRequest(requestId: string, approved: boolean): Promise<unknown>;
};

export type T3CodeTimelineEventKind =
  | "assistant.delta"
  | "approval.requested"
  | "approval.resolved"
  | "task.started"
  | "task.completed"
  | "task.failed"
  | "status";

export type T3CodeTimelineEvent = {
  id: string;
  kind: T3CodeTimelineEventKind;
  title: string;
  body?: string;
  createdAt: number;
  source: "hugecode-runtime";
  raw: unknown;
};

const PROVIDER_LABELS = {
  codex: "Codex CLI",
  claudeAgent: "Claude Code CLI",
} as const satisfies Record<T3CodeProviderKind, string>;

const PROVIDER_CAPABILITY_MARKERS = {
  codex: ["codex", "openai", "gpt"],
  claudeAgent: ["claude", "anthropic"],
} as const satisfies Record<T3CodeProviderKind, readonly string[]>;

const DEFAULT_CODEX_GATEWAY_PROVIDER_ID = "hugerouter";
const DEFAULT_CODEX_GATEWAY_DISPLAY_NAME = "HugeRouter";
const DEFAULT_CODEX_GATEWAY_API_KEY_ENV = "HUGEROUTER_ROUTE_TOKEN";
const DEFAULT_CODEX_GATEWAY_MODEL_ALIAS = "agent-coding-default";
const CODEX_GATEWAY_WIRE_API: T3GatewayWireApi = "responses";

function nowMs() {
  return Date.now();
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function requiredText(value: string, fieldName: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new Error(`${fieldName} is required.`);
  }
  return trimmed;
}

function optionalText(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function tomlString(value: string): string {
  return JSON.stringify(value);
}

function normalizeCodexProviderId(value: string | null | undefined): string {
  const providerId = optionalText(value) ?? DEFAULT_CODEX_GATEWAY_PROVIDER_ID;
  if (!/^[a-z][a-z0-9_-]*$/u.test(providerId)) {
    throw new Error("providerId must use lowercase letters, numbers, underscores, or hyphens.");
  }
  return providerId;
}

function normalizeApiKeyEnvKey(value: string | null | undefined): string {
  const envKey = optionalText(value) ?? DEFAULT_CODEX_GATEWAY_API_KEY_ENV;
  if (!/^[A-Z_][A-Z0-9_]*$/u.test(envKey)) {
    throw new Error("apiKeyEnvKey must be an uppercase environment variable name.");
  }
  return envKey;
}

export function normalizeT3CodexGatewayBaseUrl(baseUrl: string): string {
  const rawBaseUrl = requiredText(baseUrl, "baseUrl");
  let url: URL;
  try {
    url = new URL(rawBaseUrl);
  } catch {
    throw new Error("baseUrl must be an absolute http(s) URL.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("baseUrl must use http or https.");
  }

  const normalizedPath = url.pathname.replace(/\/+$/u, "");
  if (/\/(?:responses|chat\/completions)$/u.test(normalizedPath)) {
    throw new Error("baseUrl must point at the gateway /v1 root, not an operation endpoint.");
  }

  url.pathname = normalizedPath.length > 0 ? normalizedPath : "/";
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/u, "");
}

function normalizeCommercialServiceProfile(
  input: T3HugerouterCommercialServiceInput | null | undefined,
  profileKind: T3GatewayProfileKind
): T3HugerouterCommercialServiceProfile | null {
  if (profileKind !== "hugerouter_commercial") {
    return null;
  }
  const capacitySource = input?.capacitySource ?? "hugerouter_native_credits";
  return {
    capacitySource,
    commercialServiceEnabled: input?.commercialServiceEnabled ?? true,
    planId: optionalText(input?.planId) ?? null,
    projectId: optionalText(input?.projectId) ?? null,
    routeReceiptRequired: input?.routeReceiptRequired ?? true,
    tenantId: optionalText(input?.tenantId) ?? null,
  };
}

function buildCodexGatewayConfigToml(input: {
  baseUrl: string;
  displayName: string;
  modelAlias: string;
  providerId: string;
  apiKeyEnvKey: string;
}) {
  return [
    `model = ${tomlString(input.modelAlias)}`,
    `model_provider = ${tomlString(input.providerId)}`,
    "disable_response_storage = true",
    "",
    `[model_providers.${input.providerId}]`,
    `name = ${tomlString(input.displayName)}`,
    `base_url = ${tomlString(input.baseUrl)}`,
    `env_key = ${tomlString(input.apiKeyEnvKey)}`,
    `wire_api = ${tomlString(CODEX_GATEWAY_WIRE_API)}`,
    "",
  ].join("\n");
}

export function buildT3CodexGatewayProviderProfile(
  input: T3CodexGatewayProviderProfileInput
): T3CodexGatewayProviderProfile {
  const profileKind = input.profileKind ?? "hugerouter_commercial";
  const providerId = normalizeCodexProviderId(input.providerId);
  const displayName =
    optionalText(input.displayName) ??
    (profileKind === "hugerouter_commercial"
      ? DEFAULT_CODEX_GATEWAY_DISPLAY_NAME
      : "Custom Gateway");
  const modelAlias = requiredText(input.modelAlias, "modelAlias");
  const apiKey = requiredText(input.apiKey, "apiKey");
  const apiKeyEnvKey = normalizeApiKeyEnvKey(input.apiKeyEnvKey);
  const baseUrl = normalizeT3CodexGatewayBaseUrl(input.baseUrl);
  const executionTarget = input.executionTarget ?? "embedded_app_server";
  const commercial = normalizeCommercialServiceProfile(input.commercial, profileKind);

  return {
    apiKeyEnvKey,
    authMode: "env_api_key",
    baseUrl,
    commercial,
    configToml: buildCodexGatewayConfigToml({
      apiKeyEnvKey,
      baseUrl,
      displayName,
      modelAlias,
      providerId,
    }),
    displayName,
    environment: {
      [apiKeyEnvKey]: apiKey,
    },
    executionTarget,
    modelAlias,
    profileKind,
    providerId,
    wireApi: CODEX_GATEWAY_WIRE_API,
  };
}

function asStringList(value: readonly string[] | null | undefined): string[] {
  if (!value) {
    return [];
  }
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of value) {
    const trimmed = item.trim();
    if (trimmed.length === 0 || seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}

function isNoisyRuntimeStatusKind(kind: string | null): boolean {
  return (
    kind === "runtime.updated" ||
    kind === "runtime.status" ||
    kind === "server-config-updated" ||
    kind === "server-providers-updated"
  );
}

function statusFromBackend(backend: RuntimeBackendSummary): T3CodeProviderRouteStatus {
  const readiness = backend.readiness?.state;
  const operability = backend.operability?.state;
  if (
    backend.status === "disabled" ||
    readiness === "blocked" ||
    operability === "blocked" ||
    !backend.healthy
  ) {
    return "blocked";
  }
  if (
    backend.status === "draining" ||
    readiness === "attention" ||
    readiness === "unknown" ||
    operability === "attention" ||
    backend.diagnostics?.degraded
  ) {
    return "attention";
  }
  if (backend.status === "active") {
    return "ready";
  }
  return "unknown";
}

function authStateFromBackend(backend: RuntimeBackendSummary): T3CodeProviderAuthState {
  const authState = backend.readiness?.authState;
  if (authState === "verified") {
    return "authenticated";
  }
  if (authState === "missing" || authState === "failed") {
    return "unauthenticated";
  }
  return "unknown";
}

function backendLooksLikeProvider(
  backend: Pick<RuntimeBackendSummary, "backendId" | "displayName" | "capabilities">,
  provider: T3CodeProviderKind
) {
  const markers = PROVIDER_CAPABILITY_MARKERS[provider];
  const searchable = [backend.backendId, backend.displayName, ...backend.capabilities]
    .join(" ")
    .toLowerCase();
  return markers.some((marker) => searchable.includes(marker));
}

function inferProviderFromBackend(backend: RuntimeBackendSummary): T3CodeProviderKind | null {
  if (backendLooksLikeProvider(backend, "codex")) {
    return "codex";
  }
  if (backendLooksLikeProvider(backend, "claudeAgent")) {
    return "claudeAgent";
  }
  return null;
}

function providerModelFallback(provider: T3CodeProviderKind) {
  return provider === "codex" ? "gpt-5.3-codex" : "claude-sonnet-4-5";
}

const FALLBACK_PROVIDER_MODELS = {
  codex: [
    {
      slug: "gpt-5.4",
      name: "GPT-5.4",
      shortName: "GPT-5.4",
      subProvider: "OpenAI",
    },
    {
      slug: "gpt-5.3-codex",
      name: "GPT-5.3 Codex",
      shortName: "Codex",
      subProvider: "OpenAI",
    },
  ],
  claudeAgent: [
    {
      slug: "claude-sonnet-4-5",
      name: "Claude Sonnet 4.5",
      shortName: "Sonnet 4.5",
      subProvider: "Anthropic",
    },
    {
      slug: "claude-opus-4-6",
      name: "Claude Opus 4.6",
      shortName: "Opus 4.6",
      subProvider: "Anthropic",
    },
  ],
} as const satisfies Record<
  T3CodeProviderKind,
  ReadonlyArray<Pick<T3CodeProviderModel, "name" | "shortName" | "slug" | "subProvider">>
>;

function fallbackProviderModels(provider: T3CodeProviderKind): T3CodeProviderModel[] {
  return FALLBACK_PROVIDER_MODELS[provider].map((model) => ({
    ...model,
    available: true,
    capabilities: ["chat", "coding", "reasoning"],
    reasoningEfforts: ["medium", "high", "xhigh"],
    runtimeProvider: provider === "codex" ? "openai" : "anthropic",
    source: "fallback",
    supportsReasoning: true,
    supportsVision: provider === "codex",
  }));
}

function inferProviderFromModelEntry(model: ModelPoolEntry): T3CodeProviderKind | null {
  const searchable = [model.id, model.displayName, model.provider, model.pool, model.source]
    .join(" ")
    .toLowerCase();
  if (
    model.pool === "codex" ||
    model.provider === "openai" ||
    searchable.includes("codex") ||
    searchable.includes("gpt")
  ) {
    return "codex";
  }
  if (
    model.pool === "claude" ||
    model.provider === "anthropic" ||
    model.provider === "claude_code_local" ||
    searchable.includes("claude") ||
    searchable.includes("anthropic")
  ) {
    return "claudeAgent";
  }
  return null;
}

function modelSubProvider(model: ModelPoolEntry, provider: T3CodeProviderKind): string | undefined {
  if (provider === "codex") {
    return model.provider === "openai" ? "OpenAI" : model.provider;
  }
  if (provider === "claudeAgent") {
    return model.provider === "anthropic" || model.provider === "claude_code_local"
      ? "Anthropic"
      : model.provider;
  }
  return undefined;
}

function modelShortName(displayName: string, slug: string): string {
  const normalized = displayName.trim() || slug;
  return normalized
    .replace(/^OpenAI\s+/iu, "")
    .replace(/^Anthropic\s+/iu, "")
    .replace(/^Claude\s+/iu, "Claude ")
    .trim();
}

function modelProviderPriority(model: T3CodeProviderModel): number {
  if (model.available) {
    return 40;
  }
  if (model.runtimeProvider === "claude_code_local") {
    return 30;
  }
  if (model.runtimeProvider === "anthropic") {
    return 20;
  }
  if (model.source !== "fallback") {
    return 10;
  }
  return 0;
}

function shouldReplaceModelOption(
  current: T3CodeProviderModel,
  candidate: T3CodeProviderModel
): boolean {
  return modelProviderPriority(candidate) > modelProviderPriority(current);
}

export function mapHugeCodeModelPoolToT3ProviderModels(
  models: readonly ModelPoolEntry[]
): Record<T3CodeProviderKind, T3CodeProviderModel[]> {
  const grouped: Record<T3CodeProviderKind, T3CodeProviderModel[]> = {
    codex: [],
    claudeAgent: [],
  };
  for (const model of models) {
    const provider = inferProviderFromModelEntry(model);
    if (!provider) {
      continue;
    }
    const candidate = {
      available: model.available,
      capabilities: asStringList(model.capabilities),
      name: model.displayName.trim() || model.id,
      reasoningEfforts: asStringList(model.reasoningEfforts) as ReasonEffort[],
      runtimeProvider: model.provider,
      shortName: modelShortName(model.displayName, model.id),
      slug: model.id,
      source: model.source,
      subProvider: modelSubProvider(model, provider),
      supportsReasoning: model.supportsReasoning,
      supportsVision: model.supportsVision,
    };
    const existingIndex = grouped[provider].findIndex((item) => item.slug === candidate.slug);
    if (existingIndex === -1) {
      grouped[provider].push(candidate);
    } else if (shouldReplaceModelOption(grouped[provider][existingIndex], candidate)) {
      grouped[provider][existingIndex] = candidate;
    }
  }
  for (const provider of providerKeys) {
    if (grouped[provider].length === 0) {
      grouped[provider] = fallbackProviderModels(provider);
    }
  }
  return grouped;
}

function summarizeBackend(backend: RuntimeBackendSummary, status: T3CodeProviderRouteStatus) {
  if (backend.operability?.summary) {
    return backend.operability.summary;
  }
  if (backend.readiness?.summary) {
    return backend.readiness.summary;
  }
  if (backend.diagnostics?.summary) {
    return backend.diagnostics.summary;
  }
  if (status === "ready") {
    return `${backend.displayName} is ready for local CLI execution.`;
  }
  return `${backend.displayName} is not fully ready for local CLI execution.`;
}

const providerKeys: T3CodeProviderKind[] = ["codex", "claudeAgent"];

export function mapHugeCodeBackendToT3ProviderRoute(
  backend: RuntimeBackendSummary,
  modelOptionsByProvider: Partial<Record<T3CodeProviderKind, readonly T3CodeProviderModel[]>> = {}
): T3CodeProviderRoute | null {
  const provider = inferProviderFromBackend(backend);
  if (!provider) {
    return null;
  }
  const status = statusFromBackend(backend);
  const models = [...(modelOptionsByProvider[provider] ?? fallbackProviderModels(provider))];
  const defaultModel =
    models.find((model) => model.available)?.slug ??
    models[0]?.slug ??
    providerModelFallback(provider);
  const reasons = [
    ...(backend.operability?.reasons ?? []),
    ...(backend.readiness?.reasons ?? []),
    ...(backend.diagnostics?.reasons ?? []),
  ];
  return {
    provider,
    providerLabel: PROVIDER_LABELS[provider],
    modelId: defaultModel,
    models,
    backendId: backend.backendId,
    backendLabel: backend.displayName,
    preferredBackendIds: [backend.backendId],
    status,
    authState: authStateFromBackend(backend),
    installed: status !== "blocked" || !reasons.includes("command_missing"),
    capabilities: asStringList(backend.capabilities),
    summary: summarizeBackend(backend, status),
    reasons: asStringList(reasons),
  };
}

export function mapHugeCodeBackendPoolToT3ProviderRoutes(
  backends: readonly RuntimeBackendSummary[],
  models: readonly ModelPoolEntry[] = []
): T3CodeProviderRoute[] {
  const modelOptionsByProvider = mapHugeCodeModelPoolToT3ProviderModels(models);
  const modelProviders = new Set(
    models
      .map((model) => inferProviderFromModelEntry(model))
      .filter((provider): provider is T3CodeProviderKind => provider !== null)
  );
  const routes = backends
    .map((backend) => mapHugeCodeBackendToT3ProviderRoute(backend, modelOptionsByProvider))
    .filter((route): route is T3CodeProviderRoute => route !== null);
  for (const provider of providerKeys) {
    if (!routes.some((route) => route.provider === provider) && modelProviders.has(provider)) {
      routes.push(mapT3ProviderModelsToRoute(provider, modelOptionsByProvider[provider]));
    }
  }
  return routes.sort((left, right) => {
    const statusRank = { ready: 0, attention: 1, unknown: 2, blocked: 3 };
    return (
      statusRank[left.status] - statusRank[right.status] ||
      left.providerLabel.localeCompare(right.providerLabel) ||
      left.backendLabel.localeCompare(right.backendLabel)
    );
  });
}

function mapT3ProviderModelsToRoute(
  provider: T3CodeProviderKind,
  models: readonly T3CodeProviderModel[]
): T3CodeProviderRoute {
  const available = models.some((model) => model.available);
  const localClaude =
    provider === "claudeAgent" &&
    models.some((model) => model.runtimeProvider === "claude_code_local");
  const status: T3CodeProviderRouteStatus =
    localClaude && available ? "ready" : available ? "attention" : "blocked";
  const defaultModel =
    models.find((model) => model.available)?.slug ??
    models[0]?.slug ??
    providerModelFallback(provider);
  return {
    provider,
    providerLabel: PROVIDER_LABELS[provider],
    modelId: defaultModel,
    models: [...models],
    backendId: localClaude ? "local-claude-code-cli" : `model-pool-${provider}`,
    backendLabel: localClaude ? "Local Claude Code CLI" : `${PROVIDER_LABELS[provider]} model pool`,
    preferredBackendIds: [],
    status,
    authState:
      localClaude && available ? "authenticated" : available ? "unknown" : "unauthenticated",
    installed: localClaude,
    capabilities: provider === "codex" ? ["codex", "code"] : ["claude", "code"],
    summary:
      localClaude && available
        ? "Local Claude Code CLI is configured and ready for local execution."
        : available
          ? `${PROVIDER_LABELS[provider]} has model pool entries but no active execution backend.`
          : localClaude
            ? "Local Claude Code CLI is installed but not authenticated. Run `claude` to sign in."
            : `${PROVIDER_LABELS[provider]} is not authenticated.`,
    reasons:
      localClaude && available
        ? ["local_claude_ready"]
        : available
          ? ["backend_missing"]
          : ["not_authenticated"],
  };
}

export function createT3CodexGatewayProviderRoute(
  profile: T3CodexGatewayProviderProfile
): T3CodeProviderRoute {
  const model: T3CodeProviderModel = {
    available: true,
    capabilities: [
      "chat",
      "coding",
      "reasoning",
      profile.profileKind === "hugerouter_commercial" ? "hugerouter-commercial" : "gateway",
    ],
    name: profile.modelAlias,
    reasoningEfforts: ["medium", "high", "xhigh"],
    runtimeProvider: "openai",
    shortName: profile.modelAlias,
    slug: profile.modelAlias,
    source: profile.profileKind,
    subProvider: profile.displayName,
    supportsReasoning: true,
    supportsVision: true,
  };
  const backendId =
    profile.executionTarget === "embedded_app_server"
      ? `codex-app-server-${profile.providerId}`
      : `local-codex-cli-${profile.providerId}`;
  const commercialReasons = profile.commercial
    ? [
        "hugerouter_commercial_service_enabled",
        `capacity_source:${profile.commercial.capacitySource}`,
        ...(profile.commercial.routeReceiptRequired ? ["route_receipt_required"] : []),
      ]
    : ["custom_gateway_profile"];
  return {
    provider: "codex",
    providerLabel: "Codex",
    modelId: profile.modelAlias,
    models: [model],
    backendId,
    backendLabel:
      profile.executionTarget === "embedded_app_server"
        ? `Embedded Codex app-server via ${profile.displayName}`
        : `Local Codex CLI via ${profile.displayName}`,
    preferredBackendIds: [backendId],
    status: "ready",
    authState: "authenticated",
    installed: true,
    capabilities: ["codex", "code", profile.executionTarget, profile.profileKind, profile.wireApi],
    summary:
      profile.profileKind === "hugerouter_commercial"
        ? `${profile.displayName} commercial route is ready for Codex execution.`
        : `${profile.displayName} gateway route is ready for Codex execution.`,
    reasons: commercialReasons,
  };
}

export function mapHugeRouterCommercialSnapshotToT3ProviderRoute(
  snapshot: HugeRouterCommercialServiceSnapshot | null
): T3CodeProviderRoute | null {
  if (!snapshot || snapshot.connection.status !== "connected") {
    return null;
  }
  const routeToken = snapshot.routeToken;
  if (!routeToken || (routeToken.status !== "active" && routeToken.status !== "expiring")) {
    return null;
  }
  const routeBaseUrl = optionalText(snapshot.connection.routeBaseUrl);
  if (!routeBaseUrl) {
    return null;
  }
  const plan = snapshot.capacity?.planName ?? snapshot.availablePlans[0]?.name ?? "HugeRouter";
  const modelAlias = DEFAULT_CODEX_GATEWAY_MODEL_ALIAS;
  const projectId = optionalText(snapshot.connection.projectId);
  const tenantId = optionalText(snapshot.connection.tenantId);
  const profile = buildT3CodexGatewayProviderProfile({
    apiKey: "managed-by-hugerouter-route-token",
    apiKeyEnvKey: routeToken.envKey,
    baseUrl: routeBaseUrl,
    commercial: {
      capacitySource:
        snapshot.capacity?.capacityKind === "external_relay"
          ? "provider_authorized_pool"
          : "hugerouter_native_credits",
      planId: snapshot.capacity?.planId ?? null,
      projectId,
      tenantId,
    },
    displayName: "HugeRouter",
    modelAlias,
  });
  const route = createT3CodexGatewayProviderRoute(profile);
  return {
    ...route,
    authState: "authenticated",
    capabilities: [...route.capabilities, "route_token", routeToken.envKey],
    installed: true,
    reasons: [
      ...route.reasons,
      `route_token:${routeToken.status}`,
      ...(snapshot.order?.status ? [`order:${snapshot.order.status}`] : []),
    ],
    status: "ready",
    summary: `${plan} is connected through HugeRouter commercial route token ${routeToken.envKey}.`,
  };
}

function mapRouteModelToServerProviderModel(
  provider: T3CodeProviderKind,
  model: T3CodeProviderModel
): T3CodeServerProviderModel {
  const optionId = provider === "codex" ? "reasoningEffort" : "effort";
  return {
    capabilities: {
      optionDescriptors: model.supportsReasoning
        ? [
            {
              id: optionId,
              label: "Reasoning",
              options: (model.reasoningEfforts.length > 0
                ? model.reasoningEfforts
                : (["medium", "high", "xhigh"] as ReasonEffort[])
              ).map((effort) => ({
                id: effort,
                label: effort,
                ...(effort === "medium" ? { isDefault: true } : {}),
              })),
              type: "select",
            },
          ]
        : [],
    },
    isCustom: model.source !== "fallback" && model.source !== "oauth-account",
    name: model.name,
    runtimeProvider: model.runtimeProvider,
    ...(model.shortName ? { shortName: model.shortName } : {}),
    slug: model.slug,
    ...(model.subProvider ? { subProvider: model.subProvider } : {}),
  };
}

export function mapT3ProviderRoutesToServerProviders(
  routes: readonly T3CodeProviderRoute[],
  checkedAt = new Date().toISOString()
): T3CodeServerProvider[] {
  return routes.map((route) => ({
    auth: {
      status: route.authState,
    },
    checkedAt,
    displayName: route.provider === "codex" ? "Codex" : "Claude",
    enabled: route.status === "ready" || route.status === "attention",
    installed: route.installed,
    models: route.models.map((model) => mapRouteModelToServerProviderModel(route.provider, model)),
    provider: route.provider,
    showInteractionModeToggle: true,
    skills: [],
    slashCommands: [],
    status: route.status,
    version: null,
  }));
}

export function mapT3ServerProvidersToModelOptionsByProvider(
  serverProviders: readonly T3CodeServerProvider[]
): T3CodeProviderModelOptionsByProvider {
  const grouped: T3CodeProviderModelOptionsByProvider = {
    codex: [],
    claudeAgent: [],
  };
  for (const serverProvider of serverProviders) {
    grouped[serverProvider.provider].push(
      ...serverProvider.models.map((model) => ({
        name: model.name,
        ...(model.runtimeProvider ? { runtimeProvider: model.runtimeProvider } : {}),
        ...(model.shortName ? { shortName: model.shortName } : {}),
        slug: model.slug,
        ...(model.subProvider ? { subProvider: model.subProvider } : {}),
      }))
    );
  }
  return grouped;
}

export function buildT3ProviderCatalog(
  backends: readonly RuntimeBackendSummary[],
  models: readonly ModelPoolEntry[] = [],
  checkedAt = new Date().toISOString(),
  options: {
    hugeRouterCommercialService?: HugeRouterCommercialServiceSnapshot | null;
  } = {}
): T3CodeProviderCatalog {
  const hugeRouterRoute = mapHugeRouterCommercialSnapshotToT3ProviderRoute(
    options.hugeRouterCommercialService ?? null
  );
  const routes = [
    ...(hugeRouterRoute ? [hugeRouterRoute] : []),
    ...mapHugeCodeBackendPoolToT3ProviderRoutes(backends, models),
  ];
  const serverProviders = mapT3ProviderRoutesToServerProviders(routes, checkedAt);
  return {
    checkedAt,
    modelOptionsByProvider: mapT3ServerProvidersToModelOptionsByProvider(serverProviders),
    routes,
    serverProviders,
  };
}

export function resolvePreferredBackendIdsForT3Selection(
  selection: T3CodeProviderSelection,
  routes: readonly T3CodeProviderRoute[]
): string[] {
  if (selection.backendId) {
    return [selection.backendId];
  }
  const route = routes.find((candidate) => candidate.provider === selection.provider);
  return route ? [...route.preferredBackendIds] : [];
}

function findRouteForT3Selection(
  selection: T3CodeProviderSelection,
  routes: readonly T3CodeProviderRoute[]
): T3CodeProviderRoute | null {
  if (selection.backendId) {
    return routes.find((candidate) => candidate.backendId === selection.backendId) ?? null;
  }
  return routes.find((candidate) => candidate.provider === selection.provider) ?? null;
}

function t3RouteLooksLikeLocalClaude(route: T3CodeProviderRoute | null): boolean {
  if (!route || route.provider !== "claudeAgent") {
    return false;
  }
  const searchable = [route.backendId, route.backendLabel, ...route.capabilities]
    .join(" ")
    .toLowerCase();
  return (
    searchable.includes("claude_code_local") ||
    searchable.includes("local claude") ||
    searchable.includes("claude code local")
  );
}

export function resolveModelProviderForT3Selection(
  selection: T3CodeProviderSelection,
  routes: readonly T3CodeProviderRoute[]
): ModelProvider {
  if (selection.provider === "codex") {
    return "openai";
  }
  const route = findRouteForT3Selection(selection, routes);
  const selectedModel = route?.models.find((model) => model.slug === selection.modelId);
  if (
    selectedModel?.runtimeProvider === "claude_code_local" ||
    t3RouteLooksLikeLocalClaude(route)
  ) {
    return "claude_code_local";
  }
  return "anthropic";
}

export function buildHugeCodeAgentTaskStartRequest(
  input: T3CodeThreadLaunchInput,
  routes: readonly T3CodeProviderRoute[]
): AgentTaskStartRequest {
  const prompt = input.prompt.trim();
  const title = input.title?.trim() || prompt.slice(0, 80) || "T3 task";
  const preferredBackendIds = resolvePreferredBackendIdsForT3Selection(input.selection, routes);
  const steps: AgentTaskStepInput[] = [
    {
      kind: "read",
      input: prompt,
    },
  ];
  return {
    workspaceId: input.workspaceId,
    threadId: input.threadId ?? null,
    ...(input.requestId ? { requestId: input.requestId } : {}),
    title,
    taskSource: input.taskSource ?? {
      kind: "manual_thread",
      label: "T3 frontend",
      title,
      workspaceId: input.workspaceId,
      threadId: input.threadId ?? null,
    },
    provider: resolveModelProviderForT3Selection(input.selection, routes),
    modelId: input.selection.modelId ?? providerModelFallback(input.selection.provider),
    reasonEffort: input.reasonEffort ?? null,
    accessMode: input.accessMode ?? "on-request",
    executionMode: input.executionMode ?? "single",
    executionProfileId: "runtime-default",
    preferredBackendIds,
    defaultBackendId: preferredBackendIds[0] ?? null,
    requiredCapabilities: [input.selection.provider],
    steps,
  };
}

export function mapHugeCodeRuntimeEventToT3TimelineEvent(
  event: unknown
): T3CodeTimelineEvent | null {
  const record = asRecord(event);
  if (!record) {
    return null;
  }
  const kind = asString(record.kind) ?? asString(record.type) ?? asString(record.event);
  if (isNoisyRuntimeStatusKind(kind)) {
    return null;
  }
  const payload = asRecord(record.payload) ?? record;
  const baseId =
    asString(record.id) ??
    asString(payload.eventId) ??
    asString(payload.turnId) ??
    `hugecode-event-${nowMs()}`;
  const id = kind ? `${kind}:${baseId}` : baseId;
  const createdAt =
    typeof payload.createdAt === "number"
      ? payload.createdAt
      : typeof payload.updatedAt === "number"
        ? payload.updatedAt
        : typeof record.emittedAt === "string"
          ? Date.parse(record.emittedAt)
          : nowMs();

  if (kind === "item.agentMessage.delta" || kind === "turn.delta") {
    const body = asString(payload.delta) ?? asString(payload.text) ?? "";
    return {
      id,
      kind: "assistant.delta",
      title: "Assistant",
      body,
      createdAt,
      source: "hugecode-runtime",
      raw: event,
    };
  }
  if (kind === "approval.required" || kind === "request.opened") {
    return {
      id,
      kind: "approval.requested",
      title: "Approval requested",
      body: asString(payload.message) ?? asString(payload.summary) ?? undefined,
      createdAt,
      source: "hugecode-runtime",
      raw: event,
    };
  }
  if (kind === "approval.resolved" || kind === "request.resolved") {
    return {
      id,
      kind: "approval.resolved",
      title: "Approval resolved",
      body: asString(payload.status) ?? undefined,
      createdAt,
      source: "hugecode-runtime",
      raw: event,
    };
  }
  if (kind === "turn.started" || kind === "task.started") {
    return {
      id,
      kind: "task.started",
      title: "Task started",
      body: asString(payload.title) ?? undefined,
      createdAt,
      source: "hugecode-runtime",
      raw: event,
    };
  }
  if (kind === "turn.completed" || kind === "task.completed") {
    return {
      id,
      kind: "task.completed",
      title: "Task completed",
      body: asString(payload.output) ?? asString(payload.message) ?? undefined,
      createdAt,
      source: "hugecode-runtime",
      raw: event,
    };
  }
  if (kind === "turn.failed" || kind === "task.failed") {
    const error = asRecord(payload.error);
    return {
      id,
      kind: "task.failed",
      title: "Task failed",
      body: asString(error?.message) ?? asString(payload.message) ?? undefined,
      createdAt,
      source: "hugecode-runtime",
      raw: event,
    };
  }
  return {
    id,
    kind: "status",
    title: kind ?? "Runtime event",
    body: asString(payload.message) ?? asString(payload.summary) ?? undefined,
    createdAt,
    source: "hugecode-runtime",
    raw: event,
  };
}

export async function refreshT3ProviderRoutes(
  bridge: Pick<
    HugeCodeRuntimeBridge,
    "listBackends" | "listModels" | "readHugeRouterCommercialService"
  >
): Promise<T3CodeProviderRoute[]> {
  const [backends, models, hugeRouterCommercialService] = await Promise.all([
    bridge.listBackends(),
    bridge.listModels(),
    bridge.readHugeRouterCommercialService?.() ?? Promise.resolve(null),
  ]);
  return buildT3ProviderCatalog(backends, models, undefined, {
    hugeRouterCommercialService,
  }).routes;
}

export async function refreshT3ProviderCatalog(
  bridge: Pick<
    HugeCodeRuntimeBridge,
    "listBackends" | "listModels" | "readHugeRouterCommercialService"
  >
): Promise<T3CodeProviderCatalog> {
  const [backends, models, hugeRouterCommercialService] = await Promise.all([
    bridge.listBackends(),
    bridge.listModels(),
    bridge.readHugeRouterCommercialService?.() ?? Promise.resolve(null),
  ]);
  return buildT3ProviderCatalog(backends, models, undefined, {
    hugeRouterCommercialService,
  });
}
