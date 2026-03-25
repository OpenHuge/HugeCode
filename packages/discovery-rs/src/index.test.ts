import { describe, expect, it } from "vitest";
import { getNativeDiscovery, getNativeDiscoveryError } from "./index";

describe("@ku0/discovery-rs browser-safe entrypoint", () => {
  it("returns a null binding in browser-safe mode", () => {
    expect(getNativeDiscovery()).toBeNull();
  });

  it("returns the stable browser-safe error", () => {
    const error = getNativeDiscoveryError();

    expect(error).toBeInstanceOf(Error);
    expect(error?.message).toContain("not available in browser");
  });
});
