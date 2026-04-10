import { useCallback, useEffect, useRef, useState } from "react";
import {
  getAccountInfo,
  getProvidersCatalog,
  listOAuthAccounts,
  listOAuthPoolMembers,
  listOAuthPools,
  type OAuthAccountSummary,
  type OAuthPoolSummary,
  removeOAuthAccount,
  runCodexLogin,
  upsertOAuthAccount,
} from "../../../application/runtime/ports/oauth";
import {
  buildPoolDrafts,
  buildProviderOptionsFromCatalog,
  buildProviderOptionsFromState,
  FALLBACK_PROVIDER_OPTIONS,
  formatError,
  type PoolDraft,
  type ProviderOption,
} from "../components/sections/settingsCodexAccountsCardUtils";
import { useOauthPopupRefresh, useRuntimeOauthRefresh } from "./useRuntimeOauthRefresh";
import {
  listWorkspacesForOauth,
  maxCodexAccountTimestamp,
  OAUTH_LOGIN_DEFAULT_WORKSPACE_ID,
  openOAuthPopupWindow,
  openOAuthUrl,
  shouldUseWebOAuthPopup,
} from "../components/sections/settings-codex-accounts-card/oauthHelpers";
import { launchCodexOAuthFlow } from "../components/sections/settings-codex-accounts-card/codexOauthFlow";
import { waitForCodexOauthBinding as waitForCodexOauthBindingWithDeps } from "../components/sections/settings-codex-accounts-card/codexOauthBinding";

type FormBusyAction =
  | null
  | "refresh"
  | "add-account"
  | "add-pool"
  | "bulk-enable"
  | "bulk-disable"
  | "bulk-remove"
  | "bulk-enable-pools"
  | "bulk-disable-pools"
  | "bulk-remove-pools"
  | "bulk-update-pool-sticky"
  | `remove-account:${string}`
  | `remove-pool:${string}`
  | `probe-pool:${string}`
  | `report-rate-limit:${string}`
  | `clear-rate-limit:${string}`
  | `save-pool:${string}`
  | `sync-pool:${string}`
  | `toggle-account:${string}`;

export function useAccountPools() {
  const [accounts, setAccounts] = useState<OAuthAccountSummary[]>([]);
  const [pools, setPools] = useState<OAuthPoolSummary[]>([]);
  const [_poolDrafts, setPoolDrafts] = useState<Record<string, PoolDraft>>({});
  const [busyAction, setBusyAction] = useState<FormBusyAction>(null);
  const [error, setError] = useState<string | null>(null);
  const [providerOptions, setProviderOptions] = useState<ProviderOption[]>(() => [
    ...FALLBACK_PROVIDER_OPTIONS,
  ]);

  const refreshInFlightRef = useRef<Promise<void> | null>(null);
  const refreshQueuedRef = useRef(false);
  const refreshVersionRef = useRef(0);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      refreshVersionRef.current += 1;
    };
  }, []);

  const readOAuthStateSnapshot = useCallback(async () => {
    const nextAccounts = await listOAuthAccounts(null);
    const nextPools = await listOAuthPools(null);
    const nextPoolMembersByPoolId = Object.fromEntries(
      await Promise.all(
        nextPools.map(async (pool) => {
          const members = await listOAuthPoolMembers(pool.poolId);
          return [pool.poolId, members] as const;
        })
      )
    );
    return { nextAccounts, nextPools, nextPoolMembersByPoolId };
  }, []);

  const readCodexAccountsForOauthSync = useCallback(async () => {
    return listOAuthAccounts("codex");
  }, []);

  const refreshOAuthState = useCallback(async () => {
    if (refreshInFlightRef.current) {
      refreshQueuedRef.current = true;
      return refreshInFlightRef.current;
    }
    const refreshPromise = (async () => {
      const refreshVersion = refreshVersionRef.current + 1;
      refreshVersionRef.current = refreshVersion;
      setBusyAction("refresh");
      setError(null);
      try {
        const { nextAccounts, nextPools, nextPoolMembersByPoolId } = await readOAuthStateSnapshot();
        if (!isMountedRef.current || refreshVersion !== refreshVersionRef.current) {
          return;
        }
        setAccounts(
          nextAccounts.slice().sort((left, right) => (right.updatedAt ?? 0) - (left.updatedAt ?? 0))
        );
        const sortedPools = nextPools
          .slice()
          .sort((left, right) => (right.updatedAt ?? 0) - (left.updatedAt ?? 0));
        setPools(sortedPools);
        setPoolDrafts((previous) =>
          buildPoolDrafts(sortedPools, nextAccounts, nextPoolMembersByPoolId, previous)
        );

        setProviderOptions(buildProviderOptionsFromState(nextAccounts, sortedPools));
        void getProvidersCatalog()
          .then((nextProvidersCatalog) => {
            if (!isMountedRef.current || refreshVersion !== refreshVersionRef.current) {
              return;
            }
            const nextOptions = buildProviderOptionsFromCatalog(nextProvidersCatalog);
            if (nextOptions.length > 0) {
              setProviderOptions(nextOptions);
            }
          })
          .catch(() => undefined);
      } catch (nextError) {
        if (!isMountedRef.current || refreshVersion !== refreshVersionRef.current) {
          return;
        }
        setError(formatError(nextError, "Unable to load account/provider settings."));
      } finally {
        if (isMountedRef.current && refreshVersion === refreshVersionRef.current) {
          setBusyAction(null);
        }
      }
    })();
    refreshInFlightRef.current = refreshPromise;
    try {
      await refreshPromise;
    } finally {
      if (refreshInFlightRef.current === refreshPromise) {
        refreshInFlightRef.current = null;
      }
      if (refreshQueuedRef.current && isMountedRef.current) {
        refreshQueuedRef.current = false;
        await refreshOAuthState();
      }
    }
  }, [readOAuthStateSnapshot]);

  useEffect(() => {
    void refreshOAuthState();
  }, [refreshOAuthState]);

  useRuntimeOauthRefresh({
    refreshOAuthState,
    setError,
  });

  useOauthPopupRefresh({
    refreshOAuthState,
    setError,
  });

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
    [readCodexAccountsForOauthSync]
  );

  const handleAddAccount = useCallback(async () => {
    setBusyAction("add-account");
    setError(null);
    try {
      const { pendingSync } = await launchCodexOAuthFlow(
        {
          shouldUseWebOAuthPopup,
          openOAuthPopupWindow,
          listWorkspacesForOauth,
          runCodexLogin,
          openOAuthUrl,
          waitForCodexOauthBinding,
          refreshOAuthState,
        },
        {
          action: { kind: "add" },
          defaultWorkspaceId: OAUTH_LOGIN_DEFAULT_WORKSPACE_ID,
          baselineUpdatedAt: maxCodexAccountTimestamp(accounts),
        }
      );
      if (pendingSync) {
        await pendingSync;
      }
    } catch (error) {
      if (isMountedRef.current) {
        setError(formatError(error, "Unable to start Codex login."));
      }
    } finally {
      if (isMountedRef.current) {
        setBusyAction(null);
      }
    }
  }, [accounts, refreshOAuthState, waitForCodexOauthBinding]);

  const handleDeleteAccount = useCallback(
    async (accountId: string) => {
      setBusyAction(`remove-account:${accountId}`);
      try {
        await removeOAuthAccount(accountId);
        await refreshOAuthState();
      } catch (error) {
        setError(formatError(error, "Failed to remove account."));
      } finally {
        if (isMountedRef.current) {
          setBusyAction(null);
        }
      }
    },
    [refreshOAuthState]
  );

  const handleToggleAccount = useCallback(
    async (account: OAuthAccountSummary) => {
      const nextStatus = account.status === "enabled" ? "disabled" : "enabled";
      setBusyAction(`toggle-account:${account.accountId}`);
      try {
        await upsertOAuthAccount({
          ...account,
          status: nextStatus,
        });
        await refreshOAuthState();
      } catch (error) {
        setError(formatError(error, "Failed to toggle account status."));
      } finally {
        if (isMountedRef.current) {
          setBusyAction(null);
        }
      }
    },
    [refreshOAuthState]
  );

  return {
    accounts,
    pools,
    providerOptions,
    busyAction,
    error,
    refreshOAuthState,
    handleAddAccount,
    handleDeleteAccount,
    handleToggleAccount,
  };
}
