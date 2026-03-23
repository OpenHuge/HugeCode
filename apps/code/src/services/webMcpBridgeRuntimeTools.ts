import { RUNTIME_MESSAGE_CODES } from "@ku0/code-runtime-client/runtimeMessageCodes";
import { createRuntimeError } from "@ku0/code-runtime-client/runtimeMessageEnvelope";
import { buildRuntimeAgentTaskTools } from "./webMcpBridgeRuntimeAgentTaskTools";
import { buildRuntimeActionRequiredTools } from "./webMcpBridgeRuntimeActionRequiredTools";
import { buildRuntimeBackendControlTools } from "./webMcpBridgeRuntimeBackendControlTools";
import { buildRuntimeBrowserTools } from "./webMcpBridgeRuntimeBrowserTools";
import { buildRuntimeDiagnosticsTools } from "./webMcpBridgeRuntimeDiagnosticsTools";
import { buildRuntimeDiscoveryTools } from "./webMcpBridgeRuntimeDiscoveryTools";
import { buildRuntimeExtensionTools } from "./webMcpBridgeRuntimeExtensionTools";
import { buildRuntimeGitTools } from "./webMcpBridgeRuntimeGitTools";
import { buildListRuntimeLiveSkillsTool } from "./webMcpBridgeRuntimeLiveSkillTools";
import { buildRuntimeOauthTools } from "./webMcpBridgeRuntimeOauthTools";
import { buildRuntimeOperationsTools } from "./webMcpBridgeRuntimeOperationsTools";
import { buildRuntimePatchTools } from "./webMcpBridgeRuntimePatchTools";
import { buildRuntimePolicyTools } from "./webMcpBridgeRuntimePolicyTools";
import { buildRuntimePromptTools } from "./webMcpBridgeRuntimePromptTools";
import { buildOrchestrateRuntimeSubAgentBatchTool } from "./webMcpBridgeRuntimeSubAgentBatchTool";
import { buildRuntimeSubAgentTools } from "./webMcpBridgeRuntimeSubAgentTools";
import { buildRuntimeTerminalTools } from "./webMcpBridgeRuntimeTerminalTools";
import { buildRuntimeWorkspaceDiagnosticsTools } from "./webMcpBridgeRuntimeWorkspaceDiagnosticsTools";
import {
  invalidInputError,
  requiredInputError,
  resourceNotFoundError,
} from "./webMcpBridgeRuntimeToolHelpers";
import {
  type BuildRuntimeToolsOptions,
  resolveWorkspaceId,
  type WebMcpToolDescriptor,
} from "./webMcpBridgeRuntimeToolsShared";
import { buildRuntimeWorkspaceTools } from "./webMcpBridgeRuntimeWorkspaceTools";

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readComputerObserveBlockedError(response: unknown): Error | null {
  if (!isRecord(response)) {
    return null;
  }
  const data = isRecord(response.data) ? response.data : null;
  const result = data && isRecord(data.result) ? data.result : null;
  if (!result || result.status !== "blocked") {
    return null;
  }
  const metadata = isRecord(result.metadata) ? result.metadata : null;
  const errorCode =
    typeof metadata?.errorCode === "string" && metadata.errorCode.trim().length > 0
      ? metadata.errorCode
      : RUNTIME_MESSAGE_CODES.runtime.validation.requestBlocked;
  const errorMessage =
    typeof result.message === "string" && result.message.trim().length > 0
      ? result.message
      : "Computer observe is blocked by runtime capability policy.";
  return createRuntimeError({
    code: errorCode,
    message: errorMessage,
  });
}

function wrapComputerObserveToolDescriptor(tool: WebMcpToolDescriptor): WebMcpToolDescriptor {
  if (tool.name !== "run-runtime-computer-observe") {
    return tool;
  }
  return {
    ...tool,
    execute: async (input, agent) => {
      const response = await tool.execute(input, agent);
      const blockedError = readComputerObserveBlockedError(response);
      if (blockedError) {
        throw blockedError;
      }
      return response;
    },
  };
}

export function buildRuntimeTools(options: BuildRuntimeToolsOptions): WebMcpToolDescriptor[] {
  const { snapshot, runtimeControl, requireUserApproval, onApprovalRequest, helpers } = options;
  const MAX_RUNTIME_FILE_PAYLOAD_BYTES = 512 * 1024;
  const MAX_RUNTIME_COMMAND_CHARS = 8_192;

  const tools: WebMcpToolDescriptor[] = [
    {
      name: "list-runtime-runs",
      description: "List runtime agent tasks for orchestration, monitoring, and scheduling.",
      inputSchema: {
        type: "object",
        properties: {
          workspaceId: { type: "string" },
          status: {
            type: "string",
            enum: [
              "queued",
              "running",
              "awaiting_approval",
              "completed",
              "failed",
              "cancelled",
              "interrupted",
            ],
          },
          limit: { type: "number" },
        },
      },
      execute: async (input) => {
        const requestedStatus = helpers.toNonEmptyString(input.status);
        const normalizedStatus = helpers.normalizeRuntimeTaskStatus(input.status);
        if (requestedStatus && !normalizedStatus) {
          throw invalidInputError(`Unsupported runtime task status: ${requestedStatus}.`);
        }
        const tasks = await runtimeControl.listTasks({
          workspaceId: resolveWorkspaceId(input, snapshot, helpers),
          status: requestedStatus ? normalizedStatus : null,
          limit: helpers.toPositiveInteger(input.limit),
        });
        const statusSummary = tasks.reduce<Record<string, number>>((accumulator, task) => {
          accumulator[task.status] = (accumulator[task.status] ?? 0) + 1;
          return accumulator;
        }, {});
        return helpers.buildResponse("Runtime tasks retrieved.", {
          workspaceId: snapshot.workspaceId,
          total: tasks.length,
          statusSummary,
          tasks,
        });
      },
      annotations: { readOnlyHint: true },
    },
    {
      name: "get-runtime-run-status",
      description: "Get current status and execution details for a runtime agent task.",
      inputSchema: {
        type: "object",
        properties: {
          taskId: { type: "string" },
        },
        required: ["taskId"],
      },
      execute: async (input) => {
        const taskId = helpers.toNonEmptyString(input.taskId);
        if (!taskId) {
          throw requiredInputError("taskId is required.");
        }
        const task = await runtimeControl.getTaskStatus(taskId);
        if (!task) {
          throw resourceNotFoundError(`Runtime task ${taskId} was not found.`);
        }
        return helpers.buildResponse("Runtime task status retrieved.", {
          workspaceId: snapshot.workspaceId,
          task,
        });
      },
      annotations: { readOnlyHint: true },
    },
    buildListRuntimeLiveSkillsTool({
      snapshot,
      runtimeControl,
      helpers: { buildResponse: helpers.buildResponse, toNonEmptyString: helpers.toNonEmptyString },
    }),
    ...buildRuntimeDiagnosticsTools({
      snapshot,
      runtimeControl,
      helpers: { buildResponse: helpers.buildResponse, toNonEmptyString: helpers.toNonEmptyString },
    }),
    ...buildRuntimeTerminalTools({
      snapshot,
      runtimeControl,
      requireUserApproval,
      onApprovalRequest,
      helpers: {
        buildResponse: helpers.buildResponse,
        confirmWriteAction: helpers.confirmWriteAction,
        toNonEmptyString: helpers.toNonEmptyString,
        toPositiveInteger: helpers.toPositiveInteger,
      },
    }),
    ...buildRuntimeBackendControlTools({
      snapshot,
      runtimeControl,
      requireUserApproval,
      onApprovalRequest,
      helpers: {
        buildResponse: helpers.buildResponse,
        toNonEmptyString: helpers.toNonEmptyString,
        toPositiveInteger: helpers.toPositiveInteger,
        toStringArray: helpers.toStringArray,
        confirmWriteAction: helpers.confirmWriteAction,
      },
    }),
    ...buildRuntimePolicyTools({
      snapshot,
      runtimeControl,
      requireUserApproval,
      onApprovalRequest,
      helpers: {
        buildResponse: helpers.buildResponse,
        toNonEmptyString: helpers.toNonEmptyString,
        toPositiveInteger: helpers.toPositiveInteger,
        confirmWriteAction: helpers.confirmWriteAction,
      },
    }),
    ...buildRuntimeOauthTools({
      snapshot,
      runtimeControl,
      requireUserApproval,
      onApprovalRequest,
      helpers: {
        buildResponse: helpers.buildResponse,
        confirmWriteAction: helpers.confirmWriteAction,
        toNonEmptyString: helpers.toNonEmptyString,
      },
    }),
    ...buildRuntimeDiscoveryTools({
      snapshot,
      runtimeControl,
      helpers: {
        buildResponse: helpers.buildResponse,
        toNonEmptyString: helpers.toNonEmptyString,
        toPositiveInteger: helpers.toPositiveInteger,
      },
    }),
    ...buildRuntimeBrowserTools({
      snapshot,
      runtimeControl,
      requireUserApproval,
      onApprovalRequest,
      helpers,
    }),
    ...buildRuntimeWorkspaceDiagnosticsTools({
      snapshot,
      runtimeControl,
      helpers,
    }),
    ...buildRuntimePatchTools({
      snapshot,
      runtimeControl,
      requireUserApproval,
      onApprovalRequest,
      helpers,
    }),
    ...buildRuntimeExtensionTools({
      snapshot,
      runtimeControl,
      requireUserApproval,
      onApprovalRequest,
      helpers: {
        buildResponse: helpers.buildResponse,
        confirmWriteAction: helpers.confirmWriteAction,
        toNonEmptyString: helpers.toNonEmptyString,
      },
    }),
    ...buildRuntimeOperationsTools({
      snapshot,
      runtimeControl,
      requireUserApproval,
      onApprovalRequest,
      helpers: {
        buildResponse: helpers.buildResponse,
        toNonEmptyString: helpers.toNonEmptyString,
        confirmWriteAction: helpers.confirmWriteAction,
      },
    }),
    ...buildRuntimePromptTools({
      snapshot,
      runtimeControl,
      requireUserApproval,
      onApprovalRequest,
      helpers: {
        buildResponse: helpers.buildResponse,
        confirmWriteAction: helpers.confirmWriteAction,
        toNonEmptyString: helpers.toNonEmptyString,
      },
    }),
    ...buildRuntimeGitTools({
      snapshot,
      runtimeControl,
      requireUserApproval,
      onApprovalRequest,
      helpers: {
        buildResponse: helpers.buildResponse,
        toNonEmptyString: helpers.toNonEmptyString,
        confirmWriteAction: helpers.confirmWriteAction,
      },
    }),
    ...buildRuntimeWorkspaceTools({
      ...options,
      maxRuntimeFilePayloadBytes: MAX_RUNTIME_FILE_PAYLOAD_BYTES,
      maxRuntimeCommandChars: MAX_RUNTIME_COMMAND_CHARS,
    }),
    ...buildRuntimeAgentTaskTools(options),
    buildOrchestrateRuntimeSubAgentBatchTool({
      snapshot,
      runtimeControl,
      requireUserApproval,
      onApprovalRequest,
      helpers: {
        buildResponse: helpers.buildResponse,
        toNonEmptyString: helpers.toNonEmptyString,
        toStringArray: helpers.toStringArray,
        toPositiveInteger: helpers.toPositiveInteger,
        normalizeRuntimeAccessMode: helpers.normalizeRuntimeAccessMode,
        normalizeRuntimeReasonEffort: helpers.normalizeRuntimeReasonEffort,
        confirmWriteAction: helpers.confirmWriteAction,
      },
    }),
    ...buildRuntimeSubAgentTools(options),
    ...buildRuntimeActionRequiredTools(options),
    {
      name: "interrupt-runtime-active-tasks",
      description: "Interrupt all active runtime tasks (queued/running/awaiting_approval).",
      inputSchema: {
        type: "object",
        properties: {
          workspaceId: { type: "string" },
          reason: { type: "string" },
        },
      },
      execute: async (input, agent) => {
        await helpers.confirmWriteAction(
          agent,
          requireUserApproval,
          `Interrupt all active runtime tasks in workspace ${snapshot.workspaceName}?`,
          onApprovalRequest
        );
        const workspaceId = resolveWorkspaceId(input, snapshot, helpers);
        const activeTasks = await runtimeControl.listTasks({
          workspaceId,
          status: null,
          limit: 100,
        });
        const candidates = activeTasks.filter(
          (task) =>
            task.status === "queued" ||
            task.status === "running" ||
            task.status === "awaiting_approval"
        );
        if (candidates.length === 0) {
          return helpers.buildResponse("No active runtime tasks to interrupt.", {
            workspaceId: snapshot.workspaceId,
            interruptedCount: 0,
            taskIds: [],
          });
        }
        const reason =
          helpers.toNonEmptyString(input.reason) ?? "webmcp:interrupt-runtime-active-tasks";
        await Promise.all(
          candidates.map((task) =>
            runtimeControl.interruptTask({
              taskId: task.taskId,
              reason,
            })
          )
        );
        return helpers.buildResponse("Active runtime tasks interrupted.", {
          workspaceId: snapshot.workspaceId,
          interruptedCount: candidates.length,
          taskIds: candidates.map((task) => task.taskId),
        });
      },
    },
  ];

  return tools.map(wrapComputerObserveToolDescriptor);
}
