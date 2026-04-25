import Activity from "lucide-react/dist/esm/icons/activity";
import Layers from "lucide-react/dist/esm/icons/layers";
import Share2 from "lucide-react/dist/esm/icons/share-2";
import Users from "lucide-react/dist/esm/icons/users";
import { StatusBadge } from "../../../../../design-system";
import type { AccountPoolsTab } from "./types";

type SettingsCodexAccountsNavigationProps = {
  activeTab: AccountPoolsTab;
  accountsCount: number;
  poolsCount: number;
  sharingCount: number;
  routingReadyCount: number;
  providerHealthCount: number;
  onTabChange: (tab: AccountPoolsTab) => void;
};

export function SettingsCodexAccountsNavigation({
  activeTab,
  accountsCount,
  poolsCount,
  sharingCount,
  routingReadyCount,
  providerHealthCount,
  onTabChange,
}: SettingsCodexAccountsNavigationProps) {
  const healthyProvidersLabel =
    providerHealthCount > 0 ? `${routingReadyCount}/${providerHealthCount}` : "0";

  return (
    <div className="apm-nav" role="tablist" aria-label="Account management sections">
      <div className="apm-nav-header">
        <div className="apm-nav-title">Account routing</div>
        <div className="apm-nav-subtitle">Accounts, pools, and provider health.</div>
        <div className="apm-nav-overview" aria-hidden>
          <div className="apm-nav-stat">
            <span className="apm-nav-stat-label">Accounts</span>
            <span className="apm-nav-stat-value">{accountsCount}</span>
          </div>
          <div className="apm-nav-stat">
            <span className="apm-nav-stat-label">Pools</span>
            <span className="apm-nav-stat-value">{poolsCount}</span>
          </div>
          <div className="apm-nav-stat">
            <span className="apm-nav-stat-label">Healthy</span>
            <span className="apm-nav-stat-value">{healthyProvidersLabel}</span>
          </div>
        </div>
      </div>
      <button
        type="button"
        role="tab"
        className={`apm-nav-item ${activeTab === "accounts" ? "is-active" : ""}`}
        onClick={() => onTabChange("accounts")}
        aria-selected={activeTab === "accounts"}
      >
        <Users className="apm-nav-icon" aria-hidden />
        <span className="apm-nav-label">Accounts</span>
        <StatusBadge className="apm-nav-badge">{accountsCount}</StatusBadge>
      </button>
      <button
        type="button"
        role="tab"
        className={`apm-nav-item ${activeTab === "pools" ? "is-active" : ""}`}
        onClick={() => onTabChange("pools")}
        aria-selected={activeTab === "pools"}
      >
        <Layers className="apm-nav-icon" aria-hidden />
        <span className="apm-nav-label">Pools</span>
        <StatusBadge className="apm-nav-badge">{poolsCount}</StatusBadge>
      </button>
      <button
        type="button"
        role="tab"
        className={`apm-nav-item ${activeTab === "sharing" ? "is-active" : ""}`}
        onClick={() => onTabChange("sharing")}
        aria-selected={activeTab === "sharing"}
      >
        <Share2 className="apm-nav-icon" aria-hidden />
        <span className="apm-nav-label">Sharing</span>
        <StatusBadge className="apm-nav-badge">{sharingCount}</StatusBadge>
      </button>
      <button
        type="button"
        role="tab"
        className={`apm-nav-item ${activeTab === "health" ? "is-active" : ""}`}
        onClick={() => onTabChange("health")}
        aria-selected={activeTab === "health"}
      >
        <Activity className="apm-nav-icon" aria-hidden />
        <span className="apm-nav-label">Health</span>
        <StatusBadge className="apm-nav-badge">
          {routingReadyCount}/{providerHealthCount}
        </StatusBadge>
      </button>
    </div>
  );
}
