import { describe, expect, it, vi } from "vitest";
import {
  invokeRuntimeExtensionRpc,
  normalizeTerminalSessionSummary,
  RuntimeTerminalStatePayloadError,
} from "./runtimeClientRpcHelpers";

describe("@ku0/code-runtime-client runtimeClientRpcHelpers", () => {
  it("invokes loose extension methods through the typed runtime invoker bridge", async () => {
    const invokeRpc = vi.fn(async (method: string, params: Record<string, unknown>) => ({
      method,
      params,
    }));

    await expect(
      invokeRuntimeExtensionRpc(invokeRpc as never, "custom_method", { value: 1 })
    ).resolves.toEqual({ method: "custom_method", params: { value: 1 } });
  });

  it("throws a typed error when terminal session state is invalid", () => {
    expect(() =>
      normalizeTerminalSessionSummary("terminal_open", {
        sessionId: "session-1",
        state: "broken" as never,
      })
    ).toThrow(RuntimeTerminalStatePayloadError);
  });
});
