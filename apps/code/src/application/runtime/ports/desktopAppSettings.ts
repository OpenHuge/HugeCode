import {
  clearConfiguredWebRuntimeGatewayProfile,
  setConfiguredWebRuntimeGatewayProfile,
} from "../../../services/runtimeWebGatewayConfig";
import type { AppSettings, RemoteBackendProfile } from "../../../types";
import {
  getRuntimeAppSettings,
  updateRuntimeAppSettings,
} from "../../../services/runtimeAppSettingsBridge";

/**
 * Dedicated adapter for persisted desktop app settings.
 *
 * Multi-remote backend persistence now uses the canonical runtime RPC contract
 * (`code_app_settings_get` / `code_app_settings_update`). Application/runtime
 * remains responsible for normalization and gateway derivation so UI hooks do
 * not need to understand runtime transport details.
 */
export async function getAppSettings(): Promise<AppSettings> {
  return getRuntimeAppSettings();
}

export async function updateAppSettings(settings: AppSettings): Promise<AppSettings> {
  return updateRuntimeAppSettings(settings);
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeOptionalUrl(value: string | null | undefined): string | null {
  const normalized = normalizeOptionalText(value);
  return normalized ? normalized.replace(/\/+$/u, "") : null;
}

function resolveDefaultBackendProfile(appSettings: AppSettings): RemoteBackendProfile | null {
  const profiles = appSettings.remoteBackendProfiles ?? [];
  if (profiles.length === 0) {
    return null;
  }
  return (
    profiles.find((profile) => profile.id === appSettings.defaultRemoteBackendProfileId) ??
    profiles[0] ??
    null
  );
}

/**
 * Keep settings -> web runtime gateway derivation inside application/runtime
 * boundary so UI hooks do not depend on `services/*` internals.
 */
export function syncRuntimeGatewayProfileFromAppSettings(appSettings: AppSettings): void {
  const profile = resolveDefaultBackendProfile(appSettings);
  const gatewayConfig = profile?.gatewayConfig;
  const httpBaseUrl = normalizeOptionalUrl(gatewayConfig?.httpBaseUrl);

  if (!gatewayConfig || gatewayConfig.enabled === false || !httpBaseUrl) {
    clearConfiguredWebRuntimeGatewayProfile();
    return;
  }

  setConfiguredWebRuntimeGatewayProfile({
    httpBaseUrl,
    wsBaseUrl: normalizeOptionalUrl(gatewayConfig.wsBaseUrl),
    authToken: normalizeOptionalText(profile?.token),
    enabled: true,
  });
}
