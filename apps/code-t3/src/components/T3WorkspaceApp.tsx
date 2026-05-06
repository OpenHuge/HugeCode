import { Button, Card, Checkbox, Chip, Input } from "@heroui/react";
import {
  AppWindow,
  Fingerprint,
  ExternalLink,
  Globe2,
  RefreshCw,
  Settings,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildHugeCodeAgentTaskStartRequest,
  mapHugeCodeRuntimeEventToT3TimelineEvent,
  refreshT3ProviderCatalog,
  type T3CodeProviderKind,
  type T3CodeProviderModelOption,
  type T3CodeProviderModelOptionsByProvider,
  type T3CodeProviderRoute,
  type T3CodeTimelineEvent,
} from "@ku0/code-t3-runtime-adapter";
import type { HugeCodeRuntimeBridge } from "@ku0/code-t3-runtime-adapter";
import {
  T3ChatWorkspaceChrome,
  type T3ComposerAccessMode,
  type T3ComposerMode,
  type T3ComposerReasonEffort,
} from "./T3ChatWorkspaceChrome";
import { T3BrowserCloudSyncCard } from "./T3BrowserCloudSyncCard";
import { T3HugeRouterCommercialCard } from "./T3HugeRouterCommercialCard";
import { T3OperatorWorkspacePanel } from "./T3OperatorWorkspacePanel";
import { T3ProductLaunchPanel } from "./T3ProductLaunchPanel";
import {
  T3WorkspaceAssistantEntries,
  type T3WorkspaceAssistantPage,
} from "./T3WorkspaceAssistantEntries";
import { T3BrowserStaticDataImportInput } from "./T3BrowserStaticDataImportInput";
import { T3OperatorUnlockDialog } from "./T3OperatorUnlockDialog";
import { T3WorkspaceSidebar } from "./T3WorkspaceSidebar";
import {
  browserProviderTitle,
  formatBrowserSyncTime,
  formatCredits,
  formatGuestPassExpiry,
  formatSeatPrice,
} from "./t3WorkspaceLabels";
import {
  detectT3WorkspaceLocale,
  getT3WorkspaceAccessModeLabel,
  getT3WorkspaceMessages,
  T3_WORKSPACE_LOCALE_STORAGE_KEY,
  type T3WorkspaceLocale,
} from "./t3WorkspaceLocale";
import { useT3HugeRouterCommercialService } from "./useT3HugeRouterCommercialService";
import {
  buildT3BrowserFingerprintSummary,
  buildT3BrowserProductContinuity,
  buildT3AiGatewaySummaryMock,
  buildT3HugerouterSiteScope,
  addT3BrowserSeatPoolMemberMock,
  createT3AiGatewayRouteMock,
  createT3HugerouterCapacityListingMock,
  createT3HugerouterCapacityOrderMock,
  createT3BrowserIsolatedAppMock,
  createT3BrowserGuestPassMock,
  createT3BrowserProfileBridge,
  forceTakeoverT3BrowserProfileMigrationMock,
  getT3BrowserProfileMigrationState,
  getT3BrowserProfileSyncState,
  getT3BrowserSeatPoolMock,
  listT3AiGatewayRoutesMock,
  listT3HugerouterCapacityListingsMock,
  listT3HugerouterCapacityOrdersMock,
  listT3BrowserSeatPoolListings,
  listT3BrowserIsolatedApps,
  listT3BrowserGuestPasses,
  listT3BrowserRecentSessions,
  pauseT3BrowserSeatPoolMemberMock,
  removeT3BrowserIsolatedAppMock,
  refundT3HugerouterCapacityOrderMock,
  revokeT3BrowserGuestPassMock,
  settleT3HugerouterCapacityOrderMock,
  syncT3BrowserProfileToLocalMock,
  openT3BrowserProfileMigrationMock,
  restoreT3BrowserProfileVersionMock,
  syncCloseT3BrowserProfileMigrationMock,
  updateT3BrowserSeatPoolCommercialMock,
  T3_AI_GATEWAY_ROUTE_MODE_OPTIONS,
  T3_BROWSER_MEMBERSHIP_PLAN_OPTIONS,
  T3_HUGEROUTER_MEMBERSHIP_TIER_OPTIONS,
  T3_SEAT_POOL_RENTAL_PLATFORM_OPTIONS,
  type T3AiGatewayRoute,
  type T3AiGatewayRouteMode,
  type T3HugerouterCapacityListing,
  type T3HugerouterCapacityOrder,
  type T3HugerouterCapacitySource,
  type T3HugerouterMembershipTier,
  type T3BrowserGuestPass,
  type T3BrowserIsolatedApp,
  type T3BrowserMembershipPlanType,
  type T3BrowserProfileMigrationState,
  type T3BrowserProductContinuity,
  type T3BrowserProfileDescriptor,
  type T3BrowserProfileSyncState,
  type T3BrowserProvider,
  type T3BrowserRecentSession,
  type T3BrowserSeatPool,
  type T3BrowserSeatPoolListing,
  type T3SeatPoolRentalPlatform,
} from "../runtime/t3BrowserProfiles";
import {
  buildT3BrowserProfileOperationsReport,
  type T3BrowserProfileOperationsReport,
} from "../runtime/t3BrowserProfileOperations";
import {
  checkT3OperatorBrowserChatGptLoginState,
  formatT3BrowserStaticDataImportError,
  importT3BrowserStaticDataLoginStateBundles,
  importT3BrowserStaticDataBundle,
  requireT3BrowserAccountDataImportSecret as requireImportSecret,
  serializeT3OperatorBrowserStaticDataBundleWithLoginState,
  type T3BrowserLoginStatePreflightResult,
} from "../runtime/t3BrowserStaticData";
import { T3_BROWSER_IMPORTED_DATA_READY_STORAGE_KEY } from "../runtime/t3BrowserLoginWitness";
import {
  readT3RuntimeEventSnapshot,
  resolveT3RuntimeEventsEndpoint,
} from "../runtime/t3RuntimeEventSnapshot";
import {
  createT3DeliveryExportWitness,
  normalizeT3DeliveryProjection,
  readT3DeliveryStatus,
  type T3DeliveryArtifactUpload,
  type T3DeliveryProjection,
  type T3DeliveryStatus,
} from "../runtime/t3DeliveryService";
import { restoreT3CustomerBrowserDelivery } from "../runtime/t3CustomerBrowserDeliveryRestore";
import {
  readT3OperatorUnlockState,
  readT3P0RuntimeRoleMode,
  verifyT3OperatorLocalPassword,
  writeT3OperatorUnlockState,
} from "../runtime/t3P0RuntimeRole";

type T3WorkspaceAppProps = {
  runtimeBridge: HugeCodeRuntimeBridge;
};

type T3WorkspacePage = "chat" | "browser";

const providerOrder: T3CodeProviderKind[] = ["codex", "claudeAgent"];
const browserProviderOrder: T3BrowserProvider[] = ["hugerouter", "chatgpt", "gemini", "custom"];
const T3_CUSTOMER_DELIVERY_BLOCKING_STATUSES = new Set<T3DeliveryStatus>([
  "expired",
  "failed",
  "fileUnavailable",
  "revoked",
  "unavailable",
]);
const T3_BROWSER_DELIVERY_PROJECTION_STORAGE_KEY = "hugecode:t3-browser-delivery-projection:v1";
const T3_CUSTOMER_EMBEDDED_BROWSER_URL = "https://chatgpt.com/";

type EmbeddedBrowserBounds = {
  height: number;
  width: number;
  x: number;
  y: number;
};

type EmbeddedBrowserBridge = {
  hide(): Promise<unknown>;
  setBounds(input: { bounds: EmbeddedBrowserBounds }): Promise<unknown>;
  show(input: { bounds: EmbeddedBrowserBounds; url: string }): Promise<unknown>;
  subscribeAuthRequired?(listener: (payload: unknown) => void): () => void;
};

type EmbeddedBrowserAuthRequiredPayload = {
  message?: string;
  reason?: string;
  url?: string;
};

type OperatorUnlockOverlaySubmitPayload = {
  password: string;
  requestId: string;
};

type OperatorUnlockOverlayBridge = {
  close(): Promise<unknown>;
  resolveSubmit(input: {
    message?: string | null;
    ok: boolean;
    requestId: string;
  }): Promise<unknown>;
  show(): Promise<unknown>;
  subscribeSubmit(listener: (payload: OperatorUnlockOverlaySubmitPayload) => void): () => void;
};

type BrowserAssistantEntry = {
  kind: "chatgpt" | "ldxp";
  label: string;
};

function debugStringMeta(value: string) {
  return {
    length: value.length,
    prefix: value.slice(0, 8),
    suffix: value.slice(-4),
  };
}

function debugProjection(projection: T3DeliveryProjection | null | undefined) {
  if (!projection) {
    return null;
  }
  return {
    activationId: projection.activationId,
    artifactId: projection.artifactId,
    deliveryId: projection.deliveryId,
    effectiveUntil: projection.effectiveUntil,
    entitlementEndsAt: projection.entitlementEndsAt,
    entitlementId: projection.entitlementId,
    fileHash: projection.fileHash,
    hasActivationCode: !!projection.activationCode,
    hasBrowserFileUnlockCode: !!projection.browserFileUnlockCode,
    status: projection.status,
    summary: projection.summary,
    updatedAt: projection.updatedAt,
  };
}

function debugError(error: unknown) {
  return error instanceof Error
    ? {
        message: error.message,
        name: error.name,
        stack: error.stack?.split("\n").slice(0, 8).join("\n") ?? null,
      }
    : { message: String(error), name: typeof error };
}

function writeOpenHugeConsumerDebug(event: string, payload: Record<string, unknown> = {}) {
  const host = (
    window as Window & {
      hugeCodeDesktopHost?: {
        openHugeConsumerDebug?: {
          write(event: string, payload?: Record<string, unknown>): Promise<unknown>;
        };
      };
    }
  ).hugeCodeDesktopHost;
  void host?.openHugeConsumerDebug?.write(event, payload).catch(() => undefined);
}

function customerDeliveryOpenBlocked(projection: T3DeliveryProjection | null | undefined) {
  return projection ? T3_CUSTOMER_DELIVERY_BLOCKING_STATUSES.has(projection.status) : true;
}

function customerDeliveryAuthorityExpiresAt(projection: T3DeliveryProjection | null | undefined) {
  return projection?.entitlementEndsAt ?? projection?.effectiveUntil ?? null;
}

function parseProjectionDate(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function customerDeliveryLocallyExpired(
  projection: T3DeliveryProjection | null | undefined,
  now = Date.now()
) {
  const expiresAt = parseProjectionDate(customerDeliveryAuthorityExpiresAt(projection));
  return expiresAt !== null && expiresAt <= now;
}

function customerDeliveryCanUseLocal(projection: T3DeliveryProjection | null | undefined) {
  return (
    !!projection?.deliveryId &&
    !customerDeliveryOpenBlocked(projection) &&
    !customerDeliveryLocallyExpired(projection)
  );
}

function readElementViewportBounds(element: HTMLElement | null): EmbeddedBrowserBounds | null {
  if (!element) {
    return null;
  }
  const rect = element.getBoundingClientRect();
  if (rect.width < 1 || rect.height < 1) {
    return null;
  }
  return {
    height: Math.round(rect.height),
    width: Math.round(rect.width),
    x: Math.round(rect.left),
    y: Math.round(rect.top),
  };
}

function getEmbeddedBrowserBridge() {
  const host = (
    window as Window & {
      hugeCodeDesktopHost?: {
        embeddedBrowser?: EmbeddedBrowserBridge;
      };
    }
  ).hugeCodeDesktopHost;
  return host?.embeddedBrowser ?? null;
}

function normalizeEmbeddedBrowserAuthRequiredPayload(
  value: unknown
): EmbeddedBrowserAuthRequiredPayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  const record = value as Record<string, unknown>;
  return {
    message: typeof record.message === "string" ? record.message : undefined,
    reason: typeof record.reason === "string" ? record.reason : undefined,
    url: typeof record.url === "string" ? record.url : undefined,
  };
}

function isOperatorUnlockOverlaySubmitPayload(
  value: unknown
): value is OperatorUnlockOverlaySubmitPayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return typeof record.requestId === "string" && typeof record.password === "string";
}

function getOperatorUnlockOverlayBridge() {
  const host = (
    window as Window & {
      hugeCodeDesktopHost?: {
        operatorUnlockOverlay?: OperatorUnlockOverlayBridge;
      };
    }
  ).hugeCodeDesktopHost;
  return host?.operatorUnlockOverlay ?? null;
}

function persistedBrowserDeliveryProjection(
  projection: T3DeliveryProjection
): T3DeliveryProjection {
  return {
    ...projection,
    activationCode: null,
    browserFileUnlockCode: null,
  };
}

function readPersistedBrowserDeliveryProjection() {
  const raw = window.localStorage.getItem(T3_BROWSER_DELIVERY_PROJECTION_STORAGE_KEY);
  if (!raw) {
    writeOpenHugeConsumerDebug("renderer.deliveryProjection.persisted.missing");
    return null;
  }
  try {
    const projection = normalizeT3DeliveryProjection(JSON.parse(raw));
    writeOpenHugeConsumerDebug("renderer.deliveryProjection.persisted.loaded", {
      projection: debugProjection(projection),
    });
    return projection;
  } catch (error) {
    window.localStorage.removeItem(T3_BROWSER_DELIVERY_PROJECTION_STORAGE_KEY);
    writeOpenHugeConsumerDebug("renderer.deliveryProjection.persisted.invalidCleared", {
      error: debugError(error),
      rawLength: raw.length,
    });
    return null;
  }
}

function readInitialBrowserDataImported() {
  const imported = window.localStorage.getItem(T3_BROWSER_IMPORTED_DATA_READY_STORAGE_KEY) === "1";
  if (!imported) {
    writeOpenHugeConsumerDebug("renderer.browserDataImported.initial.false");
    return false;
  }
  if (readT3P0RuntimeRoleMode() !== "customer") {
    writeOpenHugeConsumerDebug("renderer.browserDataImported.initial.productionTrue");
    return true;
  }
  const projection = readPersistedBrowserDeliveryProjection();
  if (customerDeliveryCanUseLocal(projection)) {
    writeOpenHugeConsumerDebug("renderer.browserDataImported.initial.customerTrue", {
      projection: debugProjection(projection),
    });
    return true;
  }
  window.localStorage.removeItem(T3_BROWSER_IMPORTED_DATA_READY_STORAGE_KEY);
  writeOpenHugeConsumerDebug("renderer.browserDataImported.initial.staleCleared", {
    importedFlagWasSet: true,
    projection: debugProjection(projection),
  });
  return false;
}

function writePersistedBrowserDeliveryProjection(projection: T3DeliveryProjection) {
  if (!projection.deliveryId) {
    writeOpenHugeConsumerDebug("renderer.deliveryProjection.persisted.skipNoDeliveryId", {
      projection: debugProjection(projection),
    });
    return;
  }
  window.localStorage.setItem(
    T3_BROWSER_DELIVERY_PROJECTION_STORAGE_KEY,
    JSON.stringify(persistedBrowserDeliveryProjection(projection))
  );
  writeOpenHugeConsumerDebug("renderer.deliveryProjection.persisted.written", {
    projection: debugProjection(projection),
  });
}

function isLdxpBrowserAssistantUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.hostname === "pay.ldxp.cn" && parsed.pathname.startsWith("/shop/ku0");
  } catch {
    return false;
  }
}

const commercialPlanOptions = Object.entries(T3_BROWSER_MEMBERSHIP_PLAN_OPTIONS).map(
  ([planType, plan]) => ({
    ...plan,
    planType: planType as T3BrowserMembershipPlanType,
  })
);
const aiGatewayRouteModeOptions = Object.entries(T3_AI_GATEWAY_ROUTE_MODE_OPTIONS).map(
  ([routeMode, option]) => ({
    ...option,
    routeMode: routeMode as T3AiGatewayRouteMode,
  })
);
const hugerouterTierOptions = Object.entries(T3_HUGEROUTER_MEMBERSHIP_TIER_OPTIONS).map(
  ([tier, option]) => ({
    ...option,
    tier: tier as T3HugerouterMembershipTier,
  })
);
const hugerouterCapacitySourceOptions = [
  {
    label: "Hugerouter credits",
    sourceKind: "hugerouter-native-credits" as const,
  },
  {
    label: "Authorized pool",
    sourceKind: "provider-authorized-pool" as const,
  },
];
const seatPoolRentalPlatformOptions = Object.entries(T3_SEAT_POOL_RENTAL_PLATFORM_OPTIONS).map(
  ([platform, option]) => ({
    ...option,
    platform: platform as T3SeatPoolRentalPlatform,
  })
);

export function T3WorkspaceApp({ runtimeBridge }: T3WorkspaceAppProps) {
  const [locale, setLocale] = useState<T3WorkspaceLocale>(() => detectT3WorkspaceLocale());
  const [routes, setRoutes] = useState<T3CodeProviderRoute[]>([]);
  const [providerModelOptionsByProvider, setProviderModelOptionsByProvider] =
    useState<T3CodeProviderModelOptionsByProvider>({
      codex: [],
      claudeAgent: [],
    });
  const [selectedProvider, setSelectedProvider] = useState<T3CodeProviderKind>("codex");
  const [selectedModelByProvider, setSelectedModelByProvider] = useState<
    Partial<Record<T3CodeProviderKind, string>>
  >({});
  const [activePage, setActivePage] = useState<T3WorkspacePage>(() => {
    const searchParams = new URLSearchParams(window.location.search);
    return searchParams.get("page") === "browser" ? "browser" : "chat";
  });
  const [browserProvider, setBrowserProvider] = useState<T3BrowserProvider>("hugerouter");
  const [browserProfiles, setBrowserProfiles] = useState<T3BrowserProfileDescriptor[]>([]);
  const [browserRecentSessions, setBrowserRecentSessions] = useState<T3BrowserRecentSession[]>([]);
  const [browserProfileSyncState, setBrowserProfileSyncState] =
    useState<T3BrowserProfileSyncState | null>(null);
  const [browserProfileMigrationState, setBrowserProfileMigrationState] =
    useState<T3BrowserProfileMigrationState | null>(null);
  const [browserMigrationDeviceName, setBrowserMigrationDeviceName] = useState("This device");
  const [browserGuestPasses, setBrowserGuestPasses] = useState<T3BrowserGuestPass[]>([]);
  const [browserIsolatedApps, setBrowserIsolatedApps] = useState<T3BrowserIsolatedApp[]>([]);
  const [browserSeatPool, setBrowserSeatPool] = useState<T3BrowserSeatPool | null>(null);
  const [browserSeatListings, setBrowserSeatListings] = useState<T3BrowserSeatPoolListing[]>([]);
  const [aiGatewayRoutes, setAiGatewayRoutes] = useState<T3AiGatewayRoute[]>([]);
  const [aiGatewayPlanType, setAiGatewayPlanType] =
    useState<T3BrowserMembershipPlanType>("hugerouter-pro");
  const [aiGatewayRouteMode, setAiGatewayRouteMode] =
    useState<T3AiGatewayRouteMode>("official-api");
  const [aiGatewayOwnerLabel, setAiGatewayOwnerLabel] = useState("Team member");
  const [aiGatewayDailyBudget, setAiGatewayDailyBudget] = useState("500");
  const [aiGatewayConcurrency, setAiGatewayConcurrency] = useState("4");
  const [hugerouterListings, setHugerouterListings] = useState<T3HugerouterCapacityListing[]>([]);
  const [hugerouterOrders, setHugerouterOrders] = useState<T3HugerouterCapacityOrder[]>([]);
  const [hugerouterSellerLabel, setHugerouterSellerLabel] = useState("Hugerouter seller");
  const [hugerouterTier, setHugerouterTier] =
    useState<T3HugerouterMembershipTier>("hugerouter-pro");
  const [hugerouterSourceKind, setHugerouterSourceKind] = useState<T3HugerouterCapacitySource>(
    "hugerouter-native-credits"
  );
  const [hugerouterTotalCredits, setHugerouterTotalCredits] = useState("1000000");
  const [hugerouterMinCredits, setHugerouterMinCredits] = useState("50000");
  const [hugerouterUnitPrice, setHugerouterUnitPrice] = useState("0.08");
  const [hugerouterBuyerLabel, setHugerouterBuyerLabel] = useState("Internal buyer");
  const [hugerouterBuyCredits, setHugerouterBuyCredits] = useState("100000");
  const [commercialPlanType, setCommercialPlanType] =
    useState<T3BrowserMembershipPlanType>("hugerouter-pro");
  const [commercialSeatLimit, setCommercialSeatLimit] = useState("unlimited");
  const [commercialSeatPrice, setCommercialSeatPrice] = useState("7.99");
  const [platformRentalEnabled, setPlatformRentalEnabled] = useState(false);
  const [platformRentalDiscountPrice, setPlatformRentalDiscountPrice] = useState("6.39");
  const [platformRentalPlatforms, setPlatformRentalPlatforms] = useState<
    T3SeatPoolRentalPlatform[]
  >(["hugerouter", "chatgpt", "gemini", "claude"]);
  const [seatListingFilter, setSeatListingFilter] = useState<T3BrowserMembershipPlanType | "all">(
    "all"
  );
  const [isolatedAppName, setIsolatedAppName] = useState("Gemini QA");
  const [guestPassRecipient, setGuestPassRecipient] = useState("Friend");
  const [guestPassDurationHours, setGuestPassDurationHours] = useState(2);
  const [seatPoolMemberName, setSeatPoolMemberName] = useState("Member 1");
  const [selectedBrowserProfileId, setSelectedBrowserProfileId] = useState("current-browser");
  const [customProductUrl, setCustomProductUrl] = useState("");
  const [browserProfileBusy, setBrowserProfileBusy] = useState(false);
  const [browserProfileNotice, setBrowserProfileNotice] = useState<string | null>(null);
  const [browserLoginStateStatus, setBrowserLoginStateStatus] =
    useState<T3BrowserLoginStatePreflightResult["status"]>("unknown");
  const [browserAccountImportCode, setBrowserAccountImportCode] = useState("");
  const [browserAccountFileUnlockCode, setBrowserAccountFileUnlockCode] = useState("");
  const [browserDeliveryProjection, setBrowserDeliveryProjection] =
    useState<T3DeliveryProjection | null>(() => readPersistedBrowserDeliveryProjection());
  const [browserDataImported, setBrowserDataImported] = useState(() =>
    readInitialBrowserDataImported()
  );
  const [prompt, setPrompt] = useState("");
  const [workspaceId] = useState("workspace-web");
  const [composerMode, setComposerMode] = useState<T3ComposerMode>("build");
  const [composerAccessMode, setComposerAccessMode] = useState<T3ComposerAccessMode>("full-access");
  const [composerReasonEffort, setComposerReasonEffort] = useState<T3ComposerReasonEffort>("xhigh");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loadingRoutes, setLoadingRoutes] = useState(true);
  const [launching, setLaunching] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<T3CodeTimelineEvent[]>([]);
  const [assistantPage, setAssistantPage] = useState<T3WorkspaceAssistantPage>("home");
  const [operatorUnlockDialogOpen, setOperatorUnlockDialogOpen] = useState(false);
  const [, bumpOperatorUnlockRevision] = useState(0);
  const browserStaticDataImportInputRef = useRef<HTMLInputElement | null>(null);
  const customerEmbeddedBrowserHostRef = useRef<HTMLDivElement | null>(null);
  const runtimeEventsMountedAt = useRef(Date.now());
  const browserProfileBridge = useMemo(() => createT3BrowserProfileBridge(), []);
  const text = getT3WorkspaceMessages(locale);
  const operatorSessionUnlocked = readT3OperatorUnlockState();
  const runtimeRoleMode = readT3P0RuntimeRoleMode();
  const canUseProductionWorkspace = runtimeRoleMode !== "customer";
  const visibleActivePage = canUseProductionWorkspace ? activePage : "chat";
  const customerEmbeddedBrowserActive =
    runtimeRoleMode === "customer" &&
    browserDataImported &&
    customerDeliveryCanUseLocal(browserDeliveryProjection);
  const composerCommands = useMemo(
    () =>
      [
        {
          command: "/model",
          description: text.commandModelDescription,
        },
        {
          command: "/plan",
          description: text.commandPlanDescription,
        },
        {
          command: "/default",
          description: text.commandDefaultDescription,
        },
      ] as const,
    [text]
  );

  useEffect(() => {
    writeOpenHugeConsumerDebug("renderer.workspace.mounted", {
      browserDataImported,
      browserDeliveryProjection: debugProjection(browserDeliveryProjection),
      hasImportedFlag:
        window.localStorage.getItem(T3_BROWSER_IMPORTED_DATA_READY_STORAGE_KEY) === "1",
      hasPersistedProjection:
        window.localStorage.getItem(T3_BROWSER_DELIVERY_PROJECTION_STORAGE_KEY) !== null,
      runtimeRole: readT3P0RuntimeRoleMode(),
    });
    window.localStorage.setItem(T3_WORKSPACE_LOCALE_STORAGE_KEY, locale);
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
  }, []);

  useEffect(() => {
    window.localStorage.setItem(T3_WORKSPACE_LOCALE_STORAGE_KEY, locale);
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
  }, [locale]);

  useEffect(() => {
    if (canUseProductionWorkspace || activePage !== "browser") {
      return;
    }
    setActivePage("chat");
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.delete("page");
    window.history.replaceState(null, "", nextUrl);
  }, [activePage, canUseProductionWorkspace]);

  useEffect(() => {
    if (runtimeRoleMode !== "customer" || !browserDataImported || !browserDeliveryProjection) {
      return;
    }
    const expiresAt = parseProjectionDate(
      customerDeliveryAuthorityExpiresAt(browserDeliveryProjection)
    );
    if (expiresAt === null) {
      return;
    }
    const remainingMs = expiresAt - Date.now();
    if (remainingMs <= 0) {
      clearCustomerBrowserDeliveryState("兑换权益已到期，请重新输入有效兑换码。");
      return;
    }
    const timer = window.setTimeout(
      () => clearCustomerBrowserDeliveryState("兑换权益已到期，请重新输入有效兑换码。"),
      Math.min(remainingMs, 2_147_483_647)
    );
    return () => window.clearTimeout(timer);
  }, [
    browserDataImported,
    browserDeliveryProjection?.deliveryId,
    browserDeliveryProjection?.effectiveUntil,
    browserDeliveryProjection?.entitlementEndsAt,
    runtimeRoleMode,
  ]);

  useEffect(() => {
    const embeddedBrowser = getEmbeddedBrowserBridge();
    if (!embeddedBrowser) {
      return;
    }
    if (!customerEmbeddedBrowserActive) {
      void embeddedBrowser.hide().catch((error: unknown) => {
        writeOpenHugeConsumerDebug("renderer.embeddedBrowser.hide.error", {
          error: debugError(error),
        });
      });
      return;
    }

    let disposed = false;
    let shown = false;
    const syncBounds = () => {
      if (disposed) {
        return;
      }
      const bounds = readElementViewportBounds(customerEmbeddedBrowserHostRef.current);
      if (!bounds) {
        return;
      }
      const operation = shown
        ? embeddedBrowser.setBounds({ bounds })
        : embeddedBrowser.show({ bounds, url: T3_CUSTOMER_EMBEDDED_BROWSER_URL });
      shown = true;
      void operation.catch((error: unknown) => {
        writeOpenHugeConsumerDebug("renderer.embeddedBrowser.sync.error", {
          bounds,
          error: debugError(error),
        });
      });
    };

    syncBounds();
    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => {
            syncBounds();
          });
    if (customerEmbeddedBrowserHostRef.current) {
      resizeObserver?.observe(customerEmbeddedBrowserHostRef.current);
    }
    window.addEventListener("resize", syncBounds);
    return () => {
      disposed = true;
      resizeObserver?.disconnect();
      window.removeEventListener("resize", syncBounds);
      void embeddedBrowser.hide().catch(() => undefined);
    };
  }, [
    browserDeliveryProjection?.deliveryId,
    browserDeliveryProjection?.effectiveUntil,
    browserDeliveryProjection?.entitlementEndsAt,
    customerEmbeddedBrowserActive,
  ]);

  useEffect(() => {
    const embeddedBrowser = getEmbeddedBrowserBridge();
    if (!embeddedBrowser?.subscribeAuthRequired) {
      return;
    }
    return embeddedBrowser.subscribeAuthRequired((payload) => {
      if (readT3P0RuntimeRoleMode() !== "customer") {
        return;
      }
      const normalizedPayload = normalizeEmbeddedBrowserAuthRequiredPayload(payload);
      const message = normalizedPayload.message ?? "账号已退出，请重新输入有效兑换码恢复。";
      void embeddedBrowser.hide().catch(() => undefined);
      clearCustomerBrowserDeliveryState(message);
      writeOpenHugeConsumerDebug("renderer.embeddedBrowser.authRequired", {
        message,
        reason: normalizedPayload.reason ?? null,
        url: normalizedPayload.url ?? null,
      });
    });
  }, []);

  useEffect(() => {
    const operatorUnlockOverlay = getOperatorUnlockOverlayBridge();
    if (!operatorUnlockOverlay) {
      return;
    }
    return operatorUnlockOverlay.subscribeSubmit((payload) => {
      if (!isOperatorUnlockOverlaySubmitPayload(payload)) {
        writeOpenHugeConsumerDebug("renderer.operatorUnlockOverlay.submit.invalid", {
          payloadType: typeof payload,
        });
        return;
      }
      const ok = unlockOperatorWorkspace(payload.password);
      void operatorUnlockOverlay
        .resolveSubmit({
          message: ok ? null : "生产端本地密码不正确。",
          ok,
          requestId: payload.requestId,
        })
        .catch((error: unknown) => {
          writeOpenHugeConsumerDebug("renderer.operatorUnlockOverlay.resolve.error", {
            error: debugError(error),
            requestId: payload.requestId,
          });
        });
    });
  }, []);

  function clearCustomerBrowserDeliveryState(message: string) {
    window.localStorage.removeItem(T3_BROWSER_IMPORTED_DATA_READY_STORAGE_KEY);
    window.localStorage.removeItem(T3_BROWSER_DELIVERY_PROJECTION_STORAGE_KEY);
    setBrowserDataImported(false);
    setBrowserDeliveryProjection(null);
    setBrowserProfileNotice(message);
    setNotice(message);
    writeOpenHugeConsumerDebug("renderer.customerDeliveryState.cleared", {
      message,
    });
  }

  function navigateT3Page(page: T3WorkspacePage) {
    setActivePage(page);
    const nextUrl = new URL(window.location.href);
    if (page === "browser") {
      nextUrl.searchParams.set("page", "browser");
    } else {
      nextUrl.searchParams.delete("page");
    }
    window.history.pushState(null, "", nextUrl);
  }

  function openChatFromSidebar() {
    setAssistantPage("home");
    navigateT3Page("chat");
  }

  function unlockOperatorWorkspace(password: string) {
    if (!verifyT3OperatorLocalPassword(password)) {
      return false;
    }
    writeT3OperatorUnlockState(true);
    bumpOperatorUnlockRevision((revision) => revision + 1);
    setOperatorUnlockDialogOpen(false);
    setBrowserAccountImportCode("");
    setBrowserProfileNotice("生产端已解锁。");
    setNotice("生产端已解锁。");
    navigateT3Page("browser");
    return true;
  }

  async function openOperatorUnlock() {
    const operatorUnlockOverlay = getOperatorUnlockOverlayBridge();
    if (operatorUnlockOverlay) {
      try {
        await operatorUnlockOverlay.show();
        return;
      } catch (error) {
        writeOpenHugeConsumerDebug("renderer.operatorUnlockOverlay.show.error", {
          error: debugError(error),
        });
      }
    }
    setOperatorUnlockDialogOpen(true);
  }

  function lockOperatorWorkspace() {
    writeT3OperatorUnlockState(false);
    bumpOperatorUnlockRevision((revision) => revision + 1);
    setBrowserProfileNotice(null);
    setNotice("生产端已锁定。");
    openChatFromSidebar();
  }

  function openAssistantFromSidebar(page: T3WorkspaceAssistantPage) {
    setAssistantPage(page);
    navigateT3Page("chat");
  }

  useEffect(() => {
    function syncPageFromLocation() {
      const searchParams = new URLSearchParams(window.location.search);
      setActivePage(searchParams.get("page") === "browser" ? "browser" : "chat");
    }
    window.addEventListener("popstate", syncPageFromLocation);
    return () => window.removeEventListener("popstate", syncPageFromLocation);
  }, []);

  async function refreshRoutes() {
    setLoadingRoutes(true);
    try {
      const catalog = await refreshT3ProviderCatalog(runtimeBridge);
      const nextRoutes = catalog.routes;
      setRoutes(nextRoutes);
      setProviderModelOptionsByProvider(catalog.modelOptionsByProvider);
      setSelectedModelByProvider((current) => {
        const next: Partial<Record<T3CodeProviderKind, string>> = { ...current };
        for (const route of nextRoutes) {
          const selectedModelId = next[route.provider];
          if (!selectedModelId || !route.models.some((model) => model.slug === selectedModelId)) {
            next[route.provider] = route.modelId ?? route.models[0]?.slug;
          }
        }
        return next;
      });
      setNotice(null);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to load HugeCode backend pool.");
    } finally {
      setLoadingRoutes(false);
    }
  }

  useEffect(() => {
    void refreshRoutes();
  }, []);

  useEffect(() => {
    void browserProfileBridge
      .listProfiles()
      .then((profiles) => {
        setBrowserProfiles(profiles);
        setSelectedBrowserProfileId((current) =>
          profiles.some((profile) => profile.id === current) ? current : "current-browser"
        );
      })
      .catch((error) => {
        setBrowserProfileNotice(
          error instanceof Error ? error.message : "Unable to load browser profiles."
        );
      });
    setBrowserRecentSessions(listT3BrowserRecentSessions());
    setAiGatewayRoutes(listT3AiGatewayRoutesMock());
    setHugerouterListings(listT3HugerouterCapacityListingsMock());
    setHugerouterOrders(listT3HugerouterCapacityOrdersMock());
  }, [browserProfileBridge]);

  useEffect(() => {
    const endpoint = resolveT3RuntimeEventsEndpoint();
    if (!endpoint) {
      return;
    }
    const appendRuntimeEvent = (runtimeEvent: unknown) => {
      const timelineEvent = mapHugeCodeRuntimeEventToT3TimelineEvent(runtimeEvent);
      if (!timelineEvent || timelineEvent.createdAt < runtimeEventsMountedAt.current) {
        return;
      }
      setTimeline((items) => {
        if (items.some((item) => item.id === timelineEvent.id)) {
          return items;
        }
        return [timelineEvent, ...items].slice(0, 50);
      });
    };
    const source = new EventSource(endpoint);
    source.onmessage = (event) => {
      try {
        appendRuntimeEvent(JSON.parse(event.data) as unknown);
      } catch {
        // Ignore malformed runtime frames; the live stream is best-effort UI context.
      }
    };
    const intervalId = window.setInterval(() => {
      void readT3RuntimeEventSnapshot(endpoint)
        .then((events) => events.forEach(appendRuntimeEvent))
        .catch(() => undefined);
    }, 3000);
    return () => {
      window.clearInterval(intervalId);
      source.close();
    };
  }, []);

  const selectedRoute = useMemo(
    () => routes.find((route) => route.provider === selectedProvider),
    [routes, selectedProvider]
  );
  const selectedModelId =
    selectedModelByProvider[selectedProvider] ?? selectedRoute?.modelId ?? null;
  const selectedBrowserProfile = useMemo(
    () =>
      browserProfiles.find((profile) => profile.id === selectedBrowserProfileId) ??
      browserProfiles[0] ??
      null,
    [browserProfiles, selectedBrowserProfileId]
  );
  const browserFingerprintSummary = useMemo(
    () =>
      buildT3BrowserFingerprintSummary({
        policy: selectedBrowserProfile?.fingerprintPolicy,
        remoteReference: selectedBrowserProfile?.securityModel === "remote-devtools-reference",
      }),
    [selectedBrowserProfile]
  );
  const browserProductContinuity = useMemo<T3BrowserProductContinuity | null>(() => {
    if (!selectedBrowserProfile || (browserProvider === "custom" && !customProductUrl.trim())) {
      return null;
    }
    try {
      return buildT3BrowserProductContinuity({
        customUrl: customProductUrl,
        profile: selectedBrowserProfile,
        providerId: browserProvider,
        recentSessions: browserRecentSessions,
        syncState: browserProfileSyncState ?? getT3BrowserProfileSyncState(selectedBrowserProfile),
      });
    } catch {
      return null;
    }
  }, [
    browserProfileSyncState,
    browserProvider,
    browserRecentSessions,
    customProductUrl,
    selectedBrowserProfile,
  ]);
  const browserProfileOperationsReport = useMemo<T3BrowserProfileOperationsReport | null>(() => {
    if (!selectedBrowserProfile) {
      return null;
    }
    return buildT3BrowserProfileOperationsReport({
      customUrl: customProductUrl,
      profile: selectedBrowserProfile,
      providerId: browserProvider,
      syncState: browserProfileSyncState ?? getT3BrowserProfileSyncState(selectedBrowserProfile),
    });
  }, [browserProfileSyncState, browserProvider, customProductUrl, selectedBrowserProfile]);
  useEffect(() => {
    setBrowserProfileSyncState(
      selectedBrowserProfile ? getT3BrowserProfileSyncState(selectedBrowserProfile) : null
    );
    setBrowserProfileMigrationState(
      selectedBrowserProfile ? getT3BrowserProfileMigrationState(selectedBrowserProfile) : null
    );
    setBrowserGuestPasses(
      selectedBrowserProfile ? listT3BrowserGuestPasses(selectedBrowserProfile.id) : []
    );
    setBrowserIsolatedApps(
      selectedBrowserProfile ? listT3BrowserIsolatedApps(selectedBrowserProfile.id) : []
    );
    const nextSeatPool =
      selectedBrowserProfile && (browserProvider !== "custom" || customProductUrl.trim())
        ? getT3BrowserSeatPoolMock({
            customUrl: customProductUrl,
            profile: selectedBrowserProfile,
            providerId: browserProvider,
          })
        : null;
    setBrowserSeatPool(nextSeatPool);
    if (nextSeatPool) {
      setCommercialPlanType(nextSeatPool.commercial.planType);
      setCommercialSeatPrice((nextSeatPool.commercial.seatPriceCents / 100).toFixed(2));
      setPlatformRentalEnabled(nextSeatPool.commercial.platformRental.enabled);
      setPlatformRentalDiscountPrice(
        (nextSeatPool.commercial.platformRental.discountPriceCents / 100).toFixed(2)
      );
      setPlatformRentalPlatforms([...nextSeatPool.commercial.platformRental.supportedPlatforms]);
      setCommercialSeatLimit(
        nextSeatPool.seatLimit === null ? "unlimited" : String(nextSeatPool.seatLimit)
      );
    }
    setBrowserSeatListings(
      listT3BrowserSeatPoolListings({
        planType: seatListingFilter,
        providerId: "all",
      })
    );
  }, [browserProvider, customProductUrl, seatListingFilter, selectedBrowserProfile]);
  const visibleTimeline = useMemo(() => [...timeline].reverse(), [timeline]);
  const remoteBrowserProfiles = useMemo(
    () => browserProfiles.filter((profile) => profile.source === "remote-devtools"),
    [browserProfiles]
  );
  const routeByProvider = useMemo(
    () => new Map(routes.map((route) => [route.provider, route] as const)),
    [routes]
  );
  const sellerCommercialPlanOptions = useMemo(
    () =>
      commercialPlanOptions.filter(
        (plan) =>
          plan.providerId === (browserProvider === "custom" ? "hugerouter" : browserProvider)
      ),
    [browserProvider]
  );
  const aiGatewaySummary = useMemo(
    () => buildT3AiGatewaySummaryMock(aiGatewayRoutes),
    [aiGatewayRoutes]
  );
  const {
    issueRouteToken: issueHugeRouterCommercialRouteToken,
    snapshot: hugeRouterCommercialSnapshot,
  } = useT3HugeRouterCommercialService({
    aiGatewayConcurrency,
    aiGatewayDailyBudget,
    aiGatewayOwnerLabel,
    aiGatewayRoutes,
    hugerouterListings,
    hugerouterOrders,
    onAiGatewayRoutesChanged: setAiGatewayRoutes,
    onNotice: setBrowserProfileNotice,
    refreshRoutes,
    runtimeBridge,
    workspaceId,
  });
  const effectiveSeatPoolProvider = browserProvider === "custom" ? "hugerouter" : browserProvider;
  const browserAssistantEntry = useMemo<BrowserAssistantEntry | null>(() => {
    if (browserProvider === "chatgpt") {
      return {
        kind: "chatgpt",
        label: "Open ChatGPT assistant",
      };
    }
    if (browserProvider === "custom" && isLdxpBrowserAssistantUrl(customProductUrl)) {
      return {
        kind: "ldxp",
        label: "Open ldxp assistant",
      };
    }
    return null;
  }, [browserProvider, customProductUrl]);
  const currentHugerouterSiteScope = useMemo(() => {
    try {
      const url =
        browserProvider === "custom"
          ? customProductUrl
          : browserProvider === "chatgpt"
            ? "https://chatgpt.com/"
            : browserProvider === "gemini"
              ? "https://gemini.google.com/app"
              : "https://hugerouter.openhuge.local/";
      return buildT3HugerouterSiteScope(url);
    } catch {
      return null;
    }
  }, [browserProvider, customProductUrl]);
  const isHugerouterNativeProvider = effectiveSeatPoolProvider === "hugerouter";
  const composerCommandMatches = useMemo(() => {
    const commandText = prompt.trim().toLowerCase();
    if (!commandText.startsWith("/") || commandText.includes(" ")) {
      return [];
    }
    return composerCommands.filter((item) => item.command.startsWith(commandText));
  }, [composerCommands, prompt]);
  const canLaunchTask = prompt.trim().length > 0 && !launching;
  const composerModelOptions = useMemo(
    () =>
      providerOrder.flatMap((provider) => {
        const route = routeByProvider.get(provider);
        const routeModelBySlug = new Map(route?.models.map((model) => [model.slug, model]));
        const models =
          providerModelOptionsByProvider[provider].length > 0
            ? providerModelOptionsByProvider[provider]
            : route?.modelId
              ? [
                  {
                    name: route.modelId,
                    shortName: route.modelId,
                    slug: route.modelId,
                  } satisfies T3CodeProviderModelOption,
                ]
              : [];
        return models.map((model) => ({
          available: routeModelBySlug.get(model.slug)?.available ?? route?.status !== "blocked",
          model,
          provider,
          route,
        }));
      }),
    [providerModelOptionsByProvider, routeByProvider]
  );
  const selectedModelLabel =
    composerModelOptions.find(
      (option) => option.provider === selectedProvider && option.model.slug === selectedModelId
    )?.model.shortName ??
    composerModelOptions.find(
      (option) => option.provider === selectedProvider && option.model.slug === selectedModelId
    )?.model.name ??
    selectedModelId ??
    "Runtime model";

  function applyRelayRoute(route: T3CodeProviderRoute) {
    setRoutes((currentRoutes) => [
      route,
      ...currentRoutes.filter((candidate) => candidate.backendId !== route.backendId),
    ]);
    setSelectedProvider("codex");
    setSelectedModelByProvider((current) => ({
      ...current,
      codex: route.modelId ?? "agent-coding-default",
    }));
    setNotice(text.relayRouteAppliedNotice(route.backendLabel));
  }

  async function launchTask() {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) {
      setNotice(text.enterInstructionNotice);
      return;
    }
    const dispatchPrompt =
      composerMode === "plan"
        ? `Create an implementation plan first. Do not edit files until the plan is accepted.\n\n${trimmedPrompt}`
        : trimmedPrompt;
    setLaunching(true);
    setNotice(null);
    const request = buildHugeCodeAgentTaskStartRequest(
      {
        workspaceId: workspaceId.trim() || "default",
        prompt: dispatchPrompt,
        title:
          composerMode === "plan"
            ? `${text.planTitlePrefix}: ${trimmedPrompt.slice(0, 72)}`
            : trimmedPrompt.slice(0, 80),
        selection: {
          provider: selectedProvider,
          backendId: selectedRoute?.backendId ?? null,
          modelId: selectedModelId,
        },
        accessMode: composerAccessMode,
        executionMode: "single",
        reasonEffort: composerReasonEffort,
        taskSource: {
          kind: "manual_thread",
          label: `T3 composer (${composerMode}, ${getT3WorkspaceAccessModeLabel(
            locale,
            composerAccessMode
          )})`,
          title: trimmedPrompt.slice(0, 80) || "T3 task",
          workspaceId: workspaceId.trim() || "default",
          threadId: null,
        },
      },
      routes
    );
    try {
      await runtimeBridge.startAgentTask(request);
      setTimeline((items) => [
        {
          id: `local-launch-${Date.now()}`,
          kind: "task.started",
          title: request.title ?? "Task launched",
          body: [
            `${text.modeTimelineLabel}: ${composerMode === "plan" ? text.plan : text.build}`,
            `${text.accessTimelineLabel}: ${getT3WorkspaceAccessModeLabel(
              locale,
              composerAccessMode
            )}`,
            `${text.reasoningTimelineLabel}: ${composerReasonEffort}`,
            `${text.preferredBackendsTimelineLabel}: ${
              request.preferredBackendIds?.join(", ") || text.runtimeFallback
            }`,
          ].join(" · "),
          createdAt: Date.now(),
          source: "hugecode-runtime",
          raw: request,
        },
        ...items,
      ]);
      setPrompt("");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to launch HugeCode task.");
    } finally {
      setLaunching(false);
    }
  }

  function applyComposerCommand(command: string) {
    if (command === "/plan") {
      setComposerMode("plan");
      setPrompt("");
      setNotice(null);
      return;
    }
    if (command === "/default") {
      setComposerMode("build");
      setPrompt("");
      setNotice(null);
      return;
    }
    setNotice("Use the model picker in the composer footer to switch providers.");
    setPrompt("");
  }

  async function openBrowserProvider(assistant?: BrowserAssistantEntry["kind"]) {
    if (browserProvider === "custom" && !customProductUrl.trim()) {
      setBrowserProfileNotice("Enter a web product URL before opening a custom browser session.");
      return;
    }
    setBrowserProfileBusy(true);
    setBrowserProfileNotice(null);
    try {
      const profile = await browserProfileBridge.openProvider({
        assistant,
        customUrl: customProductUrl,
        profileId: selectedBrowserProfileId,
        providerId: browserProvider,
      });
      setBrowserProfiles((profiles) =>
        profiles.map((candidate) => (candidate.id === profile.id ? profile : candidate))
      );
      setBrowserRecentSessions(listT3BrowserRecentSessions());
      setBrowserProfileNotice(profile.statusMessage);
    } catch (error) {
      setBrowserProfileNotice(
        error instanceof Error ? error.message : "Unable to open the browser provider."
      );
    } finally {
      setBrowserProfileBusy(false);
    }
  }

  async function ensureCustomerDeliveryCanOpen(
    deliveryProjectionOverride?: T3DeliveryProjection | null,
    options: { browserDataImported?: boolean } = {}
  ) {
    writeOpenHugeConsumerDebug("renderer.ensureCustomerDeliveryCanOpen.start", {
      browserDataImportedState: browserDataImported,
      browserDeliveryProjection: debugProjection(browserDeliveryProjection),
      deliveryProjectionOverride: debugProjection(deliveryProjectionOverride),
      options,
      runtimeRole: readT3P0RuntimeRoleMode(),
    });
    if (readT3P0RuntimeRoleMode() !== "customer") {
      writeOpenHugeConsumerDebug("renderer.ensureCustomerDeliveryCanOpen.allowNonCustomer");
      return true;
    }
    const deliveryDataImported = options.browserDataImported ?? browserDataImported;
    if (!deliveryDataImported) {
      const message = "请先验证并恢复后端交付，再打开 ChatGPT 内置浏览器。";
      writeOpenHugeConsumerDebug("renderer.ensureCustomerDeliveryCanOpen.blockedNotImported", {
        message,
      });
      setBrowserProfileNotice(message);
      setNotice(message);
      return false;
    }
    const localProjection = deliveryProjectionOverride ?? browserDeliveryProjection;
    const deliveryId = localProjection?.deliveryId;
    if (customerDeliveryLocallyExpired(localProjection)) {
      const message = "兑换权益已到期，请重新输入有效兑换码。";
      writeOpenHugeConsumerDebug("renderer.ensureCustomerDeliveryCanOpen.blockedByLocalExpiry", {
        localProjection: debugProjection(localProjection),
        message,
      });
      clearCustomerBrowserDeliveryState(message);
      return false;
    }
    if (!deliveryId) {
      const message = "后端交付状态不可确认，已阻断客户浏览器打开。";
      writeOpenHugeConsumerDebug("renderer.ensureCustomerDeliveryCanOpen.blockedNoDeliveryId", {
        browserDataImportedState: browserDataImported,
        browserDeliveryProjection: debugProjection(browserDeliveryProjection),
        deliveryDataImported,
        deliveryProjectionOverride: debugProjection(deliveryProjectionOverride),
        hasImportedFlag:
          window.localStorage.getItem(T3_BROWSER_IMPORTED_DATA_READY_STORAGE_KEY) === "1",
        hasPersistedProjection:
          window.localStorage.getItem(T3_BROWSER_DELIVERY_PROJECTION_STORAGE_KEY) !== null,
        message,
      });
      setBrowserProfileNotice(message);
      setNotice(message);
      return false;
    }
    try {
      writeOpenHugeConsumerDebug("renderer.ensureCustomerDeliveryCanOpen.readStatus.start", {
        deliveryId,
      });
      const projection = await readT3DeliveryStatus({ deliveryId });
      writeOpenHugeConsumerDebug("renderer.ensureCustomerDeliveryCanOpen.readStatus.ok", {
        projection: debugProjection(projection),
      });
      if (
        !projection.deliveryId &&
        localProjection?.deliveryId &&
        !customerDeliveryOpenBlocked(localProjection) &&
        !customerDeliveryLocallyExpired(localProjection)
      ) {
        writeOpenHugeConsumerDebug(
          "renderer.ensureCustomerDeliveryCanOpen.keepLocalAfterStatusMiss",
          {
            localProjection: debugProjection(localProjection),
            remoteProjection: debugProjection(projection),
          }
        );
        setBrowserDeliveryProjection(localProjection);
        writePersistedBrowserDeliveryProjection(localProjection);
        return true;
      }
      setBrowserDeliveryProjection(projection);
      writePersistedBrowserDeliveryProjection(projection);
      if (customerDeliveryOpenBlocked(projection) || customerDeliveryLocallyExpired(projection)) {
        const message = customerDeliveryLocallyExpired(projection)
          ? "兑换权益已到期，请重新输入有效兑换码。"
          : `后端交付状态已阻断：${projection.summary}`;
        writeOpenHugeConsumerDebug("renderer.ensureCustomerDeliveryCanOpen.blockedByStatus", {
          message,
          projection: debugProjection(projection),
        });
        if (customerDeliveryLocallyExpired(projection)) {
          clearCustomerBrowserDeliveryState(message);
          return false;
        }
        setBrowserProfileNotice(message);
        setNotice(message);
        return false;
      }
      writeOpenHugeConsumerDebug("renderer.ensureCustomerDeliveryCanOpen.allow", {
        projection: debugProjection(projection),
      });
      return true;
    } catch (error) {
      if (
        localProjection?.deliveryId &&
        !customerDeliveryOpenBlocked(localProjection) &&
        !customerDeliveryLocallyExpired(localProjection)
      ) {
        writeOpenHugeConsumerDebug(
          "renderer.ensureCustomerDeliveryCanOpen.keepLocalAfterStatusError",
          {
            deliveryId,
            error: debugError(error),
            localProjection: debugProjection(localProjection),
          }
        );
        setBrowserDeliveryProjection(localProjection);
        writePersistedBrowserDeliveryProjection(localProjection);
        return true;
      }
      const message = "后端交付状态刷新失败，已阻断客户浏览器打开。";
      writeOpenHugeConsumerDebug("renderer.ensureCustomerDeliveryCanOpen.readStatus.error", {
        deliveryId,
        error: debugError(error),
        message,
      });
      setBrowserProfileNotice(message);
      setNotice(message);
      return false;
    }
  }

  async function openChatGptBuiltInBrowser(
    captureMode?: "operator-delivery",
    deliveryProjectionOverride?: T3DeliveryProjection | null,
    options: { browserDataImported?: boolean } = {}
  ) {
    writeOpenHugeConsumerDebug("renderer.openChatGptBuiltInBrowser.start", {
      browserDataImportedState: browserDataImported,
      captureMode: captureMode ?? null,
      deliveryProjectionOverride: debugProjection(deliveryProjectionOverride),
      options,
    });
    if (
      !captureMode &&
      !(await ensureCustomerDeliveryCanOpen(deliveryProjectionOverride, options))
    ) {
      writeOpenHugeConsumerDebug("renderer.openChatGptBuiltInBrowser.blockedByDelivery");
      return;
    }
    setBrowserProfileBusy(true);
    setBrowserProfileNotice(null);
    try {
      const profile = await browserProfileBridge.openProvider({
        captureMode,
        customUrl: null,
        profileId: selectedBrowserProfileId,
        providerId: "chatgpt",
      });
      setBrowserProfiles((profiles) =>
        profiles.map((candidate) => (candidate.id === profile.id ? profile : candidate))
      );
      setBrowserRecentSessions(listT3BrowserRecentSessions());
      setBrowserLoginStateStatus("unknown");
      setBrowserProfileNotice("ChatGPT opened in a separate built-in browser window.");
      writeOpenHugeConsumerDebug("renderer.openChatGptBuiltInBrowser.openProvider.ok", {
        profileId: profile.id,
        statusMessage: profile.statusMessage,
      });
    } catch (error) {
      writeOpenHugeConsumerDebug("renderer.openChatGptBuiltInBrowser.openProvider.error", {
        error: debugError(error),
      });
      setBrowserProfileNotice(
        error instanceof Error ? error.message : "Unable to open the ChatGPT browser window."
      );
    } finally {
      setBrowserProfileBusy(false);
    }
  }

  async function removeRemoteBrowserProfile(profileId: string) {
    setBrowserProfileBusy(true);
    setBrowserProfileNotice(null);
    try {
      const profiles = await browserProfileBridge.removeProfile(profileId);
      setBrowserProfiles(profiles);
      setSelectedBrowserProfileId((current) =>
        profiles.some((profile) => profile.id === current) ? current : "current-browser"
      );
    } catch (error) {
      setBrowserProfileNotice(
        error instanceof Error ? error.message : "Unable to remove browser profile."
      );
    } finally {
      setBrowserProfileBusy(false);
    }
  }

  function refreshBrowserStaticDataState(profiles: readonly T3BrowserProfileDescriptor[]) {
    const nextSelectedProfile =
      profiles.find((profile) => profile.id === selectedBrowserProfileId) ??
      profiles.find((profile) => profile.id === "current-browser") ??
      profiles[0] ??
      null;
    setBrowserProfiles([...profiles]);
    if (nextSelectedProfile) {
      setSelectedBrowserProfileId(nextSelectedProfile.id);
      setBrowserProfileSyncState(getT3BrowserProfileSyncState(nextSelectedProfile));
      setBrowserProfileMigrationState(getT3BrowserProfileMigrationState(nextSelectedProfile));
      setBrowserGuestPasses(listT3BrowserGuestPasses(nextSelectedProfile.id));
      setBrowserIsolatedApps(listT3BrowserIsolatedApps(nextSelectedProfile.id));
    }
    setBrowserRecentSessions(listT3BrowserRecentSessions());
    setAiGatewayRoutes(listT3AiGatewayRoutesMock());
    setHugerouterListings(listT3HugerouterCapacityListingsMock());
    setHugerouterOrders(listT3HugerouterCapacityOrdersMock());
    setBrowserSeatListings(
      listT3BrowserSeatPoolListings({
        planType: seatListingFilter,
        providerId: "all",
      })
    );
  }

  async function exportBrowserStaticData(): Promise<T3DeliveryArtifactUpload | null> {
    setBrowserProfileBusy(true);
    setBrowserProfileNotice(null);
    try {
      const importSecret = requireImportSecret(browserAccountFileUnlockCode, "Export");
      const preflight = await runChatGptLoginStatePreflight();
      if (preflight.status !== "loggedIn") {
        throw new Error(preflight.summary);
      }
      const serialized =
        await serializeT3OperatorBrowserStaticDataBundleWithLoginState(importSecret);
      const fileName = `hugecode-browser-data-${new Date().toISOString().slice(0, 10)}.hcbrowser`;
      const witness = await createT3DeliveryExportWitness({ fileName, serialized });
      setBrowserProfileNotice(
        "Encrypted ChatGPT account artifact prepared for delivery adapter upload. File unlock material stays outside the witness."
      );
      return { serialized, witness };
    } catch (error) {
      setBrowserProfileNotice(
        error instanceof Error ? error.message : "Unable to export browser data file."
      );
      return null;
    } finally {
      setBrowserProfileBusy(false);
    }
  }
  async function redeemBrowserDelivery() {
    if (browserProfileBusy) {
      writeOpenHugeConsumerDebug("renderer.redeemBrowserDelivery.skipBusy");
      return;
    }
    writeOpenHugeConsumerDebug("renderer.redeemBrowserDelivery.start", {
      browserAccountFileUnlockCode: browserAccountFileUnlockCode.trim()
        ? debugStringMeta(browserAccountFileUnlockCode.trim())
        : null,
      browserAccountImportCode: browserAccountImportCode.trim()
        ? debugStringMeta(browserAccountImportCode.trim())
        : null,
      browserDataImportedState: browserDataImported,
      browserDeliveryProjection: debugProjection(browserDeliveryProjection),
    });
    setBrowserProfileBusy(true);
    setBrowserProfileNotice(null);
    let restoredProjection: T3DeliveryProjection | null = null;
    let shouldActivateEmbeddedBrowser = false;
    try {
      const restore = await restoreT3CustomerBrowserDelivery({
        activationCodeInput: browserAccountImportCode,
        fileUnlockCodeInput: browserAccountFileUnlockCode,
      });
      restoredProjection = restore.projection;
      writeOpenHugeConsumerDebug("renderer.redeemBrowserDelivery.restore.result", {
        notice: restore.notice,
        profileCount: restore.status === "restored" ? restore.profiles.length : null,
        projection: debugProjection(restore.projection),
        status: restore.status,
      });
      setBrowserDeliveryProjection(restore.projection);
      if (restore.status !== "restored") {
        throw new Error(restore.notice);
      }
      writePersistedBrowserDeliveryProjection(restore.projection);
      refreshBrowserStaticDataState(restore.profiles);
      markBrowserDataImported();
      setBrowserAccountImportCode("");
      setBrowserAccountFileUnlockCode("");
      shouldActivateEmbeddedBrowser = true;
      setBrowserProfileNotice(restore.notice);
      setNotice(restore.notice);
    } catch (error) {
      const message = formatT3BrowserStaticDataImportError(error);
      writeOpenHugeConsumerDebug("renderer.redeemBrowserDelivery.error", {
        error: debugError(error),
        message,
        restoredProjection: debugProjection(restoredProjection),
      });
      setBrowserProfileNotice(message);
      setNotice(message);
    } finally {
      setBrowserProfileBusy(false);
      writeOpenHugeConsumerDebug("renderer.redeemBrowserDelivery.finally", {
        restoredProjection: debugProjection(restoredProjection),
        shouldActivateEmbeddedBrowser,
      });
    }
    if (shouldActivateEmbeddedBrowser) {
      writeOpenHugeConsumerDebug("renderer.redeemBrowserDelivery.embeddedBrowserReady", {
        restoredProjection: debugProjection(restoredProjection),
      });
    }
  }

  function markBrowserDataImported() {
    window.localStorage.setItem(T3_BROWSER_IMPORTED_DATA_READY_STORAGE_KEY, "1");
    setBrowserDataImported(true);
    writeOpenHugeConsumerDebug("renderer.browserDataImported.marked", {
      hasImportedFlag:
        window.localStorage.getItem(T3_BROWSER_IMPORTED_DATA_READY_STORAGE_KEY) === "1",
    });
  }

  function openBrowserStaticDataImportPicker() {
    if (browserProfileBusy) {
      return;
    }
    browserStaticDataImportInputRef.current?.click();
  }

  async function runChatGptLoginStatePreflight() {
    const result = await checkT3OperatorBrowserChatGptLoginState();
    setBrowserLoginStateStatus(result.status);
    setBrowserProfileNotice(result.summary);
    return result;
  }

  async function importBrowserStaticDataFile(file: File) {
    setBrowserProfileBusy(true);
    setBrowserProfileNotice(null);
    let shouldOpenChatGptBrowser = false;
    try {
      const result = importT3BrowserStaticDataBundle(await file.text());
      const importSecret = requireImportSecret(browserAccountFileUnlockCode, "Import");
      const loginStateResult = await importT3BrowserStaticDataLoginStateBundles(
        result.loginStateBundles,
        { importSecret }
      );
      if (!loginStateResult.success) {
        throw new Error(loginStateResult.summary ?? "Browser account data restore failed.");
      }
      refreshBrowserStaticDataState(result.profiles);
      markBrowserDataImported();
      shouldOpenChatGptBrowser = true;
      const loginStateSummary = loginStateResult.summary;
      setBrowserProfileNotice(
        loginStateSummary ? `${result.summary} ${loginStateSummary}` : result.summary
      );
      setNotice(loginStateSummary ? `${result.summary} ${loginStateSummary}` : result.summary);
    } catch (error) {
      const message = formatT3BrowserStaticDataImportError(error);
      setBrowserProfileNotice(message);
      setNotice(message);
    } finally {
      setBrowserProfileBusy(false);
    }
    if (shouldOpenChatGptBrowser) {
      await openChatGptBuiltInBrowser();
    }
  }

  function syncBrowserProfileMock() {
    if (!selectedBrowserProfile) {
      setBrowserProfileNotice("Select a browser profile before syncing.");
      return;
    }
    const nextState = syncT3BrowserProfileToLocalMock(selectedBrowserProfile);
    setBrowserProfileSyncState(nextState);
    if (browserProvider !== "custom" || customProductUrl.trim()) {
      setBrowserSeatPool(
        getT3BrowserSeatPoolMock({
          customUrl: customProductUrl,
          profile: selectedBrowserProfile,
          providerId: browserProvider,
        })
      );
    }
    setBrowserProfileNotice(nextState.summary);
  }

  function refreshBrowserMigrationState(profile = selectedBrowserProfile) {
    if (!profile) {
      setBrowserProfileMigrationState(null);
      return null;
    }
    const nextState = getT3BrowserProfileMigrationState(profile);
    setBrowserProfileMigrationState(nextState);
    return nextState;
  }

  function openBrowserProfileMigrationMock() {
    if (!selectedBrowserProfile) {
      setBrowserProfileNotice("Select a browser profile before continuing on this device.");
      return;
    }
    const nextState = openT3BrowserProfileMigrationMock({
      deviceName: browserMigrationDeviceName,
      profile: selectedBrowserProfile,
    });
    setBrowserProfileMigrationState(nextState);
    setBrowserProfileNotice(nextState.summary);
  }

  function syncCloseBrowserProfileMigrationMock() {
    if (!selectedBrowserProfile) {
      setBrowserProfileNotice("Select a browser profile before syncing and closing.");
      return;
    }
    const nextState = syncCloseT3BrowserProfileMigrationMock({
      deviceName: browserMigrationDeviceName,
      profile: selectedBrowserProfile,
    });
    setBrowserProfileMigrationState(nextState);
    setBrowserProfileSyncState(getT3BrowserProfileSyncState(selectedBrowserProfile));
    setBrowserProfileNotice(nextState.summary);
  }

  function forceTakeoverBrowserProfileMigrationMock() {
    if (!selectedBrowserProfile) {
      setBrowserProfileNotice("Select a browser profile before forcing takeover.");
      return;
    }
    const nextState = forceTakeoverT3BrowserProfileMigrationMock({
      deviceName: browserMigrationDeviceName,
      profile: selectedBrowserProfile,
    });
    setBrowserProfileMigrationState(nextState);
    setBrowserProfileNotice(
      "Profile lock force-taken. Previous device state may be stale until it refreshes."
    );
  }

  function restoreBrowserProfileVersionMock(versionId?: string | null) {
    if (!selectedBrowserProfile) {
      setBrowserProfileNotice("Select a browser profile before restoring a version.");
      return;
    }
    try {
      const nextState = restoreT3BrowserProfileVersionMock({
        deviceName: browserMigrationDeviceName,
        profile: selectedBrowserProfile,
        versionId,
      });
      setBrowserProfileMigrationState(nextState);
      setBrowserProfileNotice(nextState.summary);
    } catch (error) {
      setBrowserProfileNotice(
        error instanceof Error ? error.message : "Unable to restore profile version."
      );
    }
  }

  function createBrowserGuestPassMock() {
    if (!selectedBrowserProfile) {
      setBrowserProfileNotice("Select a browser profile before creating a guest pass.");
      return;
    }
    try {
      const pass = createT3BrowserGuestPassMock({
        customUrl: customProductUrl,
        durationHours: guestPassDurationHours,
        guestLabel: guestPassRecipient,
        profile: selectedBrowserProfile,
        providerId: browserProvider,
      });
      setBrowserGuestPasses(listT3BrowserGuestPasses(selectedBrowserProfile.id));
      setBrowserProfileNotice(
        `Guest pass ${pass.inviteCode} is ready without sharing credentials.`
      );
    } catch (error) {
      setBrowserProfileNotice(
        error instanceof Error ? error.message : "Unable to create a guest pass."
      );
    }
  }

  function revokeBrowserGuestPassMock(passId: string) {
    if (!selectedBrowserProfile) {
      return;
    }
    revokeT3BrowserGuestPassMock(passId);
    setBrowserGuestPasses(listT3BrowserGuestPasses(selectedBrowserProfile.id));
    setBrowserProfileNotice("Guest pass revoked.");
  }

  function createBrowserIsolatedAppMock() {
    if (!selectedBrowserProfile) {
      setBrowserProfileNotice("Select a browser profile before creating an isolated app.");
      return;
    }
    if (browserProvider === "custom" && !customProductUrl.trim()) {
      setBrowserProfileNotice("Enter a product URL before creating a custom isolated app.");
      return;
    }
    try {
      const app = createT3BrowserIsolatedAppMock({
        customUrl: customProductUrl,
        label: isolatedAppName,
        profile: selectedBrowserProfile,
        providerId: browserProvider,
      });
      setBrowserIsolatedApps(listT3BrowserIsolatedApps(selectedBrowserProfile.id));
      setBrowserProfileNotice(
        `${app.label} is enabled as a local isolated app scope. Electron partition binding is pending.`
      );
    } catch (error) {
      setBrowserProfileNotice(
        error instanceof Error ? error.message : "Unable to create an isolated app."
      );
    }
  }

  async function openBrowserIsolatedAppMock(app: T3BrowserIsolatedApp) {
    setBrowserProfileBusy(true);
    setBrowserProfileNotice(null);
    try {
      await browserProfileBridge.openProvider({
        customUrl: app.providerId === "custom" ? app.targetUrl : null,
        isolatedAppId: app.id,
        profileId: app.profileId,
        providerId: app.providerId,
      });
      setBrowserIsolatedApps(listT3BrowserIsolatedApps(selectedBrowserProfile?.id));
      setBrowserRecentSessions(listT3BrowserRecentSessions());
      setBrowserProfileNotice(`${app.label} opened in its local isolated app scope.`);
    } catch (error) {
      setBrowserProfileNotice(
        error instanceof Error ? error.message : "Unable to open isolated app."
      );
    } finally {
      setBrowserProfileBusy(false);
    }
  }

  function removeBrowserIsolatedAppMock(appId: string) {
    const nextApps = removeT3BrowserIsolatedAppMock(appId);
    setBrowserIsolatedApps(
      selectedBrowserProfile
        ? nextApps.filter((app) => app.profileId === selectedBrowserProfile.id)
        : nextApps
    );
    setBrowserProfileNotice("Isolated app removed from the local mock registry.");
  }

  function addBrowserSeatPoolMemberMock() {
    if (!selectedBrowserProfile) {
      setBrowserProfileNotice("Select a browser profile before adding a seat.");
      return;
    }
    try {
      const pool = addT3BrowserSeatPoolMemberMock({
        customUrl: customProductUrl,
        memberLabel: seatPoolMemberName,
        profile: selectedBrowserProfile,
        providerId: browserProvider,
      });
      setBrowserSeatPool(pool);
      setBrowserGuestPasses(listT3BrowserGuestPasses(selectedBrowserProfile.id));
      setSeatPoolMemberName(`Member ${pool.memberCount + 1}`);
      setBrowserProfileNotice(
        pool.providerId === "hugerouter"
          ? `Hugerouter seat ${pool.memberCount} is active. Carpool, rental, and platform leasing are supported by Hugerouter policy.`
          : `${pool.providerId} seat ${pool.memberCount} is active. Web device count is uncapped in the local mock; provider policy is deferred.`
      );
    } catch (error) {
      setBrowserProfileNotice(
        error instanceof Error ? error.message : "Unable to add a membership seat."
      );
    }
  }

  function pauseBrowserSeatPoolMemberMock(memberId: string) {
    if (!browserSeatPool || !selectedBrowserProfile) {
      return;
    }
    const pool = pauseT3BrowserSeatPoolMemberMock({
      memberId,
      poolId: browserSeatPool.id,
    });
    if (pool) {
      setBrowserSeatPool(pool);
      setBrowserGuestPasses(listT3BrowserGuestPasses(selectedBrowserProfile.id));
      setBrowserProfileNotice("Membership seat paused and its Guest Pass revoked.");
    }
  }

  function publishSeatPoolListingMock() {
    if (!selectedBrowserProfile) {
      setBrowserProfileNotice("Select a browser profile before publishing a listing.");
      return;
    }
    if (browserProvider === "custom" && !customProductUrl.trim()) {
      setBrowserProfileNotice("Enter a site URL before publishing a Hugerouter-managed listing.");
      return;
    }
    const seatPriceCents = Math.round(Number(commercialSeatPrice) * 100);
    const seatLimit =
      commercialSeatLimit.trim().toLowerCase() === "unlimited" ? null : Number(commercialSeatLimit);
    const platformRentalDiscountPriceCents = Math.round(Number(platformRentalDiscountPrice) * 100);
    try {
      const pool = updateT3BrowserSeatPoolCommercialMock({
        customUrl: customProductUrl,
        listingStatus: "listed",
        platformRental: {
          discountPriceCents: platformRentalDiscountPriceCents,
          enabled: platformRentalEnabled,
          supportedPlatforms: platformRentalPlatforms,
        },
        planType: commercialPlanType,
        profile: selectedBrowserProfile,
        providerId: browserProvider,
        seatLimit,
        seatPriceCents,
      });
      setBrowserSeatPool(pool);
      setBrowserSeatListings(
        listT3BrowserSeatPoolListings({
          planType: seatListingFilter,
          providerId: "all",
        })
      );
      setBrowserProfileNotice(
        `${pool.commercial.planLabel} listed at ${formatSeatPrice(pool.commercial.seatPriceCents)} per seat.`
      );
    } catch (error) {
      setBrowserProfileNotice(
        error instanceof Error ? error.message : "Unable to publish seat listing."
      );
    }
  }

  function togglePlatformRentalPlatform(platform: T3SeatPoolRentalPlatform) {
    setPlatformRentalPlatforms((current) => {
      if (current.includes(platform)) {
        const next = current.filter((candidate) => candidate !== platform);
        return next.length > 0 ? next : current;
      }
      return [...current, platform];
    });
  }

  function registerAiGatewayRouteMock() {
    try {
      const route = createT3AiGatewayRouteMock({
        maxConcurrentTasks: Number(aiGatewayConcurrency),
        ownerLabel: aiGatewayOwnerLabel,
        planType: aiGatewayPlanType,
        requestBudgetPerDay: Number(aiGatewayDailyBudget),
        routeMode: aiGatewayRouteMode,
      });
      setAiGatewayRoutes(listT3AiGatewayRoutesMock());
      setBrowserProfileNotice(
        route.routable
          ? `${route.planLabel} capacity is registered for the internal AI gateway.`
          : `${route.planLabel} is registered as an owner-supervised session, not shared fan-out capacity.`
      );
    } catch (error) {
      setBrowserProfileNotice(
        error instanceof Error ? error.message : "Unable to register AI gateway capacity."
      );
    }
  }

  function refreshHugerouterMarketplaceMock() {
    setHugerouterListings(listT3HugerouterCapacityListingsMock());
    setHugerouterOrders(listT3HugerouterCapacityOrdersMock());
  }

  function publishHugerouterCapacityListingMock() {
    try {
      const listing = createT3HugerouterCapacityListingMock({
        minPurchaseCredits: Number(hugerouterMinCredits),
        sellerLabel: hugerouterSellerLabel,
        sourceKind: hugerouterSourceKind,
        tier: hugerouterTier,
        totalCredits: Number(hugerouterTotalCredits),
        unitPriceCentsPerThousand: Math.round(Number(hugerouterUnitPrice) * 100),
      });
      refreshHugerouterMarketplaceMock();
      setBrowserProfileNotice(
        `${listing.tierLabel} listed with ${formatCredits(listing.availableCredits)} credits.`
      );
    } catch (error) {
      setBrowserProfileNotice(
        error instanceof Error ? error.message : "Unable to publish Hugerouter capacity."
      );
    }
  }

  function buyHugerouterCapacityMock(listingId: string) {
    try {
      const order = createT3HugerouterCapacityOrderMock({
        buyerLabel: hugerouterBuyerLabel,
        creditsRequested: Number(hugerouterBuyCredits),
        listingId,
      });
      refreshHugerouterMarketplaceMock();
      setBrowserProfileNotice(
        `${formatCredits(order.creditsPurchased)} credits provisioned via Hugerouter mock escrow.`
      );
    } catch (error) {
      setBrowserProfileNotice(
        error instanceof Error ? error.message : "Unable to create Hugerouter order."
      );
    }
  }

  function settleHugerouterOrderMock(orderId: string) {
    const order = settleT3HugerouterCapacityOrderMock(orderId);
    refreshHugerouterMarketplaceMock();
    if (order) {
      setBrowserProfileNotice(`Order ${order.status}; escrow is ${order.escrowStatus}.`);
    }
  }

  function refundHugerouterOrderMock(orderId: string) {
    const order = refundT3HugerouterCapacityOrderMock(orderId);
    refreshHugerouterMarketplaceMock();
    if (order) {
      setBrowserProfileNotice(`Order ${order.status}; escrow is ${order.escrowStatus}.`);
    }
  }

  const browserManagementPage = (
    <section className="t3-browser-panel t3-browser-page" aria-label="Browser profiles">
      <header className="t3-browser-page-hero">
        <div>
          <Chip color="success" size="sm" variant="soft">
            <Globe2 size={13} />
            Product surface
          </Chip>
          <h1>HugeRouter Browser</h1>
          <p>
            A dedicated product browser for supervised AI workflows, isolated app sessions, and
            HugeRouter capacity routes.
          </p>
        </div>
        <div className="t3-browser-hero-metrics" aria-label="Browser workspace summary">
          <span>
            <strong>{browserProfiles.length}</strong>
            Profiles
          </span>
          <span>
            <strong>{browserIsolatedApps.length}</strong>
            Apps
          </span>
          <span>
            <strong>{aiGatewaySummary.routableRouteCount}</strong>
            Routes
          </span>
        </div>
      </header>
      <div className="t3-browser-overview">
        <section className="t3-browser-command-center" aria-label="Browser command center">
          <Card
            className="t3-browser-control-card t3-browser-launch-card"
            variant="secondary"
            aria-label="Browser launch"
          >
            <Card.Header className="t3-browser-card-header">
              <span>
                <ExternalLink size={14} />
                Launch browser
              </span>
              <Chip size="sm" variant="tertiary">
                {selectedBrowserProfile?.source ?? "current-browser"}
              </Chip>
            </Card.Header>
            <div className="t3-browser-product-preview" aria-label="Selected browser product">
              <div className="t3-browser-preview-chrome" aria-hidden="true">
                <span />
                <span />
                <span />
                <strong>{browserProviderTitle(browserProvider)}</strong>
              </div>
              <div className="t3-browser-preview-body">
                <span>
                  <Globe2 size={18} />
                </span>
                <strong>{browserProviderTitle(browserProvider)}</strong>
                <small>
                  {browserProvider === "custom" && customProductUrl.trim()
                    ? customProductUrl
                    : "hugerouter.openhuge.local"}
                </small>
              </div>
            </div>
            <div className="t3-browser-control-grid">
              <label>
                <span>Provider</span>
                <select
                  className="t3-browser-select"
                  value={browserProvider}
                  onChange={(event) =>
                    setBrowserProvider(
                      event.target.value === "hugerouter"
                        ? "hugerouter"
                        : event.target.value === "gemini"
                          ? "gemini"
                          : event.target.value === "custom"
                            ? "custom"
                            : "chatgpt"
                    )
                  }
                >
                  {browserProviderOrder.map((provider) => (
                    <option key={provider} value={provider}>
                      {browserProviderTitle(provider)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Profile</span>
                <select
                  className="t3-browser-select"
                  value={selectedBrowserProfileId}
                  onChange={(event) => setSelectedBrowserProfileId(event.target.value)}
                >
                  {browserProfiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {browserProvider === "custom" ? (
              <label htmlFor="t3-browser-custom-url">
                <span>Product URL</span>
                <Input
                  id="t3-browser-custom-url"
                  value={customProductUrl}
                  onChange={(event) => setCustomProductUrl(event.target.value)}
                  placeholder="https://example.com/app"
                  aria-label="Custom web product URL"
                  variant="secondary"
                />
              </label>
            ) : null}
            <Button
              className="t3-browser-open"
              type="button"
              onPress={() => {
                if (
                  browserProfileBusy ||
                  (browserProvider === "custom" && !customProductUrl.trim())
                ) {
                  return;
                }
                void openBrowserProvider();
              }}
              aria-disabled={
                browserProfileBusy || (browserProvider === "custom" && !customProductUrl.trim())
              }
              size="md"
              variant="primary"
            >
              <ExternalLink size={14} />
              Open
            </Button>
            {browserAssistantEntry ? (
              <Button
                type="button"
                onPress={() => {
                  if (
                    browserProfileBusy ||
                    (browserProvider === "custom" && !customProductUrl.trim())
                  ) {
                    return;
                  }
                  void openBrowserProvider(browserAssistantEntry.kind);
                }}
                aria-disabled={
                  browserProfileBusy || (browserProvider === "custom" && !customProductUrl.trim())
                }
                aria-label={browserAssistantEntry.label}
                size="md"
                variant="outline"
              >
                <AppWindow size={14} />
                Assistant
              </Button>
            ) : null}
            <div className="t3-browser-safety" aria-label="Browser session safety">
              <Chip size="sm" variant="tertiary">
                No cookie export
              </Chip>
              <Chip size="sm" variant="tertiary">
                No password access
              </Chip>
              <Chip size="sm" variant="tertiary">
                {selectedBrowserProfile?.securityModel === "remote-devtools-reference"
                  ? "Remote reference"
                  : "Browser session"}
              </Chip>
            </div>
          </Card>
        </section>
        <aside className="t3-browser-status-rail" aria-label="Browser profile status">
          <Card
            className="t3-browser-fingerprint"
            variant="secondary"
            aria-label="Fingerprint profile"
          >
            <Card.Header className="t3-browser-card-header">
              <span>
                <Fingerprint size={13} />
                Fingerprint
              </span>
              <Chip color="success" size="sm" variant="soft">
                Native
              </Chip>
            </Card.Header>
            <div>
              <Chip size="sm" variant="tertiary">
                {browserFingerprintSummary.browserFamily}
              </Chip>
              <Chip size="sm" variant="tertiary">
                {browserFingerprintSummary.deviceClass}
              </Chip>
              <Chip size="sm" variant="tertiary">
                {browserFingerprintSummary.timezone}
              </Chip>
            </div>
            <small>{browserFingerprintSummary.disclosure}</small>
          </Card>
          {browserProfileOperationsReport ? (
            <Card
              className="t3-browser-operations"
              variant="secondary"
              aria-label="Browser profile operations"
            >
              <Card.Header className="t3-browser-card-header">
                <span>
                  <ShieldCheck size={13} />
                  Operations
                </span>
                <Chip
                  color={
                    browserProfileOperationsReport.status === "ready"
                      ? "success"
                      : browserProfileOperationsReport.status === "blocked"
                        ? "danger"
                        : "warning"
                  }
                  size="sm"
                  variant="soft"
                >
                  {browserProfileOperationsReport.statusLabel}
                </Chip>
              </Card.Header>
              <small>{browserProfileOperationsReport.summary}</small>
              <div className="t3-browser-check-list">
                {browserProfileOperationsReport.checks.map((check) => (
                  <span key={check.id} data-status={check.status}>
                    <strong>{check.label}</strong>
                    <small>{check.summary}</small>
                  </span>
                ))}
              </div>
              <div className="t3-browser-action-strip" aria-label="Available browser actions">
                {browserProfileOperationsReport.batchActions.map((action) => (
                  <Chip key={action.id} size="sm" variant="tertiary">
                    {action.label}
                  </Chip>
                ))}
              </div>
              <small>{browserProfileOperationsReport.proxyPolicy}</small>
            </Card>
          ) : null}
          <Card
            className="t3-browser-sync"
            variant="secondary"
            aria-label="Hugerouter profile sync mock"
          >
            <Card.Header className="t3-browser-card-header">
              <span>
                <ShieldCheck size={13} />
                Hugerouter Sync
              </span>
              <Chip size="sm" variant="tertiary">
                {browserProfileSyncState?.backend ?? "local-mock-hugerouter"}
              </Chip>
            </Card.Header>
            <div>
              <Chip size="sm" variant="tertiary">
                {browserProfileSyncState?.status ?? "idle"}
              </Chip>
              <Chip size="sm" variant="tertiary">
                {browserProfileSyncState?.accountPortability ?? "local-only"}
              </Chip>
              <Chip size="sm" variant="tertiary">
                credentials blocked
              </Chip>
            </div>
            <small>
              {browserProfileSyncState?.summary ??
                "Local mock only. Sync profile metadata and a remote-session reference; do not sync cookies or tokens."}
            </small>
            <Button type="button" onPress={syncBrowserProfileMock} size="md" variant="outline">
              Mock sync profile
            </Button>
          </Card>
          {browserProfileMigrationState ? (
            <Card
              className="t3-browser-migration"
              variant="secondary"
              aria-label="Multi-device profile migration"
            >
              <Card.Header className="t3-browser-card-header">
                <span>
                  <RefreshCw size={13} />
                  Device migration
                </span>
                <Chip
                  color={
                    browserProfileMigrationState.status === "available"
                      ? "success"
                      : browserProfileMigrationState.status === "conflict"
                        ? "danger"
                        : "warning"
                  }
                  size="sm"
                  variant="soft"
                >
                  {browserProfileMigrationState.status}
                </Chip>
              </Card.Header>
              <small>{browserProfileMigrationState.summary}</small>
              {browserProfileMigrationState.lock ? (
                <small>
                  Force takeover can discard unsynced state from{" "}
                  {browserProfileMigrationState.lock.deviceName}. Prefer migration after the active
                  device syncs and closes.
                </small>
              ) : null}
              <label htmlFor="t3-browser-migration-device">
                <span>Device</span>
                <Input
                  id="t3-browser-migration-device"
                  value={browserMigrationDeviceName}
                  onChange={(event) => setBrowserMigrationDeviceName(event.target.value)}
                  aria-label="Current device name"
                  placeholder="MacBook Pro"
                  variant="secondary"
                />
              </label>
              <div className="t3-browser-migration-grid">
                <span>
                  <strong>Latest</strong>
                  <small>
                    {browserProfileMigrationState.latestVersionNumber > 0
                      ? `v${browserProfileMigrationState.latestVersionNumber}`
                      : "none"}
                  </small>
                </span>
                <span>
                  <strong>Synced</strong>
                  <small>{formatBrowserSyncTime(browserProfileMigrationState.lastSyncedAt)}</small>
                </span>
                <span>
                  <strong>Source</strong>
                  <small>{browserProfileMigrationState.lastSourceDeviceName ?? "none"}</small>
                </span>
                <span>
                  <strong>Lock</strong>
                  <small>{browserProfileMigrationState.lock?.deviceName ?? "released"}</small>
                </span>
              </div>
              <div className="t3-browser-action-strip">
                <Button
                  type="button"
                  onPress={openBrowserProfileMigrationMock}
                  size="sm"
                  variant="outline"
                >
                  Continue here
                </Button>
                <Button
                  type="button"
                  onPress={syncCloseBrowserProfileMigrationMock}
                  size="sm"
                  variant="outline"
                >
                  Migrate device
                </Button>
                <Button
                  type="button"
                  onPress={forceTakeoverBrowserProfileMigrationMock}
                  size="sm"
                  variant="outline"
                >
                  Force takeover
                </Button>
                <Button
                  type="button"
                  onPress={() => restoreBrowserProfileVersionMock(null)}
                  size="sm"
                  variant="outline"
                >
                  Restore version
                </Button>
                <Button
                  type="button"
                  onPress={() => {
                    refreshBrowserMigrationState();
                  }}
                  size="sm"
                  variant="ghost"
                >
                  Refresh
                </Button>
              </div>
              <div className="t3-browser-state-class-list" aria-label="Synced browser state">
                {browserProfileMigrationState.stateClasses.map((stateClass) => (
                  <Chip key={stateClass} size="sm" variant="tertiary">
                    {stateClass}
                  </Chip>
                ))}
              </div>
              {browserProfileMigrationState.snapshots.length > 0 ? (
                <div className="t3-browser-version-list">
                  {browserProfileMigrationState.snapshots.slice(0, 3).map((snapshot) => (
                    <article key={snapshot.id}>
                      <span>
                        <strong>v{snapshot.versionNumber}</strong>
                        <small>
                          {snapshot.sourceDeviceName} · {formatBrowserSyncTime(snapshot.createdAt)}
                        </small>
                      </span>
                      <Button
                        type="button"
                        onPress={() => restoreBrowserProfileVersionMock(snapshot.id)}
                        size="sm"
                        variant="ghost"
                      >
                        Restore
                      </Button>
                    </article>
                  ))}
                </div>
              ) : null}
              {browserProfileMigrationState.auditLog.length > 0 ? (
                <div className="t3-browser-audit-list">
                  {browserProfileMigrationState.auditLog.slice(0, 3).map((entry) => (
                    <span key={entry.id}>
                      <strong>{entry.action}</strong>
                      <small>
                        {entry.actorDeviceName} · {formatBrowserSyncTime(entry.createdAt)}
                      </small>
                    </span>
                  ))}
                </div>
              ) : null}
            </Card>
          ) : null}
          <T3BrowserCloudSyncCard
            customProductUrl={customProductUrl}
            profile={selectedBrowserProfile}
            providerId={browserProvider}
            recentSessions={browserRecentSessions}
            syncState={browserProfileSyncState}
          />
          {browserProductContinuity ? (
            <Card
              className="t3-browser-product-continuity"
              variant="secondary"
              aria-label="Web product continuity"
            >
              <Card.Header className="t3-browser-card-header">
                <span>
                  <Globe2 size={13} />
                  Product continuity
                </span>
                <Chip
                  color={browserProductContinuity.status === "ready" ? "success" : "warning"}
                  size="sm"
                  variant="soft"
                >
                  {browserProductContinuity.status}
                </Chip>
              </Card.Header>
              <div>
                <Chip size="sm" variant="tertiary">
                  {browserProductContinuity.siteLabel}
                </Chip>
                <Chip size="sm" variant="tertiary">
                  {browserProductContinuity.deviceCount} devices
                </Chip>
                <Chip size="sm" variant="tertiary">
                  {browserProductContinuity.launchMode}
                </Chip>
              </div>
              <small>{browserProductContinuity.summary}</small>
              {browserProductContinuity.recentProductSessions.length > 0 ? (
                <div className="t3-browser-continuity-sessions">
                  {browserProductContinuity.recentProductSessions.map((session) => (
                    <span key={session.id}>{session.isolatedAppLabel ?? session.profileLabel}</span>
                  ))}
                </div>
              ) : null}
            </Card>
          ) : null}
          <Card
            className="t3-browser-profile-tools"
            variant="secondary"
            aria-label="Browser profile tools"
          >
            <Card.Header className="t3-browser-card-header">
              <span>
                <Settings size={13} />
                Production tools
              </span>
              <Chip size="sm" variant="tertiary">
                {remoteBrowserProfiles.length} remote
              </Chip>
            </Card.Header>
            <small>
              Local producer controls stay UI-only; backend delivery projection remains
              authoritative.
            </small>
            <T3OperatorWorkspacePanel
              accountImportCode={browserAccountFileUnlockCode}
              busy={browserProfileBusy}
              loginStateStatus={browserLoginStateStatus}
              notice={browserProfileNotice}
              onAccountImportCodeChange={setBrowserAccountFileUnlockCode}
              onCheckLoginState={runChatGptLoginStatePreflight}
              onExportAccountFile={exportBrowserStaticData}
              onNotice={setBrowserProfileNotice}
              onOpenChatGptCapture={() => void openChatGptBuiltInBrowser("operator-delivery")}
            />
          </Card>
          <T3HugeRouterCommercialCard
            snapshot={hugeRouterCommercialSnapshot}
            onIssueRouteToken={() => void issueHugeRouterCommercialRouteToken()}
          />
        </aside>
      </div>
      <section className="t3-browser-workbench" aria-label="Browser commercial workbench">
        <header className="t3-browser-section-heading">
          <span>
            <ShieldCheck size={13} />
            Routing and access
          </span>
          <Chip size="sm" variant="tertiary">
            {browserGuestPasses.filter((pass) => pass.status === "active").length} guest passes
          </Chip>
        </header>
        <div className="t3-browser-capability-strip" aria-label="Browser product capabilities">
          <article>
            <ShieldCheck size={15} />
            <strong>Private sessions</strong>
            <small>Use the selected profile without exporting cookies or passwords.</small>
          </article>
          <article>
            <AppWindow size={15} />
            <strong>Isolated apps</strong>
            <small>Create app-scoped launches when a workflow needs separate context.</small>
          </article>
          <article>
            <Globe2 size={15} />
            <strong>Cross-device product</strong>
            <small>
              Resume the same site through remote-session metadata, not credential sync.
            </small>
          </article>
        </div>
        <div className="t3-browser-workbench-grid">
          <T3ProductLaunchPanel
            hugeRouterSnapshot={hugeRouterCommercialSnapshot}
            onNotice={setBrowserProfileNotice}
            routes={routes}
          />
          <Card
            className="t3-browser-isolated-apps"
            variant="secondary"
            aria-label="Local isolated apps"
          >
            <Card.Header className="t3-browser-card-header">
              <span>
                <AppWindow size={13} />
                Isolated Apps
              </span>
              <Chip size="sm" variant="tertiary">
                {browserIsolatedApps.length} local
              </Chip>
            </Card.Header>
            <small>
              Enable multiple app scopes locally for testing. Each app carries its own appId and
              launch context; credentials remain in the selected browser profile.
            </small>
            <label htmlFor="t3-browser-isolated-app-name">
              <span>Name</span>
              <Input
                id="t3-browser-isolated-app-name"
                value={isolatedAppName}
                onChange={(event) => setIsolatedAppName(event.target.value)}
                aria-label="Isolated app name"
                placeholder="Gemini QA"
                variant="secondary"
              />
            </label>
            <Button
              type="button"
              onPress={() => {
                if (browserProvider === "custom" && !customProductUrl.trim()) {
                  return;
                }
                createBrowserIsolatedAppMock();
              }}
              aria-disabled={browserProvider === "custom" && !customProductUrl.trim()}
              size="md"
              variant="secondary"
            >
              Enable app
            </Button>
            {browserIsolatedApps.length > 0 ? (
              <div className="t3-browser-app-list">
                {browserIsolatedApps.slice(0, 8).map((app) => (
                  <article key={app.id}>
                    <span>
                      <strong>{app.label}</strong>
                      <small>
                        {app.providerId} · launches {app.launchCount} · {app.storageBoundary}
                      </small>
                    </span>
                    <Button
                      type="button"
                      onPress={() => {
                        if (browserProfileBusy) {
                          return;
                        }
                        void openBrowserIsolatedAppMock(app);
                      }}
                      aria-disabled={browserProfileBusy}
                      size="sm"
                      variant="outline"
                    >
                      Open
                    </Button>
                    <Button
                      type="button"
                      onPress={() => {
                        if (browserProfileBusy) {
                          return;
                        }
                        removeBrowserIsolatedAppMock(app.id);
                      }}
                      aria-disabled={browserProfileBusy}
                      size="sm"
                      variant="outline"
                    >
                      Remove
                    </Button>
                  </article>
                ))}
              </div>
            ) : null}
          </Card>
          <div className="t3-ai-gateway" aria-label="Hugerouter AI gateway mock">
            <header>
              <span>
                <Globe2 size={13} />
                AI Gateway
              </span>
              <em>
                {aiGatewaySummary.routableRouteCount}/{aiGatewaySummary.routeCount} routable
              </em>
            </header>
            <div className="t3-ai-gateway-stats">
              <span>{aiGatewaySummary.requestBudgetPerDay}/day</span>
              <span>{aiGatewaySummary.maxConcurrentTasks} concurrent</span>
              <span>{aiGatewaySummary.complianceStatus}</span>
            </div>
            <small>
              Register enterprise-routable capacity from built-in Codex, local Codex or Claude, an
              arbitrary provider relay, or HugeRouter commercial route tokens. Personal browser
              sessions remain owner-supervised.
            </small>
            <label>
              <span>Owner</span>
              <input
                value={aiGatewayOwnerLabel}
                onChange={(event) => setAiGatewayOwnerLabel(event.target.value)}
                aria-label="AI gateway route owner"
                placeholder="Team member"
              />
            </label>
            <label>
              <span>Service</span>
              <select
                value={aiGatewayPlanType}
                onChange={(event) =>
                  setAiGatewayPlanType(event.target.value as T3BrowserMembershipPlanType)
                }
                aria-label="AI gateway service type"
              >
                {commercialPlanOptions.map((plan) => (
                  <option key={plan.planType} value={plan.planType}>
                    {plan.planLabel} · {plan.serviceMultiplier}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Route</span>
              <select
                value={aiGatewayRouteMode}
                onChange={(event) =>
                  setAiGatewayRouteMode(event.target.value as T3AiGatewayRouteMode)
                }
                aria-label="AI gateway route mode"
              >
                {aiGatewayRouteModeOptions.map((option) => (
                  <option key={option.routeMode} value={option.routeMode}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Requests/day</span>
              <input
                value={aiGatewayDailyBudget}
                onChange={(event) => setAiGatewayDailyBudget(event.target.value)}
                aria-label="AI gateway daily request budget"
                inputMode="numeric"
                placeholder="500"
              />
            </label>
            <label>
              <span>Concurrency</span>
              <input
                value={aiGatewayConcurrency}
                onChange={(event) => setAiGatewayConcurrency(event.target.value)}
                aria-label="AI gateway concurrency"
                inputMode="numeric"
                placeholder="4"
              />
            </label>
            <button type="button" onClick={registerAiGatewayRouteMock}>
              Register capacity
            </button>
            {aiGatewayRoutes.length > 0 ? (
              <div className="t3-ai-gateway-route-list">
                {aiGatewayRoutes.slice(0, 4).map((route) => (
                  <article key={route.id}>
                    <span>
                      <strong>{route.ownerLabel}</strong>
                      <small>
                        {route.planLabel} · {route.routeMode} · {route.requestBudgetPerDay}/day
                      </small>
                    </span>
                    <em>{route.status}</em>
                  </article>
                ))}
              </div>
            ) : null}
          </div>
          <div className="t3-hugerouter-market" aria-label="Hugerouter membership marketplace mock">
            <header>
              <span>
                <ShieldCheck size={13} />
                Hugerouter Market
              </span>
              <em>
                {hugerouterOrders.filter((order) => order.status === "escrow-held").length} escrow
              </em>
            </header>
            <small>
              Local fixture for listing and ordering HugeRouter capacity shape. HugeRouter remains
              the authority for merchant, metering, settlement, route receipts, and production
              routing.
            </small>
            <label>
              <span>Seller</span>
              <input
                value={hugerouterSellerLabel}
                onChange={(event) => setHugerouterSellerLabel(event.target.value)}
                aria-label="Hugerouter seller"
                placeholder="Hugerouter seller"
              />
            </label>
            <label>
              <span>Tier</span>
              <select
                value={hugerouterTier}
                onChange={(event) =>
                  setHugerouterTier(event.target.value as T3HugerouterMembershipTier)
                }
                aria-label="Hugerouter membership tier"
              >
                {hugerouterTierOptions.map((option) => (
                  <option key={option.tier} value={option.tier}>
                    {option.label} · {option.multiplier}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Source</span>
              <select
                value={hugerouterSourceKind}
                onChange={(event) =>
                  setHugerouterSourceKind(event.target.value as T3HugerouterCapacitySource)
                }
                aria-label="Hugerouter capacity source"
              >
                {hugerouterCapacitySourceOptions.map((option) => (
                  <option key={option.sourceKind} value={option.sourceKind}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Credits</span>
              <input
                value={hugerouterTotalCredits}
                onChange={(event) => setHugerouterTotalCredits(event.target.value)}
                aria-label="Hugerouter listing credits"
                inputMode="numeric"
                placeholder="1000000"
              />
            </label>
            <label>
              <span>Min buy</span>
              <input
                value={hugerouterMinCredits}
                onChange={(event) => setHugerouterMinCredits(event.target.value)}
                aria-label="Hugerouter minimum purchase credits"
                inputMode="numeric"
                placeholder="50000"
              />
            </label>
            <label>
              <span>$/1k</span>
              <input
                value={hugerouterUnitPrice}
                onChange={(event) => setHugerouterUnitPrice(event.target.value)}
                aria-label="Hugerouter unit price"
                inputMode="decimal"
                placeholder="0.08"
              />
            </label>
            <button type="button" onClick={publishHugerouterCapacityListingMock}>
              Publish credits
            </button>
            <label>
              <span>Buyer</span>
              <input
                value={hugerouterBuyerLabel}
                onChange={(event) => setHugerouterBuyerLabel(event.target.value)}
                aria-label="Hugerouter buyer"
                placeholder="Internal buyer"
              />
            </label>
            <label>
              <span>Buy credits</span>
              <input
                value={hugerouterBuyCredits}
                onChange={(event) => setHugerouterBuyCredits(event.target.value)}
                aria-label="Hugerouter buy credits"
                inputMode="numeric"
                placeholder="100000"
              />
            </label>
            {hugerouterListings.length > 0 ? (
              <div className="t3-hugerouter-listing-list">
                {hugerouterListings.slice(0, 4).map((listing) => (
                  <article key={listing.id}>
                    <span>
                      <strong>{listing.tierLabel}</strong>
                      <small>
                        {formatCredits(listing.availableCredits)} credits ·{" "}
                        {formatSeatPrice(listing.unitPriceCentsPerThousand)} / 1k
                      </small>
                    </span>
                    <button
                      type="button"
                      onClick={() => buyHugerouterCapacityMock(listing.id)}
                      disabled={listing.status !== "listed"}
                    >
                      Buy
                    </button>
                  </article>
                ))}
              </div>
            ) : null}
            {hugerouterOrders.length > 0 ? (
              <div className="t3-hugerouter-order-list">
                {hugerouterOrders.slice(0, 4).map((order) => (
                  <article key={order.id}>
                    <span>
                      <strong>{order.buyerLabel}</strong>
                      <small>
                        {formatCredits(order.creditsPurchased)} credits ·{" "}
                        {formatSeatPrice(order.totalPriceCents)} · {order.status}
                      </small>
                    </span>
                    <button
                      type="button"
                      onClick={() => settleHugerouterOrderMock(order.id)}
                      disabled={order.status !== "escrow-held"}
                    >
                      Settle
                    </button>
                    <button
                      type="button"
                      onClick={() => refundHugerouterOrderMock(order.id)}
                      disabled={order.status !== "escrow-held"}
                    >
                      Refund
                    </button>
                  </article>
                ))}
              </div>
            ) : null}
          </div>
          <Card
            className="t3-browser-guest-pass"
            variant="secondary"
            aria-label="Guest pass sharing mock"
          >
            <Card.Header className="t3-browser-card-header">
              <span>
                <UserPlus size={13} />
                Guest Pass
              </span>
              <Chip color="success" size="sm" variant="soft">
                {browserGuestPasses.filter((pass) => pass.status === "active").length} active
              </Chip>
            </Card.Header>
            <small>
              Share supervised remote-session use with a friend. Passwords, cookies, billing, and
              security settings stay blocked.
            </small>
            <label htmlFor="t3-browser-guest-pass-recipient">
              <span>Guest</span>
              <Input
                id="t3-browser-guest-pass-recipient"
                value={guestPassRecipient}
                onChange={(event) => setGuestPassRecipient(event.target.value)}
                aria-label="Guest pass recipient"
                placeholder="Friend"
                variant="secondary"
              />
            </label>
            <label>
              <span>Expires</span>
              <select
                value={guestPassDurationHours}
                onChange={(event) => setGuestPassDurationHours(Number(event.target.value))}
                aria-label="Guest pass duration"
              >
                <option value={1}>1 hour</option>
                <option value={2}>2 hours</option>
                <option value={8}>8 hours</option>
                <option value={24}>24 hours</option>
              </select>
            </label>
            <Button
              type="button"
              onPress={() => {
                if (browserProvider === "custom" && !customProductUrl.trim()) {
                  return;
                }
                createBrowserGuestPassMock();
              }}
              aria-disabled={browserProvider === "custom" && !customProductUrl.trim()}
              size="md"
              variant="secondary"
            >
              Create guest pass
            </Button>
            {browserGuestPasses.length > 0 ? (
              <div className="t3-browser-guest-list">
                {browserGuestPasses.slice(0, 3).map((pass) => (
                  <article key={pass.id}>
                    <span>
                      <strong>{pass.guestLabel}</strong>
                      <small>
                        {pass.providerId} · {pass.status} · expires{" "}
                        {formatGuestPassExpiry(pass.expiresAt)}
                      </small>
                    </span>
                    <code>{pass.inviteCode}</code>
                    <Button
                      type="button"
                      onPress={() => {
                        if (pass.status !== "active") {
                          return;
                        }
                        revokeBrowserGuestPassMock(pass.id);
                      }}
                      aria-disabled={pass.status !== "active"}
                      size="sm"
                      variant="outline"
                    >
                      Revoke
                    </Button>
                  </article>
                ))}
              </div>
            ) : null}
          </Card>
          <Card
            className="t3-browser-seat-pool"
            variant="secondary"
            aria-label="Membership seat pool mock"
          >
            <Card.Header className="t3-browser-card-header">
              <span>
                <Users size={13} />
                Seat Pool
              </span>
              <Chip size="sm" variant="tertiary">
                {browserSeatPool?.memberCount ?? 0}/
                {browserSeatPool?.seatLimit === null
                  ? "unlimited"
                  : (browserSeatPool?.seatLimit ?? "unlimited")}
              </Chip>
            </Card.Header>
            <small>
              {isHugerouterNativeProvider
                ? "Hugerouter manages every website by origin. Site policy is cloud-controlled; local data only uses the first-level URL as the site id."
                : "Hugerouter manages this website by origin. Third-party site policy and plan compliance are controlled by Hugerouter cloud."}
            </small>
            {currentHugerouterSiteScope ? (
              <div className="t3-ai-gateway-stats" aria-label="Hugerouter site identity">
                <span>{currentHugerouterSiteScope.siteId}</span>
                <span>policy: cloud</span>
              </div>
            ) : null}
            <label>
              <span>Tier</span>
              <select
                value={commercialPlanType}
                onChange={(event) =>
                  setCommercialPlanType(event.target.value as T3BrowserMembershipPlanType)
                }
                aria-label="Commercial membership tier"
              >
                {sellerCommercialPlanOptions.map((plan) => (
                  <option key={plan.planType} value={plan.planType}>
                    {plan.planLabel} · {plan.serviceMultiplier}
                  </option>
                ))}
              </select>
            </label>
            <label htmlFor="t3-browser-seat-price">
              <span>Seat price</span>
              <Input
                id="t3-browser-seat-price"
                value={commercialSeatPrice}
                onChange={(event) => setCommercialSeatPrice(event.target.value)}
                aria-label="Commercial seat price"
                inputMode="decimal"
                placeholder="7.99"
                variant="secondary"
              />
            </label>
            <Checkbox
              className="t3-browser-platform-rental-toggle"
              isSelected={platformRentalEnabled}
              onChange={setPlatformRentalEnabled}
              aria-label="Enable platform rental discount"
            >
              Platform rental
            </Checkbox>
            <label htmlFor="t3-browser-platform-price">
              <span>Platform price</span>
              <Input
                id="t3-browser-platform-price"
                value={platformRentalDiscountPrice}
                onChange={(event) => setPlatformRentalDiscountPrice(event.target.value)}
                aria-label="Platform rental discount price"
                disabled={!platformRentalEnabled}
                inputMode="decimal"
                placeholder="6.39"
                variant="secondary"
              />
            </label>
            <div
              className="t3-browser-platform-rental-options"
              aria-label="Supported rental platforms"
            >
              {seatPoolRentalPlatformOptions.map((option) => (
                <label key={option.platform}>
                  <input
                    checked={platformRentalPlatforms.includes(option.platform)}
                    onChange={() => togglePlatformRentalPlatform(option.platform)}
                    disabled={!platformRentalEnabled}
                    type="checkbox"
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
            <label htmlFor="t3-browser-seat-limit">
              <span>Seat limit</span>
              <Input
                id="t3-browser-seat-limit"
                value={commercialSeatLimit}
                onChange={(event) => setCommercialSeatLimit(event.target.value)}
                aria-label="Commercial seat limit"
                inputMode="numeric"
                placeholder="unlimited"
                variant="secondary"
              />
            </label>
            <Button
              type="button"
              onPress={() => {
                if (browserProvider === "custom" && !customProductUrl.trim()) {
                  return;
                }
                publishSeatPoolListingMock();
              }}
              aria-disabled={browserProvider === "custom" && !customProductUrl.trim()}
              size="md"
              variant="secondary"
            >
              Publish listing
            </Button>
            <label htmlFor="t3-browser-seat-member">
              <span>Member</span>
              <Input
                id="t3-browser-seat-member"
                value={seatPoolMemberName}
                onChange={(event) => setSeatPoolMemberName(event.target.value)}
                aria-label="Seat pool member name"
                placeholder="Member name"
                variant="secondary"
              />
            </label>
            <Button
              type="button"
              onPress={() => {
                if (browserProvider === "custom" && !customProductUrl.trim()) {
                  return;
                }
                addBrowserSeatPoolMemberMock();
              }}
              aria-disabled={browserProvider === "custom" && !customProductUrl.trim()}
              size="md"
              variant="outline"
            >
              Add seat
            </Button>
            {browserSeatPool && browserSeatPool.members.length > 0 ? (
              <div className="t3-browser-seat-list">
                {browserSeatPool.members.map((member) => (
                  <article key={member.id}>
                    <span>
                      <strong>
                        {member.seatNumber}. {member.label}
                      </strong>
                      <small>
                        {browserSeatPool.providerId} · {member.status} · {member.inviteCode}
                      </small>
                    </span>
                    <Button
                      type="button"
                      onPress={() => {
                        if (member.status !== "active") {
                          return;
                        }
                        pauseBrowserSeatPoolMemberMock(member.id);
                      }}
                      aria-disabled={member.status !== "active"}
                      size="sm"
                      variant="outline"
                    >
                      Pause
                    </Button>
                  </article>
                ))}
              </div>
            ) : null}
            <div className="t3-browser-marketplace" aria-label="Membership service marketplace">
              <label>
                <span>Find service</span>
                <select
                  value={seatListingFilter}
                  onChange={(event) =>
                    setSeatListingFilter(event.target.value as T3BrowserMembershipPlanType | "all")
                  }
                  aria-label="Membership service filter"
                >
                  <option value="all">All membership services</option>
                  {commercialPlanOptions.map((plan) => (
                    <option key={plan.planType} value={plan.planType}>
                      {plan.planLabel} · {plan.serviceMultiplier}
                    </option>
                  ))}
                </select>
              </label>
              {browserSeatListings.length > 0 ? (
                <div className="t3-browser-listing-list">
                  {browserSeatListings.slice(0, 6).map((listing) => (
                    <article key={listing.poolId}>
                      <span>
                        <strong>{listing.commercial.planLabel}</strong>
                        <small>{listing.siteLabel}</small>
                        <small>
                          {formatSeatPrice(listing.commercial.seatPriceCents)} / seat ·{" "}
                          {listing.availableSeats === null
                            ? "unlimited"
                            : `${listing.availableSeats} available`}
                        </small>
                        {listing.commercial.platformRental.enabled ? (
                          <small>
                            Platform rental{" "}
                            {formatSeatPrice(listing.commercial.platformRental.discountPriceCents)}{" "}
                            · {listing.commercial.platformRental.supportedPlatforms.join(", ")}
                          </small>
                        ) : null}
                      </span>
                      <Chip size="sm" variant="tertiary">
                        {listing.commercial.serviceMultiplier}
                      </Chip>
                    </article>
                  ))}
                </div>
              ) : (
                <small>No listings match this service filter.</small>
              )}
            </div>
          </Card>
        </div>
      </section>
      {browserRecentSessions.length > 0 ? (
        <Card
          className="t3-browser-recent"
          variant="secondary"
          aria-label="Recent browser sessions"
        >
          <Card.Header className="t3-browser-card-header">
            <span>
              <RefreshCw size={13} />
              Recent sessions
            </span>
            <Chip size="sm" variant="tertiary">
              {browserRecentSessions.length}
            </Chip>
          </Card.Header>
          {browserRecentSessions.slice(0, 3).map((session) => (
            <Button
              type="button"
              key={session.id}
              className="t3-browser-recent-item"
              onPress={() => {
                setBrowserProvider(session.providerId);
                setCustomProductUrl(session.url);
                setSelectedBrowserProfileId(session.profileId);
              }}
              variant="outline"
            >
              <strong>{session.title}</strong>
              <span>{session.profileLabel}</span>
            </Button>
          ))}
        </Card>
      ) : null}
      {remoteBrowserProfiles.length > 0 ? (
        <Card className="t3-browser-profile-list" variant="secondary">
          <Card.Header className="t3-browser-card-header">
            <span>
              <Settings size={13} />
              Remote profiles
            </span>
            <Chip size="sm" variant="tertiary">
              {remoteBrowserProfiles.length}
            </Chip>
          </Card.Header>
          {remoteBrowserProfiles.map((profile) => (
            <div key={profile.id}>
              <span>{profile.label}</span>
              <Button
                type="button"
                onPress={() => {
                  if (browserProfileBusy) {
                    return;
                  }
                  void removeRemoteBrowserProfile(profile.id);
                }}
                aria-disabled={browserProfileBusy}
                aria-label={`Remove ${profile.label}`}
                isIconOnly
                size="sm"
                variant="outline"
              >
                <Trash2 size={13} />
              </Button>
            </div>
          ))}
        </Card>
      ) : null}
      {browserProfileNotice ? <small>{browserProfileNotice}</small> : null}
    </section>
  );

  return (
    <main className={sidebarOpen ? "t3-shell sidebar-open" : "t3-shell"}>
      <T3BrowserStaticDataImportInput
        inputRef={browserStaticDataImportInputRef}
        onImport={(file) => void importBrowserStaticDataFile(file)}
      />
      <T3OperatorUnlockDialog
        open={operatorUnlockDialogOpen}
        onClose={() => setOperatorUnlockDialogOpen(false)}
        onUnlock={unlockOperatorWorkspace}
      />
      <T3WorkspaceSidebar
        activePage={visibleActivePage}
        assistantPage={assistantPage}
        loadingRoutes={loadingRoutes}
        locale={locale}
        providerOrder={providerOrder}
        routes={routes}
        selectedProvider={selectedProvider}
        selectedRoute={selectedRoute}
        sidebarOpen={sidebarOpen}
        text={text}
        timeline={visibleTimeline}
        workspaceId={workspaceId}
        operatorSessionUnlocked={operatorSessionUnlocked}
        onLockOperatorSession={lockOperatorWorkspace}
        onOpenAssistantPage={openAssistantFromSidebar}
        onOpenBrowser={() => navigateT3Page("browser")}
        onOpenChat={openChatFromSidebar}
        onOpenOperatorUnlock={() => void openOperatorUnlock()}
        onRefreshRoutes={refreshRoutes}
        onSelectProvider={setSelectedProvider}
      />

      {visibleActivePage === "browser" ? (
        browserManagementPage
      ) : (
        <T3ChatWorkspaceChrome
          canLaunchTask={canLaunchTask}
          composerAccessMode={composerAccessMode}
          composerCommandMatches={composerCommandMatches}
          composerMode={composerMode}
          composerModelOptions={composerModelOptions}
          composerReasonEffort={composerReasonEffort}
          contentOverlay={
            customerEmbeddedBrowserActive ? (
              <div
                ref={customerEmbeddedBrowserHostRef}
                aria-label="ChatGPT 内嵌浏览器"
                className="t3-customer-browser-embed"
              >
                <div className="t3-customer-browser-embed-placeholder">
                  ChatGPT 内嵌浏览器正在加载
                </div>
              </div>
            ) : null
          }
          locale={locale}
          launching={launching}
          notice={notice}
          productChrome={runtimeRoleMode === "customer"}
          prompt={prompt}
          selectedModelId={selectedModelId}
          selectedModelLabel={selectedModelLabel}
          selectedProvider={selectedProvider}
          selectedRoute={selectedRoute}
          sidebarOpen={sidebarOpen}
          visibleTimeline={visibleTimeline}
          onApplyComposerCommand={applyComposerCommand}
          onComposerAccessModeChange={setComposerAccessMode}
          onLocaleChange={setLocale}
          onComposerModeChange={setComposerMode}
          onComposerReasonEffortChange={setComposerReasonEffort}
          onLaunchTask={() => void launchTask()}
          onModelSelection={(provider, modelId) => {
            setSelectedProvider(provider);
            setSelectedModelByProvider((current) => ({
              ...current,
              [provider]: modelId,
            }));
          }}
          onPromptChange={setPrompt}
          onToggleSidebar={() => setSidebarOpen((current) => !current)}
          quickEntries={
            customerEmbeddedBrowserActive ? null : (
              <T3WorkspaceAssistantEntries
                activePage={assistantPage}
                browserAccountFileUnlockCode={browserAccountFileUnlockCode}
                browserAccountImportCode={browserAccountImportCode}
                browserDataImported={browserDataImported}
                browserDeliveryProjection={browserDeliveryProjection}
                browserImportBusy={browserProfileBusy}
                locale={locale}
                routes={routes}
                onApplyRelayRoute={applyRelayRoute}
                onAssistantPageChange={setAssistantPage}
                onBrowserAccountFileUnlockCodeChange={setBrowserAccountFileUnlockCode}
                onBrowserAccountImportCodeChange={setBrowserAccountImportCode}
                onImportBrowserData={openBrowserStaticDataImportPicker}
                onLoginChatGptAccount={() => void openChatGptBuiltInBrowser()}
                onOpenBrowser={() => navigateT3Page("browser")}
                onNotice={setNotice}
                onRedeemBrowserDelivery={() => void redeemBrowserDelivery()}
              />
            )
          }
        />
      )}
    </main>
  );
}
