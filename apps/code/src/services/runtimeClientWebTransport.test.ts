import { CODE_RUNTIME_RPC_METHODS } from "@ku0/code-runtime-host-contract";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RuntimeRpcInvocationError } from "@ku0/code-runtime-client/runtimeClientErrorUtils";
import { invokeWebRuntimeRaw } from "./runtimeClientWebTransport";

const {
  computeWebRuntimeRetryDelayMsMock,
  invokeWebRuntimeRawAttemptMock,
  resolveWebRuntimeAuthTokenMock,
  resolveWebRuntimeEndpointMock,
  resolveWebRuntimeRequestTimeoutMsMock,
  resolveWebRuntimeWsRpcEndpointMock,
  shouldRetryWebRuntimeInvocationMock,
  sleepMock,
} = vi.hoisted(() => ({
  computeWebRuntimeRetryDelayMsMock: vi.fn(),
  invokeWebRuntimeRawAttemptMock: vi.fn(),
  resolveWebRuntimeAuthTokenMock: vi.fn(),
  resolveWebRuntimeEndpointMock: vi.fn(),
  resolveWebRuntimeRequestTimeoutMsMock: vi.fn(),
  resolveWebRuntimeWsRpcEndpointMock: vi.fn(),
  shouldRetryWebRuntimeInvocationMock: vi.fn(),
  sleepMock: vi.fn(),
}));

vi.mock("./runtimeClientCapabilitiesProbe", () => ({
  readCachedWebRuntimeCapabilitiesSnapshot: () => null,
  resolveWebRuntimeWsRpcEndpoint: resolveWebRuntimeWsRpcEndpointMock,
}));

vi.mock("./runtimeClientWebHttpTransport", () => ({
  invokeWebRuntimeRawAttempt: invokeWebRuntimeRawAttemptMock,
}));

vi.mock("./runtimeClientWebGateway", () => ({
  resolveWebRuntimeAuthToken: resolveWebRuntimeAuthTokenMock,
  resolveWebRuntimeEndpoint: resolveWebRuntimeEndpointMock,
}));

vi.mock("@ku0/code-runtime-client/runtimeClientWebRequestTimeouts", () => ({
  resolveWebRuntimeRequestTimeoutMs: resolveWebRuntimeRequestTimeoutMsMock,
}));

vi.mock("@ku0/code-runtime-client/runtimeClientWebRetryUtils", () => ({
  computeWebRuntimeRetryDelayMs: computeWebRuntimeRetryDelayMsMock,
  shouldRetryWebRuntimeInvocation: shouldRetryWebRuntimeInvocationMock,
  sleep: sleepMock,
}));

describe("runtimeClientWebTransport", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.restoreAllMocks();
    computeWebRuntimeRetryDelayMsMock.mockReset();
    invokeWebRuntimeRawAttemptMock.mockReset();
    resolveWebRuntimeAuthTokenMock.mockReset();
    resolveWebRuntimeEndpointMock.mockReset();
    resolveWebRuntimeRequestTimeoutMsMock.mockReset();
    resolveWebRuntimeWsRpcEndpointMock.mockReset();
    shouldRetryWebRuntimeInvocationMock.mockReset();
    sleepMock.mockReset();
  });

  it("uses the remaining timeout budget across retries", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    vi.stubGlobal("fetch", vi.fn());

    resolveWebRuntimeEndpointMock.mockReturnValue("http://127.0.0.1:8788/rpc");
    resolveWebRuntimeWsRpcEndpointMock.mockResolvedValue(null);
    resolveWebRuntimeRequestTimeoutMsMock.mockReturnValue(1_000);

    const firstFailure = new RuntimeRpcInvocationError({
      code: "internal_error",
      message: "timed out",
      details: { timeoutMs: 1_000 },
    });

    invokeWebRuntimeRawAttemptMock
      .mockImplementationOnce(async (_endpoint, _method, _params, timeoutMs) => {
        expect(timeoutMs).toBe(1_000);
        vi.setSystemTime(700);
        throw firstFailure;
      })
      .mockImplementationOnce(async (_endpoint, _method, _params, timeoutMs) => {
        expect(timeoutMs).toBe(290);
        return { workspaces: [] };
      });

    shouldRetryWebRuntimeInvocationMock.mockReturnValue(true);
    computeWebRuntimeRetryDelayMsMock.mockImplementation((_attempt, cause, maxDelayMs) => {
      expect(cause).toBe(firstFailure);
      expect(maxDelayMs).toBe(300);
      return 10;
    });
    sleepMock.mockImplementation(async (delayMs: number) => {
      expect(delayMs).toBe(10);
      vi.setSystemTime(710);
    });

    await expect(
      invokeWebRuntimeRaw(CODE_RUNTIME_RPC_METHODS.WORKSPACES_LIST, {})
    ).resolves.toEqual({
      workspaces: [],
    });

    expect(invokeWebRuntimeRawAttemptMock).toHaveBeenCalledTimes(2);
  });

  it("does not reuse short read cache entries across auth token changes", async () => {
    vi.stubGlobal("fetch", vi.fn());

    resolveWebRuntimeEndpointMock.mockReturnValue("http://127.0.0.1:8788/rpc");
    resolveWebRuntimeAuthTokenMock.mockReturnValueOnce("token-a").mockReturnValueOnce("token-b");
    resolveWebRuntimeWsRpcEndpointMock.mockResolvedValue(null);
    resolveWebRuntimeRequestTimeoutMsMock.mockReturnValue(1_000);
    shouldRetryWebRuntimeInvocationMock.mockReturnValue(false);

    invokeWebRuntimeRawAttemptMock
      .mockResolvedValueOnce({ workspaceId: "ws-1", threadId: "thread-a" })
      .mockResolvedValueOnce({ workspaceId: "ws-1", threadId: "thread-b" });

    await expect(
      invokeWebRuntimeRaw(CODE_RUNTIME_RPC_METHODS.BOOTSTRAP_SNAPSHOT, { workspaceId: "ws-1" })
    ).resolves.toEqual({ workspaceId: "ws-1", threadId: "thread-a" });

    await expect(
      invokeWebRuntimeRaw(CODE_RUNTIME_RPC_METHODS.BOOTSTRAP_SNAPSHOT, { workspaceId: "ws-1" })
    ).resolves.toEqual({ workspaceId: "ws-1", threadId: "thread-b" });

    expect(invokeWebRuntimeRawAttemptMock).toHaveBeenCalledTimes(2);
  });
});
