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
import {
  buildT3BrowserPortableLoginStateContract,
  isT3BrowserHostBoundLoginStateEncryption,
  isT3BrowserPortableLoginStateEncryption,
  normalizeT3BrowserAllowedOrigins,
  T3_BROWSER_HOST_BOUND_PAYLOAD_POLICY,
  T3_BROWSER_METADATA_ONLY_PAYLOAD_POLICY,
  T3_BROWSER_PORTABLE_ENCRYPTION,
  T3_BROWSER_PORTABLE_PAYLOAD_POLICY,
  T3_BROWSER_SAFE_STORAGE_ENCRYPTION,
  T3_BROWSER_STATIC_DATA_SCHEMA_VERSION_V1,
  T3_BROWSER_STATIC_DATA_SCHEMA_VERSION_V2,
  type T3BrowserLoginStateEncryption,
  type T3BrowserPortableLoginStateContract,
  type T3BrowserPortableLoginStateCrypto,
  type T3BrowserStaticDataPayloadPolicy,
  type T3BrowserStaticDataSchemaVersion,
} from "./t3BrowserAccountDataContract";

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
  encryption: T3BrowserLoginStateEncryption;
  id: string;
  originCount: number;
  payloadFormat: "electron-session-cookies/v1" | "electron-session-state/v2";
  portableContract?: T3BrowserPortableLoginStateContract;
  portableCrypto?: T3BrowserPortableLoginStateCrypto;
  stateByteCount?: number;
  stateFileCount?: number;
  summary: string;
};

export type T3BrowserStaticDataBundle = {
  exportedAt: number;
  payload: T3BrowserStaticDataBundlePayload;
  payloadPolicy: T3BrowserStaticDataPayloadPolicy;
  schemaVersion: T3BrowserStaticDataSchemaVersion;
  summary: string;
};

export type T3BrowserStaticDataImportResult = {
  importedCounts: Record<keyof T3BrowserStaticDataBundlePayload, number>;
  loginStateBundles: T3BrowserEncryptedLoginStateBundle[];
  profiles: T3BrowserProfileDescriptor[];
  summary: string;
};

export type T3BrowserLoginStatePreflightStatus = "loggedIn" | "notLoggedIn" | "unknown";

export type T3BrowserLoginStatePreflightResult = {
  allowedOrigins: string[];
  cookieCount: number;
  originCount: number;
  provider: "chatgpt";
  status: T3BrowserLoginStatePreflightStatus;
  storageFileCount: number;
  summary: string;
};

export type T3BrowserStaticDataLoginStateImportResult = {
  importedCookies: number;
  originCount: number;
  restoredBytes: number;
  restoredFiles: number;
  success: boolean;
  summary: string | null;
};

export type T3BrowserStaticDataExportWitness = {
  cookieCount: number;
  originCount: number;
  portableVersion: string;
  provider: "chatgpt";
  storageFileCount: number;
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
  checkLoginState?: (input?: {
    allowedOrigins?: readonly string[];
  }) => Promise<T3BrowserLoginStatePreflightResult | null>;
  exportLoginState?: (input?: {
    allowedOrigins?: readonly string[];
    importSecret?: string;
  }) => Promise<T3BrowserEncryptedLoginStateBundle | null>;
  exportToChrome?: (input: { targetUrl: string }) => Promise<T3BrowserChromeSiteDataExportResult>;
  importLoginState?: (
    bundle: T3BrowserEncryptedLoginStateBundle,
    input?: { importSecret?: string }
  ) => Promise<T3BrowserStaticDataLoginStateImportResult>;
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

function normalizeLoginStatePreflightStatus(value: unknown): T3BrowserLoginStatePreflightStatus {
  return value === "loggedIn" || value === "notLoggedIn" || value === "unknown" ? value : "unknown";
}

function normalizeLoginStatePreflightResult(
  value: unknown
): T3BrowserLoginStatePreflightResult | null {
  if (!isRecord(value) || value.provider !== "chatgpt") {
    return null;
  }
  const allowedOrigins = normalizeT3BrowserAllowedOrigins(value.allowedOrigins);
  const cookieCount = readNumber(value.cookieCount) ?? 0;
  const originCount = readNumber(value.originCount) ?? 0;
  const storageFileCount = readNumber(value.storageFileCount) ?? 0;
  const status = normalizeLoginStatePreflightStatus(value.status);
  return {
    allowedOrigins,
    cookieCount,
    originCount,
    provider: "chatgpt",
    status,
    storageFileCount,
    summary:
      readText(value.summary) ??
      (status === "loggedIn"
        ? `ChatGPT login preflight found ${cookieCount} allowlisted cookies across ${originCount} origins.`
        : "ChatGPT login preflight did not find allowlisted login state."),
  };
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

function normalizePortableLoginStateContract(
  value: unknown
): T3BrowserPortableLoginStateContract | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  if (
    value.algorithm !== "AES-256-GCM" ||
    value.credentialMode !== "import-code" ||
    value.importSecretRequired !== true ||
    value.kdf !== "PBKDF2-SHA256" ||
    value.payloadEncoding !== "json" ||
    value.rawCredentialPolicy !== "forbidden"
  ) {
    return undefined;
  }
  const kdfIterations = readNumber(value.kdfIterations);
  return buildT3BrowserPortableLoginStateContract({
    allowedOrigins: normalizeT3BrowserAllowedOrigins(value.allowedOrigins),
    kdfIterations: kdfIterations && kdfIterations >= 100_000 ? kdfIterations : undefined,
  });
}

function normalizePortableLoginStateCrypto(
  value: unknown
): T3BrowserPortableLoginStateCrypto | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const authTagBase64 = readText(value.authTagBase64);
  const ivBase64 = readText(value.ivBase64);
  const saltBase64 = readText(value.saltBase64);
  return authTagBase64 && ivBase64 && saltBase64
    ? { authTagBase64, ivBase64, saltBase64 }
    : undefined;
}

function normalizeEncryptedLoginStateBundle(
  value: unknown
): T3BrowserEncryptedLoginStateBundle | null {
  if (!isRecord(value)) return null;
  const id = readText(value.id);
  const encryptedPayloadBase64 = readText(value.encryptedPayloadBase64);
  if (!id || !encryptedPayloadBase64) return null;
  const encryption = isT3BrowserPortableLoginStateEncryption(value.encryption)
    ? T3_BROWSER_PORTABLE_ENCRYPTION
    : isT3BrowserHostBoundLoginStateEncryption(value.encryption)
      ? T3_BROWSER_SAFE_STORAGE_ENCRYPTION
      : null;
  if (!encryption) return null;
  const portableContract =
    encryption === T3_BROWSER_PORTABLE_ENCRYPTION
      ? normalizePortableLoginStateContract(value.portableContract)
      : undefined;
  const portableCrypto =
    encryption === T3_BROWSER_PORTABLE_ENCRYPTION
      ? normalizePortableLoginStateCrypto(value.portableCrypto)
      : undefined;
  if (encryption === T3_BROWSER_PORTABLE_ENCRYPTION && (!portableContract || !portableCrypto)) {
    return null;
  }
  return {
    cookieCount: readNumber(value.cookieCount) ?? 0,
    createdAt: readNumber(value.createdAt) ?? Date.now(),
    encryptedPayloadBase64,
    encryption,
    id,
    originCount: readNumber(value.originCount) ?? 0,
    payloadFormat:
      value.payloadFormat === "electron-session-state/v2"
        ? "electron-session-state/v2"
        : "electron-session-cookies/v1",
    portableContract,
    portableCrypto,
    stateByteCount: readNumber(value.stateByteCount) ?? undefined,
    stateFileCount: readNumber(value.stateFileCount) ?? undefined,
    summary:
      readText(value.summary) ??
      (encryption === T3_BROWSER_PORTABLE_ENCRYPTION
        ? "Portable ChatGPT browser account state."
        : "Host-encrypted Electron browser session state."),
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

function emptyStaticDataPayload(): T3BrowserStaticDataBundlePayload {
  return {
    aiGatewayRoutes: [],
    guestPasses: [],
    hugerouterListings: [],
    hugerouterOrders: [],
    isolatedApps: [],
    loginStateBundles: [],
    migrationRecords: {},
    recentSessions: [],
    remoteProfiles: [],
    seatPools: [],
    syncRecords: {},
  };
}

function getDesktopBrowserStaticDataBridge() {
  const desktopWindow = window as Window & {
    hugeCodeDesktopHost?: { browserStaticData?: DesktopBrowserStaticDataBridgeGlobal };
  };
  return desktopWindow.hugeCodeDesktopHost?.browserStaticData ?? null;
}

export async function checkT3BrowserChatGptLoginState(): Promise<T3BrowserLoginStatePreflightResult> {
  const checkLoginState = getDesktopBrowserStaticDataBridge()?.checkLoginState;
  if (!checkLoginState) {
    return {
      allowedOrigins: normalizeT3BrowserAllowedOrigins(null),
      cookieCount: 0,
      originCount: 0,
      provider: "chatgpt",
      status: "unknown",
      storageFileCount: 0,
      summary: "This host cannot inspect the built-in ChatGPT browser login state before export.",
    };
  }
  const result = normalizeLoginStatePreflightResult(
    await checkLoginState({ allowedOrigins: normalizeT3BrowserAllowedOrigins(null) })
  );
  if (!result) {
    return {
      allowedOrigins: normalizeT3BrowserAllowedOrigins(null),
      cookieCount: 0,
      originCount: 0,
      provider: "chatgpt",
      status: "unknown",
      storageFileCount: 0,
      summary: "ChatGPT login preflight returned an unsupported result.",
    };
  }
  return result;
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
    payloadPolicy: T3_BROWSER_HOST_BOUND_PAYLOAD_POLICY,
    schemaVersion: T3_BROWSER_STATIC_DATA_SCHEMA_VERSION_V1,
    summary:
      "Static HugeCode browser data bundle. Browser session state is included only as host-encrypted browser state.",
  };
}

export async function buildT3BrowserStaticDataBundleWithLoginState(input?: {
  importSecret?: string;
}): Promise<T3BrowserStaticDataBundle> {
  const bundle = buildT3BrowserStaticDataBundle();
  const loginStateBundle = await getDesktopBrowserStaticDataBridge()?.exportLoginState?.({
    allowedOrigins: normalizeT3BrowserAllowedOrigins(null),
    importSecret: input?.importSecret,
  });
  const normalizedLoginStateBundle = normalizeEncryptedLoginStateBundle(loginStateBundle);
  if (!normalizedLoginStateBundle) {
    throw new Error("No portable ChatGPT account data was exported from the built-in browser.");
  }
  if (normalizedLoginStateBundle.encryption === T3_BROWSER_PORTABLE_ENCRYPTION) {
    return {
      exportedAt: bundle.exportedAt,
      payload: {
        ...emptyStaticDataPayload(),
        loginStateBundles: [normalizedLoginStateBundle],
      },
      payloadPolicy: T3_BROWSER_PORTABLE_PAYLOAD_POLICY,
      schemaVersion: T3_BROWSER_STATIC_DATA_SCHEMA_VERSION_V2,
      summary:
        "Portable HugeCode ChatGPT account data file. Restore requires the matching import code.",
    };
  }
  return {
    ...bundle,
    payload: { ...bundle.payload, loginStateBundles: [normalizedLoginStateBundle] },
    summary: "Static HugeCode browser data bundle with host-encrypted Electron session state.",
  };
}

export function buildT3BrowserStaticDataExportWitness(
  bundle: T3BrowserStaticDataBundle
): T3BrowserStaticDataExportWitness {
  const loginStateBundle = bundle.payload.loginStateBundles[0];
  if (
    bundle.schemaVersion !== T3_BROWSER_STATIC_DATA_SCHEMA_VERSION_V2 ||
    bundle.payloadPolicy !== T3_BROWSER_PORTABLE_PAYLOAD_POLICY ||
    !loginStateBundle ||
    loginStateBundle.encryption !== T3_BROWSER_PORTABLE_ENCRYPTION ||
    !loginStateBundle.portableContract
  ) {
    throw new Error("Portable ChatGPT account data export did not produce a valid witness.");
  }
  const witness = {
    cookieCount: loginStateBundle.cookieCount,
    originCount: loginStateBundle.originCount,
    portableVersion: loginStateBundle.portableContract.schemaVersion,
    provider: "chatgpt" as const,
    storageFileCount: loginStateBundle.stateFileCount ?? 0,
  };
  return {
    ...witness,
    summary: `Exported ${witness.provider} account file ${witness.portableVersion}: ${witness.cookieCount} cookies, ${witness.storageFileCount} storage files, ${witness.originCount} origins.`,
  };
}

export function serializeT3BrowserStaticDataBundle(
  bundle = buildT3BrowserStaticDataBundle()
): string {
  return `${JSON.stringify(bundle, null, 2)}\n`;
}

export async function serializeT3BrowserStaticDataBundleWithLoginState(input?: {
  importSecret?: string;
}): Promise<string> {
  return serializeT3BrowserStaticDataBundle(
    await buildT3BrowserStaticDataBundleWithLoginState(input)
  );
}

export async function serializeT3BrowserStaticDataBundleWithPromptedLoginState(): Promise<string> {
  return serializeT3BrowserStaticDataBundleWithLoginState({
    importSecret: requestT3BrowserAccountDataImportSecret({
      message: "Create an import code for this portable ChatGPT account data file.",
    }),
  });
}

export function importT3BrowserStaticDataBundle(
  serializedBundle: string
): T3BrowserStaticDataImportResult {
  const parsed = JSON.parse(serializedBundle) as unknown;
  if (!isRecord(parsed)) {
    throw new Error("Browser data import file must be a JSON object.");
  }
  const bundle = parsed as Partial<T3BrowserStaticDataBundle>;
  if (
    bundle.schemaVersion !== T3_BROWSER_STATIC_DATA_SCHEMA_VERSION_V1 &&
    bundle.schemaVersion !== T3_BROWSER_STATIC_DATA_SCHEMA_VERSION_V2
  ) {
    throw new Error("Unsupported browser data import schema.");
  }
  if (
    bundle.payloadPolicy !== T3_BROWSER_METADATA_ONLY_PAYLOAD_POLICY &&
    bundle.payloadPolicy !== T3_BROWSER_HOST_BOUND_PAYLOAD_POLICY &&
    bundle.payloadPolicy !== T3_BROWSER_PORTABLE_PAYLOAD_POLICY
  ) {
    throw new Error("Browser data import must declare a supported credential policy.");
  }
  if (
    bundle.schemaVersion === T3_BROWSER_STATIC_DATA_SCHEMA_VERSION_V2 &&
    bundle.payloadPolicy !== T3_BROWSER_PORTABLE_PAYLOAD_POLICY
  ) {
    throw new Error("Portable browser account data files must use the portable payload policy.");
  }
  const payload = normalizeStaticDataPayload(bundle.payload);
  if (
    bundle.schemaVersion === T3_BROWSER_STATIC_DATA_SCHEMA_VERSION_V2 &&
    payload.loginStateBundles.length === 0
  ) {
    throw new Error("Portable browser account data file does not contain login state.");
  }
  if (bundle.schemaVersion === T3_BROWSER_STATIC_DATA_SCHEMA_VERSION_V2) {
    const importedCounts: T3BrowserStaticDataImportResult["importedCounts"] = {
      aiGatewayRoutes: 0,
      guestPasses: 0,
      hugerouterListings: 0,
      hugerouterOrders: 0,
      isolatedApps: 0,
      loginStateBundles: payload.loginStateBundles.length,
      migrationRecords: 0,
      recentSessions: 0,
      remoteProfiles: 0,
      seatPools: 0,
      syncRecords: 0,
    };
    return {
      importedCounts,
      loginStateBundles: payload.loginStateBundles,
      profiles: [currentBrowserProfile(), ...readJsonArray(STORAGE_KEY, normalizeRemoteProfile)],
      summary: `Loaded ${payload.loginStateBundles.length} portable ChatGPT account data bundle for restore.`,
    };
  }
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
  bundles: readonly T3BrowserEncryptedLoginStateBundle[],
  input?: { importSecret?: string }
): Promise<T3BrowserStaticDataLoginStateImportResult> {
  if (bundles.length === 0) {
    return {
      importedCookies: 0,
      originCount: 0,
      restoredBytes: 0,
      restoredFiles: 0,
      success: false,
      summary: null,
    };
  }
  if (
    bundles.some((bundle) => bundle.encryption === T3_BROWSER_PORTABLE_ENCRYPTION) &&
    !input?.importSecret?.trim()
  ) {
    throw new Error("Import code is required to restore portable browser account data.");
  }
  const importLoginState = getDesktopBrowserStaticDataBridge()?.importLoginState;
  if (!importLoginState) {
    return {
      importedCookies: 0,
      originCount: 0,
      restoredBytes: 0,
      restoredFiles: 0,
      success: false,
      summary: "Imported metadata, but this host cannot restore portable browser account data.",
    };
  }
  let importedCookies = 0;
  let originCount = 0;
  let restoredFiles = 0;
  let restoredBytes = 0;
  for (const bundle of bundles) {
    const result = await importLoginState(bundle, { importSecret: input?.importSecret });
    if (!result.success) {
      throw new Error(result.summary ?? "Portable browser account data restore failed.");
    }
    importedCookies += result.importedCookies;
    originCount += result.originCount;
    restoredFiles += result.restoredFiles;
    restoredBytes += result.restoredBytes;
  }
  const success = importedCookies > 0 || restoredFiles > 0;
  if (!success) {
    return {
      importedCookies,
      originCount,
      restoredBytes,
      restoredFiles,
      success: false,
      summary: "No browser login state was restored from the account data file.",
    };
  }
  if (restoredFiles > 0) {
    return {
      importedCookies,
      originCount,
      restoredBytes,
      restoredFiles,
      success: true,
      summary: `Restored ${importedCookies} encrypted login cookies and ${restoredFiles} local browser files (${restoredBytes} bytes) across ${originCount} origins.`,
    };
  }
  return {
    importedCookies,
    originCount,
    restoredBytes,
    restoredFiles,
    success: true,
    summary: `Restored ${importedCookies} encrypted login cookies across ${originCount} origins.`,
  };
}

export function t3BrowserLoginStateBundlesNeedImportSecret(
  bundles: readonly T3BrowserEncryptedLoginStateBundle[]
) {
  return bundles.some((bundle) => bundle.encryption === T3_BROWSER_PORTABLE_ENCRYPTION);
}

export async function importT3BrowserStaticDataLoginStateBundlesWithPrompt(
  bundles: readonly T3BrowserEncryptedLoginStateBundle[]
): Promise<T3BrowserStaticDataLoginStateImportResult> {
  return importT3BrowserStaticDataLoginStateBundles(bundles, {
    importSecret: requestT3BrowserAccountDataImportSecret({
      bundles,
      message: "Enter the import code for this ChatGPT account data file.",
    }),
  });
}

export function formatT3BrowserStaticDataImportError(error: unknown): string {
  const message =
    error instanceof Error ? error.message : "Unable to import browser account data file.";
  return message
    .replace(/[A-Za-z0-9+/=]{32,}/gu, "[redacted]")
    .replace(/(import code\s*(?:is|was|:)?\s*)[^\s.]+/giu, "$1[redacted]");
}

export function requireT3BrowserAccountDataImportSecret(
  value: string,
  action: "Export" | "Import"
) {
  const importSecret = value.trim();
  if (importSecret.length < 8) {
    throw new Error(`${action} requires an import code with at least 8 characters.`);
  }
  return importSecret;
}

export function requestT3BrowserAccountDataImportSecret(input: {
  bundles?: readonly T3BrowserEncryptedLoginStateBundle[];
  message: string;
}) {
  if (input.bundles && !t3BrowserLoginStateBundlesNeedImportSecret(input.bundles)) {
    return undefined;
  }
  const importSecret = window.prompt(input.message)?.trim();
  if (!importSecret || importSecret.length < 8) {
    throw new Error("Import code must contain at least 8 characters.");
  }
  return importSecret;
}
