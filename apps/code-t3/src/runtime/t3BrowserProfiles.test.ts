import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildT3BrowserFingerprintSummary,
  buildT3AiGatewaySummaryMock,
  addT3BrowserSeatPoolMemberMock,
  createT3AiGatewayRouteMock,
  createT3HugerouterCapacityListingMock,
  createT3HugerouterCapacityOrderMock,
  createT3BrowserIsolatedAppMock,
  createT3BrowserGuestPassMock,
  createT3BrowserProfileBridge,
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
  refundT3HugerouterCapacityOrderMock,
  removeT3BrowserIsolatedAppMock,
  revokeT3BrowserGuestPassMock,
  settleT3HugerouterCapacityOrderMock,
  syncT3BrowserProfileToLocalMock,
  updateT3BrowserSeatPoolCommercialMock,
  type T3BrowserProfileDescriptor,
} from "./t3BrowserProfiles";

describe("t3BrowserProfiles", () => {
  beforeEach(() => {
    window.localStorage.clear();
    delete window.__HUGECODE_T3_BROWSER_PROFILES__;
    delete (window as Window & { hugeCodeDesktopHost?: unknown }).hugeCodeDesktopHost;
    vi.stubGlobal("open", vi.fn());
  });

  it("keeps a current-browser profile available without stored remote profiles", async () => {
    const bridge = createT3BrowserProfileBridge();

    await expect(bridge.listProfiles()).resolves.toEqual([
      expect.objectContaining({
        id: "current-browser",
        fingerprintPolicy: "native-transparent",
        source: "current-browser",
        providerIds: ["hugerouter", "chatgpt", "gemini", "custom"],
        securityModel: "current-browser-session",
      }),
    ]);
  });

  it("persists remote DevTools profile references without storing credentials", async () => {
    const bridge = createT3BrowserProfileBridge();

    const profiles = await bridge.saveRemoteProfile({
      endpointUrl: " https://remote.example.com:9222/ ",
      label: "Remote work profile",
    });

    expect(profiles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          endpointUrl: "https://remote.example.com:9222",
          fingerprintPolicy: "native-transparent",
          label: "Remote work profile",
          securityModel: "remote-devtools-reference",
          source: "remote-devtools",
          statusMessage: expect.stringContaining("Cookies and tokens stay remote"),
        }),
      ])
    );
    expect(window.localStorage.getItem("hugecode_t3_browser_profiles_v1")).not.toContain("cookie");
  });

  it("delegates to the host bridge when one is published", async () => {
    const hostProfiles: T3BrowserProfileDescriptor[] = [
      {
        endpointUrl: "http://127.0.0.1:9222",
        fingerprintPolicy: "native-transparent",
        id: "host-profile",
        label: "Host profile",
        providerIds: ["hugerouter", "chatgpt", "gemini", "custom"],
        securityModel: "remote-devtools-reference",
        source: "remote-devtools",
        status: "connected",
        statusMessage: "Connected by host.",
      },
    ];
    window.__HUGECODE_T3_BROWSER_PROFILES__ = {
      listProfiles: vi.fn(async () => hostProfiles),
    };

    const bridge = createT3BrowserProfileBridge();

    await expect(bridge.listProfiles()).resolves.toEqual([
      expect.objectContaining({
        id: "host-profile",
        status: "connected",
      }),
    ]);
  });

  it("opens a custom web product URL without embedded credentials", async () => {
    const bridge = createT3BrowserProfileBridge();

    await bridge.openProvider({
      customUrl: "https://linear.app/acme?workspace=huge",
      profileId: "current-browser",
      providerId: "custom",
    });

    expect(window.open).toHaveBeenCalledWith(
      expect.stringContaining("hcbrowser=1"),
      "_blank",
      "popup,width=1180,height=860,noopener,noreferrer"
    );
    expect(window.open).toHaveBeenCalledWith(
      expect.stringContaining("target=https%3A%2F%2Flinear.app%2Facme%3Fworkspace%3Dhuge"),
      "_blank",
      "popup,width=1180,height=860,noopener,noreferrer"
    );
    expect(listT3BrowserRecentSessions()).toEqual([
      expect.objectContaining({
        profileId: "current-browser",
        fingerprintPolicy: "native-transparent",
        providerId: "custom",
        siteId: "https://linear.app",
        siteLabel: "linear.app",
        siteOrigin: "https://linear.app",
        url: "https://linear.app/acme?workspace=huge",
      }),
    ]);
  });

  it("blocks unsafe browser profile and product URLs", async () => {
    const bridge = createT3BrowserProfileBridge();

    await expect(
      bridge.saveRemoteProfile({
        endpointUrl: "http://remote.example.com:9222",
      })
    ).rejects.toThrow("loopback");
    await expect(
      bridge.openProvider({
        customUrl: "https://user:pass@example.com",
        profileId: "current-browser",
        providerId: "custom",
      })
    ).rejects.toThrow("embedded credentials");
  });

  it("summarizes the native fingerprint without spoofing controls", () => {
    const summary = buildT3BrowserFingerprintSummary();

    expect(summary.policy).toBe("native-transparent");
    expect(summary.disclosure).toContain("does not spoof");
    expect(summary.language).toBeTruthy();
  });

  it("mocks Hugerouter profile sync without credential payloads", async () => {
    const bridge = createT3BrowserProfileBridge();
    const [profile] = await bridge.listProfiles();
    expect(profile).toBeDefined();

    const initialState = getT3BrowserProfileSyncState(profile!);
    expect(initialState.credentialPayload).toBe("blocked");
    expect(initialState.membershipAccountUsable).toBe(false);

    const syncedState = syncT3BrowserProfileToLocalMock(profile!);

    expect(syncedState).toEqual(
      expect.objectContaining({
        accountPortability: "remote-session",
        backend: "local-mock-hugerouter",
        credentialPayload: "blocked",
        deviceLimit: null,
        devicePolicy: "web-unbounded-mock",
        membershipAccountUsable: true,
        remoteSessionAvailable: true,
      })
    );
    const storedProfileSync = JSON.parse(
      window.localStorage.getItem("hugecode_t3_browser_profile_sync_mock_v1") ?? "{}"
    ) as Record<string, Record<string, unknown>>;
    expect(storedProfileSync["current-browser"]).toEqual(
      expect.objectContaining({
        credentialPayload: "blocked",
      })
    );
    expect(storedProfileSync["current-browser"]).not.toHaveProperty("cookie");
    expect(storedProfileSync["current-browser"]).not.toHaveProperty("token");
    expect(storedProfileSync["current-browser"]).not.toHaveProperty("credentialValue");
  });

  it("creates revocable guest passes for synced remote sessions without credentials", async () => {
    const bridge = createT3BrowserProfileBridge();
    const [profile] = await bridge.listProfiles();
    expect(profile).toBeDefined();

    expect(() =>
      createT3BrowserGuestPassMock({
        durationHours: 2,
        guestLabel: "Alice",
        profile: profile!,
        providerId: "gemini",
      })
    ).toThrow("Sync this profile");

    syncT3BrowserProfileToLocalMock(profile!);
    const pass = createT3BrowserGuestPassMock({
      durationHours: 2,
      guestLabel: "Alice",
      profile: profile!,
      providerId: "gemini",
    });

    expect(pass).toEqual(
      expect.objectContaining({
        auditMode: "owner-visible",
        credentialPayload: "blocked",
        guestLabel: "Alice",
        ownerApproval: "required-for-sensitive-actions",
        permissionMode: "supervised-use",
        providerId: "gemini",
        status: "active",
      })
    );
    expect(pass.sensitiveActionsBlocked).toEqual(
      expect.arrayContaining(["billing", "password-change", "credential-export"])
    );
    expect(listT3BrowserGuestPasses(profile!.id)).toEqual([
      expect.objectContaining({
        id: pass.id,
        status: "active",
      }),
    ]);

    const storedPasses = JSON.parse(
      window.localStorage.getItem("hugecode_t3_browser_guest_passes_mock_v1") ?? "[]"
    ) as Array<Record<string, unknown>>;
    expect(storedPasses[0]).toEqual(
      expect.objectContaining({
        credentialPayload: "blocked",
      })
    );
    expect(storedPasses[0]).not.toHaveProperty("password");
    expect(storedPasses[0]).not.toHaveProperty("cookie");
    expect(storedPasses[0]).not.toHaveProperty("token");

    const revokedPasses = revokeT3BrowserGuestPassMock(pass.id);
    expect(revokedPasses).toEqual([
      expect.objectContaining({
        id: pass.id,
        status: "revoked",
      }),
    ]);
  });

  it("manages a policy-deferred membership pool without sharing credentials or device caps", async () => {
    const bridge = createT3BrowserProfileBridge();
    const [profile] = await bridge.listProfiles();
    expect(profile).toBeDefined();

    expect(() =>
      addT3BrowserSeatPoolMemberMock({
        memberLabel: "A",
        profile: profile!,
        providerId: "gemini",
      })
    ).toThrow("Sync this profile");

    syncT3BrowserProfileToLocalMock(profile!);
    const emptyPool = getT3BrowserSeatPoolMock({
      profile: profile!,
      providerId: "gemini",
    });
    expect(emptyPool).toEqual(
      expect.objectContaining({
        complianceMode: "policy-deferred",
        credentialPayload: "blocked",
        memberCount: 0,
        providerId: "gemini",
        seatLimit: null,
      })
    );

    const labels = ["A", "B", "C", "D", "E"];
    let pool = emptyPool;
    for (const label of labels) {
      pool = addT3BrowserSeatPoolMemberMock({
        memberLabel: label,
        profile: profile!,
        providerId: "gemini",
      });
    }

    expect(pool.memberCount).toBe(5);
    expect(pool.members.map((member) => member.label)).toEqual(labels);

    const storedPools = JSON.parse(
      window.localStorage.getItem("hugecode_t3_browser_seat_pools_mock_v1") ?? "[]"
    ) as Array<Record<string, unknown>>;
    expect(storedPools[0]).toEqual(
      expect.objectContaining({
        credentialPayload: "blocked",
      })
    );
    expect(storedPools[0]).not.toHaveProperty("password");
    expect(storedPools[0]).not.toHaveProperty("cookie");
    expect(storedPools[0]).not.toHaveProperty("token");

    const pausedPool = pauseT3BrowserSeatPoolMemberMock({
      memberId: pool.members[0]!.id,
      poolId: pool.id,
    });

    expect(pausedPool).toEqual(
      expect.objectContaining({
        memberCount: 4,
      })
    );
    expect(pausedPool?.members[0]).toEqual(
      expect.objectContaining({
        status: "paused",
      })
    );
  });

  it("publishes commercial seat listings and filters by membership tier", async () => {
    const bridge = createT3BrowserProfileBridge();
    const [profile] = await bridge.listProfiles();
    expect(profile).toBeDefined();

    syncT3BrowserProfileToLocalMock(profile!);
    const listedPool = updateT3BrowserSeatPoolCommercialMock({
      platformRental: {
        discountPriceCents: 1999,
        enabled: true,
        supportedPlatforms: ["chatgpt", "hugerouter"],
      },
      planType: "chatgpt-pro-20x",
      profile: profile!,
      providerId: "chatgpt",
      seatLimit: 8,
      seatPriceCents: 2599,
    });

    expect(listedPool).toEqual(
      expect.objectContaining({
        commercial: expect.objectContaining({
          listingStatus: "listed",
          planLabel: "ChatGPT Pro 20x",
          planType: "chatgpt-pro-20x",
          platformRental: expect.objectContaining({
            discountPriceCents: 1999,
            enabled: true,
            settlementMode: "hugerouter-platform-rental-mock",
            supportedPlatforms: ["chatgpt", "hugerouter"],
          }),
          seatPriceCents: 2599,
          serviceMultiplier: "20x",
        }),
        credentialPayload: "blocked",
        seatLimit: 8,
      })
    );

    addT3BrowserSeatPoolMemberMock({
      memberLabel: "Buyer A",
      profile: profile!,
      providerId: "chatgpt",
    });

    expect(
      listT3BrowserSeatPoolListings({
        planType: "chatgpt-pro-20x",
        providerId: "chatgpt",
      })
    ).toEqual([
      expect.objectContaining({
        availableSeats: 7,
        commercial: expect.objectContaining({
          planType: "chatgpt-pro-20x",
          platformRental: expect.objectContaining({
            enabled: true,
            supportedPlatforms: ["chatgpt", "hugerouter"],
          }),
        }),
        memberCount: 1,
      }),
    ]);
    expect(
      listT3BrowserSeatPoolListings({
        planType: "chatgpt-plus",
        providerId: "chatgpt",
      })
    ).toEqual([]);

    const storedPools = JSON.parse(
      window.localStorage.getItem("hugecode_t3_browser_seat_pools_mock_v1") ?? "[]"
    ) as Array<Record<string, unknown>>;
    expect(storedPools[0]).not.toHaveProperty("password");
    expect(storedPools[0]).not.toHaveProperty("cookie");
    expect(storedPools[0]).not.toHaveProperty("token");
  });

  it("uses the Hugerouter origin site id for custom website seat data", async () => {
    const bridge = createT3BrowserProfileBridge();
    const [profile] = await bridge.listProfiles();
    expect(profile).toBeDefined();

    syncT3BrowserProfileToLocalMock(profile!);
    const listedPool = updateT3BrowserSeatPoolCommercialMock({
      customUrl: "https://linear.app/acme/settings?tab=billing",
      planType: "hugerouter-pro",
      profile: profile!,
      providerId: "custom",
      seatLimit: 4,
      seatPriceCents: 899,
    });

    const sameOriginPool = getT3BrowserSeatPoolMock({
      customUrl: "https://linear.app/acme/inbox#thread",
      profile: profile!,
      providerId: "custom",
    });

    expect(listedPool).toEqual(
      expect.objectContaining({
        id: `seat-pool:${profile!.id}:https://linear.app`,
        providerId: "hugerouter",
        siteId: "https://linear.app",
        siteLabel: "linear.app",
        siteOrigin: "https://linear.app",
      })
    );
    expect(sameOriginPool).toEqual(
      expect.objectContaining({
        id: listedPool.id,
        commercial: expect.objectContaining({
          planType: "hugerouter-pro",
          seatPriceCents: 899,
        }),
        seatLimit: 4,
      })
    );
    expect(
      listT3BrowserSeatPoolListings({
        providerId: "hugerouter",
        siteId: "https://linear.app",
      })
    ).toEqual([
      expect.objectContaining({
        poolId: listedPool.id,
        providerId: "hugerouter",
        siteId: "https://linear.app",
        siteLabel: "linear.app",
      }),
    ]);

    const pass = createT3BrowserGuestPassMock({
      customUrl: "https://linear.app/acme/settings?tab=members",
      durationHours: 2,
      guestLabel: "Origin buyer",
      profile: profile!,
      providerId: "custom",
    });
    expect(pass).toEqual(
      expect.objectContaining({
        credentialPayload: "blocked",
        providerId: "hugerouter",
        siteId: "https://linear.app",
      })
    );

    const storedPools = JSON.parse(
      window.localStorage.getItem("hugecode_t3_browser_seat_pools_mock_v1") ?? "[]"
    ) as Array<Record<string, unknown>>;
    expect(storedPools[0]).toEqual(
      expect.objectContaining({
        siteId: "https://linear.app",
        siteOrigin: "https://linear.app",
      })
    );
    expect(storedPools[0]).not.toHaveProperty("password");
    expect(storedPools[0]).not.toHaveProperty("cookie");
    expect(storedPools[0]).not.toHaveProperty("token");
  });

  it("treats Hugerouter as a native carpool and rental service product", async () => {
    const bridge = createT3BrowserProfileBridge();
    const [profile] = await bridge.listProfiles();
    expect(profile).toBeDefined();

    syncT3BrowserProfileToLocalMock(profile!);
    const listedPool = updateT3BrowserSeatPoolCommercialMock({
      platformRental: {
        discountPriceCents: 999,
        enabled: true,
        supportedPlatforms: ["hugerouter", "chatgpt", "gemini", "claude"],
      },
      planType: "hugerouter-scale",
      profile: profile!,
      providerId: "hugerouter",
      seatLimit: 20,
      seatPriceCents: 1299,
    });

    expect(listedPool).toEqual(
      expect.objectContaining({
        commercial: expect.objectContaining({
          planLabel: "Hugerouter Scale",
          planType: "hugerouter-scale",
          platformRental: expect.objectContaining({
            discountPriceCents: 999,
            enabled: true,
            supportedPlatforms: ["hugerouter", "chatgpt", "gemini", "claude"],
          }),
        }),
        complianceMode: "hugerouter-native-supported",
        concurrencyMode: "hugerouter-native-supported",
        providerId: "hugerouter",
      })
    );

    const pool = addT3BrowserSeatPoolMemberMock({
      memberLabel: "Renter A",
      profile: profile!,
      providerId: "hugerouter",
    });

    expect(pool.summary).toContain("Carpool, rental, and platform leasing are supported");
    expect(
      listT3BrowserSeatPoolListings({
        planType: "hugerouter-scale",
        providerId: "hugerouter",
      })
    ).toEqual([
      expect.objectContaining({
        availableSeats: 19,
        commercial: expect.objectContaining({
          planType: "hugerouter-scale",
        }),
        providerId: "hugerouter",
      }),
    ]);
  });

  it("registers enterprise AI gateway capacity without enabling shared-account fan-out", () => {
    const apiRoute = createT3AiGatewayRouteMock({
      maxConcurrentTasks: 8,
      ownerLabel: "Platform team",
      planType: "chatgpt-pro-20x",
      requestBudgetPerDay: 1200,
      routeMode: "official-api",
    });
    const browserSessionRoute = createT3AiGatewayRouteMock({
      maxConcurrentTasks: 4,
      ownerLabel: "Personal Plus owner",
      planType: "chatgpt-plus",
      requestBudgetPerDay: 300,
      routeMode: "supervised-session",
    });

    expect(apiRoute).toEqual(
      expect.objectContaining({
        credentialPayload: "blocked",
        planLabel: "ChatGPT Pro 20x",
        routable: true,
        status: "routable",
      })
    );
    expect(browserSessionRoute).toEqual(
      expect.objectContaining({
        credentialPayload: "blocked",
        routable: false,
        status: "review-required",
        summary: expect.stringContaining("not counted as shared-account fan-out"),
      })
    );

    expect(buildT3AiGatewaySummaryMock()).toEqual(
      expect.objectContaining({
        maxConcurrentTasks: 8,
        requestBudgetPerDay: 1200,
        routableRouteCount: 1,
        routeCount: 2,
      })
    );
    expect(listT3AiGatewayRoutesMock()).toHaveLength(2);

    const storedRoutes = JSON.parse(
      window.localStorage.getItem("hugecode_t3_ai_gateway_routes_mock_v1") ?? "[]"
    ) as Array<Record<string, unknown>>;
    expect(storedRoutes[0]).not.toHaveProperty("password");
    expect(storedRoutes[0]).not.toHaveProperty("cookie");
    expect(storedRoutes[0]).not.toHaveProperty("token");
    expect(storedRoutes[0]).not.toHaveProperty("credentialValue");
  });

  it("runs a Hugerouter-native capacity listing and escrow transaction mock", () => {
    const listing = createT3HugerouterCapacityListingMock({
      minPurchaseCredits: 50_000,
      sellerLabel: "Hugerouter treasury",
      sourceKind: "hugerouter-native-credits",
      tier: "hugerouter-scale",
      totalCredits: 1_000_000,
      unitPriceCentsPerThousand: 8,
    });

    expect(listing).toEqual(
      expect.objectContaining({
        availableCredits: 1_000_000,
        credentialPayload: "blocked",
        serviceDelivery: "hugerouter-relay-mock",
        settlementMode: "mock-escrow",
        sourceKind: "hugerouter-native-credits",
        status: "listed",
        tierLabel: "Hugerouter Scale",
      })
    );

    const order = createT3HugerouterCapacityOrderMock({
      buyerLabel: "Workspace buyer",
      creditsRequested: 100_000,
      listingId: listing.id,
    });

    expect(order).toEqual(
      expect.objectContaining({
        buyerLabel: "Workspace buyer",
        creditsPurchased: 100_000,
        credentialPayload: "blocked",
        escrowStatus: "held",
        platformFeeCents: 64,
        sellerReceivesCents: 736,
        serviceRelayStatus: "provisioned",
        status: "escrow-held",
        totalPriceCents: 800,
      })
    );
    expect(listT3HugerouterCapacityListingsMock()[0]).toEqual(
      expect.objectContaining({
        availableCredits: 900_000,
        status: "listed",
      })
    );

    expect(settleT3HugerouterCapacityOrderMock(order.id)).toEqual(
      expect.objectContaining({
        escrowStatus: "released",
        serviceRelayStatus: "settled",
        status: "settled",
      })
    );

    const refundListing = createT3HugerouterCapacityListingMock({
      minPurchaseCredits: 10_000,
      sellerLabel: "Authorized pool seller",
      sourceKind: "provider-authorized-pool",
      tier: "hugerouter-pro",
      totalCredits: 50_000,
      unitPriceCentsPerThousand: 10,
    });
    const refundOrder = createT3HugerouterCapacityOrderMock({
      buyerLabel: "Refund buyer",
      creditsRequested: 50_000,
      listingId: refundListing.id,
    });

    expect(refundT3HugerouterCapacityOrderMock(refundOrder.id)).toEqual(
      expect.objectContaining({
        escrowStatus: "refunded",
        serviceRelayStatus: "refunded",
        status: "refunded",
      })
    );
    expect(listT3HugerouterCapacityOrdersMock()).toHaveLength(2);
    expect(listT3HugerouterCapacityListingsMock()[0]).toEqual(
      expect.objectContaining({
        availableCredits: 50_000,
        status: "listed",
      })
    );

    const storedListings = JSON.parse(
      window.localStorage.getItem("hugecode_t3_hugerouter_listings_mock_v1") ?? "[]"
    ) as Array<Record<string, unknown>>;
    const storedOrders = JSON.parse(
      window.localStorage.getItem("hugecode_t3_hugerouter_orders_mock_v1") ?? "[]"
    ) as Array<Record<string, unknown>>;
    expect(storedListings[0]).not.toHaveProperty("password");
    expect(storedListings[0]).not.toHaveProperty("cookie");
    expect(storedListings[0]).not.toHaveProperty("token");
    expect(storedOrders[0]).not.toHaveProperty("password");
    expect(storedOrders[0]).not.toHaveProperty("cookie");
    expect(storedOrders[0]).not.toHaveProperty("token");
  });

  it("enables multiple local isolated apps without credential payloads", async () => {
    const bridge = createT3BrowserProfileBridge();
    const [profile] = await bridge.listProfiles();
    expect(profile).toBeDefined();

    const geminiApp = createT3BrowserIsolatedAppMock({
      label: "Gemini QA",
      profile: profile!,
      providerId: "gemini",
    });
    const chatgptApp = createT3BrowserIsolatedAppMock({
      label: "ChatGPT QA",
      profile: profile!,
      providerId: "chatgpt",
    });

    expect(listT3BrowserIsolatedApps(profile!.id)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          credentialPayload: "blocked",
          id: geminiApp.id,
          isolationMode: "local-mock-app-scope",
          storageBoundary: "electron-partition-pending",
        }),
        expect.objectContaining({
          id: chatgptApp.id,
        }),
      ])
    );

    await bridge.openProvider({
      isolatedAppId: geminiApp.id,
      profileId: profile!.id,
      providerId: "gemini",
    });

    expect(window.open).toHaveBeenCalledWith(
      expect.stringContaining(`appId=${encodeURIComponent(geminiApp.id)}`),
      "_blank",
      "popup,width=1180,height=860,noopener,noreferrer"
    );
    expect(window.open).toHaveBeenCalledWith(
      expect.stringContaining("appLabel=Gemini+QA"),
      "_blank",
      "popup,width=1180,height=860,noopener,noreferrer"
    );

    const openedApp = listT3BrowserIsolatedApps(profile!.id).find((app) => app.id === geminiApp.id);
    expect(openedApp).toEqual(
      expect.objectContaining({
        launchCount: 1,
      })
    );
    const storedApps = JSON.parse(
      window.localStorage.getItem("hugecode_t3_browser_isolated_apps_mock_v1") ?? "[]"
    ) as Array<Record<string, unknown>>;
    expect(storedApps[0]).toEqual(
      expect.objectContaining({
        credentialPayload: "blocked",
      })
    );
    expect(storedApps[0]).not.toHaveProperty("password");
    expect(storedApps[0]).not.toHaveProperty("cookie");
    expect(storedApps[0]).not.toHaveProperty("token");

    expect(removeT3BrowserIsolatedAppMock(chatgptApp.id)).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: chatgptApp.id,
        }),
      ])
    );
  });

  it("routes isolated app opens through an Electron managed partition when available", async () => {
    const bridge = createT3BrowserProfileBridge();
    const [profile] = await bridge.listProfiles();
    expect(profile).toBeDefined();
    const openSession = vi.fn(async () => ({}));
    (
      window as Window & {
        hugeCodeDesktopHost?: {
          aiWebLab?: {
            openSession: typeof openSession;
          };
        };
      }
    ).hugeCodeDesktopHost = {
      aiWebLab: {
        openSession,
      },
    };

    const geminiApp = createT3BrowserIsolatedAppMock({
      label: "Gemini Partition A",
      profile: profile!,
      providerId: "gemini",
    });

    await bridge.openProvider({
      isolatedAppId: geminiApp.id,
      profileId: profile!.id,
      providerId: "gemini",
    });

    expect(openSession).toHaveBeenCalledWith(
      expect.objectContaining({
        partitionKey: `${profile!.id}:https://gemini.google.com:${geminiApp.id}`,
        preferredSessionMode: "managed",
        preferredViewMode: "window",
        providerId: "gemini",
        url: "https://gemini.google.com/app",
      })
    );
    expect(window.open).not.toHaveBeenCalled();
    expect(listT3BrowserIsolatedApps(profile!.id)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: geminiApp.id,
          launchCount: 1,
        }),
      ])
    );
    expect(listT3BrowserRecentSessions()).toEqual([
      expect.objectContaining({
        isolatedAppId: geminiApp.id,
        providerId: "gemini",
        siteId: "https://gemini.google.com",
      }),
    ]);
  });
});
