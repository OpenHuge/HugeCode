import type {
  AgentTaskSummary,
  HugeCodePlacementLifecycleState,
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

function normalizePreferredBackendIds(task: AgentTaskSummary): string[] {
  return Array.from(
    new Set(
      (task.preferredBackendIds ?? [])
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0)
    )
  );
}

function resolveRoutingLifecycle(input: {
  backendId: string | null;
  preferredBackendIds: string[];
  hasConfirmationEvidence: boolean;
}): HugeCodePlacementLifecycleState {
  if (!input.backendId) {
    return input.preferredBackendIds.length > 0 ? "requested" : "unresolved";
  }
  if (
    input.preferredBackendIds.length > 0 &&
    !input.preferredBackendIds.includes(input.backendId)
  ) {
    return "fallback";
  }
  return input.hasConfirmationEvidence ? "confirmed" : "resolved";
}

function buildRoutingLifecycleHint(input: {
  lifecycleState: HugeCodePlacementLifecycleState;
  backendId: string | null;
  preferredBackendIds: string[];
}) {
  switch (input.lifecycleState) {
    case "requested":
      return "Requested backend placement is still waiting for runtime confirmation.";
    case "resolved":
      return input.backendId
        ? `Runtime resolved backend ${input.backendId}, but confirmation details are incomplete.`
        : "Runtime resolved routing intent, but backend confirmation details are incomplete.";
    case "confirmed":
      return input.preferredBackendIds.length > 0 && input.backendId
        ? `Runtime confirmed the requested backend ${input.backendId}.`
        : input.backendId
          ? `Runtime confirmed backend placement on ${input.backendId}.`
          : "Runtime confirmed backend placement.";
    case "fallback":
      return input.backendId
        ? `Runtime confirmed fallback placement on backend ${input.backendId}.`
        : "Runtime confirmed fallback placement.";
    case "unresolved":
    default:
      return "Runtime has not confirmed a concrete backend placement yet.";
  }
}

export function buildRoutingSummary(
  task: AgentTaskSummary,
  context?: RunProjectionRoutingContext
): NonNullable<HugeCodeRunSummary["routing"]> {
  if (task.routing) {
    const preferredBackendIds = normalizePreferredBackendIds(task);
    const backendId = task.routing.backendId ?? task.backendId ?? null;
    const lifecycleState =
      task.routing.lifecycleState ??
      resolveRoutingLifecycle({
        backendId,
        preferredBackendIds,
        hasConfirmationEvidence: true,
      });
    const lifecycleHint = buildRoutingLifecycleHint({
      lifecycleState,
      backendId,
      preferredBackendIds,
    });
    return {
      ...task.routing,
      backendId,
      routeHint: Array.from(new Set([lifecycleHint, task.routing.routeHint].filter(Boolean))).join(
        " "
      ),
    };
  }

  const preferredBackendIds = normalizePreferredBackendIds(task);
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
  const backendId = task.backendId ?? null;
  const lifecycleState = resolveRoutingLifecycle({
    backendId,
    preferredBackendIds,
    hasConfirmationEvidence: providerEntry !== undefined || healthEntry !== undefined,
  });
  const lifecycleHint = buildRoutingLifecycleHint({
    lifecycleState,
    backendId,
    preferredBackendIds,
  });

  if (!routedProvider) {
    return {
      backendId,
      provider: routedProvider,
      providerLabel,
      pool: task.routedPool ?? null,
      routeLabel: providerLabel ?? "Local runtime",
      routeHint: `${lifecycleHint} This run does not require workspace OAuth routing.`,
      health: "ready",
      enabledAccountCount: 0,
      readyAccountCount: 0,
      enabledPoolCount: 0,
    };
  }

  if (!providerEntry) {
    return {
      backendId,
      provider: routedProvider,
      providerLabel,
      pool: task.routedPool ?? null,
      routeLabel: providerLabel ?? "Unknown runtime route",
      routeHint: `${lifecycleHint} Runtime routed provider ${routedProvider} is not present in the current provider catalog.`,
      health: "attention",
      enabledAccountCount: 0,
      readyAccountCount: 0,
      enabledPoolCount: 0,
    };
  }

  if (providerEntry.oauthProviderId === null) {
    return {
      backendId,
      provider: routedProvider,
      providerLabel,
      pool: task.routedPool ?? null,
      routeLabel: providerLabel ?? "Local runtime",
      routeHint: `${lifecycleHint} This run does not require workspace OAuth routing.`,
      health: "ready",
      enabledAccountCount: 0,
      readyAccountCount: 0,
      enabledPoolCount: 0,
    };
  }

  const routeLabel = task.routedPool
    ? `${providerLabel ?? providerEntry.oauthProviderId} / ${task.routedPool}`
    : `${providerLabel ?? providerEntry.oauthProviderId} / workspace route`;

  const routeHint = [
    lifecycleHint,
    healthEntry?.recommendation ??
      (healthEntry
        ? `Workspace routing exposes ${healthEntry.enabledPools} enabled pool(s) and ${healthEntry.credentialReadyAccounts} ready account(s) for this provider.`
        : "Workspace routing details are not available yet."),
  ].join(" ");

  const health = !healthEntry
    ? "attention"
    : healthEntry.poolRoutingReady
      ? "ready"
      : healthEntry.enabledPools > 0 || healthEntry.enabledAccounts > 0
        ? "attention"
        : "blocked";

  return {
    backendId,
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
