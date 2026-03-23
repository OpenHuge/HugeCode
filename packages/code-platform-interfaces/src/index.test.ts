import { describe, expect, it } from "vitest";
import { isElectronDesktopHostBridge } from "./index";

describe("code-platform-interfaces", () => {
  it("recognizes the supported electron bridge kind", () => {
    expect(isElectronDesktopHostBridge({ kind: "electron" })).toBe(true);
  });

  it("rejects missing or unsupported bridge kinds", () => {
    expect(isElectronDesktopHostBridge(null)).toBe(false);
    expect(isElectronDesktopHostBridge({ kind: "electron-legacy" })).toBe(false);
    expect(isElectronDesktopHostBridge({})).toBe(false);
  });
});
