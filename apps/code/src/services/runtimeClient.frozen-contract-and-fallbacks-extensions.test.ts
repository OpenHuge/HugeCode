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
const isTauriMock = vi.fn();
const REQUIRED_CONTRACT_FROZEN_FEATURE = `contract_frozen_${CODE_RUNTIME_RPC_FREEZE_EFFECTIVE_AT.replaceAll("-", "_")}`;
const CANONICAL_WORKSPACES_METHOD = "code_workspaces_list";
const CANONICAL_WORKSPACES_METHOD_SET_HASH = computeCodeRuntimeRpcMethodSetHash([
  CANONICAL_WORKSPACES_METHOD,
]);
const NON_CANONICAL_RUNTIME_METHOD = "code_runtime_probe_invalid_v1";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: invokeMock,
  isTauri: isTauriMock,
}));

function syncTauriBridgeWithMockState() {
  const tauriWindow = window as Window & {
    __TAURI_INTERNALS__?: unknown;
  };
  const implementation = isTauriMock.getMockImplementation();
  if (implementation && implementation() === true) {
    tauriWindow.__TAURI_INTERNALS__ = {
      invoke: invokeMock,
    };
  }
}

async function importRuntimeClientModule() {
  vi.resetModules();
  syncTauriBridgeWithMockState();
  return import("./runtimeClient");
}

function clearTauriMarkers() {
  const tauriWindow = window as Window & {
    __TAURI__?: unknown;
    __TAURI_INTERNALS__?: unknown;
    __TAURI_IPC__?: unknown;
  };

  delete tauriWindow.__TAURI__;
  delete tauriWindow.__TAURI_INTERNALS__;
  delete tauriWindow.__TAURI_IPC__;
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
    profile: string;
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
    isTauriMock.mockReset();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    window.localStorage.clear();
    clearTauriMarkers();
    clearAgentRuntimeMarkers();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    window.localStorage.clear();
    clearTauriMarkers();
    clearAgentRuntimeMarkers();
  });

  it("returns structured unsupported error for sendTurn METHOD_NOT_FOUND", async () => {
    isTauriMock.mockReturnValue(true);
    invokeMock.mockImplementation(async (method: string) => {
      if (method === "code_turn_send") {
        throw {
          code: "METHOD_NOT_FOUND",
          message: "Unknown command code_turn_send",
        };
      }
      return [];
    });

    const runtime = await importRuntimeClientModule();
    const client = runtime.getRuntimeClient();

    await expect(
      client.sendTurn({
        workspaceId: "workspace-1",
        threadId: "thread-1",
        requestId: "request-legacy-1",
        content: "hello",
        provider: null,
        modelId: "gpt-5.3-codex",
        reasonEffort: "high",
        accessMode: "on-request",
        executionMode: "runtime",
        queue: false,
        attachments: [],
      })
    ).rejects.toMatchObject({
      name: "RuntimeRpcMethodUnsupportedError",
      method: "code_turn_send",
      code: "METHOD_NOT_FOUND",
    });
    expect(invokeMock).toHaveBeenNthCalledWith(1, "code_rpc_capabilities", {});
    expect(invokeMock).toHaveBeenNthCalledWith(
      2,
      "code_turn_send",
      expect.objectContaining({
        payload: expect.objectContaining({
          requestId: "request-legacy-1",
        }),
      })
    );
    expect(invokeMock.mock.calls[1]?.[1]?.payload).not.toHaveProperty("request_id");
    expect(invokeMock).toHaveBeenCalledTimes(2);
  });

  it("treats tauri command-not-found message as structured unsupported error", async () => {
    isTauriMock.mockReturnValue(true);
    invokeMock.mockImplementation(async (method: string) => {
      if (method === "code_workspaces_list") {
        throw new Error("invalid args for command invoke: command code_workspaces_list not found");
      }
      return [];
    });

    const runtime = await importRuntimeClientModule();
    const client = runtime.getRuntimeClient();

    await expect(client.workspaces()).rejects.toMatchObject({
      name: "RuntimeRpcMethodUnsupportedError",
      method: "code_workspaces_list",
      code: "METHOD_NOT_FOUND",
    });
    expect(invokeMock).toHaveBeenNthCalledWith(1, "code_rpc_capabilities", {});
    expect(invokeMock).toHaveBeenNthCalledWith(2, "code_workspaces_list", {});
    expect(invokeMock).toHaveBeenCalledTimes(2);
  });

  it("retries tauri capabilities probe after transient failure instead of caching null forever", async () => {
    isTauriMock.mockReturnValue(true);

    let capabilitiesProbeCount = 0;
    invokeMock.mockImplementation(async (method: string) => {
      if (method === "code_rpc_capabilities") {
        capabilitiesProbeCount += 1;
        if (capabilitiesProbeCount === 1) {
          throw {
            code: "INTERNAL_ERROR",
            message: "transient probe failure",
          };
        }
        return {
          contractVersion: CODE_RUNTIME_RPC_CONTRACT_VERSION,
          freezeEffectiveAt: CODE_RUNTIME_RPC_FREEZE_EFFECTIVE_AT,
          methodSetHash: CANONICAL_WORKSPACES_METHOD_SET_HASH,
          methods: [CANONICAL_WORKSPACES_METHOD],
          features: [...FROZEN_RUNTIME_RPC_REQUIRED_FEATURES],

          errorCodes: { ...FROZEN_RUNTIME_RPC_ERROR_CODES },

          compatFieldAliases: { ...FROZEN_RUNTIME_RPC_COMPAT_FIELD_ALIASES },
        };
      }
      if (method === "code_workspaces_list") {
        return [];
      }
      return [];
    });

    const runtime = await importRuntimeClientModule();
    const client = runtime.getRuntimeClient();

    await expect(client.workspaces()).resolves.toEqual([]);
    await expect(client.workspaces()).resolves.toEqual([]);

    const calledMethods = invokeMock.mock.calls.map(([method]) => method);
    expect(calledMethods.filter((method) => method === "code_rpc_capabilities")).toHaveLength(2);
    expect(calledMethods.filter((method) => method === "code_workspaces_list")).toHaveLength(2);
  });

  it("rejects tauri runtime when capabilities omit canonical command", async () => {
    isTauriMock.mockReturnValue(true);
    invokeMock.mockImplementation(async (method: string) => {
      if (method === "code_rpc_capabilities") {
        return createFrozenCapabilitiesPayload({
          methods: ["code_health"],
        });
      }
      return [];
    });

    const runtime = await importRuntimeClientModule();
    const client = runtime.getRuntimeClient();

    await expect(client.workspaces()).rejects.toMatchObject({
      name: "RuntimeRpcMethodUnsupportedError",
      method: "code_workspaces_list",
      code: "METHOD_NOT_FOUND",
    });
    expect(invokeMock).toHaveBeenNthCalledWith(1, "code_rpc_capabilities", {});
    expect(invokeMock).not.toHaveBeenCalledWith("code_workspaces_list", {});
  });

  it("rejects tauri runtime when rpc contract version is below minimum", async () => {
    isTauriMock.mockReturnValue(true);
    invokeMock.mockImplementation(async (method: string) => {
      if (method === "code_rpc_capabilities") {
        return {
          contractVersion: "2026-01-01",
          methodSetHash: "legacy",
          methods: [CANONICAL_WORKSPACES_METHOD],
          features: [...FROZEN_RUNTIME_RPC_REQUIRED_FEATURES],

          errorCodes: { ...FROZEN_RUNTIME_RPC_ERROR_CODES },

          compatFieldAliases: { ...FROZEN_RUNTIME_RPC_COMPAT_FIELD_ALIASES },
        };
      }
      if (method === "code_workspaces_list") {
        return [];
      }
      return [];
    });

    const runtime = await importRuntimeClientModule();
    const client = runtime.getRuntimeClient();

    await expect(client.workspaces()).rejects.toMatchObject({
      name: "RuntimeRpcContractVersionMismatchError",
      actualVersion: "2026-01-01",
      expectedMinimum: CODE_RUNTIME_RPC_CONTRACT_VERSION,
    });
    expect(invokeMock).toHaveBeenNthCalledWith(1, "code_rpc_capabilities", {});
    expect(invokeMock).not.toHaveBeenCalledWith("code_workspaces_list", {});
  });

  it("rejects tauri runtime when rpc contract version format is invalid", async () => {
    isTauriMock.mockReturnValue(true);
    invokeMock.mockImplementation(async (method: string) => {
      if (method === "code_rpc_capabilities") {
        return {
          contractVersion: "v2026-02-12",
          methodSetHash: "legacy",
          methods: [CANONICAL_WORKSPACES_METHOD],
          features: [...FROZEN_RUNTIME_RPC_REQUIRED_FEATURES],
          errorCodes: { ...FROZEN_RUNTIME_RPC_ERROR_CODES },
          compatFieldAliases: { ...FROZEN_RUNTIME_RPC_COMPAT_FIELD_ALIASES },
        };
      }
      if (method === "code_workspaces_list") {
        return [];
      }
      return [];
    });

    const runtime = await importRuntimeClientModule();
    const client = runtime.getRuntimeClient();

    await expect(client.workspaces()).rejects.toMatchObject({
      name: "RuntimeRpcContractVersionMismatchError",
      actualVersion: "v2026-02-12",
      expectedMinimum: CODE_RUNTIME_RPC_CONTRACT_VERSION,
    });
    expect(invokeMock).toHaveBeenNthCalledWith(1, "code_rpc_capabilities", {});
    expect(invokeMock).not.toHaveBeenCalledWith("code_workspaces_list", {});
  });

  it("rejects tauri runtime when frozen rpc contract is missing required frozen features", async () => {
    isTauriMock.mockReturnValue(true);
    invokeMock.mockImplementation(async (method: string) => {
      if (method === "code_rpc_capabilities") {
        return createFrozenCapabilitiesPayload({
          features: ["method_not_found_error_code"],
        });
      }
      if (method === "code_workspaces_list") {
        return [];
      }
      return [];
    });

    const runtime = await importRuntimeClientModule();
    const client = runtime.getRuntimeClient();

    await expect(client.workspaces()).rejects.toMatchObject({
      name: "RuntimeRpcContractFeatureMissingError",
      missingFeatures: expect.arrayContaining([REQUIRED_CONTRACT_FROZEN_FEATURE]),
    });
    expect(invokeMock).toHaveBeenNthCalledWith(1, "code_rpc_capabilities", {});
    expect(invokeMock).not.toHaveBeenCalledWith("code_workspaces_list", {});
  });

  it("accepts full-runtime capabilities when optional git diff paging feature is missing", async () => {
    isTauriMock.mockReturnValue(true);
    invokeMock.mockImplementation(async (method: string) => {
      if (method === "code_rpc_capabilities") {
        return createFrozenCapabilitiesPayload({
          profile: "full-runtime",
          features: FROZEN_RUNTIME_RPC_REQUIRED_FEATURES.filter(
            (feature) => feature !== "git_diff_paging_v1"
          ),
        });
      }
      if (method === "code_workspaces_list") {
        return [];
      }
      return [];
    });

    const runtime = await importRuntimeClientModule();
    const client = runtime.getRuntimeClient();

    await expect(client.workspaces()).resolves.toEqual([]);
    expect(invokeMock).toHaveBeenNthCalledWith(1, "code_rpc_capabilities", {});
    expect(invokeMock).toHaveBeenNthCalledWith(2, "code_workspaces_list", {});
  });

  it("accepts tauri desktop-core profile when desktop frozen baseline features are present", async () => {
    isTauriMock.mockReturnValue(true);
    invokeMock.mockImplementation(async (method: string) => {
      if (method === "code_rpc_capabilities") {
        return createFrozenCapabilitiesPayload({
          profile: "desktop-core",
          features: [
            "method_not_found_error_code",
            "rpc_capabilities_handshake",
            REQUIRED_CONTRACT_FROZEN_FEATURE,
          ],
        });
      }
      if (method === "code_workspaces_list") {
        return [];
      }
      return [];
    });

    const runtime = await importRuntimeClientModule();
    const client = runtime.getRuntimeClient();

    await expect(client.workspaces()).resolves.toEqual([]);
    expect(invokeMock).toHaveBeenNthCalledWith(1, "code_rpc_capabilities", {});
    expect(invokeMock).toHaveBeenNthCalledWith(2, "code_workspaces_list", {});
  });

  it("rejects tauri runtime when capability profile is unknown", async () => {
    isTauriMock.mockReturnValue(true);
    invokeMock.mockImplementation(async (method: string) => {
      if (method === "code_rpc_capabilities") {
        return createFrozenCapabilitiesPayload({
          profile: "experimental-profile",
          features: [
            "method_not_found_error_code",
            "rpc_capabilities_handshake",
            REQUIRED_CONTRACT_FROZEN_FEATURE,
          ],
        });
      }
      if (method === "code_workspaces_list") {
        return [];
      }
      return [];
    });

    const runtime = await importRuntimeClientModule();
    const client = runtime.getRuntimeClient();

    await expect(client.workspaces()).rejects.toMatchObject({
      name: "RuntimeRpcContractProfileMismatchError",
      actualProfile: "experimental-profile",
    });
    expect(invokeMock).toHaveBeenNthCalledWith(1, "code_rpc_capabilities", {});
    expect(invokeMock).not.toHaveBeenCalledWith("code_workspaces_list", {});
  });

  it("rejects tauri runtime when capabilities advertise non-canonical method names", async () => {
    isTauriMock.mockReturnValue(true);
    invokeMock.mockImplementation(async (method: string) => {
      if (method === "code_rpc_capabilities") {
        return createFrozenCapabilitiesPayload({
          methods: [CANONICAL_WORKSPACES_METHOD, "oauth_pool_apply"],
        });
      }
      if (method === "code_workspaces_list") {
        return [];
      }
      return [];
    });

    const runtime = await importRuntimeClientModule();
    const client = runtime.getRuntimeClient();

    await expect(client.workspaces()).rejects.toMatchObject({
      name: "RuntimeRpcContractCanonicalMethodsOnlyError",
      nonCanonicalMethods: expect.arrayContaining(["oauth_pool_apply"]),
    });
    expect(invokeMock).toHaveBeenNthCalledWith(1, "code_rpc_capabilities", {});
    expect(invokeMock).not.toHaveBeenCalledWith("code_workspaces_list", {});
  });

  it("accepts tauri rpc capabilities metadata provided with snake_case keys", async () => {
    isTauriMock.mockReturnValue(true);
    invokeMock.mockImplementation(async (method: string) => {
      if (method === "code_rpc_capabilities") {
        return {
          contract_version: CODE_RUNTIME_RPC_CONTRACT_VERSION,
          freeze_effective_at: CODE_RUNTIME_RPC_FREEZE_EFFECTIVE_AT,
          method_set_hash: CANONICAL_WORKSPACES_METHOD_SET_HASH,
          methods: [CANONICAL_WORKSPACES_METHOD],
          features: [...FROZEN_RUNTIME_RPC_REQUIRED_FEATURES],
          error_codes: { ...FROZEN_RUNTIME_RPC_ERROR_CODES },
          compat_field_aliases: { ...FROZEN_RUNTIME_RPC_COMPAT_FIELD_ALIASES },
        };
      }
      if (method === "code_workspaces_list") {
        return [];
      }
      return [];
    });

    const runtime = await importRuntimeClientModule();
    const client = runtime.getRuntimeClient();

    await expect(client.workspaces()).resolves.toEqual([]);
    expect(invokeMock).toHaveBeenNthCalledWith(1, "code_rpc_capabilities", {});
    expect(invokeMock).toHaveBeenNthCalledWith(2, "code_workspaces_list", {});
  });

  it("does not fall back when canonical call fails with non method-not-found error", async () => {
    isTauriMock.mockReturnValue(true);
    invokeMock.mockRejectedValue({
      code: "INTERNAL_ERROR",
      message: "runtime failure",
    });

    const runtime = await importRuntimeClientModule();
    const client = runtime.getRuntimeClient();

    await expect(client.workspaces()).rejects.toMatchObject({
      code: "INTERNAL_ERROR",
      message: "runtime failure",
    });
    expect(invokeMock).toHaveBeenCalledTimes(2);
    expect(invokeMock).toHaveBeenNthCalledWith(1, "code_rpc_capabilities", {});
    expect(invokeMock).toHaveBeenCalledWith("code_workspaces_list", {});
  });

  it("does not fall back for non-METHOD_NOT_FOUND sendTurn failures", async () => {
    isTauriMock.mockReturnValue(true);
    invokeMock.mockImplementation(async (method: string) => {
      if (method === "code_turn_send") {
        throw {
          code: "INVALID_PARAMS",
          message: "provider/model mismatch",
        };
      }
      if (method === "turn_send") {
        throw new Error("legacy alias should not be called");
      }
      return [];
    });

    const runtime = await importRuntimeClientModule();
    const client = runtime.getRuntimeClient();

    await expect(
      client.sendTurn({
        workspaceId: "workspace-1",
        threadId: "thread-1",
        content: "hello",
        provider: "openai",
        modelId: "claude-sonnet-4.5",
        reasonEffort: "high",
        accessMode: "on-request",
        executionMode: "runtime",
        queue: false,
        attachments: [],
      })
    ).rejects.toMatchObject({
      code: "INVALID_PARAMS",
      message: "provider/model mismatch",
    });

    const calledMethods = invokeMock.mock.calls.map(([method]) => method);
    expect(calledMethods).toContain("code_turn_send");
    expect(calledMethods).not.toContain("turn_send");
  });

  it("web runtime returns structured unsupported error on METHOD_NOT_FOUND", async () => {
    vi.stubEnv("VITE_CODE_RUNTIME_GATEWAY_WEB_ENDPOINT", "/__code_runtime_rpc");
    isTauriMock.mockReturnValue(false);

    const fetchMock = vi.fn(async (_input: unknown, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as { method?: string };
      if (body.method === "code_workspaces_list") {
        return new Response(
          JSON.stringify({
            ok: false,
            error: {
              code: "METHOD_NOT_FOUND",
              message: "Unsupported RPC method: code_workspaces_list",
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

    await expect(client.workspaces()).rejects.toMatchObject({
      name: "RuntimeRpcMethodUnsupportedError",
      method: "code_workspaces_list",
      code: "METHOD_NOT_FOUND",
    });
    const calledMethods = fetchMock.mock.calls.map(
      ([, init]) => JSON.parse(String((init as RequestInit | undefined)?.body ?? "{}")).method
    );
    expect(calledMethods).toContain("code_workspaces_list");
    expect(calledMethods).not.toContain("workspaces_list");
  });

  it("retries web capabilities probe after transient failure instead of caching null forever", async () => {
    vi.stubEnv("VITE_CODE_RUNTIME_GATEWAY_WEB_ENDPOINT", "/__code_runtime_rpc");
    isTauriMock.mockReturnValue(false);

    let capabilitiesProbeCount = 0;
    const fetchMock = vi.fn(async (_input: unknown, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as { method?: string };
      if (body.method === "code_rpc_capabilities") {
        capabilitiesProbeCount += 1;
        if (capabilitiesProbeCount === 1) {
          throw new TypeError("Failed to fetch");
        }
        return new Response(
          JSON.stringify({
            ok: true,
            result: {
              contractVersion: CODE_RUNTIME_RPC_CONTRACT_VERSION,
              freezeEffectiveAt: CODE_RUNTIME_RPC_FREEZE_EFFECTIVE_AT,
              methodSetHash: CANONICAL_WORKSPACES_METHOD_SET_HASH,
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

    await expect(client.workspaces()).resolves.toEqual([]);
    await expect(client.workspaces()).resolves.toEqual([]);

    const calledMethods = fetchMock.mock.calls.map(
      ([, init]) => JSON.parse(String((init as RequestInit | undefined)?.body ?? "{}")).method
    );
    expect(calledMethods.filter((method) => method === "code_rpc_capabilities")).toHaveLength(2);
    expect(calledMethods.filter((method) => method === "code_workspaces_list")).toHaveLength(2);
  });

  it("clears stale loopback manual runtime profiles when capabilities advertise non-canonical methods", async () => {
    isTauriMock.mockReturnValue(false);
    window.localStorage.setItem(
      "code.manual-web-runtime-gateway-profile.v1",
      JSON.stringify({
        httpBaseUrl: "http://localhost:8788/rpc",
        wsBaseUrl: "ws://localhost:8788/ws",
        authToken: null,
        enabled: true,
      })
    );

    const fetchMock = vi.fn(async (_input: unknown, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as { method?: string };
      if (body.method === "code_rpc_capabilities") {
        return new Response(
          JSON.stringify({
            ok: true,
            result: createFrozenCapabilitiesPayload({
              methods: [NON_CANONICAL_RUNTIME_METHOD, CANONICAL_WORKSPACES_METHOD],
            }),
          }),
          { status: 200 }
        );
      }
      return new Response(JSON.stringify({ ok: true, result: [] }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const runtime = await importRuntimeClientModule();
    const client = runtime.getRuntimeClient();

    expect(runtime.detectRuntimeMode()).toBe("runtime-gateway-web");
    await expect(client.workspaces()).rejects.toBeInstanceOf(Error);
    expect(window.localStorage.getItem("code.manual-web-runtime-gateway-profile.v1")).toBeNull();
    expect(runtime.detectRuntimeMode()).toBe("unavailable");
  });

  it("routes terminal controls through web runtime endpoint", async () => {
    vi.stubEnv("VITE_CODE_RUNTIME_GATEWAY_WEB_ENDPOINT", "/__code_runtime_rpc");
    isTauriMock.mockReturnValue(false);

    const fetchMock = vi.fn(async (_input: unknown, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as {
        method?: string;
      };
      const result = body.method === "code_terminal_read" ? null : true;
      return new Response(JSON.stringify({ ok: true, result }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const runtime = await importRuntimeClientModule();
    const client = runtime.getRuntimeClient();

    expect(runtime.detectRuntimeMode()).toBe("runtime-gateway-web");
    await client.terminalRead("session-web");
    await client.terminalStreamStart("session-web");
    await client.terminalStreamStop("session-web");
    await client.terminalInterrupt("session-web");
    await client.terminalResize("session-web", 36, 120);
    await client.terminalInputRaw("session-web", "echo hi\r");
    await client.cliSessions();

    const methods = fetchMock.mock.calls.map(([, init]) => {
      const body = JSON.parse(String((init as RequestInit | undefined)?.body ?? "{}")) as {
        method?: string;
      };
      return body.method;
    });

    expect(methods).toEqual(
      expect.arrayContaining([
        "code_terminal_read",
        "code_terminal_stream_start",
        "code_terminal_stream_stop",
        "code_terminal_interrupt",
        "code_terminal_resize",
        "code_terminal_input_raw",
        "code_cli_sessions_list",
      ])
    );
  });
});
