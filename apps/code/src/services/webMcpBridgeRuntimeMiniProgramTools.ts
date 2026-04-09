import {
  invalidInputError,
  methodUnavailableError,
  requiredInputError,
} from "./webMcpBridgeRuntimeToolHelpers";
import {
  type BuildRuntimeToolsOptions,
  resolveWorkspaceId,
  type WebMcpToolDescriptor,
} from "./webMcpBridgeRuntimeToolsShared";
import type {
  RuntimeAgentControl,
  WebMcpAgent,
} from "@ku0/code-runtime-webmcp-client/webMcpBridgeTypes";
import type {
  RuntimeMiniProgramAction,
  RuntimeMiniProgramActionRunRequest,
  RuntimeMiniProgramActionRunResponse,
  RuntimeMiniProgramStatusResponse,
} from "@ku0/code-runtime-host-contract";

type RuntimeMiniProgramControl = RuntimeAgentControl & {
  getRuntimeMiniProgramStatus?: (input: {
    workspaceId: string;
  }) => Promise<RuntimeMiniProgramStatusResponse>;
  runRuntimeMiniProgramAction?: (
    input: RuntimeMiniProgramActionRunRequest
  ) => Promise<RuntimeMiniProgramActionRunResponse>;
};

type JsonRecord = Record<string, unknown>;

function requireMiniProgramMethod<
  TMethod extends "getRuntimeMiniProgramStatus" | "runRuntimeMiniProgramAction",
>(
  control: RuntimeMiniProgramControl,
  methodName: TMethod,
  toolName: string
): NonNullable<RuntimeMiniProgramControl[TMethod]> {
  const candidate = control[methodName];
  if (typeof candidate !== "function") {
    throw methodUnavailableError(toolName, String(methodName));
  }
  return candidate as NonNullable<RuntimeMiniProgramControl[TMethod]>;
}

function asRecord(value: unknown): JsonRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as JsonRecord;
}

function normalizeCompileCondition(
  value: unknown
): RuntimeMiniProgramActionRunRequest["compileCondition"] {
  if (value == null) {
    return null;
  }
  const record = asRecord(value);
  if (!record) {
    throw invalidInputError("compileCondition must be an object when provided.");
  }
  const scene =
    typeof record.scene === "number" && Number.isFinite(record.scene)
      ? Math.trunc(record.scene)
      : null;
  return {
    pathName:
      typeof record.pathName === "string" && record.pathName.trim().length > 0
        ? record.pathName.trim()
        : null,
    query:
      typeof record.query === "string" && record.query.trim().length > 0
        ? record.query.trim()
        : null,
    ...(scene !== null ? { scene } : {}),
  };
}

async function runMiniProgramAction(
  input: {
    action: RuntimeMiniProgramAction;
    title: string;
    approvalPrompt: string;
    toolName: string;
  },
  payload: JsonRecord,
  control: RuntimeMiniProgramControl,
  options: Pick<
    BuildRuntimeToolsOptions,
    "snapshot" | "requireUserApproval" | "onApprovalRequest" | "helpers"
  >,
  agent: WebMcpAgent | null
) {
  const { snapshot, requireUserApproval, onApprovalRequest, helpers } = options;
  const runRuntimeMiniProgramAction = requireMiniProgramMethod(
    control,
    "runRuntimeMiniProgramAction",
    input.toolName
  );
  await helpers.confirmWriteAction(
    agent,
    requireUserApproval,
    input.approvalPrompt,
    onApprovalRequest
  );
  const workspaceId = resolveWorkspaceId(payload, snapshot, helpers);
  const compileType =
    payload.compileType === "plugin"
      ? "plugin"
      : payload.compileType === "miniprogram"
        ? "miniprogram"
        : null;
  const qrOutputMode =
    payload.qrOutputMode === "terminal" ||
    payload.qrOutputMode === "base64" ||
    payload.qrOutputMode === "image" ||
    payload.qrOutputMode === "none"
      ? payload.qrOutputMode
      : null;
  const infoOutputMode = payload.infoOutputMode === "inline" ? "inline" : null;
  const version =
    typeof payload.version === "string" && payload.version.trim().length > 0
      ? payload.version.trim()
      : null;
  if (input.action === "upload" && !version) {
    throw requiredInputError("version is required for upload.");
  }
  const desc =
    typeof payload.desc === "string" && payload.desc.trim().length > 0 ? payload.desc.trim() : null;
  const result = await runRuntimeMiniProgramAction({
    workspaceId,
    action: input.action,
    compileType,
    compileCondition: normalizeCompileCondition(payload.compileCondition),
    version,
    desc,
    qrOutputMode,
    infoOutputMode,
  });
  return helpers.buildResponse(input.title, {
    workspaceId,
    result,
  });
}

export function buildRuntimeMiniProgramTools(
  options: Pick<
    BuildRuntimeToolsOptions,
    "snapshot" | "runtimeControl" | "requireUserApproval" | "onApprovalRequest" | "helpers"
  >
): WebMcpToolDescriptor[] {
  const { snapshot, runtimeControl, requireUserApproval, onApprovalRequest, helpers } = options;
  const control = runtimeControl as RuntimeMiniProgramControl;

  return [
    {
      name: "get-runtime-mini-program-status",
      description:
        "Read WeChat Mini Program tooling readiness for this workspace, including DevTools CLI, HTTP V2, login, and project validity.",
      inputSchema: {
        type: "object",
        properties: {
          workspaceId: { type: "string" },
        },
      },
      annotations: { readOnlyHint: true, title: "Get Runtime Mini Program Status" },
      execute: async (input) => {
        const getRuntimeMiniProgramStatus = requireMiniProgramMethod(
          control,
          "getRuntimeMiniProgramStatus",
          "get-runtime-mini-program-status"
        );
        const workspaceId = resolveWorkspaceId(input, snapshot, helpers);
        const result = await getRuntimeMiniProgramStatus({ workspaceId });
        return helpers.buildResponse("Runtime mini program status retrieved.", {
          workspaceId,
          result,
        });
      },
    },
    {
      name: "open-runtime-mini-program-project",
      description: "Open the current workspace in WeChat DevTools.",
      inputSchema: {
        type: "object",
        properties: {
          workspaceId: { type: "string" },
        },
      },
      annotations: { title: "Open Runtime Mini Program Project", openWorldHint: true },
      execute: async (input, agent) =>
        runMiniProgramAction(
          {
            action: "open_project",
            title: "Runtime mini program project opened.",
            approvalPrompt: `Open workspace ${snapshot.workspaceName} in WeChat DevTools?`,
            toolName: "open-runtime-mini-program-project",
          },
          input as JsonRecord,
          control,
          { snapshot, requireUserApproval, onApprovalRequest, helpers },
          agent
        ),
    },
    {
      name: "refresh-runtime-mini-program-project",
      description: "Refresh the current WeChat DevTools project window.",
      inputSchema: {
        type: "object",
        properties: {
          workspaceId: { type: "string" },
        },
      },
      annotations: { title: "Refresh Runtime Mini Program Project", openWorldHint: true },
      execute: async (input, agent) =>
        runMiniProgramAction(
          {
            action: "refresh_project",
            title: "Runtime mini program project refreshed.",
            approvalPrompt: `Refresh workspace ${snapshot.workspaceName} in WeChat DevTools?`,
            toolName: "refresh-runtime-mini-program-project",
          },
          input as JsonRecord,
          control,
          { snapshot, requireUserApproval, onApprovalRequest, helpers },
          agent
        ),
    },
    {
      name: "build-runtime-mini-program-npm",
      description: "Run the official WeChat DevTools npm build for this workspace.",
      inputSchema: {
        type: "object",
        properties: {
          workspaceId: { type: "string" },
          compileType: {
            type: "string",
            enum: ["miniprogram", "plugin"],
          },
        },
      },
      annotations: { title: "Build Runtime Mini Program npm", openWorldHint: true },
      execute: async (input, agent) =>
        runMiniProgramAction(
          {
            action: "build_npm",
            title: "Runtime mini program npm build completed.",
            approvalPrompt: `Run WeChat DevTools npm build for ${snapshot.workspaceName}?`,
            toolName: "build-runtime-mini-program-npm",
          },
          input as JsonRecord,
          control,
          { snapshot, requireUserApproval, onApprovalRequest, helpers },
          agent
        ),
    },
    {
      name: "preview-runtime-mini-program",
      description: "Run official WeChat DevTools preview for this workspace.",
      inputSchema: {
        type: "object",
        properties: {
          workspaceId: { type: "string" },
          compileCondition: { type: "object" },
          qrOutputMode: {
            type: "string",
            enum: ["none", "terminal", "base64", "image"],
          },
          infoOutputMode: {
            type: "string",
            enum: ["none", "inline"],
          },
        },
      },
      annotations: { title: "Preview Runtime Mini Program", openWorldHint: true },
      execute: async (input, agent) =>
        runMiniProgramAction(
          {
            action: "preview",
            title: "Runtime mini program preview completed.",
            approvalPrompt: `Run WeChat Mini Program preview for ${snapshot.workspaceName}?`,
            toolName: "preview-runtime-mini-program",
          },
          input as JsonRecord,
          control,
          { snapshot, requireUserApproval, onApprovalRequest, helpers },
          agent
        ),
    },
    {
      name: "upload-runtime-mini-program",
      description: "Upload the current workspace through the official WeChat DevTools upload flow.",
      inputSchema: {
        type: "object",
        properties: {
          workspaceId: { type: "string" },
          version: { type: "string" },
          desc: { type: "string" },
          infoOutputMode: {
            type: "string",
            enum: ["none", "inline"],
          },
        },
        required: ["version"],
      },
      annotations: { title: "Upload Runtime Mini Program", openWorldHint: true },
      execute: async (input, agent) =>
        runMiniProgramAction(
          {
            action: "upload",
            title: "Runtime mini program upload completed.",
            approvalPrompt: `Upload ${snapshot.workspaceName} through WeChat DevTools?`,
            toolName: "upload-runtime-mini-program",
          },
          input as JsonRecord,
          control,
          { snapshot, requireUserApproval, onApprovalRequest, helpers },
          agent
        ),
    },
    {
      name: "reset-runtime-mini-program-file-watch",
      description: "Reset WeChat DevTools file watching for the current workspace.",
      inputSchema: {
        type: "object",
        properties: {
          workspaceId: { type: "string" },
        },
      },
      annotations: { title: "Reset Runtime Mini Program File Watch", openWorldHint: true },
      execute: async (input, agent) =>
        runMiniProgramAction(
          {
            action: "reset_file_watch",
            title: "Runtime mini program file watch reset completed.",
            approvalPrompt: `Reset WeChat DevTools file watching for ${snapshot.workspaceName}?`,
            toolName: "reset-runtime-mini-program-file-watch",
          },
          input as JsonRecord,
          control,
          { snapshot, requireUserApproval, onApprovalRequest, helpers },
          agent
        ),
    },
  ];
}
