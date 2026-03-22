import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  OAuthAccountSummary,
  OAuthPoolMember,
  OAuthPoolSummary,
  OAuthPrimaryAccountSummary,
  OAuthProviderId,
} from "@ku0/code-runtime-host-contract";
import {
  useWorkspaceClientHostBindings,
  useWorkspaceClientRuntimeBindings,
} from "../workspace/WorkspaceClientBindingsProvider";

const DEFAULT_RUNTIME_WORKSPACE_ID = "workspace-local";
const PROVIDER_ORDER: OAuthProviderId[] = ["codex", "gemini", "claude_code"];
const PROVIDER_LABELS: Record<OAuthProviderId, string> = {
  codex: "Codex",
  gemini: "Gemini",
  claude_code: "Claude",
};

export type AccountCenterProviderSummary = {
  providerId: OAuthProviderId;
  label: string;
  enabledCount: number;
  totalCount: number;
  defaultRouteLabel: string;
  hasInteractiveControls: boolean;
};

export type AccountCenterCodexAccountSummary = {
  accountId: string;
  label: string;
  status: OAuthAccountSummary["status"];
  isDefaultRoute: boolean;
  canReauthenticate: boolean;
  updatedAtLabel: string;
};

export type SharedAccountCenterState = {
  loading: boolean;
  error: string | null;
  codex: {
    defaultPoolName: string | null;
    defaultRouteAccountId: string | null;
    defaultRouteAccountLabel: string;
    connectedAccounts: AccountCenterCodexAccountSummary[];
    defaultRouteBusyAccountId: string | null;
    reauthenticatingAccountId: string | null;
  };
  providers: AccountCenterProviderSummary[];
  workspaceAccounts: Array<{
    workspaceId: string;
    workspaceName: string;
    accountLabel: string;
    planLabel: string;
  }>;
  refresh: () => Promise<void>;
  setCodexDefaultRouteAccount: (accountId: string) => Promise<void>;
  reauthenticateCodexAccount: (accountId: string) => Promise<void>;
};

function normalizeErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === "string" && error.trim().length > 0) {
    return error.trim();
  }
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message.trim();
  }
  return fallback;
}

function resolveAccountLabel(account: OAuthAccountSummary): string {
  const metadata =
    account.metadata && typeof account.metadata === "object" && !Array.isArray(account.metadata)
      ? (account.metadata as Record<string, unknown>)
      : null;
  const candidates = [
    account.email,
    account.displayName,
    typeof metadata?.email === "string" ? metadata.email : null,
    typeof metadata?.userEmail === "string" ? metadata.userEmail : null,
    typeof metadata?.user_email === "string" ? metadata.user_email : null,
    account.externalAccountId,
    account.accountId,
  ];
  return (
    candidates
      .find((candidate) => typeof candidate === "string" && candidate.trim().length > 0)
      ?.trim() ?? account.accountId
  );
}

function accountHasRoutingCredential(account: OAuthAccountSummary): boolean {
  const metadata = account.metadata;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return false;
  }
  const record = metadata as Record<string, unknown>;
  if (record.apiKeyConfigured === true) {
    return true;
  }
  return (
    record.localCliManaged === true &&
    record.source === "local_codex_cli_auth" &&
    record.credentialAvailable === true
  );
}

function maxCodexAccountTimestamp(accounts: ReadonlyArray<OAuthAccountSummary>): number {
  return accounts
    .filter((account) => account.provider === "codex")
    .reduce((maxValue, account) => Math.max(maxValue, account.updatedAt ?? 0), 0);
}

function formatRelativeTimeShort(value: number): string {
  const deltaSeconds = Math.max(1, Math.floor((Date.now() - value) / 1_000));
  if (deltaSeconds < 60) {
    return `${deltaSeconds}s ago`;
  }
  const deltaMinutes = Math.floor(deltaSeconds / 60);
  if (deltaMinutes < 60) {
    return `${deltaMinutes}m ago`;
  }
  const deltaHours = Math.floor(deltaMinutes / 60);
  if (deltaHours < 24) {
    return `${deltaHours}h ago`;
  }
  const deltaDays = Math.floor(deltaHours / 24);
  return `${deltaDays}d ago`;
}

function resolveDefaultPool(
  provider: OAuthProviderId,
  pools: OAuthPoolSummary[]
): OAuthPoolSummary | null {
  const providerPools = pools.filter((pool) => pool.provider === provider);
  if (providerPools.length === 0) {
    return null;
  }
  return (
    providerPools.find((pool) => pool.metadata?.primary === true) ??
    providerPools
      .slice()
      .sort((left, right) => (right.updatedAt ?? 0) - (left.updatedAt ?? 0))[0] ??
    null
  );
}

function resolveDefaultRouteLabel(
  provider: OAuthProviderId,
  accounts: OAuthAccountSummary[],
  pools: OAuthPoolSummary[]
): string {
  const defaultPool = resolveDefaultPool(provider, pools);
  if (!defaultPool?.preferredAccountId) {
    return "No default route account";
  }
  const preferred = accounts.find(
    (account) =>
      account.provider === provider && account.accountId === defaultPool.preferredAccountId
  );
  return preferred ? resolveAccountLabel(preferred) : `Missing (${defaultPool.preferredAccountId})`;
}

function extractWorkspacePlanLabel(accountInfo: unknown): string {
  if (!accountInfo || typeof accountInfo !== "object" || Array.isArray(accountInfo)) {
    return "Unknown";
  }
  const record = accountInfo as Record<string, unknown>;
  const result =
    record.result && typeof record.result === "object" && !Array.isArray(record.result)
      ? (record.result as Record<string, unknown>)
      : record;
  const candidates = [
    result.planLabel,
    result.plan,
    result.subscriptionPlan,
    result.subscription_plan,
  ];
  const resolvedCandidate = candidates.find(
    (candidate): candidate is string => typeof candidate === "string" && candidate.trim().length > 0
  );
  return resolvedCandidate?.trim() ?? "Connected";
}

function readWorkspaceBindingVerified(accountInfo: unknown): boolean {
  if (!accountInfo || typeof accountInfo !== "object" || Array.isArray(accountInfo)) {
    return false;
  }
  const accountInfoRecord = accountInfo as Record<string, unknown>;
  const result =
    accountInfoRecord.result &&
    typeof accountInfoRecord.result === "object" &&
    !Array.isArray(accountInfoRecord.result)
      ? (accountInfoRecord.result as Record<string, unknown>)
      : accountInfoRecord;
  return (result.requiresOpenaiAuth ?? result.requires_openai_auth) === false;
}

function resolveCodexOAuthWorkspaceId(input: {
  account: Pick<OAuthAccountSummary, "accountId" | "externalAccountId">;
  workspaces: Array<{ id: string; connected: boolean }>;
}): string {
  const preferredWorkspaceId = input.account.externalAccountId?.trim() || null;
  const preferredWorkspace =
    preferredWorkspaceId === null
      ? null
      : (input.workspaces.find((workspace) => workspace.id === preferredWorkspaceId) ?? null);
  const connectedWorkspace = input.workspaces.find((workspace) => workspace.connected) ?? null;
  return (
    preferredWorkspace?.id ??
    connectedWorkspace?.id ??
    input.workspaces[0]?.id ??
    DEFAULT_RUNTIME_WORKSPACE_ID
  );
}

export function useSharedAccountCenterState(): SharedAccountCenterState {
  const runtime = useWorkspaceClientRuntimeBindings();
  const host = useWorkspaceClientHostBindings();
  const [accounts, setAccounts] = useState<OAuthAccountSummary[]>([]);
  const [pools, setPools] = useState<OAuthPoolSummary[]>([]);
  const [workspaceAccounts, setWorkspaceAccounts] = useState<
    SharedAccountCenterState["workspaceAccounts"]
  >([]);
  const [codexPrimaryAccount, setCodexPrimaryAccount] = useState<OAuthPrimaryAccountSummary | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [defaultRouteBusyAccountId, setDefaultRouteBusyAccountId] = useState<string | null>(null);
  const [reauthenticatingAccountId, setReauthenticatingAccountId] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    if (runtime.surface === "shared-workspace-client") {
      // Surface marker only; no-op to keep hook dependencies explicit.
    }
    try {
      const [nextAccounts, nextPools, nextCodexPrimaryAccount, workspaces] = await Promise.all([
        runtime.oauth.listAccounts(null),
        runtime.oauth.listPools(null),
        runtime.oauth.getPrimaryAccount("codex").catch(() => null),
        runtime.workspaceCatalog.listWorkspaces().catch(() => []),
      ]);
      const nextWorkspaceAccounts = await Promise.all(
        workspaces.map(async (workspace) => {
          const accountInfo = await runtime.oauth.getAccountInfo(workspace.id).catch(() => null);
          return {
            workspaceId: workspace.id,
            workspaceName: workspace.name,
            accountLabel: readWorkspaceBindingVerified(accountInfo) ? "Connected" : "Needs login",
            planLabel: extractWorkspacePlanLabel(accountInfo),
          };
        })
      );

      if (!isMountedRef.current) {
        return;
      }
      setAccounts(nextAccounts);
      setPools(nextPools);
      setWorkspaceAccounts(nextWorkspaceAccounts);
      setCodexPrimaryAccount(nextCodexPrimaryAccount);
      setError(null);
    } catch (nextError) {
      if (!isMountedRef.current) {
        return;
      }
      setCodexPrimaryAccount(null);
      setWorkspaceAccounts([]);
      setError(normalizeErrorMessage(nextError, "Unable to load account center state."));
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [runtime]);

  useEffect(() => {
    void refresh();
    return runtime.runtimeUpdated?.subscribeScopedRuntimeUpdatedEvents(
      {
        workspaceId: () => null,
        scopes: ["oauth"],
      },
      () => {
        void refresh();
      }
    );
  }, [refresh, runtime.runtimeUpdated]);

  const codexAccounts = useMemo(
    () =>
      accounts
        .filter((account) => account.provider === "codex" && accountHasRoutingCredential(account))
        .slice()
        .sort((left, right) => (right.updatedAt ?? 0) - (left.updatedAt ?? 0)),
    [accounts]
  );

  const codexDefaultPool = useMemo(() => resolveDefaultPool("codex", pools), [pools]);
  const codexDefaultRouteAccountId =
    (codexPrimaryAccount?.provider === "codex"
      ? (codexPrimaryAccount.routeAccountId ?? codexPrimaryAccount.accountId ?? null)
      : null) ??
    codexDefaultPool?.preferredAccountId ??
    null;
  const codexDefaultRouteAccountLabel = useMemo(() => {
    if (!codexDefaultRouteAccountId) {
      return "No default route account";
    }
    const preferred = codexAccounts.find(
      (account) => account.accountId === codexDefaultRouteAccountId
    );
    return preferred ? resolveAccountLabel(preferred) : `Missing (${codexDefaultRouteAccountId})`;
  }, [codexAccounts, codexDefaultRouteAccountId]);

  const providers = useMemo<AccountCenterProviderSummary[]>(
    () =>
      PROVIDER_ORDER.map((providerId) => {
        const providerAccounts = accounts.filter((account) => account.provider === providerId);
        return {
          providerId,
          label: PROVIDER_LABELS[providerId],
          enabledCount: providerAccounts.filter((account) => account.status === "enabled").length,
          totalCount: providerAccounts.length,
          defaultRouteLabel: resolveDefaultRouteLabel(providerId, accounts, pools),
          hasInteractiveControls: providerId === "codex",
        };
      }),
    [accounts, pools]
  );

  const connectedAccounts = useMemo<AccountCenterCodexAccountSummary[]>(
    () =>
      codexAccounts.map((account) => ({
        accountId: account.accountId,
        label: resolveAccountLabel(account),
        status: account.status,
        isDefaultRoute: account.accountId === codexDefaultRouteAccountId,
        canReauthenticate: true,
        updatedAtLabel:
          account.updatedAt && account.updatedAt > 0
            ? `Updated ${formatRelativeTimeShort(account.updatedAt)}`
            : "Updated recently",
      })),
    [codexAccounts, codexDefaultRouteAccountId]
  );

  const setCodexDefaultRouteAccount = useCallback(
    async (accountId: string) => {
      if (accountId === codexDefaultRouteAccountId) {
        return;
      }
      setDefaultRouteBusyAccountId(accountId);
      setError(null);
      try {
        try {
          await runtime.oauth.setPrimaryAccount({
            provider: "codex",
            accountId,
          });
        } catch (primarySetError) {
          if (!codexDefaultPool) {
            throw primarySetError;
          }
          const members: OAuthPoolMember[] = await runtime.oauth.listPoolMembers(
            codexDefaultPool.poolId
          );
          await runtime.oauth.applyPool({
            pool: {
              poolId: codexDefaultPool.poolId,
              provider: codexDefaultPool.provider,
              name: codexDefaultPool.name,
              strategy: codexDefaultPool.strategy,
              stickyMode: codexDefaultPool.stickyMode,
              preferredAccountId: accountId,
              enabled: codexDefaultPool.enabled,
              metadata: codexDefaultPool.metadata ?? {},
            },
            members: members.map((member) => ({ ...member })),
            expectedUpdatedAt: codexDefaultPool.updatedAt ?? null,
          });
        }
        await refresh();
      } catch (nextError) {
        setError(normalizeErrorMessage(nextError, "Unable to set default route account."));
      } finally {
        if (isMountedRef.current) {
          setDefaultRouteBusyAccountId(null);
        }
      }
    },
    [codexDefaultPool, codexDefaultRouteAccountId, refresh, runtime.oauth]
  );

  const reauthenticateCodexAccount = useCallback(
    async (accountId: string) => {
      const account = codexAccounts.find((entry) => entry.accountId === accountId);
      if (!account) {
        return;
      }
      setReauthenticatingAccountId(accountId);
      setError(null);
      try {
        const popup = host.platform === "web" ? host.intents.createOauthPopupWindow() : null;
        if (host.platform === "web" && !popup) {
          throw new Error("OAuth popup was blocked. Please allow pop-ups and try again.");
        }
        const workspaces = await runtime.workspaceCatalog.listWorkspaces().catch(() => []);
        const workspaceId = resolveCodexOAuthWorkspaceId({
          account,
          workspaces,
        });
        const baselineUpdatedAt = maxCodexAccountTimestamp(codexAccounts);
        const { authUrl, immediateSuccess } = await runtime.oauth.runLogin(workspaceId, {
          forceOAuth: true,
        });

        if (immediateSuccess) {
          await refresh();
          return;
        }

        await host.intents.openOauthAuthorizationUrl(authUrl, popup);
        const synced = await host.intents.waitForOauthBinding(workspaceId, baselineUpdatedAt);
        if (!synced) {
          throw new Error(
            "OAuth completed but account sync was not detected. Check runtime logs and retry."
          );
        }
        await refresh();
      } catch (nextError) {
        setError(normalizeErrorMessage(nextError, `Unable to re-authenticate ${accountId}.`));
      } finally {
        if (isMountedRef.current) {
          setReauthenticatingAccountId(null);
        }
      }
    },
    [codexAccounts, host, refresh, runtime.oauth, runtime.workspaceCatalog]
  );

  return {
    loading,
    error,
    codex: {
      defaultPoolName: codexDefaultPool?.name ?? null,
      defaultRouteAccountId: codexDefaultRouteAccountId,
      defaultRouteAccountLabel: codexDefaultRouteAccountLabel,
      connectedAccounts,
      defaultRouteBusyAccountId,
      reauthenticatingAccountId,
    },
    providers,
    workspaceAccounts,
    refresh,
    setCodexDefaultRouteAccount,
    reauthenticateCodexAccount,
  };
}
