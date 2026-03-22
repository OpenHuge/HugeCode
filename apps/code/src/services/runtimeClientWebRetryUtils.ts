/**
 * Compatibility shim. Shared runtime-client infrastructure now lives in
 * `@ku0/code-runtime-client/runtimeClientWebRetryUtils`.
 */
export {
  WEB_RUNTIME_MAX_RETRY_ATTEMPTS,
  WEB_RUNTIME_RETRY_BASE_DELAY_MS,
  WEB_RUNTIME_MAX_RETRY_DELAY_MS,
  parseWebRuntimeRetryAfterMs,
  shouldRetryWebRuntimeInvocation,
  sleep,
  computeWebRuntimeRetryDelayMs,
} from "@ku0/code-runtime-client/runtimeClientWebRetryUtils";
