import { describe, expect, it } from "vitest";
import { describeReviewFailureClass, formatReviewFailureClassLabel } from "./reviewFailureClass";

describe("reviewFailureClass", () => {
  it("formats canonical review failure labels", () => {
    expect(formatReviewFailureClassLabel("validation_failed")).toBe("Validation failure");
    expect(formatReviewFailureClassLabel("approval_required")).toBe("Approval required");
    expect(formatReviewFailureClassLabel("runtime_failed")).toBe("Runtime failure");
    expect(formatReviewFailureClassLabel("timed_out")).toBe("Timed out");
    expect(formatReviewFailureClassLabel("timed_out", { style: "detail" })).toBe("Run timed out");
    expect(formatReviewFailureClassLabel("interrupted")).toBe("Interrupted");
    expect(formatReviewFailureClassLabel("cancelled")).toBe("Cancelled");
    expect(formatReviewFailureClassLabel("unknown")).toBe("Unknown failure");
    expect(formatReviewFailureClassLabel(null)).toBeNull();
  });

  it("provides review-facing failure summaries", () => {
    expect(describeReviewFailureClass("timed_out")).toEqual({
      label: "Run timed out",
      summary: "The run did not finish before the configured timeout window.",
    });
    expect(describeReviewFailureClass("cancelled")).toEqual({
      label: "Cancelled",
      summary: "The operator or system cancelled this run before completion.",
    });
    expect(describeReviewFailureClass(null)).toEqual({
      label: null,
      summary: null,
    });
  });
});
