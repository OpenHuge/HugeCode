import type {
  AgentTaskSummary,
  HugeCodeRunSummary,
  OAuthAccountSummary,
  OAuthPoolSummary,
  RuntimeProviderCatalogEntry,
} from "@ku0/code-runtime-host-contract";
import type { BackendPoolEntry } from "../types/backendPool";
import { buildRuntimeProviderRoutingHealth } from "./runtimeRoutingHealth";

export type RunProjectionRoutingContext = {
  providers?: RuntimeProviderCatalogEntry[];
  accounts?: OAuthAccountSummary[];
  pools?: OAuthPoolSummary[];
  backends?: Array<
    Pick<
      BackendPoolEntry,
      | "backendId"
      | "contract"
      | "state"
      | "status"
      | "healthy"
      | "queueDepth"
      | "capacity"
      | "inFlight"
      | "placementFailuresTotal"
      | "tcpOverlay"
    >
  >;
  preferredExecutionProfileId?: string | null;
};

export function buildRoutingSummary(
  task: AgentTaskSummary,
  context?: RunProjectionRoutingContext
): NonNullable<HugeCodeRunSummary["routing"]> {
  if (task.routing) {
    return {
      ...task.routing,
      backendId: task.routing.backendId ?? null,
      routeHint: task.routing.routeHint ?? null,
    };
  }

  const routedProvider = task.routedProvider ?? task.provider ?? null;
  const providers = context?.providers ?? [];
  const providerEntry =
    providers.find((entry) => entry.providerId === routedProvider) ??
    providers.find((entry) =>
      entry.aliases.includes(
        String(routedProvider ?? "")
          .trim()
          .toLowerCase()
      )
    );
  const providerHealth = buildRuntimeProviderRoutingHealth({
    providers: providers
      .filter(
        (
          entry
        ): entry is RuntimeProviderCatalogEntry & {
          oauthProviderId: NonNullable<RuntimeProviderCatalogEntry["oauthProviderId"]>;
        } => entry.oauthProviderId !== null
      )
      .map((entry) => ({
        providerId: entry.oauthProviderId,
        label: entry.displayName,
        available: entry.available,
      })),
    accounts: context?.accounts ?? [],
    pools: context?.pools ?? [],
  });
  const healthEntry =
    providerHealth.find((entry) => entry.providerId === providerEntry?.oauthProviderId) ??
    providerHealth.find((entry) => entry.providerId === providerEntry?.providerId);
  const providerLabel = providerEntry?.displayName ?? routedProvider;

  if (!routedProvider) {
    return {
      backendId: null,
      provider: routedProvider,
      providerLabel,
      pool: task.routedPool ?? null,
      routeLabel: providerLabel ?? "Local runtime",
      routeHint: "This run does not require workspace OAuth routing.",
      health: "ready",
      enabledAccountCount: 0,
      readyAccountCount: 0,
      enabledPoolCount: 0,
    };
  }

  if (!providerEntry) {
    return {
      backendId: null,
      provider: routedProvider,
      providerLabel,
      pool: task.routedPool ?? null,
      routeLabel: providerLabel ?? "Unknown runtime route",
      routeHint: `Runtime routed provider ${routedProvider} is not present in the current provider catalog.`,
      health: "attention",
      enabledAccountCount: 0,
      readyAccountCount: 0,
      enabledPoolCount: 0,
    };
  }

  if (providerEntry.oauthProviderId === null) {
    return {
      backendId: null,
      provider: routedProvider,
      providerLabel,
      pool: task.routedPool ?? null,
      routeLabel: providerLabel ?? "Local runtime",
      routeHint: "This run does not require workspace OAuth routing.",
      health: "ready",
      enabledAccountCount: 0,
      readyAccountCount: 0,
      enabledPoolCount: 0,
    };
  }

  const routeLabel = task.routedPool
    ? `${providerLabel ?? providerEntry.oauthProviderId} / ${task.routedPool}`
    : `${providerLabel ?? providerEntry.oauthProviderId} / workspace route`;

  const routeHint =
    healthEntry?.recommendation ??
    (healthEntry
      ? `Workspace routing exposes ${healthEntry.enabledPools} enabled pool(s) and ${healthEntry.credentialReadyAccounts} ready account(s) for this provider.`
      : "Workspace routing details are not available yet.");

  const health = !healthEntry
    ? "attention"
    : healthEntry.poolRoutingReady
      ? "ready"
      : healthEntry.enabledPools > 0 || healthEntry.enabledAccounts > 0
        ? "attention"
        : "blocked";

  return {
    backendId: null,
    provider: routedProvider,
    providerLabel,
    pool: task.routedPool ?? null,
    routeLabel,
    routeHint,
    health,
    enabledAccountCount: healthEntry?.enabledAccounts ?? 0,
    readyAccountCount: healthEntry?.credentialReadyAccounts ?? 0,
    enabledPoolCount: healthEntry?.enabledPools ?? 0,
  };
}

export function buildProfileReadiness(
  routing: NonNullable<HugeCodeRunSummary["routing"]>,
  runtimeProfileReadiness?: AgentTaskSummary["profileReadiness"] | null
): NonNullable<HugeCodeRunSummary["profileReadiness"]> {
  if (runtimeProfileReadiness) {
    return {
      ...runtimeProfileReadiness,
      issues: [...runtimeProfileReadiness.issues],
    };
  }
  if (routing.health === "ready") {
    return {
      ready: true,
      health: "ready",
      summary: "Profile is ready for delegated execution.",
      issues: [],
    };
  }
  return {
    ready: false,
    health: routing.health,
    summary: routing.routeHint ?? "Routing configuration needs attention before execution.",
    issues: routing.routeHint ? [routing.routeHint] : [],
  };
}
