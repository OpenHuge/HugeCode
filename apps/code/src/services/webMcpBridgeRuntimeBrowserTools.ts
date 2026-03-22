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
import type { RuntimeAgentControl } from "./webMcpBridgeTypes";

type RuntimeBrowserControl = RuntimeAgentControl & {
  getRuntimeBrowserDebugStatus?: (input: { workspaceId: string }) => Promise<unknown>;
  runRuntimeBrowserDebug?: (input: {
    workspaceId: string;
    operation: "inspect" | "automation";
    prompt?: string | null;
    includeScreenshot?: boolean | null;
    timeoutMs?: number | null;
    steps?: Array<{
      toolName: string;
      arguments?: Record<string, unknown> | null;
    }> | null;
  }) => Promise<unknown>;
};

type JsonRecord = Record<string, unknown>;

function requireBrowserControlMethod<
  MethodName extends "getRuntimeBrowserDebugStatus" | "runRuntimeBrowserDebug",
>(
  control: RuntimeBrowserControl,
  methodName: MethodName,
  toolName: string
): NonNullable<RuntimeBrowserControl[MethodName]> {
  const candidate = control[methodName];
  if (typeof candidate !== "function") {
    throw methodUnavailableError(toolName, String(methodName));
  }
  return candidate as NonNullable<RuntimeBrowserControl[MethodName]>;
}

function asRecord(value: unknown): JsonRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as JsonRecord;
}

function normalizeToolCallArray(value: unknown): Array<{
  toolName: string;
  arguments?: Record<string, unknown> | null;
}> | null {
  if (value == null) {
    return null;
  }
  if (!Array.isArray(value)) {
    throw invalidInputError("steps must be an array when provided.");
  }
  const normalized = value.map((entry, index) => {
    const record = asRecord(entry);
    if (!record) {
      throw invalidInputError(`steps[${index}] must be an object.`);
    }
    const toolName =
      typeof record.toolName === "string" && record.toolName.trim().length > 0
        ? record.toolName.trim()
        : null;
    if (!toolName) {
      throw invalidInputError(`steps[${index}].toolName is required.`);
    }
    const argumentsValue =
      record.arguments === undefined
        ? undefined
        : record.arguments === null
          ? null
          : asRecord(record.arguments);
    if (record.arguments !== undefined && record.arguments !== null && !argumentsValue) {
      throw invalidInputError(`steps[${index}].arguments must be an object or null.`);
    }
    return {
      toolName,
      ...(record.arguments !== undefined ? { arguments: argumentsValue ?? null } : {}),
    };
  });
  return normalized;
}

export function buildRuntimeBrowserTools(
  options: Pick<
    BuildRuntimeToolsOptions,
    "snapshot" | "runtimeControl" | "requireUserApproval" | "onApprovalRequest" | "helpers"
  >
): WebMcpToolDescriptor[] {
  const { snapshot, runtimeControl, requireUserApproval, onApprovalRequest, helpers } = options;
  const control = runtimeControl as RuntimeBrowserControl;

  return [
    {
      name: "get-runtime-browser-debug-status",
      description:
        "Inspect runtime browser-debug availability, selected adapter mode, and exposed Playwright MCP tools.",
      inputSchema: {
        type: "object",
        properties: {
          workspaceId: { type: "string" },
        },
      },
      annotations: { readOnlyHint: true, title: "Get Runtime Browser Debug Status" },
      execute: async (input) => {
        const getRuntimeBrowserDebugStatus = requireBrowserControlMethod(
          control,
          "getRuntimeBrowserDebugStatus",
          "get-runtime-browser-debug-status"
        );
        const workspaceId = resolveWorkspaceId(input, snapshot, helpers);
        const result = await getRuntimeBrowserDebugStatus({ workspaceId });
        return helpers.buildResponse("Runtime browser debug status retrieved.", {
          workspaceId,
          result,
        });
      },
    },
    {
      name: "inspect-runtime-browser",
      description:
        "Run the runtime browser inspection flow. Prefers structured Playwright MCP snapshot output and can optionally attach a screenshot artifact.",
      inputSchema: {
        type: "object",
        properties: {
          workspaceId: { type: "string" },
          prompt: { type: "string" },
          query: { type: "string" },
          includeScreenshot: { type: "boolean" },
          timeoutMs: { type: "number" },
        },
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: true,
        title: "Inspect Runtime Browser",
        taskSupport: "partial",
      },
      execute: async (input) => {
        const runRuntimeBrowserDebug = requireBrowserControlMethod(
          control,
          "runRuntimeBrowserDebug",
          "inspect-runtime-browser"
        );
        const workspaceId = resolveWorkspaceId(input, snapshot, helpers);
        const prompt =
          helpers.toNonEmptyString(input.prompt) ?? helpers.toNonEmptyString(input.query);
        const timeoutMs = helpers.toPositiveInteger(input.timeoutMs);
        const includeScreenshot =
          typeof input.includeScreenshot === "boolean" ? input.includeScreenshot : false;
        const result = await runRuntimeBrowserDebug({
          workspaceId,
          operation: "inspect",
          prompt,
          includeScreenshot,
          timeoutMs,
          steps: null,
        });
        return helpers.buildResponse("Runtime browser inspection completed.", {
          workspaceId,
          result,
        });
      },
    },
    {
      name: "run-runtime-browser-automation",
      description:
        "Execute one or more runtime browser automation tool calls through the Playwright MCP adapter in a single ephemeral session.",
      inputSchema: {
        type: "object",
        properties: {
          workspaceId: { type: "string" },
          timeoutMs: { type: "number" },
          steps: {
            type: "array",
            items: {
              type: "object",
              properties: {
                toolName: { type: "string" },
                arguments: { type: "object", additionalProperties: true },
              },
              required: ["toolName"],
            },
          },
        },
        required: ["steps"],
      },
      annotations: {
        openWorldHint: true,
        title: "Run Runtime Browser Automation",
        taskSupport: "partial",
      },
      execute: async (input, agent) => {
        const runRuntimeBrowserDebug = requireBrowserControlMethod(
          control,
          "runRuntimeBrowserDebug",
          "run-runtime-browser-automation"
        );
        const workspaceId = resolveWorkspaceId(input, snapshot, helpers);
        const steps = normalizeToolCallArray(input.steps);
        if (!steps || steps.length === 0) {
          throw requiredInputError("steps is required.");
        }
        const timeoutMs = helpers.toPositiveInteger(input.timeoutMs);
        await helpers.confirmWriteAction(
          agent,
          requireUserApproval,
          `Run runtime browser automation in workspace ${snapshot.workspaceName}?`,
          onApprovalRequest
        );
        const result = await runRuntimeBrowserDebug({
          workspaceId,
          operation: "automation",
          prompt: null,
          includeScreenshot: false,
          timeoutMs,
          steps,
        });
        return helpers.buildResponse("Runtime browser automation completed.", {
          workspaceId,
          result,
        });
      },
    },
  ];
}
