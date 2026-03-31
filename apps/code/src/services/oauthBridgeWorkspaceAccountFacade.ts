import {
  createRuntimeAccountInfoResponse,
  createRuntimeAccountRateLimitsResponse,
  pickPoolPreferredAccount,
  pickPreferredOAuthAccount,
} from "./oauthBridgeAccountHelpers";
import { normalizeOAuthAccountSummary } from "./oauthBridgeNormalization";
import type {
  OAuthSubscriptionPersistenceCapability,
  ProjectWorkspaceScopedOAuthAccountResolverDeps,
} from "./oauthBridgeWorkspaceAccount";
import {
  readOAuthSubscriptionPersistenceCapabilityWithDeps,
  resolveProjectWorkspaceScopedOAuthAccountWithDeps,
} from "./oauthBridgeWorkspaceAccount";

type LooseResultEnvelope = Record<string, unknown>;

type WorkspaceAccountFacadeDeps = Pick<
  ProjectWorkspaceScopedOAuthAccountResolverDeps,
  | "listOAuthAccounts"
  | "listOAuthPools"
  | "getRuntimeClient"
  | "normalizeNullableText"
  | "isRuntimeMethodUnsupportedError"
  | "logRuntimeWarning"
> & {
  defaultCodexOauthPoolId: string;
  detectRuntimeMode(): ReturnType<
    typeof readOAuthSubscriptionPersistenceCapabilityWithDeps
  >["hostMode"];
  isWebRuntimeOauthCooldownActive(): boolean;
  webRuntimePersistenceConfigured: boolean;
  mockOauthFallbackActive: boolean;
};

function createProjectWorkspaceScopedOAuthAccountResolverDeps(
  deps: WorkspaceAccountFacadeDeps
): ProjectWorkspaceScopedOAuthAccountResolverDeps {
  return {
    defaultCodexOauthPoolId: deps.defaultCodexOauthPoolId,
    listOAuthAccounts: deps.listOAuthAccounts,
    listOAuthPools: deps.listOAuthPools,
    pickPoolPreferredAccount,
    pickPreferredOAuthAccount,
    getRuntimeClient: deps.getRuntimeClient,
    normalizeOAuthAccountSummary,
    normalizeNullableText: deps.normalizeNullableText,
    isRuntimeMethodUnsupportedError: deps.isRuntimeMethodUnsupportedError,
    logRuntimeWarning: deps.logRuntimeWarning,
  };
}

export function readOAuthSubscriptionPersistenceCapability(
  deps: Pick<
    WorkspaceAccountFacadeDeps,
    | "detectRuntimeMode"
    | "isWebRuntimeOauthCooldownActive"
    | "webRuntimePersistenceConfigured"
    | "mockOauthFallbackActive"
  >
): OAuthSubscriptionPersistenceCapability {
  return readOAuthSubscriptionPersistenceCapabilityWithDeps({
    detectRuntimeMode: deps.detectRuntimeMode,
    isWebRuntimeOauthCooldownActive: deps.isWebRuntimeOauthCooldownActive,
    webRuntimePersistenceConfigured: deps.webRuntimePersistenceConfigured,
    mockOauthFallbackActive: deps.mockOauthFallbackActive,
  });
}

export async function getAccountRateLimits(
  deps: WorkspaceAccountFacadeDeps,
  workspaceId: string
): Promise<LooseResultEnvelope> {
  return createRuntimeAccountRateLimitsResponse(
    await resolveProjectWorkspaceScopedOAuthAccountWithDeps(
      createProjectWorkspaceScopedOAuthAccountResolverDeps(deps),
      workspaceId,
      {
        refreshCodexUsage: true,
      }
    )
  );
}

export async function getAccountInfo(
  deps: WorkspaceAccountFacadeDeps,
  workspaceId: string
): Promise<LooseResultEnvelope> {
  return createRuntimeAccountInfoResponse(
    await resolveProjectWorkspaceScopedOAuthAccountWithDeps(
      createProjectWorkspaceScopedOAuthAccountResolverDeps(deps),
      workspaceId
    )
  );
}
