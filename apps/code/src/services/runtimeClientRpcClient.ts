import {
  CODE_RUNTIME_RPC_EMPTY_PARAMS,
  CODE_RUNTIME_RPC_METHODS,
  type OAuthAccountUpsertInput,
  type OAuthChatgptAuthTokensRefreshRequest,
  type OAuthCodexLoginCancelRequest,
  type OAuthCodexLoginStartRequest,
  type OAuthPoolApplyInput,
  type OAuthPoolMemberInput,
  type OAuthPoolSelectionRequest,
  type OAuthPoolUpsertInput,
  type OAuthProviderId,
  type OAuthRateLimitReportInput,
  type OAuthUsageRefreshMode,
} from "@ku0/code-runtime-host-contract";
import type { AppSettings } from "../types";
import type { RuntimeClient as SharedRuntimeClient } from "@ku0/code-runtime-client/runtimeClientTypes";
import { createExtendedRpcRuntimeClient } from "@ku0/code-runtime-client/runtimeClientRpcExtensionsFactory";
import { withCanonicalFields } from "@ku0/code-runtime-client/runtimeClientRpcPayloads";
import {
  invokeRuntimeExtensionRpc,
  type RuntimeRpcInvoker,
} from "@ku0/code-runtime-client/runtimeClientRpcHelpers";
import { RUNTIME_EXTENSION_RPC_METHODS } from "@ku0/code-runtime-client/runtimeClientRpcMethods";

type RuntimeClient = SharedRuntimeClient<AppSettings>;

export function createRpcRuntimeClient(invokeRpc: RuntimeRpcInvoker): RuntimeClient {
  const client: RuntimeClient = {
    ...createExtendedRpcRuntimeClient<AppSettings>(invokeRpc),
    oauthAccounts(
      provider: OAuthProviderId | null = null,
      options?: { usageRefresh?: OAuthUsageRefreshMode | null }
    ) {
      const usageRefresh = options?.usageRefresh;
      return invokeRpc(CODE_RUNTIME_RPC_METHODS.OAUTH_ACCOUNTS_LIST, {
        provider,
        ...(usageRefresh ? withCanonicalFields({ usageRefresh }) : {}),
      });
    },
    oauthUpsertAccount(input: OAuthAccountUpsertInput) {
      return invokeRpc(CODE_RUNTIME_RPC_METHODS.OAUTH_ACCOUNT_UPSERT, {
        ...input,
        ...withCanonicalFields({ accountId: input.accountId }),
      });
    },
    oauthRemoveAccount(accountId: string) {
      return invokeRpc(
        CODE_RUNTIME_RPC_METHODS.OAUTH_ACCOUNT_REMOVE,
        withCanonicalFields({ accountId })
      );
    },
    oauthPrimaryAccountGet(provider: OAuthProviderId) {
      return invokeRpc(CODE_RUNTIME_RPC_METHODS.OAUTH_PRIMARY_ACCOUNT_GET, { provider });
    },
    oauthPrimaryAccountSet(input) {
      return invokeRpc(CODE_RUNTIME_RPC_METHODS.OAUTH_PRIMARY_ACCOUNT_SET, {
        provider: input.provider,
        ...withCanonicalFields({ accountId: input.accountId ?? null }),
      });
    },
    oauthPools(provider: OAuthProviderId | null = null) {
      return invokeRpc(CODE_RUNTIME_RPC_METHODS.OAUTH_POOLS_LIST, { provider });
    },
    oauthUpsertPool(input: OAuthPoolUpsertInput) {
      return invokeRpc(CODE_RUNTIME_RPC_METHODS.OAUTH_POOL_UPSERT, {
        ...input,
        ...withCanonicalFields({
          poolId: input.poolId,
          accountId: input.preferredAccountId ?? undefined,
        }),
      });
    },
    oauthRemovePool(poolId: string) {
      return invokeRpc(CODE_RUNTIME_RPC_METHODS.OAUTH_POOL_REMOVE, withCanonicalFields({ poolId }));
    },
    oauthPoolMembers(poolId: string) {
      return invokeRuntimeExtensionRpc(
        invokeRpc,
        RUNTIME_EXTENSION_RPC_METHODS.OAUTH_POOL_MEMBERS_LIST,
        withCanonicalFields({ poolId })
      );
    },
    oauthApplyPool(input: OAuthPoolApplyInput) {
      return invokeRuntimeExtensionRpc(invokeRpc, RUNTIME_EXTENSION_RPC_METHODS.OAUTH_POOL_APPLY, {
        pool: {
          ...input.pool,
          ...withCanonicalFields({
            poolId: input.pool.poolId,
            accountId: input.pool.preferredAccountId ?? undefined,
          }),
        },
        members: input.members.map((member) => ({
          ...member,
          ...withCanonicalFields({ accountId: member.accountId }),
        })),
        expectedUpdatedAt: input.expectedUpdatedAt ?? null,
        expected_updated_at: input.expectedUpdatedAt ?? null,
      });
    },
    oauthReplacePoolMembers(poolId: string, members: OAuthPoolMemberInput[]) {
      return invokeRpc(CODE_RUNTIME_RPC_METHODS.OAUTH_POOL_MEMBERS_REPLACE, {
        ...withCanonicalFields({ poolId }),
        members: members.map((member) => ({
          ...member,
          ...withCanonicalFields({ accountId: member.accountId }),
        })),
      });
    },
    oauthSelectPoolAccount(request: OAuthPoolSelectionRequest) {
      const chatgptWorkspaceId = request.chatgptWorkspaceId ?? request.workspaceId ?? null;
      const selectorPayload =
        request.chatgptWorkspaceId != null
          ? withCanonicalFields({
              chatgptWorkspaceId,
            })
          : withCanonicalFields({
              chatgptWorkspaceId,
              workspaceId: chatgptWorkspaceId,
            });
      return invokeRpc(CODE_RUNTIME_RPC_METHODS.OAUTH_POOL_SELECT, {
        ...withCanonicalFields({
          poolId: request.poolId,
          sessionId: request.sessionId ?? null,
          modelId: request.modelId ?? null,
        }),
        ...selectorPayload,
      });
    },
    oauthBindPoolAccount(request) {
      // `sessionId` is the local project-workspace/session key. The optional
      // ChatGPT workspace selector remains explicit through
      // `chatgptWorkspaceId`.
      const chatgptWorkspaceId = request.chatgptWorkspaceId ?? request.workspaceId ?? null;
      const selectorPayload =
        request.chatgptWorkspaceId != null
          ? withCanonicalFields({
              chatgptWorkspaceId,
            })
          : withCanonicalFields({
              chatgptWorkspaceId,
              workspaceId: chatgptWorkspaceId,
            });
      return invokeRpc(CODE_RUNTIME_RPC_METHODS.OAUTH_POOL_ACCOUNT_BIND, {
        ...withCanonicalFields({
          poolId: request.poolId,
          sessionId: request.sessionId,
          accountId: request.accountId,
        }),
        ...selectorPayload,
      });
    },
    oauthReportRateLimit(input: OAuthRateLimitReportInput) {
      return invokeRpc(CODE_RUNTIME_RPC_METHODS.OAUTH_RATE_LIMIT_REPORT, {
        ...input,
        ...withCanonicalFields({
          accountId: input.accountId,
          modelId: input.modelId ?? null,
        }),
        retryAfterSec: input.retryAfterSec ?? null,
        resetAt: input.resetAt ?? null,
        errorCode: input.errorCode ?? null,
        errorMessage: input.errorMessage ?? null,
      });
    },
    oauthChatgptAuthTokensRefresh(request: OAuthChatgptAuthTokensRefreshRequest = {}) {
      const previousAccountId = request.previousAccountId ?? null;
      const sessionId = request.sessionId ?? null;
      // `chatgptWorkspaceId` is canonical. `workspaceId` remains wire-compatible
      // for older runtimes, but should not be used by new code paths.
      const chatgptWorkspaceId = request.chatgptWorkspaceId ?? request.workspaceId ?? null;
      const selectorPayload =
        request.chatgptWorkspaceId != null
          ? withCanonicalFields({
              chatgptWorkspaceId,
            })
          : withCanonicalFields({
              chatgptWorkspaceId,
              workspaceId: chatgptWorkspaceId,
            });
      return invokeRuntimeExtensionRpc(
        invokeRpc,
        RUNTIME_EXTENSION_RPC_METHODS.OAUTH_CHATGPT_AUTH_TOKENS_REFRESH,
        {
          reason: request.reason ?? null,
          previousAccountId,
          previous_account_id: previousAccountId,
          ...withCanonicalFields({
            sessionId,
          }),
          ...selectorPayload,
        }
      );
    },
    oauthCodexLoginStart(request: OAuthCodexLoginStartRequest) {
      return invokeRpc(
        CODE_RUNTIME_RPC_METHODS.OAUTH_CODEX_LOGIN_START,
        withCanonicalFields({
          workspaceId: request.workspaceId,
          forceOAuth: request.forceOAuth === true,
        })
      );
    },
    oauthCodexLoginCancel(request: OAuthCodexLoginCancelRequest) {
      return invokeRpc(
        CODE_RUNTIME_RPC_METHODS.OAUTH_CODEX_LOGIN_CANCEL,
        withCanonicalFields({
          workspaceId: request.workspaceId,
        })
      );
    },
    oauthCodexAccountsImportFromCockpitTools() {
      return invokeRpc(
        CODE_RUNTIME_RPC_METHODS.OAUTH_CODEX_ACCOUNTS_IMPORT_FROM_COCKPIT_TOOLS,
        CODE_RUNTIME_RPC_EMPTY_PARAMS
      );
    },
    appSettingsGet() {
      return invokeRuntimeExtensionRpc<AppSettings>(
        invokeRpc,
        CODE_RUNTIME_RPC_METHODS.APP_SETTINGS_GET,
        CODE_RUNTIME_RPC_EMPTY_PARAMS
      );
    },
    appSettingsUpdate(settings: AppSettings) {
      return invokeRuntimeExtensionRpc<AppSettings>(
        invokeRpc,
        CODE_RUNTIME_RPC_METHODS.APP_SETTINGS_UPDATE,
        {
          payload: settings,
        }
      );
    },
  };

  return client;
}
