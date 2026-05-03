import { describe, expect, it } from "vitest";
import {
  createT3CodexRelayRoute,
  listT3CodexRelayProviders,
  resolveT3CodexRelayBackendId,
} from "./t3CodexRelayAssistant";

describe("t3CodexRelayAssistant", () => {
  it("lists TokenFlux as an env-backed built-in Codex relay", () => {
    const [tokenFlux] = listT3CodexRelayProviders();

    expect(tokenFlux).toEqual(
      expect.objectContaining({
        id: "tokenflux",
        baseUrl: "https://tokenflux.dev/v1",
        envKey: "TOKENFLUX_API_KEY",
        readinessLabel: "runtime env",
      })
    );
  });

  it("creates an embedded Codex route without token material", () => {
    const tokenFlux = listT3CodexRelayProviders()[0];
    if (!tokenFlux) {
      throw new Error("Expected TokenFlux provider.");
    }
    const route = createT3CodexRelayRoute(tokenFlux);

    expect(route).toMatchObject({
      backendId: "codex-app-server-tokenflux",
      provider: "codex",
      status: "ready",
    });
    expect(JSON.stringify(route)).not.toContain("TOKENFLUX_API_KEY=");
  });

  it("resolves custom relay backend ids with the adapter provider id mapping", () => {
    const customRelay = listT3CodexRelayProviders().find((provider) => provider.id === "custom");
    if (!customRelay) {
      throw new Error("Expected custom relay provider.");
    }

    expect(resolveT3CodexRelayBackendId("custom")).toBe("codex-app-server-custom_relay");
    expect(createT3CodexRelayRoute(customRelay).backendId).toBe(
      resolveT3CodexRelayBackendId("custom")
    );
  });
});
