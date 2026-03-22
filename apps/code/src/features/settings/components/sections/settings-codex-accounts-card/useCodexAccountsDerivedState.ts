import { useMemo } from "react";
import { hasRuntimeRoutingCredential } from "../../../../../application/runtime/facades/runtimeRoutingHealth";
import type {
  OAuthAccountSummary,
  OAuthPoolSummary,
} from "../../../../../application/runtime/ports/tauriOauth";
import {
  canonicalizeProviderBrandId,
  matchesProviderBrand,
  type ProviderBrandId,
} from "../../../../app/utils/antiGravityBranding";
import type { ProviderOption } from "../settingsCodexAccountsCardUtils";
import type { AccountStatusFilter, ProviderFilter } from "./types";

type UseCodexAccountsDerivedStateOptions = {
  accounts: OAuthAccountSummary[];
  pools: OAuthPoolSummary[];
  providerOptions: ProviderOption[];
  accountProviderFilter: ProviderFilter;
  accountStatusFilter: AccountStatusFilter;
  accountSearchQuery: string;
  poolProviderFilter: ProviderFilter;
  selectedAccountIds: string[];
  selectedPoolIds: string[];
  poolProviderDraft: ProviderBrandId;
  poolMemberAccountIdsDraft: string[];
};

export function useCodexAccountsDerivedState({
  accounts,
  pools,
  providerOptions,
  accountProviderFilter,
  accountStatusFilter,
  accountSearchQuery,
  poolProviderFilter,
  selectedAccountIds,
  selectedPoolIds,
  poolProviderDraft,
  poolMemberAccountIdsDraft,
}: UseCodexAccountsDerivedStateOptions) {
  const normalizedAccountSearchQuery = useMemo(
    () => accountSearchQuery.trim().toLowerCase(),
    [accountSearchQuery]
  );
  const selectedAccountIdSet = useMemo(() => new Set(selectedAccountIds), [selectedAccountIds]);
  const selectedAccounts = useMemo(
    () => accounts.filter((account) => selectedAccountIdSet.has(account.accountId)),
    [accounts, selectedAccountIdSet]
  );
  const visibleAccounts = useMemo(
    () =>
      accounts.filter((account) => {
        const matchesProvider =
          accountProviderFilter === "all"
            ? true
            : matchesProviderBrand(accountProviderFilter, account.provider);
        if (!matchesProvider) {
          return false;
        }
        const matchesStatus =
          accountStatusFilter === "all" ? true : account.status === accountStatusFilter;
        if (!matchesStatus) {
          return false;
        }
        if (!normalizedAccountSearchQuery) {
          return true;
        }
        const chatgptWorkspaceSearchFields = [
          account.defaultChatgptWorkspaceId,
          ...(account.chatgptWorkspaces?.flatMap((workspace) => [
            workspace.workspaceId,
            workspace.title,
            workspace.role,
          ]) ?? []),
        ];
        return [
          account.accountId,
          account.provider,
          account.externalAccountId,
          account.email,
          account.displayName,
          account.status,
          ...chatgptWorkspaceSearchFields,
        ].some((value) => value?.toLowerCase().includes(normalizedAccountSearchQuery));
      }),
    [accountProviderFilter, accountStatusFilter, accounts, normalizedAccountSearchQuery]
  );
  const selectedPoolIdSet = useMemo(() => new Set(selectedPoolIds), [selectedPoolIds]);
  const selectedPools = useMemo(
    () => pools.filter((pool) => selectedPoolIdSet.has(pool.poolId)),
    [pools, selectedPoolIdSet]
  );
  const visiblePools = useMemo(
    () =>
      pools.filter((pool) =>
        poolProviderFilter === "all"
          ? true
          : matchesProviderBrand(poolProviderFilter, pool.provider)
      ),
    [poolProviderFilter, pools]
  );
  const providerAccounts = useMemo(() => {
    const routeProviderId = canonicalizeProviderBrandId(poolProviderDraft);
    if (!routeProviderId) {
      return [];
    }
    return accounts.filter((account) => account.provider === routeProviderId);
  }, [accounts, poolProviderDraft]);
  const poolMemberAccountsDraft = useMemo(() => {
    const memberIdSet = new Set(poolMemberAccountIdsDraft);
    return providerAccounts.filter((account) => memberIdSet.has(account.accountId));
  }, [poolMemberAccountIdsDraft, providerAccounts]);
  const visibleAccountIdSet = useMemo(
    () => new Set(visibleAccounts.map((account) => account.accountId)),
    [visibleAccounts]
  );
  const visiblePoolIdSet = useMemo(
    () => new Set(visiblePools.map((pool) => pool.poolId)),
    [visiblePools]
  );
  const visibleSelectedAccountsCount = useMemo(
    () => selectedAccountIds.filter((accountId) => visibleAccountIdSet.has(accountId)).length,
    [selectedAccountIds, visibleAccountIdSet]
  );
  const hiddenSelectedAccountsCount = selectedAccounts.length - visibleSelectedAccountsCount;
  const visibleSelectedPoolsCount = useMemo(
    () => selectedPoolIds.filter((poolId) => visiblePoolIdSet.has(poolId)).length,
    [selectedPoolIds, visiblePoolIdSet]
  );
  const hiddenSelectedPoolsCount = selectedPools.length - visibleSelectedPoolsCount;

  const providerPoolRoutingHealth = useMemo(() => {
    const activeProviders = providerOptions.filter((provider) => {
      if (!provider.available) {
        return false;
      }
      const hasAccount = accounts.some((account) => account.provider === provider.routeProviderId);
      const hasPool = pools.some((pool) => pool.provider === provider.routeProviderId);
      return hasAccount || hasPool;
    });

    return activeProviders.map((provider) => {
      const providerAccounts = accounts.filter(
        (account) => account.provider === provider.routeProviderId
      );
      const enabledAccounts = providerAccounts.filter(
        (account) => account.status === "enabled" && account.routeConfig?.schedulable !== false
      );
      const credentialReadyAccounts = enabledAccounts.filter(hasRuntimeRoutingCredential);
      const providerPools = pools.filter((pool) => pool.provider === provider.routeProviderId);
      const enabledPools = providerPools.filter((pool) => pool.enabled);
      const poolRoutingReady = enabledPools.length > 0 && credentialReadyAccounts.length > 0;

      let recommendation: string | null = null;
      if (!provider.available) {
        recommendation = "Runtime provider catalog currently marks this provider unavailable.";
      } else if (enabledPools.length === 0) {
        recommendation = "Enable at least one pool for this provider.";
      } else if (enabledAccounts.length === 0) {
        recommendation = "Enable at least one account for this provider.";
      } else if (credentialReadyAccounts.length === 0) {
        recommendation = "Sign in or configure credentials for at least one enabled account.";
      }

      return {
        providerId: provider.id,
        providerLabel: provider.label,
        poolRoutingReady,
        recommendation,
        accountsTotal: providerAccounts.length,
        enabledAccounts: enabledAccounts.length,
        credentialReadyAccounts: credentialReadyAccounts.length,
        poolsTotal: providerPools.length,
        enabledPools: enabledPools.length,
      };
    });
  }, [accounts, pools, providerOptions]);
  const routingReadyCount = useMemo(
    () => providerPoolRoutingHealth.filter((entry) => entry.poolRoutingReady).length,
    [providerPoolRoutingHealth]
  );

  return {
    hiddenSelectedAccountsCount,
    hiddenSelectedPoolsCount,
    poolMemberAccountsDraft,
    providerAccounts,
    providerPoolRoutingHealth,
    routingReadyCount,
    selectedAccountIdSet,
    selectedAccounts,
    selectedPoolIdSet,
    selectedPools,
    visibleAccountIdSet,
    visibleAccounts,
    visiblePoolIdSet,
    visiblePools,
  };
}
