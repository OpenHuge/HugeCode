import { hasConfiguredWebRuntimeGateway } from "./runtimeGatewayEnv";

export type ConfiguredWebRuntimeGatewayProfile = {
  httpBaseUrl: string;
  wsBaseUrl: string | null;
  authToken: string | null;
  enabled: boolean;
};

export type BrowserRuntimeConnectionState = "connected" | "discoverable" | "unavailable";

export type ManualWebRuntimeGatewayTarget = {
  host: string;
  port: number;
};

export type LocalRuntimeGatewayTarget = {
  host: string;
  port: number;
  httpBaseUrl: string;
  wsBaseUrl: string;
};

export const MANUAL_WEB_RUNTIME_GATEWAY_PROFILE_STORAGE_KEY =
  "code.manual-web-runtime-gateway-profile.v1";
export const DEFAULT_LOCAL_RUNTIME_GATEWAY_PORTS = [8788, 8789, 8790, 8791, 8792] as const;
export const LOCAL_RUNTIME_GATEWAY_PROBE_TIMEOUT_MS = 900;
export const LOOPBACK_HOST_PREFERENCE = ["127.0.0.1", "localhost"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeOptionalText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function normalizeStoredWebRuntimeGatewayProfile(
  value: unknown
): ConfiguredWebRuntimeGatewayProfile | null {
  if (!isRecord(value)) {
    return null;
  }

  const httpBaseUrl = normalizeOptionalText(value.httpBaseUrl);
  if (!httpBaseUrl) {
    return null;
  }

  return {
    httpBaseUrl,
    wsBaseUrl: normalizeOptionalText(value.wsBaseUrl),
    authToken: normalizeOptionalText(value.authToken),
    enabled: value.enabled !== false,
  };
}

export function readStoredWebRuntimeGatewayProfile(
  storageKey = MANUAL_WEB_RUNTIME_GATEWAY_PROFILE_STORAGE_KEY
): ConfiguredWebRuntimeGatewayProfile | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return null;
    }
    return normalizeStoredWebRuntimeGatewayProfile(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveStoredWebRuntimeGatewayProfile(
  profile: ConfiguredWebRuntimeGatewayProfile | null,
  storageKey = MANUAL_WEB_RUNTIME_GATEWAY_PROFILE_STORAGE_KEY
): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    if (!profile) {
      window.localStorage.removeItem(storageKey);
      return;
    }

    window.localStorage.setItem(storageKey, JSON.stringify(profile));
  } catch {
    // Ignore storage write failures so the active session can continue with
    // in-memory bindings and transport state.
  }
}

export function detectBrowserRuntimeMode(
  configuredProfile: ConfiguredWebRuntimeGatewayProfile | null
): "tauri" | "runtime-gateway-web" | "unavailable" {
  if (isTauriRuntimeBridgeAvailable()) {
    return "tauri";
  }

  if (configuredProfile?.enabled || hasConfiguredWebRuntimeGateway()) {
    return "runtime-gateway-web";
  }

  return "unavailable";
}

export function detectBrowserRuntimeConnectionState(
  configuredProfile: ConfiguredWebRuntimeGatewayProfile | null
): BrowserRuntimeConnectionState {
  if (isTauriRuntimeBridgeAvailable()) {
    return "connected";
  }

  if (configuredProfile?.enabled || hasConfiguredWebRuntimeGateway()) {
    return "connected";
  }

  return "discoverable";
}

export function isTauriRuntimeBridgeAvailable(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const tauriWindow = window as Window & {
    __TAURI__?: unknown;
    __TAURI_INTERNALS__?: unknown;
    __TAURI_IPC__?: unknown;
  };

  if (typeof tauriWindow.__TAURI_IPC__ === "function") {
    return true;
  }

  if (isRecord(tauriWindow.__TAURI_INTERNALS__)) {
    const invoke = tauriWindow.__TAURI_INTERNALS__.invoke;
    if (typeof invoke === "function") {
      return true;
    }
  }

  if (isRecord(tauriWindow.__TAURI__)) {
    const core = tauriWindow.__TAURI__.core;
    if (isRecord(core) && typeof core.invoke === "function") {
      return true;
    }
  }

  return false;
}

export function buildLocalRuntimeGatewayTarget(
  host: string,
  port: number
): LocalRuntimeGatewayTarget {
  return {
    host,
    port,
    httpBaseUrl: `http://${host}:${port}/rpc`,
    wsBaseUrl: `ws://${host}:${port}/ws`,
  };
}

export function normalizeRuntimeGatewayPorts(ports: readonly number[]): number[] {
  const uniquePorts = new Set<number>();

  ports.forEach((port) => {
    if (Number.isInteger(port) && port >= 1 && port <= 65_535) {
      uniquePorts.add(Math.trunc(port));
    }
  });

  return [...uniquePorts];
}

type DiscoverLocalRuntimeGatewayTargetsParams = {
  hosts?: readonly string[];
  ports?: readonly number[];
  probeTimeoutMs?: number;
  probeTarget: (target: LocalRuntimeGatewayTarget, probeTimeoutMs: number) => Promise<boolean>;
};

export async function discoverLocalRuntimeGatewayTargets({
  hosts = LOOPBACK_HOST_PREFERENCE,
  ports = DEFAULT_LOCAL_RUNTIME_GATEWAY_PORTS,
  probeTimeoutMs = LOCAL_RUNTIME_GATEWAY_PROBE_TIMEOUT_MS,
  probeTarget,
}: DiscoverLocalRuntimeGatewayTargetsParams): Promise<LocalRuntimeGatewayTarget[]> {
  const normalizedPorts = normalizeRuntimeGatewayPorts(ports);
  if (normalizedPorts.length === 0) {
    return [];
  }

  const results = await Promise.all(
    normalizedPorts.map(async (port) => {
      const candidates = await Promise.all(
        hosts.map(async (host) => {
          const target = buildLocalRuntimeGatewayTarget(host, port);
          const reachable = await probeTarget(target, probeTimeoutMs);
          return reachable ? target : null;
        })
      );

      return candidates.find((candidate) => candidate !== null) ?? null;
    })
  );

  return results.filter((candidate) => candidate !== null);
}

export function buildManualWebRuntimeGatewayProfile(
  target: ManualWebRuntimeGatewayTarget
): ConfiguredWebRuntimeGatewayProfile {
  const normalizedHost = target.host.trim();
  const normalizedPort = Math.trunc(target.port);

  return {
    httpBaseUrl: `http://${normalizedHost}:${normalizedPort}/rpc`,
    wsBaseUrl: `ws://${normalizedHost}:${normalizedPort}/ws`,
    authToken: null,
    enabled: true,
  };
}

export function readManualWebRuntimeGatewayTarget(
  profile: ConfiguredWebRuntimeGatewayProfile | null
): ManualWebRuntimeGatewayTarget | null {
  if (!profile) {
    return null;
  }

  try {
    const endpoint = new URL(profile.httpBaseUrl);
    const host = endpoint.hostname.trim();
    const port = Number.parseInt(endpoint.port, 10);

    if (!Number.isInteger(port) || port < 1 || port > 65_535 || host.length === 0) {
      return null;
    }

    return { host, port };
  } catch {
    return null;
  }
}
