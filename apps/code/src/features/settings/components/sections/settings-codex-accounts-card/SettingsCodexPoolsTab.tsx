import type { Dispatch, RefObject, SetStateAction } from "react";
import type {
  OAuthAccountSummary,
  OAuthPoolSummary,
} from "../../../../../application/runtime/ports/oauth";
import { Button } from "../../../../../design-system";
import { Input } from "../../../../../design-system";
import { Select, type SelectOption } from "../../../../../design-system";
import { StatusBadge } from "../../../../../design-system";
import {
  resolveProviderBrandRouteId,
  type ProviderBrandId,
} from "../../../../app/utils/antiGravityBranding";
import {
  applyMemberSelectionToPoolDraft,
  buildPoolMembersFromDraft,
  formatProvider,
  formatProviderBrand,
  formatProviderOptionLabel,
  formatTimestamp,
  type PoolDraft,
  type ProviderOption,
  updatePoolDraftMemberPolicy,
} from "../settingsCodexAccountsCardUtils";
import { AccountChecklist } from "./AccountChecklist";
import { PoolMemberSelector } from "./PoolMemberSelector";
import { SettingsCodexAccountsSectionHeader } from "./SettingsCodexAccountsSectionHeader";
import type { FormBusyAction, PoolSaveState, PoolSelectionPreview, ProviderFilter } from "./types";
import * as controlStyles from "./CodexAccountControls.css";

type SettingsCodexPoolsTabProps = {
  onClose?: () => void;
  onRefresh: () => void;
  busyAction: FormBusyAction;
  poolCreateSectionRef: RefObject<HTMLElement | null>;
  selectedPoolProvider: ProviderOption | null;
  providerOptions: ProviderOption[];
  poolProviderDraft: ProviderBrandId;
  setPoolProviderDraft: Dispatch<SetStateAction<ProviderBrandId>>;
  poolNameDraft: string;
  setPoolNameDraft: Dispatch<SetStateAction<string>>;
  accounts: OAuthAccountSummary[];
  providerAccounts: OAuthAccountSummary[];
  poolMemberAccountIdsDraft: string[];
  setPoolMemberAccountIdsDraft: Dispatch<SetStateAction<string[]>>;
  poolPreferredAccountIdDraft: string;
  setPoolPreferredAccountIdDraft: Dispatch<SetStateAction<string>>;
  poolMemberAccountsDraft: OAuthAccountSummary[];
  onAddPool: () => void;
  poolProviderFilter: ProviderFilter;
  setPoolProviderFilter: Dispatch<SetStateAction<ProviderFilter>>;
  visiblePools: OAuthPoolSummary[];
  selectedPoolIds: string[];
  setSelectedPoolIds: Dispatch<SetStateAction<string[]>>;
  onBulkPoolStatus: (nextEnabled: boolean) => void;
  onBulkRemovePools: () => void;
  bulkPoolStickyModeDraft: OAuthPoolSummary["stickyMode"];
  setBulkPoolStickyModeDraft: Dispatch<SetStateAction<OAuthPoolSummary["stickyMode"]>>;
  onBulkPoolStickyMode: (nextStickyMode: OAuthPoolSummary["stickyMode"]) => void;
  hiddenSelectedPoolsCount: number;
  onClearHiddenSelectedPools: () => void;
  selectedPools: OAuthPoolSummary[];
  pools: OAuthPoolSummary[];
  poolDrafts: Record<string, PoolDraft>;
  poolSaveStateById: Record<string, PoolSaveState>;
  selectedPoolIdSet: Set<string>;
  poolSelectionPreviewById: Record<string, PoolSelectionPreview>;
  updatePoolDraft: (poolId: string, update: Partial<PoolDraft>) => void;
  onAutosavePool: (pool: OAuthPoolSummary, draftOverride?: PoolDraft) => void;
  onProbePoolAccount: (pool: OAuthPoolSummary) => void;
  onReportPoolRateLimit: (pool: OAuthPoolSummary, draft: PoolDraft | null, clear: boolean) => void;
  onRetryPoolAutosave: (pool: OAuthPoolSummary) => void;
  onSyncPoolMembers: (pool: OAuthPoolSummary) => void;
  onRemovePool: (poolId: string, provider: OAuthPoolSummary["provider"]) => void;
  stickyModeDescription: Record<OAuthPoolSummary["stickyMode"], string>;
};

export function SettingsCodexPoolsTab({
  onClose,
  onRefresh,
  busyAction,
  poolCreateSectionRef,
  selectedPoolProvider,
  providerOptions,
  poolProviderDraft,
  setPoolProviderDraft,
  poolNameDraft,
  setPoolNameDraft,
  accounts,
  providerAccounts,
  poolMemberAccountIdsDraft,
  setPoolMemberAccountIdsDraft,
  poolPreferredAccountIdDraft,
  setPoolPreferredAccountIdDraft,
  poolMemberAccountsDraft,
  onAddPool,
  poolProviderFilter,
  setPoolProviderFilter,
  visiblePools,
  selectedPoolIds,
  setSelectedPoolIds,
  onBulkPoolStatus,
  onBulkRemovePools,
  bulkPoolStickyModeDraft,
  setBulkPoolStickyModeDraft,
  onBulkPoolStickyMode,
  hiddenSelectedPoolsCount,
  onClearHiddenSelectedPools,
  selectedPools,
  pools,
  poolDrafts,
  poolSaveStateById,
  selectedPoolIdSet,
  poolSelectionPreviewById,
  updatePoolDraft,
  onAutosavePool,
  onProbePoolAccount,
  onReportPoolRateLimit,
  onRetryPoolAutosave,
  onSyncPoolMembers,
  onRemovePool,
  stickyModeDescription,
}: SettingsCodexPoolsTabProps) {
  const enabledPoolsCount = pools.filter((pool) => pool.enabled).length;
  const providerPoolCount = new Set(pools.map((pool) => pool.provider)).size;
  const memberCoverageCount = pools.reduce(
    (total, pool) => total + (poolDrafts[pool.poolId]?.memberAccountIds.length ?? 0),
    0
  );
  const poolProviderOptions: SelectOption[] = providerOptions.map((provider) => ({
    value: provider.id,
    label: formatProviderOptionLabel(provider),
    disabled: provider.available === false,
  }));
  const poolProviderFilterOptions: SelectOption[] = [
    { value: "all", label: "All providers" },
    ...providerOptions.map((provider) => ({
      value: provider.id,
      label: formatProviderOptionLabel(provider),
    })),
  ];
  const stickyModeOptions: SelectOption[] = [
    { value: "cache_first", label: "cache_first" },
    { value: "balance", label: "balance" },
    { value: "performance_first", label: "performance_first" },
  ];
  const strategyOptions: SelectOption[] = [
    { value: "round_robin", label: "round_robin" },
    { value: "p2c", label: "p2c" },
  ];

  return (
    <div className="apm-tab-content">
      <SettingsCodexAccountsSectionHeader
        title="Pools"
        description="Balance traffic across provider pools."
        onRefresh={onRefresh}
        refreshing={busyAction === "refresh"}
        onClose={onClose}
      />

      <div className="apm-overview-grid">
        <div className="apm-overview-card">
          <div className="apm-overview-label">Pools</div>
          <div className="apm-overview-value">{pools.length}</div>
        </div>
        <div className="apm-overview-card">
          <div className="apm-overview-label">Enabled</div>
          <div className="apm-overview-value">{enabledPoolsCount}</div>
        </div>
        <div className="apm-overview-card">
          <div className="apm-overview-label">Providers</div>
          <div className="apm-overview-value">{providerPoolCount}</div>
        </div>
        <div className="apm-overview-card">
          <div className="apm-overview-label">Members</div>
          <div className="apm-overview-value">{memberCoverageCount}</div>
        </div>
      </div>

      <section ref={poolCreateSectionRef} className="apm-form-section">
        <div className="apm-form-title">Add provider pool</div>
        <div className="apm-form-row">
          <div className="apm-field">
            <span className="apm-field-label">Provider</span>
            <Select
              className={controlStyles.selectRoot}
              triggerClassName={controlStyles.selectTrigger}
              menuClassName={controlStyles.selectMenu}
              optionClassName={controlStyles.selectOption}
              ariaLabel="Pool provider"
              options={poolProviderOptions}
              value={poolProviderDraft}
              onValueChange={(value) => {
                const nextProvider = value as ProviderBrandId;
                setPoolProviderDraft(nextProvider);
                const routeProviderId = resolveProviderBrandRouteId(nextProvider);
                setPoolMemberAccountIdsDraft(
                  accounts
                    .filter((account) => account.provider === routeProviderId)
                    .map((account) => account.accountId)
                );
                setPoolPreferredAccountIdDraft("");
              }}
            />
          </div>
          <div className="apm-field apm-field--flex-1">
            <span className="apm-field-label">Pool name</span>
            <Input
              fieldClassName={controlStyles.inputField}
              inputSize="sm"
              value={poolNameDraft}
              placeholder="Pool name"
              onValueChange={setPoolNameDraft}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  onAddPool();
                }
              }}
              aria-label="Pool name"
            />
          </div>
        </div>
        <div className="apm-form-row apm-form-row--align-start">
          <div className="apm-field apm-field--flex-1 apm-field--min-width-240">
            <span className="apm-field-label">Member accounts</span>
            <AccountChecklist
              accounts={providerAccounts}
              selectedIds={poolMemberAccountIdsDraft}
              onToggle={(accountId, checked) => {
                setPoolMemberAccountIdsDraft((previous) => {
                  if (checked) {
                    return [...previous, accountId];
                  }
                  return previous.filter((id) => id !== accountId);
                });
                if (!checked && poolPreferredAccountIdDraft === accountId) {
                  setPoolPreferredAccountIdDraft("");
                }
              }}
            />
          </div>
          <div className="apm-field apm-field--width-200">
            <span className="apm-field-label">Preferred account</span>
            <Select
              className={controlStyles.selectRoot}
              triggerClassName={controlStyles.selectTrigger}
              menuClassName={controlStyles.selectMenu}
              optionClassName={controlStyles.selectOption}
              ariaLabel="Pool preferred account"
              options={[
                { value: "", label: "No preferred account" },
                ...poolMemberAccountsDraft.map((account) => ({
                  value: account.accountId,
                  label: account.displayName?.trim() || account.email?.trim() || account.accountId,
                })),
              ]}
              value={poolPreferredAccountIdDraft}
              onValueChange={setPoolPreferredAccountIdDraft}
            />
          </div>
        </div>
        <div>
          <Button
            variant="primary"
            size="sm"
            onClick={onAddPool}
            disabled={busyAction === "add-pool" || selectedPoolProvider?.available === false}
          >
            {busyAction === "add-pool" ? "Adding…" : "Add pool"}
          </Button>
        </div>
        {selectedPoolProvider?.available === false && (
          <div className="apm-hint apm-hint--warning">
            {selectedPoolProvider.label} is unavailable until provider catalog reports it healthy.
          </div>
        )}
      </section>

      <div className="apm-list-shell">
        <div className="apm-toolbar apm-toolbar--stack">
          <div className="apm-toolbar-row">
            <div className="apm-toolbar-filters">
              <Select
                className={controlStyles.selectRoot}
                triggerClassName={controlStyles.selectTrigger}
                menuClassName={controlStyles.selectMenu}
                optionClassName={controlStyles.selectOption}
                ariaLabel="Filter pools by provider"
                options={poolProviderFilterOptions}
                value={poolProviderFilter}
                onValueChange={(value) => setPoolProviderFilter(value as ProviderFilter)}
                triggerDensity="compact"
              />
            </div>
            <div className="apm-toolbar-actions">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedPoolIds((previous) => {
                    const next = new Set(previous);
                    for (const pool of visiblePools) {
                      next.add(pool.poolId);
                    }
                    return Array.from(next);
                  });
                }}
                disabled={visiblePools.length === 0}
              >
                Select all
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedPoolIds([])}
                disabled={selectedPoolIds.length === 0}
              >
                Clear
              </Button>
            </div>
          </div>
          {selectedPoolIds.length > 0 && (
            <div className="apm-bulk-banner">
              <div className="apm-bulk-banner-copy">
                <div className="apm-bulk-banner-title">{selectedPools.length} pools selected</div>
                <div className="apm-bulk-banner-meta">
                  Update enabled state, binding mode, or remove selected pools.
                </div>
              </div>
              <div className="apm-bulk-banner-actions">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onBulkPoolStatus(true)}
                  disabled={busyAction === "bulk-enable-pools"}
                >
                  Enable
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onBulkPoolStatus(false)}
                  disabled={busyAction === "bulk-disable-pools"}
                >
                  Disable
                </Button>
                <Select
                  className={controlStyles.selectRoot}
                  triggerClassName={controlStyles.selectTrigger}
                  menuClassName={controlStyles.selectMenu}
                  optionClassName={controlStyles.selectOption}
                  ariaLabel="Bulk session binding strategy"
                  options={stickyModeOptions}
                  value={bulkPoolStickyModeDraft}
                  onValueChange={(value) =>
                    setBulkPoolStickyModeDraft(value as OAuthPoolSummary["stickyMode"])
                  }
                  triggerDensity="compact"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onBulkPoolStickyMode(bulkPoolStickyModeDraft)}
                  disabled={busyAction === "bulk-update-pool-sticky"}
                >
                  Apply binding
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={onBulkRemovePools}
                  disabled={busyAction === "bulk-remove-pools"}
                >
                  Remove
                </Button>
                {hiddenSelectedPoolsCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={onClearHiddenSelectedPools}>
                    Clear {hiddenSelectedPoolsCount} hidden
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="apm-meta-line">
          <span>{visiblePools.length} visible</span>
          {selectedPools.length > 0 && <span>{selectedPools.length} selected</span>}
          {poolProviderFilter !== "all" && (
            <span>{formatProviderBrand(poolProviderFilter, providerOptions)}</span>
          )}
        </div>

        <div className="apm-list">
          {visiblePools.length === 0 && (
            <div className="apm-empty">
              {pools.length === 0 ? "No provider pools configured." : "No pools match the filter."}
            </div>
          )}
          {visiblePools.map((pool) => {
            const poolAccounts = accounts.filter((account) => account.provider === pool.provider);
            const fallbackMemberAccountIds = poolAccounts.map((account) => account.accountId);
            const fallbackMemberPoliciesByAccountId = Object.fromEntries(
              buildPoolMembersFromDraft(poolAccounts, null, fallbackMemberAccountIds).map(
                (member) => [
                  member.accountId,
                  {
                    weight: member.weight ?? 1,
                    priority: member.priority ?? 0,
                    position: member.position ?? 0,
                    enabled: member.enabled ?? true,
                  },
                ]
              )
            );
            const draft = poolDrafts[pool.poolId] ?? {
              name: pool.name,
              strategy: pool.strategy,
              stickyMode: pool.stickyMode,
              preferredAccountId: pool.preferredAccountId ?? "",
              memberAccountIds: fallbackMemberAccountIds,
              memberPoliciesByAccountId: fallbackMemberPoliciesByAccountId,
              enabled: pool.enabled,
            };
            const poolMemberIdSet = new Set(draft.memberAccountIds);
            const poolMemberAccounts = poolAccounts.filter((account) =>
              poolMemberIdSet.has(account.accountId)
            );
            const poolAccountById = new Map(
              poolAccounts.map((account) => [account.accountId, account] as const)
            );
            const poolMemberPolicyRows = draft.memberAccountIds
              .map((accountId, index) => {
                const account = poolAccountById.get(accountId) ?? null;
                const policy = draft.memberPoliciesByAccountId[accountId] ?? {
                  weight: 1,
                  priority: index,
                  position: index,
                  enabled: account?.status === "enabled",
                };
                return {
                  accountId,
                  account,
                  policy,
                  index,
                };
              })
              .sort(
                (left, right) =>
                  left.policy.priority - right.policy.priority ||
                  left.policy.position - right.policy.position ||
                  left.index - right.index
              );
            const hasPreferredAccount = poolMemberAccounts.some(
              (account) => account.accountId === draft.preferredAccountId
            );
            const probePreview = poolSelectionPreviewById[pool.poolId] ?? null;
            const saveState: PoolSaveState = poolSaveStateById[pool.poolId] ?? {
              status: "idle",
              code: null,
              message: null,
            };
            const poolMetaParts = [
              formatProvider(pool.provider, providerOptions),
              `${poolMemberAccounts.length} member${poolMemberAccounts.length === 1 ? "" : "s"}`,
              `Strategy ${draft.strategy}`,
              `Binding ${draft.stickyMode}`,
            ];
            const triggerAutosave = () => {
              Promise.resolve().then(() => onAutosavePool(pool));
            };

            return (
              <div
                key={pool.poolId}
                className={`apm-row apm-row--pool ${selectedPoolIdSet.has(pool.poolId) ? "is-selected" : ""}`}
              >
                <label className="apm-row-check">
                  <input
                    type="checkbox"
                    checked={selectedPoolIdSet.has(pool.poolId)}
                    onChange={(event) => {
                      const checked = event.target.checked;
                      setSelectedPoolIds((previous) => {
                        if (checked) {
                          if (previous.includes(pool.poolId)) {
                            return previous;
                          }
                          return [...previous, pool.poolId];
                        }
                        return previous.filter((entry) => entry !== pool.poolId);
                      });
                    }}
                    aria-label={`Select pool ${pool.poolId}`}
                  />
                </label>
                <div className="apm-row-info">
                  <div className="apm-row-name">{draft.name.trim() || pool.name}</div>
                  <div className="apm-row-meta">
                    {poolMetaParts.map((part) => (
                      <span key={`${pool.poolId}-${part}`}>{part}</span>
                    ))}
                  </div>
                  <div className="apm-row-detail">
                    Preferred account {draft.preferredAccountId || "none"}
                  </div>
                </div>
                <StatusBadge
                  className={`apm-status-chip ${draft.enabled ? "is-enabled" : "is-disabled"}`}
                  tone={draft.enabled ? "success" : "error"}
                >
                  {draft.enabled ? "enabled" : "disabled"}
                </StatusBadge>

                <div className="apm-pool-config">
                  <Input
                    fieldClassName={controlStyles.inputField}
                    inputSize="sm"
                    aria-label={`Name for pool ${pool.poolId}`}
                    value={draft.name}
                    onValueChange={(value) => {
                      updatePoolDraft(pool.poolId, { name: value });
                    }}
                    onBlur={triggerAutosave}
                  />
                  <Select
                    className={controlStyles.selectRoot}
                    triggerClassName={controlStyles.selectTrigger}
                    menuClassName={controlStyles.selectMenu}
                    optionClassName={controlStyles.selectOption}
                    ariaLabel={`Strategy for pool ${pool.poolId}`}
                    options={strategyOptions}
                    value={draft.strategy}
                    onValueChange={(value) => {
                      const nextStrategy = value as OAuthPoolSummary["strategy"];
                      const nextDraft = { ...draft, strategy: nextStrategy };
                      updatePoolDraft(pool.poolId, {
                        strategy: nextStrategy,
                      });
                      Promise.resolve().then(() => onAutosavePool(pool, nextDraft));
                    }}
                    triggerDensity="compact"
                  />
                  <Select
                    className={controlStyles.selectRoot}
                    triggerClassName={controlStyles.selectTrigger}
                    menuClassName={controlStyles.selectMenu}
                    optionClassName={controlStyles.selectOption}
                    ariaLabel={`Session binding for pool ${pool.poolId}`}
                    options={stickyModeOptions}
                    value={draft.stickyMode}
                    onValueChange={(value) => {
                      const nextStickyMode = value as OAuthPoolSummary["stickyMode"];
                      const nextDraft = { ...draft, stickyMode: nextStickyMode };
                      updatePoolDraft(pool.poolId, {
                        stickyMode: nextStickyMode,
                      });
                      Promise.resolve().then(() => onAutosavePool(pool, nextDraft));
                    }}
                    triggerDensity="compact"
                  />
                  <div className="apm-field apm-field--flex-1 apm-field--min-width-180">
                    <PoolMemberSelector
                      memberAccountIds={draft.memberAccountIds}
                      providerAccounts={poolAccounts}
                      disabled={false}
                      onChange={(nextMemberIds) => {
                        const nextDraft = applyMemberSelectionToPoolDraft(
                          draft,
                          poolAccounts,
                          nextMemberIds
                        );
                        updatePoolDraft(pool.poolId, {
                          memberAccountIds: nextDraft.memberAccountIds,
                          memberPoliciesByAccountId: nextDraft.memberPoliciesByAccountId,
                          preferredAccountId: nextDraft.preferredAccountId,
                        });
                        Promise.resolve().then(() => onAutosavePool(pool, nextDraft));
                      }}
                    />
                  </div>
                  <Select
                    className={controlStyles.selectRoot}
                    triggerClassName={controlStyles.selectTrigger}
                    menuClassName={controlStyles.selectMenu}
                    optionClassName={controlStyles.selectOption}
                    ariaLabel={`Preferred account for pool ${pool.poolId}`}
                    options={[
                      { value: "", label: "No preferred" },
                      ...(!hasPreferredAccount && draft.preferredAccountId
                        ? [
                            {
                              value: draft.preferredAccountId,
                              label: `Missing (${draft.preferredAccountId})`,
                            },
                          ]
                        : []),
                      ...poolMemberAccounts.map((account) => ({
                        value: account.accountId,
                        label:
                          account.displayName?.trim() || account.email?.trim() || account.accountId,
                      })),
                    ]}
                    value={draft.preferredAccountId}
                    onValueChange={(value) => {
                      const nextDraft = { ...draft, preferredAccountId: value };
                      updatePoolDraft(pool.poolId, { preferredAccountId: value });
                      Promise.resolve().then(() => onAutosavePool(pool, nextDraft));
                    }}
                    triggerDensity="compact"
                  />
                </div>
                <div className="apm-pool-member-policy-list">
                  {poolMemberPolicyRows.length === 0 ? (
                    <div className="apm-member-policy-empty">No members selected.</div>
                  ) : (
                    poolMemberPolicyRows.map(({ accountId, account, policy }) => (
                      <div key={accountId} className="apm-pool-member-policy-row">
                        <div className="apm-pool-member-policy-account">
                          {account?.displayName?.trim() || account?.email?.trim() || accountId}
                        </div>
                        <label className="apm-member-policy-enabled">
                          <input
                            type="checkbox"
                            checked={policy.enabled}
                            onChange={(event) => {
                              const nextDraft = updatePoolDraftMemberPolicy(draft, accountId, {
                                enabled: event.target.checked,
                              });
                              updatePoolDraft(pool.poolId, {
                                memberPoliciesByAccountId: nextDraft.memberPoliciesByAccountId,
                              });
                            }}
                            onBlur={triggerAutosave}
                            aria-label={`Enabled state for ${accountId} in pool ${pool.poolId}`}
                          />
                          enabled
                        </label>
                        <div className="apm-member-policy-field">
                          <span>weight</span>
                          <Input
                            fieldClassName={`${controlStyles.inputField} ${controlStyles.inputFieldCompact}`}
                            inputSize="sm"
                            type="number"
                            min={1}
                            max={20}
                            value={policy.weight}
                            onValueChange={(nextValue) => {
                              const value = Number.parseInt(nextValue, 10);
                              const nextDraft = updatePoolDraftMemberPolicy(draft, accountId, {
                                weight: Number.isFinite(value) ? value : policy.weight,
                              });
                              updatePoolDraft(pool.poolId, {
                                memberPoliciesByAccountId: nextDraft.memberPoliciesByAccountId,
                              });
                            }}
                            onBlur={triggerAutosave}
                            aria-label={`Weight for ${accountId} in pool ${pool.poolId}`}
                          />
                        </div>
                        <div className="apm-member-policy-field">
                          <span>priority</span>
                          <Input
                            fieldClassName={`${controlStyles.inputField} ${controlStyles.inputFieldCompact}`}
                            inputSize="sm"
                            type="number"
                            min={0}
                            value={policy.priority}
                            onValueChange={(nextValue) => {
                              const value = Number.parseInt(nextValue, 10);
                              const nextDraft = updatePoolDraftMemberPolicy(draft, accountId, {
                                priority: Number.isFinite(value) ? value : policy.priority,
                              });
                              updatePoolDraft(pool.poolId, {
                                memberPoliciesByAccountId: nextDraft.memberPoliciesByAccountId,
                              });
                            }}
                            onBlur={triggerAutosave}
                            aria-label={`Priority for ${accountId} in pool ${pool.poolId}`}
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="apm-hint apm-pool-binding-hint">
                  {stickyModeDescription[draft.stickyMode]}
                </div>
                {saveState.status !== "idle" ? (
                  <div
                    className={
                      saveState.status === "error" || saveState.status === "conflict"
                        ? "apm-hint apm-hint--warning"
                        : "apm-hint"
                    }
                  >
                    {saveState.status === "dirty"
                      ? "Unsaved changes"
                      : saveState.status === "saving"
                        ? "Saving…"
                        : saveState.message || "Save failed"}
                  </div>
                ) : null}
                {probePreview ? (
                  <div className="apm-hint">
                    Last probe: {probePreview.accountId} ({probePreview.reason}) at{" "}
                    {formatTimestamp(probePreview.selectedAt)}
                  </div>
                ) : null}
                <div className="apm-row-actions apm-row-actions--pool">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const nextDraft: PoolDraft = { ...draft, enabled: !draft.enabled };
                      updatePoolDraft(pool.poolId, { enabled: nextDraft.enabled });
                      Promise.resolve().then(() => onAutosavePool(pool, nextDraft));
                    }}
                  >
                    {draft.enabled ? "Disable" : "Enable"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onProbePoolAccount(pool)}
                    disabled={busyAction === `probe-pool:${pool.poolId}`}
                  >
                    {busyAction === `probe-pool:${pool.poolId}` ? "Probing…" : "Probe"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onReportPoolRateLimit(pool, draft, false)}
                    disabled={busyAction === `report-rate-limit:${pool.poolId}`}
                  >
                    Mark limited
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onReportPoolRateLimit(pool, draft, true)}
                    disabled={busyAction === `clear-rate-limit:${pool.poolId}`}
                  >
                    Clear limit
                  </Button>
                  {(saveState.status === "error" || saveState.status === "conflict") && (
                    <Button variant="primary" size="sm" onClick={() => onRetryPoolAutosave(pool)}>
                      Retry
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onSyncPoolMembers(pool)}
                    disabled={busyAction === `sync-pool:${pool.poolId}`}
                  >
                    Sync
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => onRemovePool(pool.poolId, pool.provider)}
                    disabled={busyAction === `remove-pool:${pool.poolId}`}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
