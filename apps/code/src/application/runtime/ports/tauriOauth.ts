/**
 * Narrow OAuth/provider routing bridge for Codex accounts and pools.
 *
 * This adapter is the sole UI boundary for identity control-plane behavior.
 * It talks directly to focused OAuth service bridges instead of the deprecated
 * `./tauri` aggregation port.
 */
export type {
  OAuthAccountSummary,
  OAuthPrimaryAccountSetInput,
  OAuthPrimaryAccountSummary,
  OAuthPoolSummary,
  OAuthProviderId,
  RuntimeCockpitToolsCodexImportResponse,
} from "../../../services/runtimeClient";
export type { OAuthPoolAccountBindRequest } from "../../../services/runtimeClient";
export type { OAuthSubscriptionPersistenceCapability } from "../../../services/tauriOauthBridge";
export {
  applyOAuthPool,
  bindOAuthPoolAccount,
  cancelCodexLogin,
  getAccountInfo,
  getAccountRateLimits,
  getOAuthPrimaryAccount,
  getProvidersCatalog,
  importCodexAccountsFromCockpitTools,
  listOAuthAccounts,
  listOAuthPoolMembers,
  listOAuthPools,
  readOAuthSubscriptionPersistenceCapability,
  removeOAuthAccount,
  removeOAuthPool,
  replaceOAuthPoolMembers,
  reportOAuthRateLimit,
  resolveChatgptAuthTokensRefreshResponse,
  runCodexLogin,
  selectOAuthPoolAccount,
  setOAuthPrimaryAccount,
  upsertOAuthAccount,
  upsertOAuthPool,
} from "../../../services/tauriOauthBridge";
