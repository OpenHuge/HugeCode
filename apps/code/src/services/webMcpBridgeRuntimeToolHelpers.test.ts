import { describe, expect, it } from "vitest";
import {
  RUNTIME_TOOL_OUTPUT_MAX_BYTES,
  RUNTIME_TOOL_OUTPUT_MAX_CHARS,
  summarizeRuntimeToolOutput,
} from "./webMcpBridgeRuntimeToolHelpers";

describe("webMcpBridgeRuntimeToolHelpers", () => {
  it("returns inline output summary when output fits limits", () => {
    const output = "ok";
    const summary = summarizeRuntimeToolOutput({
      toolName: "run-runtime-live-skill",
      output,
    });

    expect(summary).toMatchObject({
      truncated: false,
      preview: "ok",
      byteCount: 2,
      previewByteCount: 2,
      spoolReference: null,
    });
  });

  it("returns truncated preview and spool reference when output exceeds limits", () => {
    const output = "x".repeat(RUNTIME_TOOL_OUTPUT_MAX_CHARS + 32);
    const summary = summarizeRuntimeToolOutput({
      toolName: "execute-workspace-command",
      output,
      maxBytes: RUNTIME_TOOL_OUTPUT_MAX_BYTES,
      maxChars: RUNTIME_TOOL_OUTPUT_MAX_CHARS,
    });

    expect(summary.truncated).toBe(true);
    expect(summary.preview).toHaveLength(RUNTIME_TOOL_OUTPUT_MAX_CHARS);
    expect(summary.previewByteCount).toBeLessThanOrEqual(summary.byteCount);
    expect(summary.spoolReference?.uri).toMatch(/^\.code-runtime\/spool\//);
    expect(summary.spoolReference?.byteCount).toBe(summary.byteCount);
  });
});
