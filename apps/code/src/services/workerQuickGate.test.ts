import {
  CODE_RUNTIME_RPC_CONTRACT_VERSION,
  CODE_RUNTIME_RPC_ERROR_CODES,
  CODE_RUNTIME_RPC_FEATURES,
  CODE_RUNTIME_RPC_FREEZE_EFFECTIVE_AT,
  computeCodeRuntimeRpcMethodSetHash,
} from "@ku0/code-runtime-host-contract";
import { CODE_RUNTIME_RPC_COMPAT_FIELD_ALIASES } from "@ku0/code-runtime-host-contract/codeRuntimeRpcCompat";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const invokeMock = vi.fn();
const isTauriMock = vi.fn(() => false);
const listenMock = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: invokeMock,
  isTauri: isTauriMock,
}));

vi.mock("../application/runtime/ports/tauriEvent", () => ({
  listen: listenMock,
}));

function expectedWsEndpoint(path: string, token?: string): string {
  const expected = new URL(path, window.location.origin);
  expected.protocol = expected.protocol === "https:" ? "wss:" : "ws:";
  if (token) {
    expected.searchParams.set("token", token);
  }
  return expected.toString();
}

function createFrozenCapabilities(methods: string[]) {
  return {
    contractVersion: CODE_RUNTIME_RPC_CONTRACT_VERSION,
    freezeEffectiveAt: CODE_RUNTIME_RPC_FREEZE_EFFECTIVE_AT,
    methodSetHash: computeCodeRuntimeRpcMethodSetHash(methods),
    methods,
    features: [...CODE_RUNTIME_RPC_FEATURES],
    errorCodes: { ...CODE_RUNTIME_RPC_ERROR_CODES },
    compatFieldAliases: { ...CODE_RUNTIME_RPC_COMPAT_FIELD_ALIASES },
  };
}

async function flushAsyncWork() {
  for (let index = 0; index < 4; index += 1) {
    await Promise.resolve();
  }
  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

describe("web worker quick gate", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    isTauriMock.mockReturnValue(false);
    listenMock.mockResolvedValue(vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("resolves relative websocket rpc endpoints in runtime client", async () => {
    vi.stubEnv("VITE_CODE_RUNTIME_GATEWAY_WEB_ENDPOINT", "/__code_runtime_rpc");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: unknown, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body ?? "{}")) as { method?: string };
        if (body.method === "code_rpc_capabilities") {
          return new Response(
            JSON.stringify({
              ok: true,
              result: {
                ...createFrozenCapabilities(["code_workspaces_list"]),
                transports: {
                  ws: {
                    channel: "duplex",
                    endpointPath: "/ws",
                    protocol: "runtime-ws-v1",
                    replay: {
                      mode: "query",
                      key: "lastEventId",
                    },
                  },
                },
              },
            }),
            { status: 200 }
          );
        }
        return new Response(JSON.stringify({ ok: true, result: [] }), { status: 200 });
      })
    );

    type MessageListener = ((event: { data: unknown }) => void) | null;
    type BasicListener = ((event: Event) => void) | null;
    class MockWebSocket {
      static instances: MockWebSocket[] = [];
      onopen: BasicListener = null;
      onmessage: MessageListener = null;
      onclose: ((event: CloseEvent) => void) | null = null;
      onerror: BasicListener = null;

      constructor(public readonly url: string | URL) {
        MockWebSocket.instances.push(this);
        queueMicrotask(() => {
          this.onopen?.({} as Event);
        });
      }

      send(payload: string) {
        const request = JSON.parse(payload) as {
          type?: string;
          id?: string;
          method?: string;
        };
        if (request.type !== "rpc.request" || request.method !== "code_workspaces_list") {
          return;
        }
        queueMicrotask(() => {
          this.onmessage?.({
            data: JSON.stringify({
              type: "rpc.response",
              id: request.id,
              ok: true,
              result: [],
            }),
          });
        });
      }

      close() {
        // noop
      }
    }

    vi.stubGlobal("WebSocket", MockWebSocket as unknown as typeof WebSocket);

    const runtimeClient = await import("./runtimeClient");
    const client = runtimeClient.getRuntimeClient();
    await expect(client.workspaces()).resolves.toEqual([]);
    expect(MockWebSocket.instances).toHaveLength(1);
    expect(String(MockWebSocket.instances[0]?.url)).toBe(expectedWsEndpoint("/ws"));
  });

  it("resolves relative websocket events endpoints in app server bridge", async () => {
    vi.stubEnv("VITE_CODE_RUNTIME_GATEWAY_WEB_ENDPOINT", "/__code_runtime_rpc?token=test#anchor");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          ok: true,
          result: {
            methods: ["code_workspaces_list"],
            transports: {
              events: { endpointPath: "/events" },
              ws: { endpointPath: "/ws" },
            },
          },
        }),
      } as Response)
    );

    class MockEventSource {
      static instances: MockEventSource[] = [];
      constructor(public readonly url: string | URL) {
        MockEventSource.instances.push(this);
      }
      close() {
        // noop
      }
    }

    class MockWebSocket {
      static instances: MockWebSocket[] = [];
      onopen: ((event: Event) => void) | null = null;
      onmessage: ((event: MessageEvent<unknown>) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;
      onclose: ((event: CloseEvent) => void) | null = null;
      constructor(public readonly url: string | URL) {
        MockWebSocket.instances.push(this);
      }
      close() {
        // noop
      }
    }

    vi.stubGlobal("EventSource", MockEventSource as unknown as typeof EventSource);
    vi.stubGlobal("WebSocket", MockWebSocket as unknown as typeof WebSocket);

    const events = await import("./events");
    const unsubscribe = events.subscribeAppServerEvents(() => undefined);
    await flushAsyncWork();

    expect(MockWebSocket.instances).toHaveLength(1);
    expect(String(MockWebSocket.instances[0]?.url)).toBe(expectedWsEndpoint("/ws", "test"));
    expect(MockEventSource.instances).toHaveLength(0);
    unsubscribe();
  });

  it("resolves relative websocket turn stream endpoints in tauri web fallback", async () => {
    listenMock.mockRejectedValueOnce(new Error("tauri event bridge unavailable"));
    vi.stubEnv("VITE_CODE_RUNTIME_GATEWAY_WEB_ENDPOINT", "/__code_runtime_rpc?token=test#anchor");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            ok: true,
            result: {
              methods: ["code_workspaces_list"],
              transports: {
                ws: {
                  channel: "duplex",
                  endpointPath: "/ws",
                  protocol: "runtime-ws-v1",
                  replay: { mode: "query", key: "lastEventId" },
                },
              },
            },
          }),
          { status: 200 }
        )
      )
    );

    class MockWebSocket {
      static instances: MockWebSocket[] = [];
      onopen: ((event: Event) => void) | null = null;
      onmessage: ((event: { data: unknown }) => void) | null = null;
      onclose: ((event: CloseEvent) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;
      constructor(public readonly url: string) {
        MockWebSocket.instances.push(this);
      }
      close(): void {
        // noop
      }
    }

    vi.stubGlobal("WebSocket", MockWebSocket as unknown as typeof WebSocket);
    vi.stubGlobal("EventSource", undefined);

    const tauri = await import("./tauri");
    const unlisten = await tauri.listenRuntimeTurnEvents(() => undefined);
    expect(MockWebSocket.instances).toHaveLength(1);
    expect(MockWebSocket.instances[0]?.url).toBe(expectedWsEndpoint("/ws", "test"));
    unlisten();
  });
});
