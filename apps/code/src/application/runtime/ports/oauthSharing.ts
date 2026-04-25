import {
  getRuntimeClient,
  readRuntimeCapabilitiesSummary,
  type OAuthProviderId,
} from "./runtimeClient";

export const OAUTH_SHARING_RPC_METHODS = {
  leasesList: "code_oauth_sharing_leases_list",
  leaseUpsert: "code_oauth_sharing_lease_upsert",
  leaseRevoke: "code_oauth_sharing_lease_revoke",
  carpoolsList: "code_oauth_carpools_list",
  carpoolUpsert: "code_oauth_carpool_upsert",
  carpoolRemove: "code_oauth_carpool_remove",
  usageRead: "code_oauth_sharing_usage_read",
} as const;

export type OAuthSharingLeaseStatus = "pending" | "active" | "paused" | "expired" | "revoked";
export type OAuthSharingPolicy = "fair_share" | "owner_priority" | "borrower_priority";
export type OAuthCarpoolStrategy = "fair_share" | "weighted" | "cheapest_ready" | "fastest_ready";

export type OAuthSharingLeaseSummary = {
  leaseId: string;
  ownerWorkspaceId: string | null;
  borrowerWorkspaceId: string | null;
  provider: OAuthProviderId;
  poolId: string;
  allowedAccountIds: string[];
  status: OAuthSharingLeaseStatus;
  startsAt: number | null;
  expiresAt: number | null;
  maxConcurrentRuns: number | null;
  turnBudget: number | null;
  turnsUsed: number;
  policy: OAuthSharingPolicy;
  blockingReason: string | null;
  metadata: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
};

export type OAuthCarpoolSummary = {
  carpoolId: string;
  provider: OAuthProviderId;
  name: string;
  memberWorkspaceIds: string[];
  poolIds: string[];
  strategy: OAuthCarpoolStrategy;
  perMemberConcurrencyLimit: number | null;
  perMemberTurnBudget: number | null;
  enabled: boolean;
  blockingReason: string | null;
  metadata: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
};

export type OAuthSharingUsageSummary = {
  turnsUsed: number;
  activeConcurrentRuns: number;
  blockedRoutesCount: number;
  budgetExhaustedCount: number;
  rateLimitPressureCount: number;
  concurrencyPressureCount: number;
  recentAuditEvents: OAuthSharingAuditEvent[];
};

export type OAuthSharingAuditEvent = {
  eventId: string;
  eventType:
    | "select"
    | "bind"
    | "revoke"
    | "budget_exhausted"
    | "rate_limited"
    | "concurrency_blocked";
  provider: OAuthProviderId | null;
  poolId: string | null;
  leaseId: string | null;
  carpoolId: string | null;
  workspaceId: string | null;
  accountId: string | null;
  message: string | null;
  createdAt: number;
};

export type OAuthSharingOverviewStatus = "ready" | "unsupported" | "error";

export type OAuthSharingOverview = {
  status: OAuthSharingOverviewStatus;
  leases: OAuthSharingLeaseSummary[];
  carpools: OAuthCarpoolSummary[];
  usage: OAuthSharingUsageSummary | null;
  unavailableReason: string | null;
};

type OAuthSharingRuntimeClient = {
  oauthSharingLeasesList: () => Promise<OAuthSharingLeaseSummary[]>;
  oauthCarpoolsList: () => Promise<OAuthCarpoolSummary[]>;
  oauthSharingUsageRead: () => Promise<OAuthSharingUsageSummary>;
};

const EMPTY_USAGE: OAuthSharingUsageSummary = {
  turnsUsed: 0,
  activeConcurrentRuns: 0,
  blockedRoutesCount: 0,
  budgetExhaustedCount: 0,
  rateLimitPressureCount: 0,
  concurrencyPressureCount: 0,
  recentAuditEvents: [],
};

function createUnsupportedOverview(unavailableReason: string): OAuthSharingOverview {
  return {
    status: "unsupported",
    leases: [],
    carpools: [],
    usage: EMPTY_USAGE,
    unavailableReason,
  };
}

function hasSharingClientMethods(client: unknown): client is OAuthSharingRuntimeClient {
  const candidate = client as Partial<OAuthSharingRuntimeClient>;
  return (
    typeof candidate.oauthSharingLeasesList === "function" &&
    typeof candidate.oauthCarpoolsList === "function" &&
    typeof candidate.oauthSharingUsageRead === "function"
  );
}

export async function readOAuthSharingOverview(): Promise<OAuthSharingOverview> {
  const capabilities = await readRuntimeCapabilitiesSummary();
  const requiredMethods = [
    OAUTH_SHARING_RPC_METHODS.leasesList,
    OAUTH_SHARING_RPC_METHODS.carpoolsList,
    OAUTH_SHARING_RPC_METHODS.usageRead,
  ];
  const missingMethods = requiredMethods.filter((method) => !capabilities.methods.includes(method));
  if (missingMethods.length > 0) {
    return createUnsupportedOverview(
      `HugeRouter has not published ${missingMethods.join(", ")} yet.`
    );
  }

  const client = getRuntimeClient();
  if (!hasSharingClientMethods(client)) {
    return createUnsupportedOverview(
      "HugeCode runtime client bindings are waiting for HugeRouter sharing RPC integration."
    );
  }

  try {
    const [leases, carpools, usage] = await Promise.all([
      client.oauthSharingLeasesList(),
      client.oauthCarpoolsList(),
      client.oauthSharingUsageRead(),
    ]);
    return {
      status: "ready",
      leases,
      carpools,
      usage,
      unavailableReason: null,
    };
  } catch (error) {
    return {
      status: "error",
      leases: [],
      carpools: [],
      usage: EMPTY_USAGE,
      unavailableReason:
        error instanceof Error ? error.message : "Unable to read runtime sharing state.",
    };
  }
}
