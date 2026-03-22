/**
 * Compatibility shim. Shared runtime-client infrastructure now lives in
 * `@ku0/code-runtime-client/runtimeClientWebRequestTimeouts`.
 */
export {
  WEB_RUNTIME_DEFAULT_REQUEST_TIMEOUT_MS,
  WEB_RUNTIME_LEGACY_TURN_SEND_REQUEST_TIMEOUT_MS,
  resolveWebRuntimeRequestTimeoutMs,
} from "@ku0/code-runtime-client/runtimeClientWebRequestTimeouts";
