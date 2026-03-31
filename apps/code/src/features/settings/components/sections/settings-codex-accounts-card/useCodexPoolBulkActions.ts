import { type Dispatch, type SetStateAction, useCallback } from "react";
import {
  type OAuthPoolSummary,
  type OAuthProviderId,
  removeOAuthPool,
  upsertOAuthPool,
} from "../../../../../application/runtime/ports/oauth";
import { formatError } from "../settingsCodexAccountsCardUtils";
import { confirmDestructiveAction } from "./oauthHelpers";
import type { FormBusyAction } from "./types";

type UseCodexPoolBulkActionsOptions = {
  pools: OAuthPoolSummary[];
  selectedPoolIds: string[];
  refreshOAuthState: () => Promise<void> | void;
  syncProviderPoolMembers: (provider: OAuthProviderId) => Promise<void>;
  setBusyAction: Dispatch<SetStateAction<FormBusyAction>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setSelectedPoolIds: Dispatch<SetStateAction<string[]>>;
};

export function useCodexPoolBulkActions({
  pools,
  selectedPoolIds,
  refreshOAuthState,
  syncProviderPoolMembers,
  setBusyAction,
  setError,
  setSelectedPoolIds,
}: UseCodexPoolBulkActionsOptions) {
  const handleBulkPoolStatus = useCallback(
    async (nextEnabled: boolean) => {
      const selectedIdSet = new Set(selectedPoolIds);
      const targetPools = pools.filter(
        (pool) => selectedIdSet.has(pool.poolId) && pool.enabled !== nextEnabled
      );
      if (targetPools.length === 0) {
        return;
      }
      setBusyAction(nextEnabled ? "bulk-enable-pools" : "bulk-disable-pools");
      setError(null);
      try {
        await Promise.all(
          targetPools.map((pool) =>
            upsertOAuthPool({
              poolId: pool.poolId,
              provider: pool.provider,
              name: pool.name,
              strategy: pool.strategy,
              stickyMode: pool.stickyMode,
              preferredAccountId: pool.preferredAccountId ?? null,
              enabled: nextEnabled,
              metadata: pool.metadata,
            })
          )
        );
        await refreshOAuthState();
      } catch (nextError) {
        setError(formatError(nextError, "Unable to update selected pool status."));
      } finally {
        setBusyAction(null);
      }
    },
    [pools, refreshOAuthState, selectedPoolIds, setBusyAction, setError]
  );

  const handleBulkRemovePools = useCallback(async () => {
    const selectedIdSet = new Set(selectedPoolIds);
    const targetPools = pools.filter((pool) => selectedIdSet.has(pool.poolId));
    if (targetPools.length === 0) {
      return;
    }
    if (!confirmDestructiveAction(`Remove ${targetPools.length} selected pool(s)?`)) {
      return;
    }
    setBusyAction("bulk-remove-pools");
    setError(null);
    try {
      await Promise.all(targetPools.map((pool) => removeOAuthPool(pool.poolId)));
      const providers = Array.from(new Set(targetPools.map((pool) => pool.provider)));
      await Promise.all(providers.map((provider) => syncProviderPoolMembers(provider)));
      setSelectedPoolIds((previous) => previous.filter((poolId) => !selectedIdSet.has(poolId)));
      await refreshOAuthState();
    } catch (nextError) {
      setError(formatError(nextError, "Unable to remove selected pools."));
    } finally {
      setBusyAction(null);
    }
  }, [
    pools,
    refreshOAuthState,
    selectedPoolIds,
    setBusyAction,
    setError,
    setSelectedPoolIds,
    syncProviderPoolMembers,
  ]);

  const handleBulkPoolStickyMode = useCallback(
    async (nextStickyMode: OAuthPoolSummary["stickyMode"]) => {
      const selectedIdSet = new Set(selectedPoolIds);
      const targetPools = pools.filter(
        (pool) => selectedIdSet.has(pool.poolId) && pool.stickyMode !== nextStickyMode
      );
      if (targetPools.length === 0) {
        return;
      }
      setBusyAction("bulk-update-pool-sticky");
      setError(null);
      try {
        await Promise.all(
          targetPools.map((pool) =>
            upsertOAuthPool({
              poolId: pool.poolId,
              provider: pool.provider,
              name: pool.name,
              strategy: pool.strategy,
              stickyMode: nextStickyMode,
              preferredAccountId: pool.preferredAccountId ?? null,
              enabled: pool.enabled,
              metadata: pool.metadata,
            })
          )
        );
        await refreshOAuthState();
      } catch (nextError) {
        setError(
          formatError(nextError, "Unable to update selected pool session binding strategy.")
        );
      } finally {
        setBusyAction(null);
      }
    },
    [pools, refreshOAuthState, selectedPoolIds, setBusyAction, setError]
  );

  return {
    handleBulkPoolStatus,
    handleBulkPoolStickyMode,
    handleBulkRemovePools,
  };
}
