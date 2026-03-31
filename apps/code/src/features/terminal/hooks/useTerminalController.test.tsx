// @vitest-environment jsdom

import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { closeTerminalSession } from "../../../application/runtime/ports/terminal";
import { useTerminalController } from "./useTerminalController";
import { useTerminalSession } from "./useTerminalSession";
import { useTerminalTabs } from "./useTerminalTabs";

vi.mock("../../../application/runtime/ports/terminal", () => ({
  closeTerminalSession: vi.fn(),
}));

vi.mock("./useTerminalTabs", () => ({
  useTerminalTabs: vi.fn(),
}));

vi.mock("./useTerminalSession", () => ({
  useTerminalSession: vi.fn(),
}));

describe("useTerminalController", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useTerminalTabs).mockReturnValue({
      terminals: [],
      activeTerminalId: null,
      createTerminal: vi.fn(),
      ensureTerminalWithTitle: vi.fn(),
      closeTerminal: vi.fn(),
      setActiveTerminal: vi.fn(),
      ensureTerminal: vi.fn(),
    });

    vi.mocked(useTerminalSession).mockReturnValue({
      status: "idle",
      message: "",
      containerRef: { current: null },
      hasSession: false,
      readyKey: null,
      cleanupTerminalSession: vi.fn(),
    });
  });

  it("ignores lowercase runtime terminal-not-found close errors", async () => {
    const onDebug = vi.fn();
    const cleanupMock = vi.fn();
    vi.mocked(useTerminalSession).mockReturnValue({
      status: "idle",
      message: "",
      containerRef: { current: null },
      hasSession: false,
      readyKey: null,
      cleanupTerminalSession: cleanupMock,
    });
    vi.mocked(closeTerminalSession).mockRejectedValueOnce(
      new Error("Runtime terminal session not found for ws-1:terminal-1")
    );

    const { result } = renderHook(() =>
      useTerminalController({
        activeWorkspaceId: "ws-1",
        activeWorkspace: null,
        terminalOpen: true,
        onDebug,
      })
    );

    await expect(
      result.current.restartTerminalSession("ws-1", "terminal-1")
    ).resolves.toBeUndefined();
    expect(cleanupMock).toHaveBeenCalledWith("ws-1", "terminal-1");
    expect(onDebug).not.toHaveBeenCalled();
  });

  it("ignores structured resource-not-found close errors without relying on message", async () => {
    const onDebug = vi.fn();
    const cleanupMock = vi.fn();
    vi.mocked(useTerminalSession).mockReturnValue({
      status: "idle",
      message: "",
      containerRef: { current: null },
      hasSession: false,
      readyKey: null,
      cleanupTerminalSession: cleanupMock,
    });
    vi.mocked(closeTerminalSession).mockRejectedValueOnce({
      code: "runtime.validation.resource.not_found",
      message: "permission denied",
    });

    const { result } = renderHook(() =>
      useTerminalController({
        activeWorkspaceId: "ws-1",
        activeWorkspace: null,
        terminalOpen: true,
        onDebug,
      })
    );

    await expect(
      result.current.restartTerminalSession("ws-1", "terminal-1")
    ).resolves.toBeUndefined();
    expect(cleanupMock).toHaveBeenCalledWith("ws-1", "terminal-1");
    expect(onDebug).not.toHaveBeenCalled();
  });

  it("rethrows close errors that are not terminal-not-found", async () => {
    const onDebug = vi.fn();
    const cleanupMock = vi.fn();
    vi.mocked(useTerminalSession).mockReturnValue({
      status: "idle",
      message: "",
      containerRef: { current: null },
      hasSession: false,
      readyKey: null,
      cleanupTerminalSession: cleanupMock,
    });
    vi.mocked(closeTerminalSession).mockRejectedValueOnce(new Error("permission denied"));

    const { result } = renderHook(() =>
      useTerminalController({
        activeWorkspaceId: "ws-1",
        activeWorkspace: null,
        terminalOpen: true,
        onDebug,
      })
    );

    await expect(result.current.restartTerminalSession("ws-1", "terminal-1")).rejects.toThrow(
      "permission denied"
    );
    expect(cleanupMock).toHaveBeenCalledWith("ws-1", "terminal-1");
    expect(onDebug).toHaveBeenCalledTimes(1);
  });
});
