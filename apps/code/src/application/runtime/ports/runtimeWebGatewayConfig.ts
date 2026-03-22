import {
  buildManualWebRuntimeGatewayProfile,
  readManualWebRuntimeGatewayTarget as readManualWebRuntimeGatewayTargetShared,
  type ConfiguredWebRuntimeGatewayProfile,
  type ManualWebRuntimeGatewayTarget,
} from "@ku0/shared/runtimeGatewayBrowser";
import {
  clearManualWebRuntimeGatewayProfile as clearManualWebRuntimeGatewayProfileService,
  readManualWebRuntimeGatewayProfile as readManualWebRuntimeGatewayProfileService,
  saveManualWebRuntimeGatewayProfile as saveManualWebRuntimeGatewayProfileService,
} from "../../../services/runtimeWebGatewayConfig";

export type { ConfiguredWebRuntimeGatewayProfile, ManualWebRuntimeGatewayTarget };

export function configureManualWebRuntimeGatewayTarget(
  target: ManualWebRuntimeGatewayTarget
): ConfiguredWebRuntimeGatewayProfile {
  const profile = buildManualWebRuntimeGatewayProfile(target);
  saveManualWebRuntimeGatewayProfileService(profile);
  return profile;
}

export function configureManualLocalWebRuntimeGatewayPort(
  port: number
): ConfiguredWebRuntimeGatewayProfile {
  return configureManualWebRuntimeGatewayTarget({ host: "127.0.0.1", port });
}

export function readManualLocalWebRuntimeGatewayPort(): number | null {
  const target = readManualWebRuntimeGatewayTarget();
  if (!target) {
    return null;
  }
  const host = target.host.trim().toLowerCase();
  if (host !== "127.0.0.1" && host !== "localhost") {
    return null;
  }
  return target.port;
}

export function readManualWebRuntimeGatewayTarget(): ManualWebRuntimeGatewayTarget | null {
  return readManualWebRuntimeGatewayTargetShared(readManualWebRuntimeGatewayProfileService());
}

export function clearManualLocalWebRuntimeGatewayPort(): void {
  clearManualWebRuntimeGatewayProfileService();
}

export function clearManualWebRuntimeGatewayTarget(): void {
  clearManualWebRuntimeGatewayProfileService();
}
