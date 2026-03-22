import type { AppSettings, RemoteBackendProfile } from "../../../types";

export const DEFAULT_REMOTE_BACKEND_PROFILE_ID = "remote-backend-primary";
const DEFAULT_REMOTE_BACKEND_LABEL = "Primary remote backend";
const DEFAULT_REMOTE_BACKEND_HOST = "127.0.0.1:4732";

export type RemoteServerProfilesState = {
  profiles: RemoteBackendProfile[];
  defaultProfileId: string | null;
  selectedProfileId: string | null;
  defaultExecutionBackendId: string | null;
};

type RemoteServerProfileDraftInput = Partial<RemoteBackendProfile> & {
  id?: string;
};

function normalizeTcpOverlay(
  value: RemoteBackendProfile["tcpOverlay"]
): NonNullable<RemoteBackendProfile["tcpOverlay"]> {
  return value === "netbird" ? "netbird" : "tailscale";
}

function createGeneratedProfileId(): string {
  return `remote-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
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
  if (!normalized) {
    return null;
  }
  return normalized.replace(/\/+$/u, "");
}

function normalizeOptionalPath(value: string | null | undefined): string | null {
  const normalized = normalizeOptionalText(value);
  if (!normalized) {
    return null;
  }
  return normalized.startsWith("/") ? normalized : `/${normalized}`;
}

function normalizeGatewayConfig(
  profile: Partial<RemoteBackendProfile>
): RemoteBackendProfile["gatewayConfig"] {
  const gatewayConfig = profile.gatewayConfig;
  if (!gatewayConfig) {
    return null;
  }
  return {
    httpBaseUrl: normalizeOptionalUrl(gatewayConfig.httpBaseUrl),
    wsBaseUrl: normalizeOptionalUrl(gatewayConfig.wsBaseUrl),
    authMode: gatewayConfig.authMode === "token" ? "token" : "none",
    tokenRef: normalizeOptionalText(gatewayConfig.tokenRef),
    healthcheckPath: normalizeOptionalPath(gatewayConfig.healthcheckPath),
    enabled: gatewayConfig.enabled !== false,
  };
}

function normalizeProfile(profile: RemoteBackendProfile): RemoteBackendProfile {
  const provider = profile.provider === "orbit" ? "orbit" : "tcp";
  return {
    id: profile.id.trim(),
    label: profile.label.trim() || profile.id.trim(),
    provider,
    tcpOverlay: normalizeTcpOverlay(profile.tcpOverlay),
    host: normalizeOptionalText(profile.host),
    token: normalizeOptionalText(profile.token),
    gatewayConfig: normalizeGatewayConfig(profile),
    orbitWsUrl: normalizeOptionalText(profile.orbitWsUrl),
    orbitAuthUrl: normalizeOptionalText(profile.orbitAuthUrl),
    orbitRunnerName: normalizeOptionalText(profile.orbitRunnerName),
    orbitUseAccess: Boolean(profile.orbitUseAccess),
    orbitAccessClientId: normalizeOptionalText(profile.orbitAccessClientId),
    orbitAccessClientSecretRef: normalizeOptionalText(profile.orbitAccessClientSecretRef),
  };
}

export function createDefaultRemoteServerProfile(
  overrides: Partial<RemoteBackendProfile> = {}
): RemoteBackendProfile {
  const provider = overrides.provider === "orbit" ? "orbit" : "tcp";
  return normalizeProfile({
    id: normalizeOptionalText(overrides.id) ?? DEFAULT_REMOTE_BACKEND_PROFILE_ID,
    label: normalizeOptionalText(overrides.label) ?? DEFAULT_REMOTE_BACKEND_LABEL,
    provider,
    tcpOverlay: normalizeTcpOverlay(overrides.tcpOverlay),
    host: overrides.host ?? (provider === "tcp" ? DEFAULT_REMOTE_BACKEND_HOST : null),
    token: overrides.token ?? null,
    gatewayConfig: normalizeGatewayConfig(overrides),
    orbitWsUrl: overrides.orbitWsUrl ?? null,
    orbitAuthUrl: overrides.orbitAuthUrl ?? null,
    orbitRunnerName: overrides.orbitRunnerName ?? null,
    orbitUseAccess: Boolean(overrides.orbitUseAccess),
    orbitAccessClientId: overrides.orbitAccessClientId ?? null,
    orbitAccessClientSecretRef: overrides.orbitAccessClientSecretRef ?? null,
  });
}

function readProfiles(settings: AppSettings): RemoteBackendProfile[] {
  const storedProfiles = settings.remoteBackendProfiles ?? [];
  const normalizedProfiles = storedProfiles
    .filter((profile) => profile && typeof profile.id === "string" && profile.id.trim().length > 0)
    .map((profile) => normalizeProfile(profile));
  if (normalizedProfiles.length > 0) {
    return normalizedProfiles;
  }
  return [createDefaultRemoteServerProfile()];
}

function writeProfiles(
  settings: AppSettings,
  profiles: RemoteBackendProfile[],
  defaultProfileId: string | null
): AppSettings {
  const resolvedDefaultProfile =
    profiles.find((profile) => profile.id === defaultProfileId) ?? profiles[0] ?? null;
  return {
    ...settings,
    remoteBackendProfiles: profiles,
    defaultRemoteBackendProfileId: resolvedDefaultProfile?.id ?? null,
  };
}

export function createRemoteServerProfileDraft(
  input: RemoteServerProfileDraftInput = {}
): RemoteBackendProfile {
  const id = normalizeOptionalText(input.id) ?? createGeneratedProfileId();
  return normalizeProfile({
    id,
    label: normalizeOptionalText(input.label) ?? "New remote backend",
    provider: input.provider === "orbit" ? "orbit" : "tcp",
    tcpOverlay: normalizeTcpOverlay(input.tcpOverlay),
    host: input.host ?? null,
    token: input.token ?? null,
    gatewayConfig: normalizeGatewayConfig(input),
    orbitWsUrl: input.orbitWsUrl ?? null,
    orbitAuthUrl: input.orbitAuthUrl ?? null,
    orbitRunnerName: input.orbitRunnerName ?? null,
    orbitUseAccess: Boolean(input.orbitUseAccess),
    orbitAccessClientId: input.orbitAccessClientId ?? null,
    orbitAccessClientSecretRef: input.orbitAccessClientSecretRef ?? null,
  });
}

export function readRemoteServerProfilesState(
  settings: AppSettings,
  selectedProfileId?: string | null
): RemoteServerProfilesState {
  const profiles = readProfiles(settings);
  const defaultProfileId =
    profiles.find((profile) => profile.id === settings.defaultRemoteBackendProfileId)?.id ??
    profiles[0]?.id ??
    null;
  const resolvedSelectedProfileId =
    profiles.find((profile) => profile.id === selectedProfileId)?.id ?? defaultProfileId;
  return {
    profiles,
    defaultProfileId,
    selectedProfileId: resolvedSelectedProfileId,
    defaultExecutionBackendId: normalizeOptionalText(settings.defaultRemoteExecutionBackendId),
  };
}

export function upsertRemoteServerProfile(
  settings: AppSettings,
  profile: RemoteBackendProfile
): AppSettings {
  const normalized = normalizeProfile(profile);
  const profiles = readProfiles(settings);
  const nextProfiles = profiles.some((entry) => entry.id === normalized.id)
    ? profiles.map((entry) => (entry.id === normalized.id ? normalized : entry))
    : [...profiles, normalized];
  const defaultProfileId =
    settings.defaultRemoteBackendProfileId &&
    nextProfiles.some((entry) => entry.id === settings.defaultRemoteBackendProfileId)
      ? settings.defaultRemoteBackendProfileId
      : normalized.id;
  return writeProfiles(settings, nextProfiles, defaultProfileId);
}

export function setDefaultRemoteServerProfile(
  settings: AppSettings,
  profileId: string
): AppSettings {
  const profiles = readProfiles(settings);
  if (!profiles.some((profile) => profile.id === profileId)) {
    return settings;
  }
  return writeProfiles(settings, profiles, profileId);
}

export function removeRemoteServerProfile(settings: AppSettings, profileId: string): AppSettings {
  const profiles = readProfiles(settings).filter((profile) => profile.id !== profileId);
  const nextProfiles = profiles.length > 0 ? profiles : [createDefaultRemoteServerProfile()];
  const nextDefaultProfileId =
    settings.defaultRemoteBackendProfileId === profileId
      ? (nextProfiles[0]?.id ?? null)
      : (settings.defaultRemoteBackendProfileId ?? null);
  return writeProfiles(settings, nextProfiles, nextDefaultProfileId);
}

export function setDefaultRemoteExecutionBackend(
  settings: AppSettings,
  backendId: string | null
): AppSettings {
  return {
    ...settings,
    defaultRemoteExecutionBackendId: normalizeOptionalText(backendId),
  };
}
