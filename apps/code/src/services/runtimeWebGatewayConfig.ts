import {
  readStoredWebRuntimeGatewayProfile,
  saveStoredWebRuntimeGatewayProfile,
  type ConfiguredWebRuntimeGatewayProfile,
} from "@ku0/shared/runtimeGatewayBrowser";

let configuredWebRuntimeGatewayProfile: ConfiguredWebRuntimeGatewayProfile | null = null;
const configuredWebRuntimeGatewayProfileListeners = new Set<() => void>();

export type { ConfiguredWebRuntimeGatewayProfile };

function emitConfiguredWebRuntimeGatewayProfileChange() {
  for (const listener of configuredWebRuntimeGatewayProfileListeners) {
    listener();
  }
}

export function getConfiguredWebRuntimeGatewayProfile(): ConfiguredWebRuntimeGatewayProfile | null {
  return configuredWebRuntimeGatewayProfile ?? readStoredWebRuntimeGatewayProfile();
}

export function clearConfiguredWebRuntimeGatewayProfile(): void {
  configuredWebRuntimeGatewayProfile = null;
  emitConfiguredWebRuntimeGatewayProfileChange();
}

export function setConfiguredWebRuntimeGatewayProfile(
  profile: ConfiguredWebRuntimeGatewayProfile | null
): void {
  configuredWebRuntimeGatewayProfile = profile;
  emitConfiguredWebRuntimeGatewayProfileChange();
}

export function saveManualWebRuntimeGatewayProfile(
  profile: ConfiguredWebRuntimeGatewayProfile | null
): void {
  saveStoredWebRuntimeGatewayProfile(profile);
  emitConfiguredWebRuntimeGatewayProfileChange();
}

export function readManualWebRuntimeGatewayProfile(): ConfiguredWebRuntimeGatewayProfile | null {
  return readStoredWebRuntimeGatewayProfile();
}

export function clearManualWebRuntimeGatewayProfile(): void {
  saveManualWebRuntimeGatewayProfile(null);
}

export function subscribeConfiguredWebRuntimeGatewayProfile(listener: () => void) {
  configuredWebRuntimeGatewayProfileListeners.add(listener);
  return () => {
    configuredWebRuntimeGatewayProfileListeners.delete(listener);
  };
}
