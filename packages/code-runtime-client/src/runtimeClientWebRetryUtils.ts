import {
  CODE_RUNTIME_RPC_METHODS,
  type CodeRuntimeRpcMethod,
} from "@ku0/code-runtime-host-contract";
import { RuntimeRpcInvocationError } from "./runtimeClientErrorUtils";
import { isTimeoutLikeError, isWebRuntimeConnectionError } from "./runtimeErrorClassifier";
import { WEB_RUNTIME_READ_ONLY_METHODS } from "./runtimeClientMethodSets";

export const WEB_RUNTIME_MAX_RETRY_ATTEMPTS = 2;
export const WEB_RUNTIME_RETRY_BASE_DELAY_MS = 125;
export const WEB_RUNTIME_MAX_RETRY_DELAY_MS = 2_000;

const RUNTIME_BACKENDS_LIST_METHOD =
  CODE_RUNTIME_RPC_METHODS.RUNTIME_BACKENDS_LIST ??
  ("code_runtime_backends_list" as CodeRuntimeRpcMethod);
const DISTRIBUTED_TASK_GRAPH_METHOD =
  CODE_RUNTIME_RPC_METHODS.DISTRIBUTED_TASK_GRAPH ??
  ("code_distributed_task_graph" as CodeRuntimeRpcMethod);

const WEB_RUNTIME_RETRYABLE_HTTP_STATUS_CODES = new Set<number>([
  408, 425, 429, 500, 502, 503, 504,
]);

const WEB_RUNTIME_RETRYABLE_METHODS: ReadonlySet<CodeRuntimeRpcMethod> = new Set([
  ...WEB_RUNTIME_READ_ONLY_METHODS,
  RUNTIME_BACKENDS_LIST_METHOD,
  DISTRIBUTED_TASK_GRAPH_METHOD,
]);

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function isRetryableWebRuntimeHttpStatus(status: number): boolean {
  return WEB_RUNTIME_RETRYABLE_HTTP_STATUS_CODES.has(status);
}

export function parseWebRuntimeRetryAfterMs(value: unknown, nowMs = Date.now()): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return Math.floor(value);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    if (/^\d+(\.\d+)?$/.test(trimmed)) {
      const parsedSeconds = Number(trimmed);
      return Number.isFinite(parsedSeconds) && parsedSeconds >= 0
        ? Math.floor(parsedSeconds * 1_000)
        : null;
    }

    const parsedDateMs = Date.parse(trimmed);
    if (Number.isFinite(parsedDateMs)) {
      return Math.max(0, Math.floor(parsedDateMs - nowMs));
    }
  }

  return null;
}

function readRetryAfterMs(cause: unknown): number | null {
  const details =
    cause instanceof RuntimeRpcInvocationError
      ? asRecord(cause.details)
      : asRecord(asRecord(cause)?.details);
  if (!details) {
    return null;
  }

  for (const candidate of [
    details.retryAfterMs,
    details.retry_after_ms,
    typeof details.retryAfterSec === "number"
      ? details.retryAfterSec * 1_000
      : details.retryAfterSec,
    typeof details.retry_after_sec === "number"
      ? details.retry_after_sec * 1_000
      : details.retry_after_sec,
  ]) {
    const retryAfterMs = parseWebRuntimeRetryAfterMs(candidate);
    if (retryAfterMs !== null) {
      return retryAfterMs;
    }
  }

  return null;
}

function isRetryableTransportFailure(cause: unknown): boolean {
  return isWebRuntimeConnectionError(cause) || isTimeoutLikeError(cause);
}

export function shouldRetryWebRuntimeInvocation(params: {
  method: CodeRuntimeRpcMethod | null;
  attempt: number;
  cause: unknown;
}): boolean {
  const { method, attempt, cause } = params;
  if (method === null || !WEB_RUNTIME_RETRYABLE_METHODS.has(method)) {
    return false;
  }
  if (attempt >= WEB_RUNTIME_MAX_RETRY_ATTEMPTS) {
    return false;
  }

  if (cause instanceof RuntimeRpcInvocationError) {
    const details = asRecord(cause.details);
    const status = typeof details?.status === "number" ? details.status : null;
    if (typeof status === "number" && isRetryableWebRuntimeHttpStatus(status)) {
      const retryAfterMs = readRetryAfterMs(cause);
      if (retryAfterMs !== null && retryAfterMs > WEB_RUNTIME_MAX_RETRY_DELAY_MS) {
        return false;
      }
      return true;
    }
    return isRetryableTransportFailure(cause);
  }

  return isRetryableTransportFailure(cause);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function computeWebRuntimeRetryDelayMs(
  attempt: number,
  cause?: unknown,
  maxDelayMs: number | null = WEB_RUNTIME_MAX_RETRY_DELAY_MS
): number {
  const retryAfterMs = readRetryAfterMs(cause);
  const boundedAttempt = Math.max(1, attempt);
  const cappedDelay = Math.min(
    WEB_RUNTIME_MAX_RETRY_DELAY_MS,
    WEB_RUNTIME_RETRY_BASE_DELAY_MS * 2 ** (boundedAttempt - 1)
  );
  const jitteredDelay = Math.max(1, Math.floor(Math.random() * cappedDelay));
  const computedDelay =
    retryAfterMs === null ? jitteredDelay : Math.max(jitteredDelay, retryAfterMs);

  if (typeof maxDelayMs === "number" && Number.isFinite(maxDelayMs)) {
    const boundedMaxDelayMs = Math.max(0, Math.floor(maxDelayMs));
    if (retryAfterMs !== null && retryAfterMs > boundedMaxDelayMs) {
      return 0;
    }
    return Math.min(boundedMaxDelayMs, computedDelay);
  }

  return computedDelay;
}
