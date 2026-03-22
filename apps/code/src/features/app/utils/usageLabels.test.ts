import { describe, expect, it, vi } from "vitest";
import { getUsageLabels } from "./usageLabels";

describe("getUsageLabels", () => {
  it("returns remaining-mode labels and percentages without coercing missing values", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-09T00:00:00.000Z"));

    const labels = getUsageLabels(
      {
        primary: { usedPercent: 43, windowDurationMins: 300, resetsAt: 1_772_982_400_000 },
        secondary: { usedPercent: 43, windowDurationMins: null, resetsAt: 1_773_532_800_000 },
        credits: null,
        planType: "pro",
        limitName: "Codex",
      },
      true
    );

    expect(labels.usageTitle).toBe("Rate limits remaining");
    expect(labels.sessionLabel).toBe("Session remaining");
    expect(labels.weeklyLabel).toBe("Weekly remaining");
    expect(labels.sessionPercent).toBe(57);
    expect(labels.weeklyPercent).toBe(57);

    vi.useRealTimers();
  });

  it("keeps null usage values as null instead of defaulting to zero", () => {
    const labels = getUsageLabels(
      {
        primary: null,
        secondary: null,
        credits: null,
        planType: null,
      },
      false
    );

    expect(labels.sessionPercent).toBeNull();
    expect(labels.weeklyPercent).toBeNull();
  });
});
