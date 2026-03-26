import { describe, expect, it, vi } from "vitest";
import {
  runVisibilityCheckWithTimeout,
  resolveVisibilityCheckExitCode,
  summarizeVisibilityCheckResult,
} from "../e2e/scripts/visibility-check.shared.mjs";

describe("visibility-check summary", () => {
  it("summarizes a successful CDP check into a readable result", () => {
    const summary = summarizeVisibilityCheckResult({
      url: "http://localhost:5187/workspaces",
      useCdp: true,
      useTrace: false,
      useInit: false,
      metricCount: 36,
      steps: [
        { label: "goto", ok: true, ms: 220 },
        { label: "cdp-metrics", ok: true, ms: 18 },
      ],
      errors: [],
    });

    expect(summary).toEqual({
      ok: true,
      url: "http://localhost:5187/workspaces",
      mode: {
        cdp: true,
        trace: false,
        initScript: false,
      },
      metricCount: 36,
      stepCount: 2,
      failedSteps: [],
      errors: [],
    });
    expect(resolveVisibilityCheckExitCode(summary)).toBe(0);
  });

  it("marks failed steps as a non-zero exit condition", () => {
    const summary = summarizeVisibilityCheckResult({
      url: "http://localhost:5187/workspaces",
      useCdp: true,
      useTrace: false,
      useInit: false,
      metricCount: null,
      steps: [
        { label: "goto", ok: true, ms: 220 },
        { label: "cdp-metrics", ok: false, ms: 8000, error: "timeout:cdp-metrics:8000" },
      ],
      errors: ["cdp-metrics:timeout:cdp-metrics:8000"],
    });

    expect(summary.failedSteps).toEqual(["cdp-metrics"]);
    expect(summary.ok).toBe(false);
    expect(resolveVisibilityCheckExitCode(summary)).toBe(1);
  });

  it("clears timeout handles after a successful step resolves", async () => {
    vi.useFakeTimers();
    try {
      const promise = runVisibilityCheckWithTimeout("warmup", async () => "ok", 5_000);
      await vi.runAllTimersAsync();
      await expect(promise).resolves.toBe("ok");
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
