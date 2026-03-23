import { isTauri } from "@tauri-apps/api/core";
import { logger } from "./logger";
import { detectRuntimeMode } from "./runtimeClient";
import { getErrorMessage } from "@ku0/code-runtime-client/runtimeClientErrorUtils";
import {
  isTimeoutLikeError,
  isWebRuntimeConnectionError,
} from "@ku0/code-runtime-client/runtimeErrorClassifier";
import { createRuntimeError } from "@ku0/code-runtime-client/runtimeMessageEnvelope";
import {
  resolveWebRuntimeControlEndpoint as resolveWebRuntimeControlEndpointFromCore,
  resolveWebRuntimeEndpoint,
  WEB_RUNTIME_GATEWAY_ENDPOINT_ENV_KEY,
} from "./runtimeWebTransportCore";

const WEB_RUNTIME_OAUTH_COOLDOWN_MS = 5_000;
export const WEB_RUNTIME_OAUTH_FALLBACK_TIMEOUT_MS = 2_000;
export const WEB_RUNTIME_OAUTH_DIRECT_RPC_TIMEOUT_MS = 30_000;
export const WEB_RUNTIME_RPC_ENDPOINT_ENV_KEY = WEB_RUNTIME_GATEWAY_ENDPOINT_ENV_KEY;
export const WEB_RUNTIME_OAUTH_PERSISTENCE_UNAVAILABLE_CODE =
  "runtime.oauth.persistence_unavailable";

let webRuntimeOauthCooldownUntilMs = 0;
const webRuntimeOauthRequestInFlight = new Map<string, Promise<unknown>>();

export function resolveWebRuntimeRpcEndpoint(): string | null {
  return resolveWebRuntimeEndpoint();
}

export function resolveWebRuntimeControlEndpoint(path: string): string | null {
  return resolveWebRuntimeControlEndpointFromCore(path);
}

export function shouldUseWebRuntimeDirectRpc(): boolean {
  return !isTauri() && detectRuntimeMode() === "runtime-gateway-web";
}

function logRuntimeWarning(message: string, context?: unknown): void {
  logger.warn(message, context);
}

export function isWebRuntimeOauthCooldownActive(now = Date.now()): boolean {
  return !isTauri() && now < webRuntimeOauthCooldownUntilMs;
}

export function clearWebRuntimeOauthCooldown(): void {
  webRuntimeOauthCooldownUntilMs = 0;
}

export function clearWebRuntimeOauthRequestInFlight(): void {
  webRuntimeOauthRequestInFlight.clear();
}

export function resetWebRuntimeOauthFallbackState(): void {
  clearWebRuntimeOauthCooldown();
  clearWebRuntimeOauthRequestInFlight();
}

export async function runWebRuntimeOAuthRequest<T>(
  key: string,
  task: () => Promise<T>
): Promise<T> {
  if (isTauri()) {
    return task();
  }
  const existing = webRuntimeOauthRequestInFlight.get(key);
  if (existing) {
    return (await existing) as T;
  }
  const promise = task();
  webRuntimeOauthRequestInFlight.set(key, promise as Promise<unknown>);
  try {
    return await promise;
  } finally {
    if (webRuntimeOauthRequestInFlight.get(key) === promise) {
      webRuntimeOauthRequestInFlight.delete(key);
    }
  }
}

function shouldTripWebRuntimeOauthCooldown(error: unknown): boolean {
  return isTimeoutLikeError(error) || isWebRuntimeConnectionError(error);
}

export function markWebRuntimeOauthCooldown(error: unknown, label: string): void {
  if (isTauri()) {
    return;
  }
  if (!shouldTripWebRuntimeOauthCooldown(error)) {
    return;
  }
  webRuntimeOauthCooldownUntilMs = Date.now() + WEB_RUNTIME_OAUTH_COOLDOWN_MS;
  logRuntimeWarning(
    "Web runtime oauth/provider endpoint is unstable; blocking OAuth persistence until runtime recovers.",
    {
      label,
      cooldownMs: WEB_RUNTIME_OAUTH_COOLDOWN_MS,
      error: getErrorMessage(error),
    }
  );
}

export function createWebRuntimeOauthPersistenceUnavailableError(
  label: string,
  error?: unknown
): Error {
  const detail = getErrorMessage(error).trim();
  return createRuntimeError({
    code: WEB_RUNTIME_OAUTH_PERSISTENCE_UNAVAILABLE_CODE,
    message: `Web runtime durable OAuth persistence is unavailable for ${label}. Authentication is not complete and no durable account or workspace binding was written.${detail.length > 0 ? ` Root cause: ${detail}` : ""}`,
  });
}

export async function awaitWebRuntimeWithFallbackTimeout<T>(
  taskFactory: (signal: AbortSignal | undefined) => Promise<T>,
  label: string,
  timeoutMs = WEB_RUNTIME_OAUTH_FALLBACK_TIMEOUT_MS
): Promise<T> {
  if (isTauri()) {
    return taskFactory(undefined);
  }
  const controller = typeof AbortController === "function" ? new AbortController() : null;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      controller?.abort();
      reject(new Error(`Timed out waiting for ${label}`));
    }, timeoutMs);
  });
  const task = taskFactory(controller?.signal);
  try {
    return await Promise.race([task, timeout]);
  } finally {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
  }
}

export { getErrorMessage };
