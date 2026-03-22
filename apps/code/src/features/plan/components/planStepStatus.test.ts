import { describe, expect, it } from "vitest";
import { getPlanStepStatusLabel, getPlanStepStatusTone } from "./planStepStatus";

describe("planStepStatus", () => {
  it("maps plan step statuses to compact labels", () => {
    expect(getPlanStepStatusLabel("completed")).toBe("[x]");
    expect(getPlanStepStatusLabel("inProgress")).toBe("[>]");
    expect(getPlanStepStatusLabel("blocked")).toBe("[!]");
    expect(getPlanStepStatusLabel("failed")).toBe("[x!]");
    expect(getPlanStepStatusLabel("cancelled")).toBe("[-]");
    expect(getPlanStepStatusLabel("pending")).toBe("[ ]");
  });

  it("maps plan step statuses to presentation tones", () => {
    expect(getPlanStepStatusTone("completed")).toBe("success");
    expect(getPlanStepStatusTone("inProgress")).toBe("progress");
    expect(getPlanStepStatusTone("blocked")).toBe("warning");
    expect(getPlanStepStatusTone("failed")).toBe("error");
    expect(getPlanStepStatusTone("cancelled")).toBe("muted");
    expect(getPlanStepStatusTone("pending")).toBe("default");
  });
});
