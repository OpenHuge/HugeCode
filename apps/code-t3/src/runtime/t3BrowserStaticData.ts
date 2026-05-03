import {
  listT3AiGatewayRoutesMock,
  listT3BrowserGuestPasses,
  listT3BrowserIsolatedApps,
  listT3BrowserRecentSessions,
  listT3HugerouterCapacityListingsMock,
  listT3HugerouterCapacityOrdersMock,
  type T3AiGatewayRoute,
  type T3BrowserGuestPass,
  type T3BrowserIsolatedApp,
  type T3BrowserProfileDescriptor,
  type T3BrowserProfileMigrationState,
  type T3BrowserProfileSyncState,
  type T3BrowserRecentSession,
  type T3BrowserSeatPool,
  type T3HugerouterCapacityListing,
  type T3HugerouterCapacityOrder,
} from "./t3BrowserProfiles";

const STORAGE_KEY = "hugecode_t3_browser_profiles_v1";
const RECENT_SESSIONS_STORAGE_KEY = "hugecode_t3_browser_recent_sessions_v1";
const PROFILE_SYNC_STORAGE_KEY = "hugecode_t3_browser_profile_sync_mock_v1";
const PROFILE_MIGRATION_STORAGE_KEY = "hugecode_t3_browser_profile_migration_mock_v1";
const GUEST_PASS_STORAGE_KEY = "hugecode_t3_browser_guest_passes_mock_v1";
const SEAT_POOL_STORAGE_KEY = "hugecode_t3_browser_seat_pools_mock_v1";
const ISOLATED_APPS_STORAGE_KEY = "hugecode_t3_browser_isolated_apps_mock_v1";
const AI_GATEWAY_ROUTES_STORAGE_KEY = "hugecode_t3_ai_gateway_routes_mock_v1";
const HUGEROUTER_LISTINGS_STORAGE_KEY = "hugecode_t3_hugerouter_listings_mock_v1";
const HUGEROUTER_ORDERS_STORAGE_KEY = "hugecode_t3_hugerouter_orders_mock_v1";

export type T3BrowserStaticDataBundlePayload = {
  aiGatewayRoutes: T3AiGatewayRoute[];
  guestPasses: T3BrowserGuestPass[];
  hugerouterListings: T3HugerouterCapacityListing[];
  hugerouterOrders: T3HugerouterCapacityOrder[];
  isolatedApps: T3BrowserIsolatedApp[];
  loginStateBundles: T3BrowserEncryptedLoginStateBundle[];
  migrationRecords: Record<string, T3BrowserProfileMigrationState>;
  recentSessions: T3BrowserRecentSession[];
  remoteProfiles: T3BrowserProfileDescriptor[];
  seatPools: T3BrowserSeatPool[];
  syncRecords: Record<string, T3BrowserProfileSyncState>;
};

export type T3BrowserEncryptedLoginStateBundle = {
  cookieCount: number;
  createdAt: number;
  encryptedPayloadBase64: string;
  encryption: "electron-safe-storage";
  id: string;
  originCount: number;
  payloadFormat: "electron-session-cookies/v1" | "electron-session-state/v2";
  stateByteCount?: number;
  stateFileCount?: number;
  summary: string;
};

export type T3BrowserStaticDataBundle = {
  exportedAt: number;
  payload: T3BrowserStaticDataBundlePayload;
  payloadPolicy: "host-encrypted-browser-state" | "metadata-only-no-raw-credentials";
  schemaVersion: "hugecode.t3-browser-static-data/v1";
  summary: string;
};

export type T3BrowserStaticDataImportResult = {
  importedCounts: Record<keyof T3BrowserStaticDataBundlePayload, number>;
  loginStateBundles: T3BrowserEncryptedLoginStateBundle[];
  profiles: T3BrowserProfileDescriptor[];
  summary: string;
};

export type T3BrowserChromeSiteDataExportResult = {
  chromeExecutablePath: string;
  profilePath: string;
  restoredBytes: number;
  restoredFiles: number;
  summary: string;
  targetUrl: string;
};

type DesktopBrowserStaticDataBridgeGlobal = {
  exportLoginState?: () => Promise<T3BrowserEncryptedLoginStateBundle | null>;
  exportToChrome?: (input: { targetUrl: string }) => Promise<T3BrowserChromeSiteDataExportResult>;
  importLoginState?: (bundle: T3BrowserEncryptedLoginStateBundle) => Promise<{
    importedCookies: number;
    originCount: number;
    restoredBytes?: number;
    restoredFiles?: number;
  }>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readJsonRecord(key: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) ?? "{}") as unknown;
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function readJsonArray<T>(key: string, normalize: (value: unknown) => T | null): T[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) ?? "[]") as unknown;
    return Array.isArray(parsed)
      ? parsed.map(normalize).filter((entry): entry is T => entry !== null)
      : [];
  } catch {
    return [];
  }
}

function writeJson(key: string, value: unknown) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

function currentBrowserProfile(): T3BrowserProfileDescriptor {
  return {
    endpointUrl: null,
    fingerprintPolicy: "native-transparent",
    id: "current-browser",
    label: "Current browser profile",
    providerIds: ["hugerouter", "chatgpt", "gemini", "custom"],
    securityModel: "current-browser-session",
    source: "current-browser",
    status: "available",
    statusMessage:
      "Uses the account already available to this browser session. HugeCode does not read cookies or passwords.",
  };
}

function normalizeRemoteProfile(value: unknown): T3BrowserProfileDescriptor | null {
  if (!isRecord(value)) return null;
  const id = readText(value.id);
  const label = readText(value.label);
  if (!id || !label) return null;
  return {
    endpointUrl: readText(value.endpointUrl),
    fingerprintPolicy: "native-transparent",
    id,
    label,
    providerIds: ["hugerouter", "chatgpt", "gemini", "custom"],
    securityModel:
      value.securityModel === "remote-devtools-reference"
        ? value.securityModel
        : "remote-devtools-reference",
    source: "remote-devtools",
    status: value.status === "connected" || value.status === "blocked" ? value.status : "available",
    statusMessage: readText(value.statusMessage) ?? "Remote profile restored from static metadata.",
  };
}

function normalizeRecentSession(value: unknown): T3BrowserRecentSession | null {
  if (!isRecord(value)) return null;
  const id = readText(value.id);
  const url = readText(value.url);
  const profileId = readText(value.profileId);
  const profileLabel = readText(value.profileLabel);
  const title = readText(value.title);
  if (!id || !url || !profileId || !profileLabel || !title) return null;
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) {
      return null;
    }
  } catch {
    return null;
  }
  return {
    fingerprintPolicy: "native-transparent",
    id,
    isolatedAppId: readText(value.isolatedAppId),
    isolatedAppLabel: readText(value.isolatedAppLabel),
    openedAt: readNumber(value.openedAt) ?? Date.now(),
    profileId,
    profileLabel,
    providerId:
      value.providerId === "chatgpt" ||
      value.providerId === "gemini" ||
      value.providerId === "hugerouter" ||
      value.providerId === "custom"
        ? value.providerId
        : "custom",
    siteId: readText(value.siteId) ?? new URL(url).origin,
    siteLabel: readText(value.siteLabel) ?? new URL(url).hostname,
    siteOrigin: readText(value.siteOrigin) ?? new URL(url).origin,
    title,
    url,
  };
}

function normalizeEncryptedLoginStateBundle(
  value: unknown
): T3BrowserEncryptedLoginStateBundle | null {
  if (!isRecord(value)) return null;
  const id = readText(value.id);
  const encryptedPayloadBase64 = readText(value.encryptedPayloadBase64);
  if (!id || !encryptedPayloadBase64) return null;
  return {
    cookieCount: readNumber(value.cookieCount) ?? 0,
    createdAt: readNumber(value.createdAt) ?? Date.now(),
    encryptedPayloadBase64,
    encryption: "electron-safe-storage",
    id,
    originCount: readNumber(value.originCount) ?? 0,
    payloadFormat:
      value.payloadFormat === "electron-session-state/v2"
        ? "electron-session-state/v2"
        : "electron-session-cookies/v1",
    stateByteCount: readNumber(value.stateByteCount) ?? undefined,
    stateFileCount: readNumber(value.stateFileCount) ?? undefined,
    summary: readText(value.summary) ?? "Host-encrypted Electron browser session state.",
  };
}

function uniqueById<T extends { id: string }>(items: readonly T[]): T[] {
  const seen = new Set<string>();
  const uniqueItems: T[] = [];
  for (const item of items) {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      uniqueItems.push(item);
    }
  }
  return uniqueItems;
}

function normalizeArray<T>(value: unknown, normalize: (entry: unknown) => T | null): T[] {
  return Array.isArray(value)
    ? value.map(normalize).filter((entry): entry is T => entry !== null)
    : [];
}

function normalizeObjectArray<T extends { id: string }>(value: unknown): T[] {
  return normalizeArray(value, (entry) =>
    isRecord(entry) && readText(entry.id) ? (entry as T) : null
  );
}

function normalizeRecord<T>(value: unknown): Record<string, T> {
  return isRecord(value) ? (value as Record<string, T>) : {};
}

function normalizeStaticDataPayload(value: unknown): T3BrowserStaticDataBundlePayload {
  const record = isRecord(value)
    ? (value as Partial<Record<keyof T3BrowserStaticDataBundlePayload, unknown>>)
    : {};
  return {
    aiGatewayRoutes: normalizeObjectArray<T3AiGatewayRoute>(record.aiGatewayRoutes),
    guestPasses: normalizeObjectArray<T3BrowserGuestPass>(record.guestPasses),
    hugerouterListings: normalizeObjectArray<T3HugerouterCapacityListing>(
      record.hugerouterListings
    ),
    hugerouterOrders: normalizeObjectArray<T3HugerouterCapacityOrder>(record.hugerouterOrders),
    isolatedApps: normalizeObjectArray<T3BrowserIsolatedApp>(record.isolatedApps),
    loginStateBundles: normalizeArray(record.loginStateBundles, normalizeEncryptedLoginStateBundle),
    migrationRecords: normalizeRecord<T3BrowserProfileMigrationState>(record.migrationRecords),
    recentSessions: normalizeArray(record.recentSessions, normalizeRecentSession)
      .sort((left, right) => right.openedAt - left.openedAt)
      .slice(0, 8),
    remoteProfiles: uniqueById(normalizeArray(record.remoteProfiles, normalizeRemoteProfile)),
    seatPools: normalizeObjectArray<T3BrowserSeatPool>(record.seatPools),
    syncRecords: normalizeRecord<T3BrowserProfileSyncState>(record.syncRecords),
  };
}

function countRecordEntries(record: Record<string, unknown>) {
  return Object.keys(record).length;
}

function getDesktopBrowserStaticDataBridge() {
  const desktopWindow = window as Window & {
    hugeCodeDesktopHost?: { browserStaticData?: DesktopBrowserStaticDataBridgeGlobal };
  };
  return desktopWindow.hugeCodeDesktopHost?.browserStaticData ?? null;
}

export async function exportT3BrowserSiteDataToChrome(input: {
  targetUrl: string;
}): Promise<T3BrowserChromeSiteDataExportResult> {
  const exportToChrome = getDesktopBrowserStaticDataBridge()?.exportToChrome;
  if (!exportToChrome) {
    throw new Error("This host cannot export built-in browser site data to Chrome.");
  }
  return exportToChrome(input);
}

export function buildT3BrowserStaticDataBundle(): T3BrowserStaticDataBundle {
  return {
    exportedAt: Date.now(),
    payload: {
      aiGatewayRoutes: listT3AiGatewayRoutesMock(),
      guestPasses: listT3BrowserGuestPasses(),
      hugerouterListings: listT3HugerouterCapacityListingsMock(),
      hugerouterOrders: listT3HugerouterCapacityOrdersMock(),
      isolatedApps: listT3BrowserIsolatedApps(),
      loginStateBundles: [],
      migrationRecords: readJsonRecord(PROFILE_MIGRATION_STORAGE_KEY) as Record<
        string,
        T3BrowserProfileMigrationState
      >,
      recentSessions: listT3BrowserRecentSessions(),
      remoteProfiles: readJsonArray(STORAGE_KEY, normalizeRemoteProfile),
      seatPools: readJsonArray(SEAT_POOL_STORAGE_KEY, (entry) =>
        isRecord(entry) && readText(entry.id) ? (entry as T3BrowserSeatPool) : null
      ),
      syncRecords: readJsonRecord(PROFILE_SYNC_STORAGE_KEY) as Record<
        string,
        T3BrowserProfileSyncState
      >,
    },
    payloadPolicy: "host-encrypted-browser-state",
    schemaVersion: "hugecode.t3-browser-static-data/v1",
    summary:
      "Static HugeCode browser data bundle. Browser session state is included only as host-encrypted browser state.",
  };
}

export async function buildT3BrowserStaticDataBundleWithLoginState(): Promise<T3BrowserStaticDataBundle> {
  const bundle = buildT3BrowserStaticDataBundle();
  const loginStateBundle = await getDesktopBrowserStaticDataBridge()?.exportLoginState?.();
  return loginStateBundle
    ? {
        ...bundle,
        payload: { ...bundle.payload, loginStateBundles: [loginStateBundle] },
        summary: "Static HugeCode browser data bundle with host-encrypted Electron session state.",
      }
    : bundle;
}

export function serializeT3BrowserStaticDataBundle(
  bundle = buildT3BrowserStaticDataBundle()
): string {
  return `${JSON.stringify(bundle, null, 2)}\n`;
}

export async function serializeT3BrowserStaticDataBundleWithLoginState(): Promise<string> {
  return serializeT3BrowserStaticDataBundle(await buildT3BrowserStaticDataBundleWithLoginState());
}

export function importT3BrowserStaticDataBundle(
  serializedBundle: string
): T3BrowserStaticDataImportResult {
  const parsed = JSON.parse(serializedBundle) as unknown;
  if (!isRecord(parsed)) {
    throw new Error("Browser data import file must be a JSON object.");
  }
  const bundle = parsed as Partial<T3BrowserStaticDataBundle>;
  if (bundle.schemaVersion !== "hugecode.t3-browser-static-data/v1") {
    throw new Error("Unsupported browser data import schema.");
  }
  if (
    bundle.payloadPolicy !== "metadata-only-no-raw-credentials" &&
    bundle.payloadPolicy !== "host-encrypted-browser-state"
  ) {
    throw new Error("Browser data import must declare a supported credential policy.");
  }
  const payload = normalizeStaticDataPayload(bundle.payload);
  const nextRemoteProfiles = uniqueById([
    ...payload.remoteProfiles,
    ...readJsonArray(STORAGE_KEY, normalizeRemoteProfile),
  ]);
  const nextRecentSessions = uniqueById([
    ...payload.recentSessions,
    ...listT3BrowserRecentSessions(),
  ])
    .sort((left, right) => right.openedAt - left.openedAt)
    .slice(0, 8);
  const nextGuestPasses = uniqueById([...payload.guestPasses, ...listT3BrowserGuestPasses()]);
  const nextSeatPools = uniqueById([
    ...payload.seatPools,
    ...readJsonArray(SEAT_POOL_STORAGE_KEY, (entry) =>
      isRecord(entry) && readText(entry.id) ? (entry as T3BrowserSeatPool) : null
    ),
  ]);
  const nextIsolatedApps = uniqueById([...payload.isolatedApps, ...listT3BrowserIsolatedApps()]);
  const nextAiGatewayRoutes = uniqueById([
    ...payload.aiGatewayRoutes,
    ...listT3AiGatewayRoutesMock(),
  ]);
  const nextHugerouterListings = uniqueById([
    ...payload.hugerouterListings,
    ...listT3HugerouterCapacityListingsMock(),
  ]);
  const nextHugerouterOrders = uniqueById([
    ...payload.hugerouterOrders,
    ...listT3HugerouterCapacityOrdersMock(),
  ]);

  writeJson(STORAGE_KEY, nextRemoteProfiles);
  writeJson(RECENT_SESSIONS_STORAGE_KEY, nextRecentSessions);
  writeJson(PROFILE_SYNC_STORAGE_KEY, {
    ...readJsonRecord(PROFILE_SYNC_STORAGE_KEY),
    ...payload.syncRecords,
  });
  writeJson(PROFILE_MIGRATION_STORAGE_KEY, {
    ...readJsonRecord(PROFILE_MIGRATION_STORAGE_KEY),
    ...payload.migrationRecords,
  });
  writeJson(GUEST_PASS_STORAGE_KEY, nextGuestPasses);
  writeJson(SEAT_POOL_STORAGE_KEY, nextSeatPools);
  writeJson(ISOLATED_APPS_STORAGE_KEY, nextIsolatedApps);
  writeJson(AI_GATEWAY_ROUTES_STORAGE_KEY, nextAiGatewayRoutes);
  writeJson(HUGEROUTER_LISTINGS_STORAGE_KEY, nextHugerouterListings);
  writeJson(HUGEROUTER_ORDERS_STORAGE_KEY, nextHugerouterOrders);

  const importedCounts: T3BrowserStaticDataImportResult["importedCounts"] = {
    aiGatewayRoutes: payload.aiGatewayRoutes.length,
    guestPasses: payload.guestPasses.length,
    hugerouterListings: payload.hugerouterListings.length,
    hugerouterOrders: payload.hugerouterOrders.length,
    isolatedApps: payload.isolatedApps.length,
    loginStateBundles: payload.loginStateBundles.length,
    migrationRecords: countRecordEntries(payload.migrationRecords),
    recentSessions: payload.recentSessions.length,
    remoteProfiles: payload.remoteProfiles.length,
    seatPools: payload.seatPools.length,
    syncRecords: countRecordEntries(payload.syncRecords),
  };
  const importedTotal = Object.values(importedCounts).reduce((total, count) => total + count, 0);
  return {
    importedCounts,
    loginStateBundles: payload.loginStateBundles,
    profiles: [currentBrowserProfile(), ...nextRemoteProfiles],
    summary: `Imported ${importedTotal} browser metadata records from the static bundle.`,
  };
}

export async function importT3BrowserStaticDataLoginStateBundles(
  bundles: readonly T3BrowserEncryptedLoginStateBundle[]
): Promise<string | null> {
  if (bundles.length === 0) {
    return null;
  }
  const importLoginState = getDesktopBrowserStaticDataBridge()?.importLoginState;
  if (!importLoginState) {
    return "Imported metadata, but this host cannot restore encrypted browser login state.";
  }
  let importedCookies = 0;
  let originCount = 0;
  let restoredFiles = 0;
  let restoredBytes = 0;
  for (const bundle of bundles) {
    const result = await importLoginState(bundle);
    importedCookies += result.importedCookies;
    originCount += result.originCount;
    restoredFiles += result.restoredFiles ?? 0;
    restoredBytes += result.restoredBytes ?? 0;
  }
  if (restoredFiles > 0) {
    return `Restored ${importedCookies} encrypted login cookies and ${restoredFiles} local browser files (${restoredBytes} bytes) across ${originCount} origins.`;
  }
  return `Restored ${importedCookies} encrypted login cookies across ${originCount} origins.`;
}
