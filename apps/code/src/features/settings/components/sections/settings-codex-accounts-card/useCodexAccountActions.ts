import { type Dispatch, type SetStateAction, useCallback } from "react";
import {
  leaveDeactivatedChatgptWorkspaces,
  reviewDeactivatedChatgptWorkspaces,
  type DeactivatedChatgptWorkspaceCandidate,
  type LeaveDeactivatedChatgptWorkspacesResult,
  type ReviewDeactivatedChatgptWorkspacesResult,
} from "../../../../../application/runtime/facades/chatgptWorkspaceAutomationFacade";
import {
  type OAuthAccountSummary,
  type OAuthProviderId,
  removeOAuthAccount,
  upsertOAuthAccount,
} from "../../../../../application/runtime/ports/oauth";
import { formatError } from "../settingsCodexAccountsCardUtils";
import { confirmDestructiveAction, isLocalCliManagedAccount } from "./oauthHelpers";
import type { FormBusyAction } from "./types";

type UseCodexAccountActionsOptions = {
  accounts: OAuthAccountSummary[];
  selectedAccountIds: string[];
  refreshOAuthState: () => Promise<void> | void;
  syncProviderPoolMembers: (provider: OAuthProviderId) => Promise<void>;
  setBusyAction: Dispatch<SetStateAction<FormBusyAction>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setSelectedAccountIds: Dispatch<SetStateAction<string[]>>;
};

const LOCAL_CLI_MANAGED_ACCOUNT_MESSAGE =
  "This account is managed by local Codex CLI. Sign out in Codex CLI to remove it.";

type ChatgptWorkspaceMembership = NonNullable<OAuthAccountSummary["chatgptWorkspaces"]>[number];

function normalizeChatgptWorkspaceSelection(
  account: OAuthAccountSummary,
  nextDefaultChatgptWorkspaceId: string | null
): {
  chatgptWorkspaces: ChatgptWorkspaceMembership[] | null;
  defaultChatgptWorkspaceId: string | null;
} {
  const memberships = account.chatgptWorkspaces ?? [];
  const normalizedDefaultChatgptWorkspaceId = nextDefaultChatgptWorkspaceId?.trim() || null;
  if (memberships.length === 0) {
    return {
      chatgptWorkspaces: account.chatgptWorkspaces ?? null,
      defaultChatgptWorkspaceId: normalizedDefaultChatgptWorkspaceId,
    };
  }
  const hasSelectedWorkspace =
    normalizedDefaultChatgptWorkspaceId === null
      ? false
      : memberships.some(
          (workspace) => workspace.workspaceId === normalizedDefaultChatgptWorkspaceId
        );
  const defaultChatgptWorkspaceId = hasSelectedWorkspace
    ? normalizedDefaultChatgptWorkspaceId
    : null;
  return {
    chatgptWorkspaces: memberships.map((workspace) => ({
      ...workspace,
      isDefault:
        defaultChatgptWorkspaceId !== null && workspace.workspaceId === defaultChatgptWorkspaceId,
    })),
    defaultChatgptWorkspaceId,
  };
}

export function useCodexAccountActions({
  accounts,
  selectedAccountIds,
  refreshOAuthState,
  syncProviderPoolMembers,
  setBusyAction,
  setError,
  setSelectedAccountIds,
}: UseCodexAccountActionsOptions) {
  const handleToggleAccountStatus = useCallback(
    async (account: OAuthAccountSummary) => {
      setBusyAction(`toggle-account:${account.accountId}`);
      setError(null);
      try {
        await upsertOAuthAccount({
          accountId: account.accountId,
          provider: account.provider,
          externalAccountId: account.externalAccountId,
          email: account.email,
          displayName: account.displayName,
          status: account.status === "enabled" ? "disabled" : "enabled",
          disabledReason: account.status === "enabled" ? "manual_toggle" : null,
          routeConfig: account.routeConfig,
          routingState: account.routingState,
          chatgptWorkspaces: account.chatgptWorkspaces,
          defaultChatgptWorkspaceId: account.defaultChatgptWorkspaceId,
          metadata: account.metadata,
        });
        await syncProviderPoolMembers(account.provider);
        await refreshOAuthState();
      } catch (nextError) {
        setError(formatError(nextError, "Unable to update account status."));
      } finally {
        setBusyAction(null);
      }
    },
    [refreshOAuthState, setBusyAction, setError, syncProviderPoolMembers]
  );

  const handleRemoveAccount = useCallback(
    async (account: OAuthAccountSummary) => {
      if (isLocalCliManagedAccount(account)) {
        setError(LOCAL_CLI_MANAGED_ACCOUNT_MESSAGE);
        return;
      }
      setBusyAction(`remove-account:${account.accountId}`);
      setError(null);
      try {
        const removed = await removeOAuthAccount(account.accountId);
        if (!removed) {
          // Keep local optimistic behavior when backend returns removed=false.
          // We intentionally skip refreshOAuthState in this branch.
          setError(
            `Unable to remove account ${account.accountId}. It may be managed by local Codex CLI.`
          );
          return;
        }
        await syncProviderPoolMembers(account.provider);
        await refreshOAuthState();
      } catch (nextError) {
        setError(formatError(nextError, "Unable to remove account."));
      } finally {
        setBusyAction(null);
      }
    },
    [refreshOAuthState, setBusyAction, setError, syncProviderPoolMembers]
  );

  const handleBulkAccountStatus = useCallback(
    async (nextStatus: "enabled" | "disabled") => {
      const selectedIdSet = new Set(selectedAccountIds);
      const targetAccounts = accounts.filter((account) => {
        if (!selectedIdSet.has(account.accountId)) {
          return false;
        }
        if (account.status !== "enabled" && account.status !== "disabled") {
          return false;
        }
        return account.status !== nextStatus;
      });
      if (targetAccounts.length === 0) {
        return;
      }
      setBusyAction(nextStatus === "enabled" ? "bulk-enable" : "bulk-disable");
      setError(null);
      try {
        await Promise.all(
          targetAccounts.map((account) =>
            upsertOAuthAccount({
              accountId: account.accountId,
              provider: account.provider,
              externalAccountId: account.externalAccountId,
              email: account.email,
              displayName: account.displayName,
              status: nextStatus,
              disabledReason: nextStatus === "disabled" ? "manual_toggle" : null,
              routeConfig: account.routeConfig,
              routingState: account.routingState,
              chatgptWorkspaces: account.chatgptWorkspaces,
              defaultChatgptWorkspaceId: account.defaultChatgptWorkspaceId,
              metadata: account.metadata,
            })
          )
        );
        const providers = Array.from(new Set(targetAccounts.map((account) => account.provider)));
        await Promise.all(providers.map((provider) => syncProviderPoolMembers(provider)));
        await refreshOAuthState();
      } catch (nextError) {
        setError(formatError(nextError, "Unable to update selected account status."));
      } finally {
        setBusyAction(null);
      }
    },
    [
      accounts,
      refreshOAuthState,
      selectedAccountIds,
      setBusyAction,
      setError,
      syncProviderPoolMembers,
    ]
  );

  const handleBulkRemoveAccounts = useCallback(async () => {
    const selectedIdSet = new Set(selectedAccountIds);
    const targetAccounts = accounts.filter((account) => selectedIdSet.has(account.accountId));
    if (targetAccounts.length === 0) {
      return;
    }
    const localCliManagedAccounts = targetAccounts.filter(isLocalCliManagedAccount);
    const removableAccounts = targetAccounts.filter(
      (account) => !isLocalCliManagedAccount(account)
    );
    if (removableAccounts.length === 0) {
      setError(
        "Selected accounts are managed by local Codex CLI. Sign out in Codex CLI to remove them."
      );
      return;
    }
    const skipMessageSuffix =
      localCliManagedAccounts.length > 0
        ? ` ${localCliManagedAccounts.length} local CLI managed account(s) will be skipped.`
        : "";
    if (
      !confirmDestructiveAction(
        `Remove ${removableAccounts.length} selected account(s)? This also removes them from pools.${skipMessageSuffix}`
      )
    ) {
      return;
    }
    setBusyAction("bulk-remove");
    setError(null);
    try {
      const removeResults = await Promise.all(
        removableAccounts.map(async (account) => ({
          account,
          removed: await removeOAuthAccount(account.accountId),
        }))
      );
      const removedAccounts = removeResults
        .filter((result) => result.removed)
        .map((result) => result.account);
      const failedAccounts = removeResults
        .filter((result) => !result.removed)
        .map((result) => result.account.accountId);

      if (removedAccounts.length > 0) {
        const providers = Array.from(new Set(removedAccounts.map((account) => account.provider)));
        await Promise.all(providers.map((provider) => syncProviderPoolMembers(provider)));
      }
      const removedAccountIdSet = new Set(removedAccounts.map((account) => account.accountId));
      setSelectedAccountIds((previous) =>
        previous.filter((accountId) => !removedAccountIdSet.has(accountId))
      );
      await refreshOAuthState();
      if (failedAccounts.length > 0) {
        const skipMessage =
          localCliManagedAccounts.length > 0
            ? ` ${localCliManagedAccounts.length} local CLI managed account(s) were skipped.`
            : "";
        setError(
          `Unable to remove ${failedAccounts.length} account(s): ${failedAccounts.join(", ")}.${skipMessage}`
        );
        return;
      }
      if (localCliManagedAccounts.length > 0) {
        setError(
          `Removed ${removedAccounts.length} account(s). Skipped ${localCliManagedAccounts.length} local CLI managed account(s). Sign out in Codex CLI to remove them.`
        );
      }
    } catch (nextError) {
      setError(formatError(nextError, "Unable to remove selected accounts."));
    } finally {
      setBusyAction(null);
    }
  }, [
    accounts,
    refreshOAuthState,
    selectedAccountIds,
    setBusyAction,
    setError,
    setSelectedAccountIds,
    syncProviderPoolMembers,
  ]);

  const handleUpdateAccountDefaultChatgptWorkspace = useCallback(
    async (account: OAuthAccountSummary, nextDefaultChatgptWorkspaceId: string | null) => {
      const memberships = account.chatgptWorkspaces ?? [];
      if (memberships.length === 0) {
        return;
      }
      const normalizedDefaultChatgptWorkspaceId = nextDefaultChatgptWorkspaceId?.trim() || null;
      if (
        normalizedDefaultChatgptWorkspaceId !== null &&
        !memberships.some(
          (workspace) => workspace.workspaceId === normalizedDefaultChatgptWorkspaceId
        )
      ) {
        setError(
          `ChatGPT workspace ${normalizedDefaultChatgptWorkspaceId} is not linked to account ${account.accountId}.`
        );
        return;
      }
      const nextWorkspaceState = normalizeChatgptWorkspaceSelection(
        account,
        normalizedDefaultChatgptWorkspaceId
      );
      setBusyAction(`set-account-default-workspace:${account.accountId}`);
      setError(null);
      try {
        await upsertOAuthAccount({
          accountId: account.accountId,
          provider: account.provider,
          externalAccountId: account.externalAccountId,
          email: account.email,
          displayName: account.displayName,
          status: account.status,
          disabledReason: account.disabledReason,
          routeConfig: account.routeConfig,
          routingState: account.routingState,
          chatgptWorkspaces: nextWorkspaceState.chatgptWorkspaces,
          defaultChatgptWorkspaceId: nextWorkspaceState.defaultChatgptWorkspaceId,
          metadata: account.metadata,
        });
        await refreshOAuthState();
      } catch (nextError) {
        setError(formatError(nextError, "Unable to update the default ChatGPT workspace."));
      } finally {
        setBusyAction(null);
      }
    },
    [refreshOAuthState, setBusyAction, setError]
  );

  const handleReviewAccountDeactivatedChatgptWorkspaces = useCallback(
    async (account: OAuthAccountSummary): Promise<ReviewDeactivatedChatgptWorkspacesResult> => {
      setBusyAction(`review-account-deactive-workspaces:${account.accountId}`);
      setError(null);
      try {
        return await reviewDeactivatedChatgptWorkspaces(account);
      } catch (nextError) {
        const message = formatError(nextError, "Unable to review deactivated ChatGPT workspaces.");
        setError(message);
        return {
          status: "failed",
          message,
          endpoint: null,
          candidates: [],
          remoteWorkspaces: [],
        };
      } finally {
        setBusyAction(null);
      }
    },
    [setBusyAction, setError]
  );

  const handleLeaveAccountDeactivatedChatgptWorkspaces = useCallback(
    async (
      account: OAuthAccountSummary,
      candidates: readonly DeactivatedChatgptWorkspaceCandidate[]
    ): Promise<LeaveDeactivatedChatgptWorkspacesResult> => {
      setBusyAction(`leave-account-deactive-workspaces:${account.accountId}`);
      setError(null);
      try {
        const result = await leaveDeactivatedChatgptWorkspaces({
          account,
          candidates,
        });
        if (result.leftWorkspaceIds.length > 0) {
          await refreshOAuthState();
        }
        return result;
      } catch (nextError) {
        const message = formatError(nextError, "Unable to leave deactivated ChatGPT workspaces.");
        setError(message);
        return {
          status: "failed",
          message,
          endpoint: null,
          leftWorkspaceIds: [],
          failedWorkspaceIds: candidates.map((candidate) => candidate.localWorkspace.workspaceId),
        };
      } finally {
        setBusyAction(null);
      }
    },
    [refreshOAuthState, setBusyAction, setError]
  );

  return {
    handleBulkAccountStatus,
    handleBulkRemoveAccounts,
    handleLeaveAccountDeactivatedChatgptWorkspaces,
    handleRemoveAccount,
    handleReviewAccountDeactivatedChatgptWorkspaces,
    handleToggleAccountStatus,
    handleUpdateAccountDefaultChatgptWorkspace,
  };
}
