import { describe, expect, it, vi } from "vitest";
import {
  invokeRuntimeExtensionRpc,
  normalizeNullableTerminalSessionSummary,
  normalizeTerminalSessionSummary,
  normalizeTerminalStatus,
  RuntimeTerminalStatePayloadError,
} from "./runtimeClientRpcHelpers";

describe("runtimeClientRpcHelpers", () => {
  it("invokes loose extension rpc methods through the typed invoker bridge", async () => {
    const invokeRpc = vi.fn(async (method: string, params: Record<string, unknown>) => ({
      method,
      params,
    }));

    await expect(
      invokeRuntimeExtensionRpc(invokeRpc as never, "custom_method", { value: 1 })
    ).resolves.toEqual({ method: "custom_method", params: { value: 1 } });
  });

  it("normalizes terminal session summaries and nullable session summaries", () => {
    expect(
      normalizeTerminalSessionSummary("terminal_open", {
        sessionId: "session-1",
        state: "created",
      })
    ).toEqual({ sessionId: "session-1", state: "created" });

    expect(normalizeNullableTerminalSessionSummary("terminal_status", null)).toBeNull();
  });

  it("throws a typed error when terminal session state is invalid", () => {
    expect(() =>
      normalizeTerminalSessionSummary("terminal_open", {
        sessionId: "session-1",
        state: "broken" as never,
      })
    ).toThrow(RuntimeTerminalStatePayloadError);
  });

  it("normalizes terminal status and rejects invalid status states", () => {
    expect(
      normalizeTerminalStatus("terminal_status", {
        state: "ready",
      })
    ).toEqual({ state: "ready" });

    expect(() =>
      normalizeTerminalStatus("terminal_status", {
        state: "broken" as never,
      })
    ).toThrow(RuntimeTerminalStatePayloadError);
  });
});
