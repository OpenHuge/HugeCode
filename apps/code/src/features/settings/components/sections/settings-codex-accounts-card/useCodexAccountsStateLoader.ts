import {
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
  useCallback,
  useRef,
} from "react";
import type { OAuthUsageRefreshMode } from "../../../../../application/runtime/ports/runtimeClient";
import {
  getAccountInfo,
  getOAuthPrimaryAccount,
  getProvidersCatalog,
  listOAuthAccounts,
  listOAuthPoolMembers,
  listOAuthPools,
  type OAuthAccountSummary,
  type OAuthPrimaryAccountSummary,
  type OAuthPoolSummary,
} from "../../../../../application/runtime/ports/oauth";
import {
  buildPoolDrafts,
  buildProviderOptionsFromCatalog,
  buildProviderOptionsFromState,
  formatError,
  type PoolDraft,
  type ProviderOption,
} from "../settingsCodexAccountsCardUtils";
import { listWorkspacesForOauth, OAUTH_LOGIN_DEFAULT_WORKSPACE_ID } from "./oauthHelpers";
import { CODEX_PRIMARY_POOL_ID } from "./settingsCodexPrimaryPool";
import type { FormBusyAction, PoolSaveState, PoolSelectionPreview } from "./types";

type UseCodexAccountsStateLoaderParams = {
  isMountedRef: MutableRefObject<boolean>;
  poolSaveStateByIdRef: MutableRefObject<Record<string, PoolSaveState>>;
  setBusyAction: Dispatch<SetStateAction<FormBusyAction>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setAccounts: Dispatch<SetStateAction<OAuthAccountSummary[]>>;
  setPools: Dispatch<SetStateAction<OAuthPoolSummary[]>>;
  setCodexPrimaryAccount: Dispatch<SetStateAction<OAuthPrimaryAccountSummary | null>>;
  setPoolDrafts: Dispatch<SetStateAction<Record<string, PoolDraft>>>;
  setPoolSaveStateById: Dispatch<SetStateAction<Record<string, PoolSaveState>>>;
  setSelectedAccountIds: Dispatch<SetStateAction<string[]>>;
  setSelectedPoolIds: Dispatch<SetStateAction<string[]>>;
  setPoolSelectionPreviewById: Dispatch<SetStateAction<Record<string, PoolSelectionPreview>>>;
  setProviderOptions: Dispatch<SetStateAction<ProviderOption[]>>;
  setCodexAuthRequired: Dispatch<SetStateAction<boolean | null>>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readRequiresOpenaiAuth(value: unknown): boolean | null {
  if (!isRecord(value)) {
    return null;
  }
  const result = isRecord(value.result) ? value.result : value;
  const raw = result.requiresOpenaiAuth ?? result.requires_openai_auth;
  return typeof raw === "boolean" ? raw : null;
}

function resolvePrimaryRouteAccountId(
  primaryAccount: OAuthPrimaryAccountSummary | null | undefined
): string | null {
  return primaryAccount?.routeAccountId ?? primaryAccount?.accountId ?? null;
}

export function useCodexAccountsStateLoader({
  isMountedRef,
  poolSaveStateByIdRef,
  setBusyAction,
  setError,
  setAccounts,
  setPools,
  setCodexPrimaryAccount,
  setPoolDrafts,
  setPoolSaveStateById,
  setSelectedAccountIds,
  setSelectedPoolIds,
  setPoolSelectionPreviewById,
  setProviderOptions,
  setCodexAuthRequired,
}: UseCodexAccountsStateLoaderParams) {
  const refreshInFlightRef = useRef<Promise<void> | null>(null);
  const refreshQueuedRef = useRef(false);
  const refreshQueuedUsageModeRef = useRef<OAuthUsageRefreshMode | null>(null);
  const refreshVersionRef = useRef(0);
  const lastRuntimeUpdatedRevisionRef = useRef<string | null>(null);

  const readOAuthStateSnapshot = useCallback(async (usageRefresh: OAuthUsageRefreshMode | null) => {
    const nextAccounts = usageRefresh
      ? await listOAuthAccounts(null, { usageRefresh })
      : await listOAuthAccounts(null);
    const nextPools = await listOAuthPools(null);
    const nextPoolMembersByPoolId = Object.fromEntries(
      await Promise.all(
        nextPools.map(async (pool) => {
          const members = await listOAuthPoolMembers(pool.poolId);
          return [pool.poolId, members] as const;
        })
      )
    );
    const nextCodexPrimaryAccount = await getOAuthPrimaryAccount("codex").catch(() => null);
    return { nextAccounts, nextPools, nextPoolMembersByPoolId, nextCodexPrimaryAccount };
  }, []);

  const readCodexAuthRequired = useCallback(async (): Promise<boolean | null> => {
    try {
      const availableWorkspaces = await listWorkspacesForOauth().catch(() => []);
      const connectedWorkspaceId =
        availableWorkspaces.find((workspace) => workspace.connected)?.id ?? null;
      const workspaceId =
        connectedWorkspaceId ?? availableWorkspaces[0]?.id ?? OAUTH_LOGIN_DEFAULT_WORKSPACE_ID;
      const accountInfo = await getAccountInfo(workspaceId);
      return readRequiresOpenaiAuth(accountInfo);
    } catch {
      return null;
    }
  }, []);

  const refreshOAuthState = useCallback(
    async (options: { usageRefresh?: OAuthUsageRefreshMode | null } = {}) => {
      const usageRefresh = options.usageRefresh ?? null;
      if (refreshInFlightRef.current) {
        refreshQueuedRef.current = true;
        if (usageRefresh === "force") {
          refreshQueuedUsageModeRef.current = "force";
        } else if (!refreshQueuedUsageModeRef.current) {
          refreshQueuedUsageModeRef.current = usageRefresh;
        }
        return refreshInFlightRef.current;
      }
      const refreshPromise = (async () => {
        const refreshVersion = refreshVersionRef.current + 1;
        refreshVersionRef.current = refreshVersion;
        setBusyAction("refresh");
        setError(null);
        try {
          const [
            { nextAccounts, nextPools, nextPoolMembersByPoolId, nextCodexPrimaryAccount },
            nextCodexAuthRequired,
          ] = await Promise.all([readOAuthStateSnapshot(usageRefresh), readCodexAuthRequired()]);
          if (!isMountedRef.current || refreshVersion !== refreshVersionRef.current) {
            return;
          }
          setCodexAuthRequired(nextCodexAuthRequired);
          setCodexPrimaryAccount(nextCodexPrimaryAccount);
          setAccounts(
            nextAccounts
              .slice()
              .sort((left, right) => (right.updatedAt ?? 0) - (left.updatedAt ?? 0))
          );
          const sortedPools = nextPools
            .slice()
            .sort((left, right) => (right.updatedAt ?? 0) - (left.updatedAt ?? 0));
          setPools(sortedPools);
          setPoolDrafts((previous) => {
            const nextDrafts = buildPoolDrafts(
              sortedPools,
              nextAccounts,
              nextPoolMembersByPoolId,
              previous
            );
            const codexPrimaryPoolDraft = nextDrafts[CODEX_PRIMARY_POOL_ID];
            if (codexPrimaryPoolDraft) {
              nextDrafts[CODEX_PRIMARY_POOL_ID] = {
                ...codexPrimaryPoolDraft,
                preferredAccountId: resolvePrimaryRouteAccountId(nextCodexPrimaryAccount) ?? "",
              };
            }
            const protectedStatuses = new Set<PoolSaveState["status"]>([
              "dirty",
              "saving",
              "error",
            ]);
            for (const pool of sortedPools) {
              const poolId = pool.poolId;
              const state = poolSaveStateByIdRef.current[poolId];
              if (!state || !protectedStatuses.has(state.status)) {
                continue;
              }
              if (previous[poolId]) {
                nextDrafts[poolId] = previous[poolId];
              }
            }
            return nextDrafts;
          });
          setPoolSaveStateById((previous) => {
            const nextPoolIdSet = new Set(sortedPools.map((pool) => pool.poolId));
            return Object.fromEntries(
              Object.entries(previous).filter(([poolId]) => nextPoolIdSet.has(poolId))
            );
          });
          setSelectedAccountIds((previous) => {
            const accountIdSet = new Set(nextAccounts.map((account) => account.accountId));
            return previous.filter((accountId) => accountIdSet.has(accountId));
          });
          setSelectedPoolIds((previous) => {
            const poolIdSet = new Set(sortedPools.map((pool) => pool.poolId));
            return previous.filter((poolId) => poolIdSet.has(poolId));
          });
          setPoolSelectionPreviewById((previous) =>
            Object.fromEntries(
              Object.entries(previous).filter(([poolId]) =>
                sortedPools.some((entry) => entry.poolId === poolId)
              )
            )
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
          setCodexAuthRequired(null);
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
          const queuedUsageRefresh = refreshQueuedUsageModeRef.current;
          refreshQueuedUsageModeRef.current = null;
          void refreshOAuthState({ usageRefresh: queuedUsageRefresh });
        }
      }
    },
    [
      isMountedRef,
      poolSaveStateByIdRef,
      readCodexAuthRequired,
      readOAuthStateSnapshot,
      setAccounts,
      setBusyAction,
      setCodexAuthRequired,
      setCodexPrimaryAccount,
      setError,
      setPoolDrafts,
      setPools,
      setPoolSaveStateById,
      setPoolSelectionPreviewById,
      setProviderOptions,
      setSelectedAccountIds,
      setSelectedPoolIds,
    ]
  );

  return {
    lastRuntimeUpdatedRevisionRef,
    refreshOAuthState,
  };
}
