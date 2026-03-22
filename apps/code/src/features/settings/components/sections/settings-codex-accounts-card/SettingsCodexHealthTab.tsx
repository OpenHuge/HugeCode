import type { RefObject } from "react";
import { Avatar } from "../../../../../design-system";
import { StatusBadge } from "../../../../../design-system";
import { Text } from "../../../../../design-system";
import { providerMonogram, ratioPercent } from "../settingsCodexAccountsCardUtils";
import { SettingsCodexAccountsSectionHeader } from "./SettingsCodexAccountsSectionHeader";
import type { FormBusyAction } from "./types";

export type ProviderRoutingHealthEntry = {
  providerId: string;
  providerLabel: string;
  poolRoutingReady: boolean;
  recommendation: string | null;
  accountsTotal: number;
  enabledAccounts: number;
  credentialReadyAccounts: number;
  poolsTotal: number;
  enabledPools: number;
};

type SettingsCodexHealthTabProps = {
  onClose?: () => void;
  onRefresh: () => void;
  busyAction: FormBusyAction;
  healthSectionRef: RefObject<HTMLDivElement | null>;
  providerPoolRoutingHealth: ProviderRoutingHealthEntry[];
  routingReadyCount: number;
};

export function SettingsCodexHealthTab({
  onClose,
  onRefresh,
  busyAction,
  healthSectionRef,
  providerPoolRoutingHealth,
  routingReadyCount,
}: SettingsCodexHealthTabProps) {
  const providersTotal = providerPoolRoutingHealth.length;
  const enabledAccountsTotal = providerPoolRoutingHealth.reduce(
    (total, entry) => total + entry.enabledAccounts,
    0
  );
  const credentialReadyTotal = providerPoolRoutingHealth.reduce(
    (total, entry) => total + entry.credentialReadyAccounts,
    0
  );
  const enabledPoolsTotal = providerPoolRoutingHealth.reduce(
    (total, entry) => total + entry.enabledPools,
    0
  );

  return (
    <div className="apm-tab-content">
      <SettingsCodexAccountsSectionHeader
        title="Pool Routing Health"
        description={`${routingReadyCount}/${providerPoolRoutingHealth.length} providers ready.`}
        onRefresh={onRefresh}
        refreshing={busyAction === "refresh"}
        onClose={onClose}
      />

      <div className="apm-overview-grid">
        <div className="apm-overview-card">
          <div className="apm-overview-label">Ready Providers</div>
          <div className="apm-overview-value">
            {routingReadyCount}/{providersTotal}
          </div>
        </div>
        <div className="apm-overview-card">
          <div className="apm-overview-label">Enabled Accounts</div>
          <div className="apm-overview-value">{enabledAccountsTotal}</div>
        </div>
        <div className="apm-overview-card">
          <div className="apm-overview-label">Credential Ready</div>
          <div className="apm-overview-value">{credentialReadyTotal}</div>
        </div>
        <div className="apm-overview-card">
          <div className="apm-overview-label">Enabled Pools</div>
          <div className="apm-overview-value">{enabledPoolsTotal}</div>
        </div>
      </div>

      <div ref={healthSectionRef} className="apm-list apm-health-list apm-list-shell">
        {providerPoolRoutingHealth.map((entry) => {
          const accountsPercent = ratioPercent(entry.enabledAccounts, entry.accountsTotal);
          const credentialsPercent = ratioPercent(
            entry.credentialReadyAccounts,
            entry.enabledAccounts
          );
          const poolsPercent = ratioPercent(entry.enabledPools, entry.poolsTotal);
          const healthScore = Math.round((accountsPercent + credentialsPercent + poolsPercent) / 3);
          const healthMetaParts = [
            `Accounts ${entry.enabledAccounts}/${entry.accountsTotal}`,
            `Credentials ${entry.credentialReadyAccounts}/${entry.enabledAccounts}`,
            `Pools ${entry.enabledPools}/${entry.poolsTotal}`,
          ];

          return (
            <div
              key={`health-${entry.providerId}`}
              className={`apm-row apm-row--health ${entry.poolRoutingReady ? "is-ready" : "is-warning"}`}
            >
              <Avatar
                className="apm-row-avatar"
                size="lg"
                shape="rounded"
                aria-hidden="true"
                fallback={providerMonogram(entry.providerLabel)}
              />
              <div className="apm-row-info">
                <Text as="div" className="apm-row-name" size="fine" tone="strong" weight="semibold">
                  {entry.providerLabel}
                </Text>
                <Text as="div" className="apm-row-meta" size="meta" tone="muted">
                  {healthMetaParts.map((part) => (
                    <span key={`${entry.providerId}-${part}`}>{part}</span>
                  ))}
                </Text>
                <Text as="div" className="apm-row-detail" size="fine" tone="faint">
                  {entry.poolRoutingReady
                    ? "Provider is ready for pool routing."
                    : "Routing attention needed before traffic can shift here."}
                </Text>
              </div>
              <StatusBadge
                className={`apm-status-chip ${entry.poolRoutingReady ? "is-enabled" : "is-warning"}`}
                tone={entry.poolRoutingReady ? "success" : "warning"}
              >
                {entry.poolRoutingReady ? "Ready" : "Attention"}
              </StatusBadge>
              <div className="apm-health-score">{healthScore}%</div>
              <div className="apm-health-meters">
                <div className="apm-health-meter">
                  <div className="apm-health-meter-head">
                    <span>Accounts</span>
                    <span>
                      {entry.enabledAccounts}/{entry.accountsTotal}
                    </span>
                  </div>
                  <div className="apm-health-track">
                    <progress
                      className="apm-health-progress apm-health-progress--accounts"
                      value={accountsPercent}
                      max={100}
                      aria-label="Accounts health"
                    />
                  </div>
                </div>
                <div className="apm-health-meter">
                  <div className="apm-health-meter-head">
                    <span>Credentials</span>
                    <span>
                      {entry.credentialReadyAccounts}/{entry.enabledAccounts}
                    </span>
                  </div>
                  <div className="apm-health-track">
                    <progress
                      className="apm-health-progress apm-health-progress--credentials"
                      value={credentialsPercent}
                      max={100}
                      aria-label="Credentials health"
                    />
                  </div>
                </div>
                <div className="apm-health-meter">
                  <div className="apm-health-meter-head">
                    <span>Pools</span>
                    <span>
                      {entry.enabledPools}/{entry.poolsTotal}
                    </span>
                  </div>
                  <div className="apm-health-track">
                    <progress
                      className="apm-health-progress apm-health-progress--pools"
                      value={poolsPercent}
                      max={100}
                      aria-label="Pools health"
                    />
                  </div>
                </div>
              </div>
              {entry.recommendation ? (
                <div className="apm-hint apm-health-hint">{entry.recommendation}</div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
