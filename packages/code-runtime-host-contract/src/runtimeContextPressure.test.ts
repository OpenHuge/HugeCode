import { describe, expect, it } from "vitest";
import {
  buildRuntimeContextPressureSummary,
  mergeRuntimeContextPressureSummaries,
} from "./runtimeContextPressure";

describe("runtimeContextPressure", () => {
  it("reports nominal pressure when runtime context has no pressure signals", () => {
    const summary = buildRuntimeContextPressureSummary({});

    expect(summary.state).toBe("nominal");
    expect(summary.detail).toBe("Runtime context pressure is nominal.");
    expect(summary.recommendedAction).toContain("no context action");
    expect(summary.signals).toEqual([]);
  });

  it("surfaces executed compaction as attention with stable detail", () => {
    const summary = buildRuntimeContextPressureSummary({
      compactionSummary: {
        triggered: true,
        executed: true,
        source: "runtime_prepare_v2",
        compressedSteps: 2,
        bytesReduced: 640,
      },
    });

    expect(summary.state).toBe("attention");
    expect(summary.signals[0]).toEqual(
      expect.objectContaining({
        source: "compaction",
        state: "attention",
        detail: "Compaction: executed, 2 step(s), 640B reduced",
      })
    );
  });

  it("marks failed compaction or boundaries as critical", () => {
    const summary = buildRuntimeContextPressureSummary({
      compactionSummary: {
        triggered: true,
        executed: false,
        executionError: "summarizer unavailable",
      },
      contextBoundary: {
        boundaryId: "boundary-1",
        trigger: "tool_output",
        phase: "mid_turn",
        status: "failed",
      },
    });

    expect(summary.state).toBe("critical");
    expect(summary.detail).toContain("summarizer unavailable");
    expect(summary.detail).toContain("boundary-1 failed");
  });

  it("blocks required projection when a compacted boundary has no projection", () => {
    const summary = buildRuntimeContextPressureSummary({
      projectionRequired: true,
      contextBoundary: {
        boundaryId: "boundary-2",
        trigger: "resume",
        phase: "resume",
        status: "compacted",
        projectionFingerprint: "projection-123",
        updatedAt: 12,
      },
    });

    expect(summary.state).toBe("critical");
    expect(summary.projectionFingerprint).toBe("projection-123");
    expect(summary.updatedAt).toBe(12);
    expect(summary.signals[0]).toEqual(
      expect.objectContaining({
        source: "projection",
        detail: expect.stringContaining("requires a runtime projection"),
      })
    );
  });

  it("deduplicates projection references from boundary and projection evidence", () => {
    const summary = buildRuntimeContextPressureSummary({
      contextBoundary: {
        boundaryId: "boundary-3",
        trigger: "tool_output",
        phase: "mid_turn",
        status: "offloaded",
        summaryRef: "summary-boundary",
        offloadRefs: ["spool-a", "spool-b"],
        updatedAt: 10,
      },
      contextProjection: {
        boundaryId: "boundary-3",
        summaryRef: "summary-projection",
        projectionFingerprint: "projection-456",
        offloadRefs: ["spool-b"],
        updatedAt: 20,
      },
    });

    expect(summary.state).toBe("attention");
    expect(summary.summaryRef).toBe("summary-projection");
    expect(summary.projectionFingerprint).toBe("projection-456");
    expect(summary.offloadRefs).toEqual(["spool-a", "spool-b"]);
    expect(summary.updatedAt).toBe(20);
  });

  it("merges summaries by highest pressure while preserving evidence", () => {
    const attention = buildRuntimeContextPressureSummary({
      contextBoundary: {
        boundaryId: "boundary-attention",
        trigger: "tool_output",
        phase: "mid_turn",
        status: "offloaded",
        offloadRefs: ["spool-a"],
        updatedAt: 10,
      },
    });
    const critical = buildRuntimeContextPressureSummary({
      compactionSummary: {
        triggered: true,
        executed: false,
        executionError: "summary failed",
      },
    });

    const merged = mergeRuntimeContextPressureSummaries([attention, critical]);

    expect(merged.state).toBe("critical");
    expect(merged.detail).toContain("boundary-attention");
    expect(merged.detail).toContain("summary failed");
    expect(merged.offloadRefs).toEqual(["spool-a"]);
  });
});
