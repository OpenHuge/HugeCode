import { describe, expect, it } from "vitest";
import {
  getDefaultPrimaryPoolIdForProvider,
  getDefaultPrimaryPoolNameForProvider,
  isDefaultPrimaryPoolForProvider,
} from "./tauriOauthBridgePrimaryPool";

describe("tauriOauthBridgePrimaryPool", () => {
  it("maps canonical providers to stable default pool ids", () => {
    expect(getDefaultPrimaryPoolIdForProvider("codex")).toBe("pool-codex");
    expect(getDefaultPrimaryPoolIdForProvider("gemini")).toBe("pool-gemini");
    expect(getDefaultPrimaryPoolIdForProvider("claude_code")).toBe("pool-claude");
  });

  it("keeps unknown providers routable through a deterministic fallback id", () => {
    expect(getDefaultPrimaryPoolIdForProvider("chatgpt")).toBe("pool-chatgpt");
  });

  it("maps canonical providers to user-facing default pool names", () => {
    expect(getDefaultPrimaryPoolNameForProvider("codex")).toBe("Codex Pool");
    expect(getDefaultPrimaryPoolNameForProvider("gemini")).toBe("Gemini Pool");
    expect(getDefaultPrimaryPoolNameForProvider("claude_code")).toBe("Claude Pool");
    expect(getDefaultPrimaryPoolNameForProvider("chatgpt")).toBe("OAuth Pool");
  });

  it("matches providers against their canonical default primary pool ids", () => {
    expect(isDefaultPrimaryPoolForProvider({ provider: "codex", poolId: "pool-codex" })).toBe(true);
    expect(isDefaultPrimaryPoolForProvider({ provider: "gemini", poolId: "pool-gemini" })).toBe(
      true
    );
    expect(
      isDefaultPrimaryPoolForProvider({ provider: "claude_code", poolId: "pool-claude" })
    ).toBe(true);
    expect(isDefaultPrimaryPoolForProvider({ provider: "codex", poolId: "pool-gemini" })).toBe(
      false
    );
  });
});
