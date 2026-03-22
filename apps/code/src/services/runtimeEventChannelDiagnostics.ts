/**
 * Compatibility shim. Shared runtime-client infrastructure now lives in
 * `@ku0/code-runtime-client/runtimeEventChannelDiagnostics`.
 */
export type {
  RuntimeEventChannelTransport,
  RuntimeEventChannelStatus,
  RuntimeEventChannelDiagnostics,
} from "@ku0/code-runtime-client/runtimeEventChannelDiagnostics";
export {
  readRuntimeEventChannelDiagnostics,
  updateRuntimeEventChannelDiagnostics,
  subscribeRuntimeEventChannelDiagnostics,
  normalizeRuntimeEventChannelError,
  __resetRuntimeEventChannelDiagnosticsForTests,
} from "@ku0/code-runtime-client/runtimeEventChannelDiagnostics";
