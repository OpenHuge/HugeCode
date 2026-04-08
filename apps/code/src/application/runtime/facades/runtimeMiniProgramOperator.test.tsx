import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  RuntimeMiniProgramActionRunResponse,
  RuntimeMiniProgramStatusResponse,
} from "@ku0/code-runtime-host-contract";
import {
  buildRuntimeMiniProgramNotice,
  useRuntimeMiniProgramOperator,
} from "./runtimeMiniProgramOperator";

const getRuntimeMiniProgramStatusMock = vi.hoisted(() => vi.fn());
const runRuntimeMiniProgramActionMock = vi.hoisted(() => vi.fn());

vi.mock("../ports/runtimeAutomation", () => ({
  getRuntimeMiniProgramStatus: getRuntimeMiniProgramStatusMock,
  runRuntimeMiniProgramAction: runRuntimeMiniProgramActionMock,
}));

vi.mock("../ports/runtimeErrorClassifier", () => ({
  readRuntimeErrorMessage: (error: unknown) =>
    error instanceof Error
      ? error.message
      : typeof error === "string" && error.trim().length > 0
        ? error
        : null,
}));

function createStatus(
  overrides: Partial<RuntimeMiniProgramStatusResponse> = {}
): RuntimeMiniProgramStatusResponse {
  return {
    workspaceId: "ws-mini",
    available: true,
    status: "ready",
    hostOs: "macos",
    devtoolsInstalled: true,
    cliPath: "/Applications/wechatwebdevtools.app/Contents/MacOS/cli",
    httpPort: 9421,
    serviceStatus: "running",
    loginStatus: "logged_in",
    project: {
      valid: true,
      projectConfigPath: "/tmp/project.config.json",
      appId: "wx123",
      projectName: "demo",
      miniprogramRoot: "src",
      pluginRoot: null,
      compileType: "miniprogram",
    },
    miniprogramCi: {
      available: true,
      declared: true,
      packageRoot: "/tmp",
      version: "2.1.31",
    },
    supportedActions: [
      "open_project",
      "refresh_project",
      "build_npm",
      "preview",
      "upload",
      "reset_file_watch",
    ],
    warnings: [],
    ...overrides,
  };
}

function createActionResult(
  overrides: Partial<RuntimeMiniProgramActionRunResponse> = {}
): RuntimeMiniProgramActionRunResponse {
  return {
    workspaceId: "ws-mini",
    available: true,
    action: "preview",
    status: "completed",
    message: "Mini program preview completed.",
    command: ["cli", "preview"],
    exitCode: 0,
    stdout: "preview ok",
    stderr: "",
    qrCode: null,
    info: null,
    warnings: [],
    ...overrides,
  };
}

function createDeferred<TValue>() {
  let resolve!: (value: TValue) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<TValue>((innerResolve, innerReject) => {
    resolve = innerResolve;
    reject = innerReject;
  });
  return {
    promise,
    resolve,
    reject,
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("runtimeMiniProgramOperator", () => {
  it("builds notices with stable priority", () => {
    expect(
      buildRuntimeMiniProgramNotice(
        createStatus({ warnings: ["Status warning"] }),
        createActionResult({ status: "blocked", message: "Action blocked." }),
        "Top level error"
      )
    ).toEqual({
      tone: "danger",
      message: "Top level error",
    });

    expect(
      buildRuntimeMiniProgramNotice(
        createStatus({ warnings: ["Status warning"] }),
        createActionResult({ status: "blocked", message: "Action blocked." }),
        null
      )
    ).toEqual({
      tone: "warning",
      message: "Action blocked.",
    });

    expect(
      buildRuntimeMiniProgramNotice(createStatus({ warnings: ["Status warning"] }), null, null)
    ).toEqual({
      tone: "info",
      message: "Status warning",
    });
  });

  it("loads initial status and exposes refresh errors", async () => {
    getRuntimeMiniProgramStatusMock
      .mockResolvedValueOnce(createStatus())
      .mockRejectedValueOnce(new Error("Refresh failed."));

    const { result } = renderHook(() => useRuntimeMiniProgramOperator("ws-mini"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.status?.workspaceId).toBe("ws-mini");
    expect(result.current.error).toBeNull();

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.error).toBe("Refresh failed.");
    expect(result.current.notice).toEqual({
      tone: "danger",
      message: "Refresh failed.",
    });
  });

  it("runs an action and refreshes status", async () => {
    getRuntimeMiniProgramStatusMock
      .mockResolvedValueOnce(createStatus())
      .mockResolvedValueOnce(createStatus({ loginStatus: "logged_out" }));
    runRuntimeMiniProgramActionMock.mockResolvedValue(
      createActionResult({
        action: "upload",
        message: "Upload finished.",
      })
    );

    const { result } = renderHook(() => useRuntimeMiniProgramOperator("ws-mini"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.runAction({
        action: "upload",
        version: "1.0.0",
        desc: "ship it",
        infoOutputMode: "inline",
      });
    });

    expect(runRuntimeMiniProgramActionMock).toHaveBeenCalledWith({
      workspaceId: "ws-mini",
      action: "upload",
      version: "1.0.0",
      desc: "ship it",
      infoOutputMode: "inline",
    });
    expect(result.current.lastActionResult?.message).toBe("Upload finished.");
    expect(result.current.status?.loginStatus).toBe("logged_out");
    expect(result.current.runningAction).toBeNull();
  });

  it("ignores async completions after unmount", async () => {
    const initialStatus = createDeferred<RuntimeMiniProgramStatusResponse>();
    getRuntimeMiniProgramStatusMock.mockReturnValue(initialStatus.promise);
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { unmount } = renderHook(() => useRuntimeMiniProgramOperator("ws-mini"));
    unmount();

    await act(async () => {
      initialStatus.resolve(createStatus());
      await initialStatus.promise;
    });

    expect(consoleErrorSpy).not.toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });
});
