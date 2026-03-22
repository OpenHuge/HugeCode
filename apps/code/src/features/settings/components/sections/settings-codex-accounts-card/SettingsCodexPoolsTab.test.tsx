import { createRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { SettingsCodexPoolsTab } from "./SettingsCodexPoolsTab";
import type {
  OAuthAccountSummary,
  OAuthPoolSummary,
} from "../../../../../application/runtime/ports/tauriOauth";
import type { PoolDraft, ProviderOption } from "../settingsCodexAccountsCardUtils";

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

const account: OAuthAccountSummary = {
  accountId: "acct-1",
  provider: "codex",
  externalAccountId: null,
  email: "coder@example.com",
  displayName: "Coder",
  status: "enabled",
  disabledReason: null,
  routeConfig: null,
  routingState: null,
  chatgptWorkspaces: null,
  defaultChatgptWorkspaceId: null,
  metadata: {},
  createdAt: 100,
  updatedAt: 200,
};

const pool: OAuthPoolSummary = {
  poolId: "pool-1",
  provider: "codex",
  name: "Primary pool",
  enabled: true,
  strategy: "round_robin",
  stickyMode: "cache_first",
  preferredAccountId: "acct-1",
  memberAccountIds: ["acct-1"],
  rateLimitPolicy: null,
  createdAt: 100,
  updatedAt: 200,
};

const poolDraft: PoolDraft = {
  name: "Primary pool",
  enabled: true,
  strategy: "round_robin",
  stickyMode: "cache_first",
  preferredAccountId: "acct-1",
  memberAccountIds: ["acct-1"],
  memberPoliciesByAccountId: {
    "acct-1": {
      weight: 1,
      priority: 0,
      position: 0,
      enabled: true,
    },
  },
  rateLimitPolicyKind: "inherit",
  rateLimitWindowMs: "",
  rateLimitMaxRequests: "",
};

describe("SettingsCodexPoolsTab", () => {
  it("renders pool state through the shared status badge family", () => {
    const markup = renderToStaticMarkup(
      <SettingsCodexPoolsTab
        onRefresh={vi.fn()}
        busyAction={null}
        poolCreateSectionRef={createRef<HTMLElement>()}
        selectedPoolProvider={providerOptions[0]}
        providerOptions={providerOptions}
        poolProviderDraft="codex"
        setPoolProviderDraft={vi.fn()}
        poolNameDraft=""
        setPoolNameDraft={vi.fn()}
        accounts={[account]}
        providerAccounts={[account]}
        poolMemberAccountIdsDraft={["acct-1"]}
        setPoolMemberAccountIdsDraft={vi.fn()}
        poolPreferredAccountIdDraft="acct-1"
        setPoolPreferredAccountIdDraft={vi.fn()}
        poolMemberAccountsDraft={[account]}
        onAddPool={vi.fn()}
        poolProviderFilter="all"
        setPoolProviderFilter={vi.fn()}
        visiblePools={[pool]}
        selectedPoolIds={[]}
        setSelectedPoolIds={vi.fn()}
        onBulkPoolStatus={vi.fn()}
        onBulkRemovePools={vi.fn()}
        bulkPoolStickyModeDraft="cache_first"
        setBulkPoolStickyModeDraft={vi.fn()}
        onBulkPoolStickyMode={vi.fn()}
        hiddenSelectedPoolsCount={0}
        onClearHiddenSelectedPools={vi.fn()}
        selectedPools={[]}
        pools={[pool]}
        poolDrafts={{ "pool-1": poolDraft }}
        poolSaveStateById={{}}
        selectedPoolIdSet={new Set()}
        poolSelectionPreviewById={{
          "pool-1": {
            accountId: "acct-1",
            reason: "single member",
            selectedAt: 100,
          },
        }}
        updatePoolDraft={vi.fn()}
        onAutosavePool={vi.fn()}
        onProbePoolAccount={vi.fn()}
        onReportPoolRateLimit={vi.fn()}
        onRetryPoolAutosave={vi.fn()}
        onSyncPoolMembers={vi.fn()}
        onRemovePool={vi.fn()}
        stickyModeDescription={{
          cache_first: "Prefer existing account affinity first.",
          balance: "Distribute requests across eligible accounts.",
          performance_first: "Prefer lowest latency accounts.",
        }}
      />
    );

    expect(markup).toContain("Primary pool");
    expect(markup).toContain('data-status-tone="success"');
    expect(markup).toContain('data-tone="success"');
    expect(markup).toContain('data-shape="chip"');
    expect(markup).toContain('data-size="md"');
  });
});
