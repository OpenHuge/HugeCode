import { RUNTIME_MESSAGE_CODES } from "@ku0/code-runtime-client/runtimeMessageCodes";
import { createRuntimeError } from "@ku0/code-runtime-client/runtimeMessageEnvelope";
import type {
  AgentCommandCenterSnapshot,
  JsonRecord,
  RuntimeAgentControl,
  RuntimeAgentTaskStatus,
  WebMcpToolDescriptor,
} from "./webMcpBridgeTypes";

type RuntimeToolCatalogHelpers = {
  buildResponse: (message: string, data: JsonRecord) => JsonRecord;
  toNonEmptyString: (value: unknown) => string | null;
  toPositiveInteger: (value: unknown) => number | null;
  normalizeRuntimeTaskStatus: (value: unknown) => RuntimeAgentTaskStatus | null;
};

export type BuildRuntimeTaskCatalogToolsOptions = {
  snapshot: AgentCommandCenterSnapshot;
  runtimeControl: RuntimeAgentControl;
  resolveWorkspaceId: (input: JsonRecord) => string;
  helpers: RuntimeToolCatalogHelpers;
};

function invalidInputError(message: string): Error {
  return createRuntimeError({
    code: RUNTIME_MESSAGE_CODES.runtime.validation.inputInvalid,
    message,
  });
}

function requiredInputError(message: string): Error {
  return createRuntimeError({
    code: RUNTIME_MESSAGE_CODES.runtime.validation.inputRequired,
    message,
  });
}

function resourceNotFoundError(message: string): Error {
  return createRuntimeError({
    code: RUNTIME_MESSAGE_CODES.runtime.validation.resourceNotFound,
    message,
  });
}

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

export function wrapRuntimeComputerObserveTool(tool: WebMcpToolDescriptor): WebMcpToolDescriptor {
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

export function buildRuntimeTaskCatalogTools(
  options: BuildRuntimeTaskCatalogToolsOptions
): WebMcpToolDescriptor[] {
  const { snapshot, runtimeControl, resolveWorkspaceId, helpers } = options;

  return [
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
          workspaceId: resolveWorkspaceId(input),
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
  ];
}
