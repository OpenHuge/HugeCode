import { detectBrowserRuntimeMode } from "@ku0/shared/runtimeGatewayBrowser";
import type { RuntimeClientMode } from "@ku0/code-runtime-client/runtimeClientTypes";
import { isDesktopHostRuntime } from "../application/runtime/ports/desktopHostCore";
import { getConfiguredWebRuntimeGatewayProfile } from "./runtimeWebGatewayConfig";

export function detectRuntimeMode(): RuntimeClientMode {
  if (isDesktopHostRuntime()) {
    return "electron-bridge";
  }

  return detectBrowserRuntimeMode(getConfiguredWebRuntimeGatewayProfile());
}
