import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  __resetRuntimeEventChannelDiagnosticsForTests,
  readRuntimeEventChannelDiagnostics,
} from "@ku0/code-runtime-client/runtimeEventChannelDiagnostics";
import {
  __resetRuntimeEventStabilityMetricsForTests,
  readRuntimeEventStabilityMetrics,
} from "@ku0/code-runtime-client/runtimeEventStabilityMetrics";
import {
  createRuntimeEventStateMachine,
  subscribeRuntimeEventStateChannel,
} from "./runtimeEventStateMachine";
import type { AgentEnvelopeMetadata } from "@ku0/code-runtime-client/runtimeMessageEnvelope";

function readChannel(id: string) {
  return readRuntimeEventChannelDiagnostics().find((entry) => entry.id === id) ?? null;
}

describe("runtimeEventStateMachine", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-19T00:00:00.000Z"));
    __resetRuntimeEventChannelDiagnosticsForTests();
    __resetRuntimeEventStabilityMetricsForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("tracks reconnect, fallback, recovery and failure diagnostics", () => {
    const machine = createRuntimeEventStateMachine({
      id: "unit-app-server-events",
      label: "Unit app server events",
      defaultTransport: "ws",
    });

    machine.transition("connecting", {
      reason: "initial-connect",
      retryAttempt: 0,
      retryDelayMs: null,
    });
    machine.transition("reconnecting", { reason: "retry-1", retryAttempt: 1, retryDelayMs: 500 });
    machine.transition("fallback", {
      reason: "fallback-sse",
      transport: "sse",
      retryDelayMs: 10_000,
    });

    const fallbackSnapshot = readChannel("unit-app-server-events");
    expect(fallbackSnapshot?.status).toBe("fallback");
    expect(fallbackSnapshot?.transport).toBe("sse");
    expect(fallbackSnapshot?.lastTransitionReason).toBe("fallback-sse");
    expect(typeof fallbackSnapshot?.fallbackSinceMs).toBe("number");

    vi.advanceTimersByTime(2_300);
    machine.transition("open", {
      reason: "recovered",
      transport: "ws",
      retryAttempt: 0,
      retryDelayMs: null,
    });
    machine.setError(new Error("bridge timeout"), "bridge-timeout");
    machine.transition("stopped", { reason: "dispose" });

    const finalSnapshot = readChannel("unit-app-server-events");
    expect(finalSnapshot?.status).toBe("stopped");
    expect(finalSnapshot?.fallbackSinceMs).toBeNull();
    expect(finalSnapshot?.consecutiveFailures).toBe(1);
    expect(finalSnapshot?.lastError).toBe("bridge timeout");
    expect(finalSnapshot?.lastTransitionReason).toBe("dispose");

    expect(readRuntimeEventStabilityMetrics()).toMatchObject({
      reconnectAttemptTotal: 1,
      reconnectSuccessTotal: 1,
      fallbackEnterTotal: 1,
      fallbackRecoverTotal: 1,
      lastFallbackReason: "fallback-sse",
      lastFallbackDurationMs: 2300,
    });
  });

  it("emits channel transitions only when state materially changes", () => {
    const machine = createRuntimeEventStateMachine({
      id: "unit-app-server-stream",
      label: "Unit app server stream",
      defaultTransport: "ws",
    });
    const transitions: Array<{ previous: string; current: string; reason: string | null }> = [];
    const unlisten = subscribeRuntimeEventStateChannel("unit-app-server-stream", (transition) => {
      transitions.push({
        previous: transition.previous?.status ?? "none",
        current: transition.current.status,
        reason: transition.current.lastTransitionReason,
      });
    });

    machine.transition("connecting", { reason: "start" });
    machine.transition("connecting", { reason: "start" });
    machine.transition("connecting", { reason: "retry" });
    machine.transition("open", { reason: "ready" });
    machine.transition("open", { reason: "ready" });
    unlisten();

    expect(transitions).toEqual([
      { previous: "none", current: "connecting", reason: "start" },
      { previous: "connecting", current: "connecting", reason: "retry" },
      { previous: "connecting", current: "open", reason: "ready" },
    ]);
  });

  it("records agent envelope events to diagnostics", () => {
    const machine = createRuntimeEventStateMachine({
      id: "unit-agent-envelope",
      label: "Unit agent envelope",
      defaultTransport: "ws",
    });

    const metadata: AgentEnvelopeMetadata = {
      route: { sourceAgentId: "planner", targetAgentId: "builder", channelId: "agent-routing" },
      eventType: "agent.message",
    };

    machine.transition("open", {
      reason: "ready",
    });
    machine.recordAgentEnvelopeEvent(metadata);

    const snapshot = readChannel("unit-agent-envelope");
    expect(snapshot?.lastTransitionReason).toBe("agent-envelope:agent.message");
  });
});
