import { describe, expect, it } from "vitest";
import { joinClassNames } from "./classNames";

describe("joinClassNames", () => {
  it("delegates to the shared classNames helper for arrays and object maps", () => {
    expect(joinClassNames("base", ["nested", undefined], { active: true, hidden: false })).toBe(
      "base nested active"
    );
  });
});
