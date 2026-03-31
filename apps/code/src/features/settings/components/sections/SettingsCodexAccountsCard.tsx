import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  DeactivatedChatgptWorkspaceCandidate,
  ReviewDeactivatedChatgptWorkspacesResult,
} from "../../../../application/runtime/facades/chatgptWorkspaceAutomationFacade";

import {
  applyOAuthPool,
  listOAuthAccounts,
  readOAuthSubscriptionPersistenceCapability,
  type OAuthAccountSummary,
  type OAuthPrimaryAccountSummary,
  type OAuthPoolSummary,
  type OAuthProviderId,
  type RuntimeCockpitToolsCodexImportResponse,
  removeOAuthPool,
  reportOAuthRateLimit,
  selectOAuthPoolAccount,
  setOAuthPrimaryAccount,
} from "../../../../application/runtime/ports/oauth";
import {
  readSafeLocalStorageItem,
  writeSafeLocalStorageItem,
} from "../../../../utils/safeLocalStorage";
import {
  canonicalizeProviderBrandId,
  resolveProviderBrandRouteId,
  type ProviderBrandId,
} from "../../../app/utils/antiGravityBranding";
import { ConfirmDialog } from "./settings-codex-accounts-card/ConfirmDialog";
import { STICKY_MODE_DESCRIPTION } from "./settings-codex-accounts-card/oauthHelpers";
import { SettingsCodexAccountsNavigation } from "./settings-codex-accounts-card/SettingsCodexAccountsNavigation";
import { SettingsCodexAccountsTab } from "./settings-codex-accounts-card/SettingsCodexAccountsTab";
import { SettingsCodexHealthTab } from "./settings-codex-accounts-card/SettingsCodexHealthTab";
import { SettingsCodexPoolsTab } from "./settings-codex-accounts-card/SettingsCodexPoolsTab";
import type {
  AccountPoolsTab,
  AccountStatusFilter,
  FormBusyAction,
  PoolSaveState,
  PoolSelectionPreview,
  ProviderFilter,
} from "./settings-codex-accounts-card/types";
import { useCodexAccountActions } from "./settings-codex-accounts-card/useCodexAccountActions";
import { useCodexAccountCreationActions } from "./settings-codex-accounts-card/useCodexAccountCreationActions";
import { useCodexAccountsAsyncHelpers } from "./settings-codex-accounts-card/useCodexAccountsAsyncHelpers";
import { useCodexAccountsDerivedState } from "./settings-codex-accounts-card/useCodexAccountsDerivedState";
import { useCodexOAuthAccountActions } from "./settings-codex-accounts-card/useCodexOAuthAccountActions";
import {
  useCodexOauthPopupRefresh,
  useCodexRuntimeOauthRefresh,
} from "./settings-codex-accounts-card/useCodexOauthRefreshTriggers";
import { useCodexAccountsStateLoader } from "./settings-codex-accounts-card/useCodexAccountsStateLoader";
import { useCodexPoolBulkActions } from "./settings-codex-accounts-card/useCodexPoolBulkActions";
import {
  buildPoolDrafts,
  buildPoolMembersFromDraft,
  FALLBACK_PROVIDER_OPTIONS,
  formatError,
  isPoolVersionMismatchError,
  type PoolDraft,
  type ProviderOption,
  readErrorCode,
  slugify,
} from "./settingsCodexAccountsCardUtils";
import { isCodexPrimaryPool } from "./settings-codex-accounts-card/settingsCodexPrimaryPool";

type SettingsCodexAccountsCardProps = {
  onClose?: () => void;
};

type PendingDeactivatedWorkspaceReview = {
  account: OAuthAccountSummary;
  review: ReviewDeactivatedChatgptWorkspacesResult & {
    status: "supported";
    candidates: DeactivatedChatgptWorkspaceCandidate[];
  };
};

function isSupportedDeactivatedWorkspaceReview(
  review: ReviewDeactivatedChatgptWorkspacesResult
): review is PendingDeactivatedWorkspaceReview["review"] {
  return review.status === "supported";
}

const STORAGE_KEY_ACTIVE_TAB = "codex_accounts_tab_v1";
const STORAGE_KEY_ACCOUNT_PROVIDER_FILTER = "codex_accounts_provider_filter_v1";
const STORAGE_KEY_ACCOUNT_STATUS_FILTER = "codex_accounts_status_filter_v1";
const STORAGE_KEY_ACCOUNT_SEARCH_QUERY = "codex_accounts_search_query_v1";
const STORAGE_KEY_POOL_PROVIDER_FILTER = "codex_pools_provider_filter_v1";
const POOL_SAVE_STATE_CODES = {
  dirty: "settings.codex.pool.dirty",
  saving: "settings.codex.pool.save.pending",
  saved: "settings.codex.pool.save.success",
  error: "settings.codex.pool.save.error",
  conflict: "settings.codex.pool.save.conflict",
} as const;

function resolvePrimaryRouteAccountId(
  primaryAccount: OAuthPrimaryAccountSummary | null | undefined
): string | null {
  return primaryAccount?.routeAccountId ?? primaryAccount?.accountId ?? null;
}

function readStoredActiveTab(): AccountPoolsTab {
  const raw = readSafeLocalStorageItem(STORAGE_KEY_ACTIVE_TAB);
  if (raw === "accounts" || raw === "pools" || raw === "health") {
    return raw;
  }
  return "accounts";
}

function readStoredProviderFilter(key: string): ProviderFilter {
  const raw = readSafeLocalStorageItem(key);
  if (!raw) {
    return "all";
  }
  return raw as ProviderFilter;
}

function readStoredAccountStatusFilter(): AccountStatusFilter {
  const raw = readSafeLocalStorageItem(STORAGE_KEY_ACCOUNT_STATUS_FILTER);
  if (
    raw === "enabled" ||
    raw === "disabled" ||
    raw === "forbidden" ||
    raw === "validation_blocked"
  ) {
    return raw;
  }
  return "all";
}

function readStoredAccountSearchQuery(): string {
  const raw = readSafeLocalStorageItem(STORAGE_KEY_ACCOUNT_SEARCH_QUERY);
  if (!raw) {
    return "";
  }
  return raw.trim();
}

function formatCockpitToolsImportSummary(result: RuntimeCockpitToolsCodexImportResponse): string {
  if (typeof result.message === "string" && result.message.trim().length > 0) {
    return result.message.trim();
  }
  const parts = [
    `Imported ${result.imported}`,
    `updated ${result.updated}`,
    `skipped ${result.skipped}`,
  ];
  if (result.failed > 0) {
    parts.push(`failed ${result.failed}`);
  }
  return `${parts.join(", ")} from cockpit-tools.`;
}

export function SettingsCodexAccountsCard({ onClose }: SettingsCodexAccountsCardProps) {
  const [accounts, setAccounts] = useState<OAuthAccountSummary[]>([]);
  const [pools, setPools] = useState<OAuthPoolSummary[]>([]);
  const [codexPrimaryAccount, setCodexPrimaryAccount] = useState<OAuthPrimaryAccountSummary | null>(
    null
  );
  const [poolDrafts, setPoolDrafts] = useState<Record<string, PoolDraft>>({});
  const [poolSaveStateById, setPoolSaveStateById] = useState<Record<string, PoolSaveState>>({});
  const [busyAction, setBusyAction] = useState<FormBusyAction>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [providerOptions, setProviderOptions] = useState<ProviderOption[]>(() => [
    ...FALLBACK_PROVIDER_OPTIONS,
  ]);
  const [accountProviderDraft, setAccountProviderDraft] = useState<ProviderBrandId>("codex");
  const [accountEmailDraft, setAccountEmailDraft] = useState("");
  const [accountDisplayNameDraft, setAccountDisplayNameDraft] = useState("");
  const [accountPlanDraft, setAccountPlanDraft] = useState("");
  const [accountCompatBaseUrlDraft, setAccountCompatBaseUrlDraft] = useState("");
  const [accountProxyIdDraft, setAccountProxyIdDraft] = useState("");
  const [accountProviderFilter, setAccountProviderFilter] = useState<ProviderFilter>(() =>
    readStoredProviderFilter(STORAGE_KEY_ACCOUNT_PROVIDER_FILTER)
  );
  const [accountStatusFilter, setAccountStatusFilter] = useState<AccountStatusFilter>(() =>
    readStoredAccountStatusFilter()
  );
  const [accountSearchQuery, setAccountSearchQuery] = useState(() =>
    readStoredAccountSearchQuery()
  );
  const [activeTab, setActiveTab] = useState<AccountPoolsTab>(() => readStoredActiveTab());
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [poolProviderDraft, setPoolProviderDraft] = useState<ProviderBrandId>("codex");
  const [poolNameDraft, setPoolNameDraft] = useState("");
  const [poolMemberAccountIdsDraft, setPoolMemberAccountIdsDraft] = useState<string[]>([]);
  const [poolPreferredAccountIdDraft, setPoolPreferredAccountIdDraft] = useState("");
  const [poolProviderFilter, setPoolProviderFilter] = useState<ProviderFilter>(() =>
    readStoredProviderFilter(STORAGE_KEY_POOL_PROVIDER_FILTER)
  );
  const [selectedPoolIds, setSelectedPoolIds] = useState<string[]>([]);
  const [bulkPoolStickyModeDraft, setBulkPoolStickyModeDraft] =
    useState<OAuthPoolSummary["stickyMode"]>("cache_first");
  const [poolSelectionPreviewById, setPoolSelectionPreviewById] = useState<
    Record<string, PoolSelectionPreview>
  >({});
  const [codexAuthRequired, setCodexAuthRequired] = useState<boolean | null>(null);
  const poolSaveStateByIdRef = useRef<Record<string, PoolSaveState>>({});
  const isMountedRef = useRef(true);
  const healthSectionRef = useRef<HTMLDivElement | null>(null);
  const accountCreateSectionRef = useRef<HTMLElement | null>(null);
  const poolCreateSectionRef = useRef<HTMLElement | null>(null);
  const [pendingRemoveAccount, setPendingRemoveAccount] = useState<OAuthAccountSummary | null>(
    null
  );
  const [pendingDeactivatedWorkspaceReview, setPendingDeactivatedWorkspaceReview] =
    useState<PendingDeactivatedWorkspaceReview | null>(null);
  const subscriptionPersistenceCapability = readOAuthSubscriptionPersistenceCapability();

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    writeSafeLocalStorageItem(STORAGE_KEY_ACTIVE_TAB, activeTab);
  }, [activeTab]);

  useEffect(() => {
    writeSafeLocalStorageItem(STORAGE_KEY_ACCOUNT_PROVIDER_FILTER, accountProviderFilter);
  }, [accountProviderFilter]);

  useEffect(() => {
    writeSafeLocalStorageItem(STORAGE_KEY_ACCOUNT_STATUS_FILTER, accountStatusFilter);
  }, [accountStatusFilter]);

  useEffect(() => {
    writeSafeLocalStorageItem(STORAGE_KEY_ACCOUNT_SEARCH_QUERY, accountSearchQuery);
  }, [accountSearchQuery]);

  useEffect(() => {
    writeSafeLocalStorageItem(STORAGE_KEY_POOL_PROVIDER_FILTER, poolProviderFilter);
  }, [poolProviderFilter]);

  useEffect(() => {
    poolSaveStateByIdRef.current = poolSaveStateById;
  }, [poolSaveStateById]);

  const readCodexAccountsForOauthSync = useCallback(async () => {
    return listOAuthAccounts("codex");
  }, []);
  const { lastRuntimeUpdatedRevisionRef, refreshOAuthState } = useCodexAccountsStateLoader({
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
  });

  useEffect(() => {
    void refreshOAuthState();
  }, [refreshOAuthState]);

  useCodexRuntimeOauthRefresh({
    lastRuntimeUpdatedRevisionRef,
    refreshOAuthState,
    setError,
  });
  useCodexOauthPopupRefresh({ refreshOAuthState, setError });

  useEffect(() => {
    if (providerOptions.length === 0) {
      return;
    }
    if (!providerOptions.some((provider) => provider.id === accountProviderDraft)) {
      setAccountProviderDraft(providerOptions[0]?.id ?? "codex");
    }
    if (!providerOptions.some((provider) => provider.id === poolProviderDraft)) {
      const fallbackProvider = providerOptions[0]?.id ?? "codex";
      setPoolProviderDraft(fallbackProvider);
      setPoolMemberAccountIdsDraft(
        accounts
          .filter((account) => account.provider === resolveProviderBrandRouteId(fallbackProvider))
          .map((account) => account.accountId)
      );
      setPoolPreferredAccountIdDraft("");
    }
    if (
      accountProviderFilter !== "all" &&
      !providerOptions.some((provider) => provider.id === accountProviderFilter)
    ) {
      setAccountProviderFilter("all");
    }
    if (
      poolProviderFilter !== "all" &&
      !providerOptions.some((provider) => provider.id === poolProviderFilter)
    ) {
      setPoolProviderFilter("all");
    }
  }, [
    accountProviderDraft,
    accountProviderFilter,
    accounts,
    poolProviderDraft,
    poolProviderFilter,
    providerOptions,
  ]);

  const selectedAccountProvider = useMemo(
    () => providerOptions.find((provider) => provider.id === accountProviderDraft) ?? null,
    [accountProviderDraft, providerOptions]
  );
  const codexProviderSelected = canonicalizeProviderBrandId(accountProviderDraft) === "codex";
  const selectedPoolProvider = useMemo(
    () => providerOptions.find((provider) => provider.id === poolProviderDraft) ?? null,
    [poolProviderDraft, providerOptions]
  );

  const {
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
  } = useCodexAccountsDerivedState({
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
  });

  useEffect(() => {
    const providerAccountIds = providerAccounts.map((account) => account.accountId);
    setPoolMemberAccountIdsDraft((previous) => {
      const providerIdSet = new Set(providerAccountIds);
      if (previous.length === 0) {
        return providerAccountIds;
      }
      return previous.filter((accountId) => providerIdSet.has(accountId));
    });
  }, [providerAccounts]);

  useEffect(() => {
    if (
      poolPreferredAccountIdDraft &&
      !poolMemberAccountIdsDraft.includes(poolPreferredAccountIdDraft)
    ) {
      setPoolPreferredAccountIdDraft("");
    }
  }, [poolMemberAccountIdsDraft, poolPreferredAccountIdDraft]);

  const setPoolSaveState = useCallback((poolId: string, nextState: PoolSaveState) => {
    setPoolSaveStateById((previous) => {
      const current = previous[poolId];
      if (current?.status === nextState.status && current.code === nextState.code) {
        return previous;
      }
      return {
        ...previous,
        [poolId]: nextState,
      };
    });
  }, []);

  const updatePoolDraft = useCallback(
    (poolId: string, update: Partial<PoolDraft>) => {
      let updated = false;
      setPoolDrafts((previous) => {
        const current = previous[poolId];
        if (!current) {
          return previous;
        }
        updated = true;
        return {
          ...previous,
          [poolId]: {
            ...current,
            ...update,
          },
        };
      });
      if (updated) {
        setPoolSaveState(poolId, {
          status: "dirty",
          code: POOL_SAVE_STATE_CODES.dirty,
          message: null,
        });
      }
    },
    [setPoolSaveState]
  );

  const buildPoolApplyPayload = useCallback(
    (
      pool: OAuthPoolSummary,
      draft: PoolDraft,
      options: {
        expectedUpdatedAt?: number | null;
        preferredAccountIdOverride?: string | null;
      } = {}
    ) => {
      const poolAccounts = accounts.filter((account) => account.provider === pool.provider);
      const members = buildPoolMembersFromDraft(poolAccounts, draft, draft.memberAccountIds);
      return {
        pool: {
          poolId: pool.poolId,
          provider: pool.provider,
          name: draft.name.trim() || pool.name,
          strategy: draft.strategy,
          stickyMode: draft.stickyMode,
          preferredAccountId:
            (options.preferredAccountIdOverride ?? draft.preferredAccountId.trim()) || null,
          enabled: draft.enabled,
          metadata: pool.metadata ?? {},
        },
        members,
        expectedUpdatedAt: options.expectedUpdatedAt ?? pool.updatedAt ?? null,
      };
    },
    [accounts]
  );

  const applyPoolDraft = useCallback(
    async (
      pool: OAuthPoolSummary,
      draft: PoolDraft,
      options: { expectedUpdatedAt?: number | null } = {}
    ) => {
      setPoolSaveState(pool.poolId, {
        status: "saving",
        code: POOL_SAVE_STATE_CODES.saving,
        message: null,
      });
      try {
        let preferredAccountIdOverride: string | null | undefined;
        if (isCodexPrimaryPool(pool)) {
          const nextPrimaryAccountId = draft.preferredAccountId.trim() || null;
          const currentPrimaryAccountId =
            resolvePrimaryRouteAccountId(codexPrimaryAccount) ?? pool.preferredAccountId ?? null;
          if (nextPrimaryAccountId !== currentPrimaryAccountId) {
            const nextPrimaryAccount = await setOAuthPrimaryAccount({
              provider: "codex",
              accountId: nextPrimaryAccountId,
            });
            if (isMountedRef.current) {
              setCodexPrimaryAccount(nextPrimaryAccount);
            }
            preferredAccountIdOverride = resolvePrimaryRouteAccountId(nextPrimaryAccount);
          } else {
            preferredAccountIdOverride = currentPrimaryAccountId;
          }
        }
        const applied = await applyOAuthPool(
          buildPoolApplyPayload(pool, draft, {
            expectedUpdatedAt: options.expectedUpdatedAt,
            preferredAccountIdOverride,
          })
        );
        if (!isMountedRef.current) {
          return false;
        }
        setPools((previous) =>
          previous.map((entry) => (entry.poolId === applied.pool.poolId ? applied.pool : entry))
        );
        setPoolDrafts((previous) => {
          const currentDraft = previous[pool.poolId];
          const nextDrafts = buildPoolDrafts(
            [applied.pool],
            accounts,
            { [applied.pool.poolId]: applied.members },
            currentDraft ? { [pool.poolId]: currentDraft } : {}
          );
          return {
            ...previous,
            [pool.poolId]: nextDrafts[pool.poolId] ?? currentDraft ?? draft,
          };
        });
        setPoolSaveState(pool.poolId, {
          status: "idle",
          code: POOL_SAVE_STATE_CODES.saved,
          message: null,
        });
        return true;
      } catch (nextError) {
        if (!isMountedRef.current) {
          return false;
        }
        const errorCode = readErrorCode(nextError);
        const message = formatError(nextError, "Unable to save pool settings.");
        if (isPoolVersionMismatchError(nextError)) {
          setPoolSaveState(pool.poolId, {
            status: "conflict",
            code: POOL_SAVE_STATE_CODES.conflict,
            message: "Remote pool updated. Reloaded latest version.",
          });
          await refreshOAuthState();
          return false;
        }
        setPoolSaveState(pool.poolId, {
          status: "error",
          code: errorCode ?? POOL_SAVE_STATE_CODES.error,
          message,
        });
        return false;
      }
    },
    [accounts, buildPoolApplyPayload, codexPrimaryAccount, refreshOAuthState, setPoolSaveState]
  );

  const handleAutosavePool = useCallback(
    async (pool: OAuthPoolSummary, draftOverride?: PoolDraft) => {
      const draft = draftOverride ?? poolDrafts[pool.poolId];
      if (!draft) {
        return;
      }
      const currentState = poolSaveStateByIdRef.current[pool.poolId];
      if (currentState?.status === "saving") {
        return;
      }
      await applyPoolDraft(pool, draft);
    },
    [applyPoolDraft, poolDrafts]
  );

  const {
    resolvePoolProbeAccountId,
    syncPoolMembers,
    syncProviderPoolMembers,
    waitForCodexOauthBinding,
  } = useCodexAccountsAsyncHelpers({
    accounts,
    pools,
    poolDrafts,
    poolSelectionPreviewById,
    readCodexAccountsForOauthSync,
    isMountedRef,
  });

  const {
    handleBulkAccountStatus,
    handleBulkRemoveAccounts,
    handleLeaveAccountDeactivatedChatgptWorkspaces,
    handleRemoveAccount,
    handleReviewAccountDeactivatedChatgptWorkspaces,
    handleToggleAccountStatus,
    handleUpdateAccountDefaultChatgptWorkspace,
  } = useCodexAccountActions({
    accounts,
    selectedAccountIds,
    refreshOAuthState,
    syncProviderPoolMembers,
    setBusyAction,
    setError,
    setSelectedAccountIds,
  });
  const { handleBulkPoolStatus, handleBulkPoolStickyMode, handleBulkRemovePools } =
    useCodexPoolBulkActions({
      pools,
      selectedPoolIds,
      refreshOAuthState,
      syncProviderPoolMembers,
      setBusyAction,
      setError,
      setSelectedPoolIds,
    });
  const { handleAddCodexAccount, handleReauthenticateAccount } = useCodexOAuthAccountActions({
    accounts,
    refreshOAuthState,
    waitForCodexOauthBinding,
    setBusyAction,
    setError,
    isMountedRef,
  });
  const { handleAddAccount, handleImportCockpitTools } = useCodexAccountCreationActions({
    accounts,
    accountProviderDraft,
    accountEmailDraft,
    accountDisplayNameDraft,
    accountPlanDraft,
    accountCompatBaseUrlDraft,
    accountProxyIdDraft,
    handleAddCodexAccount,
    refreshOAuthState,
    syncProviderPoolMembers,
    setBusyAction,
    setError,
    setNotice,
    setAccountEmailDraft,
    setAccountDisplayNameDraft,
    setAccountPlanDraft,
    setAccountCompatBaseUrlDraft,
    setAccountProxyIdDraft,
    formatCockpitToolsImportSummary,
    isMountedRef,
  });

  const handleReviewDeactivatedChatgptWorkspaces = useCallback(
    async (account: OAuthAccountSummary) => {
      const review = await handleReviewAccountDeactivatedChatgptWorkspaces(account);
      if (!isSupportedDeactivatedWorkspaceReview(review)) {
        if (review.message.trim().length > 0) {
          setError(review.message);
        }
        return;
      }
      if (review.candidates.length === 0) {
        setNotice(review.message);
        return;
      }
      setPendingDeactivatedWorkspaceReview({
        account,
        review,
      });
    },
    [handleReviewAccountDeactivatedChatgptWorkspaces]
  );

  const handleConfirmLeaveDeactivatedChatgptWorkspaces = useCallback(async () => {
    const pendingReview = pendingDeactivatedWorkspaceReview;
    if (!pendingReview) {
      return;
    }
    const result = await handleLeaveAccountDeactivatedChatgptWorkspaces(
      pendingReview.account,
      pendingReview.review.candidates
    );
    setPendingDeactivatedWorkspaceReview(null);
    if (result.message.trim().length > 0) {
      if (result.status === "completed") {
        setNotice(result.message);
      } else {
        setError(result.message);
      }
    }
  }, [handleLeaveAccountDeactivatedChatgptWorkspaces, pendingDeactivatedWorkspaceReview]);

  const handleAddPool = useCallback(async () => {
    const normalizedName = poolNameDraft.trim();
    if (!normalizedName) {
      setError("Pool name is required.");
      return;
    }
    setBusyAction("add-pool");
    setError(null);
    try {
      const resolvedPoolProviderId = resolveProviderBrandRouteId(poolProviderDraft);
      const poolId = `${resolvedPoolProviderId}-${slugify(normalizedName)}-${Date.now()}`;
      const initialDraft: PoolDraft = {
        name: normalizedName,
        strategy: "round_robin",
        stickyMode: "cache_first",
        preferredAccountId: poolPreferredAccountIdDraft || "",
        memberAccountIds: [...poolMemberAccountIdsDraft],
        memberPoliciesByAccountId: {},
        enabled: true,
      };
      const initialMembers = buildPoolMembersFromDraft(
        providerAccounts,
        initialDraft,
        poolMemberAccountIdsDraft
      );
      const applied = await applyOAuthPool({
        pool: {
          poolId,
          provider: resolvedPoolProviderId,
          name: normalizedName,
          strategy: "round_robin",
          stickyMode: "cache_first",
          preferredAccountId: poolPreferredAccountIdDraft || null,
          enabled: true,
          metadata: {},
        },
        members: initialMembers,
        expectedUpdatedAt: null,
      });
      setPools((previous) => [
        applied.pool,
        ...previous.filter((entry) => entry.poolId !== poolId),
      ]);
      setPoolDrafts((previous) => ({
        ...previous,
        ...buildPoolDrafts([applied.pool], accounts, { [poolId]: applied.members }, previous),
      }));
      setPoolSaveState(poolId, {
        status: "idle",
        code: POOL_SAVE_STATE_CODES.saved,
        message: null,
      });
      setPoolNameDraft("");
      setPoolMemberAccountIdsDraft(providerAccounts.map((account) => account.accountId));
      setPoolPreferredAccountIdDraft("");
    } catch (nextError) {
      setError(formatError(nextError, "Unable to add provider pool."));
    } finally {
      setBusyAction(null);
    }
  }, [
    poolNameDraft,
    poolMemberAccountIdsDraft,
    poolPreferredAccountIdDraft,
    poolProviderDraft,
    providerAccounts,
    accounts,
    setPoolSaveState,
  ]);

  const handleRemovePool = useCallback(
    async (poolId: string, provider: OAuthProviderId) => {
      setBusyAction(`remove-pool:${poolId}`);
      setError(null);
      try {
        await removeOAuthPool(poolId);
        await syncProviderPoolMembers(provider);
        await refreshOAuthState();
      } catch (nextError) {
        setError(formatError(nextError, "Unable to remove provider pool."));
      } finally {
        setBusyAction(null);
      }
    },
    [refreshOAuthState, syncProviderPoolMembers]
  );

  const handleRetryPoolAutosave = useCallback(
    async (pool: OAuthPoolSummary) => {
      const draft = poolDrafts[pool.poolId];
      if (!draft) {
        return;
      }
      await applyPoolDraft(pool, draft);
    },
    [applyPoolDraft, poolDrafts]
  );

  const handleSyncPoolMembers = useCallback(
    async (pool: OAuthPoolSummary) => {
      setBusyAction(`sync-pool:${pool.poolId}`);
      setError(null);
      try {
        await syncPoolMembers(pool.poolId, pool.provider, null);
        await refreshOAuthState();
      } catch (nextError) {
        setError(formatError(nextError, "Unable to sync pool members."));
      } finally {
        setBusyAction(null);
      }
    },
    [refreshOAuthState, syncPoolMembers]
  );

  const handleProbePoolAccount = useCallback(async (pool: OAuthPoolSummary) => {
    setBusyAction(`probe-pool:${pool.poolId}`);
    setError(null);
    try {
      const selected = await selectOAuthPoolAccount({
        poolId: pool.poolId,
        sessionId: `settings-probe-${pool.poolId}`,
      });
      if (!selected) {
        setError(`No eligible account is available for pool ${pool.name}.`);
        return;
      }
      setPoolSelectionPreviewById((previous) => ({
        ...previous,
        [pool.poolId]: {
          accountId: selected.account.accountId,
          reason: selected.reason,
          selectedAt: Date.now(),
        },
      }));
    } catch (nextError) {
      setError(formatError(nextError, "Unable to probe pool account selection."));
    } finally {
      setBusyAction(null);
    }
  }, []);

  const handleReportPoolRateLimit = useCallback(
    async (pool: OAuthPoolSummary, draft: PoolDraft | null, clear: boolean) => {
      const accountId = resolvePoolProbeAccountId(pool, draft);
      if (!accountId) {
        setError(`No account available to update rate-limit state for pool ${pool.name}.`);
        return;
      }
      setBusyAction(clear ? `clear-rate-limit:${pool.poolId}` : `report-rate-limit:${pool.poolId}`);
      setError(null);
      try {
        const reported = await reportOAuthRateLimit(
          clear
            ? {
                accountId,
                success: true,
              }
            : {
                accountId,
                success: false,
                retryAfterSec: 60,
                resetAt: Date.now() + 60_000,
                errorCode: "rate_limit_exceeded",
                errorMessage: "Manual settings probe",
              }
        );
        if (!reported) {
          setError(`Rate-limit update was rejected for account ${accountId}.`);
          return;
        }
        await refreshOAuthState();
      } catch (nextError) {
        setError(formatError(nextError, "Unable to update rate-limit state."));
      } finally {
        setBusyAction(null);
      }
    },
    [refreshOAuthState, resolvePoolProbeAccountId]
  );

  const handleClearHiddenSelectedAccounts = useCallback(() => {
    setSelectedAccountIds((previous) =>
      previous.filter((accountId) => visibleAccountIdSet.has(accountId))
    );
  }, [visibleAccountIdSet]);

  const handleClearHiddenSelectedPools = useCallback(() => {
    setSelectedPoolIds((previous) => previous.filter((poolId) => visiblePoolIdSet.has(poolId)));
  }, [visiblePoolIdSet]);

  return (
    <div className="settings-field account-pools-management account-pools-redesign">
      <SettingsCodexAccountsNavigation
        activeTab={activeTab}
        accountsCount={accounts.length}
        poolsCount={pools.length}
        routingReadyCount={routingReadyCount}
        providerHealthCount={providerPoolRoutingHealth.length}
        onTabChange={setActiveTab}
      />

      <div className="apm-pane" role="tabpanel">
        {error && <div className="apm-error">{error}</div>}

        {activeTab === "accounts" && (
          <SettingsCodexAccountsTab
            onClose={onClose}
            onRefresh={() => void refreshOAuthState({ usageRefresh: "force" })}
            importSummary={notice}
            busyAction={busyAction}
            accountCreateSectionRef={accountCreateSectionRef}
            providerOptions={providerOptions}
            selectedAccountProvider={selectedAccountProvider}
            accountProviderDraft={accountProviderDraft}
            setAccountProviderDraft={setAccountProviderDraft}
            codexProviderSelected={codexProviderSelected}
            codexAuthRequired={codexAuthRequired}
            accountEmailDraft={accountEmailDraft}
            setAccountEmailDraft={setAccountEmailDraft}
            accountDisplayNameDraft={accountDisplayNameDraft}
            setAccountDisplayNameDraft={setAccountDisplayNameDraft}
            accountPlanDraft={accountPlanDraft}
            setAccountPlanDraft={setAccountPlanDraft}
            accountCompatBaseUrlDraft={accountCompatBaseUrlDraft}
            setAccountCompatBaseUrlDraft={setAccountCompatBaseUrlDraft}
            accountProxyIdDraft={accountProxyIdDraft}
            setAccountProxyIdDraft={setAccountProxyIdDraft}
            onAddAccount={() => void handleAddAccount()}
            onImportCockpitTools={() => void handleImportCockpitTools()}
            accountProviderFilter={accountProviderFilter}
            setAccountProviderFilter={setAccountProviderFilter}
            accountStatusFilter={accountStatusFilter}
            setAccountStatusFilter={setAccountStatusFilter}
            accountSearchQuery={accountSearchQuery}
            setAccountSearchQuery={setAccountSearchQuery}
            accounts={accounts}
            visibleAccounts={visibleAccounts}
            selectedAccountIds={selectedAccountIds}
            setSelectedAccountIds={setSelectedAccountIds}
            selectedAccounts={selectedAccounts}
            selectedAccountIdSet={selectedAccountIdSet}
            hiddenSelectedAccountsCount={hiddenSelectedAccountsCount}
            onClearHiddenSelectedAccounts={handleClearHiddenSelectedAccounts}
            onBulkAccountStatus={(nextStatus) => void handleBulkAccountStatus(nextStatus)}
            onBulkRemoveAccounts={() => void handleBulkRemoveAccounts()}
            onRefreshUsage={() => void refreshOAuthState({ usageRefresh: "force" })}
            onToggleAccountStatus={(account) => void handleToggleAccountStatus(account)}
            onReviewDeactivatedChatgptWorkspaces={(account) =>
              void handleReviewDeactivatedChatgptWorkspaces(account)
            }
            onUpdateDefaultChatgptWorkspace={(account, workspaceId) =>
              void handleUpdateAccountDefaultChatgptWorkspace(account, workspaceId)
            }
            onReauthenticateAccount={(account) => void handleReauthenticateAccount(account)}
            onRemoveAccount={(account) => setPendingRemoveAccount(account)}
            subscriptionPersistenceCapability={subscriptionPersistenceCapability}
          />
        )}

        {activeTab === "pools" && (
          <SettingsCodexPoolsTab
            onClose={onClose}
            onRefresh={() => void refreshOAuthState()}
            busyAction={busyAction}
            poolCreateSectionRef={poolCreateSectionRef}
            selectedPoolProvider={selectedPoolProvider}
            providerOptions={providerOptions}
            poolProviderDraft={poolProviderDraft}
            setPoolProviderDraft={setPoolProviderDraft}
            poolNameDraft={poolNameDraft}
            setPoolNameDraft={setPoolNameDraft}
            accounts={accounts}
            providerAccounts={providerAccounts}
            poolMemberAccountIdsDraft={poolMemberAccountIdsDraft}
            setPoolMemberAccountIdsDraft={setPoolMemberAccountIdsDraft}
            poolPreferredAccountIdDraft={poolPreferredAccountIdDraft}
            setPoolPreferredAccountIdDraft={setPoolPreferredAccountIdDraft}
            poolMemberAccountsDraft={poolMemberAccountsDraft}
            onAddPool={() => void handleAddPool()}
            poolProviderFilter={poolProviderFilter}
            setPoolProviderFilter={setPoolProviderFilter}
            visiblePools={visiblePools}
            selectedPoolIds={selectedPoolIds}
            setSelectedPoolIds={setSelectedPoolIds}
            onBulkPoolStatus={(nextEnabled) => void handleBulkPoolStatus(nextEnabled)}
            onBulkRemovePools={() => void handleBulkRemovePools()}
            bulkPoolStickyModeDraft={bulkPoolStickyModeDraft}
            setBulkPoolStickyModeDraft={setBulkPoolStickyModeDraft}
            onBulkPoolStickyMode={(nextStickyMode) => void handleBulkPoolStickyMode(nextStickyMode)}
            hiddenSelectedPoolsCount={hiddenSelectedPoolsCount}
            onClearHiddenSelectedPools={handleClearHiddenSelectedPools}
            selectedPools={selectedPools}
            pools={pools}
            poolDrafts={poolDrafts}
            poolSaveStateById={poolSaveStateById}
            selectedPoolIdSet={selectedPoolIdSet}
            poolSelectionPreviewById={poolSelectionPreviewById}
            updatePoolDraft={updatePoolDraft}
            onAutosavePool={(pool, draftOverride) => void handleAutosavePool(pool, draftOverride)}
            onProbePoolAccount={(pool) => void handleProbePoolAccount(pool)}
            onReportPoolRateLimit={(pool, draft, clear) =>
              void handleReportPoolRateLimit(pool, draft, clear)
            }
            onRetryPoolAutosave={(pool) => void handleRetryPoolAutosave(pool)}
            onSyncPoolMembers={(pool) => void handleSyncPoolMembers(pool)}
            onRemovePool={(poolId, provider) => void handleRemovePool(poolId, provider)}
            stickyModeDescription={STICKY_MODE_DESCRIPTION}
          />
        )}

        {activeTab === "health" && (
          <SettingsCodexHealthTab
            onClose={onClose}
            onRefresh={() => void refreshOAuthState()}
            busyAction={busyAction}
            healthSectionRef={healthSectionRef}
            providerPoolRoutingHealth={providerPoolRoutingHealth}
            routingReadyCount={routingReadyCount}
          />
        )}
      </div>

      <ConfirmDialog
        open={pendingRemoveAccount !== null}
        title="Remove account"
        message={`Remove account ${pendingRemoveAccount?.displayName?.trim() || pendingRemoveAccount?.email?.trim() || pendingRemoveAccount?.accountId || ""}? This also removes it from pools.`}
        confirmLabel="Remove"
        cancelLabel="Cancel"
        variant="destructive"
        onConfirm={() => {
          if (pendingRemoveAccount) {
            // Optimistic UI removal: immediately remove from local state
            const removedId = pendingRemoveAccount.accountId;
            setAccounts((previous) => previous.filter((a) => a.accountId !== removedId));
            void handleRemoveAccount(pendingRemoveAccount);
          }
          setPendingRemoveAccount(null);
        }}
        onCancel={() => setPendingRemoveAccount(null)}
      />
      <ConfirmDialog
        open={pendingDeactivatedWorkspaceReview !== null}
        title="Leave deactivated workspaces"
        message={
          pendingDeactivatedWorkspaceReview
            ? `Leave ${pendingDeactivatedWorkspaceReview.review.candidates
                .map(
                  (candidate) =>
                    candidate.localWorkspace.title?.trim() || candidate.localWorkspace.workspaceId
                )
                .join(
                  ", "
                )} from ChatGPT? HugeCode matched these stored memberships against ChatGPT and confirmed they are deactivated before leaving them.`
            : ""
        }
        confirmLabel="Leave workspaces"
        cancelLabel="Cancel"
        variant="destructive"
        onConfirm={() => {
          void handleConfirmLeaveDeactivatedChatgptWorkspaces();
        }}
        onCancel={() => setPendingDeactivatedWorkspaceReview(null)}
      />
    </div>
  );
}
