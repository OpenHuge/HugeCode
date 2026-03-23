import { describe, expect, it } from "vitest";
import { isSafeExternalUrl, toSafeExternalUrl } from "../externalUrls";

describe("externalUrls", () => {
  it("accepts supported absolute external URLs", () => {
    expect(toSafeExternalUrl("https://example.com/docs")).toBe("https://example.com/docs");
    expect(toSafeExternalUrl("http://127.0.0.1:8788/auth/callback")).toBe(
      "http://127.0.0.1:8788/auth/callback"
    );
    expect(toSafeExternalUrl("mailto:team@example.com")).toBe("mailto:team@example.com");
    expect(isSafeExternalUrl(" https://example.com/releases ")).toBe(true);
  });

  it("rejects unsupported or malformed URL schemes", () => {
    expect(toSafeExternalUrl("")).toBeNull();
    expect(toSafeExternalUrl("javascript:alert(1)")).toBeNull();
    expect(toSafeExternalUrl("data:text/html,<script>alert(1)</script>")).toBeNull();
    expect(toSafeExternalUrl("file:///tmp/secret.txt")).toBeNull();
    expect(toSafeExternalUrl("/relative/path")).toBeNull();
    expect(isSafeExternalUrl("not a url")).toBe(false);
  });
});
