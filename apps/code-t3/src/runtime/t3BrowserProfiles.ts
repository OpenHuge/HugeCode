import type { OpenT3BrowserProviderInput, T3BrowserProvider } from "./t3BrowserProfileTypes";

export type { OpenT3BrowserProviderInput, T3BrowserProvider } from "./t3BrowserProfileTypes";

export type T3BrowserProfileSource = "current-browser" | "remote-devtools";

export type T3BrowserProfileStatus = "available" | "connected" | "blocked";

export type T3BrowserFingerprintPolicy = "native-transparent";

export type T3BrowserProfileDescriptor = {
  endpointUrl: string | null;
  fingerprintPolicy: T3BrowserFingerprintPolicy;
  id: string;
  label: string;
  providerIds: T3BrowserProvider[];
  securityModel: "current-browser-session" | "remote-devtools-reference";
  source: T3BrowserProfileSource;
  status: T3BrowserProfileStatus;
  statusMessage: string;
};

export type T3BrowserRecentSession = {
  fingerprintPolicy: T3BrowserFingerprintPolicy;
  id: string;
  isolatedAppId: string | null;
  isolatedAppLabel: string | null;
  openedAt: number;
  profileId: string;
  profileLabel: string;
  providerId: T3BrowserProvider;
  siteId: string;
  siteLabel: string;
  siteOrigin: string;
  title: string;
  url: string;
};

export type T3BrowserProfileSyncState = {
  accountPortability: "remote-session" | "local-only";
  backend: "local-mock-hugerouter";
  credentialPayload: "blocked";
  deviceCount: number;
  deviceLimit: number | null;
  devicePolicy: "web-unbounded-mock";
  lastSyncedAt: number | null;
  membershipAccountUsable: boolean;
  profileId: string;
  profileLabel: string;
  remoteSessionAvailable: boolean;
  status: "idle" | "synced";
  summary: string;
};

export type T3BrowserProfileMigrationStatus =
  | "available"
  | "in-use"
  | "syncing"
  | "conflict"
  | "stale-lock";

export type T3BrowserProfileStateClass =
  | "cookies"
  | "local-storage"
  | "indexed-db"
  | "cache-storage"
  | "service-worker"
  | "extension-data"
  | "bookmarks"
  | "history"
  | "site-settings"
  | "environment-config";

export type T3BrowserProfileMigrationLock = {
  acquiredAt: number;
  deviceName: string;
  mode: "read-write";
};

export type T3BrowserProfileVersionSnapshot = {
  createdAt: number;
  id: string;
  payloadPolicy: "host-managed-encrypted";
  sourceDeviceName: string;
  stateClasses: readonly T3BrowserProfileStateClass[];
  summary: string;
  versionNumber: number;
};

export type T3BrowserProfileMigrationAuditEntry = {
  action: "open" | "sync-close" | "force-takeover" | "restore-version";
  actorDeviceName: string;
  createdAt: number;
  id: string;
  previousDeviceName: string | null;
  summary: string;
};

export type T3BrowserProfileMigrationState = {
  auditLog: readonly T3BrowserProfileMigrationAuditEntry[];
  credentialPayload: "blocked";
  currentDeviceName: string | null;
  lastSourceDeviceName: string | null;
  lastSyncedAt: number | null;
  latestVersionId: string | null;
  latestVersionNumber: number;
  lock: T3BrowserProfileMigrationLock | null;
  profileId: string;
  profileLabel: string;
  snapshots: readonly T3BrowserProfileVersionSnapshot[];
  stateClasses: readonly T3BrowserProfileStateClass[];
  status: T3BrowserProfileMigrationStatus;
  summary: string;
  syncPayload: "host-managed-encrypted";
};

export type T3BrowserProductContinuity = {
  accountPortability: T3BrowserProfileSyncState["accountPortability"];
  credentialPayload: "blocked";
  deviceCount: number;
  deviceLimit: number | null;
  devicePolicy: T3BrowserProfileSyncState["devicePolicy"];
  fingerprintPolicy: T3BrowserFingerprintPolicy;
  launchMode: "local-session-only" | "remote-session-handoff";
  profileId: string;
  profileLabel: string;
  recentProductSessions: readonly T3BrowserRecentSession[];
  remoteSessionAvailable: boolean;
  siteId: string;
  siteLabel: string;
  siteOrigin: string;
  status: "needs-sync" | "ready";
  summary: string;
};

export type T3BrowserGuestPassStatus = "active" | "expired" | "revoked";

export type T3BrowserGuestPass = {
  auditMode: "owner-visible";
  createdAt: number;
  credentialPayload: "blocked";
  expiresAt: number;
  guestLabel: string;
  id: string;
  inviteCode: string;
  ownerApproval: "required-for-sensitive-actions";
  permissionMode: "supervised-use";
  profileId: string;
  profileLabel: string;
  providerId: T3BrowserProvider;
  revokedAt: number | null;
  sensitiveActionsBlocked: readonly string[];
  siteId: string;
  siteLabel: string;
  siteOrigin: string;
  status: T3BrowserGuestPassStatus;
  summary: string;
};

export type T3BrowserSeatPoolMemberStatus = "active" | "paused";

export type T3BrowserMembershipPlanType =
  | "chatgpt-plus"
  | "chatgpt-pro-5x"
  | "chatgpt-pro-20x"
  | "gemini-advanced"
  | "gemini-pro"
  | "gemini-ultra"
  | "hugerouter-starter"
  | "hugerouter-pro"
  | "hugerouter-scale";

export type T3SeatPoolRentalPlatform = "chatgpt" | "gemini" | "claude" | "hugerouter";

export type T3SeatPoolPlatformRental = {
  discountPriceCents: number;
  enabled: boolean;
  settlementMode: "hugerouter-platform-rental-mock";
  supportedPlatforms: readonly T3SeatPoolRentalPlatform[];
};

export type T3BrowserSeatPoolCommercial = {
  billingPeriod: "monthly";
  currency: "USD";
  listingStatus: "draft" | "listed";
  planLabel: string;
  planType: T3BrowserMembershipPlanType;
  platformRental: T3SeatPoolPlatformRental;
  seatPriceCents: number;
  serviceMultiplier: "1x" | "5x" | "20x";
};

export type T3BrowserSeatPoolMember = {
  createdAt: number;
  guestPassId: string;
  id: string;
  inviteCode: string;
  label: string;
  lastUsedAt: number | null;
  seatNumber: number;
  status: T3BrowserSeatPoolMemberStatus;
};

export type T3BrowserSeatPool = {
  commercial: T3BrowserSeatPoolCommercial;
  complianceMode: "policy-deferred" | "hugerouter-native-supported";
  concurrencyMode: "policy-deferred" | "hugerouter-native-supported";
  credentialPayload: "blocked";
  id: string;
  memberCount: number;
  members: readonly T3BrowserSeatPoolMember[];
  ownerApproval: "required-for-sensitive-actions";
  profileId: string;
  profileLabel: string;
  providerId: Exclude<T3BrowserProvider, "custom">;
  seatLimit: number | null;
  sensitiveActionsBlocked: readonly string[];
  siteId: string;
  siteLabel: string;
  siteOrigin: string;
  summary: string;
};

export type T3BrowserSeatPoolListing = {
  availableSeats: number | null;
  commercial: T3BrowserSeatPoolCommercial;
  memberCount: number;
  poolId: string;
  profileId: string;
  profileLabel: string;
  providerId: Exclude<T3BrowserProvider, "custom">;
  seatLimit: number | null;
  siteId: string;
  siteLabel: string;
  siteOrigin: string;
};

export type T3AiGatewayRouteMode = "official-api" | "local-cli" | "supervised-session";

export type T3AiGatewayRouteStatus = "routable" | "review-required";

export type T3AiGatewayRoute = {
  createdAt: number;
  credentialPayload: "blocked";
  id: string;
  maxConcurrentTasks: number;
  ownerLabel: string;
  planLabel: string;
  planType: T3BrowserMembershipPlanType;
  providerId: Exclude<T3BrowserProvider, "custom">;
  requestBudgetPerDay: number;
  routable: boolean;
  routeMode: T3AiGatewayRouteMode;
  serviceMultiplier: T3BrowserSeatPoolCommercial["serviceMultiplier"];
  status: T3AiGatewayRouteStatus;
  summary: string;
};

export type T3AiGatewaySummary = {
  complianceStatus: "ready" | "review-required";
  maxConcurrentTasks: number;
  requestBudgetPerDay: number;
  routeCount: number;
  routableRouteCount: number;
};

export type T3HugerouterMembershipTier =
  | "hugerouter-starter"
  | "hugerouter-pro"
  | "hugerouter-scale";

export type T3HugerouterCapacitySource = "hugerouter-native-credits" | "provider-authorized-pool";

export type T3HugerouterCapacityListing = {
  availableCredits: number;
  createdAt: number;
  credentialPayload: "blocked";
  id: string;
  minPurchaseCredits: number;
  sellerLabel: string;
  serviceDelivery: "hugerouter-relay-mock";
  settlementMode: "mock-escrow";
  sourceKind: T3HugerouterCapacitySource;
  status: "listed" | "sold-out";
  summary: string;
  tier: T3HugerouterMembershipTier;
  tierLabel: string;
  totalCredits: number;
  unitPriceCentsPerThousand: number;
};

export type T3HugerouterCapacityOrder = {
  buyerLabel: string;
  createdAt: number;
  credentialPayload: "blocked";
  creditsPurchased: number;
  escrowStatus: "held" | "released" | "refunded";
  id: string;
  listingId: string;
  platformFeeCents: number;
  sellerReceivesCents: number;
  sellerLabel: string;
  serviceDelivery: "hugerouter-relay-mock";
  serviceRelayStatus: "provisioned" | "settled" | "refunded";
  status: "escrow-held" | "settled" | "refunded";
  tierLabel: string;
  totalPriceCents: number;
  unitPriceCentsPerThousand: number;
};

export type T3BrowserIsolatedApp = {
  appKey: string;
  createdAt: number;
  credentialPayload: "blocked";
  id: string;
  isolationMode: "local-mock-app-scope";
  label: string;
  lastOpenedAt: number | null;
  launchCount: number;
  profileId: string;
  profileLabel: string;
  providerId: T3BrowserProvider;
  siteId: string;
  siteLabel: string;
  siteOrigin: string;
  storageBoundary: "electron-partition-pending";
  targetUrl: string;
};

export type T3HugerouterSiteScope = {
  siteId: string;
  siteLabel: string;
  siteOrigin: string;
};

export type T3BrowserFingerprintSummary = {
  browserFamily: string;
  deviceClass: "desktop" | "mobile" | "unknown";
  disclosure: string;
  language: string;
  policy: T3BrowserFingerprintPolicy;
  stability: "native" | "remote-reference";
  timezone: string;
};

export type SaveT3RemoteBrowserProfileInput = {
  endpointUrl: string;
  label?: string | null;
};

export type T3BrowserProfileBridge = {
  listProfiles(): Promise<T3BrowserProfileDescriptor[]>;
  openProvider(input: OpenT3BrowserProviderInput): Promise<T3BrowserProfileDescriptor>;
  removeProfile(profileId: string): Promise<T3BrowserProfileDescriptor[]>;
  saveRemoteProfile(input: SaveT3RemoteBrowserProfileInput): Promise<T3BrowserProfileDescriptor[]>;
};

type BrowserProfileBridgeGlobal = Partial<T3BrowserProfileBridge>;
declare global {
  interface Window {
    __HUGECODE_T3_BROWSER_PROFILES__?: BrowserProfileBridgeGlobal;
  }
}

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
const GUEST_PASS_BLOCKED_ACTIONS = [
  "account-settings",
  "billing",
  "password-change",
  "payment-methods",
  "security-settings",
  "credential-export",
] as const;
const PROVIDER_URLS = {
  chatgpt: "https://chatgpt.com/",
  gemini: "https://gemini.google.com/app",
  hugerouter: "https://hugerouter.openhuge.local/",
} as const satisfies Record<Exclude<T3BrowserProvider, "custom">, string>;
const PROVIDERS: T3BrowserProvider[] = ["hugerouter", "chatgpt", "gemini", "custom"];
const PROFILE_MIGRATION_STATE_CLASSES: readonly T3BrowserProfileStateClass[] = [
  "cookies",
  "local-storage",
  "indexed-db",
  "cache-storage",
  "service-worker",
  "extension-data",
  "bookmarks",
  "history",
  "site-settings",
  "environment-config",
];
export const T3_BROWSER_MEMBERSHIP_PLAN_OPTIONS = {
  "chatgpt-plus": {
    planLabel: "ChatGPT Plus",
    providerId: "chatgpt",
    serviceMultiplier: "1x",
  },
  "chatgpt-pro-5x": {
    planLabel: "ChatGPT Pro 5x",
    providerId: "chatgpt",
    serviceMultiplier: "5x",
  },
  "chatgpt-pro-20x": {
    planLabel: "ChatGPT Pro 20x",
    providerId: "chatgpt",
    serviceMultiplier: "20x",
  },
  "gemini-advanced": {
    planLabel: "Gemini Advanced",
    providerId: "gemini",
    serviceMultiplier: "1x",
  },
  "gemini-pro": {
    planLabel: "Gemini Pro",
    providerId: "gemini",
    serviceMultiplier: "5x",
  },
  "gemini-ultra": {
    planLabel: "Gemini Ultra",
    providerId: "gemini",
    serviceMultiplier: "20x",
  },
  "hugerouter-starter": {
    planLabel: "Hugerouter Starter",
    providerId: "hugerouter",
    serviceMultiplier: "1x",
  },
  "hugerouter-pro": {
    planLabel: "Hugerouter Pro",
    providerId: "hugerouter",
    serviceMultiplier: "5x",
  },
  "hugerouter-scale": {
    planLabel: "Hugerouter Scale",
    providerId: "hugerouter",
    serviceMultiplier: "20x",
  },
} as const satisfies Record<
  T3BrowserMembershipPlanType,
  {
    planLabel: string;
    providerId: Exclude<T3BrowserProvider, "custom">;
    serviceMultiplier: T3BrowserSeatPoolCommercial["serviceMultiplier"];
  }
>;
export const T3_SEAT_POOL_RENTAL_PLATFORM_OPTIONS = {
  chatgpt: {
    label: "ChatGPT",
  },
  gemini: {
    label: "Gemini",
  },
  claude: {
    label: "Claude",
  },
  hugerouter: {
    label: "Hugerouter",
  },
} as const satisfies Record<
  T3SeatPoolRentalPlatform,
  {
    label: string;
  }
>;
export const T3_AI_GATEWAY_ROUTE_MODE_OPTIONS = {
  "official-api": {
    label: "Official API",
    summary: "Routable organization-approved API capacity.",
  },
  "local-cli": {
    label: "Local CLI",
    summary: "Routable local Codex or Claude CLI capacity.",
  },
  "supervised-session": {
    label: "Supervised session",
    summary: "Owner-supervised third-party browser session, not shared-account fan-out.",
  },
} as const satisfies Record<
  T3AiGatewayRouteMode,
  {
    label: string;
    summary: string;
  }
>;
export const T3_HUGEROUTER_MEMBERSHIP_TIER_OPTIONS = {
  "hugerouter-starter": {
    includedCredits: 100_000,
    label: "Hugerouter Starter",
    multiplier: "1x",
  },
  "hugerouter-pro": {
    includedCredits: 1_000_000,
    label: "Hugerouter Pro",
    multiplier: "5x",
  },
  "hugerouter-scale": {
    includedCredits: 5_000_000,
    label: "Hugerouter Scale",
    multiplier: "20x",
  },
} as const satisfies Record<
  T3HugerouterMembershipTier,
  {
    includedCredits: number;
    label: string;
    multiplier: "1x" | "5x" | "20x";
  }
>;

function browserFamilyFromUserAgent(userAgent: string) {
  if (/edg\//iu.test(userAgent)) {
    return "Edge";
  }
  if (/firefox\//iu.test(userAgent)) {
    return "Firefox";
  }
  if (/chrome|chromium/iu.test(userAgent)) {
    return "Chromium";
  }
  if (/safari/iu.test(userAgent)) {
    return "Safari";
  }
  return "Browser";
}

function deviceClassFromUserAgent(userAgent: string): T3BrowserFingerprintSummary["deviceClass"] {
  if (/mobile|iphone|android/iu.test(userAgent)) {
    return "mobile";
  }
  if (/macintosh|windows|linux|x11/iu.test(userAgent)) {
    return "desktop";
  }
  return "unknown";
}

function readText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeEndpointUrl(value: string): string {
  const parsed = new URL(value);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Remote browser profile endpoint must use http or https.");
  }
  if (parsed.username || parsed.password) {
    throw new Error("Remote browser profile endpoint must not include credentials.");
  }
  if (parsed.protocol === "http:" && !isLoopbackHost(parsed.hostname)) {
    throw new Error("Plain-http remote browser endpoints are only allowed for loopback hosts.");
  }
  parsed.hash = "";
  parsed.search = "";
  parsed.pathname = parsed.pathname.replace(/\/+$/u, "");
  return parsed.toString().replace(/\/+$/u, "");
}

function safeNormalizeEndpointUrl(value: string | null) {
  if (!value) {
    return null;
  }
  try {
    return normalizeEndpointUrl(value);
  } catch {
    return null;
  }
}

function normalizeProductUrl(value: string): string {
  const parsed = new URL(value);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Web product URL must use http or https.");
  }
  if (parsed.username || parsed.password) {
    throw new Error("Web product URL must not include embedded credentials.");
  }
  return parsed.toString();
}

function safeNormalizeProductUrl(value: string | null) {
  if (!value) {
    return null;
  }
  try {
    return normalizeProductUrl(value);
  } catch {
    return null;
  }
}

export function buildT3HugerouterSiteScope(url: string): T3HugerouterSiteScope {
  const parsed = new URL(normalizeProductUrl(url));
  const siteOrigin = parsed.origin;
  return {
    siteId: siteOrigin,
    siteLabel: parsed.hostname,
    siteOrigin,
  };
}

function safeT3HugerouterSiteScope(url: string | null) {
  if (!url) {
    return null;
  }
  try {
    return buildT3HugerouterSiteScope(url);
  } catch {
    return null;
  }
}

function providerDisplayName(providerId: T3BrowserProvider) {
  if (providerId === "chatgpt") {
    return "ChatGPT";
  }
  if (providerId === "gemini") {
    return "Gemini";
  }
  if (providerId === "hugerouter") {
    return "Hugerouter";
  }
  return "Custom";
}

function isKnownBrowserProvider(value: unknown): value is Exclude<T3BrowserProvider, "custom"> {
  return value === "chatgpt" || value === "gemini" || value === "hugerouter";
}

function isBrowserProvider(value: unknown): value is T3BrowserProvider {
  return isKnownBrowserProvider(value) || value === "custom";
}

function resolveSiteScope(input: {
  customUrl?: string | null;
  providerId: T3BrowserProvider;
}): T3HugerouterSiteScope {
  if (input.providerId === "custom") {
    const customUrl = readText(input.customUrl);
    if (!customUrl) {
      throw new Error("Enter a site URL before creating Hugerouter-managed website data.");
    }
    return buildT3HugerouterSiteScope(customUrl);
  }
  return buildT3HugerouterSiteScope(PROVIDER_URLS[input.providerId]);
}

function defaultPlanTypeForProvider(
  providerId: Exclude<T3BrowserProvider, "custom">
): T3BrowserMembershipPlanType {
  if (providerId === "chatgpt") {
    return "chatgpt-plus";
  }
  if (providerId === "gemini") {
    return "gemini-advanced";
  }
  return "hugerouter-pro";
}

function normalizeMembershipPlanType(
  value: unknown,
  providerId: Exclude<T3BrowserProvider, "custom">
): T3BrowserMembershipPlanType {
  if (typeof value === "string" && value in T3_BROWSER_MEMBERSHIP_PLAN_OPTIONS) {
    const planType = value as T3BrowserMembershipPlanType;
    if (T3_BROWSER_MEMBERSHIP_PLAN_OPTIONS[planType].providerId === providerId) {
      return planType;
    }
  }
  return defaultPlanTypeForProvider(providerId);
}

function buildCommercialDefaults(
  providerId: Exclude<T3BrowserProvider, "custom">,
  planType = defaultPlanTypeForProvider(providerId)
): T3BrowserSeatPoolCommercial {
  const plan = T3_BROWSER_MEMBERSHIP_PLAN_OPTIONS[planType];
  const seatPriceCents =
    plan.serviceMultiplier === "20x" ? 2999 : plan.serviceMultiplier === "5x" ? 1499 : 799;
  return {
    billingPeriod: "monthly",
    currency: "USD",
    listingStatus: "draft",
    planLabel: plan.planLabel,
    planType,
    platformRental: {
      discountPriceCents: Math.max(Math.floor(seatPriceCents * 0.8), 1),
      enabled: false,
      settlementMode: "hugerouter-platform-rental-mock",
      supportedPlatforms: [providerId],
    },
    seatPriceCents,
    serviceMultiplier: plan.serviceMultiplier,
  };
}

function normalizeSeatPriceCents(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return Math.min(Math.max(Math.round(value), 0), 999_999);
}

function normalizeRentalPlatforms(value: unknown, fallback: T3SeatPoolRentalPlatform[]) {
  if (!Array.isArray(value)) {
    return fallback;
  }
  const platforms = value.filter(
    (platform): platform is T3SeatPoolRentalPlatform =>
      platform === "chatgpt" ||
      platform === "gemini" ||
      platform === "claude" ||
      platform === "hugerouter"
  );
  return platforms.length > 0 ? Array.from(new Set(platforms)) : fallback;
}

function normalizePlatformRental(
  value: unknown,
  defaults: T3SeatPoolPlatformRental
): T3SeatPoolPlatformRental {
  if (!value || typeof value !== "object") {
    return defaults;
  }
  const record = value as Partial<T3SeatPoolPlatformRental>;
  return {
    discountPriceCents:
      normalizeSeatPriceCents(record.discountPriceCents) ?? defaults.discountPriceCents,
    enabled: record.enabled === true,
    settlementMode: "hugerouter-platform-rental-mock",
    supportedPlatforms: normalizeRentalPlatforms(record.supportedPlatforms, [
      ...defaults.supportedPlatforms,
    ]),
  };
}

function normalizeSeatLimit(value: unknown) {
  if (value === null) {
    return null;
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return Math.max(Math.floor(value), 1);
}

function normalizePositiveInteger(value: unknown, fallback: number, max: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(Math.max(Math.floor(value), 1), max);
}

function normalizeAiGatewayRouteMode(value: unknown): T3AiGatewayRouteMode {
  if (value === "official-api" || value === "local-cli" || value === "supervised-session") {
    return value;
  }
  return "official-api";
}

function normalizeHugerouterTier(value: unknown): T3HugerouterMembershipTier {
  if (typeof value === "string" && value in T3_HUGEROUTER_MEMBERSHIP_TIER_OPTIONS) {
    return value as T3HugerouterMembershipTier;
  }
  return "hugerouter-pro";
}

function normalizeHugerouterCapacitySource(value: unknown): T3HugerouterCapacitySource {
  if (value === "provider-authorized-pool") {
    return "provider-authorized-pool";
  }
  return "hugerouter-native-credits";
}

function normalizeNonNegativeInteger(value: unknown, fallback: number, max: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(Math.max(Math.floor(value), 0), max);
}

function isLoopbackHost(hostname: string) {
  const normalized = hostname.toLowerCase();
  return (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "::1" ||
    normalized.endsWith(".localhost")
  );
}

function buildRemoteProfileId(endpointUrl: string): string {
  return `remote:${btoa(endpointUrl).replace(/=+$/u, "")}`;
}

function currentBrowserProfile(): T3BrowserProfileDescriptor {
  return {
    endpointUrl: null,
    fingerprintPolicy: "native-transparent",
    id: "current-browser",
    label: "Current browser profile",
    providerIds: PROVIDERS,
    securityModel: "current-browser-session",
    source: "current-browser",
    status: "available",
    statusMessage:
      "Uses the account already available to this browser session. HugeCode does not read cookies or passwords.",
  };
}

function normalizeStoredProfile(value: unknown): T3BrowserProfileDescriptor | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as Partial<T3BrowserProfileDescriptor>;
  const endpointUrl = safeNormalizeEndpointUrl(readText(record.endpointUrl));
  const id = readText(record.id);
  const label = readText(record.label);
  if (!id || !label || !endpointUrl || record.source !== "remote-devtools") {
    return null;
  }
  return {
    endpointUrl,
    fingerprintPolicy: "native-transparent",
    id,
    label,
    providerIds: PROVIDERS,
    securityModel: "remote-devtools-reference",
    source: "remote-devtools",
    status: record.status === "connected" ? "connected" : "available",
    statusMessage:
      readText(record.statusMessage) ??
      "Remote DevTools profile is saved as a reference. Credentials stay in the remote browser.",
  };
}

function readStoredRemoteProfiles(): T3BrowserProfileDescriptor[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]") as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .map(normalizeStoredProfile)
      .filter((profile): profile is T3BrowserProfileDescriptor => profile !== null);
  } catch {
    return [];
  }
}

function writeStoredRemoteProfiles(profiles: readonly T3BrowserProfileDescriptor[]) {
  const remoteProfiles = profiles.filter((profile) => profile.source === "remote-devtools");
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(remoteProfiles));
}

function normalizeSyncRecords(value: unknown): Record<string, T3BrowserProfileSyncState> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  const records: Record<string, T3BrowserProfileSyncState> = {};
  for (const [profileId, recordValue] of Object.entries(value)) {
    const record = recordValue as Partial<T3BrowserProfileSyncState>;
    if (
      typeof record.profileId !== "string" ||
      typeof record.profileLabel !== "string" ||
      record.backend !== "local-mock-hugerouter"
    ) {
      continue;
    }
    records[profileId] = {
      accountPortability:
        record.accountPortability === "remote-session" ? "remote-session" : "local-only",
      backend: "local-mock-hugerouter",
      credentialPayload: "blocked",
      deviceCount: typeof record.deviceCount === "number" ? record.deviceCount : 1,
      deviceLimit: null,
      devicePolicy: "web-unbounded-mock",
      lastSyncedAt: typeof record.lastSyncedAt === "number" ? record.lastSyncedAt : null,
      membershipAccountUsable: record.membershipAccountUsable === true,
      profileId: record.profileId,
      profileLabel: record.profileLabel,
      remoteSessionAvailable: record.remoteSessionAvailable === true,
      status: record.status === "synced" ? "synced" : "idle",
      summary:
        readText(record.summary) ??
        "Local mock has not synced this browser profile to Hugerouter yet.",
    };
  }
  return records;
}

function readMockSyncRecords(): Record<string, T3BrowserProfileSyncState> {
  try {
    return normalizeSyncRecords(
      JSON.parse(window.localStorage.getItem(PROFILE_SYNC_STORAGE_KEY) ?? "{}") as unknown
    );
  } catch {
    return {};
  }
}

function writeMockSyncRecords(records: Record<string, T3BrowserProfileSyncState>) {
  window.localStorage.setItem(PROFILE_SYNC_STORAGE_KEY, JSON.stringify(records));
}

function normalizeProfileStateClass(value: unknown): T3BrowserProfileStateClass | null {
  return PROFILE_MIGRATION_STATE_CLASSES.includes(value as T3BrowserProfileStateClass)
    ? (value as T3BrowserProfileStateClass)
    : null;
}

function normalizeProfileStateClasses(value: unknown): readonly T3BrowserProfileStateClass[] {
  if (!Array.isArray(value)) {
    return PROFILE_MIGRATION_STATE_CLASSES;
  }
  const stateClasses = value
    .map(normalizeProfileStateClass)
    .filter((entry): entry is T3BrowserProfileStateClass => entry !== null);
  return stateClasses.length > 0
    ? Array.from(new Set(stateClasses))
    : PROFILE_MIGRATION_STATE_CLASSES;
}

function normalizeMigrationStatus(value: unknown): T3BrowserProfileMigrationStatus {
  if (
    value === "available" ||
    value === "in-use" ||
    value === "syncing" ||
    value === "conflict" ||
    value === "stale-lock"
  ) {
    return value;
  }
  return "available";
}

function normalizeMigrationLock(value: unknown): T3BrowserProfileMigrationLock | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as Partial<T3BrowserProfileMigrationLock>;
  const deviceName = readText(record.deviceName);
  if (!deviceName || typeof record.acquiredAt !== "number") {
    return null;
  }
  return {
    acquiredAt: record.acquiredAt,
    deviceName,
    mode: "read-write",
  };
}

function normalizeMigrationSnapshot(value: unknown): T3BrowserProfileVersionSnapshot | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as Partial<T3BrowserProfileVersionSnapshot>;
  const id = readText(record.id);
  const sourceDeviceName = readText(record.sourceDeviceName);
  if (
    !id ||
    !sourceDeviceName ||
    typeof record.createdAt !== "number" ||
    typeof record.versionNumber !== "number"
  ) {
    return null;
  }
  return {
    createdAt: record.createdAt,
    id,
    payloadPolicy: "host-managed-encrypted",
    sourceDeviceName,
    stateClasses: normalizeProfileStateClasses(record.stateClasses),
    summary:
      readText(record.summary) ??
      "Version snapshot metadata recorded. Browser state payload is host-managed and encrypted.",
    versionNumber: Math.max(Math.floor(record.versionNumber), 1),
  };
}

function normalizeMigrationAuditEntry(value: unknown): T3BrowserProfileMigrationAuditEntry | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as Partial<T3BrowserProfileMigrationAuditEntry>;
  const id = readText(record.id);
  const actorDeviceName = readText(record.actorDeviceName);
  if (!id || !actorDeviceName || typeof record.createdAt !== "number") {
    return null;
  }
  const action =
    record.action === "open" ||
    record.action === "sync-close" ||
    record.action === "force-takeover" ||
    record.action === "restore-version"
      ? record.action
      : "open";
  return {
    action,
    actorDeviceName,
    createdAt: record.createdAt,
    id,
    previousDeviceName: readText(record.previousDeviceName),
    summary: readText(record.summary) ?? "Profile migration action recorded.",
  };
}

function migrationSummary(input: {
  latestVersionNumber: number;
  lock: T3BrowserProfileMigrationLock | null;
  status: T3BrowserProfileMigrationStatus;
}) {
  if (input.status === "in-use" && input.lock) {
    return `Profile is locked for writing on ${input.lock.deviceName}. Other devices should view or request takeover.`;
  }
  if (input.status === "stale-lock") {
    return "Last device did not close cleanly. Review the latest version before forcing takeover.";
  }
  if (input.status === "conflict") {
    return "Two device histories need resolution before this profile can be safely opened.";
  }
  if (input.status === "syncing") {
    return "Profile state is being saved. Wait for upload confirmation before opening elsewhere.";
  }
  if (input.latestVersionNumber > 0) {
    return `Profile v${input.latestVersionNumber} is released and can be continued on another authorized device.`;
  }
  return "No migration snapshot yet. Use Sync and close after the first login session is ready.";
}

function normalizeMigrationState(value: unknown): T3BrowserProfileMigrationState | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as Partial<T3BrowserProfileMigrationState>;
  const profileId = readText(record.profileId);
  const profileLabel = readText(record.profileLabel);
  if (!profileId || !profileLabel) {
    return null;
  }
  const snapshots = Array.isArray(record.snapshots)
    ? record.snapshots
        .map(normalizeMigrationSnapshot)
        .filter((snapshot): snapshot is T3BrowserProfileVersionSnapshot => snapshot !== null)
        .sort((left, right) => right.versionNumber - left.versionNumber)
        .slice(0, 8)
    : [];
  const auditLog = Array.isArray(record.auditLog)
    ? record.auditLog
        .map(normalizeMigrationAuditEntry)
        .filter((entry): entry is T3BrowserProfileMigrationAuditEntry => entry !== null)
        .sort((left, right) => right.createdAt - left.createdAt)
        .slice(0, 12)
    : [];
  const lock = normalizeMigrationLock(record.lock);
  const status = normalizeMigrationStatus(record.status);
  const latestVersion = snapshots[0] ?? null;
  return {
    auditLog,
    credentialPayload: "blocked",
    currentDeviceName: lock?.deviceName ?? readText(record.currentDeviceName),
    lastSourceDeviceName:
      readText(record.lastSourceDeviceName) ?? latestVersion?.sourceDeviceName ?? null,
    lastSyncedAt: typeof record.lastSyncedAt === "number" ? record.lastSyncedAt : null,
    latestVersionId: latestVersion?.id ?? readText(record.latestVersionId),
    latestVersionNumber: latestVersion?.versionNumber ?? 0,
    lock,
    profileId,
    profileLabel,
    snapshots,
    stateClasses: normalizeProfileStateClasses(record.stateClasses),
    status,
    summary:
      readText(record.summary) ??
      migrationSummary({
        latestVersionNumber: latestVersion?.versionNumber ?? 0,
        lock,
        status,
      }),
    syncPayload: "host-managed-encrypted",
  };
}

function normalizeMigrationRecords(value: unknown): Record<string, T3BrowserProfileMigrationState> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  const records: Record<string, T3BrowserProfileMigrationState> = {};
  for (const [profileId, recordValue] of Object.entries(value)) {
    const record = normalizeMigrationState(recordValue);
    if (record && record.profileId === profileId) {
      records[profileId] = record;
    }
  }
  return records;
}

function readMigrationRecords(): Record<string, T3BrowserProfileMigrationState> {
  try {
    return normalizeMigrationRecords(
      JSON.parse(window.localStorage.getItem(PROFILE_MIGRATION_STORAGE_KEY) ?? "{}") as unknown
    );
  } catch {
    return {};
  }
}

function writeMigrationRecords(records: Record<string, T3BrowserProfileMigrationState>) {
  window.localStorage.setItem(PROFILE_MIGRATION_STORAGE_KEY, JSON.stringify(records));
}

function defaultMigrationState(
  profile: T3BrowserProfileDescriptor
): T3BrowserProfileMigrationState {
  return {
    auditLog: [],
    credentialPayload: "blocked",
    currentDeviceName: null,
    lastSourceDeviceName: null,
    lastSyncedAt: null,
    latestVersionId: null,
    latestVersionNumber: 0,
    lock: null,
    profileId: profile.id,
    profileLabel: profile.label,
    snapshots: [],
    stateClasses: PROFILE_MIGRATION_STATE_CLASSES,
    status: "available",
    summary:
      "No migration snapshot yet. Use Sync and close after the first login session is ready.",
    syncPayload: "host-managed-encrypted",
  };
}

function migrationAudit(input: {
  action: T3BrowserProfileMigrationAuditEntry["action"];
  actorDeviceName: string;
  previousDeviceName?: string | null;
  summary: string;
}): T3BrowserProfileMigrationAuditEntry {
  return {
    action: input.action,
    actorDeviceName: input.actorDeviceName,
    createdAt: Date.now(),
    id: createLocalId("profile-migration-audit"),
    previousDeviceName: input.previousDeviceName ?? null,
    summary: input.summary,
  };
}

function guestPassStatus(pass: Pick<T3BrowserGuestPass, "expiresAt" | "revokedAt">) {
  if (pass.revokedAt !== null) {
    return "revoked";
  }
  return pass.expiresAt <= Date.now() ? "expired" : "active";
}

function createGuestPassId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `guest-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function createLocalId(prefix: string) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}:${crypto.randomUUID()}`;
  }
  return `${prefix}:${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function createInviteCode(passId: string) {
  return `hcgp-${btoa(passId).replace(/=+$/u, "").slice(0, 14)}`;
}

function normalizeGuestPass(value: unknown): T3BrowserGuestPass | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as Partial<T3BrowserGuestPass>;
  const id = readText(record.id);
  const inviteCode = readText(record.inviteCode);
  const guestLabel = readText(record.guestLabel);
  const profileId = readText(record.profileId);
  const profileLabel = readText(record.profileLabel);
  const providerId = isKnownBrowserProvider(record.providerId) ? record.providerId : null;
  const fallbackSiteScope = providerId
    ? resolveSiteScope({
        providerId,
      })
    : null;
  const siteId = readText(record.siteId) ?? fallbackSiteScope?.siteId;
  const siteOrigin = readText(record.siteOrigin) ?? fallbackSiteScope?.siteOrigin;
  const siteLabel = readText(record.siteLabel) ?? fallbackSiteScope?.siteLabel;
  if (
    !id ||
    !inviteCode ||
    !guestLabel ||
    !profileId ||
    !profileLabel ||
    !providerId ||
    !siteId ||
    !siteOrigin ||
    !siteLabel ||
    typeof record.createdAt !== "number" ||
    typeof record.expiresAt !== "number"
  ) {
    return null;
  }
  const revokedAt = typeof record.revokedAt === "number" ? record.revokedAt : null;
  return {
    auditMode: "owner-visible",
    createdAt: record.createdAt,
    credentialPayload: "blocked",
    expiresAt: record.expiresAt,
    guestLabel,
    id,
    inviteCode,
    ownerApproval: "required-for-sensitive-actions",
    permissionMode: "supervised-use",
    profileId,
    profileLabel,
    providerId,
    revokedAt,
    sensitiveActionsBlocked: GUEST_PASS_BLOCKED_ACTIONS,
    siteId,
    siteLabel,
    siteOrigin,
    status: guestPassStatus({
      expiresAt: record.expiresAt,
      revokedAt,
    }),
    summary:
      readText(record.summary) ??
      "Guest pass grants supervised remote-session access without sharing passwords or browser credentials.",
  };
}

function readGuestPasses(): T3BrowserGuestPass[] {
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(GUEST_PASS_STORAGE_KEY) ?? "[]"
    ) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .map(normalizeGuestPass)
      .filter((pass): pass is T3BrowserGuestPass => pass !== null)
      .sort((left, right) => right.createdAt - left.createdAt);
  } catch {
    return [];
  }
}

function writeGuestPasses(passes: readonly T3BrowserGuestPass[]) {
  window.localStorage.setItem(GUEST_PASS_STORAGE_KEY, JSON.stringify(passes));
}

function buildSeatPoolId(input: { profileId: string; siteId: string }) {
  return `seat-pool:${input.profileId}:${input.siteId}`;
}

function normalizeSeatPoolMember(value: unknown): T3BrowserSeatPoolMember | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as Partial<T3BrowserSeatPoolMember>;
  const id = readText(record.id);
  const guestPassId = readText(record.guestPassId);
  const inviteCode = readText(record.inviteCode);
  const label = readText(record.label);
  if (
    !id ||
    !guestPassId ||
    !inviteCode ||
    !label ||
    typeof record.createdAt !== "number" ||
    typeof record.seatNumber !== "number"
  ) {
    return null;
  }
  return {
    createdAt: record.createdAt,
    guestPassId,
    id,
    inviteCode,
    label,
    lastUsedAt: typeof record.lastUsedAt === "number" ? record.lastUsedAt : null,
    seatNumber: Math.max(Math.floor(record.seatNumber), 1),
    status: record.status === "paused" ? "paused" : "active",
  };
}

function normalizeSeatPool(value: unknown): T3BrowserSeatPool | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as Partial<T3BrowserSeatPool>;
  const id = readText(record.id);
  const profileId = readText(record.profileId);
  const profileLabel = readText(record.profileLabel);
  const providerId = isKnownBrowserProvider(record.providerId) ? record.providerId : null;
  const fallbackSiteScope = providerId
    ? resolveSiteScope({
        providerId,
      })
    : null;
  const siteId = readText(record.siteId) ?? fallbackSiteScope?.siteId;
  const siteOrigin = readText(record.siteOrigin) ?? fallbackSiteScope?.siteOrigin;
  const siteLabel = readText(record.siteLabel) ?? fallbackSiteScope?.siteLabel;
  if (!id || !profileId || !profileLabel || !providerId || !siteId || !siteOrigin || !siteLabel) {
    return null;
  }
  const members = Array.isArray(record.members)
    ? record.members
        .map(normalizeSeatPoolMember)
        .filter((member): member is T3BrowserSeatPoolMember => member !== null)
        .sort((left, right) => left.seatNumber - right.seatNumber)
    : [];
  const planType = normalizeMembershipPlanType(record.commercial?.planType, providerId);
  const commercialDefaults = buildCommercialDefaults(providerId, planType);
  const seatPriceCents = normalizeSeatPriceCents(record.commercial?.seatPriceCents);
  return {
    commercial: {
      ...commercialDefaults,
      listingStatus: record.commercial?.listingStatus === "listed" ? "listed" : "draft",
      platformRental: normalizePlatformRental(
        record.commercial?.platformRental,
        commercialDefaults.platformRental
      ),
      seatPriceCents: seatPriceCents ?? commercialDefaults.seatPriceCents,
    },
    complianceMode: providerId === "hugerouter" ? "hugerouter-native-supported" : "policy-deferred",
    concurrencyMode:
      providerId === "hugerouter" ? "hugerouter-native-supported" : "policy-deferred",
    credentialPayload: "blocked",
    id,
    memberCount: members.filter((member) => member.status === "active").length,
    members,
    ownerApproval: "required-for-sensitive-actions",
    profileId,
    profileLabel,
    providerId,
    seatLimit: normalizeSeatLimit(record.seatLimit),
    sensitiveActionsBlocked: GUEST_PASS_BLOCKED_ACTIONS,
    siteId,
    siteLabel,
    siteOrigin,
    summary:
      (readText(record.summary) ?? providerId === "hugerouter")
        ? "Hugerouter-native membership supports carpool, rental, and platform leasing in this mock; settlement remains in Hugerouter."
        : "Seat pool uses a policy-deferred membership model. Web device count is not capped in this mock.",
  };
}

function readSeatPools(): T3BrowserSeatPool[] {
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(SEAT_POOL_STORAGE_KEY) ?? "[]"
    ) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.map(normalizeSeatPool).filter((pool): pool is T3BrowserSeatPool => pool !== null);
  } catch {
    return [];
  }
}

function writeSeatPools(pools: readonly T3BrowserSeatPool[]) {
  window.localStorage.setItem(SEAT_POOL_STORAGE_KEY, JSON.stringify(pools));
}

function gatewayRouteSummary(input: { routeMode: T3AiGatewayRouteMode; routable: boolean }) {
  if (input.routeMode === "official-api") {
    return "Routable through organization-approved API capacity. Personal browser credentials are not stored or replayed.";
  }
  if (input.routeMode === "local-cli") {
    return "Routable through a local authorized CLI backend. HugeCode records capacity metadata only.";
  }
  return input.routable
    ? "Routable supervised session."
    : "Owner-supervised browser session only. It is not counted as shared-account fan-out for the enterprise gateway.";
}

function normalizeAiGatewayRoute(value: unknown): T3AiGatewayRoute | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as Partial<T3AiGatewayRoute>;
  const id = readText(record.id);
  const ownerLabel = readText(record.ownerLabel);
  const planType =
    typeof record.planType === "string" && record.planType in T3_BROWSER_MEMBERSHIP_PLAN_OPTIONS
      ? (record.planType as T3BrowserMembershipPlanType)
      : null;
  if (!id || !ownerLabel || !planType || typeof record.createdAt !== "number") {
    return null;
  }
  const plan = T3_BROWSER_MEMBERSHIP_PLAN_OPTIONS[planType];
  const routeMode = normalizeAiGatewayRouteMode(record.routeMode);
  const routable = routeMode !== "supervised-session" && record.routable !== false;
  return {
    createdAt: record.createdAt,
    credentialPayload: "blocked",
    id,
    maxConcurrentTasks: normalizePositiveInteger(record.maxConcurrentTasks, 1, 100),
    ownerLabel,
    planLabel: plan.planLabel,
    planType,
    providerId: plan.providerId,
    requestBudgetPerDay: normalizePositiveInteger(record.requestBudgetPerDay, 100, 1_000_000),
    routable,
    routeMode,
    serviceMultiplier: plan.serviceMultiplier,
    status: routable ? "routable" : "review-required",
    summary:
      readText(record.summary) ??
      gatewayRouteSummary({
        routable,
        routeMode,
      }),
  };
}

export function listT3AiGatewayRoutesMock(): T3AiGatewayRoute[] {
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(AI_GATEWAY_ROUTES_STORAGE_KEY) ?? "[]"
    ) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .map(normalizeAiGatewayRoute)
      .filter((route): route is T3AiGatewayRoute => route !== null)
      .sort((left, right) => right.createdAt - left.createdAt);
  } catch {
    return [];
  }
}

function writeAiGatewayRoutes(routes: readonly T3AiGatewayRoute[]) {
  window.localStorage.setItem(AI_GATEWAY_ROUTES_STORAGE_KEY, JSON.stringify(routes));
}

export function buildT3AiGatewaySummaryMock(
  routes = listT3AiGatewayRoutesMock()
): T3AiGatewaySummary {
  const routableRoutes = routes.filter((route) => route.routable && route.status === "routable");
  return {
    complianceStatus:
      routableRoutes.length > 0 && routableRoutes.length === routes.length
        ? "ready"
        : "review-required",
    maxConcurrentTasks: routableRoutes.reduce(
      (total, route) => total + route.maxConcurrentTasks,
      0
    ),
    requestBudgetPerDay: routableRoutes.reduce(
      (total, route) => total + route.requestBudgetPerDay,
      0
    ),
    routeCount: routes.length,
    routableRouteCount: routableRoutes.length,
  };
}

export function createT3AiGatewayRouteMock(input: {
  maxConcurrentTasks: number;
  ownerLabel: string;
  planType: T3BrowserMembershipPlanType;
  requestBudgetPerDay: number;
  routeMode: T3AiGatewayRouteMode;
}): T3AiGatewayRoute {
  const plan = T3_BROWSER_MEMBERSHIP_PLAN_OPTIONS[input.planType];
  const routeMode = normalizeAiGatewayRouteMode(input.routeMode);
  const routable = routeMode !== "supervised-session";
  const route: T3AiGatewayRoute = {
    createdAt: Date.now(),
    credentialPayload: "blocked",
    id: createLocalId("ai-gateway-route"),
    maxConcurrentTasks: normalizePositiveInteger(input.maxConcurrentTasks, 1, 100),
    ownerLabel: readText(input.ownerLabel) ?? "Team member",
    planLabel: plan.planLabel,
    planType: input.planType,
    providerId: plan.providerId,
    requestBudgetPerDay: normalizePositiveInteger(input.requestBudgetPerDay, 100, 1_000_000),
    routable,
    routeMode,
    serviceMultiplier: plan.serviceMultiplier,
    status: routable ? "routable" : "review-required",
    summary: gatewayRouteSummary({
      routable,
      routeMode,
    }),
  };
  const routes = listT3AiGatewayRoutesMock();
  writeAiGatewayRoutes([route, ...routes]);
  return route;
}

function hugerouterListingSummary(sourceKind: T3HugerouterCapacitySource) {
  return sourceKind === "hugerouter-native-credits"
    ? "Hugerouter-native AI credits listed through the local T3 fixture; merchant, metering, settlement, and route receipts remain HugeRouter-owned."
    : "Provider-authorized capacity pool listed for HugeRouter relay after backend eligibility checks; commercial authority remains in HugeRouter.";
}

function normalizeHugerouterCapacityListing(value: unknown): T3HugerouterCapacityListing | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as Partial<T3HugerouterCapacityListing>;
  const id = readText(record.id);
  const sellerLabel = readText(record.sellerLabel);
  if (!id || !sellerLabel || typeof record.createdAt !== "number") {
    return null;
  }
  const tier = normalizeHugerouterTier(record.tier);
  const tierOption = T3_HUGEROUTER_MEMBERSHIP_TIER_OPTIONS[tier];
  const totalCredits = normalizePositiveInteger(
    record.totalCredits,
    tierOption.includedCredits,
    100_000_000
  );
  const availableCredits = normalizeNonNegativeInteger(
    record.availableCredits,
    totalCredits,
    totalCredits
  );
  const sourceKind = normalizeHugerouterCapacitySource(record.sourceKind);
  return {
    availableCredits,
    createdAt: record.createdAt,
    credentialPayload: "blocked",
    id,
    minPurchaseCredits: normalizePositiveInteger(record.minPurchaseCredits, 10_000, totalCredits),
    sellerLabel,
    serviceDelivery: "hugerouter-relay-mock",
    settlementMode: "mock-escrow",
    sourceKind,
    status: availableCredits > 0 ? "listed" : "sold-out",
    summary: readText(record.summary) ?? hugerouterListingSummary(sourceKind),
    tier,
    tierLabel: tierOption.label,
    totalCredits,
    unitPriceCentsPerThousand: normalizePositiveInteger(
      record.unitPriceCentsPerThousand,
      8,
      100_000
    ),
  };
}

export function listT3HugerouterCapacityListingsMock(): T3HugerouterCapacityListing[] {
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(HUGEROUTER_LISTINGS_STORAGE_KEY) ?? "[]"
    ) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .map(normalizeHugerouterCapacityListing)
      .filter((listing): listing is T3HugerouterCapacityListing => listing !== null)
      .sort((left, right) => right.createdAt - left.createdAt);
  } catch {
    return [];
  }
}

function writeHugerouterCapacityListings(listings: readonly T3HugerouterCapacityListing[]) {
  window.localStorage.setItem(HUGEROUTER_LISTINGS_STORAGE_KEY, JSON.stringify(listings));
}

function normalizeHugerouterCapacityOrder(value: unknown): T3HugerouterCapacityOrder | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as Partial<T3HugerouterCapacityOrder>;
  const id = readText(record.id);
  const listingId = readText(record.listingId);
  const buyerLabel = readText(record.buyerLabel);
  const sellerLabel = readText(record.sellerLabel);
  const tierLabel = readText(record.tierLabel);
  if (
    !id ||
    !listingId ||
    !buyerLabel ||
    !sellerLabel ||
    !tierLabel ||
    typeof record.createdAt !== "number"
  ) {
    return null;
  }
  const status =
    record.status === "settled" || record.status === "refunded" ? record.status : "escrow-held";
  return {
    buyerLabel,
    createdAt: record.createdAt,
    credentialPayload: "blocked",
    creditsPurchased: normalizePositiveInteger(record.creditsPurchased, 10_000, 100_000_000),
    escrowStatus: status === "settled" ? "released" : status === "refunded" ? "refunded" : "held",
    id,
    listingId,
    platformFeeCents: normalizeNonNegativeInteger(record.platformFeeCents, 0, 100_000_000),
    sellerReceivesCents: normalizeNonNegativeInteger(record.sellerReceivesCents, 0, 100_000_000),
    sellerLabel,
    serviceDelivery: "hugerouter-relay-mock",
    serviceRelayStatus:
      status === "settled" ? "settled" : status === "refunded" ? "refunded" : "provisioned",
    status,
    tierLabel,
    totalPriceCents: normalizePositiveInteger(record.totalPriceCents, 1, 100_000_000),
    unitPriceCentsPerThousand: normalizePositiveInteger(
      record.unitPriceCentsPerThousand,
      8,
      100_000
    ),
  };
}

export function listT3HugerouterCapacityOrdersMock(): T3HugerouterCapacityOrder[] {
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(HUGEROUTER_ORDERS_STORAGE_KEY) ?? "[]"
    ) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .map(normalizeHugerouterCapacityOrder)
      .filter((order): order is T3HugerouterCapacityOrder => order !== null)
      .sort((left, right) => right.createdAt - left.createdAt);
  } catch {
    return [];
  }
}

function writeHugerouterCapacityOrders(orders: readonly T3HugerouterCapacityOrder[]) {
  window.localStorage.setItem(HUGEROUTER_ORDERS_STORAGE_KEY, JSON.stringify(orders));
}

export function createT3HugerouterCapacityListingMock(input: {
  minPurchaseCredits: number;
  sellerLabel: string;
  sourceKind: T3HugerouterCapacitySource;
  tier: T3HugerouterMembershipTier;
  totalCredits: number;
  unitPriceCentsPerThousand: number;
}): T3HugerouterCapacityListing {
  const tier = normalizeHugerouterTier(input.tier);
  const tierOption = T3_HUGEROUTER_MEMBERSHIP_TIER_OPTIONS[tier];
  const totalCredits = normalizePositiveInteger(
    input.totalCredits,
    tierOption.includedCredits,
    100_000_000
  );
  const sourceKind = normalizeHugerouterCapacitySource(input.sourceKind);
  const listing: T3HugerouterCapacityListing = {
    availableCredits: totalCredits,
    createdAt: Date.now(),
    credentialPayload: "blocked",
    id: createLocalId("hugerouter-listing"),
    minPurchaseCredits: normalizePositiveInteger(input.minPurchaseCredits, 10_000, totalCredits),
    sellerLabel: readText(input.sellerLabel) ?? "Hugerouter seller",
    serviceDelivery: "hugerouter-relay-mock",
    settlementMode: "mock-escrow",
    sourceKind,
    status: "listed",
    summary: hugerouterListingSummary(sourceKind),
    tier,
    tierLabel: tierOption.label,
    totalCredits,
    unitPriceCentsPerThousand: normalizePositiveInteger(
      input.unitPriceCentsPerThousand,
      8,
      100_000
    ),
  };
  const listings = listT3HugerouterCapacityListingsMock();
  writeHugerouterCapacityListings([listing, ...listings]);
  return listing;
}

export function createT3HugerouterCapacityOrderMock(input: {
  buyerLabel: string;
  creditsRequested: number;
  listingId: string;
}): T3HugerouterCapacityOrder {
  const listings = listT3HugerouterCapacityListingsMock();
  const listing = listings.find((candidate) => candidate.id === input.listingId);
  if (!listing || listing.status !== "listed") {
    throw new Error("Select a listed Hugerouter capacity offer before ordering.");
  }
  const creditsPurchased = normalizePositiveInteger(
    input.creditsRequested,
    listing.minPurchaseCredits,
    listing.availableCredits
  );
  if (creditsPurchased < listing.minPurchaseCredits) {
    throw new Error("Requested credits are below the listing minimum.");
  }
  if (creditsPurchased > listing.availableCredits) {
    throw new Error("Requested credits exceed the available Hugerouter capacity.");
  }
  const totalPriceCents = Math.ceil((creditsPurchased / 1000) * listing.unitPriceCentsPerThousand);
  const platformFeeCents = Math.ceil(totalPriceCents * 0.08);
  const order: T3HugerouterCapacityOrder = {
    buyerLabel: readText(input.buyerLabel) ?? "Hugerouter buyer",
    createdAt: Date.now(),
    credentialPayload: "blocked",
    creditsPurchased,
    escrowStatus: "held",
    id: createLocalId("hugerouter-order"),
    listingId: listing.id,
    platformFeeCents,
    sellerReceivesCents: totalPriceCents - platformFeeCents,
    sellerLabel: listing.sellerLabel,
    serviceDelivery: "hugerouter-relay-mock",
    serviceRelayStatus: "provisioned",
    status: "escrow-held",
    tierLabel: listing.tierLabel,
    totalPriceCents,
    unitPriceCentsPerThousand: listing.unitPriceCentsPerThousand,
  };
  const nextListing: T3HugerouterCapacityListing = {
    ...listing,
    availableCredits: listing.availableCredits - creditsPurchased,
    status: listing.availableCredits - creditsPurchased > 0 ? "listed" : "sold-out",
  };
  writeHugerouterCapacityListings([
    nextListing,
    ...listings.filter((candidate) => candidate.id !== listing.id),
  ]);
  writeHugerouterCapacityOrders([order, ...listT3HugerouterCapacityOrdersMock()]);
  return order;
}

export function settleT3HugerouterCapacityOrderMock(
  orderId: string
): T3HugerouterCapacityOrder | null {
  const orders = listT3HugerouterCapacityOrdersMock();
  const order = orders.find((candidate) => candidate.id === orderId);
  if (!order || order.status !== "escrow-held") {
    return order ?? null;
  }
  const nextOrder: T3HugerouterCapacityOrder = {
    ...order,
    escrowStatus: "released",
    serviceRelayStatus: "settled",
    status: "settled",
  };
  writeHugerouterCapacityOrders([
    nextOrder,
    ...orders.filter((candidate) => candidate.id !== order.id),
  ]);
  return nextOrder;
}

export function refundT3HugerouterCapacityOrderMock(
  orderId: string
): T3HugerouterCapacityOrder | null {
  const orders = listT3HugerouterCapacityOrdersMock();
  const order = orders.find((candidate) => candidate.id === orderId);
  if (!order || order.status !== "escrow-held") {
    return order ?? null;
  }
  const listings = listT3HugerouterCapacityListingsMock();
  const listing = listings.find((candidate) => candidate.id === order.listingId);
  if (listing) {
    const nextListing: T3HugerouterCapacityListing = {
      ...listing,
      availableCredits: Math.min(
        listing.availableCredits + order.creditsPurchased,
        listing.totalCredits
      ),
      status: "listed",
    };
    writeHugerouterCapacityListings([
      nextListing,
      ...listings.filter((candidate) => candidate.id !== listing.id),
    ]);
  }
  const nextOrder: T3HugerouterCapacityOrder = {
    ...order,
    escrowStatus: "refunded",
    serviceRelayStatus: "refunded",
    status: "refunded",
  };
  writeHugerouterCapacityOrders([
    nextOrder,
    ...orders.filter((candidate) => candidate.id !== order.id),
  ]);
  return nextOrder;
}

function normalizeIsolatedApp(value: unknown): T3BrowserIsolatedApp | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as Partial<T3BrowserIsolatedApp>;
  const id = readText(record.id);
  const appKey = readText(record.appKey);
  const label = readText(record.label);
  const profileId = readText(record.profileId);
  const profileLabel = readText(record.profileLabel);
  const targetUrl = safeNormalizeProductUrl(readText(record.targetUrl));
  const providerId = isBrowserProvider(record.providerId) ? record.providerId : null;
  const fallbackSiteScope = safeT3HugerouterSiteScope(targetUrl);
  const siteId = readText(record.siteId) ?? fallbackSiteScope?.siteId;
  const siteOrigin = readText(record.siteOrigin) ?? fallbackSiteScope?.siteOrigin;
  const siteLabel = readText(record.siteLabel) ?? fallbackSiteScope?.siteLabel;
  if (
    !id ||
    !appKey ||
    !label ||
    !profileId ||
    !profileLabel ||
    !providerId ||
    !siteId ||
    !siteOrigin ||
    !siteLabel ||
    !targetUrl ||
    typeof record.createdAt !== "number"
  ) {
    return null;
  }
  return {
    appKey,
    createdAt: record.createdAt,
    credentialPayload: "blocked",
    id,
    isolationMode: "local-mock-app-scope",
    label,
    lastOpenedAt: typeof record.lastOpenedAt === "number" ? record.lastOpenedAt : null,
    launchCount: typeof record.launchCount === "number" ? record.launchCount : 0,
    profileId,
    profileLabel,
    providerId,
    siteId,
    siteLabel,
    siteOrigin,
    storageBoundary: "electron-partition-pending",
    targetUrl,
  };
}

function readIsolatedApps(): T3BrowserIsolatedApp[] {
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(ISOLATED_APPS_STORAGE_KEY) ?? "[]"
    ) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .map(normalizeIsolatedApp)
      .filter((app): app is T3BrowserIsolatedApp => app !== null)
      .sort((left, right) => right.createdAt - left.createdAt);
  } catch {
    return [];
  }
}

function writeIsolatedApps(apps: readonly T3BrowserIsolatedApp[]) {
  window.localStorage.setItem(ISOLATED_APPS_STORAGE_KEY, JSON.stringify(apps));
}

function emptySeatPool(input: {
  profile: T3BrowserProfileDescriptor;
  providerId: Exclude<T3BrowserProvider, "custom">;
  siteScope: T3HugerouterSiteScope;
}): T3BrowserSeatPool {
  return {
    commercial: buildCommercialDefaults(input.providerId),
    complianceMode:
      input.providerId === "hugerouter" ? "hugerouter-native-supported" : "policy-deferred",
    concurrencyMode:
      input.providerId === "hugerouter" ? "hugerouter-native-supported" : "policy-deferred",
    credentialPayload: "blocked",
    id: buildSeatPoolId({
      profileId: input.profile.id,
      siteId: input.siteScope.siteId,
    }),
    memberCount: 0,
    members: [],
    ownerApproval: "required-for-sensitive-actions",
    profileId: input.profile.id,
    profileLabel: input.profile.label,
    providerId: input.providerId,
    seatLimit: null,
    sensitiveActionsBlocked: GUEST_PASS_BLOCKED_ACTIONS,
    siteId: input.siteScope.siteId,
    siteLabel: input.siteScope.siteLabel,
    siteOrigin: input.siteScope.siteOrigin,
    summary:
      input.providerId === "hugerouter"
        ? "Hugerouter-native membership pool supports carpool, rental, platform leasing, and revocable seats by product policy."
        : "Policy-deferred seat pool mock. Web device count is not capped during product development, and no passwords, cookies, or tokens are shared.",
  };
}

function ensureSeatPoolProvider(
  providerId: T3BrowserProvider
): Exclude<T3BrowserProvider, "custom"> {
  if (providerId === "custom") {
    return "hugerouter";
  }
  return providerId;
}

function nextSeatNumber(members: readonly T3BrowserSeatPoolMember[]) {
  const usedSeats = new Set(members.map((member) => member.seatNumber));
  let seatNumber = 1;
  while (usedSeats.has(seatNumber)) {
    seatNumber += 1;
  }
  return seatNumber;
}

export function getT3BrowserProfileSyncState(
  profile: T3BrowserProfileDescriptor
): T3BrowserProfileSyncState {
  const stored = readMockSyncRecords()[profile.id];
  if (stored) {
    return stored;
  }
  return {
    accountPortability: "local-only",
    backend: "local-mock-hugerouter",
    credentialPayload: "blocked",
    deviceCount: 1,
    deviceLimit: null,
    devicePolicy: "web-unbounded-mock",
    lastSyncedAt: null,
    membershipAccountUsable: false,
    profileId: profile.id,
    profileLabel: profile.label,
    remoteSessionAvailable: false,
    status: "idle",
    summary:
      "Local mock only. Use multi-device migration to capture an encrypted cloud-managed browser-state bundle.",
  };
}

export function syncT3BrowserProfileToLocalMock(
  profile: T3BrowserProfileDescriptor
): T3BrowserProfileSyncState {
  const records = readMockSyncRecords();
  const nextState: T3BrowserProfileSyncState = {
    accountPortability: "remote-session",
    backend: "local-mock-hugerouter",
    credentialPayload: "blocked",
    deviceCount: Math.max((records[profile.id]?.deviceCount ?? 1) + 1, 2),
    deviceLimit: null,
    devicePolicy: "web-unbounded-mock",
    lastSyncedAt: Date.now(),
    membershipAccountUsable: true,
    profileId: profile.id,
    profileLabel: profile.label,
    remoteSessionAvailable: true,
    status: "synced",
    summary:
      "Local Hugerouter mock synced profile metadata and remote-session reference. Browser-state payloads are represented as encrypted host/cloud-managed bundles.",
  };
  writeMockSyncRecords({
    ...records,
    [profile.id]: nextState,
  });
  return nextState;
}

export function getT3BrowserProfileMigrationState(
  profile: T3BrowserProfileDescriptor
): T3BrowserProfileMigrationState {
  return readMigrationRecords()[profile.id] ?? defaultMigrationState(profile);
}

export function openT3BrowserProfileMigrationMock(input: {
  deviceName: string;
  profile: T3BrowserProfileDescriptor;
}): T3BrowserProfileMigrationState {
  const deviceName = readText(input.deviceName) ?? "This device";
  const records = readMigrationRecords();
  const current = records[input.profile.id] ?? defaultMigrationState(input.profile);
  if (current.lock && current.lock.deviceName !== deviceName) {
    return {
      ...current,
      status: "in-use",
      summary: `Profile is currently in use on ${current.lock.deviceName}. Force takeover only if that device is unavailable.`,
    };
  }
  const lock: T3BrowserProfileMigrationLock = {
    acquiredAt: Date.now(),
    deviceName,
    mode: "read-write",
  };
  const nextState: T3BrowserProfileMigrationState = {
    ...current,
    auditLog: [
      migrationAudit({
        action: "open",
        actorDeviceName: deviceName,
        previousDeviceName: current.lock?.deviceName ?? null,
        summary: `${deviceName} opened the profile with a single-writer lock.`,
      }),
      ...current.auditLog,
    ].slice(0, 12),
    currentDeviceName: deviceName,
    lock,
    profileLabel: input.profile.label,
    status: "in-use",
    summary: `Profile is open on ${deviceName}. Use Sync and close before continuing on another device.`,
  };
  writeMigrationRecords({
    ...records,
    [input.profile.id]: nextState,
  });
  return nextState;
}

export function syncCloseT3BrowserProfileMigrationMock(input: {
  deviceName: string;
  profile: T3BrowserProfileDescriptor;
}): T3BrowserProfileMigrationState {
  const deviceName = readText(input.deviceName) ?? "This device";
  const records = readMigrationRecords();
  const current = records[input.profile.id] ?? defaultMigrationState(input.profile);
  const previousVersionNumber = current.snapshots[0]?.versionNumber ?? 0;
  const versionNumber = previousVersionNumber + 1;
  const snapshot: T3BrowserProfileVersionSnapshot = {
    createdAt: Date.now(),
    id: createLocalId("profile-version"),
    payloadPolicy: "host-managed-encrypted",
    sourceDeviceName: deviceName,
    stateClasses: PROFILE_MIGRATION_STATE_CLASSES,
    summary:
      "Encrypted browser-state bundle captured for same-user device migration, including cookies, storage databases, extension data, and browser settings.",
    versionNumber,
  };
  const syncState = syncT3BrowserProfileToLocalMock(input.profile);
  const nextState: T3BrowserProfileMigrationState = {
    ...current,
    auditLog: [
      migrationAudit({
        action: "sync-close",
        actorDeviceName: deviceName,
        previousDeviceName: current.lock?.deviceName ?? null,
        summary: `${deviceName} synced encrypted profile state and released the write lock.`,
      }),
      ...current.auditLog,
    ].slice(0, 12),
    currentDeviceName: null,
    credentialPayload: "blocked",
    lastSourceDeviceName: deviceName,
    lastSyncedAt: syncState.lastSyncedAt,
    latestVersionId: snapshot.id,
    latestVersionNumber: versionNumber,
    lock: null,
    profileLabel: input.profile.label,
    snapshots: [snapshot, ...current.snapshots].slice(0, 8),
    stateClasses: PROFILE_MIGRATION_STATE_CLASSES,
    status: "available",
    summary: `Profile v${versionNumber} is synced from ${deviceName} and released for another authorized device.`,
    syncPayload: "host-managed-encrypted",
  };
  writeMigrationRecords({
    ...records,
    [input.profile.id]: nextState,
  });
  return nextState;
}

export function forceTakeoverT3BrowserProfileMigrationMock(input: {
  deviceName: string;
  profile: T3BrowserProfileDescriptor;
}): T3BrowserProfileMigrationState {
  const deviceName = readText(input.deviceName) ?? "This device";
  const records = readMigrationRecords();
  const current = records[input.profile.id] ?? defaultMigrationState(input.profile);
  const previousDeviceName = current.lock?.deviceName ?? current.currentDeviceName;
  const lock: T3BrowserProfileMigrationLock = {
    acquiredAt: Date.now(),
    deviceName,
    mode: "read-write",
  };
  const nextState: T3BrowserProfileMigrationState = {
    ...current,
    auditLog: [
      migrationAudit({
        action: "force-takeover",
        actorDeviceName: deviceName,
        previousDeviceName,
        summary: `${deviceName} force-took the profile lock from ${previousDeviceName ?? "an unknown device"}.`,
      }),
      ...current.auditLog,
    ].slice(0, 12),
    currentDeviceName: deviceName,
    lock,
    profileLabel: input.profile.label,
    status: "in-use",
    summary:
      "Profile lock was force-taken. The previous device should be treated as stale or read-only until it refreshes.",
  };
  writeMigrationRecords({
    ...records,
    [input.profile.id]: nextState,
  });
  return nextState;
}

export function restoreT3BrowserProfileVersionMock(input: {
  deviceName: string;
  profile: T3BrowserProfileDescriptor;
  versionId?: string | null;
}): T3BrowserProfileMigrationState {
  const deviceName = readText(input.deviceName) ?? "This device";
  const records = readMigrationRecords();
  const current = records[input.profile.id] ?? defaultMigrationState(input.profile);
  const targetSnapshot =
    current.snapshots.find((snapshot) => snapshot.id === input.versionId) ??
    current.snapshots[1] ??
    current.snapshots[0] ??
    null;
  if (!targetSnapshot) {
    throw new Error("No synced profile version is available to restore.");
  }
  const restoredVersionNumber = (current.snapshots[0]?.versionNumber ?? 0) + 1;
  const restoredSnapshot: T3BrowserProfileVersionSnapshot = {
    ...targetSnapshot,
    createdAt: Date.now(),
    id: createLocalId("profile-version"),
    sourceDeviceName: deviceName,
    summary: `Restored from v${targetSnapshot.versionNumber}; encrypted browser-state payload remains cloud-managed.`,
    versionNumber: restoredVersionNumber,
  };
  const nextState: T3BrowserProfileMigrationState = {
    ...current,
    auditLog: [
      migrationAudit({
        action: "restore-version",
        actorDeviceName: deviceName,
        previousDeviceName: targetSnapshot.sourceDeviceName,
        summary: `${deviceName} restored profile state from v${targetSnapshot.versionNumber}.`,
      }),
      ...current.auditLog,
    ].slice(0, 12),
    currentDeviceName: null,
    lastSourceDeviceName: deviceName,
    lastSyncedAt: restoredSnapshot.createdAt,
    latestVersionId: restoredSnapshot.id,
    latestVersionNumber: restoredVersionNumber,
    lock: null,
    profileLabel: input.profile.label,
    snapshots: [restoredSnapshot, ...current.snapshots].slice(0, 8),
    status: "available",
    summary: `Profile v${restoredVersionNumber} restored from v${targetSnapshot.versionNumber} and released.`,
  };
  writeMigrationRecords({
    ...records,
    [input.profile.id]: nextState,
  });
  return nextState;
}

export function listT3BrowserGuestPasses(profileId?: string): T3BrowserGuestPass[] {
  const passes = readGuestPasses();
  if (!profileId) {
    return passes;
  }
  return passes.filter((pass) => pass.profileId === profileId);
}

export function createT3BrowserGuestPassMock(input: {
  customUrl?: string | null;
  durationHours: number;
  guestLabel: string;
  profile: T3BrowserProfileDescriptor;
  providerId: T3BrowserProvider;
}): T3BrowserGuestPass {
  const providerId = ensureSeatPoolProvider(input.providerId);
  const siteScope = resolveSiteScope({
    customUrl: input.customUrl,
    providerId: input.providerId,
  });
  const syncState = getT3BrowserProfileSyncState(input.profile);
  if (!syncState.remoteSessionAvailable || syncState.credentialPayload !== "blocked") {
    throw new Error("Sync this profile to the Hugerouter mock before creating a guest pass.");
  }
  const guestLabel = readText(input.guestLabel) ?? "Friend";
  const durationHours = Number.isFinite(input.durationHours)
    ? Math.min(Math.max(input.durationHours, 1), 24)
    : 2;
  const id = createGuestPassId();
  const createdAt = Date.now();
  const nextPass: T3BrowserGuestPass = {
    auditMode: "owner-visible",
    createdAt,
    credentialPayload: "blocked",
    expiresAt: createdAt + durationHours * 60 * 60 * 1000,
    guestLabel,
    id,
    inviteCode: createInviteCode(id),
    ownerApproval: "required-for-sensitive-actions",
    permissionMode: "supervised-use",
    profileId: input.profile.id,
    profileLabel: input.profile.label,
    providerId,
    revokedAt: null,
    sensitiveActionsBlocked: GUEST_PASS_BLOCKED_ACTIONS,
    siteId: siteScope.siteId,
    siteLabel: siteScope.siteLabel,
    siteOrigin: siteScope.siteOrigin,
    status: "active",
    summary:
      "Guest can use the remote browser session while account settings, billing, security changes, and credential export remain blocked.",
  };
  writeGuestPasses([nextPass, ...readGuestPasses()]);
  return nextPass;
}

export function revokeT3BrowserGuestPassMock(passId: string): T3BrowserGuestPass[] {
  const passes = readGuestPasses();
  const nextPasses = passes.map((pass) =>
    pass.id === passId
      ? {
          ...pass,
          revokedAt: Date.now(),
          status: "revoked" as const,
          summary: "Guest pass revoked. Remote-session access is no longer available.",
        }
      : pass
  );
  writeGuestPasses(nextPasses);
  return nextPasses;
}

export function getT3BrowserSeatPoolMock(input: {
  customUrl?: string | null;
  profile: T3BrowserProfileDescriptor;
  providerId: T3BrowserProvider;
}): T3BrowserSeatPool {
  const providerId = ensureSeatPoolProvider(input.providerId);
  const siteScope = resolveSiteScope({
    customUrl: input.customUrl,
    providerId: input.providerId,
  });
  const poolId = buildSeatPoolId({
    profileId: input.profile.id,
    siteId: siteScope.siteId,
  });
  return (
    readSeatPools().find((pool) => pool.id === poolId) ??
    emptySeatPool({
      profile: input.profile,
      providerId,
      siteScope,
    })
  );
}

export function updateT3BrowserSeatPoolCommercialMock(input: {
  customUrl?: string | null;
  listingStatus?: T3BrowserSeatPoolCommercial["listingStatus"];
  platformRental?: {
    discountPriceCents: number;
    enabled: boolean;
    supportedPlatforms: readonly T3SeatPoolRentalPlatform[];
  };
  planType: T3BrowserMembershipPlanType;
  profile: T3BrowserProfileDescriptor;
  providerId: T3BrowserProvider;
  seatLimit: number | null;
  seatPriceCents: number;
}): T3BrowserSeatPool {
  const providerId = ensureSeatPoolProvider(input.providerId);
  const planType = normalizeMembershipPlanType(input.planType, providerId);
  const commercialDefaults = buildCommercialDefaults(providerId, planType);
  const currentPool = getT3BrowserSeatPoolMock({
    customUrl: input.customUrl,
    profile: input.profile,
    providerId: input.providerId,
  });
  const nextPool: T3BrowserSeatPool = {
    ...currentPool,
    commercial: {
      ...commercialDefaults,
      listingStatus: input.listingStatus ?? "listed",
      platformRental: normalizePlatformRental(
        input.platformRental,
        commercialDefaults.platformRental
      ),
      seatPriceCents:
        normalizeSeatPriceCents(input.seatPriceCents) ?? commercialDefaults.seatPriceCents,
    },
    seatLimit: normalizeSeatLimit(input.seatLimit),
    summary:
      providerId === "hugerouter"
        ? "Hugerouter-native listing configured locally. Carpool, rental, platform leasing, and compatible AI service routing are supported by Hugerouter product policy."
        : "Commercial listing configured locally. Pricing and plan filters are mock metadata; payments and provider policy checks are deferred.",
  };
  const pools = readSeatPools();
  writeSeatPools([nextPool, ...pools.filter((pool) => pool.id !== nextPool.id)]);
  return nextPool;
}

export function listT3BrowserSeatPoolListings(input?: {
  planType?: T3BrowserMembershipPlanType | "all";
  providerId?: Exclude<T3BrowserProvider, "custom"> | "all";
  siteId?: string | "all";
}): T3BrowserSeatPoolListing[] {
  return readSeatPools()
    .filter((pool) => pool.commercial.listingStatus === "listed")
    .filter(
      (pool) =>
        !input?.providerId || input.providerId === "all" || pool.providerId === input.providerId
    )
    .filter((pool) => !input?.siteId || input.siteId === "all" || pool.siteId === input.siteId)
    .filter(
      (pool) =>
        !input?.planType || input.planType === "all" || pool.commercial.planType === input.planType
    )
    .map((pool) => ({
      availableSeats:
        pool.seatLimit === null ? null : Math.max(pool.seatLimit - pool.memberCount, 0),
      commercial: pool.commercial,
      memberCount: pool.memberCount,
      poolId: pool.id,
      profileId: pool.profileId,
      profileLabel: pool.profileLabel,
      providerId: pool.providerId,
      seatLimit: pool.seatLimit,
      siteId: pool.siteId,
      siteLabel: pool.siteLabel,
      siteOrigin: pool.siteOrigin,
    }));
}

export function addT3BrowserSeatPoolMemberMock(input: {
  customUrl?: string | null;
  memberLabel: string;
  profile: T3BrowserProfileDescriptor;
  providerId: T3BrowserProvider;
}): T3BrowserSeatPool {
  const providerId = ensureSeatPoolProvider(input.providerId);
  const currentPool = getT3BrowserSeatPoolMock({
    customUrl: input.customUrl,
    profile: input.profile,
    providerId: input.providerId,
  });
  const activeMemberCount = currentPool.members.filter(
    (member) => member.status === "active"
  ).length;
  if (currentPool.seatLimit !== null && activeMemberCount >= currentPool.seatLimit) {
    throw new Error("This commercial seat pool is full.");
  }
  const label = readText(input.memberLabel) ?? `Member ${activeMemberCount + 1}`;
  const pass = createT3BrowserGuestPassMock({
    durationHours: 24,
    guestLabel: label,
    profile: input.profile,
    providerId: input.providerId,
    customUrl: input.customUrl,
  });
  const nextMember: T3BrowserSeatPoolMember = {
    createdAt: Date.now(),
    guestPassId: pass.id,
    id: `seat-member:${pass.id}`,
    inviteCode: pass.inviteCode,
    label,
    lastUsedAt: null,
    seatNumber: nextSeatNumber(currentPool.members),
    status: "active",
  };
  const nextPool: T3BrowserSeatPool = {
    ...currentPool,
    memberCount: activeMemberCount + 1,
    members: [...currentPool.members, nextMember].sort(
      (left, right) => left.seatNumber - right.seatNumber
    ),
    summary:
      providerId === "hugerouter"
        ? "Hugerouter-native seat added. Carpool, rental, and platform leasing are supported by Hugerouter product policy."
        : "Seat pool member added with a supervised Guest Pass. Device and provider policy enforcement is deferred to the Hugerouter policy layer.",
  };
  const pools = readSeatPools();
  writeSeatPools([nextPool, ...pools.filter((pool) => pool.id !== nextPool.id)]);
  return nextPool;
}

export function pauseT3BrowserSeatPoolMemberMock(input: {
  memberId: string;
  poolId: string;
}): T3BrowserSeatPool | null {
  const pools = readSeatPools();
  let updatedPool: T3BrowserSeatPool | null = null;
  const nextPools = pools.map((pool) => {
    if (pool.id !== input.poolId) {
      return pool;
    }
    const nextMembers = pool.members.map((member) => {
      if (member.id !== input.memberId) {
        return member;
      }
      revokeT3BrowserGuestPassMock(member.guestPassId);
      return {
        ...member,
        status: "paused" as const,
      };
    });
    updatedPool = {
      ...pool,
      memberCount: nextMembers.filter((member) => member.status === "active").length,
      members: nextMembers,
      summary: "Seat paused and its Guest Pass revoked.",
    };
    return updatedPool;
  });
  writeSeatPools(nextPools);
  return updatedPool;
}

export function listT3BrowserIsolatedApps(profileId?: string): T3BrowserIsolatedApp[] {
  const apps = readIsolatedApps();
  if (!profileId) {
    return apps;
  }
  return apps.filter((app) => app.profileId === profileId);
}

export function createT3BrowserIsolatedAppMock(input: {
  customUrl?: string | null;
  label: string;
  profile: T3BrowserProfileDescriptor;
  providerId: T3BrowserProvider;
}): T3BrowserIsolatedApp {
  const targetUrl = resolveProviderUrl({
    customUrl: input.customUrl,
    providerId: input.providerId,
  });
  const siteScope = buildT3HugerouterSiteScope(targetUrl);
  const label =
    readText(input.label) ??
    `${providerDisplayName(input.providerId)} app ${readIsolatedApps().length + 1}`;
  const id = createLocalId("isolated-app");
  const app: T3BrowserIsolatedApp = {
    appKey: `app-scope:${id}`,
    createdAt: Date.now(),
    credentialPayload: "blocked",
    id,
    isolationMode: "local-mock-app-scope",
    label,
    lastOpenedAt: null,
    launchCount: 0,
    profileId: input.profile.id,
    profileLabel: input.profile.label,
    providerId: input.providerId,
    siteId: siteScope.siteId,
    siteLabel: siteScope.siteLabel,
    siteOrigin: siteScope.siteOrigin,
    storageBoundary: "electron-partition-pending",
    targetUrl,
  };
  writeIsolatedApps([app, ...readIsolatedApps()]);
  return app;
}

export function removeT3BrowserIsolatedAppMock(appId: string): T3BrowserIsolatedApp[] {
  const nextApps = readIsolatedApps().filter((app) => app.id !== appId);
  writeIsolatedApps(nextApps);
  return nextApps;
}

function markIsolatedAppOpened(appId: string) {
  const apps = readIsolatedApps();
  const nextApps = apps.map((app) =>
    app.id === appId
      ? {
          ...app,
          lastOpenedAt: Date.now(),
          launchCount: app.launchCount + 1,
        }
      : app
  );
  writeIsolatedApps(nextApps);
  return nextApps.find((app) => app.id === appId) ?? null;
}

function normalizeRecentSession(value: unknown): T3BrowserRecentSession | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as Partial<T3BrowserRecentSession>;
  const id = readText(record.id);
  const profileId = readText(record.profileId);
  const profileLabel = readText(record.profileLabel);
  const title = readText(record.title);
  const url = safeNormalizeProductUrl(readText(record.url));
  if (!id || !profileId || !profileLabel || !title || !url || typeof record.openedAt !== "number") {
    return null;
  }
  const providerId: T3BrowserProvider = isBrowserProvider(record.providerId)
    ? record.providerId
    : "custom";
  const fallbackSiteScope = safeT3HugerouterSiteScope(url);
  const siteId = readText(record.siteId) ?? fallbackSiteScope?.siteId;
  const siteOrigin = readText(record.siteOrigin) ?? fallbackSiteScope?.siteOrigin;
  const siteLabel = readText(record.siteLabel) ?? fallbackSiteScope?.siteLabel;
  if (!siteId || !siteOrigin || !siteLabel) {
    return null;
  }
  return {
    fingerprintPolicy: "native-transparent",
    id,
    isolatedAppId: readText(record.isolatedAppId),
    isolatedAppLabel: readText(record.isolatedAppLabel),
    openedAt: record.openedAt,
    profileId,
    profileLabel,
    providerId,
    siteId,
    siteLabel,
    siteOrigin,
    title,
    url,
  };
}

export function listT3BrowserRecentSessions(): T3BrowserRecentSession[] {
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(RECENT_SESSIONS_STORAGE_KEY) ?? "[]"
    ) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .map(normalizeRecentSession)
      .filter((session): session is T3BrowserRecentSession => session !== null)
      .sort((left, right) => right.openedAt - left.openedAt)
      .slice(0, 8);
  } catch {
    return [];
  }
}

export function buildT3BrowserProductContinuity(input: {
  customUrl?: string | null;
  profile: T3BrowserProfileDescriptor;
  providerId: T3BrowserProvider;
  recentSessions?: readonly T3BrowserRecentSession[];
  syncState?: T3BrowserProfileSyncState | null;
}): T3BrowserProductContinuity {
  const url = resolveProviderUrl({
    customUrl: input.customUrl,
    providerId: input.providerId,
  });
  const siteScope = buildT3HugerouterSiteScope(url);
  const syncState = input.syncState ?? getT3BrowserProfileSyncState(input.profile);
  const recentProductSessions = (input.recentSessions ?? listT3BrowserRecentSessions())
    .filter(
      (session) => session.profileId === input.profile.id && session.siteId === siteScope.siteId
    )
    .slice(0, 4);
  const remoteSessionAvailable =
    syncState.accountPortability === "remote-session" && syncState.remoteSessionAvailable;
  const status = remoteSessionAvailable ? "ready" : "needs-sync";
  const deviceCount = Math.max(syncState.deviceCount, remoteSessionAvailable ? 2 : 1);
  return {
    accountPortability: syncState.accountPortability,
    credentialPayload: "blocked",
    deviceCount,
    deviceLimit: syncState.deviceLimit,
    devicePolicy: syncState.devicePolicy,
    fingerprintPolicy: input.profile.fingerprintPolicy,
    launchMode: remoteSessionAvailable ? "remote-session-handoff" : "local-session-only",
    profileId: input.profile.id,
    profileLabel: input.profile.label,
    recentProductSessions,
    remoteSessionAvailable,
    siteId: siteScope.siteId,
    siteLabel: siteScope.siteLabel,
    siteOrigin: siteScope.siteOrigin,
    status,
    summary: remoteSessionAvailable
      ? `${siteScope.siteLabel} can be resumed through Hugerouter encrypted profile-state migration across ${deviceCount} trusted devices. Raw credential export remains blocked.`
      : `${siteScope.siteLabel} is local to this browser profile until Hugerouter sync records a remote-session reference. Credentials remain blocked from sync.`,
  };
}

function rememberRecentSession(input: {
  isolatedApp?: T3BrowserIsolatedApp | null;
  profile: T3BrowserProfileDescriptor;
  providerId: T3BrowserProvider;
  url: string;
}) {
  const parsed = new URL(input.url);
  const siteScope = buildT3HugerouterSiteScope(input.url);
  const recentSession: T3BrowserRecentSession = {
    fingerprintPolicy: input.profile.fingerprintPolicy,
    id: `${input.isolatedApp?.id ?? input.profile.id}:${siteScope.siteId}`,
    isolatedAppId: input.isolatedApp?.id ?? null,
    isolatedAppLabel: input.isolatedApp?.label ?? null,
    openedAt: Date.now(),
    profileId: input.profile.id,
    profileLabel: input.profile.label,
    providerId: input.providerId,
    siteId: siteScope.siteId,
    siteLabel: siteScope.siteLabel,
    siteOrigin: siteScope.siteOrigin,
    title:
      input.providerId === "custom"
        ? parsed.hostname
        : `${providerDisplayName(input.providerId)} in ${input.profile.label}`,
    url: input.url,
  };
  const nextSessions = [
    recentSession,
    ...listT3BrowserRecentSessions().filter((session) => session.id !== recentSession.id),
  ].slice(0, 8);
  window.localStorage.setItem(RECENT_SESSIONS_STORAGE_KEY, JSON.stringify(nextSessions));
}

function resolveProviderUrl(input: Pick<OpenT3BrowserProviderInput, "customUrl" | "providerId">) {
  if (input.providerId === "custom") {
    const customUrl = readText(input.customUrl);
    if (!customUrl) {
      throw new Error("Enter a web product URL before opening a custom browser session.");
    }
    return normalizeProductUrl(customUrl);
  }
  return PROVIDER_URLS[input.providerId];
}

export function buildT3BrowserLaunchUrl(input: {
  assistant?: OpenT3BrowserProviderInput["assistant"];
  captureMode?: OpenT3BrowserProviderInput["captureMode"];
  isolatedApp?: T3BrowserIsolatedApp | null;
  profile: T3BrowserProfileDescriptor;
  providerId: T3BrowserProvider;
  url: string;
}) {
  const continuity = buildT3BrowserProductContinuity({
    customUrl: input.url,
    profile: input.profile,
    providerId: input.providerId,
    syncState: getT3BrowserProfileSyncState(input.profile),
  });
  const launchUrl = new URL(window.location.href);
  launchUrl.search = "";
  launchUrl.hash = "";
  launchUrl.searchParams.set("hcbrowser", "1");
  launchUrl.searchParams.set("target", input.url);
  launchUrl.searchParams.set("provider", input.providerId);
  launchUrl.searchParams.set("profile", input.profile.label);
  launchUrl.searchParams.set("profileId", input.profile.id);
  launchUrl.searchParams.set("fingerprint", input.profile.fingerprintPolicy);
  launchUrl.searchParams.set("continuity", continuity.status);
  launchUrl.searchParams.set("continuityMode", continuity.launchMode);
  launchUrl.searchParams.set("deviceCount", String(continuity.deviceCount));
  launchUrl.searchParams.set("siteOrigin", continuity.siteOrigin);
  if (input.isolatedApp) {
    launchUrl.searchParams.set("appId", input.isolatedApp.id);
    launchUrl.searchParams.set("appLabel", input.isolatedApp.label);
    launchUrl.searchParams.set("appKey", input.isolatedApp.appKey);
    launchUrl.searchParams.set("isolation", input.isolatedApp.isolationMode);
  }
  if (input.assistant === "chatgpt") {
    launchUrl.searchParams.set("chatgptAssistant", "1");
  }
  if (input.assistant === "ldxp") {
    launchUrl.searchParams.set("ldxpAssistant", "1");
  }
  if (input.captureMode === "operator-delivery") {
    launchUrl.searchParams.set("captureMode", input.captureMode);
  }
  return launchUrl.toString();
}

function openProviderWindow(
  input: OpenT3BrowserProviderInput,
  profile: T3BrowserProfileDescriptor
) {
  const isolatedApp = input.isolatedAppId
    ? (readIsolatedApps().find((app) => app.id === input.isolatedAppId) ?? null)
    : null;
  const openedApp = isolatedApp ? (markIsolatedAppOpened(isolatedApp.id) ?? isolatedApp) : null;
  const url = openedApp?.targetUrl ?? resolveProviderUrl(input);
  rememberRecentSession({
    isolatedApp: openedApp,
    profile,
    providerId: openedApp?.providerId ?? input.providerId,
    url,
  });
  window.open(
    buildT3BrowserLaunchUrl({
      isolatedApp: openedApp,
      profile,
      assistant: input.assistant,
      captureMode: input.captureMode,
      providerId: openedApp?.providerId ?? input.providerId,
      url,
    }),
    "_blank",
    "popup,width=1180,height=860,noopener,noreferrer"
  );
}

export function createT3BrowserProfileBridge(): T3BrowserProfileBridge {
  const hostBridge = window.__HUGECODE_T3_BROWSER_PROFILES__;
  return {
    async listProfiles() {
      if (hostBridge?.listProfiles) {
        return hostBridge.listProfiles();
      }
      return [currentBrowserProfile(), ...readStoredRemoteProfiles()];
    },
    async openProvider(input) {
      if (hostBridge?.openProvider) {
        return hostBridge.openProvider(input);
      }
      const profiles = [currentBrowserProfile(), ...readStoredRemoteProfiles()];
      const profile =
        profiles.find((candidate) => candidate.id === input.profileId) ?? currentBrowserProfile();
      openProviderWindow(input, profile);
      return {
        ...profile,
        status: "connected",
        statusMessage:
          profile.source === "remote-devtools"
            ? "Remote profile reference selected. HugeCode did not copy browser credentials."
            : "Web product opened with the current browser profile; credentials stay in the browser.",
      };
    },
    async removeProfile(profileId) {
      if (hostBridge?.removeProfile) {
        return hostBridge.removeProfile(profileId);
      }
      const nextProfiles = readStoredRemoteProfiles().filter((profile) => profile.id !== profileId);
      writeStoredRemoteProfiles(nextProfiles);
      return [currentBrowserProfile(), ...nextProfiles];
    },
    async saveRemoteProfile(input) {
      if (hostBridge?.saveRemoteProfile) {
        return hostBridge.saveRemoteProfile(input);
      }
      const endpointUrl = normalizeEndpointUrl(input.endpointUrl);
      const profile: T3BrowserProfileDescriptor = {
        endpointUrl,
        fingerprintPolicy: "native-transparent",
        id: buildRemoteProfileId(endpointUrl),
        label: readText(input.label) ?? new URL(endpointUrl).host,
        providerIds: PROVIDERS,
        securityModel: "remote-devtools-reference",
        source: "remote-devtools",
        status: "available",
        statusMessage:
          "Remote DevTools profile saved as a reference. Cookies and tokens stay remote.",
      };
      const profiles = readStoredRemoteProfiles().filter(
        (candidate) => candidate.id !== profile.id
      );
      const nextProfiles = [...profiles, profile];
      writeStoredRemoteProfiles(nextProfiles);
      return [currentBrowserProfile(), ...nextProfiles];
    },
  };
}

export function providerUrl(providerId: T3BrowserProvider): string {
  if (providerId === "custom") {
    return "about:blank";
  }
  return PROVIDER_URLS[providerId];
}

export function buildT3BrowserFingerprintSummary(input?: {
  policy?: T3BrowserFingerprintPolicy;
  remoteReference?: boolean;
}): T3BrowserFingerprintSummary {
  const userAgent = window.navigator.userAgent;
  return {
    browserFamily: browserFamilyFromUserAgent(userAgent),
    deviceClass: deviceClassFromUserAgent(userAgent),
    disclosure:
      "Native fingerprint transparency: HugeCode shows browser-exposed attributes but does not spoof, randomize, or bypass site risk controls.",
    language: window.navigator.language || "unknown",
    policy: input?.policy ?? "native-transparent",
    stability: input?.remoteReference ? "remote-reference" : "native",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "unknown",
  };
}
