import { describe, expect, it } from "vitest";
import { mapInterventionIntentToAction } from "./reviewInterventionMapping";

describe("reviewInterventionMapping", () => {
  it("maps launcher intents to runtime intervention actions", () => {
    expect(mapInterventionIntentToAction("retry")).toBe("retry");
    expect(mapInterventionIntentToAction("clarify")).toBe("continue_with_clarification");
    expect(mapInterventionIntentToAction("switch_profile")).toBe("switch_profile_and_retry");
    expect(mapInterventionIntentToAction("pair_mode")).toBe("escalate_to_pair_mode");
  });
});
