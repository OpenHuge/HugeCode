import { methodUnavailableError, requiredInputError } from "./webMcpBridgeRuntimeToolHelpers";
import type {
  BuildRuntimeToolsOptions,
  JsonRecord,
  WebMcpToolDescriptor,
} from "./webMcpBridgeRuntimeToolsShared";
import type { RuntimeAgentControl } from "./webMcpBridgeTypes";

type RuntimePolicyControl = RuntimeAgentControl & {
  getRuntimePolicy?: () => Promise<unknown>;
  setRuntimePolicy?: (input: {
    mode: "strict" | "balanced" | "aggressive";
    actor?: string | null;
  }) => Promise<unknown>;
  listRuntimeModels?: () => Promise<unknown>;
  listRuntimeProviderCatalog?: () => Promise<unknown>;
  listRuntimeCollaborationModes?: (workspaceId: string) => Promise<unknown>;
};

type RuntimePolicyControlMethodName =
  | "getRuntimePolicy"
  | "setRuntimePolicy"
  | "listRuntimeModels"
  | "listRuntimeProviderCatalog"
  | "listRuntimeCollaborationModes";

type RuntimePolicyHelpers = Pick<
  BuildRuntimeToolsOptions["helpers"],
  "buildResponse" | "toNonEmptyString" | "toPositiveInteger" | "confirmWriteAction"
>;

function requireRuntimePolicyControlMethod<MethodName extends RuntimePolicyControlMethodName>(
  control: RuntimePolicyControl,
  methodName: MethodName,
  toolName: string
): NonNullable<RuntimePolicyControl[MethodName]> {
  const candidate = control[methodName];
  if (typeof candidate !== "function") {
    throw methodUnavailableError(toolName, String(methodName));
  }
  return candidate as NonNullable<RuntimePolicyControl[MethodName]>;
}

function asRecord(value: unknown): JsonRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as JsonRecord;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function readWarnings(record: JsonRecord | null): string[] {
  const warnings = record?.warnings;
  return Array.isArray(warnings)
    ? warnings.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function readDataArray(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }
  const record = asRecord(value);
  return asArray(record?.data);
}

export function buildRuntimePolicyTools(
  options: Pick<
    BuildRuntimeToolsOptions,
    "snapshot" | "runtimeControl" | "requireUserApproval" | "onApprovalRequest"
  > & {
    helpers: RuntimePolicyHelpers;
  }
): WebMcpToolDescriptor[] {
  const { snapshot, runtimeControl, requireUserApproval, onApprovalRequest, helpers } = options;
  const control = runtimeControl as RuntimePolicyControl;

  return [
    {
      name: "get-runtime-policy",
      description: "Read the active runtime policy mode and last update timestamp.",
      inputSchema: { type: "object", properties: {} },
      annotations: { readOnlyHint: true },
      execute: async () => {
        const getRuntimePolicy = requireRuntimePolicyControlMethod(
          control,
          "getRuntimePolicy",
          "get-runtime-policy"
        );
        const policy = await getRuntimePolicy();
        return helpers.buildResponse("Runtime policy retrieved.", {
          workspaceId: snapshot.workspaceId,
          policy,
        });
      },
    },
    {
      name: "set-runtime-policy",
      description: "Update the active runtime policy mode for autonomy guardrails.",
      inputSchema: {
        type: "object",
        properties: {
          mode: { type: "string", enum: ["strict", "balanced", "aggressive"] },
          actor: { type: "string" },
        },
        required: ["mode"],
      },
      execute: async (input, agent) => {
        await helpers.confirmWriteAction(
          agent,
          requireUserApproval,
          `Update runtime policy in workspace ${snapshot.workspaceName}?`,
          onApprovalRequest
        );
        const setRuntimePolicy = requireRuntimePolicyControlMethod(
          control,
          "setRuntimePolicy",
          "set-runtime-policy"
        );
        const mode = helpers.toNonEmptyString(input.mode);
        if (mode !== "strict" && mode !== "balanced" && mode !== "aggressive") {
          throw requiredInputError("mode must be one of strict, balanced, or aggressive.");
        }
        const policy = await setRuntimePolicy({
          mode,
          actor: helpers.toNonEmptyString(input.actor),
        });
        return helpers.buildResponse("Runtime policy updated.", {
          workspaceId: snapshot.workspaceId,
          policy,
        });
      },
    },
    {
      name: "list-runtime-models",
      description: "List runtime models available for coding and orchestration.",
      inputSchema: { type: "object", properties: {} },
      annotations: { readOnlyHint: true },
      execute: async () => {
        const listRuntimeModels = requireRuntimePolicyControlMethod(
          control,
          "listRuntimeModels",
          "list-runtime-models"
        );
        const models = readDataArray(await listRuntimeModels());
        return helpers.buildResponse("Runtime models retrieved.", {
          workspaceId: snapshot.workspaceId,
          total: models.length,
          models,
        });
      },
    },
    {
      name: "list-runtime-provider-catalog",
      description: "List runtime provider catalog entries and readiness metadata.",
      inputSchema: { type: "object", properties: {} },
      annotations: { readOnlyHint: true },
      execute: async () => {
        const listRuntimeProviderCatalog = requireRuntimePolicyControlMethod(
          control,
          "listRuntimeProviderCatalog",
          "list-runtime-provider-catalog"
        );
        const providers = readDataArray(await listRuntimeProviderCatalog());
        return helpers.buildResponse("Runtime provider catalog retrieved.", {
          workspaceId: snapshot.workspaceId,
          total: providers.length,
          providers,
        });
      },
    },
    {
      name: "list-runtime-collaboration-modes",
      description: "List runtime collaboration mode presets available for the workspace.",
      inputSchema: {
        type: "object",
        properties: {
          workspaceId: { type: "string" },
        },
      },
      annotations: { readOnlyHint: true },
      execute: async (input) => {
        const listRuntimeCollaborationModes = requireRuntimePolicyControlMethod(
          control,
          "listRuntimeCollaborationModes",
          "list-runtime-collaboration-modes"
        );
        const workspaceId = helpers.toNonEmptyString(input.workspaceId) ?? snapshot.workspaceId;
        const response = asRecord(await listRuntimeCollaborationModes(workspaceId));
        const modes = asArray(response?.data);
        return helpers.buildResponse("Runtime collaboration modes retrieved.", {
          workspaceId,
          total: modes.length,
          modes,
          warnings: readWarnings(response),
        });
      },
    },
  ];
}
