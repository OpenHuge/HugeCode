import { describe, expect, it } from "vitest";
import { resolveRateLimitsSnapshot } from "./rateLimits";

describe("resolveRateLimitsSnapshot", () => {
  it("normalizes raw wham usage payloads into the app snapshot shape", () => {
    expect(
      resolveRateLimitsSnapshot({
        plan_type: "pro",
        rate_limit: {
          primary_window: {
            used_percent: 15,
            reset_at: 1_735_401_600,
            limit_window_seconds: 18_000,
          },
          secondary_window: {
            used_percent: 5,
            reset_at: 1_735_920_000,
            limit_window_seconds: 604_800,
          },
        },
        credits: {
          has_credits: true,
          unlimited: false,
          balance: 150.0,
        },
      })
    ).toEqual({
      primary: {
        usedPercent: 15,
        resetsAt: 1_735_401_600_000,
        windowDurationMins: 300,
      },
      secondary: {
        usedPercent: 5,
        resetsAt: 1_735_920_000_000,
        windowDurationMins: 10_080,
      },
      credits: {
        hasCredits: true,
        unlimited: false,
        balance: "150",
      },
      planType: "pro",
    });
  });

  it("prefers the codex bucket when rate limits by limit id use raw wham payloads", () => {
    expect(
      resolveRateLimitsSnapshot({
        rate_limits_by_limit_id: {
          claude: {
            plan_type: "team",
            rate_limit: {
              primary_window: {
                used_percent: 12,
                reset_at: 1_735_401_600,
                limit_window_seconds: 18_000,
              },
            },
          },
          codex: {
            plan_type: "pro",
            rate_limit: {
              primary_window: {
                used_percent: 66,
                reset_at: 1_735_401_600,
                limit_window_seconds: 18_000,
              },
              secondary_window: {
                used_percent: 20,
                reset_at: 1_735_920_000,
                limit_window_seconds: 604_800,
              },
            },
            credits: {
              has_credits: false,
              unlimited: true,
            },
          },
        },
      })
    ).toEqual({
      primary: {
        usedPercent: 66,
        resetsAt: 1_735_401_600_000,
        windowDurationMins: 300,
      },
      secondary: {
        usedPercent: 20,
        resetsAt: 1_735_920_000_000,
        windowDurationMins: 10_080,
      },
      credits: {
        hasCredits: false,
        unlimited: true,
      },
      planType: "pro",
      limitId: "codex",
      limit_id: "codex",
    });
  });
});
