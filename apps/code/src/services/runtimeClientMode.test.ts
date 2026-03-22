import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
  isTauri: vi.fn(),
}));

describe("detectRuntimeMode", () => {
  beforeEach(() => {
    vi.resetModules();
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

  it("does not detect tauri until a callable bridge is injected", async () => {
    const { detectRuntimeMode } = await import("./runtimeClientMode");

    expect(detectRuntimeMode()).toBe("unavailable");
  });

  it("detects web runtime when the gateway endpoint env is configured", async () => {
    vi.stubEnv("VITE_CODE_RUNTIME_GATEWAY_WEB_ENDPOINT", "/__code_runtime_rpc");

    const { detectRuntimeMode } = await import("./runtimeClientMode");

    expect(detectRuntimeMode()).toBe("runtime-gateway-web");
  });

  it("detects web runtime when a settings-backed gateway endpoint is configured", async () => {
    const gatewayConfig = await import("./runtimeWebGatewayConfig");
    gatewayConfig.setConfiguredWebRuntimeGatewayProfile({
      httpBaseUrl: "https://runtime.example.dev/rpc",
      wsBaseUrl: "wss://runtime.example.dev/ws",
      authToken: "settings-token",
      enabled: true,
    });

    const { detectRuntimeMode } = await import("./runtimeClientMode");

    expect(detectRuntimeMode()).toBe("runtime-gateway-web");
  });

  it("detects web runtime when a manual gateway profile is stored locally", async () => {
    window.localStorage.setItem(
      "code.manual-web-runtime-gateway-profile.v1",
      JSON.stringify({
        httpBaseUrl: "http://127.0.0.1:8788/rpc",
        wsBaseUrl: "ws://127.0.0.1:8788/ws",
        enabled: true,
      })
    );

    const { detectRuntimeMode } = await import("./runtimeClientMode");

    expect(detectRuntimeMode()).toBe("runtime-gateway-web");
  });

  it("detects tauri when __TAURI_INTERNALS__.invoke is injected", async () => {
    (
      window as Window & {
        __TAURI_INTERNALS__?: unknown;
      }
    ).__TAURI_INTERNALS__ = {
      invoke: vi.fn(),
    };

    const { detectRuntimeMode } = await import("./runtimeClientMode");

    expect(detectRuntimeMode()).toBe("tauri");
  });
});
