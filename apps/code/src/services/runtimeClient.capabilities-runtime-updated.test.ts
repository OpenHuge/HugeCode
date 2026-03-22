import {
  CODE_RUNTIME_RPC_CONTRACT_VERSION,
  CODE_RUNTIME_RPC_ERROR_CODES,
  CODE_RUNTIME_RPC_FEATURES,
  CODE_RUNTIME_RPC_FREEZE_EFFECTIVE_AT,
  computeCodeRuntimeRpcMethodSetHash,
} from "@ku0/code-runtime-host-contract";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const invokeMock = vi.hoisted(() => vi.fn());
const isTauriMock = vi.hoisted(() => vi.fn());
const { runtimeUpdatedListeners, subscribeScopedRuntimeUpdatedEventsMock } = vi.hoisted(() => {
  const listeners = new Set<(event: Record<string, unknown>) => void>();
  return {
    runtimeUpdatedListeners: listeners,
    subscribeScopedRuntimeUpdatedEventsMock: vi.fn(
      (_options: unknown, listener: (event: Record<string, unknown>) => void) => {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      }
    ),
  };
});

vi.mock("@tauri-apps/api/core", () => ({
  invoke: invokeMock,
  isTauri: isTauriMock,
}));

vi.mock("./runtimeUpdatedEvents", () => ({
  subscribeScopedRuntimeUpdatedEvents: subscribeScopedRuntimeUpdatedEventsMock,
}));

const CANONICAL_WORKSPACES_METHOD = "code_workspaces_list";
const UPDATED_RUNTIME_FEATURE = "runtime_feature_vnext";

function createFrozenCapabilitiesPayload(
  overrides: Partial<{
    methods: string[];
    features: string[];
  }> = {}
): Record<string, unknown> {
  const methods = overrides.methods ?? [CANONICAL_WORKSPACES_METHOD];
  return {
    contractVersion: CODE_RUNTIME_RPC_CONTRACT_VERSION,
    freezeEffectiveAt: CODE_RUNTIME_RPC_FREEZE_EFFECTIVE_AT,
    methodSetHash: computeCodeRuntimeRpcMethodSetHash(methods),
    methods,
    features: overrides.features ?? [...CODE_RUNTIME_RPC_FEATURES],
    errorCodes: { ...CODE_RUNTIME_RPC_ERROR_CODES },
  };
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

describe("runtime capability cache invalidation", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    isTauriMock.mockReset();
    isTauriMock.mockReturnValue(true);
    subscribeScopedRuntimeUpdatedEventsMock.mockClear();
    runtimeUpdatedListeners.clear();
    clearTauriMarkers();
  });

  afterEach(() => {
    clearTauriMarkers();
  });

  it.each(["runtimeCapabilitiesPatched", "stream_reconnected"])(
    "invalidates cached capabilities after %s events",
    async (reason) => {
      let features = [...CODE_RUNTIME_RPC_FEATURES];
      invokeMock.mockImplementation(async (method: string) => {
        if (method === "code_rpc_capabilities") {
          return createFrozenCapabilitiesPayload({ features });
        }
        return [];
      });

      const runtime = await importRuntimeClientModule();

      const firstSummary = await runtime.readRuntimeCapabilitiesSummary();
      expect(firstSummary.features).not.toContain(UPDATED_RUNTIME_FEATURE);
      expect(subscribeScopedRuntimeUpdatedEventsMock).toHaveBeenCalledWith(
        {
          scopes: ["bootstrap", "models", "oauth"],
        },
        expect.any(Function)
      );

      features = [...CODE_RUNTIME_RPC_FEATURES, UPDATED_RUNTIME_FEATURE];
      for (const listener of runtimeUpdatedListeners) {
        listener({
          scope: ["bootstrap", "models", "oauth"],
          reason,
          event: { method: "native_state_fabric_updated" },
          eventWorkspaceId: "",
          paramsWorkspaceId: null,
          isWorkspaceLocalEvent: false,
        });
      }

      const secondSummary = await runtime.readRuntimeCapabilitiesSummary();
      expect(secondSummary.features).toContain(UPDATED_RUNTIME_FEATURE);
      expect(
        invokeMock.mock.calls.filter(([method]) => method === "code_rpc_capabilities")
      ).toHaveLength(2);
    }
  );
});
