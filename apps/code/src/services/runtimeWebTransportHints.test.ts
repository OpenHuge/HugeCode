import { afterEach, describe, expect, it, vi } from "vitest";

async function importRuntimeWebTransportHints() {
  vi.resetModules();
  return import("./runtimeWebTransportHints");
}

describe("runtimeWebTransportHints", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("uses explicit transport endpoints without probing capabilities", async () => {
    vi.stubEnv("VITE_CODE_RUNTIME_GATEWAY_WEB_ENDPOINT", "https://runtime.example.com/rpc");
    vi.stubEnv(
      "VITE_CODE_RUNTIME_GATEWAY_WEB_EVENTS_ENDPOINT",
      "https://runtime.example.com/events"
    );
    vi.stubEnv("VITE_CODE_RUNTIME_GATEWAY_WEB_WS_ENDPOINT", "https://runtime.example.com/ws");
    vi.stubEnv("VITE_CODE_RUNTIME_GATEWAY_WEB_AUTH_TOKEN", "token-123");

    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { resolveWebTransportEndpointHints } = await importRuntimeWebTransportHints();
    const hints = await resolveWebTransportEndpointHints({ cacheTtlMs: 60_000, nowMs: 1_000 });

    expect(hints).toEqual({
      eventsEndpoint: "https://runtime.example.com/events?token=token-123",
      wsEndpoint: "wss://runtime.example.com/ws?token=token-123",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("probes rpc capabilities and resolves transport endpoint paths", async () => {
    vi.stubEnv("VITE_CODE_RUNTIME_GATEWAY_WEB_ENDPOINT", "https://runtime.example.com/rpc");
    vi.stubEnv("VITE_CODE_RUNTIME_GATEWAY_WEB_AUTH_TOKEN", "token-abc");

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        result: {
          transports: {
            events: {
              endpointPath: "/stream/events",
            },
            ws: {
              endpointPath: "ws",
            },
          },
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { resolveWebTransportEndpointHints } = await importRuntimeWebTransportHints();
    const hints = await resolveWebTransportEndpointHints({ cacheTtlMs: 0 });

    expect(hints).toEqual({
      eventsEndpoint: "https://runtime.example.com/stream/events?token=token-abc",
      wsEndpoint: "wss://runtime.example.com/ws?token=token-abc",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://runtime.example.com/rpc",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "x-code-runtime-auth-token": "token-abc",
        }),
      })
    );
  });

  it("reuses cached hints when cache ttl is enabled", async () => {
    vi.stubEnv("VITE_CODE_RUNTIME_GATEWAY_WEB_ENDPOINT", "https://runtime.example.com/rpc");

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        result: {
          transports: {
            events: { endpointPath: "/events" },
            ws: { endpointPath: "/ws" },
          },
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { resolveWebTransportEndpointHints } = await importRuntimeWebTransportHints();
    await resolveWebTransportEndpointHints({ cacheTtlMs: 60_000, nowMs: 1_000 });
    await resolveWebTransportEndpointHints({ cacheTtlMs: 60_000, nowMs: 1_500 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("skips cache when cache ttl is disabled", async () => {
    vi.stubEnv("VITE_CODE_RUNTIME_GATEWAY_WEB_ENDPOINT", "https://runtime.example.com/rpc");

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        result: {
          transports: {
            events: { endpointPath: "/events" },
            ws: { endpointPath: "/ws" },
          },
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { resolveWebTransportEndpointHints } = await importRuntimeWebTransportHints();
    await resolveWebTransportEndpointHints({ cacheTtlMs: 0 });
    await resolveWebTransportEndpointHints({ cacheTtlMs: 0 });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
