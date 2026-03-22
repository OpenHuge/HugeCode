import {
  CODE_RUNTIME_RPC_CONTRACT_VERSION,
  CODE_RUNTIME_RPC_ERROR_CODES,
  CODE_RUNTIME_RPC_FEATURES,
  CODE_RUNTIME_RPC_FREEZE_EFFECTIVE_AT,
  CODE_RUNTIME_RPC_METHODS,
  computeCodeRuntimeRpcMethodSetHash,
} from "@ku0/code-runtime-host-contract";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { discoverLocalRuntimeGatewayTargets } from "./discoverLocalRuntimeGatewayTargets";
import * as runtimeGatewayDiscovery from "../ports/runtimeGatewayDiscovery";

const NON_CANONICAL_RUNTIME_METHOD = "code_runtime_probe_invalid_v1";

function createCapabilitiesPayload(methods: string[]) {
  return {
    contractVersion: CODE_RUNTIME_RPC_CONTRACT_VERSION,
    freezeEffectiveAt: CODE_RUNTIME_RPC_FREEZE_EFFECTIVE_AT,
    methodSetHash: computeCodeRuntimeRpcMethodSetHash(methods),
    methods,
    features: [...CODE_RUNTIME_RPC_FEATURES],
    errorCodes: { ...CODE_RUNTIME_RPC_ERROR_CODES },
  };
}

describe("discoverLocalRuntimeGatewayTargets", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("prefers 127.0.0.1 and returns one candidate per reachable port", async () => {
    const invokeSpy = vi
      .spyOn(runtimeGatewayDiscovery, "invokeRuntimeGatewayDiscoveryProbe")
      .mockImplementation(async (endpoint, method) => {
        expect(method).toBe(CODE_RUNTIME_RPC_METHODS.RPC_CAPABILITIES);
        if (
          endpoint === "http://127.0.0.1:8788/rpc" ||
          endpoint === "http://localhost:8788/rpc" ||
          endpoint === "http://localhost:8789/rpc"
        ) {
          return createCapabilitiesPayload([CODE_RUNTIME_RPC_METHODS.WORKSPACES_LIST]);
        }
        throw new Error("unreachable");
      });

    await expect(
      discoverLocalRuntimeGatewayTargets({ ports: [8788, 8789, 8790] })
    ).resolves.toEqual([
      {
        host: "127.0.0.1",
        port: 8788,
        httpBaseUrl: "http://127.0.0.1:8788/rpc",
        wsBaseUrl: "ws://127.0.0.1:8788/ws",
      },
      {
        host: "localhost",
        port: 8789,
        httpBaseUrl: "http://localhost:8789/rpc",
        wsBaseUrl: "ws://localhost:8789/ws",
      },
    ]);

    expect(invokeSpy).toHaveBeenCalledWith(
      "http://127.0.0.1:8788/rpc",
      CODE_RUNTIME_RPC_METHODS.RPC_CAPABILITIES,
      {},
      900
    );
  });

  it("filters out reachable runtimes that advertise non-canonical methods", async () => {
    vi.spyOn(runtimeGatewayDiscovery, "invokeRuntimeGatewayDiscoveryProbe").mockImplementation(
      async (endpoint) => {
        if (endpoint === "http://127.0.0.1:8788/rpc") {
          return createCapabilitiesPayload([
            NON_CANONICAL_RUNTIME_METHOD,
            CODE_RUNTIME_RPC_METHODS.WORKSPACES_LIST,
          ]);
        }
        if (endpoint === "http://localhost:8789/rpc") {
          return createCapabilitiesPayload([CODE_RUNTIME_RPC_METHODS.WORKSPACES_LIST]);
        }
        throw new Error("unreachable");
      }
    );

    await expect(discoverLocalRuntimeGatewayTargets({ ports: [8788, 8789] })).resolves.toEqual([
      {
        host: "localhost",
        port: 8789,
        httpBaseUrl: "http://localhost:8789/rpc",
        wsBaseUrl: "ws://localhost:8789/ws",
      },
    ]);
  });

  it("ignores invalid ports before probing", async () => {
    const invokeSpy = vi
      .spyOn(runtimeGatewayDiscovery, "invokeRuntimeGatewayDiscoveryProbe")
      .mockResolvedValue([]);

    await discoverLocalRuntimeGatewayTargets({
      ports: [0, 8788, 8788, 70_000, Number.NaN],
    });

    expect(invokeSpy).toHaveBeenCalledTimes(2);
    expect(invokeSpy).toHaveBeenNthCalledWith(
      1,
      "http://127.0.0.1:8788/rpc",
      CODE_RUNTIME_RPC_METHODS.RPC_CAPABILITIES,
      {},
      900
    );
    expect(invokeSpy).toHaveBeenNthCalledWith(
      2,
      "http://localhost:8788/rpc",
      CODE_RUNTIME_RPC_METHODS.RPC_CAPABILITIES,
      {},
      900
    );
  });

  it("returns an empty list without probing when every supplied port is invalid", async () => {
    const invokeSpy = vi.spyOn(runtimeGatewayDiscovery, "invokeRuntimeGatewayDiscoveryProbe");

    await expect(
      discoverLocalRuntimeGatewayTargets({
        ports: [0, -1, 65_536, Number.NaN],
      })
    ).resolves.toEqual([]);

    expect(invokeSpy).not.toHaveBeenCalled();
  });
});
