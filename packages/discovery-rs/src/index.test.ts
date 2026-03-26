import { describe, expect, it } from "vitest";
import { getNativeDiscovery, getNativeDiscoveryError } from "./index";

describe("discovery-rs browser fallback", () => {
  it("returns a stable null binding and browser error", () => {
    expect(getNativeDiscovery()).toBeNull();
    expect(getNativeDiscoveryError()).toBeInstanceOf(Error);
    expect(getNativeDiscoveryError()?.message).toContain("not available in browser");
  });
});
