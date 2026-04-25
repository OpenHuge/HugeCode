import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { OAuthSharingOverview } from "../../../../../application/runtime/ports/oauthSharing";
import type { OAuthPoolSummary } from "../../../../../application/runtime/ports/oauth";
import type { ProviderOption } from "../settingsCodexAccountsCardUtils";
import { SettingsCodexSharingTab } from "./SettingsCodexSharingTab";

const providerOptions: ProviderOption[] = [
  {
    id: "codex",
    routeProviderId: "codex",
    label: "Codex",
    available: true,
    supportsNative: true,
    supportsOpenaiCompat: true,
  },
];

const pool: OAuthPoolSummary = {
  poolId: "pool-1",
  provider: "codex",
  name: "Primary pool",
  enabled: true,
  strategy: "round_robin",
  stickyMode: "cache_first",
  preferredAccountId: null,
  metadata: {},
  createdAt: 100,
  updatedAt: 200,
};

const overview: OAuthSharingOverview = {
  status: "ready",
  unavailableReason: null,
  leases: [
    {
      leaseId: "lease-1",
      ownerWorkspaceId: "owner",
      borrowerWorkspaceId: "borrower",
      provider: "codex",
      poolId: "pool-1",
      allowedAccountIds: [],
      status: "active",
      startsAt: 100,
      expiresAt: 200,
      maxConcurrentRuns: 2,
      turnBudget: 50,
      turnsUsed: 12,
      policy: "fair_share",
      blockingReason: null,
      metadata: {},
      createdAt: 100,
      updatedAt: 100,
    },
  ],
  carpools: [
    {
      carpoolId: "carpool-1",
      provider: "codex",
      name: "Team pool",
      memberWorkspaceIds: ["workspace-a", "workspace-b"],
      poolIds: ["pool-1"],
      strategy: "fair_share",
      perMemberConcurrencyLimit: 1,
      perMemberTurnBudget: 20,
      enabled: true,
      blockingReason: null,
      metadata: {},
      createdAt: 100,
      updatedAt: 100,
    },
  ],
  usage: {
    turnsUsed: 12,
    activeConcurrentRuns: 1,
    blockedRoutesCount: 0,
    budgetExhaustedCount: 0,
    rateLimitPressureCount: 0,
    concurrencyPressureCount: 0,
    recentAuditEvents: [],
  },
};

describe("SettingsCodexSharingTab", () => {
  it("renders sharing leases and team pools without local routing policy", () => {
    const markup = renderToStaticMarkup(
      <SettingsCodexSharingTab
        onRefresh={vi.fn()}
        busyAction={null}
        sharingOverview={overview}
        providerOptions={providerOptions}
        pools={[pool]}
      />
    );

    expect(markup).toContain("Shared access, team pools, and borrowed capacity.");
    expect(markup).toContain("lease-1");
    expect(markup).toContain("Team pool");
    expect(markup).toContain("12/50 turns");
    expect(markup).toContain("runtime-owned");
  });

  it("renders an explicit unsupported state while HugeRouter sharing RPC is absent", () => {
    const markup = renderToStaticMarkup(
      <SettingsCodexSharingTab
        onRefresh={vi.fn()}
        busyAction={null}
        sharingOverview={{
          status: "unsupported",
          leases: [],
          carpools: [],
          usage: null,
          unavailableReason: "HugeRouter has not published sharing RPC yet.",
        }}
        providerOptions={providerOptions}
        pools={[]}
      />
    );

    expect(markup).toContain("HugeRouter has not published sharing RPC yet.");
    expect(markup).toContain("No shared access leases");
    expect(markup).toContain("No team pools");
    expect(markup).toContain("disabled");
  });
});
