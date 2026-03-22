import { describe, expect, it } from "vitest";
import {
  applyRuntimeContextBudgetToToolOutput,
  RUNTIME_CONTEXT_BUDGET_PREVIEW_MAX_BYTES,
} from "./runtimeContextBudget";

describe("runtimeContextBudget", () => {
  it("passes through output when compaction is not needed", () => {
    const result = {
      output: "ok",
      metadata: {
        source: "test",
      },
    };
    const decision = applyRuntimeContextBudgetToToolOutput({
      result,
      toolOutput: {
        truncated: false,
        preview: "ok",
        byteCount: 2,
        previewByteCount: 2,
        spoolReference: null,
      },
    });

    expect(decision.result).toBe(result);
    expect(decision.toolOutput).toMatchObject({
      compactionApplied: false,
      compactionSummary: null,
      compactionReference: null,
    });
  });

  it("adds summary and reference when compaction is applied", () => {
    const preview = "x".repeat(RUNTIME_CONTEXT_BUDGET_PREVIEW_MAX_BYTES);
    const decision = applyRuntimeContextBudgetToToolOutput({
      result: {
        output: `${preview}y`,
        metadata: {},
      },
      toolOutput: {
        truncated: true,
        preview,
        byteCount: RUNTIME_CONTEXT_BUDGET_PREVIEW_MAX_BYTES + 1,
        previewByteCount: RUNTIME_CONTEXT_BUDGET_PREVIEW_MAX_BYTES,
        spoolReference: {
          uri: ".code-runtime/spool/runtime-live-skill.txt",
          byteCount: RUNTIME_CONTEXT_BUDGET_PREVIEW_MAX_BYTES + 1,
          previewCharCount: preview.length,
        },
      },
    });

    expect(decision.result.output).toBe(preview);
    expect(decision.result.metadata).toMatchObject({
      outputTruncated: true,
      outputSpoolUri: ".code-runtime/spool/runtime-live-skill.txt",
      outputByteCount: RUNTIME_CONTEXT_BUDGET_PREVIEW_MAX_BYTES + 1,
      outputPreviewByteCount: RUNTIME_CONTEXT_BUDGET_PREVIEW_MAX_BYTES,
      compactionApplied: true,
      outputCompactionReference: ".code-runtime/spool/runtime-live-skill.txt",
    });
    expect(decision.toolOutput).toMatchObject({
      compactionApplied: true,
      compactionReference: ".code-runtime/spool/runtime-live-skill.txt",
      compactionSummary: expect.stringContaining("Output compacted for context budget"),
    });
  });
});
