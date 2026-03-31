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
const CANONICAL_WORKSPACES_METHOD = "code_workspaces_list";
const CANONICAL_WORKSPACES_METHOD_SET_HASH = computeCodeRuntimeRpcMethodSetHash([
  CANONICAL_WORKSPACES_METHOD,
]);
const CONTRACT_FREEZE_BASE_TIME_MS = Date.parse(
  `${CODE_RUNTIME_RPC_FREEZE_EFFECTIVE_AT}T00:00:00.000Z`
);
const CONTRACT_FREEZE_AFTER_TTL_TIME_MS = CONTRACT_FREEZE_BASE_TIME_MS + 6_000;
const CONTRACT_FREEZE_MISMATCH_DATE = new Date(CONTRACT_FREEZE_BASE_TIME_MS - 24 * 60 * 60 * 1_000)
  .toISOString()
  .slice(0, 10);

vi.mock("@desktop-host/core", () => ({
  invoke: invokeMock,
  isDesktopHostRuntime: isDesktopHostRuntimeMock,
}));

function syncDesktopHostBridgeWithMockState() {
  const desktopHostWindow = window as Window & {
    __HUGE_CODE_DESKTOP_HOST_INTERNALS__?: unknown;
  };
  const implementation = isDesktopHostRuntimeMock.getMockImplementation();
  if (implementation && implementation() === true) {
    desktopHostWindow.__HUGE_CODE_DESKTOP_HOST_INTERNALS__ = {
      invoke: invokeMock,
    };
  }
}

async function importRuntimeClientModule() {
  vi.resetModules();
  syncDesktopHostBridgeWithMockState();
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

  it("rejects web runtime when freezeEffectiveAt does not match frozen contract date", async () => {
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
              freezeEffectiveAt: CONTRACT_FREEZE_MISMATCH_DATE,
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
      if (body.method === "workspaces_list") {
        return new Response(
          JSON.stringify({
            ok: false,
            error: {
              code: "METHOD_NOT_FOUND",
              message: "Legacy alias should not be called: workspaces_list",
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
      name: "RuntimeRpcContractFreezeEffectiveAtMismatchError",
      expectedFreezeEffectiveAt: CODE_RUNTIME_RPC_FREEZE_EFFECTIVE_AT,
      actualFreezeEffectiveAt: CONTRACT_FREEZE_MISMATCH_DATE,
    });

    const calledMethods = fetchMock.mock.calls.map(
      ([, init]) => JSON.parse(String((init as RequestInit | undefined)?.body ?? "{}")).method
    );
    expect(calledMethods).toContain("code_rpc_capabilities");
    expect(calledMethods).not.toContain("workspaces_list");
  });

  it("rejects web runtime when frozen rpc contract omits errorCodes", async () => {
    vi.stubEnv("VITE_CODE_RUNTIME_GATEWAY_WEB_ENDPOINT", "/__code_runtime_rpc");
    isDesktopHostRuntimeMock.mockReturnValue(false);

    const fetchMock = vi.fn(async (_input: unknown, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as { method?: string };
      if (body.method === "code_rpc_capabilities") {
        const payload = createFrozenCapabilitiesPayload();
        delete payload.errorCodes;
        return new Response(JSON.stringify({ ok: true, result: payload }), { status: 200 });
      }
      if (body.method === "workspaces_list") {
        return new Response(
          JSON.stringify({
            ok: false,
            error: {
              code: "METHOD_NOT_FOUND",
              message: "Legacy alias should not be called: workspaces_list",
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
      name: "RuntimeRpcContractErrorCodesMismatchError",
    });
    const calledMethods = fetchMock.mock.calls.map(
      ([, init]) => JSON.parse(String((init as RequestInit | undefined)?.body ?? "{}")).method
    );
    expect(calledMethods).toContain("code_rpc_capabilities");
    expect(calledMethods).not.toContain("workspaces_list");
  });

  it("ignores compat alias metadata drift once the canonical contract handshake succeeds", async () => {
    vi.stubEnv("VITE_CODE_RUNTIME_GATEWAY_WEB_ENDPOINT", "/__code_runtime_rpc");
    isDesktopHostRuntimeMock.mockReturnValue(false);

    const fetchMock = vi.fn(async (_input: unknown, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as { method?: string };
      if (body.method === "code_rpc_capabilities") {
        return new Response(
          JSON.stringify({
            ok: true,
            result: createFrozenCapabilitiesPayload({
              compatFieldAliases: {
                ...FROZEN_RUNTIME_RPC_COMPAT_FIELD_ALIASES,
                workspaceId: "workspace_uuid",
              },
            }),
          }),
          { status: 200 }
        );
      }
      if (body.method === "workspaces_list") {
        return new Response(
          JSON.stringify({
            ok: false,
            error: {
              code: "METHOD_NOT_FOUND",
              message: "Legacy alias should not be called: workspaces_list",
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

    await expect(client.workspaces()).resolves.toEqual([]);
    const calledMethods = fetchMock.mock.calls.map(
      ([, init]) => JSON.parse(String((init as RequestInit | undefined)?.body ?? "{}")).method
    );
    expect(calledMethods).toContain("code_rpc_capabilities");
    expect(calledMethods).toContain("code_workspaces_list");
  });

  it("rejects web runtime when capabilities omit canonical method", async () => {
    vi.stubEnv("VITE_CODE_RUNTIME_GATEWAY_WEB_ENDPOINT", "/__code_runtime_rpc");
    isDesktopHostRuntimeMock.mockReturnValue(false);

    const fetchMock = vi.fn(async (_input: unknown, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as { method?: string };
      if (body.method === "code_rpc_capabilities") {
        return new Response(
          JSON.stringify({
            ok: true,
            result: createFrozenCapabilitiesPayload({
              methods: ["code_health"],
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

    await expect(client.workspaces()).rejects.toMatchObject({
      name: "RuntimeRpcMethodUnsupportedError",
      method: "code_workspaces_list",
      code: "METHOD_NOT_FOUND",
    });
    const calledMethods = fetchMock.mock.calls.map(
      ([, init]) => JSON.parse(String((init as RequestInit | undefined)?.body ?? "{}")).method
    );
    expect(calledMethods).toEqual(["code_rpc_capabilities"]);
  });

  it("returns unsupported error when runtime rejects canonical method after capabilities allow it", async () => {
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
              features: [...FROZEN_RUNTIME_RPC_REQUIRED_FEATURES],

              errorCodes: { ...FROZEN_RUNTIME_RPC_ERROR_CODES },

              compatFieldAliases: { ...FROZEN_RUNTIME_RPC_COMPAT_FIELD_ALIASES },
            },
          }),
          { status: 200 }
        );
      }
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
    expect(calledMethods).toContain("code_rpc_capabilities");
    expect(calledMethods).toContain("code_workspaces_list");
    expect(calledMethods).not.toContain("workspaces_list");
  });

  it("reuses cached runtime-gateway-web capabilities across repeated calls", async () => {
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
              features: [...FROZEN_RUNTIME_RPC_REQUIRED_FEATURES],

              errorCodes: { ...FROZEN_RUNTIME_RPC_ERROR_CODES },

              compatFieldAliases: { ...FROZEN_RUNTIME_RPC_COMPAT_FIELD_ALIASES },
            },
          }),
          { status: 200 }
        );
      }
      if (body.method === "workspaces_list") {
        return new Response(
          JSON.stringify({
            ok: false,
            error: {
              code: "METHOD_NOT_FOUND",
              message: "Legacy alias should not be called: workspaces_list",
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

    await expect(client.workspaces()).resolves.toEqual([]);
    await expect(client.workspaces()).resolves.toEqual([]);

    const calledMethods = fetchMock.mock.calls.map(
      ([, init]) => JSON.parse(String((init as RequestInit | undefined)?.body ?? "{}")).method
    );
    expect(calledMethods.filter((method) => method === "code_rpc_capabilities")).toHaveLength(1);
    expect(calledMethods.filter((method) => method === "code_workspaces_list")).toHaveLength(2);
  });

  it("re-probes cached null web capabilities after ttl and adopts new support", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date(CONTRACT_FREEZE_BASE_TIME_MS));
      vi.stubEnv("VITE_CODE_RUNTIME_GATEWAY_WEB_ENDPOINT", "/__code_runtime_rpc");
      isDesktopHostRuntimeMock.mockReturnValue(false);

      let capabilityCallCount = 0;
      const fetchMock = vi.fn(async (_input: unknown, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body ?? "{}")) as { method?: string };
        if (body.method === "code_rpc_capabilities") {
          capabilityCallCount += 1;
          if (capabilityCallCount <= 2) {
            return new Response(
              JSON.stringify({
                ok: false,
                error: {
                  code: "METHOD_NOT_FOUND",
                  message: `Unsupported RPC method: ${String(body.method)}`,
                },
              }),
              { status: 200 }
            );
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

      vi.setSystemTime(new Date(CONTRACT_FREEZE_AFTER_TTL_TIME_MS));
      await expect(client.workspaces()).resolves.toEqual([]);

      const calledMethods = fetchMock.mock.calls.map(
        ([, init]) => JSON.parse(String((init as RequestInit | undefined)?.body ?? "{}")).method
      );
      expect(calledMethods.filter((method) => method === "code_rpc_capabilities")).toHaveLength(2);
      expect(calledMethods.filter((method) => method === "code_workspaces_list")).toHaveLength(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it("re-probes cached version mismatch after ttl and recovers in web runtime", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date(CONTRACT_FREEZE_BASE_TIME_MS));
      vi.stubEnv("VITE_CODE_RUNTIME_GATEWAY_WEB_ENDPOINT", "/__code_runtime_rpc");
      isDesktopHostRuntimeMock.mockReturnValue(false);

      let supportsNewContract = false;
      const fetchMock = vi.fn(async (_input: unknown, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body ?? "{}")) as { method?: string };
        if (body.method === "code_rpc_capabilities") {
          if (!supportsNewContract) {
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

      await expect(client.workspaces()).rejects.toMatchObject({
        name: "RuntimeRpcContractVersionMismatchError",
      });
      await expect(client.workspaces()).rejects.toMatchObject({
        name: "RuntimeRpcContractVersionMismatchError",
      });

      supportsNewContract = true;
      vi.setSystemTime(new Date(CONTRACT_FREEZE_AFTER_TTL_TIME_MS));
      await expect(client.workspaces()).resolves.toEqual([]);

      const calledMethods = fetchMock.mock.calls.map(
        ([, init]) => JSON.parse(String((init as RequestInit | undefined)?.body ?? "{}")).method
      );
      expect(calledMethods.filter((method) => method === "code_rpc_capabilities")).toHaveLength(2);
      expect(calledMethods.filter((method) => method === "code_workspaces_list")).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("resets runtime-gateway-web capabilities cache when auth token changes", async () => {
    vi.stubEnv("VITE_CODE_RUNTIME_GATEWAY_WEB_ENDPOINT", "/__code_runtime_rpc");
    vi.stubEnv("VITE_CODE_RUNTIME_GATEWAY_WEB_AUTH_TOKEN", "token-a");
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
              features: [...FROZEN_RUNTIME_RPC_REQUIRED_FEATURES],
              errorCodes: { ...FROZEN_RUNTIME_RPC_ERROR_CODES },
              compatFieldAliases: { ...FROZEN_RUNTIME_RPC_COMPAT_FIELD_ALIASES },
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
    const capabilitiesProbe = await import("./runtimeClientCapabilitiesProbe");

    await expect(client.workspaces()).resolves.toEqual([]);
    expect(capabilitiesProbe.readCachedWebRuntimeCapabilitiesSnapshot()).not.toBeNull();

    vi.stubEnv("VITE_CODE_RUNTIME_GATEWAY_WEB_AUTH_TOKEN", "token-b");
    expect(capabilitiesProbe.readCachedWebRuntimeCapabilitiesSnapshot()).toBeNull();

    await expect(client.workspaces()).resolves.toEqual([]);

    const capabilityCalls = fetchMock.mock.calls.filter(([, init]) => {
      const body = JSON.parse(String((init as RequestInit | undefined)?.body ?? "{}")) as {
        method?: string;
      };
      return body.method === "code_rpc_capabilities";
    });

    expect(capabilityCalls).toHaveLength(2);
    const headersA = capabilityCalls[0]?.[1] as RequestInit | undefined;
    const headersB = capabilityCalls[1]?.[1] as RequestInit | undefined;
    expect(
      (headersA?.headers as Record<string, string> | undefined)?.["x-code-runtime-auth-token"]
    ).toBe("token-a");
    expect(
      (headersB?.headers as Record<string, string> | undefined)?.["x-code-runtime-auth-token"]
    ).toBe("token-b");
  });

  it("resets runtime-gateway-web capabilities cache when endpoint changes", async () => {
    vi.stubEnv("VITE_CODE_RUNTIME_GATEWAY_WEB_ENDPOINT", "/__code_runtime_rpc_a");
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
              features: [...FROZEN_RUNTIME_RPC_REQUIRED_FEATURES],

              errorCodes: { ...FROZEN_RUNTIME_RPC_ERROR_CODES },

              compatFieldAliases: { ...FROZEN_RUNTIME_RPC_COMPAT_FIELD_ALIASES },
            },
          }),
          { status: 200 }
        );
      }
      if (body.method === "workspaces_list") {
        return new Response(
          JSON.stringify({
            ok: false,
            error: {
              code: "METHOD_NOT_FOUND",
              message: "Legacy alias should not be called: workspaces_list",
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
    const capabilitiesProbe = await import("./runtimeClientCapabilitiesProbe");

    await expect(client.workspaces()).resolves.toEqual([]);
    expect(capabilitiesProbe.readCachedWebRuntimeCapabilitiesSnapshot()).not.toBeNull();

    vi.stubEnv("VITE_CODE_RUNTIME_GATEWAY_WEB_ENDPOINT", "/__code_runtime_rpc_b");
    expect(capabilitiesProbe.readCachedWebRuntimeCapabilitiesSnapshot()).toBeNull();

    await expect(client.workspaces()).resolves.toEqual([]);

    const capabilityCalls = fetchMock.mock.calls.filter(([, init]) => {
      const body = JSON.parse(String((init as RequestInit | undefined)?.body ?? "{}")) as {
        method?: string;
      };
      return body.method === "code_rpc_capabilities";
    });

    expect(capabilityCalls).toHaveLength(2);
    expect(String(capabilityCalls[0]?.[0] ?? "")).toContain("/__code_runtime_rpc_a");
    expect(String(capabilityCalls[1]?.[0] ?? "")).toContain("/__code_runtime_rpc_b");
  });

  it("does not reuse short-lived read cache entries after endpoint changes", async () => {
    vi.stubEnv("VITE_CODE_RUNTIME_GATEWAY_WEB_ENDPOINT", "/__code_runtime_rpc_a");
    isDesktopHostRuntimeMock.mockReturnValue(false);

    const fetchMock = vi.fn(async (input: unknown, init?: RequestInit) => {
      const url = String(input);
      const body = JSON.parse(String(init?.body ?? "{}")) as { method?: string };
      if (body.method === "code_rpc_capabilities") {
        return new Response(
          JSON.stringify({
            ok: true,
            result: {
              contractVersion: CODE_RUNTIME_RPC_CONTRACT_VERSION,
              freezeEffectiveAt: CODE_RUNTIME_RPC_FREEZE_EFFECTIVE_AT,
              methodSetHash: computeCodeRuntimeRpcMethodSetHash(["code_bootstrap_snapshot"]),
              methods: ["code_bootstrap_snapshot"],
              features: [...FROZEN_RUNTIME_RPC_REQUIRED_FEATURES],
              errorCodes: { ...FROZEN_RUNTIME_RPC_ERROR_CODES },
              compatFieldAliases: { ...FROZEN_RUNTIME_RPC_COMPAT_FIELD_ALIASES },
            },
          }),
          { status: 200 }
        );
      }
      if (body.method === "code_bootstrap_snapshot") {
        return new Response(
          JSON.stringify({
            ok: true,
            result: {
              health: {
                status: "ok",
                version: url.includes("_a") ? "endpoint-a" : "endpoint-b",
                now: new Date().toISOString(),
                transport: "http",
                mode: "gateway",
                diagnostics: {},
              },
              settings: { theme: "system" },
              remote: { connected: true },
              terminal: { sessions: [] },
              models: [],
              workspaces: [],
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

    await expect(client.bootstrap()).resolves.toMatchObject({
      health: expect.objectContaining({ version: "endpoint-a" }),
    });

    vi.stubEnv("VITE_CODE_RUNTIME_GATEWAY_WEB_ENDPOINT", "/__code_runtime_rpc_b");

    await expect(client.bootstrap()).resolves.toMatchObject({
      health: expect.objectContaining({ version: "endpoint-b" }),
    });

    const bootstrapCalls = fetchMock.mock.calls.filter(([, init]) => {
      const body = JSON.parse(String((init as RequestInit | undefined)?.body ?? "{}")) as {
        method?: string;
      };
      return body.method === "code_bootstrap_snapshot";
    });

    expect(bootstrapCalls).toHaveLength(2);
    expect(String(bootstrapCalls[0]?.[0] ?? "")).toContain("/__code_runtime_rpc_a");
    expect(String(bootstrapCalls[1]?.[0] ?? "")).toContain("/__code_runtime_rpc_b");
  });

  it("retries retryable web runtime methods on transient fetch failures", async () => {
    vi.useFakeTimers();
    try {
      vi.stubEnv("VITE_CODE_RUNTIME_GATEWAY_WEB_ENDPOINT", "/__code_runtime_rpc");
      isDesktopHostRuntimeMock.mockReturnValue(false);

      const fetchMock = vi
        .fn()
        .mockRejectedValueOnce(new TypeError("Failed to fetch"))
        .mockRejectedValueOnce(new TypeError("Failed to fetch"))
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              ok: true,
              result: [],
            }),
            { status: 200 }
          )
        );
      vi.stubGlobal("fetch", fetchMock);

      const runtime = await importRuntimeClientModule();
      const client = runtime.getRuntimeClient();

      const workspacesPromise = client.workspaces();
      await vi.runAllTimersAsync();
      await expect(workspacesPromise).resolves.toEqual([]);
      expect(fetchMock).toHaveBeenCalledTimes(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not retry non-idempotent sendTurn when web fetch fails", async () => {
    vi.stubEnv("VITE_CODE_RUNTIME_GATEWAY_WEB_ENDPOINT", "/__code_runtime_rpc");
    isDesktopHostRuntimeMock.mockReturnValue(false);

    const fetchMock = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    vi.stubGlobal("fetch", fetchMock);

    const runtime = await importRuntimeClientModule();
    const client = runtime.getRuntimeClient();

    await expect(
      client.sendTurn({
        workspaceId: "workspace-web",
        threadId: "thread-web",
        requestId: "request-web",
        content: "hello",
        provider: null,
        modelId: "gpt-5.3-codex",
        reasonEffort: "high",
        accessMode: "on-request",
        executionMode: "runtime",
        queue: false,
        attachments: [],
      })
    ).rejects.toThrow("Failed to fetch");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const calledMethods = fetchMock.mock.calls.map(
      ([, init]) => JSON.parse(String((init as RequestInit | undefined)?.body ?? "{}")).method
    );
    expect(calledMethods).toEqual(["code_rpc_capabilities", "code_turn_send"]);
  });

  it("uses a bounded 60 second timeout for web runtime turn sends", async () => {
    vi.useFakeTimers();
    try {
      vi.stubEnv("VITE_CODE_RUNTIME_GATEWAY_WEB_ENDPOINT", "/__code_runtime_rpc");
      isDesktopHostRuntimeMock.mockReturnValue(false);

      let turnSendAborted = false;
      const fetchMock = vi.fn((_input: unknown, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body ?? "{}")) as { method?: string };
        if (body.method === "code_rpc_capabilities") {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                ok: true,
                result: createFrozenCapabilitiesPayload({
                  methods: ["code_turn_send"],
                }),
              }),
              { status: 200 }
            )
          );
        }
        if (body.method === "code_turn_send") {
          return new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => {
              turnSendAborted = true;
              reject(new DOMException("Request aborted", "AbortError"));
            });
          });
        }
        return Promise.resolve(
          new Response(JSON.stringify({ ok: true, result: [] }), { status: 200 })
        );
      });
      vi.stubGlobal("fetch", fetchMock);

      const runtime = await importRuntimeClientModule();
      const client = runtime.getRuntimeClient();

      const sendTurnPromise = client.sendTurn({
        workspaceId: "workspace-web",
        threadId: "thread-web",
        requestId: "request-web",
        content: "hello",
        provider: null,
        modelId: "gpt-5.3-codex",
        reasonEffort: "high",
        accessMode: "on-request",
        executionMode: "runtime",
        queue: false,
        attachments: [],
      });
      const settledTurnSend = sendTurnPromise.then(
        (result) => ({ ok: true as const, result }),
        (error) => ({ ok: false as const, error })
      );

      await vi.advanceTimersByTimeAsync(20_001);
      expect(turnSendAborted).toBe(false);
      await vi.advanceTimersByTimeAsync(40_000);
      expect(turnSendAborted).toBe(true);
      const settledResult = await settledTurnSend;
      expect(settledResult.ok).toBe(false);
      expect(String(settledResult.ok ? "" : settledResult.error)).toContain(
        "Web runtime gateway code_turn_send timed out after 60000ms."
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("uses capability-advertised ack timeout for web runtime turn sends", async () => {
    vi.useFakeTimers();
    try {
      vi.stubEnv("VITE_CODE_RUNTIME_GATEWAY_WEB_ENDPOINT", "/__code_runtime_rpc");
      isDesktopHostRuntimeMock.mockReturnValue(false);

      let turnSendAborted = false;
      const fetchMock = vi.fn((_input: unknown, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body ?? "{}")) as { method?: string };
        if (body.method === "code_rpc_capabilities") {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                ok: true,
                result: {
                  ...createFrozenCapabilitiesPayload({
                    methods: ["code_turn_send"],
                  }),
                  capabilities: {
                    rpc: {
                      invocationPolicies: {
                        code_turn_send: {
                          completionMode: "events",
                          ackTimeoutMs: 45_000,
                        },
                      },
                    },
                  },
                },
              }),
              { status: 200 }
            )
          );
        }
        if (body.method === "code_turn_send") {
          return new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => {
              turnSendAborted = true;
              reject(new DOMException("Request aborted", "AbortError"));
            });
          });
        }
        return Promise.resolve(
          new Response(JSON.stringify({ ok: true, result: [] }), { status: 200 })
        );
      });
      vi.stubGlobal("fetch", fetchMock);

      const runtime = await importRuntimeClientModule();
      const client = runtime.getRuntimeClient();

      const sendTurnPromise = client.sendTurn({
        workspaceId: "workspace-web",
        threadId: "thread-web",
        requestId: "request-web",
        content: "hello",
        provider: null,
        modelId: "gpt-5.3-codex",
        reasonEffort: "high",
        accessMode: "on-request",
        executionMode: "runtime",
        queue: false,
        attachments: [],
      });
      const settledTurnSend = sendTurnPromise.then(
        (result) => ({ ok: true as const, result }),
        (error) => ({ ok: false as const, error })
      );

      await vi.advanceTimersByTimeAsync(20_001);
      expect(turnSendAborted).toBe(false);
      await vi.advanceTimersByTimeAsync(25_000);
      expect(turnSendAborted).toBe(true);
      const settledResult = await settledTurnSend;
      expect(settledResult.ok).toBe(false);
      expect(String(settledResult.ok ? "" : settledResult.error)).toContain(
        "Web runtime gateway code_turn_send timed out after 45000ms."
      );

      const capabilitiesProbe = await import("./runtimeClientCapabilitiesProbe");
      const snapshot = capabilitiesProbe.readCachedWebRuntimeCapabilitiesSnapshot();
      expect(snapshot?.invocationPolicies?.get("code_turn_send")).toEqual({
        completionMode: "events",
        ackTimeoutMs: 45_000,
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("returns structured unsupported error on METHOD_NOT_FOUND without alias fallback", async () => {
    isDesktopHostRuntimeMock.mockReturnValue(true);
    invokeMock.mockImplementation(async (method: string) => {
      if (method === "code_workspaces_list") {
        throw {
          code: "METHOD_NOT_FOUND",
          message: "Unknown command code_workspaces_list",
        };
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

  it("rejects providers catalog METHOD_NOT_FOUND without alias fallback", async () => {
    isDesktopHostRuntimeMock.mockReturnValue(true);
    invokeMock.mockImplementation(async (method: string) => {
      if (method === "code_providers_catalog") {
        throw {
          code: "METHOD_NOT_FOUND",
          message: "Unknown command code_providers_catalog",
        };
      }
      return [];
    });

    const runtime = await importRuntimeClientModule();
    const client = runtime.getRuntimeClient();

    await expect(client.providersCatalog()).rejects.toMatchObject({
      name: "RuntimeRpcMethodUnsupportedError",
      method: "code_providers_catalog",
      code: "METHOD_NOT_FOUND",
    });
    expect(invokeMock).toHaveBeenNthCalledWith(1, "code_rpc_capabilities", {});
    expect(invokeMock).toHaveBeenNthCalledWith(2, "code_providers_catalog", {});
    expect(invokeMock).toHaveBeenCalledTimes(2);
  });

  it("forwards sendTurn payload verbatim and uses routed metadata from runtime ack", async () => {
    isDesktopHostRuntimeMock.mockReturnValue(true);
    invokeMock.mockImplementation(async (method: string, params?: Record<string, unknown>) => {
      if (method === "code_rpc_capabilities") {
        return createFrozenCapabilitiesPayload({
          methods: ["code_turn_send"],
        });
      }
      if (method === "code_turn_send") {
        expect(params).toMatchObject({
          payload: expect.objectContaining({
            provider: null,
            modelId: "claude-sonnet-4.5",
          }),
        });
        return {
          accepted: true,
          turnId: "turn-raw-1",
          threadId: "thread-raw-1",
          routedProvider: "anthropic",
          routedModelId: "claude-sonnet-4.5",
          routedPool: "claude",
          routedSource: "oauth-account",
          message: "accepted",
        };
      }
      return [];
    });

    const runtime = await importRuntimeClientModule();
    const client = runtime.getRuntimeClient();

    const ack = await client.sendTurn({
      workspaceId: "workspace-raw-1",
      threadId: "thread-raw-1",
      content: "route by service",
      provider: null,
      modelId: "claude-sonnet-4.5",
      reasonEffort: "high",
      accessMode: "on-request",
      executionMode: "runtime",
      queue: false,
      attachments: [],
    });

    expect(ack).toMatchObject({
      routedProvider: "anthropic",
      routedModelId: "claude-sonnet-4.5",
      routedPool: "claude",
      routedSource: "oauth-account",
    });
  });
});
