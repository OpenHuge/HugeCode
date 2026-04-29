import { beforeEach, describe, expect, it } from "vitest";
import { buildT3BrowserCloudSyncPlan } from "./t3BrowserCloudSync";
import {
  createT3BrowserProfileBridge,
  listT3BrowserRecentSessions,
  syncT3BrowserProfileToLocalMock,
} from "./t3BrowserProfiles";

describe("t3BrowserCloudSync", () => {
  beforeEach(() => {
    window.localStorage.clear();
    delete window.__HUGECODE_T3_BROWSER_PROFILES__;
    delete (window as Window & { hugeCodeDesktopHost?: unknown }).hugeCodeDesktopHost;
  });

  it("separates global sync data, local device overlays, and session continuity", async () => {
    const bridge = createT3BrowserProfileBridge();
    const [profile] = await bridge.listProfiles();
    expect(profile).toBeDefined();

    const syncState = syncT3BrowserProfileToLocalMock(profile!);
    const plan = buildT3BrowserCloudSyncPlan({
      localDeviceId: "macbook-pro",
      profile: profile!,
      providerId: "hugerouter",
      recentSessions: [],
      syncState,
    });

    expect(plan).toEqual(
      expect.objectContaining({
        approvalRequired: false,
        credentialPayload: "encrypted-cloud-managed",
        profileId: "current-browser",
        schemaVersion: "t3-browser-cloud-sync/v1",
        siteRisk: "low",
      })
    );
    expect(plan.globalLayer).toEqual(
      expect.objectContaining({
        status: "cloud-ready",
        items: expect.arrayContaining(["bookmarks", "open-tabs", "site-continuity-metadata"]),
      })
    );
    expect(plan.localOverlay).toEqual(
      expect.objectContaining({
        deviceId: "macbook-pro",
        status: "preserved",
        items: expect.arrayContaining(["download-paths", "proxy-and-vpn", "local-cache"]),
      })
    );
    expect(plan.sessionContinuity).toEqual(
      expect.objectContaining({
        canResumeWebLogin: true,
        mode: "encrypted-state-bundle",
        webSessionPayload: "encrypted-cloud-managed",
      })
    );
  });

  it("requires approval before restoring sensitive website state", async () => {
    const bridge = createT3BrowserProfileBridge();
    const [profile] = await bridge.listProfiles();
    expect(profile).toBeDefined();

    const syncState = syncT3BrowserProfileToLocalMock(profile!);
    const plan = buildT3BrowserCloudSyncPlan({
      customUrl: "https://bank.example.com/settings/security",
      profile: profile!,
      providerId: "custom",
      recentSessions: [],
      syncState,
    });

    expect(plan).toEqual(
      expect.objectContaining({
        approvalRequired: true,
        credentialPayload: "encrypted-cloud-managed",
        siteId: "https://bank.example.com",
        siteRisk: "sensitive",
      })
    );
    expect(plan.sessionContinuity).toEqual(
      expect.objectContaining({
        canResumeWebLogin: true,
        mode: "approval-gated-state-bundle",
        webSessionPayload: "encrypted-cloud-managed",
      })
    );
    expect(plan.warnings).toEqual([
      "Sensitive sites require trusted-device approval before encrypted state restore.",
    ]);
  });

  it("adds recent session pointers without returning raw credential values", async () => {
    const bridge = createT3BrowserProfileBridge();
    const [profile] = await bridge.listProfiles();
    expect(profile).toBeDefined();

    const syncState = syncT3BrowserProfileToLocalMock(profile!);
    await bridge.openProvider({
      customUrl: "https://linear.app/acme/inbox",
      profileId: profile!.id,
      providerId: "custom",
    });
    const plan = buildT3BrowserCloudSyncPlan({
      customUrl: "https://linear.app/acme/settings",
      profile: profile!,
      providerId: "custom",
      recentSessions: listT3BrowserRecentSessions(),
      syncState,
    });

    expect(plan.globalLayer.items).toEqual(expect.arrayContaining(["recent-session-pointer"]));
    expect(plan.siteRisk).toBe("sensitive");
    expect(JSON.stringify(plan)).not.toContain("password");
    expect(JSON.stringify(plan)).not.toContain("credentialValue");
    expect(JSON.stringify(plan)).not.toContain("accessToken");
  });
});
