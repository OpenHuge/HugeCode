// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  RuntimeMiniProgramActionRunResponse,
  RuntimeMiniProgramStatusResponse,
} from "@ku0/code-runtime-host-contract";
import type {
  RuntimeMiniProgramOperatorNotice,
  RuntimeMiniProgramOperatorState,
} from "../../../application/runtime/facades/runtimeMiniProgramOperator";
import { WorkspaceHomeAgentRuntimeMiniProgramSection } from "./WorkspaceHomeAgentRuntimeMiniProgramSection";

const useRuntimeMiniProgramOperatorMock = vi.hoisted(() => vi.fn());

vi.mock("../../../application/runtime/facades/runtimeMiniProgramOperator", () => ({
  useRuntimeMiniProgramOperator: useRuntimeMiniProgramOperatorMock,
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

function createLastActionResult(
  overrides: Partial<RuntimeMiniProgramActionRunResponse> = {}
): RuntimeMiniProgramActionRunResponse {
  return {
    workspaceId: "ws-mini",
    available: true,
    action: "preview",
    status: "completed",
    message: "Preview completed.",
    command: ["cli", "preview"],
    exitCode: 0,
    stdout: null,
    stderr: null,
    qrCode: null,
    info: null,
    warnings: [],
    ...overrides,
  };
}

function createOperatorState(
  overrides: Partial<RuntimeMiniProgramOperatorState> = {}
): RuntimeMiniProgramOperatorState {
  return {
    status: createStatus(),
    loading: false,
    refreshing: false,
    runningAction: null,
    lastActionResult: null,
    error: null,
    notice: null,
    refresh: vi.fn(async () => undefined),
    runAction: vi.fn(async () => undefined),
    ...overrides,
  };
}

function renderSection(overrides: Partial<RuntimeMiniProgramOperatorState> = {}) {
  const state = createOperatorState(overrides);
  useRuntimeMiniProgramOperatorMock.mockReturnValue(state);
  render(<WorkspaceHomeAgentRuntimeMiniProgramSection workspaceId="ws-mini" />);
  return state;
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("WorkspaceHomeAgentRuntimeMiniProgramSection", () => {
  it("submits preview payload with parsed scene and trimmed fields", () => {
    const state = renderSection();

    fireEvent.change(screen.getByLabelText("Path name"), {
      target: { value: " pages/index/index " },
    });
    fireEvent.change(screen.getByLabelText("Query"), {
      target: { value: " foo=bar " },
    });
    fireEvent.change(screen.getByLabelText("Scene"), {
      target: { value: "1011" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Preview" }));

    expect(state.runAction).toHaveBeenCalledWith({
      action: "preview",
      compileCondition: {
        pathName: "pages/index/index",
        query: "foo=bar",
        scene: 1011,
      },
      qrOutputMode: "base64",
      infoOutputMode: "inline",
    });
  });

  it("requires upload version before enabling upload", () => {
    const state = renderSection();
    const uploadButton = screen.getByRole("button", { name: "Upload" });

    expect(uploadButton).toHaveProperty("disabled", true);

    fireEvent.change(screen.getByLabelText("Version"), {
      target: { value: " 1.0.0 " },
    });
    fireEvent.change(screen.getByLabelText("Desc"), {
      target: { value: " release build " },
    });

    expect(uploadButton).toHaveProperty("disabled", false);
    fireEvent.click(uploadButton);

    expect(state.runAction).toHaveBeenCalledWith({
      action: "upload",
      version: "1.0.0",
      desc: "release build",
      infoOutputMode: "inline",
    });
  });

  it("shows notices and last action summaries", () => {
    const notice: RuntimeMiniProgramOperatorNotice = {
      tone: "warning",
      message: "DevTools login expired.",
    };
    renderSection({
      notice,
      lastActionResult: createLastActionResult({
        action: "upload",
        status: "blocked",
        message: "Upload blocked.",
        exitCode: 2,
        info: { detail: "approval required" },
      }),
    });

    expect(screen.getByText("DevTools login expired.")).toBeTruthy();
    expect(screen.getByText(/Last action: upload \(blocked\)/i)).toBeTruthy();
    expect(screen.getByText("Upload blocked.")).toBeTruthy();
    expect(screen.getByText(/approval required/i)).toBeTruthy();
  });

  it("disables unsupported actions for invalid projects", () => {
    renderSection({
      status: createStatus({
        project: {
          valid: false,
          projectConfigPath: null,
          appId: null,
          projectName: null,
          miniprogramRoot: null,
          pluginRoot: null,
          compileType: "unknown",
        },
        supportedActions: ["open_project", "refresh_project"],
      }),
    });

    expect(screen.getByRole("button", { name: "Build npm" })).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: "Preview" })).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: "Upload" })).toHaveProperty("disabled", true);
  });
});
