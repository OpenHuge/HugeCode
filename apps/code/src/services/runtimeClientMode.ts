import { detectBrowserRuntimeMode } from "@ku0/shared/runtimeGatewayBrowser";
import type { RuntimeClientMode } from "./runtimeClientTypes";
import { getConfiguredWebRuntimeGatewayProfile } from "./runtimeWebGatewayConfig";

export function detectRuntimeMode(): RuntimeClientMode {
  return detectBrowserRuntimeMode(getConfiguredWebRuntimeGatewayProfile());
}
