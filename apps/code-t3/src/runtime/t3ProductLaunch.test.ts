import { describe, expect, it } from "vitest";
import {
  createT3ProductShareCode,
  parseT3ProductShareCode,
  summarizeT3ProductRouteReadiness,
  T3_PRODUCT_SHARE_PREFIX,
} from "./t3ProductLaunch";

describe("t3ProductLaunch", () => {
  it("round-trips a bilingual HugeRouter share code without raw credentials", () => {
    const code = createT3ProductShareCode({
      inviteCode: "团队-核心",
      locale: "zh",
      modelAlias: "代码助手-默认",
      relayBaseUrl: "https://hugerouter.openhuge.local/v1",
      relayKind: "hugerouter",
      routeTokenEnvKey: "HUGEROUTER_ROUTE_TOKEN",
      transport: "hugerouter",
    });

    expect(code.startsWith(T3_PRODUCT_SHARE_PREFIX)).toBe(true);
    expect(code).not.toContain("apiKey");
    expect(code).not.toContain("password");
    expect(parseT3ProductShareCode(code)).toEqual(
      expect.objectContaining({
        inviteCode: "团队-核心",
        locale: "zh",
        modelAlias: "代码助手-默认",
        relayKind: "hugerouter",
        transport: "hugerouter",
      })
    );
  });

  it("accepts a private network relay URL for Tailscale-style sharing", () => {
    const code = createT3ProductShareCode({
      inviteCode: "tailnet-alpha",
      locale: "en",
      modelAlias: "agent-coding-default",
      relayBaseUrl: "http://100.64.12.20:8788/v1/",
      relayKind: "tailscale",
      routeTokenEnvKey: "TAILNET_ROUTE_TOKEN",
      transport: "private-network",
    });

    expect(parseT3ProductShareCode(code)).toEqual(
      expect.objectContaining({
        relayBaseUrl: "http://100.64.12.20:8788/v1",
        relayKind: "tailscale",
        transport: "private-network",
      })
    );
  });

  it("rejects pasted payloads that contain raw secrets", () => {
    const payload = btoa(
      JSON.stringify({
        version: 1,
        product: "t3code",
        apiKey: "secret",
      })
    );

    expect(() => parseT3ProductShareCode(`${T3_PRODUCT_SHARE_PREFIX}${payload}`)).toThrow("apiKey");
  });

  it("summarizes independent-product route readiness", () => {
    expect(
      summarizeT3ProductRouteReadiness({
        hugeRouterConnected: true,
        relayBaseUrl: "https://relay.example/v1",
        routes: [
          {
            backendId: "codex-app-server-hugerouter",
            authState: "authenticated",
            capabilities: ["embedded_app_server"],
            installed: true,
            provider: "codex",
            status: "ready",
          },
          {
            backendId: "local-claude-code-cli",
            authState: "authenticated",
            capabilities: ["claude_code_local"],
            installed: true,
            provider: "claudeAgent",
            status: "ready",
          },
        ],
        shareCode: `${T3_PRODUCT_SHARE_PREFIX}abc`,
      })
    ).toEqual({
      arbitraryRelay: true,
      embeddedCodex: true,
      hugeRouterConnected: true,
      localClaude: true,
      localCodex: false,
      shareReady: true,
    });
  });

  it("does not mark blocked or unauthenticated routes as launch ready", () => {
    expect(
      summarizeT3ProductRouteReadiness({
        hugeRouterConnected: false,
        relayBaseUrl: "https://relay.example/v1",
        routes: [
          {
            backendId: "local-codex-cli",
            authState: "unauthenticated",
            capabilities: ["local_cli"],
            installed: true,
            provider: "codex",
            status: "ready",
          },
          {
            backendId: "local-claude-code-cli",
            authState: "authenticated",
            capabilities: ["claude_code_local"],
            installed: false,
            provider: "claudeAgent",
            status: "ready",
          },
          {
            backendId: "codex-app-server-custom",
            authState: "authenticated",
            capabilities: ["embedded_app_server"],
            installed: true,
            provider: "codex",
            status: "blocked",
          },
        ],
        shareCode: "",
      })
    ).toEqual({
      arbitraryRelay: true,
      embeddedCodex: false,
      hugeRouterConnected: false,
      localClaude: false,
      localCodex: false,
      shareReady: false,
    });
  });
});
