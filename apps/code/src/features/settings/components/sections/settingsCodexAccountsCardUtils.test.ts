import { describe, expect, it } from "vitest";
import {
  buildProviderOptionsFromCatalog,
  buildProviderOptionsFromState,
  canonicalDefaultPoolId,
  formatError,
  isPoolVersionMismatchError,
  POOL_VERSION_MISMATCH_CODE,
  readErrorCode,
} from "./settingsCodexAccountsCardUtils";

describe("settingsCodexAccountsCardUtils", () => {
  it("maps providers to canonical default pool ids", () => {
    expect(canonicalDefaultPoolId("codex")).toBe("pool-codex");
    expect(canonicalDefaultPoolId("gemini")).toBe("pool-gemini");
    expect(canonicalDefaultPoolId("claude_code")).toBe("pool-claude");
  });

  it("surfaces gemini and antigravity brands from runtime catalog aliases", () => {
    expect(
      buildProviderOptionsFromCatalog([
        {
          providerId: "google",
          oauthProviderId: "gemini",
          displayName: "Google",
          pool: "gemini",
          aliases: ["google", "gemini", "antigravity", "anti-gravity", "gemini-antigravity"],
          defaultModelId: "gemini-3.1-pro",
          available: true,
          supportsNative: true,
          supportsOpenaiCompat: true,
          registryVersion: "2026-03-15",
        },
      ]).map((option) => ({
        id: option.id,
        routeProviderId: option.routeProviderId,
        label: option.label,
      }))
    ).toEqual([
      { id: "gemini", routeProviderId: "gemini", label: "Gemini" },
      { id: "antigravity", routeProviderId: "gemini", label: "Antigravity" },
    ]);
  });

  it("keeps antigravity visible when only gemini-backed state is available", () => {
    expect(
      buildProviderOptionsFromState(
        [
          {
            accountId: "acct-gemini-1",
            provider: "gemini",
            externalAccountId: null,
            email: "gemini@example.com",
            displayName: "Gemini",
            status: "enabled",
            disabledReason: null,
            routeConfig: null,
            routingState: null,
            chatgptWorkspaces: null,
            defaultChatgptWorkspaceId: null,
            metadata: {},
            createdAt: 1,
            updatedAt: 2,
          },
        ],
        []
      ).map((option) => option.id)
    ).toContain("antigravity");
  });

  it("reads nested error codes", () => {
    const error = {
      details: {
        error: {
          code: "runtime.validation.request.blocked",
        },
      },
    };
    expect(readErrorCode(error)).toBe("runtime.validation.request.blocked");
  });

  it("reads nested error messages for display fallbacks", () => {
    const error = {
      details: {
        error: {
          message: "Nested provider error.",
        },
      },
    };

    expect(formatError(error, "fallback")).toBe("Nested provider error.");
  });

  it("detects pool version mismatch by stable code", () => {
    expect(
      isPoolVersionMismatchError({
        code: POOL_VERSION_MISMATCH_CODE,
        message: "Pool revision mismatch",
      })
    ).toBe(true);
  });

  it("does not treat legacy prefix-only message as mismatch", () => {
    expect(isPoolVersionMismatchError(new Error("POOL_VERSION_MISMATCH:pool-codex:12"))).toBe(
      false
    );
  });

  it("returns false for unrelated errors", () => {
    expect(
      isPoolVersionMismatchError({
        code: "runtime.validation.request.blocked",
        message: "blocked",
      })
    ).toBe(false);
  });
});
