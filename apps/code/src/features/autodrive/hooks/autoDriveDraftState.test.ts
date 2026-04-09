import { describe, expect, it } from "vitest";
import {
  DEFAULT_DRAFT,
  normalizeDraft,
  resolveActivePresetKey,
  sanitizeBudgetValue,
} from "./autoDriveDraftState";

describe("autoDriveDraftState", () => {
  it("migrates legacy goal and constraints into the current destination shape", () => {
    const draft = normalizeDraft({
      enabled: true,
      goal: "Ship runtime truth",
      constraints: "Do not add local fallback state",
      budget: {
        maxTokens: 1200,
        maxIterations: 2,
        maxDurationMinutes: 5,
        maxFilesPerIteration: 3,
        maxNoProgressIterations: 1,
        maxValidationFailures: 1,
        maxReroutes: 1,
      },
      riskPolicy: {
        minimumConfidence: "high",
      },
    } as never);

    expect(draft.destination.title).toBe("Ship runtime truth");
    expect(draft.destination.avoid).toBe("Do not add local fallback state");
    expect(draft.destination.routePreference).toBe(DEFAULT_DRAFT.destination.routePreference);
    expect(draft.riskPolicy.minimumConfidence).toBe("high");
  });

  it("recognizes the safe default preset and clamps minimum budget values", () => {
    expect(resolveActivePresetKey(DEFAULT_DRAFT)).toBe("safe_default");
    expect(sanitizeBudgetValue("maxIterations", 0)).toBe(1);
    expect(sanitizeBudgetValue("maxTokens", Number.NaN)).toBe(100);
  });
});
