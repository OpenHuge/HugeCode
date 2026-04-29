import { Button, Card, Checkbox, Chip, Input } from "@heroui/react";
import {
  AppWindow,
  Fingerprint,
  ExternalLink,
  Globe2,
  Link2,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  SquarePen,
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
  eventClassName,
  formatEventTime,
  statusLabel,
  T3ChatWorkspaceChrome,
} from "./T3ChatWorkspaceChrome";
import { T3BrowserCloudSyncCard } from "./T3BrowserCloudSyncCard";
import { T3HugeRouterCommercialCard } from "./T3HugeRouterCommercialCard";
import { T3ProductLaunchPanel } from "./T3ProductLaunchPanel";
import {
  accessModeTitle,
  browserProviderTitle,
  formatCredits,
  formatSeatPrice,
  providerTitle,
} from "./t3WorkspaceLabels";
import { useT3HugeRouterCommercialService } from "./useT3HugeRouterCommercialService";
import { T3Wordmark } from "./T3Wordmark";
import {
  buildT3BrowserFingerprintSummary,
  buildT3BrowserProfileOperationsReport,
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
  type T3BrowserProfileOperationsReport,
  type T3BrowserProfileDescriptor,
  type T3BrowserProfileSyncState,
  type T3BrowserProvider,
  type T3BrowserRecentSession,
  type T3BrowserSeatPool,
  type T3BrowserSeatPoolListing,
  type T3SeatPoolRentalPlatform,
} from "../runtime/t3BrowserProfiles";

type T3WorkspaceAppProps = {
  runtimeBridge: HugeCodeRuntimeBridge;
};

type T3WorkspacePage = "chat" | "browser";
type T3ComposerMode = "build" | "plan";
type T3ComposerAccessMode = "on-request" | "full-access";
type T3ComposerReasonEffort = "medium" | "high" | "xhigh";

const providerOrder: T3CodeProviderKind[] = ["codex", "claudeAgent"];
const browserProviderOrder: T3BrowserProvider[] = ["hugerouter", "chatgpt", "gemini", "custom"];
const composerCommands = [
  {
    command: "/model",
    description: "Switch response model for this thread",
  },
  {
    command: "/plan",
    description: "Switch this thread into plan mode",
  },
  {
    command: "/default",
    description: "Switch this thread back to normal build mode",
  },
] as const;

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

function formatGuestPassExpiry(expiresAt: number) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    day: "numeric",
  }).format(new Date(expiresAt));
}

function formatBrowserSyncTime(value: number | null) {
  if (value === null) {
    return "Never";
  }
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function resolveRuntimeEventsEndpoint() {
  const configuredEndpoint = import.meta.env.VITE_CODE_RUNTIME_GATEWAY_EVENTS_ENDPOINT?.trim();
  if (configuredEndpoint) {
    return configuredEndpoint;
  }
  return import.meta.env.DEV ? "http://127.0.0.1:8788/events" : null;
}

function parseRuntimeEventStream(text: string): unknown[] {
  return text.split(/\n\n/u).flatMap((frame) => {
    const data = frame
      .split(/\n/u)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim())
      .join("\n");
    if (!data) {
      return [];
    }
    try {
      return [JSON.parse(data) as unknown];
    } catch {
      return [];
    }
  });
}

async function readRuntimeEventSnapshot(endpoint: string): Promise<unknown[]> {
  const response = await fetch(endpoint, {
    headers: {
      accept: "text/event-stream",
    },
  });
  const reader = response.body?.getReader();
  if (!reader) {
    return [];
  }
  const decoder = new TextDecoder();
  const chunks: string[] = [];
  const deadline = Date.now() + 1800;
  try {
    while (Date.now() < deadline) {
      const timeoutMs = Math.max(1, deadline - Date.now());
      const result = await Promise.race([
        reader.read(),
        new Promise<null>((resolve) => window.setTimeout(() => resolve(null), timeoutMs)),
      ]);
      if (!result) {
        break;
      }
      if (result.done) {
        break;
      }
      chunks.push(decoder.decode(result.value, { stream: true }));
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  chunks.push(decoder.decode());
  return parseRuntimeEventStream(chunks.join(""));
}

export function T3WorkspaceApp({ runtimeBridge }: T3WorkspaceAppProps) {
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
  const [remoteProfileEndpoint, setRemoteProfileEndpoint] = useState("");
  const [customProductUrl, setCustomProductUrl] = useState("");
  const [browserProfileBusy, setBrowserProfileBusy] = useState(false);
  const [browserProfileNotice, setBrowserProfileNotice] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [workspaceId] = useState("workspace-web");
  const [composerMode, setComposerMode] = useState<T3ComposerMode>("build");
  const [composerAccessMode] = useState<T3ComposerAccessMode>("on-request");
  const [composerReasonEffort] = useState<T3ComposerReasonEffort>("medium");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loadingRoutes, setLoadingRoutes] = useState(true);
  const [launching, setLaunching] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<T3CodeTimelineEvent[]>([]);
  const runtimeEventsMountedAt = useRef(Date.now());
  const browserProfileBridge = useMemo(() => createT3BrowserProfileBridge(), []);

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
    const endpoint = resolveRuntimeEventsEndpoint();
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
      void readRuntimeEventSnapshot(endpoint)
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
  }, [prompt]);
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

  async function launchTask() {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) {
      setNotice("Enter an instruction before launching a task.");
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
            ? `Plan: ${trimmedPrompt.slice(0, 72)}`
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
          label: `T3 composer (${composerMode}, ${accessModeTitle(composerAccessMode)})`,
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
            `Mode: ${composerMode === "plan" ? "Plan" : "Build"}`,
            `Access: ${accessModeTitle(composerAccessMode)}`,
            `Reasoning: ${composerReasonEffort}`,
            `Preferred backends: ${request.preferredBackendIds?.join(", ") || "runtime fallback"}`,
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

  async function saveRemoteBrowserProfile() {
    setBrowserProfileBusy(true);
    setBrowserProfileNotice(null);
    try {
      const profiles = await browserProfileBridge.saveRemoteProfile({
        endpointUrl: remoteProfileEndpoint,
      });
      setBrowserProfiles(profiles);
      const savedProfile = profiles.find(
        (profile) => profile.endpointUrl === remoteProfileEndpoint.trim().replace(/\/+$/u, "")
      );
      if (savedProfile) {
        setSelectedBrowserProfileId(savedProfile.id);
      }
      setRemoteProfileEndpoint("");
      setBrowserProfileNotice("Remote browser profile reference saved.");
    } catch (error) {
      setBrowserProfileNotice(
        error instanceof Error ? error.message : "Unable to save remote browser profile."
      );
    } finally {
      setBrowserProfileBusy(false);
    }
  }

  async function openBrowserProvider() {
    if (browserProvider === "custom" && !customProductUrl.trim()) {
      setBrowserProfileNotice("Enter a web product URL before opening a custom browser session.");
      return;
    }
    setBrowserProfileBusy(true);
    setBrowserProfileNotice(null);
    try {
      const profile = await browserProfileBridge.openProvider({
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
                Profile tools
              </span>
              <Chip size="sm" variant="tertiary">
                {remoteBrowserProfiles.length} remote
              </Chip>
            </Card.Header>
            <small>
              Add a remote DevTools profile only when you need to reference an external browser.
            </small>
            <div className="t3-browser-profile-actions">
              <Input
                value={remoteProfileEndpoint}
                onChange={(event) => setRemoteProfileEndpoint(event.target.value)}
                placeholder="https://remote-host:9222"
                aria-label="Remote DevTools endpoint"
                variant="secondary"
              />
              <Button
                type="button"
                onPress={() => {
                  if (browserProfileBusy || !remoteProfileEndpoint.trim()) {
                    return;
                  }
                  void saveRemoteBrowserProfile();
                }}
                aria-disabled={browserProfileBusy || !remoteProfileEndpoint.trim()}
                aria-label="Save remote browser profile"
                isIconOnly
                size="md"
                variant="outline"
              >
                <Link2 size={14} />
              </Button>
            </div>
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
      {sidebarOpen ? (
        <button
          className="t3-sidebar-scrim"
          type="button"
          aria-label="Close sidebar"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}
      <aside className="t3-sidebar" aria-label="HugeCode T3 navigation">
        <div className="t3-sidebar-header">
          <div className="t3-brand">
            <T3Wordmark />
            <strong>Code</strong>
            <span className="t3-stage-pill">Dev</span>
          </div>
          <button
            className="t3-icon-button"
            type="button"
            aria-label="New thread"
            title="New thread"
          >
            <SquarePen size={15} />
          </button>
        </div>

        <button className="t3-search" type="button">
          <Search size={14} />
          <span>Search</span>
        </button>

        <section className="t3-sidebar-group" aria-label="Current project">
          <header>
            <span>Projects</span>
            <button type="button" aria-label="Add project">
              <Plus size={14} />
            </button>
          </header>
          <button className="t3-project-row active" type="button">
            <span className="t3-project-dot" />
            <span>
              <strong>hugecode</strong>
              <small>{workspaceId}</small>
            </span>
          </button>
        </section>

        <section className="t3-sidebar-group" aria-label="Threads">
          <header>Threads</header>
          <button
            className={activePage === "chat" ? "t3-thread-row active" : "t3-thread-row"}
            type="button"
            onClick={() => {
              navigateT3Page("chat");
              setSidebarOpen(false);
            }}
          >
            <span className="t3-thread-status assistant" />
            <span>
              <strong>{providerTitle(selectedProvider)}</strong>
              <small>{selectedRoute?.modelId ?? "runtime default"}</small>
            </span>
          </button>
          {visibleTimeline.slice(-3).map((event) => (
            <button
              className="t3-thread-row"
              type="button"
              key={`thread-${event.id}`}
              onClick={() => {
                navigateT3Page("chat");
                setSidebarOpen(false);
              }}
            >
              <span className={`t3-thread-status ${eventClassName(event)}`} />
              <span>
                <strong>{event.title}</strong>
                <small>{formatEventTime(event.createdAt)}</small>
              </span>
            </button>
          ))}
        </section>

        <section className="t3-sidebar-group t3-provider-panel" aria-label="Local providers">
          <header>
            <span>Providers</span>
            <button type="button" onClick={refreshRoutes} aria-label="Refresh local providers">
              {loadingRoutes ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} />}
            </button>
          </header>
          <div className="t3-provider-list">
            {providerOrder.map((provider) => {
              const route = routes.find((candidate) => candidate.provider === provider);
              return (
                <button
                  type="button"
                  key={provider}
                  className={selectedProvider === provider ? "selected" : ""}
                  onClick={() => {
                    setSelectedProvider(provider);
                    setSidebarOpen(false);
                  }}
                >
                  <span>
                    <strong>{providerTitle(provider)}</strong>
                    <small>{route?.modelId ?? "local CLI"}</small>
                  </span>
                  <em className={route?.status ?? "blocked"}>{statusLabel(route)}</em>
                </button>
              );
            })}
          </div>
        </section>

        <section
          className="t3-sidebar-group t3-browser-entry"
          aria-label="Hugerouter browser entry"
        >
          <header>
            <span>Browser</span>
            <Globe2 size={14} />
          </header>
          <button
            className={activePage === "browser" ? "t3-thread-row active" : "t3-thread-row"}
            type="button"
            onClick={() => {
              navigateT3Page("browser");
              setSidebarOpen(false);
            }}
          >
            <span className="t3-thread-status assistant" />
            <span>
              <strong>Hugerouter Browser</strong>
              <small>{currentHugerouterSiteScope?.siteLabel ?? "profiles and marketplace"}</small>
            </span>
          </button>
        </section>

        <footer className="t3-sidebar-footer">
          <button type="button">
            <Settings size={14} />
            <span>Settings</span>
          </button>
        </footer>
      </aside>

      {activePage === "browser" ? (
        browserManagementPage
      ) : (
        <T3ChatWorkspaceChrome
          canLaunchTask={canLaunchTask}
          composerCommandMatches={composerCommandMatches}
          composerModelOptions={composerModelOptions}
          launching={launching}
          notice={notice}
          prompt={prompt}
          selectedModelId={selectedModelId}
          selectedModelLabel={selectedModelLabel}
          selectedProvider={selectedProvider}
          selectedRoute={selectedRoute}
          visibleTimeline={visibleTimeline}
          onApplyComposerCommand={applyComposerCommand}
          onLaunchTask={() => void launchTask()}
          onModelSelection={(provider, modelId) => {
            setSelectedProvider(provider);
            setSelectedModelByProvider((current) => ({
              ...current,
              [provider]: modelId,
            }));
          }}
          onNotice={setNotice}
          onPromptChange={setPrompt}
          onToggleSidebar={() => setSidebarOpen((current) => !current)}
        />
      )}
    </main>
  );
}
