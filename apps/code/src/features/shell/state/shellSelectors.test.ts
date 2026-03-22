import { describe, expect, it } from "vitest";
import { getPhoneTabDisabledReason, getPhoneTabSelection } from "./shellSelectors";

describe("shellSelectors", () => {
  it("returns disabled reason for phone missions/review tabs without workspace", () => {
    expect(getPhoneTabDisabledReason("missions", false)).toBe(
      "Select or connect a workspace to use this tab."
    );
    expect(getPhoneTabDisabledReason("review", false)).toBe(
      "Select or connect a workspace to use this tab."
    );
    expect(getPhoneTabDisabledReason("home", false)).toBeNull();
  });

  it("routes phone missions/review tab selections to workspaces when workspace is missing", () => {
    expect(getPhoneTabSelection("missions", false)).toBe("workspaces");
    expect(getPhoneTabSelection("review", false)).toBe("workspaces");
    expect(getPhoneTabSelection("home", false)).toBe("home");
  });
});
