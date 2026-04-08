import { describe, expect, it, vi } from "vitest";
import { buildRuntimeMiniProgramTools } from "./webMcpBridgeRuntimeMiniProgramTools";
import { createAgentCommandCenterSnapshot } from "./webMcpBridgeRuntimeTestUtils";
import type { RuntimeAgentControl } from "@ku0/code-runtime-webmcp-client/webMcpBridgeTypes";
import type {
  RuntimeMiniProgramActionRunResponse,
  RuntimeMiniProgramStatusResponse,
} from "@ku0/code-runtime-host-contract";

type RuntimeMiniProgramControl = RuntimeAgentControl & {
  getRuntimeMiniProgramStatus: (input: {
    workspaceId: string;
  }) => Promise<RuntimeMiniProgramStatusResponse>;
  runRuntimeMiniProgramAction: (input: {
    workspaceId: string;
    action: string;
    compileType?: string | null;
    compileCondition?: {
      pathName?: string | null;
      query?: string | null;
      scene?: number | null;
    } | null;
    version?: string | null;
    desc?: string | null;
    qrOutputMode?: string | null;
    infoOutputMode?: string | null;
  }) => Promise<RuntimeMiniProgramActionRunResponse>;
};

function createSnapshot() {
  return createAgentCommandCenterSnapshot({
    workspaceId: "ws-mini",
    workspaceName: "mini-workspace",
    intent: {
      objective: "ship mini program changes",
    },
    governance: {
      policy: {
        terminateOverdueDays: 7,
      },
    },
  });
}

describe("webMcpBridgeRuntimeMiniProgramTools", () => {
  it("registers status and action tools", async () => {
    const getRuntimeMiniProgramStatus = vi.fn(async () => ({
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
      supportedActions: ["open_project", "preview"],
      warnings: [],
    }));
    const runRuntimeMiniProgramAction = vi.fn(async () => ({
      workspaceId: "ws-mini",
      available: true,
      action: "preview",
      status: "completed",
      message: "Mini program preview completed.",
      command: ["cli", "preview"],
      exitCode: 0,
      stdout: "preview ok",
      stderr: "",
      qrCode: {
        format: "base64",
        dataBase64: "ZmFrZS1xci1jb2Rl",
      },
      info: { size: 123 },
      warnings: [],
    }));
    const confirmWriteAction = vi.fn(async () => undefined);
    const tools = buildRuntimeMiniProgramTools({
      snapshot: createSnapshot(),
      runtimeControl: {
        listTasks: vi.fn(),
        getTaskStatus: vi.fn(),
        startTask: vi.fn(),
        interruptTask: vi.fn(),
        submitTaskApprovalDecision: vi.fn(),
        getRuntimeMiniProgramStatus,
        runRuntimeMiniProgramAction,
      } as RuntimeMiniProgramControl,
      requireUserApproval: true,
      helpers: {
        buildResponse: (message, data) => ({ ok: true, message, data }),
        toNonEmptyString: (value) =>
          typeof value === "string" && value.trim().length > 0 ? value.trim() : null,
        toStringArray: () => [],
        toPositiveInteger: (value) =>
          typeof value === "number" && Number.isFinite(value) && value > 0
            ? Math.trunc(value)
            : null,
        normalizeRuntimeTaskStatus: () => null,
        normalizeRuntimeStepKind: () => "read",
        normalizeRuntimeExecutionMode: () => "single",
        normalizeRuntimeAccessMode: () => "on-request",
        normalizeRuntimeReasonEffort: () => null,
        confirmWriteAction,
      },
    });

    expect(tools.map((tool) => tool.name)).toEqual([
      "get-runtime-mini-program-status",
      "open-runtime-mini-program-project",
      "refresh-runtime-mini-program-project",
      "build-runtime-mini-program-npm",
      "preview-runtime-mini-program",
      "upload-runtime-mini-program",
      "reset-runtime-mini-program-file-watch",
    ]);

    const statusTool = tools.find((tool) => tool.name === "get-runtime-mini-program-status");
    const previewTool = tools.find((tool) => tool.name === "preview-runtime-mini-program");
    const uploadTool = tools.find((tool) => tool.name === "upload-runtime-mini-program");
    expect(statusTool?.annotations?.readOnlyHint).toBe(true);

    const statusResponse = await statusTool?.execute({}, null);
    expect(getRuntimeMiniProgramStatus).toHaveBeenCalledWith({
      workspaceId: "ws-mini",
    });
    expect(statusResponse).toMatchObject({
      ok: true,
      message: "Runtime mini program status retrieved.",
    });

    const previewResponse = await previewTool?.execute(
      {
        compileCondition: {
          pathName: "pages/index/index",
          query: "foo=bar",
          scene: 1011,
        },
        qrOutputMode: "base64",
        infoOutputMode: "inline",
      },
      null
    );
    expect(confirmWriteAction).toHaveBeenCalledTimes(1);
    expect(runRuntimeMiniProgramAction).toHaveBeenCalledWith({
      workspaceId: "ws-mini",
      action: "preview",
      compileType: null,
      compileCondition: {
        pathName: "pages/index/index",
        query: "foo=bar",
        scene: 1011,
      },
      version: null,
      desc: null,
      qrOutputMode: "base64",
      infoOutputMode: "inline",
    });
    expect(previewResponse).toMatchObject({
      ok: true,
      message: "Runtime mini program preview completed.",
    });

    await expect(uploadTool?.execute({}, null)).rejects.toThrow(/version is required/i);
  });
});
