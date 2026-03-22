import { describe, expect, it } from "vitest";
import { normalizeRuntimeExecutionMode } from "./runtimeExecutionMode";

describe("runtimeExecutionMode", () => {
  it("normalizes canonical runtime execution modes", () => {
    expect(normalizeRuntimeExecutionMode("runtime")).toBe("runtime");
    expect(normalizeRuntimeExecutionMode("hybrid")).toBe("hybrid");
    expect(normalizeRuntimeExecutionMode("local-cli")).toBe("local-cli");
    expect(normalizeRuntimeExecutionMode("local_cli")).toBe("local-cli");
  });

  it("rejects empty or unsupported execution modes", () => {
    expect(normalizeRuntimeExecutionMode("")).toBeNull();
    expect(normalizeRuntimeExecutionMode("  ")).toBeNull();
    expect(normalizeRuntimeExecutionMode("desktop")).toBeNull();
    expect(normalizeRuntimeExecutionMode(null)).toBeNull();
  });
});
