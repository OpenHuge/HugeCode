import {
  appendRuntimeAuthTokenQuery,
  resolveTransportEndpointFromPath,
  resolveWebRuntimeAuthToken,
  resolveWebRuntimeEndpoint,
  resolveWebRuntimeEventsEndpointFromEnv,
  resolveWebRuntimeWsEndpointFromEnv,
  stripEndpointQueryAndHash,
  toWebSocketEndpoint,
  WEB_RUNTIME_AUTH_TOKEN_HEADER,
} from "./runtimeWebTransportCore";

export const CODE_RUNTIME_RPC_CAPABILITIES_METHOD = "code_rpc_capabilities";

const TRANSPORT_PROBE_TIMEOUT_MS = 1_500;
const DEFAULT_WEB_RUNTIME_TRANSPORT_HINTS_CACHE_TTL_MS = 5 * 60 * 1000;

export type WebTransportEndpointHints = {
  eventsEndpoint: string | null;
  wsEndpoint: string | null;
};

export type ResolveWebTransportEndpointHintsOptions = {
  cacheTtlMs?: number;
  nowMs?: number;
  probeTimeoutMs?: number;
};

type UnknownRecord = Record<string, unknown>;

type CachedWebTransportEndpointHints = {
  key: string;
  expiresAtMs: number;
  value: WebTransportEndpointHints;
};

let cachedWebTransportEndpointHints: CachedWebTransportEndpointHints | null = null;

function isRecord(value: unknown): value is UnknownRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function readNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readRecordField(record: UnknownRecord, field: string): UnknownRecord | null {
  const value = record[field];
  return isRecord(value) ? value : null;
}

function readFieldString(record: UnknownRecord, fields: string[]): string | null {
  for (const field of fields) {
    const value = readNonEmptyString(record[field]);
    if (value) {
      return value;
    }
  }
  return null;
}

function buildWebTransportEndpointHintsCacheKey(input: {
  explicitEventsEndpoint: string | null;
  explicitWsEndpoint: string | null;
  rpcEndpoint: string | null;
  authToken: string | null;
}): string {
  return [
    input.explicitEventsEndpoint ?? "",
    input.explicitWsEndpoint ?? "",
    input.rpcEndpoint ?? "",
    input.authToken ?? "",
  ].join("|");
}

function cloneWebTransportEndpointHints(
  hints: WebTransportEndpointHints
): WebTransportEndpointHints {
  return {
    eventsEndpoint: hints.eventsEndpoint,
    wsEndpoint: hints.wsEndpoint,
  };
}

async function probeWebRuntimeTransportEndpointHints(
  rpcEndpoint: string,
  timeoutMs: number
): Promise<WebTransportEndpointHints> {
  if (typeof fetch !== "function") {
    return { eventsEndpoint: null, wsEndpoint: null };
  }
  const authToken = resolveWebRuntimeAuthToken(rpcEndpoint);
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (authToken) {
    headers[WEB_RUNTIME_AUTH_TOKEN_HEADER] = authToken;
  }

  const controller = typeof AbortController === "function" ? new AbortController() : null;
  const timeout =
    controller === null
      ? null
      : setTimeout(() => {
          controller.abort();
        }, timeoutMs);

  try {
    const response = await fetch(rpcEndpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        method: CODE_RUNTIME_RPC_CAPABILITIES_METHOD,
        params: {},
      }),
      signal: controller?.signal,
    });
    if (!response.ok) {
      return { eventsEndpoint: null, wsEndpoint: null };
    }

    const payload = (await response.json()) as unknown;
    if (!isRecord(payload) || payload.ok !== true) {
      return { eventsEndpoint: null, wsEndpoint: null };
    }
    const result = readRecordField(payload, "result");
    const transports = result ? readRecordField(result, "transports") : null;
    if (!transports) {
      return { eventsEndpoint: null, wsEndpoint: null };
    }

    const eventsTransport = readRecordField(transports, "events");
    const wsTransport = readRecordField(transports, "ws");
    return {
      eventsEndpoint:
        readFieldString(eventsTransport ?? {}, ["endpointPath", "endpoint_path"]) ?? null,
      wsEndpoint: readFieldString(wsTransport ?? {}, ["endpointPath", "endpoint_path"]) ?? null,
    };
  } catch {
    return { eventsEndpoint: null, wsEndpoint: null };
  } finally {
    if (timeout !== null) {
      clearTimeout(timeout);
    }
  }
}

export function deriveWebEventsEndpoint(endpoint: string): string {
  const trimmed = endpoint.trim();
  const derivePath = (path: string) => {
    const normalized = path.replace(/\/+$/, "");
    if (normalized.endsWith("_rpc")) {
      return `${normalized.slice(0, -4)}_events`;
    }
    if (normalized.endsWith("/rpc")) {
      const base = normalized.slice(0, -4);
      return `${base || ""}/events`;
    }
    return `${normalized}/events`;
  };

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      url.pathname = derivePath(url.pathname);
      url.search = "";
      url.hash = "";
      return url.toString();
    } catch {
      // Fall through to string derivation.
    }
  }

  return derivePath(stripEndpointQueryAndHash(trimmed));
}

export function deriveWebWsEndpoint(endpoint: string): string {
  const trimmed = endpoint.trim();
  const derivePath = (path: string) => {
    const normalized = path.replace(/\/+$/, "");
    if (normalized.endsWith("_rpc")) {
      return `${normalized.slice(0, -4)}_ws`;
    }
    if (normalized.endsWith("/rpc")) {
      const base = normalized.slice(0, -4);
      return `${base || ""}/ws`;
    }
    return `${normalized}/ws`;
  };

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      url.pathname = derivePath(url.pathname);
      url.search = "";
      url.hash = "";
      url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
      return url.toString();
    } catch {
      // Fall through to string derivation.
    }
  }

  return derivePath(stripEndpointQueryAndHash(trimmed));
}

export async function resolveWebTransportEndpointHints(
  options: ResolveWebTransportEndpointHintsOptions = {}
): Promise<WebTransportEndpointHints> {
  const explicitEventsEndpoint = resolveWebRuntimeEventsEndpointFromEnv();
  const explicitWsEndpoint = resolveWebRuntimeWsEndpointFromEnv();
  const rpcEndpoint = resolveWebRuntimeEndpoint();
  const authToken = resolveWebRuntimeAuthToken(rpcEndpoint);
  const cacheTtlMs =
    options.cacheTtlMs === undefined
      ? DEFAULT_WEB_RUNTIME_TRANSPORT_HINTS_CACHE_TTL_MS
      : options.cacheTtlMs;
  const cacheEnabled = Number.isFinite(cacheTtlMs) && cacheTtlMs > 0;
  const nowMs = options.nowMs ?? Date.now();
  const probeTimeoutMs = options.probeTimeoutMs ?? TRANSPORT_PROBE_TIMEOUT_MS;
  const cacheKey = buildWebTransportEndpointHintsCacheKey({
    explicitEventsEndpoint,
    explicitWsEndpoint,
    rpcEndpoint,
    authToken,
  });

  if (
    cacheEnabled &&
    cachedWebTransportEndpointHints &&
    cachedWebTransportEndpointHints.key === cacheKey &&
    nowMs < cachedWebTransportEndpointHints.expiresAtMs
  ) {
    return cloneWebTransportEndpointHints(cachedWebTransportEndpointHints.value);
  }

  const fallbackEventsEndpoint =
    explicitEventsEndpoint ?? (rpcEndpoint ? deriveWebEventsEndpoint(rpcEndpoint) : null);
  const fallbackWsEndpoint =
    explicitWsEndpoint ?? (rpcEndpoint ? deriveWebWsEndpoint(rpcEndpoint) : null);

  let resolved: WebTransportEndpointHints;
  if (!rpcEndpoint) {
    resolved = {
      eventsEndpoint: fallbackEventsEndpoint
        ? appendRuntimeAuthTokenQuery(fallbackEventsEndpoint, authToken)
        : null,
      wsEndpoint: explicitWsEndpoint
        ? toWebSocketEndpoint(appendRuntimeAuthTokenQuery(explicitWsEndpoint, authToken))
        : null,
    };
  } else if (explicitEventsEndpoint && explicitWsEndpoint) {
    resolved = {
      eventsEndpoint: appendRuntimeAuthTokenQuery(explicitEventsEndpoint, authToken),
      wsEndpoint: toWebSocketEndpoint(appendRuntimeAuthTokenQuery(explicitWsEndpoint, authToken)),
    };
  } else {
    const probed = await probeWebRuntimeTransportEndpointHints(rpcEndpoint, probeTimeoutMs);
    const eventsEndpoint =
      explicitEventsEndpoint ??
      (probed.eventsEndpoint
        ? resolveTransportEndpointFromPath(rpcEndpoint, probed.eventsEndpoint)
        : null) ??
      fallbackEventsEndpoint;
    const wsEndpoint =
      explicitWsEndpoint ??
      (probed.wsEndpoint
        ? resolveTransportEndpointFromPath(rpcEndpoint, probed.wsEndpoint)
        : null) ??
      fallbackWsEndpoint;

    resolved = {
      eventsEndpoint: eventsEndpoint
        ? appendRuntimeAuthTokenQuery(eventsEndpoint, authToken)
        : null,
      wsEndpoint: wsEndpoint
        ? toWebSocketEndpoint(appendRuntimeAuthTokenQuery(wsEndpoint, authToken))
        : null,
    };
  }

  if (cacheEnabled) {
    cachedWebTransportEndpointHints = {
      key: cacheKey,
      expiresAtMs: nowMs + cacheTtlMs,
      value: cloneWebTransportEndpointHints(resolved),
    };
  }

  return resolved;
}

export function withLastEventIdQuery(
  endpoint: string,
  lastEventId: string | number | null
): string {
  if (lastEventId === null) {
    return endpoint;
  }
  if (/^wss?:\/\//i.test(endpoint) || /^https?:\/\//i.test(endpoint)) {
    try {
      const parsed = new URL(endpoint);
      parsed.searchParams.set("lastEventId", String(lastEventId));
      return parsed.toString();
    } catch {
      // Fall through to string composition.
    }
  }

  const hashIndex = endpoint.indexOf("#");
  const hash = hashIndex >= 0 ? endpoint.slice(hashIndex) : "";
  const withoutHash = hashIndex >= 0 ? endpoint.slice(0, hashIndex) : endpoint;
  const queryIndex = withoutHash.indexOf("?");
  const pathname = queryIndex >= 0 ? withoutHash.slice(0, queryIndex) : withoutHash;
  const query = queryIndex >= 0 ? withoutHash.slice(queryIndex + 1) : "";
  const params = new URLSearchParams(query);
  params.set("lastEventId", String(lastEventId));
  const queryString = params.toString();
  return `${pathname}${queryString ? `?${queryString}` : ""}${hash}`;
}
