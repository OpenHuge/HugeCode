import {
  CODE_RUNTIME_RPC_ERROR_CODES,
  CODE_RUNTIME_RPC_METHODS,
  type CodeRuntimeRpcMethod,
} from "@ku0/code-runtime-host-contract";
import { describe, expect, it } from "vitest";
import type { RuntimeRpcCapabilitiesSnapshot } from "./runtimeClientCapabilitiesContract";
import { RuntimeRpcInvocationError } from "./runtimeClientErrorUtils";
import {
  assertRuntimeRpcMethodSupportedByCapabilities,
  createRuntimeRpcCapabilitiesProbeCache,
  readCachedRuntimeCapabilitiesSnapshot,
  resolveRuntimeRpcCapabilitiesWithCache,
} from "./runtimeClientCapabilitiesProbeCore";
import { invokeRuntimeRpcAcrossCandidates } from "./runtimeClientTransportCore";
import { RuntimeRpcMethodUnsupportedError } from "./runtimeClientTransportShared";

function pickNonCapabilitiesMethod(): CodeRuntimeRpcMethod {
  const method = Object.values(CODE_RUNTIME_RPC_METHODS).find(
    (candidate) => candidate !== CODE_RUNTIME_RPC_METHODS.RPC_CAPABILITIES
  );
  if (!method) {
    throw new Error("Expected at least one non-capabilities runtime RPC method.");
  }
  return method;
}

function createSnapshot(methods: readonly CodeRuntimeRpcMethod[]): RuntimeRpcCapabilitiesSnapshot {
  return {
    methods: new Set(methods),
    profile: null,
    contractVersion: null,
    freezeEffectiveAt: null,
    methodSetHash: null,
    features: new Set<string>(),
    errorCodes: null,
    wsEndpointPath: "/rpc",
  };
}

describe("@ku0/code-runtime-client migration core", () => {
  it("falls through method-not-found candidates before succeeding", async () => {
    const method = pickNonCapabilitiesMethod();

    const result = await invokeRuntimeRpcAcrossCandidates<{ candidate: string }>(
      async (candidate) => {
        if (candidate === "legacy") {
          throw new RuntimeRpcInvocationError({
            code: CODE_RUNTIME_RPC_ERROR_CODES.METHOD_NOT_FOUND,
            message: "legacy entrypoint is unavailable",
          });
        }
        return { candidate };
      },
      method,
      {},
      async () => ["legacy", method]
    );

    expect(result).toEqual({ candidate: method });
  });

  it("caches capabilities snapshots across repeated probes", async () => {
    const method = pickNonCapabilitiesMethod();
    const snapshot = createSnapshot([CODE_RUNTIME_RPC_METHODS.RPC_CAPABILITIES, method]);
    const cache = createRuntimeRpcCapabilitiesProbeCache();
    let probeCalls = 0;

    const first = await resolveRuntimeRpcCapabilitiesWithCache(cache, async () => {
      probeCalls += 1;
      return { snapshot, cacheable: true };
    });
    const second = await resolveRuntimeRpcCapabilitiesWithCache(cache, async () => {
      probeCalls += 1;
      return { snapshot: null, cacheable: true };
    });

    expect(first).toBe(snapshot);
    expect(second).toBe(snapshot);
    expect(readCachedRuntimeCapabilitiesSnapshot(cache)).toBe(snapshot);
    expect(probeCalls).toBe(1);
  });

  it("rejects methods missing from an advertised capabilities snapshot", () => {
    const method = pickNonCapabilitiesMethod();
    const snapshot = {
      ...createSnapshot([CODE_RUNTIME_RPC_METHODS.RPC_CAPABILITIES]),
      contractVersion: 1,
    };

    expect(() => assertRuntimeRpcMethodSupportedByCapabilities(method, snapshot)).toThrow(
      RuntimeRpcMethodUnsupportedError
    );
  });
});
