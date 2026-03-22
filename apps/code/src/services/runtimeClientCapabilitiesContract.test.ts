import {
  CODE_RUNTIME_RPC_CONTRACT_VERSION,
  CODE_RUNTIME_RPC_ERROR_CODES,
  CODE_RUNTIME_RPC_FEATURES,
  CODE_RUNTIME_RPC_FREEZE_EFFECTIVE_AT,
  computeCodeRuntimeRpcMethodSetHash,
} from "@ku0/code-runtime-host-contract";
import { describe, expect, it } from "vitest";
import { normalizeRpcCapabilitiesPayload } from "./runtimeClientCapabilitiesContract";

function createCapabilitiesPayload(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  const methods = ["code_turn_send"];
  return {
    contractVersion: CODE_RUNTIME_RPC_CONTRACT_VERSION,
    freezeEffectiveAt: CODE_RUNTIME_RPC_FREEZE_EFFECTIVE_AT,
    methodSetHash: computeCodeRuntimeRpcMethodSetHash(methods),
    methods,
    features: [...CODE_RUNTIME_RPC_FEATURES],
    errorCodes: { ...CODE_RUNTIME_RPC_ERROR_CODES },
    ...overrides,
  };
}

describe("normalizeRpcCapabilitiesPayload", () => {
  it("parses invocation policies from capabilities metadata", () => {
    const snapshot = normalizeRpcCapabilitiesPayload(
      createCapabilitiesPayload({
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
      })
    );

    expect(snapshot?.invocationPolicies?.get("code_turn_send")).toEqual({
      completionMode: "events",
      ackTimeoutMs: 45_000,
    });
  });

  it("accepts snake_case invocation policy fields for compatibility", () => {
    const snapshot = normalizeRpcCapabilitiesPayload(
      createCapabilitiesPayload({
        capabilities: {
          rpc: {
            invocation_policies: {
              code_turn_send: {
                completion_mode: "events",
                ack_timeout_ms: null,
              },
            },
          },
        },
      })
    );

    expect(snapshot?.invocationPolicies?.get("code_turn_send")).toEqual({
      completionMode: "events",
      ackTimeoutMs: null,
    });
  });

  it("ignores malformed invocation policies instead of poisoning the snapshot", () => {
    const snapshot = normalizeRpcCapabilitiesPayload(
      createCapabilitiesPayload({
        capabilities: {
          rpc: {
            invocationPolicies: {
              code_turn_send: {
                completionMode: "not-a-real-mode",
                ackTimeoutMs: 45_000,
              },
              " ": {
                completionMode: "events",
                ackTimeoutMs: 30_000,
              },
            },
          },
        },
      })
    );

    expect(snapshot?.invocationPolicies).toBeUndefined();
  });

  it("accepts canonical capability payloads without compat alias metadata", () => {
    const snapshot = normalizeRpcCapabilitiesPayload(createCapabilitiesPayload());

    expect(snapshot?.contractVersion).toBe(CODE_RUNTIME_RPC_CONTRACT_VERSION);
    expect(snapshot?.methods.has("code_turn_send")).toBe(true);
  });
});
