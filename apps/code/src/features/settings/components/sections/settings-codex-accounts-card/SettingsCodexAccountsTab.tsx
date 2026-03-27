import type { Dispatch, KeyboardEvent, RefObject, SetStateAction } from "react";
import type {
  OAuthAccountSummary,
  OAuthSubscriptionPersistenceCapability,
} from "../../../../../application/runtime/ports/tauriOauth";
import { Avatar } from "../../../../../design-system";
import { Button } from "../../../../../design-system";
import { Input } from "../../../../../design-system";
import { Select, type SelectOption } from "../../../../../design-system";
import { StatusBadge } from "../../../../../design-system";
import type { ProviderBrandId } from "../../../../app/utils/antiGravityBranding";
import {
  formatProvider,
  formatProviderBrand,
  formatProviderOptionLabel,
  formatTimestamp,
  type ProviderOption,
  providerMonogram,
  readAccountUsageSnapshot,
} from "../settingsCodexAccountsCardUtils";
import { isLocalCliManagedAccount } from "./oauthHelpers";
import { SettingsCodexAccountsSectionHeader } from "./SettingsCodexAccountsSectionHeader";
import type { AccountStatusFilter, FormBusyAction, ProviderFilter } from "./types";
import * as controlStyles from "./CodexAccountControls.css";

type JsonRecord = Record<string, unknown>;

type AccountQuotaItem = {
  key: "session" | "weekly";
  label: string;
  percent: number;
  resetText: string | null;
  tone: "success" | "warning";
};

function asRecord(value: unknown): JsonRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as JsonRecord;
}

function readNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readMetadataText(metadata: JsonRecord | null, keys: readonly string[]): string | null {
  if (!metadata) {
    return null;
  }
  for (const key of keys) {
    const value = readNonEmptyString(metadata[key]);
    if (value) {
      return value;
    }
  }
  return null;
}

function formatLoginMethod(value: string | null): string {
  if (!value) {
    return "OAuth";
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "google") {
    return "Google";
  }
  if (normalized === "github") {
    return "GitHub";
  }
  if (normalized === "microsoft") {
    return "Microsoft";
  }
  if (normalized === "apple") {
    return "Apple";
  }
  if (normalized === "openai") {
    return "OpenAI";
  }
  if (normalized === "email" || normalized === "password") {
    return normalized[0]?.toUpperCase() + normalized.slice(1);
  }
  return normalized
    .split(/[\s_-]+/)
    .filter((part) => part.length > 0)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function readTeamName(account: OAuthAccountSummary): string | null {
  const defaultWorkspace =
    account.chatgptWorkspaces?.find(
      (workspace) =>
        workspace.workspaceId === account.defaultChatgptWorkspaceId || workspace.isDefault
    ) ?? null;
  const titledWorkspace =
    defaultWorkspace ??
    account.chatgptWorkspaces?.find((workspace) => readNonEmptyString(workspace.title) !== null) ??
    null;
  const titledWorkspaceName = readNonEmptyString(titledWorkspace?.title);
  if (titledWorkspaceName) {
    return titledWorkspaceName;
  }

  const metadata = asRecord(account.metadata);
  return readMetadataText(metadata, [
    "teamName",
    "team_name",
    "organizationName",
    "organization_name",
    "workspaceTitle",
    "workspace_title",
    "accountName",
    "account_name",
  ]);
}

function readLoginMethod(account: OAuthAccountSummary): string {
  const metadata = asRecord(account.metadata);
  return formatLoginMethod(
    readMetadataText(metadata, [
      "authProvider",
      "auth_provider",
      "loginProvider",
      "login_provider",
      "identityProvider",
      "identity_provider",
      "authMethod",
      "auth_method",
    ])
  );
}

function readUserId(account: OAuthAccountSummary): string {
  const metadata = asRecord(account.metadata);
  return (
    readMetadataText(metadata, [
      "userId",
      "user_id",
      "externalUserId",
      "external_user_id",
      "chatgptAccountId",
      "chatgpt_account_id",
      "externalAccountId",
      "external_account_id",
    ]) ??
    readNonEmptyString(account.externalAccountId) ??
    account.accountId
  );
}

function buildQuotaItems(account: OAuthAccountSummary): AccountQuotaItem[] {
  const usageSnapshot = readAccountUsageSnapshot(account);
  if (!usageSnapshot) {
    return [];
  }

  const items: AccountQuotaItem[] = [];
  if (usageSnapshot.session.usedPercent !== null) {
    items.push({
      key: "session",
      label: "Session",
      percent: usageSnapshot.session.usedPercent,
      resetText: usageSnapshot.session.resetsAt
        ? formatTimestamp(usageSnapshot.session.resetsAt)
        : null,
      tone: "success",
    });
  }
  if (usageSnapshot.weekly.usedPercent !== null) {
    items.push({
      key: "weekly",
      label: "Weekly",
      percent: usageSnapshot.weekly.usedPercent,
      resetText: usageSnapshot.weekly.resetsAt
        ? formatTimestamp(usageSnapshot.weekly.resetsAt)
        : null,
      tone: usageSnapshot.weekly.usedPercent >= 80 ? "success" : "warning",
    });
  }
  return items;
}

function formatChatgptWorkspaceLabel(
  workspace: NonNullable<OAuthAccountSummary["chatgptWorkspaces"]>[number]
): string {
  const title = workspace.title?.trim() || workspace.workspaceId;
  const role = workspace.role?.trim() || null;
  return role ? `${title} (${role})` : title;
}

type SettingsCodexAccountsTabProps = {
  onClose?: () => void;
  onRefresh: () => void;
  importSummary: string | null;
  busyAction: FormBusyAction;
  accountCreateSectionRef: RefObject<HTMLElement | null>;
  providerOptions: ProviderOption[];
  selectedAccountProvider: ProviderOption | null;
  accountProviderDraft: ProviderBrandId;
  setAccountProviderDraft: Dispatch<SetStateAction<ProviderBrandId>>;
  codexProviderSelected: boolean;
  codexAuthRequired: boolean | null;
  accountEmailDraft: string;
  setAccountEmailDraft: Dispatch<SetStateAction<string>>;
  accountDisplayNameDraft: string;
  setAccountDisplayNameDraft: Dispatch<SetStateAction<string>>;
  accountPlanDraft: string;
  setAccountPlanDraft: Dispatch<SetStateAction<string>>;
  accountCompatBaseUrlDraft: string;
  setAccountCompatBaseUrlDraft: Dispatch<SetStateAction<string>>;
  accountProxyIdDraft: string;
  setAccountProxyIdDraft: Dispatch<SetStateAction<string>>;
  onAddAccount: () => void;
  onImportCockpitTools: () => void;
  accountProviderFilter: ProviderFilter;
  setAccountProviderFilter: Dispatch<SetStateAction<ProviderFilter>>;
  accountStatusFilter: AccountStatusFilter;
  setAccountStatusFilter: Dispatch<SetStateAction<AccountStatusFilter>>;
  accountSearchQuery: string;
  setAccountSearchQuery: Dispatch<SetStateAction<string>>;
  accounts: OAuthAccountSummary[];
  visibleAccounts: OAuthAccountSummary[];
  selectedAccountIds: string[];
  setSelectedAccountIds: Dispatch<SetStateAction<string[]>>;
  selectedAccounts: OAuthAccountSummary[];
  selectedAccountIdSet: Set<string>;
  hiddenSelectedAccountsCount: number;
  onClearHiddenSelectedAccounts: () => void;
  onBulkAccountStatus: (nextStatus: "enabled" | "disabled") => void;
  onBulkRemoveAccounts: () => void;
  onRefreshUsage: (account: OAuthAccountSummary) => void;
  onToggleAccountStatus: (account: OAuthAccountSummary) => void;
  onReviewDeactivatedChatgptWorkspaces: (account: OAuthAccountSummary) => void;
  onUpdateDefaultChatgptWorkspace: (
    account: OAuthAccountSummary,
    chatgptWorkspaceId: string | null
  ) => void;
  onReauthenticateAccount: (account: OAuthAccountSummary) => void;
  onRemoveAccount: (account: OAuthAccountSummary) => void;
  subscriptionPersistenceCapability: OAuthSubscriptionPersistenceCapability;
};

export function SettingsCodexAccountsTab({
  onClose,
  onRefresh,
  importSummary,
  busyAction,
  accountCreateSectionRef,
  providerOptions,
  selectedAccountProvider,
  accountProviderDraft,
  setAccountProviderDraft,
  codexProviderSelected,
  codexAuthRequired,
  accountEmailDraft,
  setAccountEmailDraft,
  accountDisplayNameDraft,
  setAccountDisplayNameDraft,
  accountPlanDraft,
  setAccountPlanDraft,
  accountCompatBaseUrlDraft,
  setAccountCompatBaseUrlDraft,
  accountProxyIdDraft,
  setAccountProxyIdDraft,
  onAddAccount,
  onImportCockpitTools,
  accountProviderFilter,
  setAccountProviderFilter,
  accountStatusFilter,
  setAccountStatusFilter,
  accountSearchQuery,
  setAccountSearchQuery,
  accounts,
  visibleAccounts,
  selectedAccountIds,
  setSelectedAccountIds,
  selectedAccounts,
  selectedAccountIdSet,
  hiddenSelectedAccountsCount,
  onClearHiddenSelectedAccounts,
  onBulkAccountStatus,
  onBulkRemoveAccounts,
  onRefreshUsage,
  onToggleAccountStatus,
  onReviewDeactivatedChatgptWorkspaces,
  onUpdateDefaultChatgptWorkspace,
  onReauthenticateAccount,
  onRemoveAccount,
  subscriptionPersistenceCapability,
}: SettingsCodexAccountsTabProps) {
  const enabledAccountsCount = accounts.filter((account) => account.status === "enabled").length;
  const providerCount = new Set(accounts.map((account) => account.provider)).size;
  const connectedWorkspaceCount = new Set(
    accounts.flatMap((account) =>
      (account.chatgptWorkspaces ?? []).map((workspace) => workspace.workspaceId)
    )
  ).size;

  const handleEnterSubmit = (event: KeyboardEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (event.key !== "Enter") {
      return;
    }
    event.preventDefault();
    onAddAccount();
  };
  const accountProviderOptions: SelectOption[] = providerOptions.map((provider) => ({
    value: provider.id,
    label: formatProviderOptionLabel(provider),
    disabled: provider.available === false,
  }));
  const accountProviderFilterOptions: SelectOption[] = [
    { value: "all", label: "All providers" },
    ...providerOptions.map((provider) => ({
      value: provider.id,
      label: formatProviderOptionLabel(provider),
    })),
  ];
  const accountStatusFilterOptions: SelectOption[] = [
    { value: "all", label: "All statuses" },
    { value: "enabled", label: "enabled" },
    { value: "disabled", label: "disabled" },
    { value: "forbidden", label: "forbidden" },
    { value: "validation_blocked", label: "validation_blocked" },
  ];

  return (
    <div className="apm-tab-content">
      <SettingsCodexAccountsSectionHeader
        title="Accounts"
        description="Manage OAuth accounts for routing."
        onRefresh={onRefresh}
        refreshing={busyAction === "refresh"}
        onClose={onClose}
      />

      <div className="apm-overview-grid">
        <div className="apm-overview-card">
          <div className="apm-overview-label">Configured</div>
          <div className="apm-overview-value">{accounts.length}</div>
        </div>
        <div className="apm-overview-card">
          <div className="apm-overview-label">Enabled</div>
          <div className="apm-overview-value">{enabledAccountsCount}</div>
        </div>
        <div className="apm-overview-card">
          <div className="apm-overview-label">Providers</div>
          <div className="apm-overview-value">{providerCount}</div>
        </div>
        <div className="apm-overview-card">
          <div className="apm-overview-label">Workspaces</div>
          <div className="apm-overview-value">{connectedWorkspaceCount}</div>
        </div>
      </div>

      <section ref={accountCreateSectionRef} className="apm-form-section">
        <div className="apm-form-title">Add account</div>
        <div className="apm-form-row">
          <Select
            className={controlStyles.selectRoot}
            triggerClassName={controlStyles.selectTrigger}
            menuClassName={controlStyles.selectMenu}
            optionClassName={controlStyles.selectOption}
            ariaLabel="Account provider"
            options={accountProviderOptions}
            value={accountProviderDraft}
            onValueChange={(value) => setAccountProviderDraft(value as ProviderBrandId)}
          />
          {!codexProviderSelected && (
            <>
              <Input
                fieldClassName={controlStyles.inputField}
                inputSize="sm"
                value={accountEmailDraft}
                placeholder="Email (optional)"
                onValueChange={setAccountEmailDraft}
                onKeyDown={handleEnterSubmit}
                aria-label="Account email"
              />
              <Input
                fieldClassName={controlStyles.inputField}
                inputSize="sm"
                value={accountDisplayNameDraft}
                placeholder="Display name"
                onValueChange={setAccountDisplayNameDraft}
                onKeyDown={handleEnterSubmit}
                aria-label="Account display name"
              />
              <Input
                fieldClassName={controlStyles.inputField}
                inputSize="sm"
                value={accountPlanDraft}
                placeholder="Plan type (pro/team)"
                onValueChange={setAccountPlanDraft}
                onKeyDown={handleEnterSubmit}
                aria-label="Account plan type"
              />
              <Input
                fieldClassName={controlStyles.inputField}
                inputSize="sm"
                value={accountCompatBaseUrlDraft}
                placeholder="Compat base URL (optional)"
                onValueChange={setAccountCompatBaseUrlDraft}
                onKeyDown={handleEnterSubmit}
                aria-label="Account compat base URL"
              />
              <Input
                fieldClassName={controlStyles.inputField}
                inputSize="sm"
                value={accountProxyIdDraft}
                placeholder="Proxy ID (optional)"
                onValueChange={setAccountProxyIdDraft}
                onKeyDown={handleEnterSubmit}
                aria-label="Account proxy ID"
              />
            </>
          )}
          <Button
            variant="primary"
            size="sm"
            onClick={onAddAccount}
            disabled={busyAction === "add-account" || selectedAccountProvider?.available === false}
          >
            {busyAction === "add-account"
              ? codexProviderSelected
                ? "Starting OAuth…"
                : "Adding…"
              : codexProviderSelected
                ? "Sign in with OAuth"
                : "Add account"}
          </Button>
          {codexProviderSelected && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onImportCockpitTools}
              disabled={busyAction === "import-cockpit-tools"}
            >
              {busyAction === "import-cockpit-tools" ? "Importing…" : "Import from cockpit-tools"}
            </Button>
          )}
        </div>
        <div
          className={`apm-callout ${
            subscriptionPersistenceCapability.runtimeBacked ? "" : "apm-callout--warning"
          }`}
        >
          {codexProviderSelected && (
            <div className="apm-callout-line">
              Codex accounts use OAuth sign-in. Account metadata is persisted after login completes.
            </div>
          )}
          <div
            className={`apm-callout-line ${
              subscriptionPersistenceCapability.runtimeBacked ? "" : "apm-callout-line--warning"
            }`}
          >
            {subscriptionPersistenceCapability.summary}
          </div>
          <div className="apm-callout-line">
            ChatGPT workspaces are separate from project workspaces.
          </div>
          {codexProviderSelected && codexAuthRequired === true && (
            <div className="apm-callout-line apm-callout-line--warning">
              Codex account requires OpenAI auth. Click "Sign in with OAuth" to continue.
            </div>
          )}
          {importSummary && <div className="apm-callout-line">{importSummary}</div>}
        </div>
        {selectedAccountProvider?.available === false && (
          <div className="apm-callout apm-callout--warning">
            <div className="apm-callout-line apm-callout-line--warning">
              {selectedAccountProvider.label} is currently unavailable.
            </div>
          </div>
        )}
      </section>

      <div className="apm-list-shell">
        <div className="apm-toolbar apm-toolbar--stack">
          <div className="apm-toolbar-row">
            <div className="apm-toolbar-search">
              <Input
                fieldClassName={controlStyles.inputField}
                inputSize="sm"
                value={accountSearchQuery}
                placeholder="Search account, email, or ChatGPT workspace"
                onValueChange={setAccountSearchQuery}
                aria-label="Search accounts"
              />
            </div>
            <div className="apm-toolbar-filters">
              <Select
                className={controlStyles.selectRoot}
                triggerClassName={controlStyles.selectTrigger}
                menuClassName={controlStyles.selectMenu}
                optionClassName={controlStyles.selectOption}
                ariaLabel="Filter accounts by provider"
                options={accountProviderFilterOptions}
                value={accountProviderFilter}
                onValueChange={(value) => setAccountProviderFilter(value as ProviderFilter)}
                triggerDensity="compact"
              />
              <Select
                className={controlStyles.selectRoot}
                triggerClassName={controlStyles.selectTrigger}
                menuClassName={controlStyles.selectMenu}
                optionClassName={controlStyles.selectOption}
                ariaLabel="Filter accounts by status"
                options={accountStatusFilterOptions}
                value={accountStatusFilter}
                onValueChange={(value) => setAccountStatusFilter(value as AccountStatusFilter)}
                triggerDensity="compact"
              />
            </div>
            <div className="apm-toolbar-actions">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedAccountIds((previous) => {
                    const next = new Set(previous);
                    for (const account of visibleAccounts) {
                      next.add(account.accountId);
                    }
                    return Array.from(next);
                  });
                }}
                disabled={visibleAccounts.length === 0}
              >
                Select all
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedAccountIds([])}
                disabled={selectedAccountIds.length === 0}
              >
                Clear
              </Button>
            </div>
          </div>
          {selectedAccountIds.length > 0 && (
            <div className="apm-bulk-banner">
              <div className="apm-bulk-banner-copy">
                <div className="apm-bulk-banner-title">
                  {selectedAccounts.length} accounts selected
                </div>
                <div className="apm-bulk-banner-meta">
                  Apply status changes or removal across the current selection.
                </div>
              </div>
              <div className="apm-bulk-banner-actions">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onBulkAccountStatus("enabled")}
                  disabled={busyAction === "bulk-enable"}
                >
                  {busyAction === "bulk-enable" ? "Enabling…" : "Enable"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onBulkAccountStatus("disabled")}
                  disabled={busyAction === "bulk-disable"}
                >
                  {busyAction === "bulk-disable" ? "Disabling…" : "Disable"}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={onBulkRemoveAccounts}
                  disabled={busyAction === "bulk-remove"}
                >
                  {busyAction === "bulk-remove" ? "Removing…" : "Remove"}
                </Button>
                {hiddenSelectedAccountsCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={onClearHiddenSelectedAccounts}>
                    Clear {hiddenSelectedAccountsCount} hidden
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="apm-meta-line">
          <span>{visibleAccounts.length} visible</span>
          {selectedAccounts.length > 0 && <span>{selectedAccounts.length} selected</span>}
          {accountProviderFilter !== "all" && (
            <span>{formatProviderBrand(accountProviderFilter, providerOptions)}</span>
          )}
          {accountStatusFilter !== "all" && <span>{accountStatusFilter}</span>}
        </div>

        <div className="apm-list apm-list--accounts">
          {visibleAccounts.length === 0 && (
            <div className="apm-empty">
              {accounts.length === 0
                ? "No accounts configured."
                : "No accounts match the selected filters."}
            </div>
          )}
          {visibleAccounts.map((account) => {
            const chatgptWorkspaceMemberships = account.chatgptWorkspaces ?? [];
            const hasMultipleChatgptWorkspaces = chatgptWorkspaceMemberships.length > 1;
            const defaultWorkspaceBusy =
              busyAction === `set-account-default-workspace:${account.accountId}`;
            const reviewDeactivatedBusy =
              busyAction === `review-account-deactive-workspaces:${account.accountId}`;
            const leaveDeactivatedBusy =
              busyAction === `leave-account-deactive-workspaces:${account.accountId}`;
            const isEnabled = account.status === "enabled";
            const isDisabled = account.status === "disabled";
            const isMutableStatus = isEnabled || isDisabled;
            const localCliManaged = isLocalCliManagedAccount(account);
            const usageSnapshot = readAccountUsageSnapshot(account);
            const displayName =
              account.email?.trim() ||
              account.displayName?.trim() ||
              account.externalAccountId?.trim() ||
              account.accountId;
            const teamName = readTeamName(account);
            const loginMethod = readLoginMethod(account);
            const userId = readUserId(account);
            const quotaItems = buildQuotaItems(account);
            const usageResetParts: string[] = [];
            if (usageSnapshot?.checkedAt) {
              usageResetParts.push(`Usage checked ${formatTimestamp(usageSnapshot.checkedAt)}`);
            }
            const routeSummaryParts: string[] = [];
            if (account.routeConfig?.compatBaseUrl) {
              routeSummaryParts.push(`Compat ${account.routeConfig.compatBaseUrl}`);
            }
            if (account.routeConfig?.proxyId) {
              routeSummaryParts.push(`Proxy ${account.routeConfig.proxyId}`);
            }
            if (
              account.routeConfig?.priority !== null &&
              account.routeConfig?.priority !== undefined
            ) {
              routeSummaryParts.push(`Priority ${account.routeConfig.priority}`);
            }
            if (
              account.routeConfig?.concurrencyLimit !== null &&
              account.routeConfig?.concurrencyLimit !== undefined
            ) {
              routeSummaryParts.push(`Concurrency ${account.routeConfig.concurrencyLimit}`);
            }
            if (account.routeConfig?.schedulable === false) {
              routeSummaryParts.push("Routing paused");
            }
            const routingStateParts: string[] = [];
            if (account.routingState?.credentialReady === false) {
              routingStateParts.push("Credential missing");
            }
            if (account.routingState?.tempUnschedulableReason) {
              routingStateParts.push(account.routingState.tempUnschedulableReason);
            }
            if (account.routingState?.lastRoutingError) {
              routingStateParts.push(account.routingState.lastRoutingError);
            }
            const chatgptWorkspaceParts: string[] = [];
            if (account.defaultChatgptWorkspaceId) {
              chatgptWorkspaceParts.push(
                `Default ChatGPT workspace ${account.defaultChatgptWorkspaceId}`
              );
            }
            if (account.chatgptWorkspaces && account.chatgptWorkspaces.length > 0) {
              const labels = account.chatgptWorkspaces
                .map((workspace) => formatChatgptWorkspaceLabel(workspace))
                .filter((value) => value.length > 0);
              if (labels.length > 0) {
                chatgptWorkspaceParts.push(
                  `ChatGPT workspaces ${labels.slice(0, 3).join(", ")}${labels.length > 3 ? ` +${labels.length - 3}` : ""}`
                );
              }
            }
            const rowMetaParts = [
              formatProvider(account.provider, providerOptions),
              formatTimestamp(account.updatedAt),
            ];
            if (usageSnapshot?.planType) {
              rowMetaParts.push(`Plan ${usageSnapshot.planType}`);
            }
            if (chatgptWorkspaceMemberships.length > 0) {
              rowMetaParts.push(
                `${chatgptWorkspaceMemberships.length} workspace${chatgptWorkspaceMemberships.length === 1 ? "" : "s"}`
              );
            }
            return (
              <div
                key={account.accountId}
                className={`apm-row apm-row--account ${selectedAccountIdSet.has(account.accountId) ? "is-selected" : ""}`}
              >
                <div className="apm-row-topbar">
                  <label className="apm-row-check">
                    <input
                      type="checkbox"
                      checked={selectedAccountIdSet.has(account.accountId)}
                      onChange={(event) => {
                        const checked = event.target.checked;
                        setSelectedAccountIds((previous) => {
                          if (checked) {
                            if (previous.includes(account.accountId)) {
                              return previous;
                            }
                            return [...previous, account.accountId];
                          }
                          return previous.filter((entry) => entry !== account.accountId);
                        });
                      }}
                      aria-label={`Select account ${account.accountId}`}
                    />
                  </label>
                  <Avatar
                    className="apm-row-avatar"
                    size="lg"
                    shape="rounded"
                    aria-hidden="true"
                    fallback={providerMonogram(displayName || account.provider)}
                  />
                  <div className="apm-row-heading">
                    <div className="apm-row-name">{displayName}</div>
                    <div className="apm-row-meta">
                      {rowMetaParts.map((part) => (
                        <span key={`${account.accountId}-${part}`}>{part}</span>
                      ))}
                    </div>
                  </div>
                  <div className="apm-row-pills">
                    {usageSnapshot?.planType ? (
                      <StatusBadge className="apm-plan-chip" tone="progress">
                        {usageSnapshot.planType}
                      </StatusBadge>
                    ) : null}
                    <StatusBadge
                      className={`apm-status-chip ${
                        isEnabled ? "is-enabled" : isDisabled ? "is-disabled" : "is-muted"
                      }`}
                      tone={isEnabled ? "success" : isDisabled ? "error" : "default"}
                    >
                      {account.status}
                      {account.disabledReason ? ` (${account.disabledReason})` : ""}
                    </StatusBadge>
                  </div>
                </div>
                <div className="apm-row-info">
                  <div className="apm-row-identity">
                    {teamName ? (
                      <div className="apm-row-identity-line">
                        <span className="apm-row-identity-label">Team Name</span>
                        <span className="apm-row-identity-value">{teamName}</span>
                      </div>
                    ) : null}
                    <div className="apm-row-identity-line">
                      <span className="apm-row-identity-value">Signed in with {loginMethod}</span>
                      <span className="apm-row-identity-separator">|</span>
                      <span className="apm-row-identity-value">User ID: {userId}</span>
                    </div>
                  </div>

                  <div className="apm-quota-list">
                    {quotaItems.length > 0 ? (
                      quotaItems.map((item) => (
                        <div key={`${account.accountId}-${item.key}`} className="apm-quota-item">
                          <div className="apm-quota-header">
                            <span className="apm-quota-label">{item.label}</span>
                            <span className={`apm-quota-value is-${item.tone}`}>
                              {item.percent}%
                            </span>
                          </div>
                          <progress
                            className={`apm-quota-progress is-${item.tone}`}
                            aria-label={`${item.label} quota`}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={item.percent}
                            value={item.percent}
                            max={100}
                          />
                          {item.resetText ? (
                            <div className="apm-quota-reset">{item.resetText}</div>
                          ) : null}
                        </div>
                      ))
                    ) : (
                      <div className="apm-row-detail apm-row-detail--usage-meta">
                        No quota data available yet.
                      </div>
                    )}
                  </div>

                  {usageSnapshot?.creditsLabel || usageResetParts.length > 0 ? (
                    <div className="apm-row-support">
                      {usageSnapshot?.creditsLabel ? (
                        <StatusBadge className="apm-row-support-chip">
                          {usageSnapshot.creditsLabel}
                        </StatusBadge>
                      ) : null}
                      {usageResetParts.map((part) => (
                        <StatusBadge
                          key={`${account.accountId}-${part}`}
                          className="apm-row-support-chip"
                        >
                          {part}
                        </StatusBadge>
                      ))}
                    </div>
                  ) : null}

                  {routeSummaryParts.length > 0 ? (
                    <div className="apm-row-detail">{routeSummaryParts.join(" · ")}</div>
                  ) : null}
                  {routingStateParts.length > 0 ? (
                    <div className="apm-row-detail apm-row-detail--usage-meta">
                      {routingStateParts.join(" · ")}
                    </div>
                  ) : null}
                  {chatgptWorkspaceParts.length > 0 ? (
                    <div className="apm-row-detail apm-row-detail--usage-meta">
                      {chatgptWorkspaceParts.join(" · ")}
                    </div>
                  ) : null}
                  {hasMultipleChatgptWorkspaces ? (
                    <div className="apm-row-workspace-editor">
                      <div className="apm-row-workspace-field">
                        <span className="apm-row-detail apm-row-detail--usage-meta">
                          Default ChatGPT workspace
                        </span>
                        <Select
                          className={controlStyles.selectRoot}
                          triggerClassName={controlStyles.selectTrigger}
                          menuClassName={controlStyles.selectMenu}
                          optionClassName={controlStyles.selectOption}
                          ariaLabel={`Default ChatGPT workspace for account ${account.accountId}`}
                          options={[
                            ...(account.defaultChatgptWorkspaceId
                              ? []
                              : [
                                  {
                                    value: "",
                                    label: "Select a ChatGPT workspace",
                                  },
                                ]),
                            ...chatgptWorkspaceMemberships.map((workspace) => ({
                              value: workspace.workspaceId,
                              label: formatChatgptWorkspaceLabel(workspace),
                            })),
                          ]}
                          value={account.defaultChatgptWorkspaceId ?? ""}
                          onValueChange={(value) =>
                            onUpdateDefaultChatgptWorkspace(account, value || null)
                          }
                          disabled={defaultWorkspaceBusy}
                          triggerDensity="compact"
                        />
                      </div>
                      <div className="apm-row-detail apm-row-detail--usage-meta">
                        {defaultWorkspaceBusy
                          ? "Saving default ChatGPT workspace…"
                          : "ChatGPT workspaces are separate from project workspaces."}
                      </div>
                    </div>
                  ) : null}
                  {localCliManaged ? (
                    <div className="apm-row-detail">
                      Managed by local Codex CLI. Sign out in Codex CLI to remove this account.
                    </div>
                  ) : null}
                </div>
                <div className="apm-row-footer">
                  <div className="apm-row-footer-time">
                    Updated {formatTimestamp(account.updatedAt)}
                  </div>
                  <div className="apm-row-actions">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onRefreshUsage(account)}
                      disabled={busyAction === "refresh"}
                      aria-label={`Refresh usage for account ${account.accountId}`}
                    >
                      {busyAction === "refresh" ? "Refreshing usage…" : "Refresh usage"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onToggleAccountStatus(account)}
                      disabled={
                        busyAction === `toggle-account:${account.accountId}` || !isMutableStatus
                      }
                    >
                      {isEnabled ? "Disable" : "Enable"}
                    </Button>
                    {account.provider === "codex" && chatgptWorkspaceMemberships.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onReviewDeactivatedChatgptWorkspaces(account)}
                        disabled={reviewDeactivatedBusy || leaveDeactivatedBusy}
                      >
                        {reviewDeactivatedBusy
                          ? "Reviewing workspaces…"
                          : leaveDeactivatedBusy
                            ? "Leaving workspaces…"
                            : "Review deactivated workspaces"}
                      </Button>
                    )}
                    {account.provider === "codex" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onReauthenticateAccount(account)}
                        disabled={busyAction === `reauth-account:${account.accountId}`}
                      >
                        {busyAction === `reauth-account:${account.accountId}`
                          ? "Re-authenticating…"
                          : "Re-authenticate"}
                      </Button>
                    )}
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => onRemoveAccount(account)}
                      disabled={
                        localCliManaged || busyAction === `remove-account:${account.accountId}`
                      }
                      title={
                        localCliManaged
                          ? "Managed by local Codex CLI. Sign out in Codex CLI to remove this account."
                          : undefined
                      }
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
