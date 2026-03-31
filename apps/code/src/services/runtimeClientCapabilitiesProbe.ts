import {
  CODE_RUNTIME_RPC_METHODS,
  type CodeRuntimeRpcMethod,
} from "@ku0/code-runtime-host-contract";
import { invoke } from "../application/runtime/ports/desktopHostCore";
import {
  createRuntimeRpcCapabilitiesProbeCache,
  buildWebRuntimeCapabilitiesProbeCacheKey as buildWebRuntimeCapabilitiesProbeCacheKeyShared,
  resetRuntimeRpcCapabilitiesProbeCache,
  resolveRuntimeRpcCapabilitiesSnapshot as resolveRuntimeRpcCapabilitiesSnapshotShared,
  resolveRuntimeRpcCapabilitiesWithCache,
  readCachedRuntimeCapabilitiesSnapshot,
  assertRuntimeRpcMethodSupportedByCapabilities,
} from "@ku0/code-runtime-client/runtimeClientCapabilitiesProbeCore";
import {
  isRuntimeRpcContractGuardError,
  type RuntimeRpcCapabilitiesSnapshot,
} from "@ku0/code-runtime-client/runtimeClientCapabilitiesContract";
import { resolveCanonicalCodeRuntimeRpcMethod } from "@ku0/code-runtime-client/runtimeClientMethodSets";
import type { RuntimeRpcParams } from "@ku0/code-runtime-client/runtimeClientTransportShared";
import type { RuntimeClientMode } from "@ku0/code-runtime-client/runtimeClientTypes";
import { subscribeScopedRuntimeUpdatedEvents } from "./runtimeUpdatedEvents";
import { invokeWebRuntimeRawAttempt } from "./runtimeClientWebHttpTransport";
import {
  appendRuntimeAuthTokenQuery,
  resolveTransportEndpointFromPath,
  resolveWebRuntimeAuthToken,
  resolveWebRuntimeEndpoint,
  resolveWebRuntimeWsEndpointFromEnv,
  stripEndpointQueryAndHash,
  toWebSocketEndpoint,
} from "./runtimeClientWebGateway";
import {
  clearManualWebRuntimeGatewayProfile,
  readManualWebRuntimeGatewayProfile,
} from "./runtimeWebGatewayConfig";

const runtimeCapabilitiesProbeCache = createRuntimeRpcCapabilitiesProbeCache();
const webRuntimeCapabilitiesProbeCache = createRuntimeRpcCapabilitiesProbeCache();

let webRuntimeCapabilitiesProbeCacheKey: string | null = null;
let runtimeCapabilitiesCacheInvalidationSubscribed = false;

const LOOPBACK_RUNTIME_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);

function buildWebRuntimeCapabilitiesProbeCacheKey(endpoint: string | null): string | null {
  return buildWebRuntimeCapabilitiesProbeCacheKeyShared(
    endpoint,
    endpoint ? resolveWebRuntimeAuthToken(endpoint) : null
  );
}

function isLoopbackRuntimeEndpoint(endpoint: string): boolean {
  try {
    const parsed = new URL(endpoint);
    return LOOPBACK_RUNTIME_HOSTS.has(parsed.hostname.trim().toLowerCase());
  } catch {
    return false;
  }
}

function isActiveManualLoopbackRuntimeEndpoint(endpoint: string): boolean {
  const profile = readManualWebRuntimeGatewayProfile();
  if (!profile?.enabled) {
    return false;
  }
  return (
    stripEndpointQueryAndHash(profile.httpBaseUrl) === stripEndpointQueryAndHash(endpoint) &&
    isLoopbackRuntimeEndpoint(profile.httpBaseUrl)
  );
}

function clearStaleManualLoopbackRuntimeProfile(endpoint: string, cause: unknown): boolean {
  if (!isRuntimeRpcContractGuardError(cause) || !isActiveManualLoopbackRuntimeEndpoint(endpoint)) {
    return false;
  }
  clearManualWebRuntimeGatewayProfile();
  invalidateRuntimeCapabilitiesProbeCaches();
  return true;
}

function shouldInvalidateRuntimeCapabilitiesCache(reason: unknown): boolean {
  if (typeof reason !== "string") {
    return false;
  }
  const normalizedReason = reason.trim();
  return (
    normalizedReason === "runtimeCapabilitiesPatched" || normalizedReason === "stream_reconnected"
  );
}

export function invalidateRuntimeCapabilitiesProbeCaches(): void {
  resetRuntimeRpcCapabilitiesProbeCache(runtimeCapabilitiesProbeCache);
  resetRuntimeRpcCapabilitiesProbeCache(webRuntimeCapabilitiesProbeCache);
  webRuntimeCapabilitiesProbeCacheKey = null;
}

function ensureRuntimeCapabilitiesProbeCacheInvalidationSubscription(): void {
  if (runtimeCapabilitiesCacheInvalidationSubscribed) {
    return;
  }
  runtimeCapabilitiesCacheInvalidationSubscribed = true;
  subscribeScopedRuntimeUpdatedEvents(
    {
      scopes: ["bootstrap", "models", "oauth"],
    },
    (event) => {
      if (shouldInvalidateRuntimeCapabilitiesCache(event.reason)) {
        invalidateRuntimeCapabilitiesProbeCaches();
      }
    }
  );
}

export async function resolveDesktopHostRpcCapabilitiesSnapshot(): Promise<RuntimeRpcCapabilitiesSnapshot | null> {
  ensureRuntimeCapabilitiesProbeCacheInvalidationSubscription();
  return resolveRuntimeRpcCapabilitiesWithCache(runtimeCapabilitiesProbeCache, () =>
    resolveRuntimeRpcCapabilitiesSnapshotShared(
      <Result>(candidate: string, capabilityParams: RuntimeRpcParams) =>
        invoke<Result>(candidate, capabilityParams)
    )
  );
}

export async function resolveWebRuntimeCapabilitiesSnapshot(): Promise<RuntimeRpcCapabilitiesSnapshot | null> {
  const endpoint = resolveWebRuntimeEndpoint();
  const cacheKey = buildWebRuntimeCapabilitiesProbeCacheKey(endpoint);
  const hasFetch = typeof fetch === "function";
  if (!endpoint || !hasFetch) {
    if (webRuntimeCapabilitiesProbeCacheKey !== cacheKey) {
      webRuntimeCapabilitiesProbeCacheKey = cacheKey;
      resetRuntimeRpcCapabilitiesProbeCache(webRuntimeCapabilitiesProbeCache);
    }
    return null;
  }

  if (webRuntimeCapabilitiesProbeCacheKey !== cacheKey) {
    webRuntimeCapabilitiesProbeCacheKey = cacheKey;
    resetRuntimeRpcCapabilitiesProbeCache(webRuntimeCapabilitiesProbeCache);
  }

  try {
    return await resolveRuntimeRpcCapabilitiesWithCache(webRuntimeCapabilitiesProbeCache, () =>
      resolveRuntimeRpcCapabilitiesSnapshotShared((candidate, capabilityParams) =>
        invokeWebRuntimeRawAttempt(endpoint, candidate, capabilityParams)
      )
    );
  } catch (cause) {
    if (clearStaleManualLoopbackRuntimeProfile(endpoint, cause)) {
      return null;
    }
    throw cause;
  }
}

export function readCachedWebRuntimeCapabilitiesSnapshot(): RuntimeRpcCapabilitiesSnapshot | null {
  const endpoint = resolveWebRuntimeEndpoint();
  const cacheKey = buildWebRuntimeCapabilitiesProbeCacheKey(endpoint);
  if (webRuntimeCapabilitiesProbeCacheKey !== cacheKey) {
    return null;
  }
  return readCachedRuntimeCapabilitiesSnapshot(webRuntimeCapabilitiesProbeCache);
}

export async function resolveDesktopHostRuntimeRpcMethodCandidates(
  method: CodeRuntimeRpcMethod
): Promise<readonly string[]> {
  if (method !== CODE_RUNTIME_RPC_METHODS.RPC_CAPABILITIES) {
    const snapshot = await resolveDesktopHostRpcCapabilitiesSnapshot();
    assertRuntimeRpcMethodSupportedByCapabilities(method, snapshot);
  }
  return [method];
}

export async function resolveWebRuntimeRpcMethodCandidates(
  method: CodeRuntimeRpcMethod
): Promise<readonly string[]> {
  if (method !== CODE_RUNTIME_RPC_METHODS.RPC_CAPABILITIES) {
    const snapshot = await resolveWebRuntimeCapabilitiesSnapshot();
    assertRuntimeRpcMethodSupportedByCapabilities(method, snapshot);
  }
  return [method];
}

export async function resolveWebRuntimeWsRpcEndpoint(
  endpoint: string,
  method: string
): Promise<string | null> {
  const authToken = resolveWebRuntimeAuthToken(endpoint);
  const explicitWsEndpoint = resolveWebRuntimeWsEndpointFromEnv();
  if (explicitWsEndpoint) {
    return toWebSocketEndpoint(appendRuntimeAuthTokenQuery(explicitWsEndpoint, authToken));
  }

  const canonicalMethod = resolveCanonicalCodeRuntimeRpcMethod(method);
  if (canonicalMethod === CODE_RUNTIME_RPC_METHODS.RPC_CAPABILITIES) {
    return null;
  }

  const cacheKey = buildWebRuntimeCapabilitiesProbeCacheKey(endpoint);
  if (webRuntimeCapabilitiesProbeCacheKey !== cacheKey) {
    return null;
  }

  const snapshot = readCachedRuntimeCapabilitiesSnapshot(webRuntimeCapabilitiesProbeCache);
  const wsEndpointPath = snapshot?.wsEndpointPath;
  if (!wsEndpointPath) {
    return null;
  }

  const resolved = resolveTransportEndpointFromPath(endpoint, wsEndpointPath);
  if (!resolved) {
    return null;
  }

  return toWebSocketEndpoint(appendRuntimeAuthTokenQuery(resolved, authToken));
}

export async function resolveCapabilitiesSnapshotByMode(
  mode: RuntimeClientMode
): Promise<RuntimeRpcCapabilitiesSnapshot | null> {
  if (mode === "desktop-host") {
    return resolveDesktopHostRpcCapabilitiesSnapshot();
  }
  if (mode === "runtime-gateway-web") {
    return resolveWebRuntimeCapabilitiesSnapshot();
  }
  return null;
}
