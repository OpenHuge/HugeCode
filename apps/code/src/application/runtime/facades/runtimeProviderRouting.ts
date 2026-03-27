import type {
  ModelPool,
  ModelProvider,
  OAuthAccountSummary,
  OAuthPoolSummary,
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

export type RuntimeProviderRouteReadiness = "ready" | "attention" | "blocked";

export type RuntimeProviderRouteProvenance = {
  source: "auto" | "explicit_route" | "model_selection";
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
  source: "auto" | "explicit_route" | "model_selection";
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

function createRouteOption(input: {
  provider: RuntimeProviderCatalogEntry | null;
  healthEntry: RuntimeProviderRoutingHealth | null;
  source: RuntimeResolvedProviderRoute["source"];
  fallbackDetail?: string | null;
}): RuntimeProviderRouteOption | null {
  if (!input.provider) {
    return null;
  }
  const readiness = resolveRoutingHealth(input.provider, input.healthEntry);
  const blockingReason = buildRouteBlockingReason(input.provider, input.healthEntry, readiness);
  const recommendedAction = buildRouteRecommendedAction({
    provider: input.provider,
    healthEntry: input.healthEntry,
    readiness,
    fallbackDetail: input.fallbackDetail,
  });
  return {
    value: input.provider.providerId,
    label: input.provider.displayName,
    ready: readiness === "ready",
    readiness,
    detail: buildRouteDetail(input.provider, input.healthEntry, readiness),
    launchAllowed: readiness !== "blocked",
    blockingReason,
    recommendedAction,
    fallbackDetail: input.fallbackDetail ?? null,
    providerId: input.provider.providerId,
    oauthProviderId: input.provider.oauthProviderId,
    pool: input.provider.pool ?? null,
    defaultModelId: input.provider.defaultModelId ?? null,
    healthEntry: input.healthEntry,
    provenance: {
      source: input.source,
      catalogProviderId: input.provider.providerId,
      readinessKind: input.provider.readinessKind ?? null,
      readinessMessage: input.provider.readinessMessage ?? null,
      executionKind: input.provider.executionKind ?? null,
    },
  };
}

export function buildRuntimeProviderRouteCatalog(input: {
  providers: readonly RuntimeProviderCatalogEntry[];
  accounts: readonly OAuthAccountSummary[];
  pools: readonly OAuthPoolSummary[];
}) {
  const routingHealth = buildRuntimeProviderRoutingHealth({
    providers: input.providers,
    accounts: input.accounts,
    pools: input.pools,
  });
  const options = input.providers
    .map((provider) =>
      createRouteOption({
        provider,
        healthEntry:
          routingHealth.find((entry) => entry.providerId === provider.oauthProviderId) ??
          routingHealth.find(
            (entry) => entry.providerId === canonicalizeOAuthProviderId(provider.providerId)
          ) ??
          null,
        source: provider.providerId === "auto" ? "auto" : "explicit_route",
      })
    )
    .filter((option): option is RuntimeProviderRouteOption => option !== null);

  const hasNonOAuthRoute = options.some((option) => option.oauthProviderId === null);
  const readyOAuthRoutes = options.filter(
    (option) => option.oauthProviderId !== null && option.readiness === "ready"
  ).length;
  const autoFallbackDetail =
    readyOAuthRoutes === 0 && hasNonOAuthRoute && routingHealth.length > 0
      ? "No OAuth-backed provider routes are ready, so automatic routing will fall back to local/native execution."
      : null;
  const autoReadiness: RuntimeProviderRouteReadiness =
    readyOAuthRoutes > 0 || routingHealth.length === 0
      ? "ready"
      : hasNonOAuthRoute
        ? "attention"
        : "blocked";
  const autoOption: RuntimeProviderRouteOption = {
    value: "auto",
    label: "Automatic workspace routing",
    ready: autoReadiness === "ready",
    readiness: autoReadiness,
    detail:
      routingHealth.length === 0
        ? "No OAuth-backed providers detected; runtime can still use local routing."
        : readyOAuthRoutes > 0
          ? `${readyOAuthRoutes}/${routingHealth.length} provider routes ready.`
          : hasNonOAuthRoute
            ? (autoFallbackDetail ??
              "No OAuth-backed provider routes are ready, but local/native routing remains available.")
            : `0/${routingHealth.length} provider routes ready.`,
    launchAllowed: autoReadiness !== "blocked",
    blockingReason:
      autoReadiness === "blocked" ? `0/${routingHealth.length} provider routes ready.` : null,
    recommendedAction:
      autoReadiness === "attention"
        ? "Launch can continue on local/native routing, or restore a ready remote provider route before launching."
        : autoReadiness === "blocked"
          ? "Enable a ready provider route or switch the workspace to a route that can launch now."
          : "Automatic routing is ready for launch.",
    fallbackDetail: autoFallbackDetail,
    providerId: null,
    oauthProviderId: null,
    pool: canonicalizeModelPool("auto"),
    defaultModelId: null,
    healthEntry: null,
    provenance: {
      source: "auto",
      catalogProviderId: null,
      readinessKind: null,
      readinessMessage: null,
      executionKind: null,
    },
  };

  return {
    routingHealth,
    options: [autoOption, ...options],
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
  const catalog = buildRuntimeProviderRouteCatalog(input);
  const selectedOption =
    catalog.options.find((option) => option.value === input.selectedRoute) ?? catalog.options[0];
  const selected: RuntimeResolvedProviderRoute = {
    ...selectedOption,
    source: selectedOption.value === "auto" ? "auto" : "explicit_route",
    provenance: {
      ...selectedOption.provenance,
      source: selectedOption.value === "auto" ? "auto" : "explicit_route",
    },
  };
  return {
    routingHealth: catalog.routingHealth,
    options: catalog.options,
    selected,
    normalizedValue: selected?.value ?? "auto",
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
