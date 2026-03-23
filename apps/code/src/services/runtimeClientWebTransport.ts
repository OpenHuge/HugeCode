import {
  CODE_RUNTIME_RPC_ERROR_CODES,
  type CodeRuntimeRpcMethod,
} from "@ku0/code-runtime-host-contract";
import {
  RuntimeRpcInvocationError,
  toRuntimeRpcInvocationError,
} from "@ku0/code-runtime-client/runtimeClientErrorUtils";
import {
  resolveCanonicalCodeRuntimeRpcMethod,
  WEB_RUNTIME_READ_ONLY_METHODS,
  WEB_RUNTIME_SHORT_CACHE_METHODS,
} from "@ku0/code-runtime-client/runtimeClientMethodSets";
import {
  rejectUnavailable,
  type RuntimeRpcParams,
} from "@ku0/code-runtime-client/runtimeClientTransportShared";
import {
  readCachedWebRuntimeCapabilitiesSnapshot,
  resolveWebRuntimeWsRpcEndpoint,
} from "./runtimeClientCapabilitiesProbe";
import { invokeWebRuntimeRawAttempt } from "./runtimeClientWebHttpTransport";
import { resolveWebRuntimeRequestTimeoutMs } from "@ku0/code-runtime-client/runtimeClientWebRequestTimeouts";
import { resolveWebRuntimeAuthToken, resolveWebRuntimeEndpoint } from "./runtimeClientWebGateway";
import {
  computeWebRuntimeRetryDelayMs,
  shouldRetryWebRuntimeInvocation,
  sleep,
} from "@ku0/code-runtime-client/runtimeClientWebRetryUtils";

const WEB_RUNTIME_WS_UNAVAILABLE_COOLDOWN_MS = 1_000;
const WEB_RUNTIME_WS_MAX_PENDING_REQUESTS = 512;
const WEB_RUNTIME_READ_CACHE_TTL_MS = 1_000;
const WEB_RUNTIME_READ_CACHE_MAX_ENTRIES = 128;

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function createWebRuntimeRequestTimeoutError(
  method: string,
  requestTimeoutMs: number | null
): RuntimeRpcInvocationError {
  return new RuntimeRpcInvocationError({
    code: CODE_RUNTIME_RPC_ERROR_CODES.INTERNAL_ERROR,
    message: `Web runtime gateway ${method} timed out after ${requestTimeoutMs ?? 0}ms.`,
    details: { timeoutMs: requestTimeoutMs ?? 0 },
  });
}

function resolveRequestDeadlineMs(requestTimeoutMs: number | null): number | null {
  if (requestTimeoutMs === null) {
    return null;
  }
  return Date.now() + Math.max(0, requestTimeoutMs);
}

function resolveRemainingRequestTimeoutMs(
  method: string,
  requestTimeoutMs: number | null,
  requestDeadlineMs: number | null
): number | null {
  if (requestDeadlineMs === null) {
    return requestTimeoutMs;
  }

  const remainingMs = Math.max(0, requestDeadlineMs - Date.now());
  if (remainingMs <= 0) {
    throw createWebRuntimeRequestTimeoutError(method, requestTimeoutMs);
  }
  return remainingMs;
}

type WebRuntimeReadCacheEntry = {
  cachedAtMs: number;
  value: unknown;
};

const webRuntimeReadCache = new Map<string, WebRuntimeReadCacheEntry>();
const webRuntimeReadInFlight = new Map<string, Promise<unknown>>();
let webRuntimeReadCacheLastPrunedAtMs = 0;

function isWebRuntimeReadOnlyMethod(
  method: CodeRuntimeRpcMethod | null
): method is CodeRuntimeRpcMethod {
  return method !== null && WEB_RUNTIME_READ_ONLY_METHODS.has(method);
}

function shouldUseWebRuntimeShortCache(method: CodeRuntimeRpcMethod): boolean {
  return WEB_RUNTIME_SHORT_CACHE_METHODS.has(method);
}

function serializeWebRuntimeReadParams(params: RuntimeRpcParams): string | null {
  try {
    return JSON.stringify(params);
  } catch {
    return null;
  }
}

function buildWebRuntimeReadCacheKey(
  endpoint: string,
  authToken: string | null,
  method: CodeRuntimeRpcMethod,
  serializedParams: string
): string {
  return `${endpoint}:${authToken ?? ""}:${method}:${serializedParams}`;
}

function pruneWebRuntimeReadCache(nowMs: number, force = false): void {
  const shouldPruneByAge =
    nowMs - webRuntimeReadCacheLastPrunedAtMs >= WEB_RUNTIME_READ_CACHE_TTL_MS;
  const shouldPruneBySize = webRuntimeReadCache.size > WEB_RUNTIME_READ_CACHE_MAX_ENTRIES;
  if (!force && !shouldPruneByAge && !shouldPruneBySize) {
    return;
  }

  webRuntimeReadCacheLastPrunedAtMs = nowMs;
  for (const [key, entry] of webRuntimeReadCache.entries()) {
    if (nowMs - entry.cachedAtMs >= WEB_RUNTIME_READ_CACHE_TTL_MS) {
      webRuntimeReadCache.delete(key);
    }
  }

  while (webRuntimeReadCache.size > WEB_RUNTIME_READ_CACHE_MAX_ENTRIES) {
    const oldestKey = webRuntimeReadCache.keys().next().value;
    if (!oldestKey) {
      break;
    }
    webRuntimeReadCache.delete(oldestKey);
  }
}

let webRuntimeWsRequestSequence = 0;

type WebRuntimeWsPendingRequest = {
  method: string;
  timeout: ReturnType<typeof setTimeout> | null;
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
};

class RuntimeWebSocketTransportUnavailableError extends Error {
  readonly transportCause?: unknown;

  constructor(message: string, transportCause?: unknown) {
    super(message);
    this.name = "RuntimeWebSocketTransportUnavailableError";
    this.transportCause = transportCause;
  }
}

function nextWebRuntimeWsRequestId(): string {
  webRuntimeWsRequestSequence += 1;
  return `ws-rpc-${Date.now()}-${webRuntimeWsRequestSequence}`;
}

class WebRuntimeWsRpcChannel {
  private readonly endpoint: string;
  private readonly onUnavailable?: (endpoint: string) => void;
  private socket: WebSocket | null = null;
  private openPromise: Promise<WebSocket> | null = null;
  private readonly pending = new Map<string, WebRuntimeWsPendingRequest>();

  constructor(endpoint: string, onUnavailable?: (endpoint: string) => void) {
    this.endpoint = endpoint;
    this.onUnavailable = onUnavailable;
  }

  private buildUnavailableError(
    message: string,
    cause?: unknown
  ): RuntimeWebSocketTransportUnavailableError {
    return new RuntimeWebSocketTransportUnavailableError(message, cause);
  }

  private clearPendingRequest(id: string): WebRuntimeWsPendingRequest | null {
    const pending = this.pending.get(id);
    if (!pending) {
      return null;
    }
    if (pending.timeout !== null) {
      clearTimeout(pending.timeout);
    }
    this.pending.delete(id);
    return pending;
  }

  private failAllPendingRequests(error: unknown): void {
    for (const [id] of this.pending.entries()) {
      const pending = this.clearPendingRequest(id);
      pending?.reject(error);
    }
  }

  private teardownSocket(): void {
    if (!this.socket) {
      return;
    }
    this.socket.onopen = null;
    this.socket.onmessage = null;
    this.socket.onerror = null;
    this.socket.onclose = null;
    try {
      this.socket.close();
    } catch {
      void 0;
    }
    this.socket = null;
    this.openPromise = null;
  }

  private handleSocketRuntimeFailure(message: string, cause?: unknown): void {
    const error = this.buildUnavailableError(message, cause);
    this.onUnavailable?.(this.endpoint);
    this.failAllPendingRequests(error);
    this.teardownSocket();
  }

  private handleSocketMessage = (event: MessageEvent) => {
    if (typeof event.data !== "string") {
      return;
    }

    let payload: unknown;
    try {
      payload = JSON.parse(event.data);
    } catch {
      return;
    }

    const record = asRecord(payload);
    if (!record || record.type !== "rpc.response") {
      return;
    }

    const id = typeof record.id === "string" ? record.id : null;
    if (!id) {
      return;
    }
    const pending = this.clearPendingRequest(id);
    if (!pending) {
      return;
    }

    if (record.ok === true) {
      pending.resolve(record.result);
      return;
    }

    pending.reject(
      toRuntimeRpcInvocationError(record.error) ??
        new RuntimeRpcInvocationError({
          code: CODE_RUNTIME_RPC_ERROR_CODES.INTERNAL_ERROR,
          message: `Web runtime gateway websocket ${pending.method} rejected request.`,
        })
    );
  };

  private ensureSocket(): Promise<WebSocket> {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      return Promise.resolve(this.socket);
    }
    if (this.openPromise) {
      return this.openPromise;
    }
    if (typeof WebSocket !== "function") {
      return Promise.reject(
        this.buildUnavailableError("WebSocket transport is unavailable in this runtime.")
      );
    }

    this.openPromise = new Promise<WebSocket>((resolve, reject) => {
      let openingSocket: WebSocket;
      try {
        openingSocket = new WebSocket(this.endpoint);
      } catch (cause) {
        this.openPromise = null;
        reject(
          this.buildUnavailableError(
            `Failed to open web runtime gateway websocket transport at '${this.endpoint}'.`,
            cause
          )
        );
        return;
      }

      let settled = false;
      const settle = (result: { ok: true } | { ok: false; error: unknown }) => {
        if (settled) {
          return;
        }
        settled = true;
        if (result.ok) {
          this.socket = openingSocket;
          this.openPromise = null;
          openingSocket.onmessage = this.handleSocketMessage;
          openingSocket.onerror = () => {
            this.handleSocketRuntimeFailure(
              "Web runtime gateway websocket transport encountered an error."
            );
          };
          openingSocket.onclose = () => {
            this.handleSocketRuntimeFailure(
              "Web runtime gateway websocket transport closed unexpectedly."
            );
          };
          resolve(openingSocket);
          return;
        }

        openingSocket.onopen = null;
        openingSocket.onmessage = null;
        openingSocket.onerror = null;
        openingSocket.onclose = null;
        try {
          openingSocket.close();
        } catch {
          void 0;
        }
        this.openPromise = null;
        reject(result.error);
      };

      openingSocket.onopen = () => {
        settle({ ok: true });
      };

      openingSocket.onerror = (cause) => {
        settle({
          ok: false,
          error: this.buildUnavailableError(
            "Web runtime gateway websocket transport failed before ready state.",
            cause
          ),
        });
      };

      openingSocket.onclose = () => {
        settle({
          ok: false,
          error: this.buildUnavailableError(
            "Web runtime gateway websocket transport closed before ready state."
          ),
        });
      };
    });

    return this.openPromise;
  }

  async request<Result>(
    method: string,
    params: RuntimeRpcParams,
    requestTimeoutMsOverride?: number | null
  ): Promise<Result> {
    const socket = await this.ensureSocket();
    if (this.pending.size >= WEB_RUNTIME_WS_MAX_PENDING_REQUESTS) {
      throw this.buildUnavailableError(
        `Web runtime gateway websocket pending requests exceeded ${WEB_RUNTIME_WS_MAX_PENDING_REQUESTS}.`
      );
    }

    const requestId = nextWebRuntimeWsRequestId();
    const requestTimeoutMs =
      requestTimeoutMsOverride ?? resolveWebRuntimeRequestTimeoutMs(method, params);
    return new Promise<Result>((resolve, reject) => {
      const timeout =
        requestTimeoutMs === null
          ? null
          : setTimeout(() => {
              const pending = this.clearPendingRequest(requestId);
              if (!pending) {
                return;
              }
              pending.reject(
                this.buildUnavailableError(
                  `Web runtime gateway websocket request '${method}' timed out after ${requestTimeoutMs}ms.`
                )
              );
            }, requestTimeoutMs);

      this.pending.set(requestId, {
        method,
        timeout,
        resolve: (value) => resolve(value as Result),
        reject,
      });

      try {
        socket.send(
          JSON.stringify({
            type: "rpc.request",
            id: requestId,
            method,
            params,
          })
        );
      } catch (cause) {
        const pending = this.clearPendingRequest(requestId);
        pending?.reject(
          this.buildUnavailableError(
            `Web runtime gateway websocket request '${method}' failed to send.`,
            cause
          )
        );
        this.handleSocketRuntimeFailure(
          `Web runtime gateway websocket transport failed while sending '${method}'.`,
          cause
        );
      }
    });
  }

  dispose(): void {
    this.failAllPendingRequests(
      this.buildUnavailableError("Web runtime gateway websocket transport was disposed.")
    );
    this.teardownSocket();
  }
}

let webRuntimeWsRpcChannel: WebRuntimeWsRpcChannel | null = null;
let webRuntimeWsRpcChannelEndpoint: string | null = null;
let webRuntimeWsUnavailableEndpoint: string | null = null;
let webRuntimeWsUnavailableUntilMs = 0;

function getWebRuntimeWsRpcChannel(endpoint: string): WebRuntimeWsRpcChannel {
  if (webRuntimeWsRpcChannel && webRuntimeWsRpcChannelEndpoint === endpoint) {
    return webRuntimeWsRpcChannel;
  }
  if (webRuntimeWsRpcChannel) {
    webRuntimeWsRpcChannel.dispose();
  }
  webRuntimeWsRpcChannel = new WebRuntimeWsRpcChannel(endpoint, markWebRuntimeWsUnavailable);
  webRuntimeWsRpcChannelEndpoint = endpoint;
  return webRuntimeWsRpcChannel;
}

function isWebRuntimeWsUnavailable(endpoint: string): boolean {
  if (webRuntimeWsUnavailableEndpoint !== endpoint) {
    return false;
  }
  return Date.now() < webRuntimeWsUnavailableUntilMs;
}

function markWebRuntimeWsUnavailable(endpoint: string): void {
  webRuntimeWsUnavailableEndpoint = endpoint;
  webRuntimeWsUnavailableUntilMs = Date.now() + WEB_RUNTIME_WS_UNAVAILABLE_COOLDOWN_MS;
}

function clearWebRuntimeWsUnavailable(endpoint: string): void {
  if (webRuntimeWsUnavailableEndpoint !== endpoint) {
    return;
  }
  webRuntimeWsUnavailableEndpoint = null;
  webRuntimeWsUnavailableUntilMs = 0;
}

async function invokeWebRuntimeRawWsAttempt<Result>(
  wsEndpoint: string,
  method: string,
  params: RuntimeRpcParams,
  requestTimeoutMsOverride?: number | null
): Promise<Result> {
  const channel = getWebRuntimeWsRpcChannel(wsEndpoint);
  return channel.request<Result>(method, params, requestTimeoutMsOverride);
}

export async function invokeWebRuntimeRaw<Result>(
  method: string,
  params: RuntimeRpcParams
): Promise<Result> {
  const endpoint = resolveWebRuntimeEndpoint();
  if (!endpoint) {
    return rejectUnavailable(`web runtime gateway method ${method}`);
  }
  if (typeof fetch !== "function") {
    return rejectUnavailable(`web runtime gateway method ${method}`);
  }

  const wsEndpoint = await resolveWebRuntimeWsRpcEndpoint(endpoint, method);
  const authToken = resolveWebRuntimeAuthToken(endpoint);
  const canonicalMethod = resolveCanonicalCodeRuntimeRpcMethod(method);
  const invocationPolicy =
    canonicalMethod === null
      ? null
      : (readCachedWebRuntimeCapabilitiesSnapshot()?.invocationPolicies?.get(canonicalMethod) ??
        null);
  const requestTimeoutMs = resolveWebRuntimeRequestTimeoutMs(method, params, invocationPolicy);
  const requestDeadlineMs = resolveRequestDeadlineMs(requestTimeoutMs);
  const serializedReadParams =
    canonicalMethod && isWebRuntimeReadOnlyMethod(canonicalMethod)
      ? serializeWebRuntimeReadParams(params)
      : null;
  const readCacheKey =
    isWebRuntimeReadOnlyMethod(canonicalMethod) &&
    shouldUseWebRuntimeShortCache(canonicalMethod) &&
    serializedReadParams
      ? buildWebRuntimeReadCacheKey(endpoint, authToken, canonicalMethod, serializedReadParams)
      : null;
  const inFlightDedupeKey =
    isWebRuntimeReadOnlyMethod(canonicalMethod) && serializedReadParams
      ? buildWebRuntimeReadCacheKey(endpoint, authToken, canonicalMethod, serializedReadParams)
      : null;

  if (readCacheKey) {
    const nowMs = Date.now();
    pruneWebRuntimeReadCache(nowMs);
    const cached = webRuntimeReadCache.get(readCacheKey);
    if (cached && nowMs - cached.cachedAtMs < WEB_RUNTIME_READ_CACHE_TTL_MS) {
      return cached.value as Result;
    }
  }

  if (inFlightDedupeKey) {
    const inFlight = webRuntimeReadInFlight.get(inFlightDedupeKey);
    if (inFlight) {
      return (await inFlight) as Result;
    }
  }

  const runRequest = async (): Promise<Result> => {
    if (wsEndpoint && !isWebRuntimeWsUnavailable(wsEndpoint)) {
      try {
        const wsRequestTimeoutMs = resolveRemainingRequestTimeoutMs(
          method,
          requestTimeoutMs,
          requestDeadlineMs
        );
        const wsResult = await invokeWebRuntimeRawWsAttempt<Result>(
          wsEndpoint,
          method,
          params,
          wsRequestTimeoutMs
        );
        clearWebRuntimeWsUnavailable(wsEndpoint);
        return wsResult;
      } catch (cause) {
        if (!(cause instanceof RuntimeWebSocketTransportUnavailableError)) {
          throw cause;
        }
        markWebRuntimeWsUnavailable(wsEndpoint);
      }
    }

    let attempt = 0;
    while (true) {
      try {
        const attemptTimeoutMs = resolveRemainingRequestTimeoutMs(
          method,
          requestTimeoutMs,
          requestDeadlineMs
        );
        return await invokeWebRuntimeRawAttempt<Result>(endpoint, method, params, attemptTimeoutMs);
      } catch (cause) {
        if (
          !shouldRetryWebRuntimeInvocation({
            method: canonicalMethod,
            attempt,
            cause,
          })
        ) {
          throw cause;
        }
        attempt += 1;
        const retryBudgetMs =
          requestDeadlineMs === null ? null : Math.max(0, requestDeadlineMs - Date.now());
        const retryDelayMs = computeWebRuntimeRetryDelayMs(attempt, cause, retryBudgetMs);
        if (retryDelayMs <= 0) {
          throw cause;
        }
        await sleep(retryDelayMs);
      }
    }
  };

  const inFlightRequest = runRequest();
  if (inFlightDedupeKey) {
    webRuntimeReadInFlight.set(inFlightDedupeKey, inFlightRequest as Promise<unknown>);
  }

  try {
    const result = await inFlightRequest;
    if (readCacheKey) {
      const nowMs = Date.now();
      pruneWebRuntimeReadCache(nowMs, true);
      webRuntimeReadCache.set(readCacheKey, { cachedAtMs: nowMs, value: result });
    }
    return result;
  } finally {
    if (inFlightDedupeKey) {
      webRuntimeReadInFlight.delete(inFlightDedupeKey);
    }
  }
}
