import { describe, expect, it } from "vitest";
import {
  formatCompactExecutionStatusLabel,
  formatExecutionStatusLabel,
  resolveExecutionStatusPresentation,
  resolveExecutionTone,
} from "../../../../design-system";

describe("executionStatus", () => {
  it("formats standard runtime states into readable labels", () => {
    expect(formatExecutionStatusLabel("in_progress")).toBe("In progress");
    expect(formatExecutionStatusLabel("completed")).toBe("Completed");
    expect(formatExecutionStatusLabel("failed")).toBe("Failed");
  });

  it("maps runtime states to semantic tones", () => {
    expect(resolveExecutionTone("queued")).toBe("running");
    expect(resolveExecutionTone("offline")).toBe("warning");
    expect(resolveExecutionTone("turn_failed")).toBe("danger");
    expect(resolveExecutionTone("completed")).toBe("success");
  });

  it("compresses compact labels for dense chips", () => {
    expect(formatCompactExecutionStatusLabel("Completed", "success")).toBe("Done");
    expect(formatCompactExecutionStatusLabel("In progress", "running")).toBe("Running");
    expect(formatCompactExecutionStatusLabel("Failed", "danger")).toBe("Failed");
  });

  it("derives shared label and tone from one execution classification helper", () => {
    expect(resolveExecutionStatusPresentation("queued")).toEqual({
      label: "In progress",
      tone: "running",
    });
    expect(resolveExecutionStatusPresentation("offline")).toEqual({
      label: "Attention",
      tone: "warning",
    });
    expect(resolveExecutionStatusPresentation("turn_failed")).toEqual({
      label: "Failed",
      tone: "danger",
    });
    expect(resolveExecutionStatusPresentation("custom_status")).toEqual({
      label: "Custom Status",
      tone: "neutral",
    });
  });

  it("preserves canonical mission-control states instead of downgrading them to neutral labels", () => {
    expect(resolveExecutionStatusPresentation("review_ready")).toEqual({
      label: "Review ready",
      tone: "success",
    });
    expect(resolveExecutionStatusPresentation("needs_input")).toEqual({
      label: "Needs input",
      tone: "warning",
    });
    expect(resolveExecutionStatusPresentation("awaiting_approval")).toEqual({
      label: "Awaiting approval",
      tone: "warning",
    });
    expect(resolveExecutionStatusPresentation("validating")).toEqual({
      label: "Validating",
      tone: "running",
    });
  });
});
