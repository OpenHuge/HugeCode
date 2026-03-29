import { normalizeRuntimeProviderCapabilityMatrix } from "@ku0/code-runtime-client/runtimeCapabilityMatrix";
import type {
  ModelPool,
  ModelProvider,
  OAuthAccountSummary,
  OAuthPoolSummary,
  OAuthProviderId,
  RuntimeProviderCatalogEntry,
  RuntimeProviderExecutionKind,
  RuntimeProviderReadinessKind,
  RuntimeRoutingPluginMetadata,
  RuntimeRoutingPluginProvenance,
} from "@ku0/code-runtime-host-contract";
import {
  buildRuntimeProviderRoutingHealth,
  type RuntimeProviderRoutingHealth,
} from "../facades/runtimeRoutingHealth";
import type { RuntimeKernelPluginDescriptor } from "./runtimeKernelPluginTypes";

export type RuntimeKernelRouteOption = {
  value: string;
  label: string;
  source: RuntimeRoutingPluginProvenance;
  ready: boolean;
  launchAllowed: boolean;
  readiness: RuntimeRoutingPluginMetadata["readiness"];
  detail: string;
  blockingReason: string | null;
  recommendedAction: string;
  fallbackDetail: string | null;
  providerId: ModelProvider | null;
  oauthProviderId: OAuthProviderId | null;
  pool: ModelPool | null;
  defaultModelId: string | null;
  preferredBackendIds: string[] | null;
  resolvedBackendId: string | null;
  healthEntry: RuntimeProviderRoutingHealth | null;
  provenance: {
    source: RuntimeRoutingPluginProvenance;
    catalogProviderId: ModelProvider | null;
    readinessKind: RuntimeProviderReadinessKind | null;
    readinessMessage: RuntimeRoutingPluginMetadata["readinessMessage"];
    executionKind: RuntimeProviderExecutionKind | null;
  };
  plugin: RuntimeKernelPluginDescriptor;
};

export type RuntimeKernelResolvedRoute = RuntimeKernelRouteOption;

function readOptionalText(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function readOptionalStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is string => typeof entry === "string" && entry.length > 0);
}

function normalizeStringArray(value: unknown): string[] | null {
  const normalized = [...new Set(readOptionalStringArray(value))];
  return normalized.length > 0 ? normalized : null;
}

function isRoutingPluginKind(value: unknown): value is RuntimeRoutingPluginMetadata["routeKind"] {
  return (
    value === "provider_family" || value === "backend_placement" || value === "combined_execution"
  );
}

function isRoutingPluginReadiness(
  value: unknown
): value is RuntimeRoutingPluginMetadata["readiness"] {
  return value === "ready" || value === "attention" || value === "blocked";
}

function isRoutingPluginProvenance(
  value: unknown
): value is RuntimeRoutingPluginMetadata["provenance"] {
  return (
    value === "auto" ||
    value === "explicit_route" ||
    value === "model_selection" ||
    value === "backend_preference" ||
    value === "runtime_fallback"
  );
}

export function readRuntimeKernelRoutingPluginMetadata(
  metadata: Record<string, unknown> | null | undefined
): RuntimeRoutingPluginMetadata | null {
  if (!metadata) {
    return null;
  }
  const routeKind = metadata.routeKind;
  const routeValue = readOptionalText(metadata.routeValue);
  const readiness = metadata.readiness;
  if (
    !isRoutingPluginKind(routeKind) ||
    !routeValue ||
    !isRoutingPluginReadiness(readiness) ||
    typeof metadata.launchAllowed !== "boolean"
  ) {
    return null;
  }

  return {
    routeKind,
    routeValue,
    readiness,
    launchAllowed: metadata.launchAllowed,
    detail: readOptionalText(metadata.detail),
    blockingReason: readOptionalText(metadata.blockingReason),
    recommendedAction: readOptionalText(metadata.recommendedAction),
    fallbackDetail: readOptionalText(metadata.fallbackDetail),
    providerId: readOptionalText(metadata.providerId) as ModelProvider | null,
    providerLabel: readOptionalText(metadata.providerLabel),
    oauthProviderId: readOptionalText(metadata.oauthProviderId) as OAuthProviderId | null,
    pool: readOptionalText(metadata.pool) as ModelPool | null,
    defaultModelId: readOptionalText(metadata.defaultModelId),
    provenance: isRoutingPluginProvenance(metadata.provenance) ? metadata.provenance : null,
    preferredBackendIds: normalizeStringArray(metadata.preferredBackendIds),
    resolvedBackendId: readOptionalText(metadata.resolvedBackendId),
    readinessKind: readOptionalText(metadata.readinessKind) as RuntimeProviderReadinessKind | null,
    readinessMessage: readOptionalText(metadata.readinessMessage),
    executionKind: readOptionalText(metadata.executionKind) as RuntimeProviderExecutionKind | null,
    capabilityMatrix:
      metadata.capabilityMatrix === null || metadata.capabilityMatrix === undefined
        ? null
        : normalizeRuntimeProviderCapabilityMatrix(metadata.capabilityMatrix),
    providerAvailable:
      typeof metadata.providerAvailable === "boolean" ? metadata.providerAvailable : null,
    accountsTotal:
      typeof metadata.accountsTotal === "number" && Number.isFinite(metadata.accountsTotal)
        ? metadata.accountsTotal
        : null,
    enabledAccountCount:
      typeof metadata.enabledAccountCount === "number" &&
      Number.isFinite(metadata.enabledAccountCount)
        ? metadata.enabledAccountCount
        : null,
    credentialReadyAccountCount:
      typeof metadata.credentialReadyAccountCount === "number" &&
      Number.isFinite(metadata.credentialReadyAccountCount)
        ? metadata.credentialReadyAccountCount
        : null,
    poolsTotal:
      typeof metadata.poolsTotal === "number" && Number.isFinite(metadata.poolsTotal)
        ? metadata.poolsTotal
        : null,
    enabledPoolCount:
      typeof metadata.enabledPoolCount === "number" && Number.isFinite(metadata.enabledPoolCount)
        ? metadata.enabledPoolCount
        : null,
    poolRoutingReady:
      typeof metadata.poolRoutingReady === "boolean" ? metadata.poolRoutingReady : null,
  };
}

function normalizeRoutingDetail(input: RuntimeRoutingPluginMetadata): string {
  return (
    input.detail ??
    (input.readiness === "ready"
      ? "Selected route is ready for launch."
      : input.readiness === "attention"
        ? "Selected route can launch, but routing needs operator attention."
        : "Selected route is not ready for launch.")
  );
}

function createRuntimeRoutingPluginDescriptor(
  metadata: RuntimeRoutingPluginMetadata
): RuntimeKernelPluginDescriptor {
  const source =
    metadata.routeKind === "provider_family"
      ? "provider_route"
      : metadata.routeKind === "backend_placement"
        ? "backend_route"
        : "execution_route";
  const routeId = `route:${metadata.routeValue}`;
  const launchAllowed = metadata.launchAllowed;
  return {
    id: routeId,
    name:
      metadata.routeValue === "auto"
        ? "Automatic workspace routing"
        : (metadata.providerLabel ?? metadata.routeValue),
    version: "routing",
    summary: normalizeRoutingDetail(metadata),
    source,
    transport: source,
    hostProfile: {
      kind: "routing",
      executionBoundaries: ["routing", "runtime"],
    },
    workspaceId: null,
    enabled: metadata.providerAvailable !== false,
    runtimeBacked: true,
    capabilities: [],
    permissions: [],
    resources: [],
    executionBoundaries: ["routing", "runtime"],
    binding: {
      state: "bound",
      contractFormat: "route",
      contractBoundary: "runtime-routing",
      interfaceId: routeId,
      surfaces: [
        {
          id: routeId,
          kind: "route",
          direction: "export",
          summary: "Runtime routing surface exported through the unified kernel plugin catalog.",
        },
      ],
    },
    operations: {
      execution: launchAllowed
        ? {
            executable: true,
            mode: source,
            reason: null,
          }
        : {
            executable: false,
            mode: "none",
            reason: metadata.blockingReason ?? normalizeRoutingDetail(metadata),
          },
      resources: {
        readable: false,
        mode: "none",
        reason: `Plugin \`${routeId}\` does not expose readable resources through the runtime kernel.`,
      },
      permissions: {
        evaluable: false,
        mode: "none",
        reason: `Plugin \`${routeId}\` does not publish runtime-evaluable permission state.`,
      },
    },
    metadata,
    permissionDecision: "unsupported",
    health: {
      state:
        metadata.readiness === "ready"
          ? "healthy"
          : metadata.readiness === "attention"
            ? "degraded"
            : "unsupported",
      checkedAt: null,
      warnings:
        metadata.readiness === "ready"
          ? []
          : [metadata.blockingReason ?? normalizeRoutingDetail(metadata)],
    },
  };
}

function resolveProviderRouteReadiness(input: {
  provider: RuntimeProviderCatalogEntry;
  healthEntry: RuntimeProviderRoutingHealth | null;
}): RuntimeRoutingPluginMetadata["readiness"] {
  if (!input.provider.available) {
    return "blocked";
  }
  if (input.provider.oauthProviderId === null) {
    return "ready";
  }
  return input.healthEntry?.state ?? "attention";
}

function buildProviderRouteDetail(input: {
  provider: RuntimeProviderCatalogEntry;
  healthEntry: RuntimeProviderRoutingHealth | null;
  readiness: RuntimeRoutingPluginMetadata["readiness"];
}): string {
  if (!input.provider.available) {
    return "Runtime provider catalog currently marks this provider unavailable.";
  }
  if (input.provider.oauthProviderId === null) {
    return "No OAuth route required.";
  }
  if (input.provider.readinessMessage && input.readiness !== "ready") {
    return input.provider.readinessMessage;
  }
  if (input.healthEntry?.recommendation) {
    return input.healthEntry.recommendation;
  }
  if (input.healthEntry) {
    return `${input.healthEntry.enabledPools} pool(s), ${input.healthEntry.credentialReadyAccounts} ready account(s)`;
  }
  if (input.readiness === "attention") {
    return "Provider routing details are not available yet.";
  }
  return "Provider routing is blocked.";
}

function buildProviderRouteRecommendedAction(input: {
  provider: RuntimeProviderCatalogEntry;
  healthEntry: RuntimeProviderRoutingHealth | null;
  readiness: RuntimeRoutingPluginMetadata["readiness"];
  fallbackDetail?: string | null;
}): string {
  if (input.readiness === "ready") {
    return "Selected route is ready for launch.";
  }
  if (input.fallbackDetail) {
    return "Launch can continue on the available fallback route, or restore a ready remote provider route first.";
  }
  if (!input.provider.available) {
    return "Restore provider availability or switch to another ready route before launching.";
  }
  if (input.provider.readinessKind === "not_authenticated") {
    return "Sign in for this provider or choose another ready route before launching.";
  }
  if (input.healthEntry?.recommendation) {
    return input.healthEntry.recommendation;
  }
  return "Inspect provider routing readiness before launching.";
}

function buildProviderRouteMetadata(input: {
  provider: RuntimeProviderCatalogEntry;
  healthEntry: RuntimeProviderRoutingHealth | null;
}): RuntimeRoutingPluginMetadata {
  const readiness = resolveProviderRouteReadiness(input);
  const detail = buildProviderRouteDetail({
    provider: input.provider,
    healthEntry: input.healthEntry,
    readiness,
  });
  return {
    routeKind: "provider_family",
    routeValue: String(input.provider.providerId),
    readiness,
    launchAllowed: readiness !== "blocked",
    detail,
    blockingReason: readiness === "blocked" ? (input.healthEntry?.blockingReason ?? detail) : null,
    recommendedAction: buildProviderRouteRecommendedAction({
      provider: input.provider,
      healthEntry: input.healthEntry,
      readiness,
    }),
    fallbackDetail: null,
    providerId: input.provider.providerId,
    providerLabel: input.provider.displayName,
    oauthProviderId: input.provider.oauthProviderId,
    pool: input.provider.pool ?? null,
    defaultModelId: input.provider.defaultModelId ?? null,
    provenance: "explicit_route",
    readinessKind: input.provider.readinessKind ?? null,
    readinessMessage: input.provider.readinessMessage ?? null,
    executionKind: input.provider.executionKind ?? null,
    capabilityMatrix: normalizeRuntimeProviderCapabilityMatrix(input.provider),
    providerAvailable: input.provider.available,
    accountsTotal: input.healthEntry?.accountsTotal ?? 0,
    enabledAccountCount: input.healthEntry?.enabledAccounts ?? 0,
    credentialReadyAccountCount: input.healthEntry?.credentialReadyAccounts ?? 0,
    poolsTotal: input.healthEntry?.poolsTotal ?? 0,
    enabledPoolCount: input.healthEntry?.enabledPools ?? 0,
    poolRoutingReady:
      input.healthEntry?.poolRoutingReady ?? input.provider.oauthProviderId === null,
  };
}

function buildAutoRouteMetadata(input: {
  providers: readonly RuntimeProviderCatalogEntry[];
  routingHealth: readonly RuntimeProviderRoutingHealth[];
}): RuntimeRoutingPluginMetadata {
  const hasNonOAuthRoute = input.providers.some((provider) => provider.oauthProviderId === null);
  const readyOAuthRoutes = input.providers.filter((provider) => {
    if (provider.oauthProviderId === null) {
      return false;
    }
    return (
      input.routingHealth.find((entry) => entry.providerId === provider.oauthProviderId)?.state ===
      "ready"
    );
  }).length;
  const fallbackDetail =
    readyOAuthRoutes === 0 && hasNonOAuthRoute && input.routingHealth.length > 0
      ? "No OAuth-backed provider routes are ready, so automatic routing will fall back to local/native execution."
      : null;
  const readiness: RuntimeRoutingPluginMetadata["readiness"] =
    readyOAuthRoutes > 0 || input.routingHealth.length === 0
      ? "ready"
      : hasNonOAuthRoute
        ? "attention"
        : "blocked";
  return {
    routeKind: "combined_execution",
    routeValue: "auto",
    readiness,
    launchAllowed: readiness !== "blocked",
    detail:
      input.routingHealth.length === 0
        ? "No OAuth-backed providers detected; runtime can still use local routing."
        : readyOAuthRoutes > 0
          ? `${readyOAuthRoutes}/${input.routingHealth.length} provider routes ready.`
          : hasNonOAuthRoute
            ? (fallbackDetail ??
              "No OAuth-backed provider routes are ready, but local/native routing remains available.")
            : `0/${input.routingHealth.length} provider routes ready.`,
    blockingReason:
      readiness === "blocked" ? `0/${input.routingHealth.length} provider routes ready.` : null,
    recommendedAction:
      readiness === "attention"
        ? "Launch can continue on local/native routing, or restore a ready remote provider route before launching."
        : readiness === "blocked"
          ? "Enable a ready provider route or switch the workspace to a route that can launch now."
          : "Automatic routing is ready for launch.",
    fallbackDetail,
    providerId: null,
    providerLabel: "Automatic workspace routing",
    oauthProviderId: null,
    pool: "auto",
    defaultModelId: null,
    provenance: "auto",
    readinessKind: null,
    readinessMessage: null,
    executionKind: null,
    capabilityMatrix: null,
    providerAvailable: true,
    accountsTotal: null,
    enabledAccountCount: null,
    credentialReadyAccountCount: null,
    poolsTotal: null,
    enabledPoolCount: null,
    poolRoutingReady: readyOAuthRoutes > 0,
  };
}

export function createRuntimeProviderRoutePluginDescriptors(input: {
  providers: readonly RuntimeProviderCatalogEntry[];
  accounts: readonly OAuthAccountSummary[];
  pools: readonly OAuthPoolSummary[];
}): RuntimeKernelPluginDescriptor[] {
  const routingHealth = buildRuntimeProviderRoutingHealth({
    providers: input.providers,
    accounts: input.accounts,
    pools: input.pools,
  });
  return [
    createRuntimeRoutingPluginDescriptor(
      buildAutoRouteMetadata({
        providers: input.providers,
        routingHealth,
      })
    ),
    ...input.providers.map((provider) =>
      createRuntimeRoutingPluginDescriptor(
        buildProviderRouteMetadata({
          provider,
          healthEntry:
            routingHealth.find((entry) => entry.providerId === provider.oauthProviderId) ?? null,
        })
      )
    ),
  ].sort((left, right) => left.id.localeCompare(right.id));
}

function buildRoutingHealthEntry(
  descriptor: RuntimeKernelPluginDescriptor
): RuntimeProviderRoutingHealth | null {
  const metadata = readRuntimeKernelRoutingPluginMetadata(descriptor.metadata);
  if (!metadata || !metadata.oauthProviderId) {
    return null;
  }
  return {
    providerId: metadata.oauthProviderId,
    providerLabel: metadata.providerLabel ?? metadata.routeValue,
    state: metadata.readiness,
    poolRoutingReady: metadata.poolRoutingReady ?? false,
    blockingReason: metadata.blockingReason ?? null,
    recommendation: metadata.recommendedAction ?? null,
    accountsTotal: metadata.accountsTotal ?? 0,
    enabledAccounts: metadata.enabledAccountCount ?? 0,
    credentialReadyAccounts: metadata.credentialReadyAccountCount ?? 0,
    poolsTotal: metadata.poolsTotal ?? 0,
    enabledPools: metadata.enabledPoolCount ?? 0,
  };
}

function enrichSelectedRoutingPlugin(input: {
  plugin: RuntimeKernelPluginDescriptor;
  metadata: RuntimeRoutingPluginMetadata;
  preferredBackendIds?: string[] | null;
  resolvedBackendId?: string | null;
  provenance?: RuntimeRoutingPluginProvenance;
}): RuntimeKernelPluginDescriptor {
  const preferredBackendIds = normalizeStringArray(input.preferredBackendIds);
  const resolvedBackendId = readOptionalText(input.resolvedBackendId);
  if (!preferredBackendIds && !resolvedBackendId && !input.provenance) {
    return input.plugin;
  }
  const metadata: RuntimeRoutingPluginMetadata = {
    ...input.metadata,
    routeKind: "combined_execution",
    preferredBackendIds,
    resolvedBackendId,
    provenance: input.provenance ?? input.metadata.provenance ?? "explicit_route",
    detail: [
      normalizeRoutingDetail(input.metadata),
      preferredBackendIds ? `Preferred backends: ${preferredBackendIds.join(", ")}.` : null,
      resolvedBackendId ? `Resolved backend: ${resolvedBackendId}.` : null,
    ]
      .filter((segment): segment is string => segment !== null)
      .join(" "),
  };
  return createRuntimeRoutingPluginDescriptor(metadata);
}

export function resolveRuntimeKernelRouteSelection(input: {
  plugins: RuntimeKernelPluginDescriptor[];
  selectedRoute: string | null | undefined;
  preferredBackendIds?: string[] | null;
  resolvedBackendId?: string | null;
  provenance?: RuntimeRoutingPluginProvenance;
}): {
  routingHealth: RuntimeProviderRoutingHealth[];
  options: RuntimeKernelRouteOption[];
  selected: RuntimeKernelResolvedRoute;
  normalizedValue: string;
} {
  const routingPlugins = input.plugins
    .map((plugin) => ({
      plugin,
      metadata: readRuntimeKernelRoutingPluginMetadata(plugin.metadata),
    }))
    .filter(
      (
        entry
      ): entry is {
        plugin: RuntimeKernelPluginDescriptor;
        metadata: RuntimeRoutingPluginMetadata;
      } => entry.metadata !== null
    )
    .sort((left, right) => left.metadata.routeValue.localeCompare(right.metadata.routeValue));
  const normalizedSelectedRoute = readOptionalText(input.selectedRoute) ?? "auto";
  let selectedOption: RuntimeKernelRouteOption | null = null;

  const options = routingPlugins.map(({ plugin, metadata }) => {
    const selectedMatch = metadata.routeValue === normalizedSelectedRoute;
    const selectedPlugin = selectedMatch
      ? enrichSelectedRoutingPlugin({
          plugin,
          metadata,
          preferredBackendIds: input.preferredBackendIds,
          resolvedBackendId: input.resolvedBackendId,
          provenance: input.provenance,
        })
      : plugin;
    const selectedMetadata =
      readRuntimeKernelRoutingPluginMetadata(selectedPlugin.metadata) ?? metadata;
    const option = {
      value: selectedMetadata.routeValue,
      label:
        selectedMetadata.routeValue === "auto"
          ? "Automatic workspace routing"
          : (selectedMetadata.providerLabel ?? selectedMetadata.routeValue),
      source: selectedMetadata.provenance ?? "explicit_route",
      ready: selectedMetadata.readiness === "ready",
      launchAllowed: selectedMetadata.launchAllowed,
      readiness: selectedMetadata.readiness,
      detail: normalizeRoutingDetail(selectedMetadata),
      blockingReason: selectedMetadata.blockingReason ?? null,
      recommendedAction:
        selectedMetadata.recommendedAction ??
        (selectedMetadata.readiness === "ready"
          ? "Selected route is ready for launch."
          : "Inspect routing readiness before launching."),
      fallbackDetail: selectedMetadata.fallbackDetail ?? null,
      providerId: selectedMetadata.providerId ?? null,
      oauthProviderId: selectedMetadata.oauthProviderId ?? null,
      pool: selectedMetadata.pool ?? null,
      defaultModelId: selectedMetadata.defaultModelId ?? null,
      preferredBackendIds: selectedMetadata.preferredBackendIds ?? null,
      resolvedBackendId: selectedMetadata.resolvedBackendId ?? null,
      healthEntry: buildRoutingHealthEntry(selectedPlugin),
      provenance: {
        source: selectedMetadata.provenance ?? "explicit_route",
        catalogProviderId: selectedMetadata.providerId ?? null,
        readinessKind: selectedMetadata.readinessKind ?? null,
        readinessMessage: selectedMetadata.readinessMessage ?? null,
        executionKind: selectedMetadata.executionKind ?? null,
      },
      plugin: selectedPlugin,
    } satisfies RuntimeKernelRouteOption;
    if (selectedMatch) {
      selectedOption = option;
    }
    return option;
  });

  const selected =
    selectedOption ?? options.find((option) => option.value === "auto") ?? options[0];
  if (!selected) {
    const plugin = createRuntimeRoutingPluginDescriptor({
      routeKind: "combined_execution",
      routeValue: "auto",
      readiness: "attention",
      launchAllowed: true,
      detail: "Routing plugins are not available yet.",
      recommendedAction:
        "Refresh runtime plugin projection or restore plugin catalog routing truth.",
      providerId: null,
      providerLabel: "Automatic workspace routing",
      oauthProviderId: null,
      pool: "auto",
      defaultModelId: null,
      provenance: "auto",
      capabilityMatrix: null,
    });
    return {
      routingHealth: [],
      options: [
        {
          value: "auto",
          label: "Automatic workspace routing",
          source: "auto",
          ready: false,
          launchAllowed: true,
          readiness: "attention",
          detail: "Routing plugins are not available yet.",
          blockingReason: null,
          recommendedAction:
            "Refresh runtime plugin projection or restore plugin catalog routing truth.",
          fallbackDetail: null,
          providerId: null,
          oauthProviderId: null,
          pool: "auto",
          defaultModelId: null,
          preferredBackendIds: null,
          resolvedBackendId: null,
          healthEntry: null,
          provenance: {
            source: "auto",
            catalogProviderId: null,
            readinessKind: null,
            readinessMessage: null,
            executionKind: null,
          },
          plugin,
        },
      ],
      selected: {
        value: "auto",
        label: "Automatic workspace routing",
        source: "auto",
        ready: false,
        launchAllowed: true,
        readiness: "attention",
        detail: "Routing plugins are not available yet.",
        blockingReason: null,
        recommendedAction:
          "Refresh runtime plugin projection or restore plugin catalog routing truth.",
        fallbackDetail: null,
        providerId: null,
        oauthProviderId: null,
        pool: "auto",
        defaultModelId: null,
        preferredBackendIds: null,
        resolvedBackendId: null,
        healthEntry: null,
        provenance: {
          source: "auto",
          catalogProviderId: null,
          readinessKind: null,
          readinessMessage: null,
          executionKind: null,
        },
        plugin,
      },
      normalizedValue: "auto",
    };
  }

  return {
    routingHealth: options
      .map((option) => option.healthEntry)
      .filter((entry): entry is RuntimeProviderRoutingHealth => entry !== null),
    options,
    selected,
    normalizedValue: selected.value,
  };
}
