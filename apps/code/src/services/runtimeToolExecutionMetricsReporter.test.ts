import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RuntimeToolExecutionEvent } from "@ku0/code-runtime-host-contract";
import {
  __resetRuntimeToolExecutionMetricsReporterObserversForTests,
  __resetRuntimeToolGuardrailEvaluateOverrideForTests,
  __resetRuntimeToolGuardrailRecordOutcomeOverrideForTests,
  __resetRuntimeToolMetricsRecordOverrideForTests,
  __setRuntimeToolGuardrailEvaluateOverrideForTests,
  __setRuntimeToolGuardrailRecordOutcomeOverrideForTests,
  __setRuntimeToolMetricsRecordOverrideForTests,
  evaluateRuntimeToolGuardrail,
  getRuntimeToolExecutionTelemetrySnapshot,
  reportRuntimeToolExecutionAttempted,
  reportRuntimeToolExecutionCompleted,
  reportRuntimeToolExecutionStarted,
  reportRuntimeToolGuardrailOutcome,
  subscribeRuntimeToolExecutionTelemetryEvents,
} from "./runtimeToolExecutionMetricsReporter";

describe("runtimeToolExecutionMetricsReporter", () => {
  beforeEach(() => {
    __resetRuntimeToolMetricsRecordOverrideForTests();
    __resetRuntimeToolGuardrailEvaluateOverrideForTests();
    __resetRuntimeToolGuardrailRecordOutcomeOverrideForTests();
    __resetRuntimeToolExecutionMetricsReporterObserversForTests();
  });

  it("publishes execution and guardrail telemetry through the local snapshot stream", async () => {
    const telemetryListener = vi.fn();
    const metricsRecord = vi.fn(async (_events: RuntimeToolExecutionEvent[]) => undefined);

    __setRuntimeToolMetricsRecordOverrideForTests(metricsRecord);
    __setRuntimeToolGuardrailEvaluateOverrideForTests(async () => ({
      allowed: false,
      blockReason: "payload_too_large",
      errorCode: "runtime.validation.payload_too_large",
      message: "Payload exceeds runtime guardrail size limit.",
      channelHealth: {
        status: "healthy",
      },
      circuitBreaker: null,
      effectivePayloadLimitBytes: 65536,
      effectiveComputerObserveRateLimitPerMinute: 12,
      updatedAt: 301,
    }));
    __setRuntimeToolGuardrailRecordOutcomeOverrideForTests(async () => undefined);

    const unsubscribe = subscribeRuntimeToolExecutionTelemetryEvents(telemetryListener);

    await reportRuntimeToolExecutionAttempted({
      toolName: "bash",
      scope: "write",
      at: 101,
      metadata: {
        workspaceId: "workspace-1",
        requestId: "req-1",
      },
    });
    await reportRuntimeToolExecutionStarted({
      toolName: "bash",
      scope: "write",
      at: 102,
      metadata: {
        workspaceId: "workspace-1",
        requestId: "req-1",
      },
    });
    await reportRuntimeToolExecutionCompleted({
      toolName: "bash",
      scope: "write",
      status: "success",
      at: 103,
      durationMs: 21,
      metadata: {
        workspaceId: "workspace-1",
        requestId: "req-1",
      },
    });
    const guardrailDecision = await evaluateRuntimeToolGuardrail({
      toolName: "bash",
      scope: "write",
      workspaceId: "workspace-1",
      payloadBytes: 2048,
      at: 201,
      metadata: {
        requestId: "req-1",
      },
    });
    await reportRuntimeToolGuardrailOutcome({
      toolName: "bash",
      scope: "write",
      status: "blocked",
      workspaceId: "workspace-1",
      errorCode: guardrailDecision.errorCode,
      at: 202,
      durationMs: 4,
      metadata: {
        requestId: "req-1",
      },
    });

    const snapshot = getRuntimeToolExecutionTelemetrySnapshot();

    expect(telemetryListener).toHaveBeenCalledTimes(5);
    expect(snapshot.revision).toBe(5);
    expect(snapshot.lastEvent).toMatchObject({
      kind: "guardrail_outcome",
      toolName: "bash",
      status: "blocked",
      workspaceId: "workspace-1",
      at: 202,
    });
    expect(snapshot.recentEvents).toEqual([
      expect.objectContaining({
        kind: "execution",
        phase: "attempted",
        toolName: "bash",
        at: 101,
      }),
      expect.objectContaining({
        kind: "execution",
        phase: "started",
        toolName: "bash",
        at: 102,
      }),
      expect.objectContaining({
        kind: "execution",
        phase: "completed",
        toolName: "bash",
        status: "success",
        at: 103,
      }),
      expect.objectContaining({
        kind: "guardrail_evaluated",
        toolName: "bash",
        status: "blocked",
        at: 201,
        result: expect.objectContaining({
          allowed: false,
          blockReason: "payload_too_large",
        }),
      }),
      expect.objectContaining({
        kind: "guardrail_outcome",
        toolName: "bash",
        status: "blocked",
        at: 202,
      }),
    ]);

    unsubscribe();
  });

  it("does not publish strict execution telemetry when runtime metrics recording fails", async () => {
    __setRuntimeToolMetricsRecordOverrideForTests(async () => {
      throw new Error("metrics unavailable");
    });

    await expect(
      reportRuntimeToolExecutionAttempted({
        toolName: "bash",
        scope: "write",
        at: 111,
      })
    ).rejects.toMatchObject({
      message: expect.stringContaining("Runtime tool metrics channel is unavailable"),
    });

    expect(getRuntimeToolExecutionTelemetrySnapshot()).toEqual({
      revision: 0,
      lastEvent: null,
      recentEvents: [],
    });
  });
});
