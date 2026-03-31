import {
  readStoredWebRuntimeGatewayProfile,
  toSafeExternalUrl,
  WEB_RUNTIME_GATEWAY_ENDPOINT_ENV_KEY,
} from "@ku0/shared";
import { isTauri } from "../../../../../application/runtime/ports/desktopHostCore";
import { openUrl } from "../../../../../application/runtime/facades/desktopHostFacade";
import {
  type OAuthAccountSummary,
  type OAuthPoolSummary,
} from "../../../../../application/runtime/ports/oauth";
import { listWorkspaces } from "../../../../../application/runtime/ports/workspaceCatalog";
import { DEFAULT_RUNTIME_WORKSPACE_ID } from "../../../../../utils/runtimeWorkspaceIds";

const LOCAL_CODEX_CLI_ACCOUNT_SOURCE = "local_codex_cli_auth";
const SERVICE_CODEX_OAUTH_ACCOUNT_SOURCE = "service_codex_oauth";

export const OAUTH_LOGIN_DEFAULT_WORKSPACE_ID = DEFAULT_RUNTIME_WORKSPACE_ID;
export const OAUTH_WORKSPACE_DISCOVERY_TIMEOUT_MS = 1_500;
export const OAUTH_ACCOUNT_SYNC_TIMEOUT_MS = 20_000;
export const OAUTH_ACCOUNT_SYNC_POLL_INTERVAL_MS = 800;
export const OAUTH_POPUP_MESSAGE_TYPE = "fastcode:oauth:codex";
const OAUTH_POPUP_LOGIN_ID_STORAGE_KEY = "hugecode.oauth.codex.active-login-id";
let activeOauthPopupLoginIdMemory: string | null = null;

export const STICKY_MODE_DESCRIPTION: Record<OAuthPoolSummary["stickyMode"], string> = {
  cache_first: "Keep session on last healthy account for stable context and fewer switches.",
  balance: "Do not pin sessions; prioritize fair load distribution across accounts.",
  performance_first:
    "Keep session stickiness when it is not worse than alternatives, otherwise switch to healthier accounts.",
};

export function confirmDestructiveAction(message: string): boolean {
  if (typeof window === "undefined" || typeof window.confirm !== "function") {
    return true;
  }
  try {
    return window.confirm(message);
  } catch {
    return true;
  }
}

function isActualTauriRuntime(): boolean {
  try {
    return isTauri();
  } catch {
    return false;
  }
}

function isJsdomRuntime(): boolean {
  return typeof navigator !== "undefined" && /jsdom/i.test(navigator.userAgent ?? "");
}

export function shouldUseWebOAuthPopup(): boolean {
  return !isActualTauriRuntime() && !isJsdomRuntime();
}

export function openOAuthPopupWindow(): Window | null {
  if (typeof window === "undefined" || typeof window.open !== "function") {
    return null;
  }
  try {
    // Do not set noopener/noreferrer here: we need a live Window reference
    // to navigate this pre-opened popup after async OAuth start returns.
    return window.open("about:blank", "_blank");
  } catch {
    return null;
  }
}

function readStorage() {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function tryReadOrigin(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function setActiveOauthPopupLoginId(loginId: string | null) {
  activeOauthPopupLoginIdMemory = loginId;
  const storage = readStorage();
  if (!storage) {
    return;
  }
  if (!loginId) {
    storage.removeItem(OAUTH_POPUP_LOGIN_ID_STORAGE_KEY);
    return;
  }
  storage.setItem(OAUTH_POPUP_LOGIN_ID_STORAGE_KEY, loginId);
}

export function readActiveOauthPopupLoginId() {
  const storage = readStorage();
  return storage?.getItem(OAUTH_POPUP_LOGIN_ID_STORAGE_KEY) ?? activeOauthPopupLoginIdMemory;
}

export function clearActiveOauthPopupLoginId() {
  setActiveOauthPopupLoginId(null);
}

export function resolveAllowedOauthPopupOrigins() {
  const origins = new Set<string>();
  if (typeof window !== "undefined" && window.location.origin !== "null") {
    origins.add(window.location.origin);
  }
  const runtimeGatewayOrigin = tryReadOrigin(readStoredWebRuntimeGatewayProfile()?.httpBaseUrl);
  if (runtimeGatewayOrigin) {
    origins.add(runtimeGatewayOrigin);
  }
  const env = (
    import.meta as ImportMeta & {
      env?: Record<string, string | boolean | undefined>;
    }
  ).env;
  const configuredGatewayOrigin = tryReadOrigin(
    typeof env?.[WEB_RUNTIME_GATEWAY_ENDPOINT_ENV_KEY] === "string"
      ? env[WEB_RUNTIME_GATEWAY_ENDPOINT_ENV_KEY]
      : null
  );
  if (configuredGatewayOrigin) {
    origins.add(configuredGatewayOrigin);
  }
  return origins;
}

export async function openOAuthUrl(
  authUrl: string,
  preopenedPopup: Window | null = null
): Promise<void> {
  const safeUrl = toSafeExternalUrl(authUrl);
  if (!safeUrl) {
    throw new Error("Blocked unsafe OAuth URL.");
  }
  if (shouldUseWebOAuthPopup()) {
    const popup = preopenedPopup ?? openOAuthPopupWindow();
    if (!popup) {
      throw new Error("OAuth popup was blocked. Please allow pop-ups and try again.");
    }
    try {
      popup.location.replace(safeUrl);
      popup.focus?.();
      return;
    } catch {
      try {
        const fallbackPopup = window.open(safeUrl, "_blank", "noopener,noreferrer");
        if (fallbackPopup) {
          fallbackPopup.focus?.();
          return;
        }
      } catch {
        // handled below
      }
      throw new Error("Unable to open OAuth popup window. Please allow pop-ups and try again.");
    }
  }
  try {
    await openUrl(safeUrl);
    return;
  } catch {
    // Fall through to window.open fallback.
  }
  if (typeof window === "undefined" || typeof window.open !== "function") {
    return;
  }
  try {
    const popup = window.open(safeUrl, "_blank", "noopener,noreferrer");
    if (popup) {
      popup.focus?.();
      return;
    }
  } catch {
    // Best effort only.
  }
  throw new Error("Unable to open OAuth URL in a new window.");
}

export async function listWorkspacesForOauth(): Promise<
  Awaited<ReturnType<typeof listWorkspaces>>
> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error("Timed out discovering workspaces for OAuth login."));
    }, OAUTH_WORKSPACE_DISCOVERY_TIMEOUT_MS);
  });
  try {
    return await Promise.race([listWorkspaces(), timeout]);
  } finally {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
  }
}

export function accountHasRoutingCredential(account: OAuthAccountSummary): boolean {
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
    record.source === LOCAL_CODEX_CLI_ACCOUNT_SOURCE &&
    record.credentialAvailable === true
  );
}

export function isLocalCliManagedAccount(account: OAuthAccountSummary): boolean {
  if (account.accountId === "codex-local-cli") {
    return true;
  }
  const metadata = account.metadata;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return false;
  }
  const record = metadata as Record<string, unknown>;
  return record.localCliManaged === true && record.source === LOCAL_CODEX_CLI_ACCOUNT_SOURCE;
}

export function maxCodexAccountTimestamp(accounts: ReadonlyArray<OAuthAccountSummary>): number {
  return accounts
    .filter((account) => account.provider === "codex")
    .reduce((maxValue, account) => Math.max(maxValue, account.updatedAt ?? 0), 0);
}

export function accountHasServiceCodexOauthSource(account: OAuthAccountSummary): boolean {
  if (account.provider !== "codex") {
    return false;
  }
  const metadata = account.metadata;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return false;
  }
  const record = metadata as Record<string, unknown>;
  return record.source === SERVICE_CODEX_OAUTH_ACCOUNT_SOURCE;
}
