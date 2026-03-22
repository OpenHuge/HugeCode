// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useRuntimeOverlayConnectivityFacade } from "./runtimeOverlayConnectivityFacade";
import type { OrbitServiceClient } from "../../../features/settings/components/settingsTypes";

vi.mock("../ports/tauriRemoteServers", () => ({
  netbirdDaemonCommandPreview: vi.fn(),
  netbirdStatus: vi.fn(),
  runBackendPoolOnboardingPreflight: vi.fn(),
  tailscaleDaemonCommandPreview: vi.fn(),
  tailscaleDaemonStart: vi.fn(),
  tailscaleDaemonStatus: vi.fn(),
  tailscaleDaemonStop: vi.fn(),
  tailscaleStatus: vi.fn(),
}));
vi.mock("../ports/tauriWorkspaceCatalog", () => ({
  listWorkspaces: vi.fn(),
}));

import {
  netbirdDaemonCommandPreview,
  netbirdStatus,
  runBackendPoolOnboardingPreflight,
  tailscaleDaemonCommandPreview,
  tailscaleDaemonStatus,
  tailscaleStatus,
} from "../ports/tauriRemoteServers";
import { listWorkspaces } from "../ports/tauriWorkspaceCatalog";

const listWorkspacesMock = vi.mocked(listWorkspaces);
const runBackendPoolOnboardingPreflightMock = vi.mocked(runBackendPoolOnboardingPreflight);
const netbirdStatusMock = vi.mocked(netbirdStatus);
const tailscaleStatusMock = vi.mocked(tailscaleStatus);
const tailscaleDaemonStatusMock = vi.mocked(tailscaleDaemonStatus);
const tailscaleDaemonCommandPreviewMock = vi.mocked(tailscaleDaemonCommandPreview);
const netbirdDaemonCommandPreviewMock = vi.mocked(netbirdDaemonCommandPreview);

function createOrbitServiceClient(): OrbitServiceClient {
  return {
    orbitConnectTest: vi.fn().mockResolvedValue({ status: "connected" }),
    orbitSignInStart: vi.fn(),
    orbitSignInPoll: vi.fn(),
    orbitSignOut: vi.fn().mockResolvedValue({ status: "signed_out" }),
    orbitRunnerStart: vi.fn().mockResolvedValue({ status: "running" }),
    orbitRunnerStop: vi.fn().mockResolvedValue({ status: "stopped" }),
    orbitRunnerStatus: vi.fn().mockResolvedValue({ status: "running" }),
  };
}

describe("useRuntimeOverlayConnectivityFacade", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runBackendPoolOnboardingPreflightMock.mockResolvedValue({
      generatedAtMs: 1,
      ok: true,
      safeToPersist: true,
      state: "validated",
      checks: [],
      warnings: [],
      errors: [],
      profilePatch: {
        provider: "tcp",
        host: "remote.example:4732",
        token: "secret-token",
        orbitWsUrl: null,
        tcpOverlay: "tailscale",
      },
      applyContract: null,
      operatorActions: [],
    } as never);
    listWorkspacesMock.mockResolvedValue([{ id: "workspace-1" }, { id: "workspace-2" }] as never);
    netbirdStatusMock.mockResolvedValue({
      installed: true,
      running: true,
      version: "0.33.0",
      dnsName: "builder.netbird.cloud",
      hostName: "builder",
      managementUrl: "https://api.netbird.io",
      ipv4: ["100.77.0.4"],
      suggestedRemoteHost: "builder.netbird.cloud:4732",
      message: "NetBird connected.",
    } as never);
    tailscaleStatusMock.mockResolvedValue({
      installed: false,
      running: false,
      version: null,
      dnsName: null,
      hostName: null,
      tailnetName: null,
      ipv4: [],
      ipv6: [],
      suggestedRemoteHost: null,
      message: "tailscale unavailable",
    } as never);
    tailscaleDaemonStatusMock.mockResolvedValue({
      state: "running",
      pid: 7,
      startedAtMs: 1,
      lastError: null,
      listenAddr: "0.0.0.0:4732",
    } as never);
    tailscaleDaemonCommandPreviewMock.mockResolvedValue({
      command: ["tailscaled", "--tun=userspace-networking"],
      displayCommand: "tailscaled --tun=userspace-networking",
      installed: false,
      needsSudo: true,
    } as never);
    netbirdDaemonCommandPreviewMock.mockResolvedValue({
      command: ["netbird", "up"],
      displayCommand: "netbird up",
      installed: true,
      needsSudo: false,
    } as never);
  });

  it("orchestrates mobile connect testing through the overlay facade", async () => {
    const persistRemoteProfile = vi.fn().mockResolvedValue(undefined);
    const onMobileConnectSuccess = vi.fn().mockResolvedValue(undefined);

    const { result } = renderHook(() =>
      useRuntimeOverlayConnectivityFacade({
        activeSection: "server",
        mobilePlatform: true,
        remoteProvider: "tcp",
        remoteHostDraft: "remote.example:4732",
        remoteTokenDraft: "secret-token",
        orbitWsUrlDraft: "",
        onPersistRemoteProfile: persistRemoteProfile,
        onMobileConnectSuccess,
        orbitServiceClient: createOrbitServiceClient(),
      })
    );

    await act(async () => {
      await result.current.handleMobileConnectTest();
    });

    expect(runBackendPoolOnboardingPreflightMock).toHaveBeenCalledWith({
      provider: "tcp",
      remoteHost: "remote.example:4732",
      remoteToken: "secret-token",
      orbitWsUrl: null,
      backendClass: "primary",
      overlay: "tailscale",
    });
    expect(persistRemoteProfile).toHaveBeenCalledWith({
      provider: "tcp",
      host: "remote.example:4732",
      token: "secret-token",
      orbitWsUrl: undefined,
      tcpOverlay: "tailscale",
    });
    expect(listWorkspacesMock).toHaveBeenCalledTimes(1);
    expect(onMobileConnectSuccess).toHaveBeenCalledTimes(1);
    expect(result.current.mobileConnectStatusText).toContain("2 workspaces reachable");
    expect(result.current.mobileConnectStatusError).toBe(false);
  });

  it("loads netbird helper state when the active tcp overlay is netbird", async () => {
    const { result } = renderHook(() =>
      useRuntimeOverlayConnectivityFacade({
        activeSection: "server",
        mobilePlatform: false,
        remoteProvider: "tcp",
        activeTcpOverlay: "netbird",
        remoteHostDraft: "builder.netbird.cloud:4732",
        remoteTokenDraft: "token-1",
        orbitWsUrlDraft: "",
        onPersistRemoteProfile: vi.fn().mockResolvedValue(undefined),
        orbitServiceClient: createOrbitServiceClient(),
      })
    );

    await waitFor(() => {
      expect(result.current.netbirdStatus?.suggestedRemoteHost).toBe("builder.netbird.cloud:4732");
    });

    expect(netbirdStatusMock).toHaveBeenCalledTimes(1);
  });
});
