import { detectBrowserRuntimeMode } from "@ku0/shared/runtimeGatewayBrowser";
import type { RuntimeClientMode } from "@ku0/code-runtime-client/runtimeClientTypes";
import { getConfiguredWebRuntimeGatewayProfile } from "./runtimeWebGatewayConfig";

export function detectRuntimeMode(): RuntimeClientMode {
  return detectBrowserRuntimeMode(getConfiguredWebRuntimeGatewayProfile());
}
