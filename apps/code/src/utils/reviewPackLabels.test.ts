import { describe, expect, it } from "vitest";
import {
  getReviewEvidenceStateTone,
  getReviewStatusTone,
  getValidationOutcomeTone,
  formatMissionReviewEvidenceLabel,
  formatReviewEvidenceStateLabel,
  formatReviewStatusLabel,
  formatValidationOutcomeLabel,
} from "./reviewPackLabels";

describe("reviewPackLabels", () => {
  it("formats review status labels", () => {
    expect(formatReviewStatusLabel("action_required", 0)).toBe("Needs attention");
    expect(formatReviewStatusLabel("action_required", 2)).toBe("Needs attention (2 warnings)");
    expect(formatReviewStatusLabel("incomplete_evidence", 0)).toBe("Evidence incomplete");
    expect(formatReviewStatusLabel("ready", 0)).toBe("Review ready");
  });

  it("formats evidence state labels", () => {
    expect(formatReviewEvidenceStateLabel("confirmed")).toBe("Evidence confirmed");
    expect(formatReviewEvidenceStateLabel("incomplete")).toBe("Evidence incomplete");
  });

  it("resolves review surface tones from shared helpers", () => {
    expect(getReviewStatusTone("action_required")).toBe("warning");
    expect(getReviewStatusTone("incomplete_evidence")).toBe("warning");
    expect(getReviewStatusTone("ready")).toBe("success");
    expect(getReviewEvidenceStateTone("confirmed")).toBe("success");
    expect(getReviewEvidenceStateTone("incomplete")).toBe("warning");
    expect(getValidationOutcomeTone("passed")).toBe("success");
    expect(getValidationOutcomeTone("failed")).toBe("danger");
    expect(getValidationOutcomeTone("warning")).toBe("warning");
    expect(getValidationOutcomeTone("skipped")).toBe("neutral");
    expect(getValidationOutcomeTone("unknown")).toBe("neutral");
  });

  it("formats validation outcome labels", () => {
    expect(formatValidationOutcomeLabel("passed")).toBe("Validation passed");
    expect(formatValidationOutcomeLabel("failed")).toBe("Validation failed");
    expect(formatValidationOutcomeLabel("warning")).toBe("Validation warning");
    expect(formatValidationOutcomeLabel("skipped")).toBe("Validation skipped");
    expect(formatValidationOutcomeLabel("unknown")).toBe("Validation unavailable");
  });

  it("formats mission review evidence labels", () => {
    expect(formatMissionReviewEvidenceLabel("passed", 0, true)).toBe("Validation passed");
    expect(formatMissionReviewEvidenceLabel("passed", 1, true)).toBe(
      "Validation passed with warnings"
    );
    expect(formatMissionReviewEvidenceLabel("warning", 0, true)).toBe("Evidence needs review");
    expect(formatMissionReviewEvidenceLabel("failed", 0, true)).toBe("Validation failed");
    expect(formatMissionReviewEvidenceLabel("skipped", 0, true)).toBe("Runtime evidence only");
    expect(formatMissionReviewEvidenceLabel("unknown", 0, false)).toBe(
      "Validation evidence unavailable"
    );
  });
});
