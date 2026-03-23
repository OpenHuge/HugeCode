import type { PromptLibraryScope } from "@ku0/code-runtime-host-contract";
import {
  invalidInputError,
  methodUnavailableError,
  requiredInputError,
} from "./webMcpBridgeRuntimeToolHelpers";
import {
  type BuildRuntimeToolsOptions,
  type WebMcpToolDescriptor,
} from "./webMcpBridgeRuntimeToolsShared";
import type { RuntimeAgentControl } from "@ku0/code-runtime-webmcp-client/webMcpBridgeTypes";

type JsonRecord = Record<string, unknown>;

type RuntimePromptControl = RuntimeAgentControl & {
  listRuntimePrompts?: (workspaceId?: string | null) => Promise<unknown>;
  createRuntimePrompt?: (input: {
    workspaceId?: string | null;
    scope: PromptLibraryScope;
    title: string;
    description: string;
    content: string;
  }) => Promise<unknown>;
  updateRuntimePrompt?: (input: {
    workspaceId?: string | null;
    promptId: string;
    title: string;
    description: string;
    content: string;
  }) => Promise<unknown>;
  deleteRuntimePrompt?: (input: {
    workspaceId?: string | null;
    promptId: string;
  }) => Promise<boolean | null>;
  moveRuntimePrompt?: (input: {
    workspaceId?: string | null;
    promptId: string;
    targetScope: PromptLibraryScope;
  }) => Promise<unknown>;
};

type RuntimePromptControlMethodName =
  | "listRuntimePrompts"
  | "createRuntimePrompt"
  | "updateRuntimePrompt"
  | "deleteRuntimePrompt"
  | "moveRuntimePrompt";

type RuntimePromptHelpers = Pick<
  BuildRuntimeToolsOptions["helpers"],
  "buildResponse" | "confirmWriteAction" | "toNonEmptyString"
>;

const PROMPT_SCOPE_VALUES = new Set<PromptLibraryScope>(["workspace", "global"]);
const LEGACY_PROMPT_ALIAS_FIELDS = ["name", "path", "argumentHint", "argument_hint"] as const;

function requireRuntimePromptControlMethod<MethodName extends RuntimePromptControlMethodName>(
  control: RuntimePromptControl,
  methodName: MethodName,
  toolName: string
): NonNullable<RuntimePromptControl[MethodName]> {
  const candidate = control[methodName];
  if (typeof candidate !== "function") {
    throw methodUnavailableError(toolName, String(methodName));
  }
  return candidate as NonNullable<RuntimePromptControl[MethodName]>;
}

function hasOwnProperty(record: JsonRecord, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function rejectLegacyPromptAliases(input: JsonRecord): void {
  const alias = LEGACY_PROMPT_ALIAS_FIELDS.find((key) => hasOwnProperty(input, key));
  if (alias) {
    throw invalidInputError(`Legacy prompt field ${alias} is not supported.`);
  }
}

function resolveListWorkspaceId(
  input: JsonRecord,
  snapshotWorkspaceId: string,
  helpers: RuntimePromptHelpers
): string | null {
  if (hasOwnProperty(input, "workspaceId") && input.workspaceId === null) {
    return null;
  }
  return helpers.toNonEmptyString(input.workspaceId) ?? snapshotWorkspaceId;
}

function resolveMutationWorkspaceId(
  input: JsonRecord,
  snapshotWorkspaceId: string,
  helpers: RuntimePromptHelpers
): string | null {
  if (hasOwnProperty(input, "workspaceId")) {
    if (input.workspaceId === null) {
      return null;
    }
    const explicitWorkspaceId = helpers.toNonEmptyString(input.workspaceId);
    if (!explicitWorkspaceId) {
      throw requiredInputError("workspaceId is required.");
    }
    return explicitWorkspaceId;
  }
  const fallbackWorkspaceId = helpers.toNonEmptyString(snapshotWorkspaceId);
  if (!fallbackWorkspaceId) {
    throw requiredInputError("workspaceId is required.");
  }
  return fallbackWorkspaceId;
}

function requirePromptScope(value: unknown, fieldName: string): PromptLibraryScope {
  if (typeof value !== "string") {
    throw invalidInputError(`${fieldName} must be one of: workspace, global.`);
  }
  const trimmed = value.trim();
  if (!PROMPT_SCOPE_VALUES.has(trimmed as PromptLibraryScope)) {
    throw invalidInputError(`${fieldName} must be one of: workspace, global.`);
  }
  return trimmed as PromptLibraryScope;
}

function requirePromptId(input: JsonRecord, helpers: RuntimePromptHelpers): string {
  const promptId = helpers.toNonEmptyString(input.promptId);
  if (!promptId) {
    throw requiredInputError("promptId is required.");
  }
  return promptId;
}

function requirePromptTitle(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw requiredInputError("title is required.");
  }
  return value.trim();
}

function requirePromptText(value: unknown, fieldName: "description" | "content"): string {
  if (typeof value !== "string") {
    throw requiredInputError(`${fieldName} is required.`);
  }
  return value;
}

export function buildRuntimePromptTools(
  options: Pick<
    BuildRuntimeToolsOptions,
    "snapshot" | "runtimeControl" | "requireUserApproval" | "onApprovalRequest"
  > & {
    helpers: RuntimePromptHelpers;
  }
): WebMcpToolDescriptor[] {
  const { snapshot, runtimeControl, requireUserApproval, onApprovalRequest, helpers } = options;
  const control = runtimeControl as RuntimePromptControl;

  return [
    {
      name: "list-runtime-prompts",
      description: "List runtime prompt library entries for the workspace or global scope.",
      inputSchema: {
        type: "object",
        properties: {
          workspaceId: { type: ["string", "null"] },
        },
      },
      annotations: { readOnlyHint: true },
      execute: async (input) => {
        rejectLegacyPromptAliases(input);
        const listRuntimePrompts = requireRuntimePromptControlMethod(
          control,
          "listRuntimePrompts",
          "list-runtime-prompts"
        );
        const workspaceId = resolveListWorkspaceId(input, snapshot.workspaceId, helpers);
        const prompts = await listRuntimePrompts(workspaceId);
        return helpers.buildResponse("Runtime prompts retrieved.", {
          workspaceId,
          total: Array.isArray(prompts) ? prompts.length : 0,
          prompts,
        });
      },
    },
    {
      name: "create-runtime-prompt",
      description: "Create a runtime prompt library entry using the runtime contract shape.",
      inputSchema: {
        type: "object",
        properties: {
          workspaceId: { type: ["string", "null"] },
          scope: { type: "string", enum: ["workspace", "global"] },
          title: { type: "string" },
          description: { type: "string" },
          content: { type: "string" },
        },
        required: ["scope", "title", "description", "content"],
      },
      execute: async (input, agent) => {
        rejectLegacyPromptAliases(input);
        const createRuntimePrompt = requireRuntimePromptControlMethod(
          control,
          "createRuntimePrompt",
          "create-runtime-prompt"
        );
        const workspaceId = resolveMutationWorkspaceId(input, snapshot.workspaceId, helpers);
        const scope = requirePromptScope(input.scope, "scope");
        const title = requirePromptTitle(input.title);
        const description = requirePromptText(input.description, "description");
        const content = requirePromptText(input.content, "content");
        await helpers.confirmWriteAction(
          agent,
          requireUserApproval,
          `Create runtime prompt ${title} in ${scope} scope.`,
          onApprovalRequest
        );
        const prompt = await createRuntimePrompt({
          workspaceId,
          scope,
          title,
          description,
          content,
        });
        return helpers.buildResponse("Runtime prompt created.", {
          workspaceId,
          prompt,
        });
      },
    },
    {
      name: "update-runtime-prompt",
      description: "Update a runtime prompt library entry using the runtime contract shape.",
      inputSchema: {
        type: "object",
        properties: {
          workspaceId: { type: ["string", "null"] },
          promptId: { type: "string" },
          title: { type: "string" },
          description: { type: "string" },
          content: { type: "string" },
        },
        required: ["promptId", "title", "description", "content"],
      },
      execute: async (input, agent) => {
        rejectLegacyPromptAliases(input);
        const updateRuntimePrompt = requireRuntimePromptControlMethod(
          control,
          "updateRuntimePrompt",
          "update-runtime-prompt"
        );
        const workspaceId = resolveMutationWorkspaceId(input, snapshot.workspaceId, helpers);
        const promptId = requirePromptId(input, helpers);
        const title = requirePromptTitle(input.title);
        const description = requirePromptText(input.description, "description");
        const content = requirePromptText(input.content, "content");
        await helpers.confirmWriteAction(
          agent,
          requireUserApproval,
          `Update runtime prompt ${promptId}.`,
          onApprovalRequest
        );
        const prompt = await updateRuntimePrompt({
          workspaceId,
          promptId,
          title,
          description,
          content,
        });
        return helpers.buildResponse("Runtime prompt updated.", {
          workspaceId,
          prompt,
        });
      },
    },
    {
      name: "delete-runtime-prompt",
      description: "Delete a runtime prompt library entry.",
      inputSchema: {
        type: "object",
        properties: {
          workspaceId: { type: ["string", "null"] },
          promptId: { type: "string" },
        },
        required: ["promptId"],
      },
      annotations: { destructiveHint: true },
      execute: async (input, agent) => {
        rejectLegacyPromptAliases(input);
        const deleteRuntimePrompt = requireRuntimePromptControlMethod(
          control,
          "deleteRuntimePrompt",
          "delete-runtime-prompt"
        );
        const workspaceId = resolveMutationWorkspaceId(input, snapshot.workspaceId, helpers);
        const promptId = requirePromptId(input, helpers);
        await helpers.confirmWriteAction(
          agent,
          requireUserApproval,
          `Delete runtime prompt ${promptId}.`,
          onApprovalRequest
        );
        const deleted = await deleteRuntimePrompt({
          workspaceId,
          promptId,
        });
        return helpers.buildResponse("Runtime prompt deleted.", {
          workspaceId,
          promptId,
          deleted,
        });
      },
    },
    {
      name: "move-runtime-prompt",
      description: "Move a runtime prompt library entry between workspace and global scope.",
      inputSchema: {
        type: "object",
        properties: {
          workspaceId: { type: ["string", "null"] },
          promptId: { type: "string" },
          targetScope: { type: "string", enum: ["workspace", "global"] },
        },
        required: ["promptId", "targetScope"],
      },
      execute: async (input, agent) => {
        rejectLegacyPromptAliases(input);
        const moveRuntimePrompt = requireRuntimePromptControlMethod(
          control,
          "moveRuntimePrompt",
          "move-runtime-prompt"
        );
        const workspaceId = resolveMutationWorkspaceId(input, snapshot.workspaceId, helpers);
        const promptId = requirePromptId(input, helpers);
        const targetScope = requirePromptScope(input.targetScope, "targetScope");
        await helpers.confirmWriteAction(
          agent,
          requireUserApproval,
          `Move runtime prompt ${promptId} to ${targetScope} scope.`,
          onApprovalRequest
        );
        const prompt = await moveRuntimePrompt({
          workspaceId,
          promptId,
          targetScope,
        });
        return helpers.buildResponse("Runtime prompt moved.", {
          workspaceId,
          prompt,
        });
      },
    },
  ];
}
