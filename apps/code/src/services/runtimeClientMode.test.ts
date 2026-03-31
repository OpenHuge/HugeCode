import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@desktop-host/core", () => ({
  isDesktopHostRuntime: vi.fn(),
}));

describe("detectRuntimeMode", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    window.localStorage.clear();

    const desktopHostWindow = window as Window & {
      __HUGE_CODE_DESKTOP_HOST__?: unknown;
      __HUGE_CODE_DESKTOP_HOST_INTERNALS__?: unknown;
      __HUGE_CODE_DESKTOP_HOST_IPC__?: unknown;
      __HUGE_CODE_RUNTIME_CLIENT_MODE__?: unknown;
    };
    delete desktopHostWindow.__HUGE_CODE_DESKTOP_HOST__;
    delete desktopHostWindow.__HUGE_CODE_DESKTOP_HOST_INTERNALS__;
    delete desktopHostWindow.__HUGE_CODE_DESKTOP_HOST_IPC__;
    delete desktopHostWindow.__HUGE_CODE_RUNTIME_CLIENT_MODE__;
  });

  it("does not detect the desktop host until a callable bridge is injected", async () => {
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

  it("detects the desktop host when a callable legacy bridge is injected", async () => {
    (
      window as Window & {
        __HUGE_CODE_DESKTOP_HOST_INTERNALS__?: unknown;
      }
    ).__HUGE_CODE_DESKTOP_HOST_INTERNALS__ = {
      invoke: vi.fn(),
    };

    const { detectRuntimeMode } = await import("./runtimeClientMode");

    expect(detectRuntimeMode()).toBe("desktop-host");
  });
});
