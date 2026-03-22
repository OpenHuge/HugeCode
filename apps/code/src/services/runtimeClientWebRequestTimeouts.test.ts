import { CODE_RUNTIME_RPC_METHODS } from "@ku0/code-runtime-host-contract";
import { describe, expect, it } from "vitest";
import { resolveWebRuntimeRequestTimeoutMs } from "./runtimeClientWebRequestTimeouts";

describe("resolveWebRuntimeRequestTimeoutMs", () => {
  it("keeps the default timeout for non turn-send methods", () => {
    expect(resolveWebRuntimeRequestTimeoutMs(CODE_RUNTIME_RPC_METHODS.HEALTH, {})).toBe(20_000);
  });

  it("uses capability-advertised policy for any rpc method", () => {
    expect(
      resolveWebRuntimeRequestTimeoutMs(
        CODE_RUNTIME_RPC_METHODS.HEALTH,
        {},
        {
          completionMode: "rpc",
          ackTimeoutMs: 5_000,
        }
      )
    ).toBe(5_000);
  });

  it("falls back to the legacy bounded timeout when invocation policy is unavailable", () => {
    expect(resolveWebRuntimeRequestTimeoutMs(CODE_RUNTIME_RPC_METHODS.TURN_SEND, {})).toBe(60_000);
  });

  it("uses the capability-advertised ack timeout when available", () => {
    expect(
      resolveWebRuntimeRequestTimeoutMs(
        CODE_RUNTIME_RPC_METHODS.TURN_SEND,
        {},
        {
          completionMode: "events",
          ackTimeoutMs: 45_000,
        }
      )
    ).toBe(45_000);
  });

  it("supports explicitly unbounded ack timeouts when capabilities opt into them", () => {
    expect(
      resolveWebRuntimeRequestTimeoutMs(
        CODE_RUNTIME_RPC_METHODS.TURN_SEND,
        {},
        {
          completionMode: "events",
          ackTimeoutMs: null,
        }
      )
    ).toBeNull();
  });
});
