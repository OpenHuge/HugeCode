import {
  accountCenterContent,
  accountCenterHeader,
  accountCenterMeta,
  accountCenterShell,
  accountCenterSubtitle,
  accountCenterTitle,
  accountGrid,
  panel,
  panelTitle,
  panelText,
  statList,
  statRow,
  statLabel,
  statValue,
  usageItem,
  usageItemHeader,
  usageBarSession,
  usageBarWeekly,
  usageTrack,
  workspaceList,
  workspaceListItem,
  workspaceListMeta,
} from "./AccountCenter.css";
import { useEffect } from "react";
import { useSharedAccountCenterState } from "./accountCenterState";

export function AccountCenterDashboard() {
  const accountCenter = useSharedAccountCenterState();

  useEffect(() => {
    void accountCenter.refresh();
  }, [accountCenter.refresh]);

  const providerStats = accountCenter.providers.map((provider) => ({
    id: provider.providerId,
    label: provider.label,
    value: `${provider.enabledCount} / ${provider.totalCount} Connected`,
  }));
  const sessionCoveragePercent =
    accountCenter.providers[0]?.totalCount && accountCenter.providers[0].totalCount > 0
      ? Math.round(
          (accountCenter.providers[0].enabledCount / accountCenter.providers[0].totalCount) * 100
        )
      : 0;
  const weeklyCoveragePercent =
    accountCenter.providers.length > 0
      ? Math.round(
          (accountCenter.providers.reduce((sum, provider) => sum + provider.enabledCount, 0) /
            Math.max(
              1,
              accountCenter.providers.reduce((sum, provider) => sum + provider.totalCount, 0)
            )) *
            100
        )
      : 0;

  return (
    <div className={accountCenterShell}>
      <div className={accountCenterContent}>
        <header className={accountCenterHeader}>
          <h1 className={accountCenterTitle}>Account Center</h1>
          <p className={accountCenterSubtitle}>
            Manage workspace account routing, provider health, and usage visibility.
          </p>
          <p className={accountCenterMeta}>
            {accountCenter.loading
              ? "Loading runtime-backed account state"
              : accountCenter.error
                ? accountCenter.error
                : `Default Codex route: ${accountCenter.codex.defaultRouteAccountLabel}`}
          </p>
        </header>

        <section className={accountGrid} aria-label="Account center overview">
          <article className={panel}>
            <h2 className={panelTitle}>Provider Summary</h2>
            <p className={panelText}>
              Keep default route coverage stable across enabled providers.
            </p>
            <dl className={statList}>
              {providerStats.map((provider) => (
                <div key={provider.id} className={statRow}>
                  <dt className={statLabel}>{provider.label}</dt>
                  <dd className={statValue}>{provider.value}</dd>
                </div>
              ))}
            </dl>
          </article>

          <article className={panel}>
            <h2 className={panelTitle}>Routing Snapshot</h2>
            <div className={usageItem}>
              <div className={usageItemHeader}>
                <span>Codex Coverage</span>
                <span>{sessionCoveragePercent}%</span>
              </div>
              <div className={usageTrack} aria-label="Session usage">
                <div className={usageBarSession} />
              </div>
            </div>
            <div className={usageItem}>
              <div className={usageItemHeader}>
                <span>Provider Coverage</span>
                <span>{weeklyCoveragePercent}%</span>
              </div>
              <div className={usageTrack} aria-label="Weekly usage">
                <div className={usageBarWeekly} />
              </div>
            </div>
          </article>

          <article className={panel}>
            <h2 className={panelTitle}>Workspace Accounts</h2>
            <ul className={workspaceList}>
              {accountCenter.workspaceAccounts.map((item) => (
                <li key={item.workspaceId} className={workspaceListItem}>
                  <div>
                    <strong>{item.workspaceName}</strong>
                    <div className={workspaceListMeta}>{item.accountLabel}</div>
                  </div>
                  <span className={workspaceListMeta}>Plan {item.planLabel}</span>
                </li>
              ))}
              {accountCenter.workspaceAccounts.length === 0 ? (
                <li className={workspaceListItem}>
                  <div>
                    <strong>No workspaces discovered</strong>
                    <div className={workspaceListMeta}>
                      Connect a runtime-backed workspace to manage account routing.
                    </div>
                  </div>
                </li>
              ) : null}
            </ul>
          </article>
        </section>
      </div>
    </div>
  );
}
