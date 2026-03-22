import type {
  AcpIntegrationSummary,
  BackendPoolOnboardingPreflight,
} from "../ports/tauriRemoteServers";
import { type BackendPoolEntry, type BackendPoolSnapshot } from "../types/backendPool";
import type {
  NetbirdStatus,
  OrbitConnectTestResult,
  OrbitDeviceCodeStart,
  OrbitRunnerStatus,
  OrbitSignInPollResult,
  OrbitSignOutResult,
  RemoteBackendProfile,
} from "../../../types";

export const DEFAULT_REMOTE_HOST = "127.0.0.1:4732";
export const ORBIT_DEFAULT_POLL_INTERVAL_SECONDS = 5;
export const ORBIT_MAX_INLINE_POLL_SECONDS = 180;

export type OrbitActionResult =
  | OrbitConnectTestResult
  | OrbitSignInPollResult
  | OrbitSignOutResult
  | OrbitRunnerStatus;

export type RuntimeOperationsOrbitClient = {
  orbitConnectTest: () => Promise<OrbitConnectTestResult>;
  orbitSignInStart: () => Promise<OrbitDeviceCodeStart>;
  orbitSignInPoll: (deviceCode: string) => Promise<OrbitSignInPollResult>;
  orbitSignOut: () => Promise<OrbitSignOutResult>;
  orbitRunnerStart: () => Promise<OrbitRunnerStatus>;
  orbitRunnerStop: () => Promise<OrbitRunnerStatus>;
  orbitRunnerStatus: () => Promise<OrbitRunnerStatus>;
};

export type RuntimeOperationsOrbitActionResult = OrbitActionResult;

export function normalizeOverrideValue(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function formatErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") {
      return message;
    }
  }
  return fallback;
}

export function formatOnboardingPreflightFailure(
  preflight: BackendPoolOnboardingPreflight,
  fallback: string
): string {
  const primaryReason =
    preflight.errors[0]?.summary ??
    preflight.checks.find((check) => check.status === "failed")?.summary ??
    preflight.warnings[0]?.summary;
  return primaryReason ?? fallback;
}

export function delay(durationMs: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, durationMs);
  });
}

export function getOrbitStatusText(value: OrbitActionResult, fallback: string): string {
  if ("ok" in value) {
    if (!value.ok) {
      return value.message || fallback;
    }
    if (value.message.trim()) {
      return value.message;
    }
    if (typeof value.latencyMs === "number") {
      return `Connected to Orbit relay in ${value.latencyMs}ms.`;
    }
    return fallback;
  }

  if ("status" in value) {
    if (value.message?.trim()) {
      return value.message;
    }
    switch (value.status) {
      case "pending":
        return "Waiting for Orbit sign-in authorization.";
      case "authorized":
        return "Orbit sign in complete.";
      case "denied":
        return "Orbit sign in denied.";
      case "expired":
        return "Orbit sign in code expired.";
      case "error":
        return "Orbit sign in failed.";
      default:
        return fallback;
    }
  }

  if ("success" in value) {
    if (!value.success && value.message?.trim()) {
      return value.message;
    }
    return value.success ? "Signed out from Orbit." : fallback;
  }

  if (value.state === "running") {
    return value.pid ? `Orbit runner is running (pid ${value.pid}).` : "Orbit runner is running.";
  }
  if (value.state === "error") {
    return value.lastError?.trim() || "Orbit runner is in error state.";
  }
  return "Orbit runner is stopped.";
}

export function mergeAcpIntegrationsIntoBackendPoolSnapshot(
  snapshot: BackendPoolSnapshot | null,
  integrations: AcpIntegrationSummary[] | null
): BackendPoolSnapshot | null {
  if (!snapshot || !integrations || integrations.length === 0) {
    return snapshot;
  }

  const integrationsById = new Map(
    integrations.map((integration) => [integration.integrationId, integration] as const)
  );
  const backends = snapshot.backends.map((backend) => {
    if (backend.backendKind !== "acp" || !backend.integrationId) {
      return backend;
    }
    const integration = integrationsById.get(backend.integrationId);
    if (!integration) {
      return backend;
    }
    return {
      ...backend,
      healthy: integration.healthy,
      httpExperimental:
        integration.transportConfig.transport === "http"
          ? integration.transportConfig.experimental
          : null,
      lastError: integration.lastError,
      lastProbeAt: integration.lastProbeAt,
    } satisfies BackendPoolEntry;
  });

  return {
    ...snapshot,
    backends,
    backendsHealthy: backends.filter((backend) => backend.healthy !== false).length,
    backendsDraining: backends.filter((backend) => backend.state === "draining").length,
    updatedAt: Math.max(
      snapshot.updatedAt ?? 0,
      ...backends.map((backend) => backend.lastProbeAt ?? backend.updatedAt ?? 0)
    ),
  };
}

export function hasNetbirdSuggestedHost(status: NetbirdStatus | null): boolean {
  return typeof status?.suggestedRemoteHost === "string" && status.suggestedRemoteHost.length > 0;
}

export type PersistRemoteProfile = (patch: Partial<RemoteBackendProfile>) => Promise<void>;
