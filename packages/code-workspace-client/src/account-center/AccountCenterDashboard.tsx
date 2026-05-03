import {
  accountActions,
  accountCenterContent,
  accountCenterHeader,
  accountCenterHeaderRow,
  accountCenterMeta,
  accountCenterShell,
  accountCenterSubtitle,
  accountCenterTitle,
  accountGrid,
  accountList,
  accountListItem,
  authImportActions,
  authImportFileInput,
  authImportFormat,
  authImportFormatContent,
  authImportFormatHeader,
  authImportFormats,
  authImportTextarea,
  panel,
  panelTitle,
  panelText,
  primaryActionButton,
  secondaryActionButton,
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
import { useEffect, useState } from "react";
import { Check, Clipboard, FileUp, KeyRound, LogIn, RefreshCw, Route } from "lucide-react";
import { useSharedAccountCenterState } from "./accountCenterState";

export function AccountCenterDashboard() {
  const accountCenter = useSharedAccountCenterState();
  const [authJsonContent, setAuthJsonContent] = useState("");
  const [authJsonSourceLabel, setAuthJsonSourceLabel] = useState<string | null>(null);
  const [copiedFormatId, setCopiedFormatId] = useState<string | null>(null);

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
          <div className={accountCenterHeaderRow}>
            <div>
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
            </div>
            <button
              type="button"
              className={primaryActionButton}
              disabled={accountCenter.codex.connecting}
              onClick={() => {
                void accountCenter.connectCodexAccount();
              }}
            >
              <LogIn size={16} aria-hidden="true" />
              {accountCenter.codex.connecting ? "Signing in" : "Sign in with Codex"}
            </button>
          </div>
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
            <h2 className={panelTitle}>Codex Accounts</h2>
            <p className={panelText}>Choose the account used by the built-in Codex route.</p>
            <ul className={accountList}>
              {accountCenter.codex.connectedAccounts.map((account) => {
                const defaultRouteBusy =
                  accountCenter.codex.defaultRouteBusyAccountId === account.accountId;
                const reauthenticating =
                  accountCenter.codex.reauthenticatingAccountId === account.accountId;
                return (
                  <li key={account.accountId} className={accountListItem}>
                    <div>
                      <strong>{account.label}</strong>
                      <div className={workspaceListMeta}>
                        {account.isDefaultRoute ? "Default route" : account.status} -{" "}
                        {account.updatedAtLabel}
                      </div>
                    </div>
                    <div className={accountActions}>
                      <button
                        type="button"
                        className={secondaryActionButton}
                        disabled={account.isDefaultRoute || defaultRouteBusy}
                        onClick={() => {
                          void accountCenter.setCodexDefaultRouteAccount(account.accountId);
                        }}
                      >
                        {account.isDefaultRoute ? (
                          <Check size={14} aria-hidden="true" />
                        ) : (
                          <Route size={14} aria-hidden="true" />
                        )}
                        {account.isDefaultRoute ? "Default" : "Use"}
                      </button>
                      <button
                        type="button"
                        className={secondaryActionButton}
                        disabled={!account.canReauthenticate || reauthenticating}
                        onClick={() => {
                          void accountCenter.reauthenticateCodexAccount(account.accountId);
                        }}
                      >
                        <RefreshCw size={14} aria-hidden="true" />
                        {reauthenticating ? "Signing in" : "Refresh"}
                      </button>
                    </div>
                  </li>
                );
              })}
              {accountCenter.codex.connectedAccounts.length === 0 ? (
                <li className={accountListItem}>
                  <div>
                    <strong>No Codex account connected</strong>
                    <div className={workspaceListMeta}>Sign in to create a runtime route.</div>
                  </div>
                </li>
              ) : null}
            </ul>
          </article>

          <article className={panel}>
            <h2 className={panelTitle}>Import Codex auth.json</h2>
            <p className={panelText}>
              Paste Codex auth.json or select a local file to import a routable account and generate
              CPA/Sub2API-compatible token bundles.
            </p>
            <textarea
              className={authImportTextarea}
              spellCheck={false}
              value={authJsonContent}
              placeholder='{"auth_mode":"chatgpt","tokens":{...}}'
              onChange={(event) => {
                setAuthJsonContent(event.target.value);
                setAuthJsonSourceLabel((current) => current ?? "pasted");
              }}
            />
            <div className={authImportActions}>
              <label className={secondaryActionButton}>
                <FileUp size={14} aria-hidden="true" />
                <span>Select file</span>
                <input
                  className={authImportFileInput}
                  type="file"
                  accept=".json,application/json"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    if (!file) {
                      return;
                    }
                    void file.text().then((content) => {
                      setAuthJsonContent(content);
                      setAuthJsonSourceLabel(file.name);
                    });
                  }}
                />
              </label>
              <button
                type="button"
                className={primaryActionButton}
                disabled={
                  accountCenter.codex.authJsonImporting || authJsonContent.trim().length === 0
                }
                onClick={() => {
                  void accountCenter.importCodexAuthJson({
                    authJson: authJsonContent,
                    sourceLabel: authJsonSourceLabel ?? "pasted",
                  });
                }}
              >
                <KeyRound size={16} aria-hidden="true" />
                {accountCenter.codex.authJsonImporting ? "Importing" : "Import"}
              </button>
            </div>
            {accountCenter.codex.authJsonImportResult ? (
              <div className={authImportFormats}>
                {accountCenter.codex.authJsonImportResult.formats.map((format) => (
                  <div key={format.formatId} className={authImportFormat}>
                    <div className={authImportFormatHeader}>
                      <div>
                        <strong>{format.fileName}</strong>
                        <div className={workspaceListMeta}>{format.notes.join(" ")}</div>
                      </div>
                      <button
                        type="button"
                        className={secondaryActionButton}
                        onClick={() => {
                          void navigator.clipboard.writeText(format.content).then(() => {
                            setCopiedFormatId(format.formatId);
                          });
                        }}
                      >
                        <Clipboard size={14} aria-hidden="true" />
                        {copiedFormatId === format.formatId ? "Copied" : "Copy"}
                      </button>
                    </div>
                    <pre className={authImportFormatContent}>{format.content}</pre>
                  </div>
                ))}
              </div>
            ) : null}
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
