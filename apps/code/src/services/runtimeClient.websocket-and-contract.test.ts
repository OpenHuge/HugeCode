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
const isDesktopHostRuntimeMock = vi.fn();
const REQUIRED_CONTRACT_FROZEN_FEATURE = `contract_frozen_${CODE_RUNTIME_RPC_FREEZE_EFFECTIVE_AT.replaceAll("-", "_")}`;
const CANONICAL_WORKSPACES_METHOD = "code_workspaces_list";
const CANONICAL_WORKSPACES_METHOD_SET_HASH = computeCodeRuntimeRpcMethodSetHash([
  CANONICAL_WORKSPACES_METHOD,
]);

vi.mock("@desktop-host/core", () => ({
  invoke: invokeMock,
  isDesktopHostRuntime: isDesktopHostRuntimeMock,
}));

async function importRuntimeClientModule() {
  vi.resetModules();
  return import("./runtimeClient");
}

function clearDesktopHostMarkers() {
  const desktopHostWindow = window as Window & {
    __HUGE_CODE_DESKTOP_HOST__?: unknown;
    __HUGE_CODE_DESKTOP_HOST_INTERNALS__?: unknown;
    __HUGE_CODE_DESKTOP_HOST_IPC__?: unknown;
  };

  delete desktopHostWindow.__HUGE_CODE_DESKTOP_HOST__;
  delete desktopHostWindow.__HUGE_CODE_DESKTOP_HOST_INTERNALS__;
  delete desktopHostWindow.__HUGE_CODE_DESKTOP_HOST_IPC__;
}

function clearAgentRuntimeMarkers() {
  const runtimeWindow = window as Window & {
    __OPEN_WRAP_AGENT_RUNTIME_RPC__?: unknown;
    __KU_AGENT_RUNTIME_RPC__?: unknown;
    __AGENT_RUNTIME_RPC__?: unknown;
    agentRuntimeRpc?: unknown;
  };

  delete runtimeWindow.__OPEN_WRAP_AGENT_RUNTIME_RPC__;
  delete runtimeWindow.__KU_AGENT_RUNTIME_RPC__;
  delete runtimeWindow.__AGENT_RUNTIME_RPC__;
  delete runtimeWindow.agentRuntimeRpc;
}

const FROZEN_RUNTIME_RPC_CONTRACT_VERSION = CODE_RUNTIME_RPC_CONTRACT_VERSION;
const FROZEN_RUNTIME_RPC_FREEZE_EFFECTIVE_AT = CODE_RUNTIME_RPC_FREEZE_EFFECTIVE_AT;
const FROZEN_RUNTIME_RPC_REQUIRED_FEATURES = [...CODE_RUNTIME_RPC_FEATURES];
const FROZEN_RUNTIME_RPC_ERROR_CODES = CODE_RUNTIME_RPC_ERROR_CODES;
const FROZEN_RUNTIME_RPC_COMPAT_FIELD_ALIASES = CODE_RUNTIME_RPC_COMPAT_FIELD_ALIASES;

function createFrozenCapabilitiesPayload(
  overrides: Partial<{
    freezeEffectiveAt: string;
    methodSetHash: string;
    methods: string[];
    features: string[];
    errorCodes: Record<string, string>;
    compatFieldAliases: Record<string, string>;
  }> = {}
): Record<string, unknown> {
  const methods = overrides.methods ?? [CANONICAL_WORKSPACES_METHOD];
  const methodSetHash = overrides.methodSetHash ?? computeCodeRuntimeRpcMethodSetHash(methods);
  const features = overrides.features ?? [...FROZEN_RUNTIME_RPC_REQUIRED_FEATURES];
  const errorCodes = overrides.errorCodes ?? { ...FROZEN_RUNTIME_RPC_ERROR_CODES };
  const compatFieldAliases = overrides.compatFieldAliases ?? {
    ...FROZEN_RUNTIME_RPC_COMPAT_FIELD_ALIASES,
  };
  return {
    contractVersion: FROZEN_RUNTIME_RPC_CONTRACT_VERSION,
    freezeEffectiveAt: FROZEN_RUNTIME_RPC_FREEZE_EFFECTIVE_AT,
    ...overrides,
    methodSetHash,
    methods,
    features,
    errorCodes,
    compatFieldAliases,
  };
}

describe("runtimeClient mode detection", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    isDesktopHostRuntimeMock.mockReset();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    clearDesktopHostMarkers();
    clearAgentRuntimeMarkers();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    clearDesktopHostMarkers();
    clearAgentRuntimeMarkers();
  });

  it("prefers websocket rpc transport when capabilities expose ws endpoint", async () => {
    vi.stubEnv("VITE_CODE_RUNTIME_GATEWAY_WEB_ENDPOINT", "http://127.0.0.1:8788/rpc");
    isDesktopHostRuntimeMock.mockReturnValue(false);

    const fetchMock = vi.fn(async (_input: unknown, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as { method?: string };
      if (body.method === "code_rpc_capabilities") {
        return new Response(
          JSON.stringify({
            ok: true,
            result: {
              ...createFrozenCapabilitiesPayload({
                methods: [CANONICAL_WORKSPACES_METHOD],
              }),
              transports: {
                rpc: {
                  channel: "rpc",
                  endpointPath: "/rpc",
                  protocol: "json-rpc-over-http-v1",
                  replay: {
                    mode: "none",
                    key: null,
                  },
                },
                events: {
                  channel: "events",
                  endpointPath: "/events",
                  protocol: "sse-v1",
                  replay: {
                    mode: "header",
                    key: "Last-Event-ID",
                  },
                },
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
    });
    vi.stubGlobal("fetch", fetchMock);

    type MessageListener = ((event: { data: unknown }) => void) | null;
    type BasicListener = ((event: Event) => void) | null;
    class MockWebSocket {
      static instances: MockWebSocket[] = [];
      readonly sentPayloads: string[] = [];
      onopen: BasicListener = null;
      onmessage: MessageListener = null;
      onclose: ((event: CloseEvent) => void) | null = null;
      onerror: BasicListener = null;
      closed = false;

      constructor(public readonly url: string | URL) {
        MockWebSocket.instances.push(this);
        queueMicrotask(() => {
          this.onopen?.({} as Event);
        });
      }

      send(payload: string) {
        this.sentPayloads.push(payload);
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
              result: [
                {
                  id: "workspace-ws",
                  path: "/tmp/workspace-ws",
                  displayName: "WebSocket Workspace",
                  connected: true,
                  defaultModelId: "gpt-5.3-codex",
                },
              ],
            }),
          });
        });
      }

      close() {
        this.closed = true;
      }
    }

    vi.stubGlobal("WebSocket", MockWebSocket as unknown as typeof WebSocket);

    const runtime = await importRuntimeClientModule();
    const client = runtime.getRuntimeClient();

    await expect(client.workspaces()).resolves.toEqual([
      {
        id: "workspace-ws",
        path: "/tmp/workspace-ws",
        displayName: "WebSocket Workspace",
        connected: true,
        defaultModelId: "gpt-5.3-codex",
      },
    ]);

    expect(MockWebSocket.instances).toHaveLength(1);
    expect(String(MockWebSocket.instances[0]?.url)).toBe("ws://127.0.0.1:8788/ws");
    expect(JSON.parse(MockWebSocket.instances[0]?.sentPayloads[0] ?? "{}")).toMatchObject({
      type: "rpc.request",
      method: "code_workspaces_list",
    });

    const calledMethods = fetchMock.mock.calls.map(
      ([, init]) => JSON.parse(String((init as RequestInit | undefined)?.body ?? "{}")).method
    );
    expect(calledMethods).toEqual(["code_rpc_capabilities"]);
  });

  it("injects runtime auth token into web rpc headers and websocket query", async () => {
    vi.stubEnv("VITE_CODE_RUNTIME_GATEWAY_WEB_ENDPOINT", "http://127.0.0.1:8788/rpc");
    vi.stubEnv("VITE_CODE_RUNTIME_GATEWAY_WEB_AUTH_TOKEN", "runtime-auth-123");
    isDesktopHostRuntimeMock.mockReturnValue(false);

    const fetchMock = vi.fn(async (_input: unknown, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as { method?: string };
      if (body.method === "code_rpc_capabilities") {
        return new Response(
          JSON.stringify({
            ok: true,
            result: {
              ...createFrozenCapabilitiesPayload({
                methods: [CANONICAL_WORKSPACES_METHOD],
              }),
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
    });
    vi.stubGlobal("fetch", fetchMock);

    type MessageListener = ((event: { data: unknown }) => void) | null;
    type BasicListener = ((event: Event) => void) | null;
    class MockWebSocket {
      static instances: MockWebSocket[] = [];
      readonly sentPayloads: string[] = [];
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
        this.sentPayloads.push(payload);
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
    }

    vi.stubGlobal("WebSocket", MockWebSocket as unknown as typeof WebSocket);

    const runtime = await importRuntimeClientModule();
    const client = runtime.getRuntimeClient();
    await expect(client.workspaces()).resolves.toEqual([]);

    const headers = (fetchMock.mock.calls[0]?.[1] as RequestInit | undefined)?.headers as
      | Record<string, string>
      | undefined;
    expect(headers?.["x-code-runtime-auth-token"]).toBe("runtime-auth-123");
    expect(String(MockWebSocket.instances[0]?.url)).toBe(
      "ws://127.0.0.1:8788/ws?token=runtime-auth-123"
    );
  });

  it("resolves relative websocket rpc endpoint against current origin for worker deployments", async () => {
    vi.stubEnv("VITE_CODE_RUNTIME_GATEWAY_WEB_ENDPOINT", "/__code_runtime_rpc");
    isDesktopHostRuntimeMock.mockReturnValue(false);

    const fetchMock = vi.fn(async (_input: unknown, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as { method?: string };
      if (body.method === "code_rpc_capabilities") {
        return new Response(
          JSON.stringify({
            ok: true,
            result: {
              ...createFrozenCapabilitiesPayload({
                methods: [CANONICAL_WORKSPACES_METHOD],
              }),
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
    });
    vi.stubGlobal("fetch", fetchMock);

    type MessageListener = ((event: { data: unknown }) => void) | null;
    type BasicListener = ((event: Event) => void) | null;
    class MockWebSocket {
      static instances: MockWebSocket[] = [];
      readonly sentPayloads: string[] = [];
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
        this.sentPayloads.push(payload);
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

    const runtime = await importRuntimeClientModule();
    const client = runtime.getRuntimeClient();

    await expect(client.workspaces()).resolves.toEqual([]);

    const expected = new URL("/ws", window.location.origin);
    expected.protocol = expected.protocol === "https:" ? "wss:" : "ws:";
    expect(MockWebSocket.instances).toHaveLength(1);
    expect(String(MockWebSocket.instances[0]?.url)).toBe(expected.toString());
  });

  it("reuses websocket rpc connection across sequential web runtime calls", async () => {
    vi.stubEnv("VITE_CODE_RUNTIME_GATEWAY_WEB_ENDPOINT", "http://127.0.0.1:8788/rpc");
    isDesktopHostRuntimeMock.mockReturnValue(false);

    const fetchMock = vi.fn(async (_input: unknown, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as { method?: string };
      if (body.method === "code_rpc_capabilities") {
        return new Response(
          JSON.stringify({
            ok: true,
            result: {
              ...createFrozenCapabilitiesPayload({
                methods: [CANONICAL_WORKSPACES_METHOD],
              }),
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
    });
    vi.stubGlobal("fetch", fetchMock);

    type MessageListener = ((event: { data: unknown }) => void) | null;
    type BasicListener = ((event: Event) => void) | null;
    class MockWebSocket {
      static instances: MockWebSocket[] = [];
      readonly sentPayloads: string[] = [];
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
        this.sentPayloads.push(payload);
        const request = JSON.parse(payload) as { id?: string; method?: string; type?: string };
        if (request.type !== "rpc.request" || request.method !== "code_workspaces_list") {
          return;
        }
        queueMicrotask(() => {
          this.onmessage?.({
            data: JSON.stringify({
              type: "rpc.response",
              id: request.id,
              ok: true,
              result: [
                {
                  id: "workspace-ws-shared",
                  path: "/tmp/workspace-ws-shared",
                  displayName: "Shared WS Workspace",
                  connected: true,
                  defaultModelId: null,
                },
              ],
            }),
          });
        });
      }

      close() {
        // noop
      }
    }

    vi.stubGlobal("WebSocket", MockWebSocket as unknown as typeof WebSocket);

    const runtime = await importRuntimeClientModule();
    const client = runtime.getRuntimeClient();

    await expect(client.workspaces()).resolves.toEqual([
      {
        id: "workspace-ws-shared",
        path: "/tmp/workspace-ws-shared",
        displayName: "Shared WS Workspace",
        connected: true,
        defaultModelId: null,
      },
    ]);
    await expect(client.workspaces()).resolves.toEqual([
      {
        id: "workspace-ws-shared",
        path: "/tmp/workspace-ws-shared",
        displayName: "Shared WS Workspace",
        connected: true,
        defaultModelId: null,
      },
    ]);

    expect(MockWebSocket.instances).toHaveLength(1);
    expect(MockWebSocket.instances[0]?.sentPayloads).toHaveLength(2);
    expect(
      MockWebSocket.instances[0]?.sentPayloads.map((entry) => {
        const parsed = JSON.parse(entry) as { method?: string };
        return parsed.method;
      })
    ).toEqual(["code_workspaces_list", "code_workspaces_list"]);
  });

  it("multiplexes concurrent websocket rpc requests by request id", async () => {
    vi.stubEnv("VITE_CODE_RUNTIME_GATEWAY_WEB_ENDPOINT", "http://127.0.0.1:8788/rpc");
    isDesktopHostRuntimeMock.mockReturnValue(false);

    const fetchMock = vi.fn(async (_input: unknown, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as { method?: string };
      if (body.method === "code_rpc_capabilities") {
        return new Response(
          JSON.stringify({
            ok: true,
            result: {
              ...createFrozenCapabilitiesPayload({
                methods: [CANONICAL_WORKSPACES_METHOD, "code_providers_catalog"],
              }),
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
    });
    vi.stubGlobal("fetch", fetchMock);

    type MessageListener = ((event: { data: unknown }) => void) | null;
    type BasicListener = ((event: Event) => void) | null;
    class MockWebSocket {
      static instances: MockWebSocket[] = [];
      onopen: BasicListener = null;
      onmessage: MessageListener = null;
      onclose: ((event: CloseEvent) => void) | null = null;
      onerror: BasicListener = null;
      private workspaceRequestId: string | null = null;
      private providersRequestId: string | null = null;

      constructor(public readonly url: string | URL) {
        MockWebSocket.instances.push(this);
        queueMicrotask(() => {
          this.onopen?.({} as Event);
        });
      }

      send(payload: string) {
        const request = JSON.parse(payload) as { id?: string; method?: string; type?: string };
        if (request.type !== "rpc.request" || typeof request.id !== "string") {
          return;
        }
        if (request.method === "code_workspaces_list") {
          this.workspaceRequestId = request.id;
        } else if (request.method === "code_providers_catalog") {
          this.providersRequestId = request.id;
        }

        if (!this.workspaceRequestId || !this.providersRequestId) {
          return;
        }

        const workspaceRequestId = this.workspaceRequestId;
        const providersRequestId = this.providersRequestId;
        this.workspaceRequestId = null;
        this.providersRequestId = null;

        queueMicrotask(() => {
          this.onmessage?.({
            data: JSON.stringify({
              type: "rpc.response",
              id: providersRequestId,
              ok: true,
              result: [],
            }),
          });
          this.onmessage?.({
            data: JSON.stringify({
              type: "rpc.response",
              id: workspaceRequestId,
              ok: true,
              result: [
                {
                  id: "workspace-ws-concurrent",
                  path: "/tmp/workspace-ws-concurrent",
                  displayName: "Concurrent WS Workspace",
                  connected: true,
                  defaultModelId: null,
                },
              ],
            }),
          });
        });
      }

      close() {
        // noop
      }
    }

    vi.stubGlobal("WebSocket", MockWebSocket as unknown as typeof WebSocket);

    const runtime = await importRuntimeClientModule();
    const client = runtime.getRuntimeClient();

    const [workspaces, providers] = await Promise.all([
      client.workspaces(),
      client.providersCatalog(),
    ]);

    expect(workspaces).toEqual([
      {
        id: "workspace-ws-concurrent",
        path: "/tmp/workspace-ws-concurrent",
        displayName: "Concurrent WS Workspace",
        connected: true,
        defaultModelId: null,
      },
    ]);
    expect(providers).toEqual([]);
    expect(MockWebSocket.instances).toHaveLength(1);
  });

  it("does not reuse in-flight read requests when cache-key serialization fails", async () => {
    vi.stubEnv("VITE_CODE_RUNTIME_GATEWAY_WEB_ENDPOINT", "/__code_runtime_rpc");
    isDesktopHostRuntimeMock.mockReturnValue(false);

    const fetchMock = vi.fn(async (_input: unknown, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as {
        method?: string;
        params?: { threadId?: string | { id?: string } };
      };
      if (body.method === "code_rpc_capabilities") {
        return new Response(
          JSON.stringify({
            ok: true,
            result: {
              ...createFrozenCapabilitiesPayload({
                methods: ["code_thread_resume"],
              }),
            },
          }),
          { status: 200 }
        );
      }
      if (body.method === "code_thread_resume") {
        const threadIdValue = body.params?.threadId;
        const threadId =
          typeof threadIdValue === "string" ? threadIdValue : (threadIdValue?.id ?? "unknown");
        return new Response(
          JSON.stringify({
            ok: true,
            result: {
              id: threadId,
              title: null,
              preview: null,
              updatedAt: 0,
            },
          }),
          { status: 200 }
        );
      }
      return new Response(JSON.stringify({ ok: true, result: [] }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const runtime = await importRuntimeClientModule();
    const client = runtime.getRuntimeClient();

    const originalStringify = JSON.stringify.bind(JSON);
    const poisonFlag = "__cacheKeyPoison";
    const stringifySpy = vi
      .spyOn(JSON, "stringify")
      .mockImplementation((value, replacer, space) => {
        const threadIdValue =
          typeof value === "object" && value !== null && "threadId" in value
            ? (value as { threadId?: unknown }).threadId
            : undefined;
        const hasPoisonedThreadId =
          typeof threadIdValue === "object" &&
          threadIdValue !== null &&
          poisonFlag in threadIdValue;
        if (
          typeof value === "object" &&
          value !== null &&
          "threadId" in value &&
          hasPoisonedThreadId &&
          !("method" in value && "params" in value)
        ) {
          throw new TypeError("cache-key-serialize-failed");
        }
        return originalStringify(value, replacer, space);
      });

    try {
      const firstThreadId = {
        id: "thread-a",
        [poisonFlag]: true,
      } as unknown as Parameters<typeof client.resumeThread>[1];
      const secondThreadId = {
        id: "thread-b",
        [poisonFlag]: true,
      } as unknown as Parameters<typeof client.resumeThread>[1];

      const [first, second] = await Promise.all([
        client.resumeThread("ws-1", firstThreadId),
        client.resumeThread("ws-1", secondThreadId),
      ]);

      expect(first).toMatchObject({ id: "thread-a" });
      expect(second).toMatchObject({ id: "thread-b" });
    } finally {
      stringifySpy.mockRestore();
    }

    const calledMethods = fetchMock.mock.calls.map(
      ([, init]) => JSON.parse(String((init as RequestInit | undefined)?.body ?? "{}")).method
    );
    expect(calledMethods).toEqual([
      "code_rpc_capabilities",
      "code_thread_resume",
      "code_thread_resume",
    ]);
  });

  it("falls back to http rpc when websocket transport setup fails", async () => {
    vi.stubEnv("VITE_CODE_RUNTIME_GATEWAY_WEB_ENDPOINT", "http://127.0.0.1:8788/rpc");
    isDesktopHostRuntimeMock.mockReturnValue(false);

    const fetchMock = vi.fn(async (_input: unknown, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as { method?: string };
      if (body.method === "code_rpc_capabilities") {
        return new Response(
          JSON.stringify({
            ok: true,
            result: {
              ...createFrozenCapabilitiesPayload({
                methods: [CANONICAL_WORKSPACES_METHOD],
              }),
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
      if (body.method === "code_workspaces_list") {
        return new Response(
          JSON.stringify({
            ok: true,
            result: [
              {
                id: "workspace-http",
                path: "/tmp/workspace-http",
                displayName: "HTTP Workspace",
                connected: true,
                defaultModelId: "gpt-5.3-codex",
              },
            ],
          }),
          { status: 200 }
        );
      }
      return new Response(JSON.stringify({ ok: true, result: [] }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    class ThrowingWebSocket {
      constructor() {
        throw new Error("ws unavailable");
      }
    }
    vi.stubGlobal("WebSocket", ThrowingWebSocket as unknown as typeof WebSocket);

    const runtime = await importRuntimeClientModule();
    const client = runtime.getRuntimeClient();

    await expect(client.workspaces()).resolves.toEqual([
      {
        id: "workspace-http",
        path: "/tmp/workspace-http",
        displayName: "HTTP Workspace",
        connected: true,
        defaultModelId: "gpt-5.3-codex",
      },
    ]);

    const calledMethods = fetchMock.mock.calls.map(
      ([, init]) => JSON.parse(String((init as RequestInit | undefined)?.body ?? "{}")).method
    );
    expect(calledMethods).toEqual(["code_rpc_capabilities", "code_workspaces_list"]);
  });

  it("applies websocket cooldown after an established transport closes unexpectedly", async () => {
    vi.stubEnv("VITE_CODE_RUNTIME_GATEWAY_WEB_ENDPOINT", "http://127.0.0.1:8788/rpc");
    isDesktopHostRuntimeMock.mockReturnValue(false);

    const fetchMock = vi.fn(async (_input: unknown, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as { method?: string };
      if (body.method === "code_rpc_capabilities") {
        return new Response(
          JSON.stringify({
            ok: true,
            result: {
              ...createFrozenCapabilitiesPayload({
                methods: [CANONICAL_WORKSPACES_METHOD],
              }),
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
      if (body.method === "code_workspaces_list") {
        return new Response(
          JSON.stringify({
            ok: true,
            result: [
              {
                id: "workspace-http-after-close",
                path: "/tmp/workspace-http-after-close",
                displayName: "HTTP After Close Workspace",
                connected: true,
                defaultModelId: "gpt-5.3-codex",
              },
            ],
          }),
          { status: 200 }
        );
      }
      return new Response(JSON.stringify({ ok: true, result: [] }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    type MessageListener = ((event: { data: unknown }) => void) | null;
    type BasicListener = ((event: Event) => void) | null;
    class MockWebSocket {
      static instances: MockWebSocket[] = [];
      readonly sentPayloads: string[] = [];
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
        this.sentPayloads.push(payload);
        const request = JSON.parse(payload) as { id?: string; method?: string; type?: string };
        if (request.type !== "rpc.request" || request.method !== "code_workspaces_list") {
          return;
        }
        queueMicrotask(() => {
          this.onmessage?.({
            data: JSON.stringify({
              type: "rpc.response",
              id: request.id,
              ok: true,
              result: [
                {
                  id: "workspace-ws-before-close",
                  path: "/tmp/workspace-ws-before-close",
                  displayName: "WS Before Close Workspace",
                  connected: true,
                  defaultModelId: null,
                },
              ],
            }),
          });
        });
      }

      close() {
        // noop
      }

      emitClose() {
        this.onclose?.({} as CloseEvent);
      }
    }

    vi.stubGlobal("WebSocket", MockWebSocket as unknown as typeof WebSocket);

    const runtime = await importRuntimeClientModule();
    const client = runtime.getRuntimeClient();

    await expect(client.workspaces()).resolves.toEqual([
      {
        id: "workspace-ws-before-close",
        path: "/tmp/workspace-ws-before-close",
        displayName: "WS Before Close Workspace",
        connected: true,
        defaultModelId: null,
      },
    ]);

    expect(MockWebSocket.instances).toHaveLength(1);
    MockWebSocket.instances[0]?.emitClose();

    await expect(client.workspaces()).resolves.toEqual([
      {
        id: "workspace-http-after-close",
        path: "/tmp/workspace-http-after-close",
        displayName: "HTTP After Close Workspace",
        connected: true,
        defaultModelId: "gpt-5.3-codex",
      },
    ]);

    expect(MockWebSocket.instances).toHaveLength(1);
    const calledMethods = fetchMock.mock.calls.map(
      ([, init]) => JSON.parse(String((init as RequestInit | undefined)?.body ?? "{}")).method
    );
    expect(calledMethods).toEqual(["code_rpc_capabilities", "code_workspaces_list"]);
  });

  it("applies websocket cooldown after transport setup failure", async () => {
    vi.stubEnv("VITE_CODE_RUNTIME_GATEWAY_WEB_ENDPOINT", "http://127.0.0.1:8788/rpc");
    isDesktopHostRuntimeMock.mockReturnValue(false);

    const fetchMock = vi.fn(async (_input: unknown, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as { method?: string };
      if (body.method === "code_rpc_capabilities") {
        return new Response(
          JSON.stringify({
            ok: true,
            result: {
              ...createFrozenCapabilitiesPayload({
                methods: [CANONICAL_WORKSPACES_METHOD],
              }),
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
      if (body.method === "code_workspaces_list") {
        return new Response(
          JSON.stringify({
            ok: true,
            result: [
              {
                id: "workspace-http-cooldown",
                path: "/tmp/workspace-http-cooldown",
                displayName: "HTTP Cooldown Workspace",
                connected: true,
                defaultModelId: "gpt-5.3-codex",
              },
            ],
          }),
          { status: 200 }
        );
      }
      return new Response(JSON.stringify({ ok: true, result: [] }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    class ThrowingWebSocket {
      static attempts = 0;
      constructor() {
        ThrowingWebSocket.attempts += 1;
        throw new Error("ws unavailable");
      }
    }
    vi.stubGlobal("WebSocket", ThrowingWebSocket as unknown as typeof WebSocket);

    const runtime = await importRuntimeClientModule();
    const client = runtime.getRuntimeClient();

    await expect(client.workspaces()).resolves.toEqual([
      {
        id: "workspace-http-cooldown",
        path: "/tmp/workspace-http-cooldown",
        displayName: "HTTP Cooldown Workspace",
        connected: true,
        defaultModelId: "gpt-5.3-codex",
      },
    ]);
    await expect(client.workspaces()).resolves.toEqual([
      {
        id: "workspace-http-cooldown",
        path: "/tmp/workspace-http-cooldown",
        displayName: "HTTP Cooldown Workspace",
        connected: true,
        defaultModelId: "gpt-5.3-codex",
      },
    ]);

    expect(ThrowingWebSocket.attempts).toBe(1);
    const calledMethods = fetchMock.mock.calls.map(
      ([, init]) => JSON.parse(String((init as RequestInit | undefined)?.body ?? "{}")).method
    );
    expect(calledMethods).toEqual([
      "code_rpc_capabilities",
      "code_workspaces_list",
      "code_workspaces_list",
    ]);
  });

  it("rejects web runtime when rpc contract version is below minimum", async () => {
    vi.stubEnv("VITE_CODE_RUNTIME_GATEWAY_WEB_ENDPOINT", "/__code_runtime_rpc");
    isDesktopHostRuntimeMock.mockReturnValue(false);

    const fetchMock = vi.fn(async (_input: unknown, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as { method?: string };
      if (body.method === "code_rpc_capabilities") {
        return new Response(
          JSON.stringify({
            ok: true,
            result: {
              contractVersion: "2026-01-01",
              methodSetHash: "legacy",
              methods: [CANONICAL_WORKSPACES_METHOD],
              features: [...FROZEN_RUNTIME_RPC_REQUIRED_FEATURES],

              errorCodes: { ...FROZEN_RUNTIME_RPC_ERROR_CODES },

              compatFieldAliases: { ...FROZEN_RUNTIME_RPC_COMPAT_FIELD_ALIASES },
            },
          }),
          { status: 200 }
        );
      }
      if (body.method === "code_workspaces_list") {
        return new Response(JSON.stringify({ ok: true, result: [] }), { status: 200 });
      }
      return new Response(JSON.stringify({ ok: true, result: [] }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const runtime = await importRuntimeClientModule();
    const client = runtime.getRuntimeClient();

    await expect(client.workspaces()).rejects.toMatchObject({
      name: "RuntimeRpcContractVersionMismatchError",
      actualVersion: "2026-01-01",
      expectedMinimum: CODE_RUNTIME_RPC_CONTRACT_VERSION,
    });

    const calledMethods = fetchMock.mock.calls.map(
      ([, init]) => JSON.parse(String((init as RequestInit | undefined)?.body ?? "{}")).method
    );
    expect(calledMethods).toContain("code_rpc_capabilities");
    expect(calledMethods).not.toContain("code_workspaces_list");
  });

  it("rejects web runtime when rpc contract version format is invalid", async () => {
    vi.stubEnv("VITE_CODE_RUNTIME_GATEWAY_WEB_ENDPOINT", "/__code_runtime_rpc");
    isDesktopHostRuntimeMock.mockReturnValue(false);

    const fetchMock = vi.fn(async (_input: unknown, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as { method?: string };
      if (body.method === "code_rpc_capabilities") {
        return new Response(
          JSON.stringify({
            ok: true,
            result: {
              contractVersion: "v2026-02-12",
              methodSetHash: "legacy",
              methods: [CANONICAL_WORKSPACES_METHOD],
              features: [...FROZEN_RUNTIME_RPC_REQUIRED_FEATURES],
              errorCodes: { ...FROZEN_RUNTIME_RPC_ERROR_CODES },
              compatFieldAliases: { ...FROZEN_RUNTIME_RPC_COMPAT_FIELD_ALIASES },
            },
          }),
          { status: 200 }
        );
      }
      if (body.method === "code_workspaces_list") {
        return new Response(JSON.stringify({ ok: true, result: [] }), { status: 200 });
      }
      return new Response(JSON.stringify({ ok: true, result: [] }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const runtime = await importRuntimeClientModule();
    const client = runtime.getRuntimeClient();

    await expect(client.workspaces()).rejects.toMatchObject({
      name: "RuntimeRpcContractVersionMismatchError",
      actualVersion: "v2026-02-12",
      expectedMinimum: CODE_RUNTIME_RPC_CONTRACT_VERSION,
    });

    const calledMethods = fetchMock.mock.calls.map(
      ([, init]) => JSON.parse(String((init as RequestInit | undefined)?.body ?? "{}")).method
    );
    expect(calledMethods).toContain("code_rpc_capabilities");
    expect(calledMethods).not.toContain("code_workspaces_list");
  });

  it("rejects web runtime when capabilities methodSetHash does not match methods", async () => {
    vi.stubEnv("VITE_CODE_RUNTIME_GATEWAY_WEB_ENDPOINT", "/__code_runtime_rpc");
    isDesktopHostRuntimeMock.mockReturnValue(false);

    const fetchMock = vi.fn(async (_input: unknown, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as { method?: string };
      if (body.method === "code_rpc_capabilities") {
        return new Response(
          JSON.stringify({
            ok: true,
            result: {
              contractVersion: CODE_RUNTIME_RPC_CONTRACT_VERSION,
              freezeEffectiveAt: CODE_RUNTIME_RPC_FREEZE_EFFECTIVE_AT,
              methodSetHash: "deadbeef",
              methods: [CANONICAL_WORKSPACES_METHOD],
              features: [...FROZEN_RUNTIME_RPC_REQUIRED_FEATURES],

              errorCodes: { ...FROZEN_RUNTIME_RPC_ERROR_CODES },

              compatFieldAliases: { ...FROZEN_RUNTIME_RPC_COMPAT_FIELD_ALIASES },
            },
          }),
          { status: 200 }
        );
      }
      if (body.method === "code_workspaces_list") {
        return new Response(JSON.stringify({ ok: true, result: [] }), { status: 200 });
      }
      return new Response(JSON.stringify({ ok: true, result: [] }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const runtime = await importRuntimeClientModule();
    const client = runtime.getRuntimeClient();

    await expect(client.workspaces()).rejects.toMatchObject({
      name: "RuntimeRpcCapabilitiesMethodSetHashMismatchError",
    });

    const calledMethods = fetchMock.mock.calls.map(
      ([, init]) => JSON.parse(String((init as RequestInit | undefined)?.body ?? "{}")).method
    );
    expect(calledMethods).toContain("code_rpc_capabilities");
    expect(calledMethods).not.toContain("workspaces_list");
  });

  it("rejects web runtime when required rpc contract features are missing", async () => {
    vi.stubEnv("VITE_CODE_RUNTIME_GATEWAY_WEB_ENDPOINT", "/__code_runtime_rpc");
    isDesktopHostRuntimeMock.mockReturnValue(false);

    const fetchMock = vi.fn(async (_input: unknown, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as { method?: string };
      if (body.method === "code_rpc_capabilities") {
        return new Response(
          JSON.stringify({
            ok: true,
            result: {
              contractVersion: CODE_RUNTIME_RPC_CONTRACT_VERSION,
              freezeEffectiveAt: CODE_RUNTIME_RPC_FREEZE_EFFECTIVE_AT,
              methodSetHash: CANONICAL_WORKSPACES_METHOD_SET_HASH,
              methods: [CANONICAL_WORKSPACES_METHOD],
              features: [],
            },
          }),
          { status: 200 }
        );
      }
      if (body.method === "code_workspaces_list") {
        return new Response(JSON.stringify({ ok: true, result: [] }), { status: 200 });
      }
      return new Response(JSON.stringify({ ok: true, result: [] }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const runtime = await importRuntimeClientModule();
    const client = runtime.getRuntimeClient();

    await expect(client.workspaces()).rejects.toMatchObject({
      name: "RuntimeRpcContractFeatureMissingError",
      missingFeatures: expect.arrayContaining([
        "method_not_found_error_code",
        REQUIRED_CONTRACT_FROZEN_FEATURE,
      ]),
    });

    const calledMethods = fetchMock.mock.calls.map(
      ([, init]) => JSON.parse(String((init as RequestInit | undefined)?.body ?? "{}")).method
    );
    expect(calledMethods).toContain("code_rpc_capabilities");
    expect(calledMethods).not.toContain("workspaces_list");
  });

  it("does not timeout runtime turn sends over websocket within the first 20 seconds", async () => {
    vi.useFakeTimers();
    try {
      vi.stubEnv("VITE_CODE_RUNTIME_GATEWAY_WEB_ENDPOINT", "http://127.0.0.1:8788/rpc");
      isDesktopHostRuntimeMock.mockReturnValue(false);

      const fetchMock = vi.fn(async (_input: unknown, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body ?? "{}")) as { method?: string };
        if (body.method === "code_rpc_capabilities") {
          return new Response(
            JSON.stringify({
              ok: true,
              result: {
                ...createFrozenCapabilitiesPayload({
                  methods: ["code_turn_send"],
                }),
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
      });
      vi.stubGlobal("fetch", fetchMock);

      type MessageListener = ((event: { data: unknown }) => void) | null;
      type BasicListener = ((event: Event) => void) | null;
      class MockWebSocket {
        static instances: MockWebSocket[] = [];
        readonly sentPayloads: string[] = [];
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
          this.sentPayloads.push(payload);
        }

        close() {
          // noop
        }
      }

      vi.stubGlobal("WebSocket", MockWebSocket as unknown as typeof WebSocket);

      const runtime = await importRuntimeClientModule();
      const client = runtime.getRuntimeClient();

      const sendTurnPromise = client.sendTurn({
        workspaceId: "workspace-ws",
        threadId: "thread-ws",
        requestId: "request-ws",
        content: "hello",
        provider: null,
        modelId: "gpt-5.3-codex",
        reasonEffort: "high",
        accessMode: "on-request",
        executionMode: "runtime",
        queue: false,
        attachments: [],
      });

      await vi.advanceTimersByTimeAsync(20_001);
      expect(MockWebSocket.instances).toHaveLength(1);
      const sentRequest = JSON.parse(MockWebSocket.instances[0]?.sentPayloads[0] ?? "{}") as {
        id?: string;
        method?: string;
      };
      expect(sentRequest.method).toBe("code_turn_send");

      MockWebSocket.instances[0]?.onmessage?.({
        data: JSON.stringify({
          type: "rpc.response",
          id: sentRequest.id,
          ok: true,
          result: {
            accepted: true,
            turnId: "turn-ws-runtime-1",
            threadId: "thread-ws",
            routedProvider: "openai",
            routedModelId: "gpt-5.3-codex",
            routedPool: null,
            routedSource: "local-codex",
            message: "accepted",
          },
        }),
      });

      await expect(sendTurnPromise).resolves.toMatchObject({
        accepted: true,
        turnId: "turn-ws-runtime-1",
      });
    } finally {
      vi.useRealTimers();
    }
  });
});
