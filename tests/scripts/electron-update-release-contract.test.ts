import { describe, expect, it } from "vitest";
import { isElectronPackagedAppAsarPath } from "../../scripts/lib/electron-update-release-contract.mjs";

describe("isElectronPackagedAppAsarPath", () => {
  it("matches the macOS packaged app layout", () => {
    expect(
      isElectronPackagedAppAsarPath("HugeCode-darwin-x64/HugeCode.app/Contents/Resources/app.asar")
    ).toBe(true);
  });

  it("matches the linux packaged app layout", () => {
    expect(isElectronPackagedAppAsarPath("HugeCode-linux-x64/resources/app.asar")).toBe(true);
  });

  it("matches the windows packaged app layout", () => {
    expect(isElectronPackagedAppAsarPath("HugeCode-win32-x64/resources/app.asar")).toBe(true);
  });

  it("rejects unrelated files under the out directory", () => {
    expect(
      isElectronPackagedAppAsarPath("HugeCode-darwin-x64/HugeCode.app/Contents/Resources/helper")
    ).toBe(false);
    expect(isElectronPackagedAppAsarPath("HugeCode-linux-x64/resources/default_app.asar")).toBe(
      false
    );
  });
});
