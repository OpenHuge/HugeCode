import { describe, expect, it } from "vitest";
import { buildSettingsServerSectionViewModel } from "./settingsServerSectionViewModel";

describe("settingsServerSectionViewModel", () => {
  it("switches helper copy and suggested host with the active TCP overlay", () => {
    const model = buildSettingsServerSectionViewModel({
      isMobilePlatform: false,
      activeTcpOverlay: "netbird",
      tailscaleStatus: {
        installed: true,
        running: true,
        version: "1.80.0",
        dnsName: "builder.tailnet.ts.net",
        hostName: "builder",
        tailnetName: "tailnet",
        ipv4: ["100.64.0.4"],
        ipv6: [],
        suggestedRemoteHost: "builder.tailnet.ts.net:4732",
        message: "Tailscale connected.",
      },
      netbirdStatus: {
        installed: true,
        running: true,
        version: "0.33.0",
        dnsName: "builder.netbird.cloud",
        hostName: "builder",
        managementUrl: "https://api.netbird.io",
        ipv4: ["100.77.0.4"],
        suggestedRemoteHost: "builder.netbird.cloud:4732",
        message: "NetBird connected.",
      },
      tcpDaemonStatus: null,
    });

    expect(model.activeTcpHelperLabel).toBe("NetBird helper");
    expect(model.activeTcpSuggestedHost).toBe("builder.netbird.cloud:4732");
  });

  it("formats running daemon status with pid and listen address", () => {
    const model = buildSettingsServerSectionViewModel({
      isMobilePlatform: true,
      activeTcpOverlay: "tailscale",
      tailscaleStatus: null,
      netbirdStatus: null,
      tcpDaemonStatus: {
        state: "running",
        pid: 4321,
        startedAtMs: null,
        listenAddr: "127.0.0.1:4732",
        lastError: null,
      },
    });

    expect(model.isMobileSimplified).toBe(true);
    expect(model.tcpRunnerStatusText).toContain("pid 4321");
    expect(model.tcpRunnerStatusText).toContain("127.0.0.1:4732");
  });
});
