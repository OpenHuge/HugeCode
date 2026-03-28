import type {
  ModelPool,
  ModelProvider,
  OAuthAccountSummary,
  OAuthPoolSummary,
  RuntimeRoutingPluginProvenance,
  RuntimeProviderCatalogEntry,
} from "@ku0/code-runtime-host-contract";
import {
  canonicalizeModelPool,
  canonicalizeModelProvider,
  canonicalizeOAuthProviderId,
} from "@ku0/code-runtime-host-contract/codeRuntimeRpcCompat";
import {
  buildRuntimeProviderRoutingHealth,
  type RuntimeProviderRoutingHealth,
} from "./runtimeRoutingHealth";
import {
  createRuntimeProviderRoutePluginDescriptors,
  resolveRuntimeKernelRouteSelection,
} from "../kernel/runtimeKernelPlugins";

export type RuntimeProviderRouteReadiness = "ready" | "attention" | "blocked";

export type RuntimeProviderRouteProvenance = {
  source: RuntimeRoutingPluginProvenance;
  catalogProviderId: ModelProvider | null;
  readinessKind: RuntimeProviderCatalogEntry["readinessKind"];
  readinessMessage: RuntimeProviderCatalogEntry["readinessMessage"];
  executionKind: RuntimeProviderCatalogEntry["executionKind"];
};

export type RuntimeProviderRouteOption = {
  value: string;
  label: string;
  ready: boolean;
  readiness: RuntimeProviderRouteReadiness;
  detail: string;
  launchAllowed: boolean;
  blockingReason: string | null;
  recommendedAction: string;
  fallbackDetail: string | null;
  providerId: ModelProvider | null;
  oauthProviderId: RuntimeProviderCatalogEntry["oauthProviderId"];
  pool: ModelPool | null;
  defaultModelId: string | null;
  healthEntry: RuntimeProviderRoutingHealth | null;
  provenance: RuntimeProviderRouteProvenance;
};

export type RuntimeResolvedProviderRoute = RuntimeProviderRouteOption & {
  source: RuntimeRoutingPluginProvenance;
};

type RuntimeProviderRouteModelLike = {
  id?: string | null;
  model?: string | null;
  provider?: string | null;
  pool?: string | null;
};

function buildUnavailableRoutingHealth(
  oauthProviderId: RuntimeProviderCatalogEntry["oauthProviderId"],
  providerLabel: string
): RuntimeProviderRoutingHealth | null {
  if (!oauthProviderId) {
    return null;
  }
  return {
    providerId: oauthProviderId,
    providerLabel,
    state: "attention",
    poolRoutingReady: false,
    blockingReason: null,
    recommendation: "Provider routing details are not available yet.",
    accountsTotal: 0,
    enabledAccounts: 0,
    credentialReadyAccounts: 0,
    poolsTotal: 0,
    enabledPools: 0,
  };
}

function normalizeText(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function matchesCatalogEntry(
  entry: RuntimeProviderCatalogEntry,
  candidate: string | null | undefined
): boolean {
  const normalized = normalizeText(candidate)?.toLowerCase();
  if (!normalized) {
    return false;
  }
  return (
    entry.providerId === normalized ||
    entry.oauthProviderId === normalized ||
    entry.pool === normalized ||
    entry.aliases.some((alias) => alias.trim().toLowerCase() === normalized)
  );
}

function findCatalogEntryForValue(
  providers: readonly RuntimeProviderCatalogEntry[],
  candidate: string | null | undefined
): RuntimeProviderCatalogEntry | null {
  const normalized = normalizeText(candidate);
  if (!normalized) {
    return null;
  }
  return providers.find((entry) => matchesCatalogEntry(entry, normalized)) ?? null;
}

function findCatalogEntryForModel(
  providers: readonly RuntimeProviderCatalogEntry[],
  model: RuntimeProviderRouteModelLike | null | undefined
): RuntimeProviderCatalogEntry | null {
  if (!model) {
    return null;
  }
  const candidates = [model.provider, model.pool, model.model, model.id];
  for (const candidate of candidates) {
    const entry = findCatalogEntryForValue(providers, candidate);
    if (entry) {
      return entry;
    }
  }
  return null;
}

function resolveRoutingHealth(
  provider: RuntimeProviderCatalogEntry | null,
  healthEntry: RuntimeProviderRoutingHealth | null
): RuntimeProviderRouteReadiness {
  if (!provider) {
    return "attention";
  }
  if (!provider.available) {
    return "blocked";
  }
  if (provider.oauthProviderId === null) {
    return "ready";
  }
  if (!healthEntry) {
    return "attention";
  }
  return healthEntry.state;
}

function buildRouteDetail(
  provider: RuntimeProviderCatalogEntry | null,
  healthEntry: RuntimeProviderRoutingHealth | null,
  readiness: RuntimeProviderRouteReadiness
): string {
  if (!provider) {
    return "Selected provider route is not present in the current runtime provider catalog.";
  }
  if (!provider.available) {
    return "Runtime provider catalog currently marks this provider unavailable.";
  }
  if (provider.oauthProviderId === null) {
    return "No OAuth route required.";
  }
  if (provider.readinessMessage && readiness !== "ready") {
    return provider.readinessMessage;
  }
  if (healthEntry?.recommendation) {
    return healthEntry.recommendation;
  }
  if (healthEntry) {
    return `${healthEntry.enabledPools} pool(s), ${healthEntry.credentialReadyAccounts} ready account(s)`;
  }
  if (readiness === "attention") {
    return "Provider routing details are not available yet.";
  }
  return "Provider routing is blocked.";
}

function buildRouteRecommendedAction(input: {
  provider: RuntimeProviderCatalogEntry | null;
  healthEntry: RuntimeProviderRoutingHealth | null;
  readiness: RuntimeProviderRouteReadiness;
  fallbackDetail?: string | null;
}): string {
  if (input.readiness === "ready") {
    return "Selected route is ready for launch.";
  }
  if (input.fallbackDetail) {
    return "Launch can continue on the available fallback route, or restore a ready remote provider route first.";
  }
  if (!input.provider) {
    return "Refresh provider routing metadata or switch to a route that the runtime provider catalog currently publishes.";
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

function buildRouteBlockingReason(
  provider: RuntimeProviderCatalogEntry | null,
  healthEntry: RuntimeProviderRoutingHealth | null,
  readiness: RuntimeProviderRouteReadiness
): string | null {
  if (readiness !== "blocked") {
    return null;
  }
  return (
    healthEntry?.blockingReason ??
    provider?.readinessMessage ??
    buildRouteDetail(provider, healthEntry, readiness)
  );
}

export function buildRuntimeProviderRouteCatalog(input: {
  providers: readonly RuntimeProviderCatalogEntry[];
  accounts: readonly OAuthAccountSummary[];
  pools: readonly OAuthPoolSummary[];
}) {
  const selection = resolveRuntimeKernelRouteSelection({
    plugins: createRuntimeProviderRoutePluginDescriptors({
      providers: input.providers,
      accounts: input.accounts,
      pools: input.pools,
    }),
    selectedRoute: "auto",
  });
  return {
    routingHealth: selection.routingHealth,
    options: selection.options,
  };
}

export function resolveRuntimeProviderRouteSelection(input: {
  selectedRoute: string | null | undefined;
  providers: readonly RuntimeProviderCatalogEntry[];
  accounts: readonly OAuthAccountSummary[];
  pools: readonly OAuthPoolSummary[];
}): {
  routingHealth: RuntimeProviderRoutingHealth[];
  options: RuntimeProviderRouteOption[];
  selected: RuntimeResolvedProviderRoute;
  normalizedValue: string;
} {
  const selection = resolveRuntimeKernelRouteSelection({
    plugins: createRuntimeProviderRoutePluginDescriptors({
      providers: input.providers,
      accounts: input.accounts,
      pools: input.pools,
    }),
    selectedRoute: input.selectedRoute,
  });
  return {
    routingHealth: selection.routingHealth,
    options: selection.options,
    selected: {
      ...selection.selected,
      source: selection.selected.value === "auto" ? "auto" : "explicit_route",
      provenance: {
        ...selection.selected.provenance,
        source: selection.selected.value === "auto" ? "auto" : "explicit_route",
      },
    },
    normalizedValue: selection.normalizedValue,
  };
}

export function resolveRuntimeModelProviderRoute(input: {
  model: RuntimeProviderRouteModelLike | null | undefined;
  providers: readonly RuntimeProviderCatalogEntry[];
  accounts?: readonly OAuthAccountSummary[];
  pools?: readonly OAuthPoolSummary[];
}): RuntimeResolvedProviderRoute | null {
  const provider = findCatalogEntryForModel(input.providers, input.model);
  const oauthProviderId =
    provider?.oauthProviderId ??
    canonicalizeOAuthProviderId(
      input.model?.provider ?? input.model?.pool ?? input.model?.model ?? input.model?.id ?? null
    );
  const routingHealth = buildRuntimeProviderRoutingHealth({
    providers: provider ? [provider] : [],
    accounts: input.accounts ?? [],
    pools: input.pools ?? [],
  });
  const healthEntry =
    routingHealth.find((entry) => entry.providerId === oauthProviderId) ??
    buildUnavailableRoutingHealth(oauthProviderId, provider?.displayName ?? oauthProviderId ?? "");
  const readiness = resolveRoutingHealth(provider, healthEntry);
  const providerId =
    provider?.providerId ??
    canonicalizeModelProvider(
      input.model?.provider ?? input.model?.pool ?? input.model?.model ?? input.model?.id ?? null
    );
  const pool =
    provider?.pool ??
    canonicalizeModelPool(input.model?.pool ?? input.model?.provider ?? input.model?.model ?? null);

  if (!providerId) {
    return null;
  }

  return {
    value: provider?.providerId ?? providerId,
    label: provider?.displayName ?? String(providerId),
    ready: readiness === "ready",
    readiness,
    detail: buildRouteDetail(provider, healthEntry, readiness),
    launchAllowed: readiness !== "blocked",
    blockingReason: buildRouteBlockingReason(provider, healthEntry, readiness),
    recommendedAction: buildRouteRecommendedAction({
      provider,
      healthEntry,
      readiness,
    }),
    fallbackDetail: null,
    providerId,
    oauthProviderId,
    pool,
    defaultModelId: provider?.defaultModelId ?? null,
    healthEntry,
    source: "model_selection",
    provenance: {
      source: "model_selection",
      catalogProviderId: provider?.providerId ?? null,
      readinessKind: provider?.readinessKind ?? null,
      readinessMessage: provider?.readinessMessage ?? null,
      executionKind: provider?.executionKind ?? null,
    },
  };
}

export function resolveExplicitRuntimeProviderRoute(input: {
  routeValue: string | null | undefined;
  providers: readonly RuntimeProviderCatalogEntry[];
  accounts: readonly OAuthAccountSummary[];
  pools: readonly OAuthPoolSummary[];
}): RuntimeResolvedProviderRoute {
  const selection = resolveRuntimeProviderRouteSelection({
    selectedRoute: input.routeValue,
    providers: input.providers,
    accounts: input.accounts,
    pools: input.pools,
  });
  return {
    ...selection.selected,
    source: selection.selected.value === "auto" ? "auto" : "explicit_route",
    provenance: {
      ...selection.selected.provenance,
      source: selection.selected.value === "auto" ? "auto" : "explicit_route",
    },
  };
}
