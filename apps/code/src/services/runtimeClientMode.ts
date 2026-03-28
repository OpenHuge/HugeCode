import { detectBrowserRuntimeMode } from "@ku0/shared/runtimeGatewayBrowser";
import type { RuntimeClientMode } from "@ku0/code-runtime-client/runtimeClientTypes";
import { isTauri as hasDesktopTauriBridge } from "../application/runtime/ports/desktopHostCore";
import { getConfiguredWebRuntimeGatewayProfile } from "./runtimeWebGatewayConfig";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hasDesktopCompatRuntimeMode(mode: RuntimeClientMode): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const compatWindow = window as Window & {
    __HUGE_CODE_RUNTIME_CLIENT_MODE__?: unknown;
  };

  return compatWindow.__HUGE_CODE_RUNTIME_CLIENT_MODE__ === mode;
}

function hasLegacyCompatTauriBridge(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const compatWindow = window as Window & {
    __TAURI__?: unknown;
    __TAURI_INTERNALS__?: unknown;
  };

  if (
    isRecord(compatWindow.__TAURI_INTERNALS__) &&
    typeof compatWindow.__TAURI_INTERNALS__.invoke === "function"
  ) {
    return true;
  }

  if (isRecord(compatWindow.__TAURI__)) {
    const core = compatWindow.__TAURI__.core;
    return isRecord(core) && typeof core.invoke === "function";
  }

  return false;
}

export function detectRuntimeMode(): RuntimeClientMode {
  if (hasDesktopCompatRuntimeMode("tauri")) {
    return "tauri";
  }

  if (hasLegacyCompatTauriBridge() || hasDesktopTauriBridge()) {
    return "tauri";
  }

  return detectBrowserRuntimeMode(getConfiguredWebRuntimeGatewayProfile());
}
