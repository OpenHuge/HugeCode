import {
  CODE_RUNTIME_RPC_EMPTY_PARAMS,
  CODE_RUNTIME_RPC_METHODS,
  type CodeRuntimeRpcMethod,
} from "@ku0/code-runtime-host-contract";
import { isCodeRuntimeRpcMethodNotFoundErrorCode } from "@ku0/code-runtime-host-contract/codeRuntimeRpcCompat";
import { invoke } from "@tauri-apps/api/core";
import {
  assertRuntimeRpcCanonicalMethodsSupported,
  assertRuntimeRpcContractFeaturesSupported,
  assertRuntimeRpcContractMetadataSupported,
  assertRuntimeRpcContractVersionSupported,
  assertRuntimeRpcFreezeEffectiveAtSupported,
  assertRuntimeRpcMethodSetHashSupported,
  assertRuntimeRpcProfileSupported,
  isRuntimeRpcContractGuardError,
  normalizeRpcCapabilitiesPayload,
  type RuntimeRpcCapabilitiesSnapshot,
  type RuntimeRpcContractGuardError,
} from "./runtimeClientCapabilitiesContract";
import { toRuntimeRpcInvocationError } from "./runtimeClientErrorUtils";
import { resolveCanonicalCodeRuntimeRpcMethod } from "./runtimeClientMethodSets";
import {
  RuntimeRpcMethodUnsupportedError,
  type RuntimeRpcParams,
  type RuntimeRpcRawInvoker,
} from "./runtimeClientTransportShared";
import type { RuntimeClientMode } from "./runtimeClientTypes";
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

type RuntimeRpcCapabilitiesProbeResult = {
  snapshot: RuntimeRpcCapabilitiesSnapshot | null;
  cacheable: boolean;
};

type RuntimeRpcCapabilitiesProbeCache = {
  snapshot: RuntimeRpcCapabilitiesSnapshot | null | undefined;
  snapshotCachedAtMs: number | null;
  inFlight: Promise<RuntimeRpcCapabilitiesSnapshot | null> | null;
  contractGuardError: RuntimeRpcContractGuardError | null;
  contractGuardErrorCachedAtMs: number | null;
};

const TAURI_RPC_CAPABILITIES_METHOD_CANDIDATES = [CODE_RUNTIME_RPC_METHODS.RPC_CAPABILITIES];
const RUNTIME_RPC_CAPABILITIES_CACHE_TTL_MS = 60_000;
const RUNTIME_RPC_CAPABILITIES_NULL_CACHE_TTL_MS = 5_000;
const RUNTIME_RPC_CAPABILITIES_CONTRACT_ERROR_TTL_MS = 5_000;

const tauriRuntimeCapabilitiesProbeCache: RuntimeRpcCapabilitiesProbeCache = {
  snapshot: undefined,
  snapshotCachedAtMs: null,
  inFlight: null,
  contractGuardError: null,
  contractGuardErrorCachedAtMs: null,
};

const webRuntimeCapabilitiesProbeCache: RuntimeRpcCapabilitiesProbeCache = {
  snapshot: undefined,
  snapshotCachedAtMs: null,
  inFlight: null,
  contractGuardError: null,
  contractGuardErrorCachedAtMs: null,
};

let webRuntimeCapabilitiesProbeCacheKey: string | null = null;
let runtimeCapabilitiesCacheInvalidationSubscribed = false;
const LOOPBACK_RUNTIME_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);

function buildWebRuntimeCapabilitiesProbeCacheKey(endpoint: string | null): string | null {
  if (!endpoint) {
    return endpoint;
  }
  return `${endpoint}::${resolveWebRuntimeAuthToken(endpoint) ?? ""}`;
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

function isRpcCapabilitiesMethodNotFound(cause: unknown): boolean {
  const runtimeError = toRuntimeRpcInvocationError(cause);
  return runtimeError !== null && isCodeRuntimeRpcMethodNotFoundErrorCode(runtimeError.code);
}

function resetRuntimeRpcCapabilitiesProbeCache(cache: RuntimeRpcCapabilitiesProbeCache): void {
  cache.snapshot = undefined;
  cache.snapshotCachedAtMs = null;
  cache.inFlight = null;
  cache.contractGuardError = null;
  cache.contractGuardErrorCachedAtMs = null;
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
  resetRuntimeRpcCapabilitiesProbeCache(tauriRuntimeCapabilitiesProbeCache);
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

function isRuntimeCacheEntryValid(cachedAtMs: number, ttlMs: number): boolean {
  return Date.now() - cachedAtMs < ttlMs;
}

function getRuntimeSnapshotCacheTtlMs(snapshot: RuntimeRpcCapabilitiesSnapshot | null): number {
  return snapshot === null
    ? RUNTIME_RPC_CAPABILITIES_NULL_CACHE_TTL_MS
    : RUNTIME_RPC_CAPABILITIES_CACHE_TTL_MS;
}

async function resolveRuntimeRpcCapabilitiesSnapshot(
  invokeRaw: RuntimeRpcRawInvoker
): Promise<RuntimeRpcCapabilitiesProbeResult> {
  for (const method of TAURI_RPC_CAPABILITIES_METHOD_CANDIDATES) {
    try {
      const result = await invokeRaw(method, CODE_RUNTIME_RPC_EMPTY_PARAMS);
      return { snapshot: normalizeRpcCapabilitiesPayload(result), cacheable: true };
    } catch (cause) {
      if (isRpcCapabilitiesMethodNotFound(cause)) {
        continue;
      }
      return { snapshot: null, cacheable: false };
    }
  }

  return { snapshot: null, cacheable: true };
}

async function resolveRuntimeRpcCapabilitiesWithCache(
  cache: RuntimeRpcCapabilitiesProbeCache,
  resolveProbeResult: () => Promise<RuntimeRpcCapabilitiesProbeResult>
): Promise<RuntimeRpcCapabilitiesSnapshot | null> {
  if (cache.contractGuardError) {
    const cachedAtMs = cache.contractGuardErrorCachedAtMs;
    if (
      cachedAtMs !== null &&
      isRuntimeCacheEntryValid(cachedAtMs, RUNTIME_RPC_CAPABILITIES_CONTRACT_ERROR_TTL_MS)
    ) {
      throw cache.contractGuardError;
    }
    cache.contractGuardError = null;
    cache.contractGuardErrorCachedAtMs = null;
  }

  if (cache.snapshot !== undefined) {
    const cachedAtMs = cache.snapshotCachedAtMs;
    if (
      cachedAtMs !== null &&
      isRuntimeCacheEntryValid(cachedAtMs, getRuntimeSnapshotCacheTtlMs(cache.snapshot))
    ) {
      return cache.snapshot;
    }
    cache.snapshot = undefined;
    cache.snapshotCachedAtMs = null;
  }

  if (cache.inFlight) {
    return cache.inFlight;
  }

  cache.inFlight = (async () => {
    const probeResult = await resolveProbeResult();
    if (!probeResult.cacheable) {
      return null;
    }

    const snapshot = probeResult.snapshot;
    if (snapshot?.contractVersion) {
      assertRuntimeRpcContractVersionSupported(snapshot.contractVersion);
    }
    if (snapshot) {
      assertRuntimeRpcMethodSetHashSupported(snapshot);
      assertRuntimeRpcProfileSupported(snapshot);
      assertRuntimeRpcCanonicalMethodsSupported(snapshot);
      assertRuntimeRpcContractFeaturesSupported(snapshot);
      assertRuntimeRpcFreezeEffectiveAtSupported(snapshot);
      assertRuntimeRpcContractMetadataSupported(snapshot);
    }

    cache.snapshot = snapshot;
    cache.snapshotCachedAtMs = Date.now();
    return snapshot;
  })();

  try {
    return await cache.inFlight;
  } catch (cause) {
    if (isRuntimeRpcContractGuardError(cause)) {
      cache.contractGuardError = cause;
      cache.contractGuardErrorCachedAtMs = Date.now();
    }
    throw cause;
  } finally {
    cache.inFlight = null;
  }
}

export async function resolveTauriRpcCapabilitiesSnapshot(): Promise<RuntimeRpcCapabilitiesSnapshot | null> {
  ensureRuntimeCapabilitiesProbeCacheInvalidationSubscription();
  return resolveRuntimeRpcCapabilitiesWithCache(tauriRuntimeCapabilitiesProbeCache, () =>
    resolveRuntimeRpcCapabilitiesSnapshot(
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
      resolveRuntimeRpcCapabilitiesSnapshot((candidate, capabilityParams) =>
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

  const snapshot = webRuntimeCapabilitiesProbeCache.snapshot;
  return snapshot === undefined ? null : snapshot;
}

function assertRuntimeRpcMethodSupportedByCapabilities(
  method: CodeRuntimeRpcMethod,
  snapshot: RuntimeRpcCapabilitiesSnapshot | null
): void {
  if (method === CODE_RUNTIME_RPC_METHODS.RPC_CAPABILITIES || !snapshot) {
    return;
  }
  if (snapshot.contractVersion === null) {
    return;
  }
  if (snapshot.methods.has(method)) {
    return;
  }

  throw new RuntimeRpcMethodUnsupportedError(
    method,
    [method],
    `Runtime capabilities do not advertise method '${method}'.`
  );
}

export async function resolveTauriRuntimeRpcMethodCandidates(
  method: CodeRuntimeRpcMethod
): Promise<readonly string[]> {
  if (method !== CODE_RUNTIME_RPC_METHODS.RPC_CAPABILITIES) {
    const snapshot = await resolveTauriRpcCapabilitiesSnapshot();
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

  const snapshot = webRuntimeCapabilitiesProbeCache.snapshot;
  if (snapshot === undefined) {
    return null;
  }
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
  if (mode === "tauri") {
    return resolveTauriRpcCapabilitiesSnapshot();
  }
  if (mode === "runtime-gateway-web") {
    return resolveWebRuntimeCapabilitiesSnapshot();
  }
  return null;
}
