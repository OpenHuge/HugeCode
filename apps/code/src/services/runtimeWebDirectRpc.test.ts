import { afterEach, describe, expect, it, vi } from "vitest";
import { invokeWebRuntimeDirectRpc } from "./runtimeWebDirectRpc";

const { invokeWebRuntimeRawMock } = vi.hoisted(() => ({
  invokeWebRuntimeRawMock: vi.fn(),
}));

vi.mock("./runtimeClientWebTransport", () => ({
  invokeWebRuntimeRaw: invokeWebRuntimeRawMock,
}));

describe("runtimeWebDirectRpc", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    invokeWebRuntimeRawMock.mockReset();
  });

  it("delegates to the shared web runtime transport", async () => {
    const result = { ok: true };
    invokeWebRuntimeRawMock.mockResolvedValueOnce(result);

    await expect(
      invokeWebRuntimeDirectRpc("code_models_pool", { workspaceId: "ws-1" })
    ).resolves.toBe(result);

    expect(invokeWebRuntimeRawMock).toHaveBeenCalledWith("code_models_pool", {
      workspaceId: "ws-1",
    });
  });
});
