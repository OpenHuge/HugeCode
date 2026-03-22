import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getNativeStateFabricDelta,
  getNativeStateFabricDiagnostics,
  getNativeStateFabricSnapshot,
} from "./tauriRuntimeStateFabricBridge";

const { invokeMock, isTauriMock, detectRuntimeModeMock, invokeWebRuntimeDirectRpcMock } =
  vi.hoisted(() => ({
    invokeMock: vi.fn(),
    isTauriMock: vi.fn(),
    detectRuntimeModeMock: vi.fn(),
    invokeWebRuntimeDirectRpcMock: vi.fn(),
  }));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: invokeMock,
  isTauri: isTauriMock,
}));

vi.mock("./runtimeClient", () => ({
  detectRuntimeMode: detectRuntimeModeMock,
}));

vi.mock("./runtimeWebDirectRpc", () => ({
  invokeWebRuntimeDirectRpc: invokeWebRuntimeDirectRpcMock,
}));

describe("tauriRuntimeStateFabricBridge", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    isTauriMock.mockReset();
    detectRuntimeModeMock.mockReset();
    invokeWebRuntimeDirectRpcMock.mockReset();
    isTauriMock.mockReturnValue(true);
    detectRuntimeModeMock.mockReturnValue("native");
  });

  it("reads state fabric snapshots through tauri invoke", async () => {
    invokeMock.mockResolvedValue({
      revision: 7,
      scope: { kind: "workspace", workspaceId: "ws-1" },
      state: { workspace: { id: "ws-1" } },
    });

    await expect(
      getNativeStateFabricSnapshot({ kind: "workspace", workspaceId: "ws-1" })
    ).resolves.toEqual({
      revision: 7,
      scope: { kind: "workspace", workspaceId: "ws-1" },
      state: { workspace: { id: "ws-1" } },
    });

    expect(invokeMock).toHaveBeenCalledWith("native_state_fabric_snapshot", {
      scope: { kind: "workspace", workspaceId: "ws-1" },
    });
  });

  it("reads state fabric deltas through runtime gateway direct rpc", async () => {
    isTauriMock.mockReturnValue(false);
    detectRuntimeModeMock.mockReturnValue("runtime-gateway-web");
    invokeWebRuntimeDirectRpcMock.mockResolvedValue({
      baseRevision: 4,
      revision: 6,
      scope: { kind: "thread", workspaceId: "ws-1", threadId: "thread-1" },
      changes: [
        {
          revision: 6,
          emittedAt: 123,
          scopeHints: [{ kind: "thread", workspaceId: "ws-1", threadId: "thread-1" }],
          change: { kind: "threadLiveStatePatched", workspaceId: "ws-1", threadId: "thread-1" },
        },
      ],
    });

    await expect(
      getNativeStateFabricDelta({
        scope: { kind: "thread", workspaceId: "ws-1", threadId: "thread-1" },
        revision: 4,
      })
    ).resolves.toEqual({
      baseRevision: 4,
      revision: 6,
      scope: { kind: "thread", workspaceId: "ws-1", threadId: "thread-1" },
      changes: [
        {
          revision: 6,
          emittedAt: 123,
          scopeHints: [{ kind: "thread", workspaceId: "ws-1", threadId: "thread-1" }],
          change: {
            kind: "threadLiveStatePatched",
            workspaceId: "ws-1",
            threadId: "thread-1",
          },
        },
      ],
    });

    expect(invokeWebRuntimeDirectRpcMock).toHaveBeenCalledWith("native_state_fabric_delta", {
      scope: { kind: "thread", workspaceId: "ws-1", threadId: "thread-1" },
      revision: 4,
    });
  });

  it("normalizes diagnostics envelopes returned under result", async () => {
    invokeMock.mockResolvedValue({
      result: {
        revision: 9,
        oldestAvailableRevision: null,
        retainedChangeCount: 3,
        projectionKeys: ["global", "workspace"],
      },
    });

    await expect(getNativeStateFabricDiagnostics()).resolves.toEqual({
      revision: 9,
      oldestAvailableRevision: null,
      retainedChangeCount: 3,
      projectionKeys: ["global", "workspace"],
    });
  });

  it("normalizes task snapshots and run delta envelopes", async () => {
    invokeMock
      .mockResolvedValueOnce({
        revision: 12,
        scope: { kind: "task", taskId: "task-1" },
        state: { task: { taskId: "task-1" } },
      })
      .mockResolvedValueOnce({
        baseRevision: 12,
        revision: 13,
        scope: { kind: "run", runId: "run-1" },
        changes: [
          {
            revision: 13,
            emittedAt: 456,
            scopeHints: [
              { kind: "task", taskId: "task-1" },
              { kind: "run", runId: "run-1" },
            ],
            change: {
              kind: "runUpsert",
              workspaceId: "ws-1",
              taskId: "task-1",
              runId: "run-1",
            },
          },
        ],
      });

    await expect(getNativeStateFabricSnapshot({ kind: "task", taskId: "task-1" })).resolves.toEqual(
      {
        revision: 12,
        scope: { kind: "task", taskId: "task-1" },
        state: { task: { taskId: "task-1" } },
      }
    );

    await expect(
      getNativeStateFabricDelta({
        scope: { kind: "run", runId: "run-1" },
        revision: 12,
      })
    ).resolves.toEqual({
      baseRevision: 12,
      revision: 13,
      scope: { kind: "run", runId: "run-1" },
      changes: [
        {
          revision: 13,
          emittedAt: 456,
          scopeHints: [
            { kind: "task", taskId: "task-1" },
            { kind: "run", runId: "run-1" },
          ],
          change: {
            kind: "runUpsert",
            workspaceId: "ws-1",
            taskId: "task-1",
            runId: "run-1",
          },
        },
      ],
    });
  });
});
