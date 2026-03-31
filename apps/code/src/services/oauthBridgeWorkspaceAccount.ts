import type {
  OAuthAccountSummary,
  OAuthPoolSummary,
  OAuthProviderId,
  OAuthUsageRefreshMode,
} from "./runtimeClient";
import type { RuntimeClientMode } from "./runtimeClient";
import { isRuntimeRpcContractGuardError } from "@ku0/code-runtime-client/runtimeClientCapabilitiesContract";
import { createRuntimeError } from "@ku0/code-runtime-client/runtimeMessageEnvelope";

type RuntimeClientOAuthBridge = {
  oauthAccounts?: (
    provider?: OAuthProviderId | null,
    options?: { usageRefresh?: OAuthUsageRefreshMode }
  ) => Promise<OAuthAccountSummary[]>;
  oauthSelectPoolAccount?: (request: {
    poolId: string;
    sessionId: string;
    modelId: string | null;
  }) => Promise<{ account: OAuthAccountSummary } | null>;
};

export type OAuthSubscriptionPersistenceCapability = {
  hostMode: RuntimeClientMode;
  persistenceKind: "runtime-backed" | "runtime-unavailable";
  runtimeBacked: boolean;
  durableStorage: boolean;
  workspaceAwareSessionBinding: boolean;
  summary: string;
};

export type ProjectWorkspaceScopedOAuthAccountResolverDeps = {
  defaultCodexOauthPoolId: string;
  listOAuthAccounts(
    provider: OAuthProviderId | null,
    options?: { usageRefresh?: OAuthUsageRefreshMode }
  ): Promise<OAuthAccountSummary[]>;
  listOAuthPools(provider: OAuthProviderId | null): Promise<OAuthPoolSummary[]>;
  pickPoolPreferredAccount(
    accounts: OAuthAccountSummary[],
    pools: OAuthPoolSummary[],
    provider?: OAuthProviderId | null
  ): OAuthAccountSummary | null;
  pickPreferredOAuthAccount(
    accounts: OAuthAccountSummary[],
    provider?: OAuthProviderId | null
  ): OAuthAccountSummary | null;
  getRuntimeClient(): RuntimeClientOAuthBridge;
  normalizeOAuthAccountSummary(account: OAuthAccountSummary): OAuthAccountSummary;
  normalizeNullableText(value: unknown): string | null;
  isRuntimeMethodUnsupportedError(error: unknown): boolean;
  logRuntimeWarning(message: string, context?: unknown): void;
};

export async function resolvePreferredOAuthAccountWithDeps(
  deps: Pick<
    ProjectWorkspaceScopedOAuthAccountResolverDeps,
    | "listOAuthAccounts"
    | "listOAuthPools"
    | "pickPoolPreferredAccount"
    | "pickPreferredOAuthAccount"
  >
): Promise<OAuthAccountSummary | null> {
  const accounts = await deps.listOAuthAccounts(null);
  const pools = await deps.listOAuthPools(null);
  return (
    deps.pickPoolPreferredAccount(accounts, pools, "codex") ??
    deps.pickPoolPreferredAccount(accounts, pools, null) ??
    deps.pickPreferredOAuthAccount(accounts, null)
  );
}

function selectRefreshedCodexAccount(
  preferredAccount: OAuthAccountSummary | null,
  refreshedAccounts: OAuthAccountSummary[]
): OAuthAccountSummary | null {
  if (!preferredAccount) {
    return null;
  }
  const exactMatch =
    refreshedAccounts.find((candidate) => candidate.accountId === preferredAccount.accountId) ??
    null;
  return exactMatch ?? preferredAccount;
}

export async function resolveProjectWorkspaceScopedOAuthAccountWithDeps(
  deps: ProjectWorkspaceScopedOAuthAccountResolverDeps,
  projectWorkspaceId: string,
  options: { refreshCodexUsage?: boolean } = {}
): Promise<OAuthAccountSummary | null> {
  const normalizedProjectWorkspaceId = deps.normalizeNullableText(projectWorkspaceId);
  let runtimeClient: RuntimeClientOAuthBridge | null = null;
  try {
    runtimeClient = deps.getRuntimeClient();
  } catch {
    runtimeClient = null;
  }
  const refreshedCodexAccounts =
    options.refreshCodexUsage && runtimeClient && typeof runtimeClient.oauthAccounts === "function"
      ? await deps.listOAuthAccounts("codex", { usageRefresh: "force" })
      : null;

  if (normalizedProjectWorkspaceId) {
    if (typeof runtimeClient?.oauthSelectPoolAccount !== "function") {
      throw createRuntimeError({
        code: "runtime.oauth.workspace_binding_unavailable",
        message:
          "Runtime workspace-aware OAuth binding is unavailable. Authentication is not complete and no durable workspace binding can be verified.",
      });
    }
    try {
      const selected = await runtimeClient.oauthSelectPoolAccount({
        poolId: deps.defaultCodexOauthPoolId,
        sessionId: normalizedProjectWorkspaceId,
        modelId: null,
      });
      if (selected?.account) {
        return selectRefreshedCodexAccount(
          deps.normalizeOAuthAccountSummary(selected.account),
          refreshedCodexAccounts ?? []
        );
      }
    } catch (error) {
      if (deps.isRuntimeMethodUnsupportedError(error) || isRuntimeRpcContractGuardError(error)) {
        throw createRuntimeError({
          code: "runtime.oauth.workspace_binding_unavailable",
          message:
            "Runtime workspace-aware OAuth binding is unavailable. Authentication is not complete and no durable workspace binding can be verified.",
        });
      }
      deps.logRuntimeWarning(
        "Runtime oauth pool selection failed while reading project workspace account info; durable workspace binding could not be verified.",
        error
      );
      throw error;
    }
    return null;
  }
  return (
    selectRefreshedCodexAccount(
      deps.pickPreferredOAuthAccount(refreshedCodexAccounts ?? [], "codex"),
      refreshedCodexAccounts ?? []
    ) ?? resolvePreferredOAuthAccountWithDeps(deps)
  );
}

export function readOAuthSubscriptionPersistenceCapabilityWithDeps(deps: {
  detectRuntimeMode(): RuntimeClientMode;
  isWebRuntimeOauthCooldownActive(): boolean;
  webRuntimePersistenceConfigured: boolean;
  mockOauthFallbackActive: boolean;
}): OAuthSubscriptionPersistenceCapability {
  const hostMode = deps.detectRuntimeMode();
  const runtimeBacked =
    hostMode === "desktop-compat" ||
    (hostMode === "runtime-gateway-web" &&
      deps.webRuntimePersistenceConfigured &&
      !deps.mockOauthFallbackActive &&
      !deps.isWebRuntimeOauthCooldownActive());

  if (runtimeBacked) {
    return {
      hostMode,
      persistenceKind: "runtime-backed",
      runtimeBacked: true,
      durableStorage: true,
      workspaceAwareSessionBinding: true,
      summary:
        "Runtime-backed subscription persistence is active. ChatGPT workspace memberships, default workspace overrides, and workspace-aware session bindings are durably stored.",
    };
  }

  return {
    hostMode,
    persistenceKind: "runtime-unavailable",
    runtimeBacked: false,
    durableStorage: false,
    workspaceAwareSessionBinding: false,
    summary:
      "Web runtime durable OAuth persistence is unavailable. Authentication is not complete, no durable account or workspace binding has been written, and the UI must remain disconnected until runtime-backed OAuth recovers.",
  };
}
