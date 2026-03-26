// @vitest-environment jsdom

import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  readRuntimeToolExecutionMetrics,
  subscribeRuntimeToolExecutionMetrics,
} from "../../../application/runtime/ports/runtimeToolExecutionMetrics";
import { useDebugRuntimeToolExecutionMetrics } from "./useDebugRuntimeToolExecutionMetrics";

vi.mock("../../../application/runtime/ports/runtimeToolExecutionMetrics", () => ({
  readRuntimeToolExecutionMetrics: vi.fn(),
  subscribeRuntimeToolExecutionMetrics: vi.fn(() => () => undefined),
}));

const readRuntimeToolExecutionMetricsMock = vi.mocked(readRuntimeToolExecutionMetrics);
const subscribeRuntimeToolExecutionMetricsMock = vi.mocked(subscribeRuntimeToolExecutionMetrics);

describe("useDebugRuntimeToolExecutionMetrics", () => {
  beforeEach(() => {
    readRuntimeToolExecutionMetricsMock.mockReturnValue({
      totals: {
        attemptedTotal: 2,
        startedTotal: 1,
        completedTotal: 1,
        successTotal: 1,
        validationFailedTotal: 0,
        runtimeFailedTotal: 0,
        timeoutTotal: 0,
        blockedTotal: 0,
        truncatedTotal: 0,
      },
      byTool: {},
      recent: [
        {
          toolName: "execute-workspace-command",
          scope: "runtime",
          status: "success",
          errorCode: null,
          durationMs: 42,
          truncatedOutput: false,
          annotations: ["workspace-dry-run", "guardrail-skipped"],
          at: 1_770_000_000_000,
        },
      ],
      updatedAt: 1_770_000_000_000,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("subscribes to runtime tool execution metrics when enabled", () => {
    const { result } = renderHook(() =>
      useDebugRuntimeToolExecutionMetrics({
        enabled: true,
      })
    );

    expect(subscribeRuntimeToolExecutionMetricsMock).toHaveBeenCalledTimes(1);
    expect(result.current.updatedAt).toBe(1_770_000_000_000);
    expect(result.current.recentExecutions[0]?.annotations).toEqual([
      "workspace-dry-run",
      "guardrail-skipped",
    ]);
  });

  it("returns an empty snapshot and skips subscription when disabled", () => {
    const { result } = renderHook(() =>
      useDebugRuntimeToolExecutionMetrics({
        enabled: false,
      })
    );

    expect(subscribeRuntimeToolExecutionMetricsMock).not.toHaveBeenCalled();
    expect(result.current.updatedAt).toBe(0);
    expect(result.current.recentExecutions).toEqual([]);
    expect(result.current.totals.completedTotal).toBe(0);
  });
});
