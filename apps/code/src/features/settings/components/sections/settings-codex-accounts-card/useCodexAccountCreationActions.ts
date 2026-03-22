import { type Dispatch, type SetStateAction, useCallback } from "react";
import {
  applyOAuthPool,
  importCodexAccountsFromCockpitTools,
  listOAuthAccounts,
  listOAuthPools,
  type OAuthAccountSummary,
  type OAuthProviderId,
  upsertOAuthAccount,
} from "../../../../../application/runtime/ports/tauriOauth";
import {
  resolveProviderBrandRouteId,
  type ProviderBrandId,
} from "../../../../app/utils/antiGravityBranding";
import {
  buildPoolMembersFromDraft,
  canonicalDefaultPoolId,
  createLocalId,
  formatError,
} from "../settingsCodexAccountsCardUtils";
import type { FormBusyAction } from "./types";

type UseCodexAccountCreationActionsParams = {
  accounts: OAuthAccountSummary[];
  accountProviderDraft: ProviderBrandId;
  accountEmailDraft: string;
  accountDisplayNameDraft: string;
  accountPlanDraft: string;
  accountCompatBaseUrlDraft: string;
  accountProxyIdDraft: string;
  handleAddCodexAccount: () => Promise<void>;
  refreshOAuthState: () => Promise<void>;
  syncProviderPoolMembers: (provider: OAuthProviderId) => Promise<void>;
  setBusyAction: Dispatch<SetStateAction<FormBusyAction>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setNotice: Dispatch<SetStateAction<string | null>>;
  setAccountEmailDraft: Dispatch<SetStateAction<string>>;
  setAccountDisplayNameDraft: Dispatch<SetStateAction<string>>;
  setAccountPlanDraft: Dispatch<SetStateAction<string>>;
  setAccountCompatBaseUrlDraft: Dispatch<SetStateAction<string>>;
  setAccountProxyIdDraft: Dispatch<SetStateAction<string>>;
  formatCockpitToolsImportSummary(result: {
    imported: number;
    updated: number;
    skipped: number;
    failed: number;
    message?: string | null;
  }): string;
  isMountedRef: React.MutableRefObject<boolean>;
};

export function useCodexAccountCreationActions({
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
}: UseCodexAccountCreationActionsParams) {
  const handleAddAccount = useCallback(async () => {
    const accountRouteProviderId = resolveProviderBrandRouteId(accountProviderDraft);
    if (accountRouteProviderId === "codex") {
      await handleAddCodexAccount();
      return;
    }

    const normalizedEmail = accountEmailDraft.trim();
    const normalizedDisplayName = accountDisplayNameDraft.trim();
    const normalizedPlan = accountPlanDraft.trim();
    const normalizedCompatBaseUrl = accountCompatBaseUrlDraft.trim();
    const normalizedProxyId = accountProxyIdDraft.trim();
    if (!normalizedEmail && !normalizedDisplayName) {
      setError("Provide at least an email or display name.");
      return;
    }
    setBusyAction("add-account");
    setError(null);
    try {
      await upsertOAuthAccount({
        accountId: createLocalId(`${accountRouteProviderId}-account`),
        provider: accountRouteProviderId,
        email: normalizedEmail || null,
        displayName: normalizedDisplayName || normalizedEmail || null,
        status: "enabled",
        routeConfig:
          normalizedCompatBaseUrl || normalizedProxyId
            ? {
                compatBaseUrl: normalizedCompatBaseUrl || null,
                proxyId: normalizedProxyId || null,
                schedulable: true,
              }
            : null,
        metadata: normalizedPlan ? { planType: normalizedPlan } : {},
      });

      const existingPools = await listOAuthPools(accountRouteProviderId);
      if (existingPools.length === 0) {
        const providerAccountsSnapshot = await listOAuthAccounts(accountRouteProviderId);
        await applyOAuthPool({
          pool: {
            poolId: canonicalDefaultPoolId(accountRouteProviderId),
            provider: accountRouteProviderId,
            name: "Default pool",
            strategy: "round_robin",
            stickyMode: "cache_first",
            preferredAccountId: null,
            enabled: true,
            metadata: { autoManaged: true },
          },
          members: buildPoolMembersFromDraft(providerAccountsSnapshot, null, null),
          expectedUpdatedAt: null,
        });
      }

      await syncProviderPoolMembers(accountRouteProviderId);
      setAccountEmailDraft("");
      setAccountDisplayNameDraft("");
      setAccountPlanDraft("");
      setAccountCompatBaseUrlDraft("");
      setAccountProxyIdDraft("");
      await refreshOAuthState();
    } catch (nextError) {
      setError(formatError(nextError, "Unable to add account."));
    } finally {
      setBusyAction(null);
    }
  }, [
    accountCompatBaseUrlDraft,
    accountDisplayNameDraft,
    accountEmailDraft,
    accountPlanDraft,
    accountProviderDraft,
    accountProxyIdDraft,
    handleAddCodexAccount,
    refreshOAuthState,
    setAccountCompatBaseUrlDraft,
    setAccountDisplayNameDraft,
    setAccountEmailDraft,
    setAccountPlanDraft,
    setAccountProxyIdDraft,
    setBusyAction,
    setError,
    syncProviderPoolMembers,
  ]);

  const handleImportCockpitTools = useCallback(async () => {
    setBusyAction("import-cockpit-tools");
    setError(null);
    setNotice(null);
    try {
      const result = await importCodexAccountsFromCockpitTools();
      await syncProviderPoolMembers("codex");
      await refreshOAuthState();
      if (isMountedRef.current) {
        setNotice(formatCockpitToolsImportSummary(result));
      }
    } catch (nextError) {
      if (isMountedRef.current) {
        setError(formatError(nextError, "Unable to import cockpit-tools Codex accounts."));
      }
    } finally {
      if (isMountedRef.current) {
        setBusyAction(null);
      }
    }
  }, [
    formatCockpitToolsImportSummary,
    isMountedRef,
    refreshOAuthState,
    setBusyAction,
    setError,
    setNotice,
    syncProviderPoolMembers,
  ]);

  return {
    handleAddAccount,
    handleImportCockpitTools,
  };
}
