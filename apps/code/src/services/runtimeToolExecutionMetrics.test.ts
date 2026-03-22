import { describe, expect, it } from "vitest";
import {
  __resetRuntimeToolExecutionMetricsForTests,
  readRuntimeToolExecutionMetrics,
  recordRuntimeToolExecutionAttempt,
  recordRuntimeToolExecutionEnd,
  recordRuntimeToolExecutionStart,
} from "./runtimeToolExecutionMetrics";

describe("runtimeToolExecutionMetrics", () => {
  it("records attempt, start, and success end counters", () => {
    __resetRuntimeToolExecutionMetricsForTests();

    recordRuntimeToolExecutionAttempt("run-runtime-live-skill", "runtime");
    recordRuntimeToolExecutionStart("run-runtime-live-skill", "runtime");
    recordRuntimeToolExecutionEnd({
      toolName: "run-runtime-live-skill",
      scope: "runtime",
      status: "success",
      durationMs: 24.7,
    });

    const snapshot = readRuntimeToolExecutionMetrics();
    expect(snapshot.totals).toMatchObject({
      attemptedTotal: 1,
      startedTotal: 1,
      completedTotal: 1,
      successTotal: 1,
      validationFailedTotal: 0,
      runtimeFailedTotal: 0,
      timeoutTotal: 0,
      blockedTotal: 0,
      truncatedTotal: 0,
    });
    expect(snapshot.recent).toHaveLength(1);
    expect(snapshot.recent[0]).toMatchObject({
      toolName: "run-runtime-live-skill",
      scope: "runtime",
      status: "success",
      durationMs: 24,
      truncatedOutput: false,
    });
    expect(Object.values(snapshot.byTool)).toEqual([
      expect.objectContaining({
        toolName: "run-runtime-live-skill",
        scope: "runtime",
        attemptedTotal: 1,
        startedTotal: 1,
        completedTotal: 1,
        successTotal: 1,
        lastStatus: "success",
        lastDurationMs: 24,
      }),
    ]);
  });

  it("tracks validation, timeout, blocked, and runtime failure buckets", () => {
    __resetRuntimeToolExecutionMetricsForTests();

    recordRuntimeToolExecutionAttempt("set-user-intent", "write");
    recordRuntimeToolExecutionEnd({
      toolName: "set-user-intent",
      scope: "write",
      status: "validation_failed",
      errorCode: "INPUT_SCHEMA_VALIDATION_FAILED",
    });

    recordRuntimeToolExecutionAttempt("execute-workspace-command", "runtime");
    recordRuntimeToolExecutionStart("execute-workspace-command", "runtime");
    recordRuntimeToolExecutionEnd({
      toolName: "execute-workspace-command",
      scope: "runtime",
      status: "timeout",
      errorCode: "REQUEST_TIMEOUT",
      durationMs: 910,
    });

    recordRuntimeToolExecutionAttempt("execute-workspace-command", "runtime");
    recordRuntimeToolExecutionStart("execute-workspace-command", "runtime");
    recordRuntimeToolExecutionEnd({
      toolName: "execute-workspace-command",
      scope: "runtime",
      status: "blocked",
      errorCode: "runtime.validation.request.blocked",
    });

    recordRuntimeToolExecutionAttempt("run-runtime-live-skill", "runtime");
    recordRuntimeToolExecutionStart("run-runtime-live-skill", "runtime");
    recordRuntimeToolExecutionEnd({
      toolName: "run-runtime-live-skill",
      scope: "runtime",
      status: "runtime_failed",
      errorCode: "runtime.validation.error.unknown",
    });

    const snapshot = readRuntimeToolExecutionMetrics();
    expect(snapshot.totals).toMatchObject({
      attemptedTotal: 4,
      startedTotal: 3,
      completedTotal: 4,
      successTotal: 0,
      validationFailedTotal: 1,
      timeoutTotal: 1,
      blockedTotal: 1,
      runtimeFailedTotal: 1,
      truncatedTotal: 0,
    });
    expect(snapshot.recent.map((entry) => entry.status)).toEqual([
      "runtime_failed",
      "blocked",
      "timeout",
      "validation_failed",
    ]);
  });

  it("tracks truncated output totals when runtime tools return spooled previews", () => {
    __resetRuntimeToolExecutionMetricsForTests();

    recordRuntimeToolExecutionAttempt("run-runtime-live-skill", "runtime");
    recordRuntimeToolExecutionStart("run-runtime-live-skill", "runtime");
    recordRuntimeToolExecutionEnd({
      toolName: "run-runtime-live-skill",
      scope: "runtime",
      status: "success",
      truncatedOutput: true,
      durationMs: 110,
    });
    recordRuntimeToolExecutionAttempt("run-runtime-live-skill", "runtime");
    recordRuntimeToolExecutionStart("run-runtime-live-skill", "runtime");
    recordRuntimeToolExecutionEnd({
      toolName: "run-runtime-live-skill",
      scope: "runtime",
      status: "success",
      durationMs: 98,
    });

    const snapshot = readRuntimeToolExecutionMetrics();
    expect(snapshot.totals.truncatedTotal).toBe(1);
    expect(snapshot.recent[0]?.truncatedOutput).toBe(false);
    expect(snapshot.recent[1]?.truncatedOutput).toBe(true);
    expect(Object.values(snapshot.byTool)).toEqual([
      expect.objectContaining({
        toolName: "run-runtime-live-skill",
        truncatedTotal: 1,
      }),
    ]);
  });
});
