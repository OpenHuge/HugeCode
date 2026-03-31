// @vitest-environment jsdom

import { renderHook, waitFor } from "@testing-library/react";
import { act } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as runtimeEvents from "../../../application/runtime/ports/events";
import {
  openTerminalSession,
  readTerminalSession,
  resizeTerminalSession,
  writeTerminalSessionRaw,
} from "../../../application/runtime/ports/terminal";
import { getRuntimeTerminalStatus } from "../../../application/runtime/ports/runtime";
import { detectRuntimeMode } from "../../../application/runtime/ports/runtimeClientMode";
import type { WorkspaceInfo } from "../../../types";
import { useTerminalSession } from "./useTerminalSession";

const terminalMock = {
  cols: 120,
  rows: 40,
  loadAddon: vi.fn(),
  open: vi.fn(),
  write: vi.fn(),
  reset: vi.fn(),
  refresh: vi.fn(),
  focus: vi.fn(),
  dispose: vi.fn(),
  onData: vi.fn(() => ({ dispose: vi.fn() })),
};

const fitAddonMock = {
  fit: vi.fn(),
};

vi.mock("@xterm/xterm", () => ({
  Terminal: vi.fn(function TerminalMock() {
    return terminalMock;
  }),
}));

vi.mock("@xterm/addon-fit", () => ({
  FitAddon: vi.fn(function FitAddonMock() {
    return fitAddonMock;
  }),
}));

vi.mock("../../../application/runtime/ports/events", () => ({
  subscribeAppServerEvents: vi.fn(() => () => undefined),
  subscribeTerminalExit: vi.fn(() => () => undefined),
}));

vi.mock("../../../application/runtime/ports/terminal", () => ({
  openTerminalSession: vi.fn(),
  readTerminalSession: vi.fn(),
  resizeTerminalSession: vi.fn(),
  writeTerminalSessionRaw: vi.fn(),
}));

vi.mock("../../../application/runtime/ports/runtimeClientMode", () => ({
  detectRuntimeMode: vi.fn(() => "desktop-host"),
}));

vi.mock("../../../application/runtime/ports/runtime", () => ({
  getRuntimeTerminalStatus: vi.fn(),
}));

if (!("ResizeObserver" in globalThis)) {
  class ResizeObserverMock {
    observe() {
      return;
    }
    disconnect() {
      return;
    }
  }
  Object.defineProperty(globalThis, "ResizeObserver", { value: ResizeObserverMock });
}

describe("useTerminalSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    terminalMock.cols = 120;
    terminalMock.rows = 40;
    vi.mocked(detectRuntimeMode).mockReturnValue("desktop-host");
    vi.mocked(getRuntimeTerminalStatus).mockResolvedValue({
      state: "ready",
      message: "Terminal runtime ready.",
    });
    vi.mocked(resizeTerminalSession).mockResolvedValue(undefined);
    vi.mocked(writeTerminalSessionRaw).mockResolvedValue(true);
  });

  it("does not open the same terminal session twice while first open is in flight", async () => {
    let resolveOpen!: (value: {
      id: string;
      initialLines: string[];
      state: "created" | "exited" | "ioFailed" | "unsupported";
    }) => void;
    const openPromise = new Promise<{
      id: string;
      initialLines: string[];
      state: "created" | "exited" | "ioFailed" | "unsupported";
    }>((resolve) => {
      resolveOpen = resolve;
    });
    vi.mocked(openTerminalSession).mockReturnValue(openPromise);
    vi.mocked(readTerminalSession).mockResolvedValue(null);

    const onDebug = vi.fn();
    const initialWorkspace: WorkspaceInfo = {
      id: "ws-1",
      name: "Workspace 1",
      path: "/tmp/ws-1",
      connected: true,
      settings: {
        sidebarCollapsed: false,
      },
    };

    const { result, rerender } = renderHook(
      ({ workspace, isVisible }) =>
        useTerminalSession({
          activeWorkspace: workspace,
          activeTerminalId: "terminal-1",
          isVisible,
          onDebug,
        }),
      {
        initialProps: { workspace: initialWorkspace, isVisible: false },
      }
    );

    act(() => {
      result.current.containerRef.current = document.createElement("div");
    });

    rerender({ workspace: initialWorkspace, isVisible: true });
    await waitFor(
      () => {
        expect(openTerminalSession).toHaveBeenCalledTimes(1);
      },
      { timeout: 6_000 }
    );

    rerender({
      workspace: { ...initialWorkspace },
      isVisible: true,
    });
    expect(openTerminalSession).toHaveBeenCalledTimes(1);

    resolveOpen({
      id: "runtime-session-1",
      initialLines: [],
      state: "created",
    });

    await waitFor(() => {
      expect(result.current.status).toBe("ready");
    });
  });

  it("polls terminal readback in runtime-gateway-web mode when desktop host output events are unavailable", async () => {
    vi.mocked(detectRuntimeMode).mockReturnValue("runtime-gateway-web");
    vi.mocked(openTerminalSession).mockResolvedValue({
      id: "runtime-session-2",
      initialLines: [],
      state: "created",
    });
    vi.mocked(readTerminalSession)
      .mockResolvedValueOnce(null)
      .mockResolvedValue({
        id: "runtime-session-2",
        workspaceId: "ws-web",
        state: "created",
        createdAt: 1,
        updatedAt: 2,
        lines: ["web runtime marker"],
      });

    const onDebug = vi.fn();
    const workspace: WorkspaceInfo = {
      id: "ws-web",
      name: "Workspace Web",
      path: "/tmp/ws-web",
      connected: true,
      settings: {
        sidebarCollapsed: false,
      },
    };

    const { result, rerender } = renderHook(
      ({ isVisible }) =>
        useTerminalSession({
          activeWorkspace: workspace,
          activeTerminalId: "terminal-web-1",
          isVisible,
          onDebug,
        }),
      {
        initialProps: { isVisible: false },
      }
    );

    act(() => {
      result.current.containerRef.current = document.createElement("div");
    });

    rerender({ isVisible: true });

    await waitFor(() => {
      expect(result.current.status).toBe("ready");
    });

    await waitFor(() => {
      expect(readTerminalSession.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    expect(terminalMock.write).toHaveBeenCalledWith("web runtime marker\n");
  });

  it("streams terminal output from native state fabric updates without terminal output subscriptions", async () => {
    const appServerListeners = new Set<
      Parameters<typeof runtimeEvents.subscribeAppServerEvents>[0]
    >();
    vi.mocked(runtimeEvents.subscribeAppServerEvents).mockImplementation((onEvent) => {
      appServerListeners.add(onEvent);
      return () => {
        appServerListeners.delete(onEvent);
      };
    });
    vi.mocked(openTerminalSession).mockResolvedValue({
      id: "runtime-session-fabric-1",
      initialLines: [],
      state: "created",
    });
    vi.mocked(readTerminalSession).mockResolvedValue({
      id: "runtime-session-fabric-1",
      workspaceId: "ws-fabric",
      state: "created",
      createdAt: 1,
      updatedAt: 2,
      lines: [],
    });

    const workspace: WorkspaceInfo = {
      id: "ws-fabric",
      name: "Workspace Fabric",
      path: "/tmp/ws-fabric",
      connected: true,
      settings: {
        sidebarCollapsed: false,
      },
    };

    const { result, rerender } = renderHook(
      ({ isVisible }) =>
        useTerminalSession({
          activeWorkspace: workspace,
          activeTerminalId: "terminal-fabric-1",
          isVisible,
        }),
      {
        initialProps: { isVisible: false },
      }
    );

    act(() => {
      result.current.containerRef.current = document.createElement("div");
    });
    rerender({ isVisible: true });

    await waitFor(() => {
      expect(result.current.status).toBe("ready");
    });

    act(() => {
      for (const listener of appServerListeners) {
        listener({
          workspace_id: "ws-fabric",
          message: {
            method: "native_state_fabric_updated",
            params: {
              scopeKind: "terminal",
              changeKind: "terminalOutputAppended",
              workspaceId: "ws-fabric",
              sessionId: "terminal-fabric-1",
              chunk: "hello fabric",
            },
          },
        });
      }
    });

    expect(terminalMock.write).toHaveBeenCalledWith("hello fabric");
  });

  it("treats missing terminal session state as unknown and reports an error", async () => {
    vi.mocked(detectRuntimeMode).mockReturnValue("runtime-gateway-web");
    vi.mocked(openTerminalSession).mockResolvedValue({
      id: "runtime-session-legacy-1",
      initialLines: [],
      state: "created",
    });
    vi.mocked(readTerminalSession)
      .mockResolvedValueOnce(null)
      .mockResolvedValue({
        id: "runtime-session-legacy-1",
        workspaceId: "ws-legacy",
        createdAt: 1,
        updatedAt: 2,
        lines: ["legacy payload without state"],
      } as unknown as Awaited<ReturnType<typeof readTerminalSession>>);

    const workspace: WorkspaceInfo = {
      id: "ws-legacy",
      name: "Workspace Legacy",
      path: "/tmp/ws-legacy",
      connected: true,
      settings: {
        sidebarCollapsed: false,
      },
    };

    const { result, rerender } = renderHook(
      ({ isVisible }) =>
        useTerminalSession({
          activeWorkspace: workspace,
          activeTerminalId: "terminal-legacy-1",
          isVisible,
        }),
      {
        initialProps: { isVisible: false },
      }
    );

    act(() => {
      result.current.containerRef.current = document.createElement("div");
    });
    rerender({ isVisible: true });

    await waitFor(() => {
      expect(result.current.status).toBe("error");
    });
    expect(result.current.message).toContain("unknown state");
  });

  it("surfaces exited terminal session state", async () => {
    vi.mocked(detectRuntimeMode).mockReturnValue("runtime-gateway-web");
    vi.mocked(openTerminalSession).mockResolvedValue({
      id: "runtime-session-conflict-1",
      initialLines: [],
      state: "created",
    });
    vi.mocked(readTerminalSession).mockResolvedValue({
      id: "runtime-session-conflict-1",
      workspaceId: "ws-conflict",
      state: "exited",
      createdAt: 1,
      updatedAt: 2,
      lines: ["session exited"],
    });

    const workspace: WorkspaceInfo = {
      id: "ws-conflict",
      name: "Workspace Conflict",
      path: "/tmp/ws-conflict",
      connected: true,
      settings: {
        sidebarCollapsed: false,
      },
    };

    const { result, rerender } = renderHook(
      ({ isVisible }) =>
        useTerminalSession({
          activeWorkspace: workspace,
          activeTerminalId: "terminal-conflict-1",
          isVisible,
        }),
      {
        initialProps: { isVisible: false },
      }
    );

    act(() => {
      result.current.containerRef.current = document.createElement("div");
    });
    rerender({ isVisible: true });

    await waitFor(() => {
      expect(result.current.message).toContain("exited");
    });
    expect(result.current.status).toBe("idle");
  });

  it("surfaces unsupported runtime terminal state without opening a session", async () => {
    vi.mocked(getRuntimeTerminalStatus).mockResolvedValue({
      state: "unsupported",
      message: "terminal unsupported by runtime",
    });

    const workspace: WorkspaceInfo = {
      id: "ws-unsupported",
      name: "Workspace Unsupported",
      path: "/tmp/ws-unsupported",
      connected: true,
      settings: {
        sidebarCollapsed: false,
      },
    };

    const { result, rerender } = renderHook(
      ({ isVisible }) =>
        useTerminalSession({
          activeWorkspace: workspace,
          activeTerminalId: "terminal-unsupported-1",
          isVisible,
        }),
      {
        initialProps: { isVisible: false },
      }
    );

    act(() => {
      result.current.containerRef.current = document.createElement("div");
    });
    rerender({ isVisible: true });

    await waitFor(() => {
      expect(result.current.status).toBe("error");
    });
    expect(result.current.message).toContain("unsupported");
    expect(openTerminalSession).not.toHaveBeenCalled();
  });

  it("stops opening when terminal capability payload violates state contract", async () => {
    vi.mocked(getRuntimeTerminalStatus).mockRejectedValue(
      new Error(
        "code_terminal_status returned invalid terminal state: expected one of [ready, uninitialized, unsupported], received legacy-ready."
      )
    );

    const workspace: WorkspaceInfo = {
      id: "ws-contract",
      name: "Workspace Contract",
      path: "/tmp/ws-contract",
      connected: true,
      settings: {
        sidebarCollapsed: false,
      },
    };

    const { result, rerender } = renderHook(
      ({ isVisible }) =>
        useTerminalSession({
          activeWorkspace: workspace,
          activeTerminalId: "terminal-contract-1",
          isVisible,
        }),
      {
        initialProps: { isVisible: false },
      }
    );

    act(() => {
      result.current.containerRef.current = document.createElement("div");
    });
    rerender({ isVisible: true });

    await waitFor(() => {
      expect(result.current.status).toBe("error");
    });
    expect(result.current.message).toContain("invalid terminal state");
    expect(openTerminalSession).not.toHaveBeenCalled();
  });

  it("distinguishes uninitialized runtime state from unsupported", async () => {
    let resolveOpen!: (value: {
      id: string;
      initialLines: string[];
      state: "created" | "exited" | "ioFailed" | "unsupported";
    }) => void;
    vi.mocked(getRuntimeTerminalStatus).mockResolvedValue({
      state: "uninitialized",
      message: "runtime initializing terminal",
    });
    vi.mocked(openTerminalSession).mockReturnValue(
      new Promise((resolve) => {
        resolveOpen = resolve;
      })
    );

    const workspace: WorkspaceInfo = {
      id: "ws-uninitialized",
      name: "Workspace Uninitialized",
      path: "/tmp/ws-uninitialized",
      connected: true,
      settings: {
        sidebarCollapsed: false,
      },
    };

    const { result, rerender, unmount } = renderHook(
      ({ isVisible }) =>
        useTerminalSession({
          activeWorkspace: workspace,
          activeTerminalId: "terminal-uninitialized-1",
          isVisible,
        }),
      {
        initialProps: { isVisible: false },
      }
    );

    act(() => {
      result.current.containerRef.current = document.createElement("div");
    });
    rerender({ isVisible: true });

    await waitFor(() => {
      expect(result.current.status).toBe("connecting");
    });
    expect(result.current.message).toContain("initializing");
    expect(openTerminalSession).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveOpen({
        id: "runtime-session-uninitialized-1",
        initialLines: [],
        state: "created",
      });
      await Promise.resolve();
      unmount();
    });
  });
});
