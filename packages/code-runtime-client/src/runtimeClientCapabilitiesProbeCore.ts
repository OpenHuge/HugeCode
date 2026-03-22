import {
  CODE_RUNTIME_RPC_EMPTY_PARAMS,
  CODE_RUNTIME_RPC_METHODS,
  type CodeRuntimeRpcMethod,
} from "@ku0/code-runtime-host-contract";
import { isCodeRuntimeRpcMethodNotFoundErrorCode } from "@ku0/code-runtime-host-contract/codeRuntimeRpcCompat";
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
import {
  RuntimeRpcMethodUnsupportedError,
  type RuntimeRpcRawInvoker,
} from "./runtimeClientTransportShared";

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

export function createRuntimeRpcCapabilitiesProbeCache(): RuntimeRpcCapabilitiesProbeCache {
  return {
    snapshot: undefined,
    snapshotCachedAtMs: null,
    inFlight: null,
    contractGuardError: null,
    contractGuardErrorCachedAtMs: null,
  };
}

export function buildWebRuntimeCapabilitiesProbeCacheKey(
  endpoint: string | null,
  authToken: string | null
): string | null {
  if (!endpoint) {
    return endpoint;
  }
  return `${endpoint}::${authToken ?? ""}`;
}

function isRpcCapabilitiesMethodNotFound(cause: unknown): boolean {
  const runtimeError = toRuntimeRpcInvocationError(cause);
  return runtimeError !== null && isCodeRuntimeRpcMethodNotFoundErrorCode(runtimeError.code);
}

export function resetRuntimeRpcCapabilitiesProbeCache(
  cache: RuntimeRpcCapabilitiesProbeCache
): void {
  cache.snapshot = undefined;
  cache.snapshotCachedAtMs = null;
  cache.inFlight = null;
  cache.contractGuardError = null;
  cache.contractGuardErrorCachedAtMs = null;
}

function isRuntimeCacheEntryValid(cachedAtMs: number, ttlMs: number): boolean {
  return Date.now() - cachedAtMs < ttlMs;
}

function getRuntimeSnapshotCacheTtlMs(snapshot: RuntimeRpcCapabilitiesSnapshot | null): number {
  return snapshot === null
    ? RUNTIME_RPC_CAPABILITIES_NULL_CACHE_TTL_MS
    : RUNTIME_RPC_CAPABILITIES_CACHE_TTL_MS;
}

export async function resolveRuntimeRpcCapabilitiesSnapshot(
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

export async function resolveRuntimeRpcCapabilitiesWithCache(
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

export function readCachedRuntimeCapabilitiesSnapshot(
  cache: RuntimeRpcCapabilitiesProbeCache
): RuntimeRpcCapabilitiesSnapshot | null {
  const snapshot = cache.snapshot;
  return snapshot === undefined ? null : snapshot;
}

export function assertRuntimeRpcMethodSupportedByCapabilities(
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
