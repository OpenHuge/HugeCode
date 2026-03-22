import { describe, expect, it } from "vitest";
import {
  __resetRuntimeEventChannelDiagnosticsForTests,
  readRuntimeEventChannelDiagnostics,
} from "./runtimeEventChannelDiagnostics";
import {
  __resetRuntimeEventStabilityMetricsForTests,
  readRuntimeEventStabilityMetrics,
} from "./runtimeEventStabilityMetrics";
import { createRuntimeEventStateMachine } from "./runtimeEventStateMachine";

describe("@ku0/code-runtime-client runtime event state", () => {
  it("tracks fallback recovery and reconnect state transitions", () => {
    __resetRuntimeEventChannelDiagnosticsForTests();
    __resetRuntimeEventStabilityMetricsForTests();

    const machine = createRuntimeEventStateMachine({
      id: "runtime-events",
      label: "Runtime events",
      defaultTransport: "ws",
    });

    machine.transition("connecting");
    machine.transition("fallback", { reason: "gateway-down" });
    machine.transition("reconnecting", { retryAttempt: 1, retryDelayMs: 125 });
    machine.transition("open");

    const [channel] = readRuntimeEventChannelDiagnostics();
    expect(channel).toMatchObject({
      id: "runtime-events",
      status: "open",
      transport: "ws",
      retryAttempt: 1,
      retryDelayMs: null,
      lastError: null,
    });

    expect(readRuntimeEventStabilityMetrics()).toMatchObject({
      fallbackEnterTotal: 1,
      fallbackRecoverTotal: 1,
      reconnectAttemptTotal: 1,
      reconnectSuccessTotal: 1,
    });
  });
});
