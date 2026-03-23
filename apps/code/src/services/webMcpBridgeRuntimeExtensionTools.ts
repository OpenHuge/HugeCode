import {
  invalidInputError,
  methodUnavailableError,
  requiredInputError,
  resourceNotFoundError,
} from "./webMcpBridgeRuntimeToolHelpers";
import {
  type BuildRuntimeToolsOptions,
  type WebMcpToolDescriptor,
} from "./webMcpBridgeRuntimeToolsShared";
import type { RuntimeExtensionInstallRequest } from "@ku0/code-runtime-host-contract";
import type { RuntimeAgentControl } from "@ku0/code-runtime-webmcp-client/webMcpBridgeTypes";

type JsonRecord = Record<string, unknown>;

type RuntimeExtensionControl = RuntimeAgentControl & {
  listRuntimeExtensions?: (workspaceId?: string | null) => Promise<unknown>;
  installRuntimeExtension?: (input: RuntimeExtensionInstallRequest) => Promise<unknown>;
  removeRuntimeExtension?: (input: {
    workspaceId?: string | null;
    extensionId: string;
  }) => Promise<boolean | null>;
  listRuntimeExtensionTools?: (input: {
    workspaceId?: string | null;
    extensionId: string;
  }) => Promise<unknown>;
  readRuntimeExtensionResource?: (input: {
    workspaceId?: string | null;
    extensionId: string;
    resourceId: string;
  }) => Promise<unknown>;
  getRuntimeExtensionsConfig?: (workspaceId?: string | null) => Promise<unknown>;
};

type RuntimeExtensionControlMethodName =
  | "listRuntimeExtensions"
  | "installRuntimeExtension"
  | "removeRuntimeExtension"
  | "listRuntimeExtensionTools"
  | "readRuntimeExtensionResource"
  | "getRuntimeExtensionsConfig";

type RuntimeExtensionHelpers = Pick<
  BuildRuntimeToolsOptions["helpers"],
  "buildResponse" | "confirmWriteAction" | "toNonEmptyString"
>;

function requireRuntimeExtensionControlMethod<MethodName extends RuntimeExtensionControlMethodName>(
  control: RuntimeExtensionControl,
  methodName: MethodName,
  toolName: string
): NonNullable<RuntimeExtensionControl[MethodName]> {
  const candidate = control[methodName];
  if (typeof candidate !== "function") {
    throw methodUnavailableError(toolName, String(methodName));
  }
  return candidate as NonNullable<RuntimeExtensionControl[MethodName]>;
}

function asRecord(value: unknown): JsonRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as JsonRecord;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function buildRuntimeExtensionTools(
  options: Pick<
    BuildRuntimeToolsOptions,
    "snapshot" | "runtimeControl" | "requireUserApproval" | "onApprovalRequest"
  > & {
    helpers: RuntimeExtensionHelpers;
  }
): WebMcpToolDescriptor[] {
  const { snapshot, runtimeControl, requireUserApproval, onApprovalRequest, helpers } = options;
  const control = runtimeControl as RuntimeExtensionControl;

  return [
    {
      name: "list-runtime-extensions",
      description: "List runtime extensions available in the workspace or user scope.",
      inputSchema: {
        type: "object",
        properties: {
          workspaceId: { type: "string" },
        },
      },
      annotations: { readOnlyHint: true },
      execute: async (input) => {
        const listRuntimeExtensions = requireRuntimeExtensionControlMethod(
          control,
          "listRuntimeExtensions",
          "list-runtime-extensions"
        );
        const workspaceId = helpers.toNonEmptyString(input.workspaceId) ?? snapshot.workspaceId;
        const extensions = asArray(await listRuntimeExtensions(workspaceId));
        return helpers.buildResponse("Runtime extensions retrieved.", {
          workspaceId,
          total: extensions.length,
          extensions,
        });
      },
    },
    {
      name: "install-runtime-extension",
      description: "Install or register a runtime extension in the workspace or user scope.",
      inputSchema: {
        type: "object",
        properties: {
          workspaceId: { type: "string" },
          extensionId: { type: "string" },
          name: { type: "string" },
          transport: { type: "string" },
          enabled: { type: "boolean" },
          config: { type: "object", additionalProperties: true },
        },
        required: ["extensionId", "name", "transport"],
      },
      execute: async (input, agent) => {
        const installRuntimeExtension = requireRuntimeExtensionControlMethod(
          control,
          "installRuntimeExtension",
          "install-runtime-extension"
        );
        const extensionId = helpers.toNonEmptyString(input.extensionId);
        if (!extensionId) {
          throw requiredInputError("extensionId is required.");
        }
        const name = helpers.toNonEmptyString(input.name);
        if (!name) {
          throw requiredInputError("name is required.");
        }
        const transport = helpers.toNonEmptyString(input.transport);
        if (!transport) {
          throw requiredInputError("transport is required.");
        }
        if (input.config !== undefined && input.config !== null && !asRecord(input.config)) {
          throw invalidInputError("config must be an object or null.");
        }
        const workspaceId = helpers.toNonEmptyString(input.workspaceId) ?? snapshot.workspaceId;
        await helpers.confirmWriteAction(
          agent,
          requireUserApproval,
          `Install runtime extension ${extensionId} into workspace ${workspaceId}.`,
          onApprovalRequest
        );
        const extension = await installRuntimeExtension({
          workspaceId,
          extensionId,
          name,
          transport: transport as RuntimeExtensionInstallRequest["transport"],
          ...(typeof input.enabled === "boolean" ? { enabled: input.enabled } : {}),
          ...(input.config === undefined ? {} : { config: asRecord(input.config) }),
        });
        return helpers.buildResponse("Runtime extension installed.", {
          workspaceId,
          extension,
        });
      },
    },
    {
      name: "remove-runtime-extension",
      description: "Remove a runtime extension from the workspace or user scope.",
      inputSchema: {
        type: "object",
        properties: {
          workspaceId: { type: "string" },
          extensionId: { type: "string" },
        },
        required: ["extensionId"],
      },
      annotations: { destructiveHint: true },
      execute: async (input, agent) => {
        const removeRuntimeExtension = requireRuntimeExtensionControlMethod(
          control,
          "removeRuntimeExtension",
          "remove-runtime-extension"
        );
        const extensionId = helpers.toNonEmptyString(input.extensionId);
        if (!extensionId) {
          throw requiredInputError("extensionId is required.");
        }
        const workspaceId = helpers.toNonEmptyString(input.workspaceId) ?? snapshot.workspaceId;
        await helpers.confirmWriteAction(
          agent,
          requireUserApproval,
          `Remove runtime extension ${extensionId} from workspace ${workspaceId}.`,
          onApprovalRequest
        );
        const removed = await removeRuntimeExtension({
          workspaceId,
          extensionId,
        });
        return helpers.buildResponse("Runtime extension removed.", {
          workspaceId,
          extensionId,
          removed,
        });
      },
    },
    {
      name: "list-runtime-extension-tools",
      description: "List tools exposed by a runtime extension.",
      inputSchema: {
        type: "object",
        properties: {
          workspaceId: { type: "string" },
          extensionId: { type: "string" },
        },
        required: ["extensionId"],
      },
      annotations: { readOnlyHint: true },
      execute: async (input) => {
        const listRuntimeExtensionTools = requireRuntimeExtensionControlMethod(
          control,
          "listRuntimeExtensionTools",
          "list-runtime-extension-tools"
        );
        const extensionId = helpers.toNonEmptyString(input.extensionId);
        if (!extensionId) {
          throw requiredInputError("extensionId is required.");
        }
        const workspaceId = helpers.toNonEmptyString(input.workspaceId) ?? snapshot.workspaceId;
        const tools = asArray(await listRuntimeExtensionTools({ workspaceId, extensionId }));
        return helpers.buildResponse("Runtime extension tools retrieved.", {
          workspaceId,
          extensionId,
          total: tools.length,
          tools,
        });
      },
    },
    {
      name: "read-runtime-extension-resource",
      description: "Read a runtime extension resource payload by extension and resource id.",
      inputSchema: {
        type: "object",
        properties: {
          workspaceId: { type: "string" },
          extensionId: { type: "string" },
          resourceId: { type: "string" },
        },
        required: ["extensionId", "resourceId"],
      },
      annotations: { readOnlyHint: true },
      execute: async (input) => {
        const readRuntimeExtensionResource = requireRuntimeExtensionControlMethod(
          control,
          "readRuntimeExtensionResource",
          "read-runtime-extension-resource"
        );
        const extensionId = helpers.toNonEmptyString(input.extensionId);
        if (!extensionId) {
          throw requiredInputError("extensionId is required.");
        }
        const resourceId = helpers.toNonEmptyString(input.resourceId);
        if (!resourceId) {
          throw requiredInputError("resourceId is required.");
        }
        const workspaceId = helpers.toNonEmptyString(input.workspaceId) ?? snapshot.workspaceId;
        const resource = await readRuntimeExtensionResource({
          workspaceId,
          extensionId,
          resourceId,
        });
        if (!resource) {
          throw resourceNotFoundError(
            `Runtime extension resource ${resourceId} was not found for extension ${extensionId}.`
          );
        }
        return helpers.buildResponse("Runtime extension resource retrieved.", {
          workspaceId,
          resource,
        });
      },
    },
    {
      name: "get-runtime-extensions-config",
      description: "Read the runtime extensions config snapshot and warnings.",
      inputSchema: {
        type: "object",
        properties: {
          workspaceId: { type: "string" },
        },
      },
      annotations: { readOnlyHint: true },
      execute: async (input) => {
        const getRuntimeExtensionsConfig = requireRuntimeExtensionControlMethod(
          control,
          "getRuntimeExtensionsConfig",
          "get-runtime-extensions-config"
        );
        const workspaceId = helpers.toNonEmptyString(input.workspaceId) ?? snapshot.workspaceId;
        const config = asRecord(await getRuntimeExtensionsConfig(workspaceId));
        const extensions = asArray(config?.extensions);
        return helpers.buildResponse("Runtime extensions config retrieved.", {
          workspaceId,
          total: extensions.length,
          config,
          warnings: asStringArray(config?.warnings),
        });
      },
    },
  ];
}
