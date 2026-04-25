import { describe, expect, it } from "vitest";
import {
  CODEX_HUGEROUTER_ROUTE_TOKEN_ENV,
  buildCodexHugeRouterRuntimeProfile,
  normalizeHugeRouterCodexBaseUrl,
} from "./codexHugeRouterRuntimeProfile";

describe("codexHugeRouterRuntimeProfile", () => {
  it("builds a Codex provider config for the HugeRouter Responses gateway", () => {
    const profile = buildCodexHugeRouterRuntimeProfile({
      baseUrl: "https://router.openhuge.example/v1/",
      model: "reasoning-fast",
      routeToken: "hgrt_test_123",
    });

    expect(profile).toMatchObject({
      model: "reasoning-fast",
      modelProvider: "hugerouter",
      disableResponseStorage: true,
      provider: {
        providerId: "hugerouter",
        providerName: "HugeRouter",
        baseUrl: "https://router.openhuge.example/v1",
        envKey: CODEX_HUGEROUTER_ROUTE_TOKEN_ENV,
        wireApi: "responses",
      },
      environment: {
        [CODEX_HUGEROUTER_ROUTE_TOKEN_ENV]: "hgrt_test_123",
      },
    });
    expect(profile.configToml).toContain('model_provider = "hugerouter"');
    expect(profile.configToml).toContain('wire_api = "responses"');
    expect(profile.configToml).toContain('env_key = "HUGEROUTER_ROUTE_TOKEN"');
    expect(profile.configToml).not.toContain("hgrt_test_123");
  });

  it("keeps custom route-token env names out of persisted config values", () => {
    const profile = buildCodexHugeRouterRuntimeProfile({
      baseUrl: "http://127.0.0.1:8787/v1",
      model: "agent-coding-default",
      routeToken: "secret-route-token",
      routeTokenEnvKey: "OPENHUGE_ROUTE_TOKEN",
      providerId: "openhuge",
      providerName: "OpenHuge Router",
      disableResponseStorage: false,
    });

    expect(profile.environment).toEqual({
      OPENHUGE_ROUTE_TOKEN: "secret-route-token",
    });
    expect(profile.configToml).toContain('model_provider = "openhuge"');
    expect(profile.configToml).toContain('env_key = "OPENHUGE_ROUTE_TOKEN"');
    expect(profile.configToml).toContain("disable_response_storage = false");
    expect(profile.configToml).not.toContain("secret-route-token");
  });

  it("normalizes HugeRouter gateway roots without query or hash material", () => {
    expect(normalizeHugeRouterCodexBaseUrl("https://router.example/v1/?debug=true#frag")).toBe(
      "https://router.example/v1"
    );
  });

  it("rejects operation endpoints that would make Codex append the wrong path", () => {
    expect(() => normalizeHugeRouterCodexBaseUrl("https://router.example/v1/responses")).toThrow(
      "operation endpoint"
    );
    expect(() =>
      normalizeHugeRouterCodexBaseUrl("https://router.example/v1/chat/completions")
    ).toThrow("operation endpoint");
  });

  it("rejects invalid provider ids and environment variable names", () => {
    expect(() =>
      buildCodexHugeRouterRuntimeProfile({
        baseUrl: "https://router.example/v1",
        model: "reasoning-fast",
        routeToken: "token",
        providerId: "HugeRouter",
      })
    ).toThrow("providerId");

    expect(() =>
      buildCodexHugeRouterRuntimeProfile({
        baseUrl: "https://router.example/v1",
        model: "reasoning-fast",
        routeToken: "token",
        routeTokenEnvKey: "hugerouter_token",
      })
    ).toThrow("routeTokenEnvKey");
  });
});
