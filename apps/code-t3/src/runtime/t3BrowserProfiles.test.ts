import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildT3BrowserFingerprintSummary,
  buildT3BrowserProductContinuity,
  buildT3AiGatewaySummaryMock,
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
  refundT3HugerouterCapacityOrderMock,
  removeT3BrowserIsolatedAppMock,
  revokeT3BrowserGuestPassMock,
  settleT3HugerouterCapacityOrderMock,
  openT3BrowserProfileMigrationMock,
  restoreT3BrowserProfileVersionMock,
  syncT3BrowserProfileToLocalMock,
  syncCloseT3BrowserProfileMigrationMock,
  updateT3BrowserSeatPoolCommercialMock,
  type T3BrowserProfileDescriptor,
} from "./t3BrowserProfiles";
import { buildT3BrowserProfileOperationsReport } from "./t3BrowserProfileOperations";
import {
  buildT3BrowserStaticDataBundle,
  exportT3BrowserSiteDataToChrome,
  importT3BrowserStaticDataBundle,
  serializeT3BrowserStaticDataBundle,
  serializeT3BrowserStaticDataBundleWithLoginState,
  importT3BrowserStaticDataLoginStateBundles,
} from "./t3BrowserStaticData";
import {
  buildT3HugeRouterCommercialServiceSnapshotMock,
  T3_HUGEROUTER_ROUTE_TOKEN_ENV_KEY,
} from "./t3HugeRouterCommercial";

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

  it("builds an operations report for profile launch, proxy, and team readiness", async () => {
    const bridge = createT3BrowserProfileBridge();
    const [profile] = await bridge.listProfiles();
    expect(profile).toBeDefined();

    const initialReport = buildT3BrowserProfileOperationsReport({
      customUrl: "https://linear.app/acme",
      profile: profile!,
      providerId: "custom",
    });

    expect(initialReport).toEqual(
      expect.objectContaining({
        credentialPolicy: expect.stringContaining("encrypted cloud-managed"),
        proxyPolicy: expect.stringContaining("host-managed"),
        status: "attention",
        teamPolicy: expect.stringContaining("Guest Pass"),
      })
    );
    expect(initialReport.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "credentials",
          status: "ready",
          summary: expect.stringContaining("encrypted same-user cloud bundles"),
        }),
        expect.objectContaining({
          id: "proxy",
          status: "attention",
        }),
        expect.objectContaining({
          id: "continuity",
          status: "attention",
        }),
      ])
    );
    expect(initialReport.batchActions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "create-guest-pass",
          status: "needs-sync",
        }),
        expect.objectContaining({
          id: "metadata-import-export",
          status: "host-managed",
          summary: expect.stringContaining("encrypted cloud restore"),
        }),
      ])
    );
    expect(JSON.stringify(initialReport)).not.toContain("credentialValue");
    expect(JSON.stringify(initialReport)).not.toContain("accessToken");

    const syncedReport = buildT3BrowserProfileOperationsReport({
      customUrl: "https://linear.app/acme",
      profile: profile!,
      providerId: "custom",
      syncState: syncT3BrowserProfileToLocalMock(profile!),
    });

    expect(syncedReport.batchActions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "create-guest-pass",
          status: "available",
        }),
      ])
    );
    expect(syncedReport.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "continuity",
          status: "ready",
        }),
      ])
    );
  });

  it("blocks operations when the custom target URL is unsafe", async () => {
    const bridge = createT3BrowserProfileBridge();
    const [profile] = await bridge.listProfiles();
    expect(profile).toBeDefined();

    const report = buildT3BrowserProfileOperationsReport({
      customUrl: "https://user:pass@example.com",
      profile: profile!,
      providerId: "custom",
    });

    expect(report.status).toBe("blocked");
    expect(report.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "target",
          status: "blocked",
          summary: expect.stringContaining("embedded credentials"),
        }),
      ])
    );
    expect(report.batchActions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "open-selected-profile",
          status: "host-managed",
        }),
      ])
    );
  });

  it("models same-user profile migration with single-writer locks and encrypted snapshots", async () => {
    const bridge = createT3BrowserProfileBridge();
    const [profile] = await bridge.listProfiles();
    expect(profile).toBeDefined();

    expect(getT3BrowserProfileMigrationState(profile!)).toEqual(
      expect.objectContaining({
        credentialPayload: "blocked",
        latestVersionNumber: 0,
        status: "available",
        syncPayload: "host-managed-encrypted",
      })
    );

    const openedOnA = openT3BrowserProfileMigrationMock({
      deviceName: "Office Mac",
      profile: profile!,
    });
    expect(openedOnA).toEqual(
      expect.objectContaining({
        currentDeviceName: "Office Mac",
        status: "in-use",
        lock: expect.objectContaining({
          deviceName: "Office Mac",
        }),
      })
    );

    const blockedOnB = openT3BrowserProfileMigrationMock({
      deviceName: "Home PC",
      profile: profile!,
    });
    expect(blockedOnB).toEqual(
      expect.objectContaining({
        currentDeviceName: "Office Mac",
        status: "in-use",
      })
    );

    const synced = syncCloseT3BrowserProfileMigrationMock({
      deviceName: "Office Mac",
      profile: profile!,
    });
    expect(synced).toEqual(
      expect.objectContaining({
        currentDeviceName: null,
        latestVersionNumber: 1,
        lastSourceDeviceName: "Office Mac",
        lock: null,
        status: "available",
        syncPayload: "host-managed-encrypted",
      })
    );
    expect(synced.snapshots[0]).toEqual(
      expect.objectContaining({
        payloadPolicy: "host-managed-encrypted",
        sourceDeviceName: "Office Mac",
        stateClasses: expect.arrayContaining([
          "cookies",
          "local-storage",
          "indexed-db",
          "extension-data",
        ]),
        versionNumber: 1,
      })
    );

    const openedOnB = openT3BrowserProfileMigrationMock({
      deviceName: "Home PC",
      profile: profile!,
    });
    expect(openedOnB).toEqual(
      expect.objectContaining({
        currentDeviceName: "Home PC",
        latestVersionNumber: 1,
        status: "in-use",
      })
    );

    const takenOver = forceTakeoverT3BrowserProfileMigrationMock({
      deviceName: "Backup Laptop",
      profile: profile!,
    });
    expect(takenOver).toEqual(
      expect.objectContaining({
        currentDeviceName: "Backup Laptop",
        status: "in-use",
      })
    );
    expect(takenOver.auditLog[0]).toEqual(
      expect.objectContaining({
        action: "force-takeover",
        previousDeviceName: "Home PC",
      })
    );

    const secondSync = syncCloseT3BrowserProfileMigrationMock({
      deviceName: "Backup Laptop",
      profile: profile!,
    });
    const restored = restoreT3BrowserProfileVersionMock({
      deviceName: "Office Mac",
      profile: profile!,
      versionId: secondSync.snapshots[1]?.id,
    });
    expect(restored).toEqual(
      expect.objectContaining({
        latestVersionNumber: 3,
        status: "available",
      })
    );
    expect(restored.auditLog[0]).toEqual(
      expect.objectContaining({
        action: "restore-version",
      })
    );

    const storedMigration = JSON.parse(
      window.localStorage.getItem("hugecode_t3_browser_profile_migration_mock_v1") ?? "{}"
    ) as Record<string, unknown>;
    expect(JSON.stringify(storedMigration)).not.toContain("credentialValue");
    expect(JSON.stringify(storedMigration)).not.toContain("accessToken");
    expect(JSON.stringify(storedMigration)).not.toContain("refreshToken");
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

  it("builds site-scoped product continuity for multi-device use without credentials", async () => {
    const bridge = createT3BrowserProfileBridge();
    const [profile] = await bridge.listProfiles();
    expect(profile).toBeDefined();

    const initialContinuity = buildT3BrowserProductContinuity({
      customUrl: "https://linear.app/acme?issue=1",
      profile: profile!,
      providerId: "custom",
      recentSessions: [],
    });
    expect(initialContinuity).toEqual(
      expect.objectContaining({
        accountPortability: "local-only",
        credentialPayload: "blocked",
        launchMode: "local-session-only",
        siteId: "https://linear.app",
        siteOrigin: "https://linear.app",
        status: "needs-sync",
      })
    );

    const syncState = syncT3BrowserProfileToLocalMock(profile!);
    await bridge.openProvider({
      customUrl: "https://linear.app/acme?issue=2",
      profileId: profile!.id,
      providerId: "custom",
    });
    const syncedContinuity = buildT3BrowserProductContinuity({
      customUrl: "https://linear.app/other/path",
      profile: profile!,
      providerId: "custom",
      recentSessions: listT3BrowserRecentSessions(),
      syncState,
    });

    expect(syncedContinuity).toEqual(
      expect.objectContaining({
        accountPortability: "remote-session",
        credentialPayload: "blocked",
        deviceCount: 2,
        launchMode: "remote-session-handoff",
        siteId: "https://linear.app",
        siteOrigin: "https://linear.app",
        status: "ready",
      })
    );
    expect(syncedContinuity.recentProductSessions).toEqual([
      expect.objectContaining({
        siteId: "https://linear.app",
      }),
    ]);
    expect(syncedContinuity).not.toHaveProperty("cookie");
    expect(syncedContinuity).not.toHaveProperty("token");
    expect(syncedContinuity).not.toHaveProperty("credentialValue");
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

  it("builds the HugeRouter commercial service contract snapshot for T3 routes", () => {
    const route = createT3AiGatewayRouteMock({
      maxConcurrentTasks: 6,
      ownerLabel: "T3 workspace",
      planType: "hugerouter-pro",
      requestBudgetPerDay: 900,
      routeMode: "official-api",
    });
    const listing = createT3HugerouterCapacityListingMock({
      minPurchaseCredits: 50_000,
      sellerLabel: "Hugerouter treasury",
      sourceKind: "hugerouter-native-credits",
      tier: "hugerouter-pro",
      totalCredits: 1_000_000,
      unitPriceCentsPerThousand: 8,
    });
    const order = createT3HugerouterCapacityOrderMock({
      buyerLabel: "Workspace buyer",
      creditsRequested: 100_000,
      listingId: listing.id,
    });

    const snapshot = buildT3HugeRouterCommercialServiceSnapshotMock({
      listings: listT3HugerouterCapacityListingsMock(),
      orders: [order],
      routes: [route],
    });

    expect(snapshot).toEqual(
      expect.objectContaining({
        connection: expect.objectContaining({
          routeBaseUrl: "https://hugerouter.openhuge.local/v1",
          status: "connected",
        }),
        order: expect.objectContaining({
          orderId: order.id,
          status: "pending_payment",
        }),
        routeToken: expect.objectContaining({
          envKey: T3_HUGEROUTER_ROUTE_TOKEN_ENV_KEY,
          lastFour: "t3v1",
          status: "active",
        }),
      })
    );
    expect(snapshot.capacity).toEqual(
      expect.objectContaining({
        concurrencyLimit: 6,
        remainingCredits: 900_000,
      })
    );
    expect(JSON.stringify(snapshot)).not.toContain("credentialValue");
    expect(JSON.stringify(snapshot)).not.toContain("accessToken");
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

  it("opens isolated apps through the HugeCode built-in browser route", async () => {
    const bridge = createT3BrowserProfileBridge();
    const [profile] = await bridge.listProfiles();
    expect(profile).toBeDefined();

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

    expect(window.open).toHaveBeenCalledWith(
      expect.stringContaining("hcbrowser=1"),
      "_blank",
      "popup,width=1180,height=860,noopener,noreferrer"
    );
    expect(window.open).toHaveBeenCalledWith(
      expect.stringContaining(`appId=${encodeURIComponent(geminiApp.id)}`),
      "_blank",
      "popup,width=1180,height=860,noopener,noreferrer"
    );
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

  it("exports and imports browser metadata as a static credential-blocked bundle", async () => {
    const bridge = createT3BrowserProfileBridge();
    const [profile] = await bridge.listProfiles();
    expect(profile).toBeDefined();

    await bridge.saveRemoteProfile({
      endpointUrl: "https://remote.example.com:9222",
      label: "Remote static profile",
    });
    syncT3BrowserProfileToLocalMock(profile!);
    syncCloseT3BrowserProfileMigrationMock({
      deviceName: "Office Mac",
      profile: profile!,
    });
    createT3BrowserIsolatedAppMock({
      label: "Gemini Static",
      profile: profile!,
      providerId: "gemini",
    });
    await bridge.openProvider({
      profileId: profile!.id,
      providerId: "gemini",
    });
    createT3AiGatewayRouteMock({
      maxConcurrentTasks: 3,
      ownerLabel: "Static owner",
      planType: "hugerouter-pro",
      requestBudgetPerDay: 1200,
      routeMode: "official-api",
    });

    const serialized = serializeT3BrowserStaticDataBundle();
    const exported = buildT3BrowserStaticDataBundle();
    expect(exported.payloadPolicy).toBe("host-encrypted-browser-state");
    expect(serialized).toContain("hugecode.t3-browser-static-data/v1");
    expect(serialized).toContain("loginStateBundles");
    expect(serialized).not.toContain("accessToken");
    expect(serialized).not.toContain("bearerToken");

    window.localStorage.clear();

    const result = importT3BrowserStaticDataBundle(serialized);

    expect(result.importedCounts.remoteProfiles).toBe(1);
    expect(result.importedCounts.recentSessions).toBe(1);
    expect(result.importedCounts.isolatedApps).toBe(1);
    expect(result.importedCounts.loginStateBundles).toBe(0);
    expect(result.profiles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Remote static profile",
          source: "remote-devtools",
        }),
      ])
    );
    expect(getT3BrowserProfileSyncState(profile!)).toEqual(
      expect.objectContaining({
        credentialPayload: "blocked",
        remoteSessionAvailable: true,
      })
    );
    expect(getT3BrowserProfileMigrationState(profile!)).toEqual(
      expect.objectContaining({
        credentialPayload: "blocked",
        latestVersionNumber: 1,
        syncPayload: "host-managed-encrypted",
      })
    );
    expect(listT3BrowserRecentSessions()).toEqual([
      expect.objectContaining({
        providerId: "gemini",
        siteId: "https://gemini.google.com",
      }),
    ]);
    expect(listT3BrowserIsolatedApps(profile!.id)).toEqual([
      expect.objectContaining({
        credentialPayload: "blocked",
        label: "Gemini Static",
      }),
    ]);
    expect(listT3AiGatewayRoutesMock()).toEqual([
      expect.objectContaining({
        credentialPayload: "blocked",
        ownerLabel: "Static owner",
      }),
    ]);
  });

  it("drops imported browser sessions with embedded URL credentials", () => {
    const maliciousBundle = JSON.stringify({
      payloadPolicy: "metadata-only-no-raw-credentials",
      schemaVersion: "hugecode.t3-browser-static-data/v1",
      payload: {
        recentSessions: [
          {
            id: "session:credential-url",
            openedAt: Date.now(),
            profileId: "current-browser",
            profileLabel: "Current browser profile",
            providerId: "custom",
            siteId: "https://example.com",
            siteLabel: "example.com",
            siteOrigin: "https://example.com",
            title: "credential URL",
            url: "https://user:pass@example.com/app",
          },
        ],
      },
    });

    const result = importT3BrowserStaticDataBundle(maliciousBundle);

    expect(result.importedCounts.recentSessions).toBe(0);
    expect(listT3BrowserRecentSessions()).toEqual([]);
  });

  it("includes host-encrypted login state when the desktop bridge can export it", async () => {
    (
      window as Window & {
        hugeCodeDesktopHost?: {
          browserStaticData?: {
            exportLoginState: () => Promise<{
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
            }>;
          };
        };
      }
    ).hugeCodeDesktopHost = {
      browserStaticData: {
        exportLoginState: async () => ({
          cookieCount: 2,
          createdAt: 1700000000000,
          encryptedPayloadBase64: "encrypted-cookie-payload",
          encryption: "electron-safe-storage",
          id: "electron-login-state:test",
          originCount: 1,
          payloadFormat: "electron-session-state/v2",
          stateByteCount: 512,
          stateFileCount: 3,
          summary: "Encrypted cookies and local browser storage.",
        }),
      },
    };

    const serialized = await serializeT3BrowserStaticDataBundleWithLoginState();
    const result = importT3BrowserStaticDataBundle(serialized);

    expect(result.importedCounts.loginStateBundles).toBe(1);
    expect(result.loginStateBundles).toEqual([
      expect.objectContaining({
        cookieCount: 2,
        encryptedPayloadBase64: "encrypted-cookie-payload",
        encryption: "electron-safe-storage",
        payloadFormat: "electron-session-state/v2",
        stateFileCount: 3,
      }),
    ]);
    expect(serialized).not.toContain("raw-cookie-value");
  });

  it("restores host-encrypted browser state bundles through the desktop bridge", async () => {
    (
      window as Window & {
        hugeCodeDesktopHost?: {
          browserStaticData?: {
            importLoginState: (bundle: unknown) => Promise<{
              importedCookies: number;
              originCount: number;
              restoredBytes: number;
              restoredFiles: number;
              success: boolean;
              summary: string;
            }>;
          };
        };
      }
    ).hugeCodeDesktopHost = {
      browserStaticData: {
        importLoginState: async () => ({
          importedCookies: 2,
          originCount: 1,
          restoredBytes: 512,
          restoredFiles: 3,
          success: true,
          summary:
            "Restored 2 encrypted login cookies and 3 local browser files (512 bytes) across 1 origins.",
        }),
      },
    };

    await expect(
      importT3BrowserStaticDataLoginStateBundles([
        {
          cookieCount: 2,
          createdAt: 1700000000000,
          encryptedPayloadBase64: "encrypted-browser-state-payload",
          encryption: "electron-safe-storage",
          id: "electron-login-state:test",
          originCount: 1,
          payloadFormat: "electron-session-state/v2",
          stateByteCount: 512,
          stateFileCount: 3,
          summary: "Encrypted cookies and local browser storage.",
        },
      ])
    ).resolves.toEqual(
      expect.objectContaining({
        importedCookies: 2,
        restoredBytes: 512,
        restoredFiles: 3,
        success: true,
        summary:
          "Restored 2 encrypted login cookies and 3 local browser files (512 bytes) across 1 origins.",
      })
    );
  });

  it("opens provider sessions through the HugeCode built-in browser route", async () => {
    const bridge = createT3BrowserProfileBridge();
    const [profile] = await bridge.listProfiles();
    expect(profile).toBeDefined();

    await bridge.openProvider({
      profileId: profile!.id,
      providerId: "chatgpt",
    });

    expect(window.open).toHaveBeenCalledWith(
      expect.stringContaining("hcbrowser=1"),
      "_blank",
      "popup,width=1180,height=860,noopener,noreferrer"
    );
    expect(window.open).toHaveBeenCalledWith(
      expect.stringContaining("target=https%3A%2F%2Fchatgpt.com%2F"),
      "_blank",
      "popup,width=1180,height=860,noopener,noreferrer"
    );
  });

  it("opens assistant workflows through explicit standalone browser entries", async () => {
    const bridge = createT3BrowserProfileBridge();

    await bridge.openProvider({
      assistant: "chatgpt",
      profileId: "current-browser",
      providerId: "chatgpt",
    });

    expect(window.open).toHaveBeenCalledWith(
      expect.stringContaining("chatgptAssistant=1"),
      "_blank",
      "popup,width=1180,height=860,noopener,noreferrer"
    );
  });

  it("carries operator delivery capture mode into the browser URL", async () => {
    const bridge = createT3BrowserProfileBridge();

    await bridge.openProvider({
      captureMode: "operator-delivery",
      profileId: "current-browser",
      providerId: "chatgpt",
    });

    expect(window.open).toHaveBeenCalledWith(
      expect.stringContaining("captureMode=operator-delivery"),
      "_blank",
      "popup,width=1180,height=860,noopener,noreferrer"
    );
  });

  it("exports built-in browser site data into a managed Chrome profile through the desktop bridge", async () => {
    (
      window as Window & {
        hugeCodeDesktopHost?: {
          browserStaticData?: {
            exportToChrome: (input: { targetUrl: string }) => Promise<{
              chromeExecutablePath: string;
              profilePath: string;
              restoredBytes: number;
              restoredFiles: number;
              summary: string;
              targetUrl: string;
            }>;
          };
        };
      }
    ).hugeCodeDesktopHost = {
      browserStaticData: {
        exportToChrome: async (input) => ({
          chromeExecutablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
          profilePath: "/tmp/hugecode-chrome-export/Default",
          restoredBytes: 2048,
          restoredFiles: 4,
          summary: "Exported 4 browser site-data files into a HugeCode-managed Chrome profile.",
          targetUrl: input.targetUrl,
        }),
      },
    };

    await expect(
      exportT3BrowserSiteDataToChrome({ targetUrl: "https://chatgpt.com/" })
    ).resolves.toEqual(
      expect.objectContaining({
        profilePath: "/tmp/hugecode-chrome-export/Default",
        restoredFiles: 4,
        targetUrl: "https://chatgpt.com/",
      })
    );
  });
});
