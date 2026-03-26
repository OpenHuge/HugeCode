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

export type RuntimeProviderRouteOption = {
  value: string;
  label: string;
  ready: boolean;
  readiness: RuntimeProviderRouteReadiness;
  detail: string;
  providerId: ModelProvider | null;
  oauthProviderId: RuntimeProviderCatalogEntry["oauthProviderId"];
  pool: ModelPool | null;
  defaultModelId: string | null;
  healthEntry: RuntimeProviderRoutingHealth | null;
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
  if (healthEntry.poolRoutingReady) {
    return "ready";
  }
  return healthEntry.enabledPools > 0 || healthEntry.enabledAccounts > 0 ? "attention" : "blocked";
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

function createRouteOption(input: {
  provider: RuntimeProviderCatalogEntry | null;
  healthEntry: RuntimeProviderRoutingHealth | null;
}): RuntimeProviderRouteOption | null {
  if (!input.provider) {
    return null;
  }
  const readiness = resolveRoutingHealth(input.provider, input.healthEntry);
  return {
    value: input.provider.providerId,
    label: input.provider.displayName,
    ready: readiness === "ready",
    readiness,
    detail: buildRouteDetail(input.provider, input.healthEntry, readiness),
    providerId: input.provider.providerId,
    oauthProviderId: input.provider.oauthProviderId,
    pool: input.provider.pool ?? null,
    defaultModelId: input.provider.defaultModelId ?? null,
    healthEntry: input.healthEntry,
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
      })
    )
    .filter((option): option is RuntimeProviderRouteOption => option !== null);

  const hasNonOAuthRoute = options.some((option) => option.oauthProviderId === null);
  const readyOAuthRoutes = options.filter(
    (option) => option.oauthProviderId !== null && option.readiness === "ready"
  ).length;
  const autoReadiness: RuntimeProviderRouteReadiness =
    readyOAuthRoutes > 0 || hasNonOAuthRoute || routingHealth.length === 0 ? "ready" : "blocked";
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
            ? "No OAuth-backed provider routes are ready, but local/native routing remains available."
            : `0/${routingHealth.length} provider routes ready.`,
    providerId: null,
    oauthProviderId: null,
    pool: canonicalizeModelPool("auto"),
    defaultModelId: null,
    healthEntry: null,
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
  selected: RuntimeProviderRouteOption;
  normalizedValue: string;
} {
  const catalog = buildRuntimeProviderRouteCatalog(input);
  const selected =
    catalog.options.find((option) => option.value === input.selectedRoute) ?? catalog.options[0];
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
    (oauthProviderId
      ? {
          providerId: oauthProviderId,
          providerLabel: provider?.displayName ?? oauthProviderId,
          poolRoutingReady: false,
          recommendation: "Provider routing details are not available yet.",
          accountsTotal: 0,
          enabledAccounts: 0,
          credentialReadyAccounts: 0,
          poolsTotal: 0,
          enabledPools: 0,
        }
      : null);
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
    providerId,
    oauthProviderId,
    pool,
    defaultModelId: provider?.defaultModelId ?? null,
    healthEntry,
    source: "model_selection",
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
  };
}
