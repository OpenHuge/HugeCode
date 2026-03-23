import { describe, expect, it } from "vitest";
import { createDesktopRendererTrust } from "./desktopRendererTrust.js";

describe("desktopRendererTrust", () => {
  it("trusts file renderers and the configured dev server origin", () => {
    const trust = createDesktopRendererTrust({
      rendererDevServerUrl: "http://127.0.0.1:5187/",
    });

    expect(trust.isTrustedRendererUrl("file:///tmp/HugeCode/index.html")).toBe(true);
    expect(trust.isTrustedRendererUrl("http://127.0.0.1:5187/workspace")).toBe(true);
    expect(trust.isTrustedRendererUrl("http://127.0.0.1:4173/workspace")).toBe(false);
    expect(trust.isTrustedRendererUrl("https://example.com")).toBe(false);
  });

  it("only allows safe external protocols", () => {
    const trust = createDesktopRendererTrust({
      rendererDevServerUrl: null,
    });

    expect(trust.isSafeExternalUrl("https://example.com")).toBe(true);
    expect(trust.isSafeExternalUrl("mailto:hello@example.com")).toBe(true);
    expect(trust.isSafeExternalUrl("javascript:alert(1)")).toBe(false);
    expect(trust.isSafeExternalUrl("data:text/plain,hello")).toBe(false);
  });
});
