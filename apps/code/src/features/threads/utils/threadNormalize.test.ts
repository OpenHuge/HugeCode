import { describe, expect, it } from "vitest";
import { normalizeRateLimits } from "./threadNormalize";

describe("normalizeRateLimits", () => {
  it("merges incremental rate limit updates onto the previous snapshot", () => {
    const previous = {
      primary: {
        usedPercent: 40,
        windowDurationMins: 60,
        resetsAt: 1234,
      },
      secondary: {
        usedPercent: 10,
        windowDurationMins: 30,
        resetsAt: 999,
      },
      credits: {
        hasCredits: true,
        unlimited: false,
        balance: "24.00",
      },
      planType: "pro",
    };

    expect(
      normalizeRateLimits(
        {
          primary: {
            remaining_percent: 25,
          },
          credits: {
            balance: "21.50",
          },
        },
        previous
      )
    ).toEqual({
      primary: {
        usedPercent: 75,
        windowDurationMins: 60,
        resetsAt: 1234,
      },
      secondary: {
        usedPercent: 10,
        windowDurationMins: 30,
        resetsAt: 999,
      },
      credits: {
        hasCredits: true,
        unlimited: false,
        balance: "21.50",
      },
      planType: "pro",
    });
  });

  it("clears fields on explicit null while preserving omitted keys", () => {
    const previous = {
      primary: {
        usedPercent: 40,
        windowDurationMins: 60,
        resetsAt: 1234,
      },
      secondary: {
        usedPercent: 10,
        windowDurationMins: 30,
        resetsAt: 999,
      },
      credits: {
        hasCredits: true,
        unlimited: false,
        balance: "24.00",
      },
      planType: "pro",
    };

    expect(
      normalizeRateLimits(
        {
          secondary: null,
          credits: null,
          planType: null,
        },
        previous
      )
    ).toEqual({
      primary: {
        usedPercent: 40,
        windowDurationMins: 60,
        resetsAt: 1234,
      },
      secondary: null,
      credits: null,
      planType: null,
    });
  });

  it("inherits the full previous snapshot when the update payload omits all keys", () => {
    const previous = {
      primary: {
        usedPercent: 40,
        windowDurationMins: 60,
        resetsAt: 1234,
      },
      secondary: null,
      credits: {
        hasCredits: false,
        unlimited: true,
        balance: null,
      },
      planType: "enterprise",
    };

    expect(normalizeRateLimits({}, previous)).toEqual(previous);
  });

  it("merges limit id/name incrementally across updates", () => {
    const previous = {
      primary: null,
      secondary: null,
      credits: null,
      planType: "pro",
      limitId: "codex",
      limitName: "Codex",
    };

    expect(
      normalizeRateLimits(
        {
          limit_name: "Codex Team",
        },
        previous
      )
    ).toEqual({
      primary: null,
      secondary: null,
      credits: null,
      planType: "pro",
      limitId: "codex",
      limitName: "Codex Team",
    });
  });
});
