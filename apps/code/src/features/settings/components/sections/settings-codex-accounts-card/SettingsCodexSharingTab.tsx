import Share2 from "lucide-react/dist/esm/icons/share-2";
import type {
  OAuthCarpoolSummary,
  OAuthSharingLeaseSummary,
  OAuthSharingOverview,
} from "../../../../../application/runtime/ports/oauthSharing";
import type { OAuthPoolSummary } from "../../../../../application/runtime/ports/oauth";
import {
  Button,
  Input,
  Select,
  StatusBadge,
  type SelectOption,
} from "../../../../../design-system";
import {
  formatProvider,
  formatProviderOptionLabel,
  formatTimestamp as formatAccountTimestamp,
  type ProviderOption,
} from "../settingsCodexAccountsCardUtils";
import { SettingsCodexAccountsSectionHeader } from "./SettingsCodexAccountsSectionHeader";
import type { FormBusyAction } from "./types";
import * as controlStyles from "./CodexAccountControls.css";

type SettingsCodexSharingTabProps = {
  onClose?: () => void;
  onRefresh: () => void;
  busyAction: FormBusyAction;
  sharingOverview: OAuthSharingOverview;
  providerOptions: ProviderOption[];
  pools: OAuthPoolSummary[];
};

function countBlockedLeases(leases: OAuthSharingLeaseSummary[]): number {
  return leases.filter(
    (lease) =>
      lease.status === "paused" ||
      lease.status === "expired" ||
      lease.status === "revoked" ||
      Boolean(lease.blockingReason)
  ).length;
}

function countBlockedCarpools(carpools: OAuthCarpoolSummary[]): number {
  return carpools.filter((carpool) => !carpool.enabled || Boolean(carpool.blockingReason)).length;
}

function formatBudget(used: number, budget: number | null): string {
  if (budget === null) {
    return `${used} turns`;
  }
  return `${used}/${budget} turns`;
}

function formatLimit(value: number | null): string {
  return value === null ? "Runtime policy" : String(value);
}

function formatOptionalTimestamp(value: number | null): string {
  return value === null ? "Runtime policy" : formatAccountTimestamp(value);
}

function buildStatusTone(
  state: OAuthSharingLeaseSummary["status"] | "enabled" | "disabled"
): "success" | "warning" | "default" {
  if (state === "active" || state === "enabled") {
    return "success";
  }
  if (state === "pending" || state === "paused") {
    return "warning";
  }
  return "default";
}

export function SettingsCodexSharingTab({
  onClose,
  onRefresh,
  busyAction,
  sharingOverview,
  providerOptions,
  pools,
}: SettingsCodexSharingTabProps) {
  const activeLeasesCount = sharingOverview.leases.filter(
    (lease) => lease.status === "active"
  ).length;
  const blockedRoutesCount =
    sharingOverview.usage?.blockedRoutesCount ??
    countBlockedLeases(sharingOverview.leases) + countBlockedCarpools(sharingOverview.carpools);
  const borrowedCapacityCount =
    sharingOverview.leases.filter((lease) => lease.borrowerWorkspaceId !== null).length +
    sharingOverview.carpools.reduce(
      (total, carpool) => total + carpool.memberWorkspaceIds.length,
      0
    );
  const providerSelectOptions: SelectOption[] = providerOptions.map((provider) => ({
    value: provider.id,
    label: formatProviderOptionLabel(provider),
    disabled: provider.available === false,
  }));
  const poolSelectOptions: SelectOption[] = [
    { value: "", label: "Select pool" },
    ...pools.map((pool) => ({
      value: pool.poolId,
      label: `${pool.name} (${formatProvider(pool.provider, providerOptions)})`,
    })),
  ];
  const sharingReady = sharingOverview.status === "ready";

  return (
    <div className="apm-tab-content">
      <SettingsCodexAccountsSectionHeader
        title="Sharing"
        description="Shared access, team pools, and borrowed capacity."
        onRefresh={onRefresh}
        refreshing={busyAction === "refresh"}
        onClose={onClose}
      />

      <div className="apm-overview-grid">
        <div className="apm-overview-card">
          <div className="apm-overview-label">Active Leases</div>
          <div className="apm-overview-value">{activeLeasesCount}</div>
        </div>
        <div className="apm-overview-card">
          <div className="apm-overview-label">Carpools</div>
          <div className="apm-overview-value">{sharingOverview.carpools.length}</div>
        </div>
        <div className="apm-overview-card">
          <div className="apm-overview-label">Borrowed Capacity</div>
          <div className="apm-overview-value">{borrowedCapacityCount}</div>
        </div>
        <div className="apm-overview-card">
          <div className="apm-overview-label">Blocked Routes</div>
          <div className="apm-overview-value">{blockedRoutesCount}</div>
        </div>
      </div>

      {sharingOverview.unavailableReason ? (
        <div className="apm-hint apm-sharing-unavailable">{sharingOverview.unavailableReason}</div>
      ) : null}
      <div className="apm-hint">
        Sharing selection remains runtime-owned; this surface only edits and reads shared access
        state.
      </div>

      <section className="apm-form-section">
        <div className="apm-form-title">Prepare shared access</div>
        <div className="apm-form-row">
          <div className="apm-field">
            <span className="apm-field-label">Provider</span>
            <Select
              className={controlStyles.selectRoot}
              triggerClassName={controlStyles.selectTrigger}
              menuClassName={controlStyles.selectMenu}
              optionClassName={controlStyles.selectOption}
              ariaLabel="Sharing provider"
              options={providerSelectOptions}
              value={providerOptions[0]?.id ?? "codex"}
              onValueChange={() => undefined}
              disabled={!sharingReady}
            />
          </div>
          <div className="apm-field apm-field--flex-1">
            <span className="apm-field-label">Pool</span>
            <Select
              className={controlStyles.selectRoot}
              triggerClassName={controlStyles.selectTrigger}
              menuClassName={controlStyles.selectMenu}
              optionClassName={controlStyles.selectOption}
              ariaLabel="Sharing pool"
              options={poolSelectOptions}
              value=""
              onValueChange={() => undefined}
              disabled={!sharingReady || pools.length === 0}
            />
          </div>
          <div className="apm-field apm-field--flex-1">
            <span className="apm-field-label">Borrower workspace</span>
            <Input
              fieldClassName={controlStyles.inputField}
              inputSize="sm"
              value=""
              placeholder="Workspace id"
              onValueChange={() => undefined}
              disabled={!sharingReady}
              aria-label="Borrower workspace"
            />
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={!sharingReady}
            aria-label="Create shared access lease"
          >
            Create lease
          </Button>
        </div>
      </section>

      <div className="apm-sharing-grid">
        <section className="apm-list-shell">
          <div className="apm-list-heading">
            <Share2 className="apm-list-heading-icon" aria-hidden />
            <span>Leases</span>
          </div>
          <div className="apm-list apm-sharing-list">
            {sharingOverview.leases.length === 0 ? (
              <div className="apm-empty-state">
                <div className="apm-empty-title">No shared access leases</div>
                <div className="apm-empty-detail">
                  Runtime-backed leases will appear here after HugeRouter publishes sharing state.
                </div>
              </div>
            ) : (
              sharingOverview.leases.map((lease) => (
                <div key={lease.leaseId} className="apm-row apm-row--sharing">
                  <div className="apm-row-info">
                    <div className="apm-row-name">{lease.leaseId}</div>
                    <div className="apm-row-meta">
                      <span>{formatProvider(lease.provider, providerOptions)}</span>
                      <span>{lease.poolId}</span>
                      <span>{lease.borrowerWorkspaceId ?? "No borrower"}</span>
                    </div>
                    <div className="apm-row-detail">
                      {formatBudget(lease.turnsUsed, lease.turnBudget)} · concurrency{" "}
                      {formatLimit(lease.maxConcurrentRuns)} · expires{" "}
                      {formatOptionalTimestamp(lease.expiresAt)}
                    </div>
                    {lease.blockingReason ? (
                      <div className="apm-hint apm-sharing-row-hint">{lease.blockingReason}</div>
                    ) : null}
                  </div>
                  <StatusBadge className="apm-status-chip" tone={buildStatusTone(lease.status)}>
                    {lease.status}
                  </StatusBadge>
                  <Button type="button" variant="ghost" size="sm" disabled={!sharingReady}>
                    Revoke
                  </Button>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="apm-list-shell">
          <div className="apm-list-heading">
            <Share2 className="apm-list-heading-icon" aria-hidden />
            <span>Team Pools</span>
          </div>
          <div className="apm-list apm-sharing-list">
            {sharingOverview.carpools.length === 0 ? (
              <div className="apm-empty-state">
                <div className="apm-empty-title">No team pools</div>
                <div className="apm-empty-detail">
                  Team pool membership and budgets stay read from runtime sharing state.
                </div>
              </div>
            ) : (
              sharingOverview.carpools.map((carpool) => (
                <div key={carpool.carpoolId} className="apm-row apm-row--sharing">
                  <div className="apm-row-info">
                    <div className="apm-row-name">{carpool.name}</div>
                    <div className="apm-row-meta">
                      <span>{formatProvider(carpool.provider, providerOptions)}</span>
                      <span>{carpool.memberWorkspaceIds.length} members</span>
                      <span>{carpool.poolIds.length} pools</span>
                    </div>
                    <div className="apm-row-detail">
                      {carpool.strategy} · concurrency{" "}
                      {formatLimit(carpool.perMemberConcurrencyLimit)} · budget{" "}
                      {formatLimit(carpool.perMemberTurnBudget)}
                    </div>
                    {carpool.blockingReason ? (
                      <div className="apm-hint apm-sharing-row-hint">{carpool.blockingReason}</div>
                    ) : null}
                  </div>
                  <StatusBadge
                    className="apm-status-chip"
                    tone={buildStatusTone(carpool.enabled ? "enabled" : "disabled")}
                  >
                    {carpool.enabled ? "enabled" : "disabled"}
                  </StatusBadge>
                  <Button type="button" variant="ghost" size="sm" disabled={!sharingReady}>
                    Edit
                  </Button>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
