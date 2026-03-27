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
import type {
  RuntimeExtensionInstallRequest,
  RuntimeExtensionUpdateRequest,
} from "@ku0/code-runtime-host-contract";
import type { RuntimeAgentControl } from "@ku0/code-runtime-webmcp-client/webMcpBridgeTypes";

type JsonRecord = Record<string, unknown>;

type RuntimeExtensionControl = RuntimeAgentControl & {
  listRuntimeExtensions?: (workspaceId?: string | null) => Promise<unknown>;
  getRuntimeExtension?: (input: {
    workspaceId?: string | null;
    extensionId: string;
  }) => Promise<unknown>;
  installRuntimeExtension?: (input: RuntimeExtensionInstallRequest) => Promise<unknown>;
  updateRuntimeExtension?: (input: RuntimeExtensionUpdateRequest) => Promise<unknown>;
  setRuntimeExtensionState?: (input: {
    workspaceId?: string | null;
    extensionId: string;
    enabled: boolean;
  }) => Promise<unknown>;
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
  searchRuntimeExtensionRegistry?: (input?: {
    workspaceId?: string | null;
    query?: string | null;
    kinds?: string[] | null;
    sourceIds?: string[] | null;
  }) => Promise<unknown>;
  listRuntimeExtensionRegistrySources?: (workspaceId?: string | null) => Promise<unknown>;
  evaluateRuntimeExtensionPermissions?: (input: {
    workspaceId?: string | null;
    extensionId: string;
  }) => Promise<unknown>;
  readRuntimeExtensionHealth?: (input: {
    workspaceId?: string | null;
    extensionId: string;
  }) => Promise<unknown>;
};

type RuntimeExtensionControlMethodName =
  | "listRuntimeExtensions"
  | "getRuntimeExtension"
  | "installRuntimeExtension"
  | "updateRuntimeExtension"
  | "setRuntimeExtensionState"
  | "removeRuntimeExtension"
  | "listRuntimeExtensionTools"
  | "readRuntimeExtensionResource"
  | "getRuntimeExtensionsConfig"
  | "searchRuntimeExtensionRegistry"
  | "listRuntimeExtensionRegistrySources"
  | "evaluateRuntimeExtensionPermissions"
  | "readRuntimeExtensionHealth";

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
      name: "get-runtime-extension",
      description: "Read a single runtime extension record from the unified extension catalog.",
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
        const getRuntimeExtension = requireRuntimeExtensionControlMethod(
          control,
          "getRuntimeExtension",
          "get-runtime-extension"
        );
        const extensionId = helpers.toNonEmptyString(input.extensionId);
        if (!extensionId) {
          throw requiredInputError("extensionId is required.");
        }
        const workspaceId = helpers.toNonEmptyString(input.workspaceId) ?? snapshot.workspaceId;
        const extension = await getRuntimeExtension({ workspaceId, extensionId });
        if (!extension) {
          throw resourceNotFoundError(
            `Runtime extension ${extensionId} was not found in workspace ${workspaceId}.`
          );
        }
        return helpers.buildResponse("Runtime extension retrieved.", {
          workspaceId,
          extension,
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
      name: "update-runtime-extension",
      description:
        "Update runtime extension metadata, config, transport, or enablement without reinstalling it.",
      inputSchema: {
        type: "object",
        properties: {
          workspaceId: { type: "string" },
          extensionId: { type: "string" },
          version: { type: "string" },
          displayName: { type: "string" },
          publisher: { type: "string" },
          summary: { type: "string" },
          kind: { type: "string" },
          distribution: { type: "string" },
          transport: { type: "string" },
          enabled: { type: "boolean" },
          capabilities: { type: "array", items: { type: "string" } },
          permissions: { type: "array", items: { type: "string" } },
          config: { type: "object", additionalProperties: true },
          provenance: { type: "object", additionalProperties: true },
        },
        required: ["extensionId"],
      },
      execute: async (input, agent) => {
        const updateRuntimeExtension = requireRuntimeExtensionControlMethod(
          control,
          "updateRuntimeExtension",
          "update-runtime-extension"
        );
        const extensionId = helpers.toNonEmptyString(input.extensionId);
        if (!extensionId) {
          throw requiredInputError("extensionId is required.");
        }
        if (input.config !== undefined && input.config !== null && !asRecord(input.config)) {
          throw invalidInputError("config must be an object or null.");
        }
        if (
          input.provenance !== undefined &&
          input.provenance !== null &&
          !asRecord(input.provenance)
        ) {
          throw invalidInputError("provenance must be an object or null.");
        }
        const workspaceId = helpers.toNonEmptyString(input.workspaceId) ?? snapshot.workspaceId;
        await helpers.confirmWriteAction(
          agent,
          requireUserApproval,
          `Update runtime extension ${extensionId} in workspace ${workspaceId}.`,
          onApprovalRequest
        );
        const extension = await updateRuntimeExtension({
          workspaceId,
          extensionId,
          version: helpers.toNonEmptyString(input.version),
          displayName: helpers.toNonEmptyString(input.displayName),
          publisher: helpers.toNonEmptyString(input.publisher),
          summary: helpers.toNonEmptyString(input.summary),
          kind: helpers.toNonEmptyString(input.kind),
          distribution: helpers.toNonEmptyString(input.distribution),
          transport: helpers.toNonEmptyString(input.transport),
          enabled: typeof input.enabled === "boolean" ? input.enabled : null,
          capabilities: input.capabilities === undefined ? null : asStringArray(input.capabilities),
          permissions: input.permissions === undefined ? null : asStringArray(input.permissions),
          config: input.config === undefined ? null : asRecord(input.config),
          provenance: input.provenance === undefined ? null : asRecord(input.provenance),
        });
        return helpers.buildResponse("Runtime extension updated.", {
          workspaceId,
          extension,
        });
      },
    },
    {
      name: "set-runtime-extension-state",
      description: "Enable or disable a runtime extension in the unified extension catalog.",
      inputSchema: {
        type: "object",
        properties: {
          workspaceId: { type: "string" },
          extensionId: { type: "string" },
          enabled: { type: "boolean" },
        },
        required: ["extensionId", "enabled"],
      },
      execute: async (input, agent) => {
        const setRuntimeExtensionState = requireRuntimeExtensionControlMethod(
          control,
          "setRuntimeExtensionState",
          "set-runtime-extension-state"
        );
        const extensionId = helpers.toNonEmptyString(input.extensionId);
        if (!extensionId) {
          throw requiredInputError("extensionId is required.");
        }
        if (typeof input.enabled !== "boolean") {
          throw requiredInputError("enabled must be a boolean.");
        }
        const workspaceId = helpers.toNonEmptyString(input.workspaceId) ?? snapshot.workspaceId;
        await helpers.confirmWriteAction(
          agent,
          requireUserApproval,
          `${input.enabled ? "Enable" : "Disable"} runtime extension ${extensionId} in workspace ${workspaceId}.`,
          onApprovalRequest
        );
        const extension = await setRuntimeExtensionState({
          workspaceId,
          extensionId,
          enabled: input.enabled,
        });
        return helpers.buildResponse("Runtime extension state updated.", {
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
      name: "search-runtime-extension-registry",
      description:
        "Search the runtime extension registry and unified local catalog for installable extensions.",
      inputSchema: {
        type: "object",
        properties: {
          workspaceId: { type: "string" },
          query: { type: "string" },
          kinds: { type: "array", items: { type: "string" } },
          sourceIds: { type: "array", items: { type: "string" } },
        },
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
      execute: async (input) => {
        const searchRuntimeExtensionRegistry = requireRuntimeExtensionControlMethod(
          control,
          "searchRuntimeExtensionRegistry",
          "search-runtime-extension-registry"
        );
        const workspaceId = helpers.toNonEmptyString(input.workspaceId) ?? snapshot.workspaceId;
        const result = asRecord(
          await searchRuntimeExtensionRegistry({
            workspaceId,
            query: helpers.toNonEmptyString(input.query),
            kinds: input.kinds === undefined ? null : asStringArray(input.kinds),
            sourceIds: input.sourceIds === undefined ? null : asStringArray(input.sourceIds),
          })
        );
        const results = asArray(result?.results);
        const sources = asArray(result?.sources);
        return helpers.buildResponse("Runtime extension registry search completed.", {
          workspaceId,
          query: typeof result?.query === "string" ? result.query : "",
          total: results.length,
          results,
          sources,
        });
      },
    },
    {
      name: "list-runtime-extension-registry-sources",
      description: "List runtime extension registry sources known to the current runtime.",
      inputSchema: {
        type: "object",
        properties: {
          workspaceId: { type: "string" },
        },
      },
      annotations: { readOnlyHint: true },
      execute: async (input) => {
        const listRuntimeExtensionRegistrySources = requireRuntimeExtensionControlMethod(
          control,
          "listRuntimeExtensionRegistrySources",
          "list-runtime-extension-registry-sources"
        );
        const workspaceId = helpers.toNonEmptyString(input.workspaceId) ?? snapshot.workspaceId;
        const sources = asArray(await listRuntimeExtensionRegistrySources(workspaceId));
        return helpers.buildResponse("Runtime extension registry sources retrieved.", {
          workspaceId,
          total: sources.length,
          sources,
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
      name: "evaluate-runtime-extension-permissions",
      description: "Evaluate runtime extension permissions and approval posture.",
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
        const evaluateRuntimeExtensionPermissions = requireRuntimeExtensionControlMethod(
          control,
          "evaluateRuntimeExtensionPermissions",
          "evaluate-runtime-extension-permissions"
        );
        const extensionId = helpers.toNonEmptyString(input.extensionId);
        if (!extensionId) {
          throw requiredInputError("extensionId is required.");
        }
        const workspaceId = helpers.toNonEmptyString(input.workspaceId) ?? snapshot.workspaceId;
        const permissions = asRecord(
          await evaluateRuntimeExtensionPermissions({ workspaceId, extensionId })
        );
        return helpers.buildResponse("Runtime extension permissions evaluated.", {
          workspaceId,
          extensionId,
          permissions,
          warnings: asStringArray(permissions?.warnings),
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
      name: "get-runtime-extension-health",
      description: "Read runtime extension lifecycle health for a specific extension.",
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
        const readRuntimeExtensionHealth = requireRuntimeExtensionControlMethod(
          control,
          "readRuntimeExtensionHealth",
          "get-runtime-extension-health"
        );
        const extensionId = helpers.toNonEmptyString(input.extensionId);
        if (!extensionId) {
          throw requiredInputError("extensionId is required.");
        }
        const workspaceId = helpers.toNonEmptyString(input.workspaceId) ?? snapshot.workspaceId;
        const health = asRecord(await readRuntimeExtensionHealth({ workspaceId, extensionId }));
        return helpers.buildResponse("Runtime extension health retrieved.", {
          workspaceId,
          extensionId,
          health,
          warnings: asStringArray(health?.warnings),
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
