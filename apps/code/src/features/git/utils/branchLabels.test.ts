import { describe, expect, it } from "vitest";
import { resolveBranchDisplayLabel, resolveCurrentBranchName } from "./branchLabels";

describe("branchLabels", () => {
  it("returns the branch name when one is available", () => {
    expect(
      resolveBranchDisplayLabel({
        branchName: "feature/header-copy",
        hasBranchContext: true,
        context: "header",
      })
    ).toBe("feature/header-copy");
  });

  it("treats unknown and empty names as missing", () => {
    expect(resolveCurrentBranchName("unknown")).toBeNull();
    expect(resolveCurrentBranchName("   ")).toBeNull();
  });

  it("shows no branch when git context exists without a current branch", () => {
    expect(
      resolveBranchDisplayLabel({
        branchName: "unknown",
        hasBranchContext: true,
        context: "panel",
      })
    ).toBe("No branch");
  });

  it("shows no git repo in header when git context is missing", () => {
    expect(
      resolveBranchDisplayLabel({
        branchName: "",
        hasBranchContext: false,
        context: "header",
      })
    ).toBe("No git repo");
  });

  it("shows git unavailable in panel when git context is missing", () => {
    expect(
      resolveBranchDisplayLabel({
        branchName: "",
        hasBranchContext: false,
        context: "panel",
      })
    ).toBe("Git unavailable");
  });
});
