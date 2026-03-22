import { beforeEach, describe, expect, it, vi } from "vitest";
import { connectManualRuntimeGateway } from "./connectManualRuntimeGateway";
import * as runtimeGatewayDiscovery from "../ports/runtimeGatewayDiscovery";
import * as runtimeWebGatewayConfig from "../ports/runtimeWebGatewayConfig";

describe("connectManualRuntimeGateway", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("tries localhost and 127.0.0.1 when no host override is provided", async () => {
    const configureSpy = vi.spyOn(
      runtimeWebGatewayConfig,
      "configureManualWebRuntimeGatewayTarget"
    );
    const probeSpy = vi
      .spyOn(runtimeGatewayDiscovery, "invokeRuntimeGatewayDiscoveryProbe")
      .mockRejectedValueOnce(new Error("localhost failed"))
      .mockResolvedValueOnce([]);
    vi.spyOn(runtimeWebGatewayConfig, "readManualWebRuntimeGatewayTarget").mockReturnValue(null);
    const refreshWorkspaces = vi.fn<() => Promise<unknown>>().mockResolvedValue([]);

    await connectManualRuntimeGateway({
      host: null,
      port: 8788,
      refreshWorkspaces,
    });

    expect(configureSpy).toHaveBeenCalledTimes(1);
    expect(configureSpy).toHaveBeenCalledWith({ host: "127.0.0.1", port: 8788 });
    expect(probeSpy).toHaveBeenNthCalledWith(
      1,
      "http://localhost:8788/rpc",
      "code_workspaces_list",
      {},
      2_000
    );
    expect(probeSpy).toHaveBeenNthCalledWith(
      2,
      "http://127.0.0.1:8788/rpc",
      "code_workspaces_list",
      {},
      2_000
    );
  });

  it("treats a reachable runtime with no workspaces as a successful connection", async () => {
    const configureSpy = vi.spyOn(
      runtimeWebGatewayConfig,
      "configureManualWebRuntimeGatewayTarget"
    );
    vi.spyOn(runtimeGatewayDiscovery, "invokeRuntimeGatewayDiscoveryProbe").mockResolvedValue([]);
    vi.spyOn(runtimeWebGatewayConfig, "readManualWebRuntimeGatewayTarget").mockReturnValue(null);
    const refreshWorkspaces = vi.fn<() => Promise<unknown>>().mockResolvedValue([]);

    await connectManualRuntimeGateway({
      host: "runtime.example.com",
      port: 9001,
      refreshWorkspaces,
    });

    expect(configureSpy).toHaveBeenCalledTimes(1);
    expect(configureSpy).toHaveBeenCalledWith({
      host: "runtime.example.com",
      port: 9001,
    });
    expect(refreshWorkspaces).toHaveBeenCalledTimes(1);
  });

  it("uses the provided remote host directly", async () => {
    const configureSpy = vi.spyOn(
      runtimeWebGatewayConfig,
      "configureManualWebRuntimeGatewayTarget"
    );
    vi.spyOn(runtimeGatewayDiscovery, "invokeRuntimeGatewayDiscoveryProbe").mockResolvedValue([]);
    vi.spyOn(runtimeWebGatewayConfig, "readManualWebRuntimeGatewayTarget").mockReturnValue(null);
    const refreshWorkspaces = vi.fn<() => Promise<unknown>>().mockResolvedValue([{ id: "ws-1" }]);

    await connectManualRuntimeGateway({
      host: "runtime.example.com",
      port: 9001,
      refreshWorkspaces,
    });

    expect(configureSpy).toHaveBeenCalledTimes(1);
    expect(configureSpy).toHaveBeenCalledWith({
      host: "runtime.example.com",
      port: 9001,
    });
  });

  it("does not block on a slow workspace refresh after a successful probe", async () => {
    vi.spyOn(runtimeGatewayDiscovery, "invokeRuntimeGatewayDiscoveryProbe").mockResolvedValue([]);
    vi.spyOn(runtimeWebGatewayConfig, "readManualWebRuntimeGatewayTarget").mockReturnValue(null);
    const refreshWorkspaces = vi.fn<() => Promise<unknown>>(() => new Promise(() => undefined));

    await expect(
      connectManualRuntimeGateway({
        host: "runtime.example.com",
        port: 9001,
        refreshWorkspaces,
      })
    ).resolves.toBeUndefined();
  });

  it("restores the previous target after all attempts fail", async () => {
    const configureSpy = vi.spyOn(
      runtimeWebGatewayConfig,
      "configureManualWebRuntimeGatewayTarget"
    );
    const clearSpy = vi.spyOn(runtimeWebGatewayConfig, "clearManualWebRuntimeGatewayTarget");
    vi.spyOn(runtimeGatewayDiscovery, "invokeRuntimeGatewayDiscoveryProbe").mockRejectedValue(
      new Error("runtime unavailable")
    );
    vi.spyOn(runtimeWebGatewayConfig, "readManualWebRuntimeGatewayTarget").mockReturnValue({
      host: "runtime.previous.dev",
      port: 7777,
    });
    const refreshWorkspaces = vi.fn<() => Promise<unknown>>().mockResolvedValue(null);

    await expect(
      connectManualRuntimeGateway({
        host: null,
        port: 8788,
        refreshWorkspaces,
      })
    ).rejects.toThrow(
      "Unable to reach a local runtime on port 8788. Tried localhost and 127.0.0.1. Verify the runtime is running and exposes /rpc."
    );

    expect(configureSpy).toHaveBeenLastCalledWith({
      host: "runtime.previous.dev",
      port: 7777,
    });
    expect(clearSpy).not.toHaveBeenCalled();
  });
});
