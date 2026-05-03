import {
  buildT3HugerouterSiteScope,
  getT3BrowserProfileSyncState,
  type T3BrowserProfileDescriptor,
  type T3BrowserProfileSyncState,
  type T3BrowserProvider,
  type T3BrowserRecentSession,
} from "./t3BrowserProfiles";

export type T3BrowserCloudSyncRisk = "low" | "standard" | "sensitive";

export type T3BrowserCloudSyncSessionMode =
  | "encrypted-state-bundle"
  | "login-assist"
  | "approval-gated-state-bundle";

export type T3BrowserCloudSyncPlan = {
  approvalRequired: boolean;
  credentialPayload: "encrypted-cloud-managed";
  globalLayer: {
    items: readonly string[];
    status: "cloud-ready" | "local-only";
  };
  localOverlay: {
    deviceId: string;
    items: readonly string[];
    status: "preserved";
  };
  profileId: string;
  profileLabel: string;
  schemaVersion: "t3-browser-cloud-sync/v1";
  sessionContinuity: {
    canResumeWebLogin: boolean;
    items: readonly string[];
    mode: T3BrowserCloudSyncSessionMode;
    webSessionPayload: "encrypted-cloud-managed";
  };
  siteId: string;
  siteLabel: string;
  siteOrigin: string;
  siteRisk: T3BrowserCloudSyncRisk;
  summary: string;
  warnings: readonly string[];
};

export type BuildT3BrowserCloudSyncPlanInput = {
  customUrl?: string | null;
  localDeviceId?: string | null;
  profile: T3BrowserProfileDescriptor;
  providerId: T3BrowserProvider;
  recentSessions: readonly T3BrowserRecentSession[];
  syncState?: T3BrowserProfileSyncState | null;
};

const GLOBAL_SYNC_ITEMS = [
  "bookmarks",
  "history-index",
  "open-tabs",
  "profile-settings",
  "extension-catalog",
  "site-continuity-metadata",
] as const;

const LOCAL_OVERLAY_ITEMS = [
  "download-paths",
  "window-layout",
  "proxy-and-vpn",
  "devtools-targets",
  "local-cache",
  "isolated-app-scopes",
] as const;

const LOGIN_ASSIST_ITEMS = [
  "account-hints",
  "passkey-or-password-fill",
  "recent-site-context",
  "trusted-device-approval",
] as const;

const ENCRYPTED_REFERENCE_ITEMS = [
  "encrypted-cookies",
  "encrypted-local-storage",
  "encrypted-indexed-db",
  "encrypted-cache-storage",
  "encrypted-service-worker",
  "encrypted-extension-data",
  "encrypted-browser-settings",
  "recent-site-context",
  "trusted-device-approval",
] as const;

const APPROVAL_GATED_STATE_ITEMS = [
  ...ENCRYPTED_REFERENCE_ITEMS,
  "step-up-approval",
  "restore-audit-required",
] as const;

function providerDefaultUrl(providerId: Exclude<T3BrowserProvider, "custom">) {
  if (providerId === "chatgpt") {
    return "https://chatgpt.com/";
  }
  if (providerId === "gemini") {
    return "https://gemini.google.com/app";
  }
  return "https://hugerouter.openhuge.local/";
}

function siteScopeForPlan(input: { customUrl?: string | null; providerId: T3BrowserProvider }) {
  if (input.providerId === "custom") {
    const customUrl = input.customUrl?.trim();
    if (!customUrl) {
      throw new Error("Enter a site URL before building a browser cloud sync plan.");
    }
    return buildT3HugerouterSiteScope(customUrl);
  }
  return buildT3HugerouterSiteScope(providerDefaultUrl(input.providerId));
}

function classifySiteRisk(input: { customUrl?: string | null; providerId: T3BrowserProvider }) {
  if (input.providerId === "hugerouter") {
    return "low" satisfies T3BrowserCloudSyncRisk;
  }
  const siteUrl = input.providerId === "custom" ? input.customUrl?.trim() : null;
  const hostname = siteUrl ? new URL(siteUrl).hostname.toLowerCase() : "";
  const pathname = siteUrl ? new URL(siteUrl).pathname.toLowerCase() : "";
  if (
    /\b(bank|billing|broker|coinbase|exchange|finance|gov|paypal|pay|stripe|wallet)\b/u.test(
      hostname
    ) ||
    /\/(billing|security|settings|admin|payment|password)(\/|$)/u.test(pathname)
  ) {
    return "sensitive" satisfies T3BrowserCloudSyncRisk;
  }
  return "standard" satisfies T3BrowserCloudSyncRisk;
}

function sessionModeForPlan(input: {
  remoteSessionAvailable: boolean;
  siteRisk: T3BrowserCloudSyncRisk;
}): T3BrowserCloudSyncSessionMode {
  if (input.remoteSessionAvailable && input.siteRisk === "sensitive") {
    return "approval-gated-state-bundle";
  }
  if (input.remoteSessionAvailable && input.siteRisk === "low") {
    return "encrypted-state-bundle";
  }
  return "login-assist";
}

function sessionItemsForMode(mode: T3BrowserCloudSyncSessionMode) {
  if (mode === "encrypted-state-bundle") {
    return ENCRYPTED_REFERENCE_ITEMS;
  }
  if (mode === "approval-gated-state-bundle") {
    return APPROVAL_GATED_STATE_ITEMS;
  }
  return LOGIN_ASSIST_ITEMS;
}

export function buildT3BrowserCloudSyncPlan(
  input: BuildT3BrowserCloudSyncPlanInput
): T3BrowserCloudSyncPlan {
  const site = siteScopeForPlan(input);
  const syncState = input.syncState ?? getT3BrowserProfileSyncState(input.profile);
  const siteRisk = classifySiteRisk(input);
  const sessionMode = sessionModeForPlan({
    remoteSessionAvailable: syncState.remoteSessionAvailable,
    siteRisk,
  });
  const canResumeWebLogin = syncState.remoteSessionAvailable && sessionMode !== "login-assist";
  const recentSiteSessionCount = input.recentSessions.filter(
    (session) => session.siteId === site.siteId
  ).length;
  const globalStatus = syncState.status === "synced" ? "cloud-ready" : "local-only";
  const warnings =
    siteRisk === "sensitive"
      ? ["Sensitive sites require trusted-device approval before encrypted state restore."]
      : syncState.status === "synced"
        ? []
        : ["Sync the profile before this site can use cross-device login assist."];
  const summary =
    sessionMode === "encrypted-state-bundle"
      ? "Cloud sync can restore encrypted browser state across trusted devices after the profile is synced and released."
      : sessionMode === "login-assist"
        ? "Cloud sync can restore the site context and accelerate login after the next encrypted profile snapshot."
        : "Encrypted browser state can restore on trusted devices after step-up approval and audit logging.";

  return {
    approvalRequired: siteRisk !== "low",
    credentialPayload: "encrypted-cloud-managed",
    globalLayer: {
      items:
        recentSiteSessionCount > 0
          ? [...GLOBAL_SYNC_ITEMS, "recent-session-pointer"]
          : GLOBAL_SYNC_ITEMS,
      status: globalStatus,
    },
    localOverlay: {
      deviceId: input.localDeviceId?.trim() || `local:${input.profile.id}`,
      items: LOCAL_OVERLAY_ITEMS,
      status: "preserved",
    },
    profileId: input.profile.id,
    profileLabel: input.profile.label,
    schemaVersion: "t3-browser-cloud-sync/v1",
    sessionContinuity: {
      canResumeWebLogin,
      items: sessionItemsForMode(sessionMode),
      mode: sessionMode,
      webSessionPayload: "encrypted-cloud-managed",
    },
    siteId: site.siteId,
    siteLabel: site.siteLabel,
    siteOrigin: site.siteOrigin,
    siteRisk,
    summary,
    warnings,
  };
}
