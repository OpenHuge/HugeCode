import { detectBrowserRuntimeMode } from "@ku0/shared/runtimeGatewayBrowser";
import type { RuntimeClientMode } from "@ku0/code-runtime-client/runtimeClientTypes";
import { isDesktopHostRuntime } from "../application/runtime/ports/desktopHostCore";
import { getConfiguredWebRuntimeGatewayProfile } from "./runtimeWebGatewayConfig";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hasDesktopCompatRuntimeMode(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const compatWindow = window as Window & {
    __HUGE_CODE_RUNTIME_CLIENT_MODE__?: unknown;
  };

  return compatWindow.__HUGE_CODE_RUNTIME_CLIENT_MODE__ === "desktop-compat";
}

function hasLegacyDesktopCompatBridge(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const compatWindow = window as Window & {
    __HUGE_CODE_DESKTOP_HOST__?: unknown;
    __HUGE_CODE_DESKTOP_HOST_INTERNALS__?: unknown;
  };

  if (
    isRecord(compatWindow.__HUGE_CODE_DESKTOP_HOST_INTERNALS__) &&
    typeof compatWindow.__HUGE_CODE_DESKTOP_HOST_INTERNALS__.invoke === "function"
  ) {
    return true;
  }

  if (isRecord(compatWindow.__HUGE_CODE_DESKTOP_HOST__)) {
    const core = compatWindow.__HUGE_CODE_DESKTOP_HOST__.core;
    return isRecord(core) && typeof core.invoke === "function";
  }

  return false;
}

export function detectRuntimeMode(): RuntimeClientMode {
  if (hasDesktopCompatRuntimeMode()) {
    return "desktop-compat";
  }

  if (hasLegacyDesktopCompatBridge() || isDesktopHostRuntime()) {
    return "desktop-compat";
  }

  return detectBrowserRuntimeMode(getConfiguredWebRuntimeGatewayProfile());
}
