// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildManualWebRuntimeGatewayProfile,
  detectBrowserRuntimeConnectionState,
  detectBrowserRuntimeMode,
  discoverLocalRuntimeGatewayTargets,
  MANUAL_WEB_RUNTIME_GATEWAY_PROFILE_STORAGE_KEY,
  readManualWebRuntimeGatewayTarget,
  readStoredWebRuntimeGatewayProfile,
  saveStoredWebRuntimeGatewayProfile,
} from "../runtimeGatewayBrowser";

describe("runtimeGatewayBrowser", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    window.localStorage.clear();

    const tauriWindow = window as Window & {
      __TAURI__?: unknown;
      __TAURI_INTERNALS__?: unknown;
      __TAURI_IPC__?: unknown;
    };
    delete tauriWindow.__TAURI__;
    delete tauriWindow.__TAURI_INTERNALS__;
    delete tauriWindow.__TAURI_IPC__;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("reads and writes the stored manual runtime gateway profile", () => {
    saveStoredWebRuntimeGatewayProfile({
      httpBaseUrl: "http://127.0.0.1:8788/rpc",
      wsBaseUrl: "ws://127.0.0.1:8788/ws",
      authToken: "token",
      enabled: true,
    });

    expect(readStoredWebRuntimeGatewayProfile()).toEqual({
      httpBaseUrl: "http://127.0.0.1:8788/rpc",
      wsBaseUrl: "ws://127.0.0.1:8788/ws",
      authToken: "token",
      enabled: true,
    });

    saveStoredWebRuntimeGatewayProfile(null);

    expect(window.localStorage.getItem(MANUAL_WEB_RUNTIME_GATEWAY_PROFILE_STORAGE_KEY)).toBeNull();
  });

  it("maps browser runtime availability to host-neutral connection states", () => {
    expect(detectBrowserRuntimeConnectionState(null)).toBe("discoverable");

    vi.stubEnv("VITE_CODE_RUNTIME_GATEWAY_WEB_ENDPOINT", "https://runtime.example.com/rpc");
    expect(detectBrowserRuntimeConnectionState(null)).toBe("connected");

    vi.unstubAllEnvs();
    expect(
      detectBrowserRuntimeConnectionState({
        httpBaseUrl: "https://runtime.example.com/rpc",
        wsBaseUrl: "wss://runtime.example.com/ws",
        authToken: null,
        enabled: true,
      })
    ).toBe("connected");

    (
      window as Window & {
        __TAURI_INTERNALS__?: unknown;
      }
    ).__TAURI_INTERNALS__ = {
      invoke: vi.fn(),
    };

    expect(detectBrowserRuntimeConnectionState(null)).toBe("discoverable");
  });

  it("detects web runtime from stored profile or env and ignores retired tauri globals", () => {
    expect(detectBrowserRuntimeMode(null)).toBe("unavailable");

    vi.stubEnv("VITE_CODE_RUNTIME_GATEWAY_WEB_ENDPOINT", "http://127.0.0.1:8788/rpc");
    expect(detectBrowserRuntimeMode(null)).toBe("runtime-gateway-web");

    vi.unstubAllEnvs();
    expect(
      detectBrowserRuntimeMode({
        httpBaseUrl: "http://127.0.0.1:8788/rpc",
        wsBaseUrl: "ws://127.0.0.1:8788/ws",
        authToken: null,
        enabled: true,
      })
    ).toBe("runtime-gateway-web");

    (
      window as Window & {
        __TAURI_INTERNALS__?: unknown;
      }
    ).__TAURI_INTERNALS__ = {
      invoke: vi.fn(),
    };

    expect(detectBrowserRuntimeMode(null)).toBe("unavailable");
  });

  it("discovers reachable targets once per valid port and prefers host order", async () => {
    const probeTarget = vi.fn(async (target: { httpBaseUrl: string }) => {
      return (
        target.httpBaseUrl === "http://127.0.0.1:8788/rpc" ||
        target.httpBaseUrl === "http://localhost:8789/rpc"
      );
    });

    await expect(
      discoverLocalRuntimeGatewayTargets({
        ports: [8788, 8788, 8789, 70_000, Number.NaN],
        probeTarget,
      })
    ).resolves.toEqual([
      {
        host: "127.0.0.1",
        port: 8788,
        httpBaseUrl: "http://127.0.0.1:8788/rpc",
        wsBaseUrl: "ws://127.0.0.1:8788/ws",
      },
      {
        host: "localhost",
        port: 8789,
        httpBaseUrl: "http://localhost:8789/rpc",
        wsBaseUrl: "ws://localhost:8789/ws",
      },
    ]);

    expect(probeTarget).toHaveBeenCalledTimes(4);
  });

  it("builds and parses manual runtime gateway targets", () => {
    const profile = buildManualWebRuntimeGatewayProfile({
      host: "127.0.0.1",
      port: 8788,
    });

    expect(profile).toEqual({
      httpBaseUrl: "http://127.0.0.1:8788/rpc",
      wsBaseUrl: "ws://127.0.0.1:8788/ws",
      authToken: null,
      enabled: true,
    });
    expect(readManualWebRuntimeGatewayTarget(profile)).toEqual({
      host: "127.0.0.1",
      port: 8788,
    });
    expect(
      readManualWebRuntimeGatewayTarget({
        ...profile,
        httpBaseUrl: "not a url",
      })
    ).toBeNull();
  });
});
