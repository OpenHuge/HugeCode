/**
 * Compatibility shim. Shared runtime-client infrastructure now lives in
 * `@ku0/code-runtime-client/runtimeEventStabilityMetrics`.
 */
export type { RuntimeEventStabilitySnapshot } from "@ku0/code-runtime-client/runtimeEventStabilityMetrics";
export {
  readRuntimeEventStabilityMetrics,
  subscribeRuntimeEventStabilityMetrics,
  recordRuntimeEventFallbackEntered,
  recordRuntimeEventFallbackRecovered,
  recordRuntimeEventReconnectAttempt,
  recordRuntimeEventReconnectSuccess,
  recordRuntimeEventDedupeHit,
  __resetRuntimeEventStabilityMetricsForTests,
} from "@ku0/code-runtime-client/runtimeEventStabilityMetrics";
