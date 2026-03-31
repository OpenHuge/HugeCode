import { type MutableRefObject, useCallback } from "react";
import {
  applyOAuthPool,
  getAccountInfo,
  listOAuthAccounts,
  listOAuthPools,
  type OAuthAccountSummary,
  type OAuthPoolSummary,
  type OAuthProviderId,
} from "../../../../../application/runtime/ports/oauth";
import { buildPoolMembersFromDraft, type PoolDraft } from "../settingsCodexAccountsCardUtils";
import { waitForCodexOauthBinding as waitForCodexOauthBindingWithDeps } from "./codexOauthBinding";
import type { PoolSelectionPreview } from "./types";

type UseCodexAccountsAsyncHelpersOptions = {
  accounts: OAuthAccountSummary[];
  pools: OAuthPoolSummary[];
  poolDrafts: Record<string, PoolDraft>;
  poolSelectionPreviewById: Record<string, PoolSelectionPreview>;
  readCodexAccountsForOauthSync: () => Promise<OAuthAccountSummary[]>;
  isMountedRef: MutableRefObject<boolean>;
};

export function useCodexAccountsAsyncHelpers({
  accounts,
  pools,
  poolDrafts,
  poolSelectionPreviewById,
  readCodexAccountsForOauthSync,
  isMountedRef,
}: UseCodexAccountsAsyncHelpersOptions) {
  const syncProviderPoolMembers = useCallback(
    async (provider: OAuthProviderId) => {
      const providerAccountsSnapshot = await listOAuthAccounts(provider);
      const providerPoolsSnapshot = await listOAuthPools(provider);
      if (providerPoolsSnapshot.length === 0) {
        return;
      }
      await Promise.all(
        providerPoolsSnapshot.map((pool) => {
          const draft = poolDrafts[pool.poolId] ?? null;
          return applyOAuthPool({
            pool: {
              poolId: pool.poolId,
              provider: pool.provider,
              name: draft?.name?.trim() || pool.name,
              strategy: draft?.strategy ?? pool.strategy,
              stickyMode: draft?.stickyMode ?? pool.stickyMode,
              preferredAccountId:
                draft?.preferredAccountId?.trim() || pool.preferredAccountId || null,
              enabled: draft?.enabled ?? pool.enabled,
              metadata: pool.metadata ?? {},
            },
            members: buildPoolMembersFromDraft(providerAccountsSnapshot, draft, null),
            expectedUpdatedAt: pool.updatedAt ?? null,
          });
        })
      );
    },
    [poolDrafts]
  );

  const syncPoolMembers = useCallback(
    async (
      poolId: string,
      provider: OAuthProviderId,
      selectedAccountIds?: ReadonlyArray<string> | null
    ) => {
      const providerAccountsSnapshot = await listOAuthAccounts(provider);
      const pool = pools.find((entry) => entry.poolId === poolId);
      if (!pool) {
        return;
      }
      const draft = poolDrafts[poolId] ?? null;
      const selected =
        selectedAccountIds === null
          ? providerAccountsSnapshot.map((account) => account.accountId)
          : (selectedAccountIds ??
            draft?.memberAccountIds ??
            providerAccountsSnapshot.map((account) => account.accountId));
      await applyOAuthPool({
        pool: {
          poolId: pool.poolId,
          provider: pool.provider,
          name: draft?.name?.trim() || pool.name,
          strategy: draft?.strategy ?? pool.strategy,
          stickyMode: draft?.stickyMode ?? pool.stickyMode,
          preferredAccountId: draft?.preferredAccountId?.trim() || pool.preferredAccountId || null,
          enabled: draft?.enabled ?? pool.enabled,
          metadata: pool.metadata ?? {},
        },
        members: buildPoolMembersFromDraft(providerAccountsSnapshot, draft, selected),
        expectedUpdatedAt: pool.updatedAt ?? null,
      });
    },
    [poolDrafts, pools]
  );

  const waitForCodexOauthBinding = useCallback(
    async (workspaceId: string, baselineUpdatedAt: number): Promise<boolean> =>
      waitForCodexOauthBindingWithDeps(
        {
          getAccountInfo,
          readCodexAccountsForOauthSync,
          isMounted: () => isMountedRef.current,
        },
        workspaceId,
        baselineUpdatedAt
      ),
    [isMountedRef, readCodexAccountsForOauthSync]
  );

  const resolvePoolProbeAccountId = useCallback(
    (pool: OAuthPoolSummary, draft: PoolDraft | null): string | null => {
      const poolAccounts = accounts
        .filter((account) => account.provider === pool.provider)
        .map((account) => account.accountId);
      if (poolAccounts.length === 0) {
        return null;
      }
      const poolAccountById = new Map(
        accounts
          .filter((account) => account.provider === pool.provider)
          .map((account) => [account.accountId, account] as const)
      );
      const memberAccountIds = draft?.memberAccountIds ?? poolAccounts;
      const memberPoliciesByAccountId = draft?.memberPoliciesByAccountId ?? {};
      const eligibleAccountIds = memberAccountIds.filter((accountId) => {
        const account = poolAccountById.get(accountId);
        if (!account || account.status !== "enabled") {
          return false;
        }
        return memberPoliciesByAccountId[accountId]?.enabled ?? true;
      });
      if (eligibleAccountIds.length === 0) {
        return null;
      }
      const eligibleIdSet = new Set(eligibleAccountIds);
      const probePreview = poolSelectionPreviewById[pool.poolId] ?? null;
      if (probePreview?.accountId && eligibleIdSet.has(probePreview.accountId)) {
        return probePreview.accountId;
      }
      if (draft?.preferredAccountId && eligibleIdSet.has(draft.preferredAccountId)) {
        return draft.preferredAccountId;
      }
      if (pool.preferredAccountId && eligibleIdSet.has(pool.preferredAccountId)) {
        return pool.preferredAccountId;
      }
      return eligibleAccountIds[0] ?? null;
    },
    [accounts, poolSelectionPreviewById]
  );

  return {
    resolvePoolProbeAccountId,
    syncPoolMembers,
    syncProviderPoolMembers,
    waitForCodexOauthBinding,
  };
}
