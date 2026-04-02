import { beforeEach, describe, expect, it, vi } from "vitest";

describe("detectRuntimeMode", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    window.localStorage.clear();
    delete (window as Window & { hugeCodeDesktopHost?: unknown }).hugeCodeDesktopHost;
  });

  it("does not detect an Electron bridge runtime until a callable bridge is injected", async () => {
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

  it("detects the Electron bridge runtime when a callable bridge is injected", async () => {
    (
      window as Window & {
        hugeCodeDesktopHost?: unknown;
      }
    ).hugeCodeDesktopHost = {
      kind: "electron",
      core: {
        invoke: vi.fn(),
      },
    };

    const { detectRuntimeMode } = await import("./runtimeClientMode");

    expect(detectRuntimeMode()).toBe("electron-bridge");
  });
});
